"""Bounded Railway replica scaling for the render and transcription workers.

Scaling runs without an API polling loop and without worker cloud credentials:
the API scales up on enqueue, the cron pass scales down when a service is idle.
Each worker service has its own Redis keys, replica ceiling and Railway service
id, so render and transcription scale independently.
"""
from dataclasses import dataclass
import json
import os
import time
import uuid
import urllib.request

from redis.exceptions import WatchError

LOCK_SECONDS = 60
DRAIN_SECONDS = 300
# Railway must let a replaced replica finish its job: RQ job timeouts are 30
# minutes for both renders and transcriptions.
SHUTDOWN_GRACE_SECONDS = 1860
# The Railway control plane is only consulted when demand exceeds the replica
# count this cache last saw. Every enqueue and queued-status poll can reach
# reconcile(); without the cache a sustained backlog queried Railway on every
# call and could exhaust the account's API rate limit, which then also blocked
# the scale-ups that were really needed.
CURRENT_REPLICAS_TTL_SECONDS = 300
CONTROL_PLANE_BACKOFF_SECONDS = 30
# Hard safety ceiling whatever an environment variable says; the configured
# per-service maximum must be within 1..REPLICA_CEILING.
REPLICA_CEILING = 10
DEFAULT_MAX_REPLICAS = 3
DEFAULT_REGION = "asia-southeast1-eqsg3a"


@dataclass(frozen=True)
class ScaledService:
    """One Railway worker service that may run several replicas."""

    name: str
    job: str
    prefix: str
    enabled_env: str
    service_id_env: str
    max_replicas_env: str

    @property
    def lock(self):
        return self.prefix + "resize"

    @property
    def drains(self):
        return self.prefix + "drain:"

    @property
    def drain_slots(self):
        return self.prefix + "drain_slots"

    @property
    def last_change(self):
        return self.prefix + "last_change"

    @property
    def current_replicas(self):
        return self.prefix + "replicas"

    @property
    def backoff(self):
        return self.prefix + "backoff"

    def enabled(self):
        return os.environ.get(self.enabled_env) == "1"

    def max_replicas(self):
        try:
            configured = int(os.environ.get(self.max_replicas_env, "") or DEFAULT_MAX_REPLICAS)
        except ValueError:
            configured = DEFAULT_MAX_REPLICAS
        return max(1, min(REPLICA_CEILING, configured))

    def queues(self):
        try:
            mapping = json.loads(os.environ.get("WORKER_LAUNCH_JOBS", "{}"))
        except (ValueError, TypeError):
            return []
        if not isinstance(mapping, dict):
            return []
        return [name for name, job in mapping.items() if job == self.job]


RENDER = ScaledService(
    name="render",
    job="lekha-render",
    prefix="lekha:render_scaling:",
    enabled_env="RENDER_AUTOSCALE_ENABLED",
    service_id_env="RENDER_AUTOSCALE_SERVICE_ID",
    max_replicas_env="RENDER_AUTOSCALE_MAX_REPLICAS",
)
TRANSCRIPTION = ScaledService(
    name="transcription",
    job="lekha-transcription",
    prefix="lekha:transcription_scaling:",
    enabled_env="TRANSCRIPTION_AUTOSCALE_ENABLED",
    service_id_env="TRANSCRIPTION_AUTOSCALE_SERVICE_ID",
    max_replicas_env="TRANSCRIPTION_AUTOSCALE_MAX_REPLICAS",
)
TARGETS = (RENDER, TRANSCRIPTION)


def target_for_job(job_name):
    """The enabled scaled service for a worker name, or None."""
    return next((target for target in TARGETS if target.job == job_name and target.enabled()), None)


def enabled_targets():
    return [target for target in TARGETS if target.enabled()]


# Render names kept for existing callers and operational tooling.
PREFIX = RENDER.prefix
LOCK = RENDER.lock
DRAINS = RENDER.drains
LAST_CHANGE = RENDER.last_change
CURRENT_REPLICAS = RENDER.current_replicas
CONTROL_PLANE_BACKOFF = RENDER.backoff
DRAIN_SLOTS = RENDER.drain_slots


def enabled():
    return RENDER.enabled()


def render_job():
    return RENDER.job


def render_queues():
    return RENDER.queues()


class DrainLease:
    """Atomic exclusion between starting a burst and shrinking its service."""
    def __init__(self, connection, identity, target=RENDER):
        self.connection = connection
        self.identity = identity
        self.target = target
        self.key = target.drains + identity
        self.registered = False

    def refresh(self):
        target = self.target
        if self.registered:
            with self.connection.pipeline() as pipe:
                pipe.expire(self.key, DRAIN_SECONDS)
                pipe.zadd(target.drain_slots, {self.identity: time.time() + DRAIN_SECONDS})
                pipe.execute()
            return
        deadline = time.monotonic() + SHUTDOWN_GRACE_SECONDS + LOCK_SECONDS
        while time.monotonic() < deadline:
            try:
                with self.connection.pipeline() as pipe:
                    pipe.watch(target.lock, target.drain_slots)
                    now = time.time()
                    occupied = pipe.zcount(target.drain_slots, "(" + str(now), "+inf")
                    if pipe.exists(target.lock) or occupied >= target.max_replicas():
                        pipe.unwatch()
                        time.sleep(0.2)
                        continue
                    pipe.multi()
                    pipe.zremrangebyscore(target.drain_slots, "-inf", now)
                    pipe.zadd(target.drain_slots, {self.identity: now + DRAIN_SECONDS})
                    pipe.set(self.key, "1", ex=DRAIN_SECONDS)
                    pipe.execute()
                    self.registered = True
                    return
            except WatchError:
                continue
        raise RuntimeError("Worker drain capacity did not become available")

    def release(self):
        with self.connection.pipeline() as pipe:
            pipe.delete(self.key)
            pipe.zrem(self.target.drain_slots, self.identity)
            pipe.execute()
        self.registered = False


def _graphql(query, variables):
    # One project access token covers every service in the environment.
    token = os.environ.get("RAILWAY_RENDER_SCALING_TOKEN", "")
    if not token:
        raise RuntimeError("RAILWAY_RENDER_SCALING_TOKEN is missing")
    request = urllib.request.Request(
        "https://backboard.railway.com/graphql/v2",
        data=json.dumps({"query": query, "variables": variables}).encode(),
        headers={"Content-Type": "application/json", "Project-Access-Token": token,
                 "User-Agent": "LekhaCaptions/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=10) as response:  # nosec B310 - fixed Railway API
        payload = json.load(response)
    if payload.get("errors") or not payload.get("data"):
        # Provider error text can contain request details; never print it.
        raise RuntimeError("Railway scaling request failed")
    return payload["data"]


class RailwayScaledService:
    def __init__(self, target=RENDER):
        self.target = target
        self.environment = os.environ.get("RAILWAY_ENVIRONMENT_ID", "")
        self.service = os.environ.get(target.service_id_env, "")
        self.region = os.environ.get("RENDER_AUTOSCALE_REGION", DEFAULT_REGION)
        if not self.environment or not self.service:
            raise RuntimeError("Scaling target is missing")

    def state(self):
        data = _graphql(
            "query($e:String!,$s:String!){environment(id:$e){config(decryptVariables:false)} "
            "serviceInstance(environmentId:$e,serviceId:$s){serviceName latestDeployment{status meta}}}",
            {"e": self.environment, "s": self.service},
        )
        instance = data["serviceInstance"]
        if instance["serviceName"] != self.target.job:
            raise RuntimeError("Scaling target does not match")
        deploy = data["environment"]["config"]["services"][self.service]["deploy"]
        regions = deploy.get("multiRegionConfig", {})
        if set(regions) != {self.region} or deploy.get("sleepApplication") is not True:
            raise RuntimeError("Expected sleeping single-region worker service")
        count = int(regions[self.region]["numReplicas"])
        # A count above today's ceiling (lowered configuration) is still read so
        # the idle scale-down can bring it back within range.
        if not 1 <= count <= REPLICA_CEILING:
            raise RuntimeError("Worker replicas are outside the approved range")
        deployment = instance.get("latestDeployment") or {}
        metadata = deployment.get("meta") or {}
        effective_deploy = (metadata.get("serviceManifest") or {}).get("deploy") or {}
        if int(effective_deploy.get("drainingSeconds") or 0) < SHUTDOWN_GRACE_SECONDS:
            raise RuntimeError("Worker deployment shutdown grace is not ready")
        return count, deployment.get("status")

    def resize(self, count):
        if not 1 <= count <= self.target.max_replicas():
            raise ValueError("Worker replicas must stay within the configured maximum")
        patch = {"services": {self.service: {"deploy": {
            "multiRegionConfig": {self.region: {"numReplicas": count}},
        }}}}
        _graphql(
            "mutation($e:String!,$p:EnvironmentConfig!,$m:String!){environmentPatchCommit("
            "environmentId:$e,patch:$p,commitMessage:$m)}",
            {"e": self.environment, "p": patch, "m": f"Bounded {self.target.job} autoscaling"},
        )


class RailwayRenderService(RailwayScaledService):
    def __init__(self):
        super().__init__(RENDER)


def reconcile(connection, *, allow_down=False, service=None, now=None, log=print, target=RENDER):
    """Never shrink running work; failed scaling preserves existing capacity."""
    if not target.enabled() or connection is None:
        return "disabled"
    now = time.time() if now is None else now
    owner = uuid.uuid4().hex
    maximum = target.max_replicas()
    try:
        if not allow_down and connection.exists(target.backoff):
            return "backoff"
        if not connection.set(target.lock, owner, nx=True, ex=LOCK_SECONDS):
            return "locked"
    except Exception as error:
        log(json.dumps({"event": f"{target.name}_scaling_failed",
                        "error_type": type(error).__name__}))
        return "failed"
    try:
        queues = target.queues()
        if not queues:
            return "no_worker_queues"
        backlog = sum(connection.llen("rq:queue:" + name) for name in queues)
        active = sum(1 for _ in connection.scan_iter(match=target.drains + "*"))
        last = float(connection.get(target.last_change) or 0)
        desired = max(1, min(maximum, backlog + active))
        cached = int(connection.get(target.current_replicas) or 0)
        # Higher demand bypasses this suppression to scale up quickly. While the
        # cached count already covers demand the API path never asks Railway;
        # the cached count expires so external changes are re-read.
        if not allow_down and cached >= desired:
            return "cooldown"
        if not backlog and not allow_down:
            return "idle"
        if service is None and not os.environ.get("RAILWAY_RENDER_SCALING_TOKEN"):
            return "missing_token"
        service = service or RailwayScaledService(target)
        current, status = service.state()
        connection.set(target.current_replicas, str(current), ex=CURRENT_REPLICAS_TTL_SECONDS)
        if status not in {"SUCCESS", "SLEEPING"}:
            connection.set(target.backoff, "deploying", ex=CONTROL_PLANE_BACKOFF_SECONDS)
            return "deploying"
        if desired > current:
            service.resize(desired)
            connection.set(target.last_change, str(now))
            connection.set(target.current_replicas, str(desired), ex=CURRENT_REPLICAS_TTL_SECONDS)
            log(json.dumps({"event": f"{target.name}_scaled_up", "replicas": desired}))
            return "scaled_up"
        if desired < current and allow_down:
            started = any(connection.zcard("rq:wip:" + name) for name in queues)
            scheduled = any(connection.zcard("rq:scheduled:" + name) for name in queues)
            if active or backlog or started or scheduled or status != "SLEEPING":
                return "busy"
            if now - last < 900:
                return "cooldown"
            service.resize(1)
            connection.set(target.last_change, str(now))
            connection.set(target.current_replicas, "1", ex=CURRENT_REPLICAS_TTL_SECONDS)
            log(json.dumps({"event": f"{target.name}_scaled_down", "replicas": 1}))
            return "scaled_down"
        return "unchanged"
    except Exception as error:
        log(json.dumps({"event": f"{target.name}_scaling_failed",
                        "error_type": type(error).__name__}))
        try:
            # Existing capacity is preserved; retry the control plane shortly
            # instead of on every poll while it is failing or rate limited.
            connection.set(target.backoff, "failed", ex=CONTROL_PLANE_BACKOFF_SECONDS)
        except Exception:
            pass
        return "failed"
    finally:
        try:
            with connection.pipeline() as pipe:
                pipe.watch(target.lock)
                if pipe.get(target.lock) == owner.encode():
                    pipe.multi()
                    pipe.delete(target.lock)
                    pipe.execute()
        except Exception:
            # Expiry recovers even if Redis goes away during guard cleanup.
            pass
