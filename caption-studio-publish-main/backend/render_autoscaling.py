"""Bounded render scaling without an API polling loop or worker cloud credentials."""
import json
import os
import time
import uuid
import urllib.request

from redis.exceptions import WatchError

PREFIX = "lekha:render_scaling:"
LOCK = PREFIX + "resize"
DRAINS = PREFIX + "drain:"
LAST_CHANGE = PREFIX + "last_change"
CURRENT_REPLICAS = PREFIX + "replicas"
MAX_REPLICAS = 3
LOCK_SECONDS = 60
DRAIN_SECONDS = 300


def enabled():
    return os.environ.get("RENDER_AUTOSCALE_ENABLED") == "1"


def render_job():
    return "lekha-render"


def render_queues():
    try:
        mapping = json.loads(os.environ.get("WORKER_LAUNCH_JOBS", "{}"))
    except (ValueError, TypeError):
        return []
    return [name for name, job in mapping.items() if job == render_job()]


class DrainLease:
    """Atomic exclusion between starting a burst and shrinking its service."""
    def __init__(self, connection, identity):
        self.connection = connection
        self.key = DRAINS + identity
        self.registered = False

    def refresh(self):
        if self.registered:
            self.connection.expire(self.key, DRAIN_SECONDS)
            return
        deadline = time.monotonic() + LOCK_SECONDS + 5
        while time.monotonic() < deadline:
            try:
                with self.connection.pipeline() as pipe:
                    pipe.watch(LOCK)
                    if pipe.exists(LOCK):
                        pipe.unwatch()
                        time.sleep(0.2)
                        continue
                    pipe.multi()
                    pipe.set(self.key, "1", ex=DRAIN_SECONDS)
                    pipe.execute()
                    self.registered = True
                    return
            except WatchError:
                continue
        raise RuntimeError("Render resize guard did not clear")

    def release(self):
        self.connection.delete(self.key)
        self.registered = False


def _graphql(query, variables):
    token = os.environ.get("RAILWAY_RENDER_SCALING_TOKEN", "")
    if not token:
        raise RuntimeError("RAILWAY_RENDER_SCALING_TOKEN is missing")
    request = urllib.request.Request(
        "https://backboard.railway.com/graphql/v2",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Content-Type": "application/json", "Project-Access-Token": token},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # nosec B310 - fixed Railway API
        payload = json.load(response)
    if payload.get("errors") or not payload.get("data"):
        # Provider error text can contain request details; never print it.
        raise RuntimeError("Railway render scaling request failed")
    return payload["data"]


class RailwayRenderService:
    def __init__(self):
        self.environment = os.environ.get("RAILWAY_ENVIRONMENT_ID", "")
        self.service = os.environ.get("RENDER_AUTOSCALE_SERVICE_ID", "")
        self.region = os.environ.get("RENDER_AUTOSCALE_REGION", "asia-southeast1-eqsg3a")
        if not self.environment or not self.service:
            raise RuntimeError("Render scaling target is missing")

    def state(self):
        data = _graphql(
            "query($e:String!,$s:String!){environment(id:$e){config(decryptVariables:false)} "
            "serviceInstance(environmentId:$e,serviceId:$s){serviceName latestDeployment{status}}}",
            {"e": self.environment, "s": self.service},
        )
        instance = data["serviceInstance"]
        if instance["serviceName"] != render_job():
            raise RuntimeError("Render scaling target does not match")
        deploy = data["environment"]["config"]["services"][self.service]["deploy"]
        regions = deploy.get("multiRegionConfig", {})
        if set(regions) != {self.region} or deploy.get("sleepApplication") is not True:
            raise RuntimeError("Expected sleeping single-region render service")
        count = int(regions[self.region]["numReplicas"])
        if not 1 <= count <= MAX_REPLICAS:
            raise RuntimeError("Render replicas are outside the approved range")
        return count, (instance.get("latestDeployment") or {}).get("status")

    def resize(self, count):
        if not 1 <= count <= MAX_REPLICAS:
            raise ValueError("Render replicas must be between one and three")
        patch = {"services": {self.service: {"deploy": {
            "multiRegionConfig": {self.region: {"numReplicas": count}},
        }}}}
        _graphql(
            "mutation($e:String!,$p:EnvironmentConfig!,$m:String!){environmentPatchCommit("
            "environmentId:$e,patch:$p,commitMessage:$m)}",
            {"e": self.environment, "p": patch, "m": "Bounded render autoscaling"},
        )


def reconcile(connection, *, allow_down=False, service=None, now=None, log=print):
    """Never shrink running renders; failed scaling preserves existing capacity."""
    if not enabled() or connection is None:
        return "disabled"
    now = time.time() if now is None else now
    owner = uuid.uuid4().hex
    try:
        if not connection.set(LOCK, owner, nx=True, ex=LOCK_SECONDS):
            return "locked"
    except Exception as error:
        log(json.dumps({"event": "render_scaling_failed", "error_type": type(error).__name__}))
        return "failed"
    try:
        queues = render_queues()
        if not queues:
            return "no_render_queues"
        backlog = sum(connection.llen("rq:queue:" + name) for name in queues)
        active = sum(1 for _ in connection.scan_iter(match=DRAINS + "*"))
        last = float(connection.get(LAST_CHANGE) or 0)
        desired = max(1, min(MAX_REPLICAS, backlog + active))
        cached = int(connection.get(CURRENT_REPLICAS) or 0)
        # Higher demand bypasses this suppression to scale 1 to 2 to 3 quickly.
        if not allow_down and now - last < 60 and cached >= desired:
            return "cooldown"
        if not backlog and not allow_down:
            return "idle"
        if service is None and not os.environ.get("RAILWAY_RENDER_SCALING_TOKEN"):
            return "missing_token"
        service = service or RailwayRenderService()
        current, status = service.state()
        connection.set(CURRENT_REPLICAS, str(current))
        if desired > current:
            service.resize(desired)
            connection.set(LAST_CHANGE, str(now))
            connection.set(CURRENT_REPLICAS, str(desired))
            log(json.dumps({"event": "render_scaled_up", "replicas": desired}))
            return "scaled_up"
        if desired < current and allow_down:
            started = any(connection.zcard("rq:wip:" + name) for name in queues)
            scheduled = any(connection.zcard("rq:scheduled:" + name) for name in queues)
            if active or backlog or started or scheduled or status != "SLEEPING":
                return "busy"
            if now - last < 900:
                return "cooldown"
            service.resize(1)
            connection.set(LAST_CHANGE, str(now))
            connection.set(CURRENT_REPLICAS, "1")
            log(json.dumps({"event": "render_scaled_down", "replicas": 1}))
            return "scaled_down"
        return "unchanged"
    except Exception as error:
        log(json.dumps({"event": "render_scaling_failed", "error_type": type(error).__name__}))
        return "failed"
    finally:
        try:
            with connection.pipeline() as pipe:
                pipe.watch(LOCK)
                if pipe.get(LOCK) == owner.encode():
                    pipe.multi()
                    pipe.delete(LOCK)
                    pipe.execute()
        except Exception:
            # Expiry recovers even if Redis goes away during guard cleanup.
            pass
