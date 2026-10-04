import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import render_autoscaling as scaling
import worker_launcher


class FakeService:
    def __init__(self, replicas=1, status="SUCCESS"):
        self.replicas, self.status = replicas, status
        self.changes = []

    def state(self):
        return self.replicas, self.status

    def resize(self, count):
        self.changes.append(count)
        self.replicas = count


class RenderScalingTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.environment = patch.dict(os.environ, {
            "RENDER_AUTOSCALE_ENABLED": "1",
            "WORKER_LAUNCH_JOBS": json.dumps({"export": "lekha-render", "scan": "lekha-transcription"}),
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def run_scaler(self, service, **kwargs):
        return scaling.reconcile(self.redis, service=service, now=2000,
                                 log=lambda _: None, **kwargs)

    def queue(self, count):
        for i in range(count):
            self.redis.rpush("rq:queue:export", str(i))

    def test_scales_backlog_to_three_and_never_beyond(self):
        self.queue(100)
        service = FakeService()
        self.assertEqual(self.run_scaler(service), "scaled_up")
        self.assertEqual(service.changes, [3])
        self.assertFalse(self.redis.exists(scaling.LOCK))

    def test_accounts_for_busy_worker_when_one_more_job_arrives(self):
        self.queue(1)
        self.redis.set(scaling.DRAINS + "replica-a", "1", ex=300)
        service = FakeService()
        self.assertEqual(self.run_scaler(service), "scaled_up")
        self.assertEqual(service.changes, [2])

    def test_downscale_only_sleeping_empty_service(self):
        service = FakeService(3, "SLEEPING")
        self.assertEqual(self.run_scaler(service, allow_down=True), "scaled_down")
        self.assertEqual(service.changes, [1])

    def test_running_service_is_never_shrunk_even_without_registry_entries(self):
        service = FakeService(3)
        self.assertEqual(self.run_scaler(service, allow_down=True), "busy")
        self.assertEqual(service.changes, [])

    def test_active_scheduled_or_started_work_prevents_shrink(self):
        for key, kind in [(scaling.DRAINS + "a", "string"),
                          ("rq:wip:export", "zset"), ("rq:scheduled:export", "zset")]:
            with self.subTest(key=key):
                self.redis.flushall()
                if kind == "string":
                    self.redis.set(key, "1", ex=300)
                else:
                    self.redis.zadd(key, {"job": 1990})
                service = FakeService(3, "SLEEPING")
                self.assertEqual(self.run_scaler(service, allow_down=True), "busy")
                self.assertEqual(service.changes, [])

    def test_cooldown_prevents_repeated_mutations(self):
        self.queue(3)
        self.redis.set(scaling.LAST_CHANGE, "1980")
        self.redis.set(scaling.CURRENT_REPLICAS, "3")
        service = FakeService()
        self.assertEqual(self.run_scaler(service), "cooldown")
        self.assertEqual(service.changes, [])

    def test_new_higher_demand_bypasses_scale_up_cooldown(self):
        self.queue(3)
        self.redis.set(scaling.LAST_CHANGE, "1980")
        self.redis.set(scaling.CURRENT_REPLICAS, "2")
        service = FakeService(2)
        self.assertEqual(self.run_scaler(service), "scaled_up")
        self.assertEqual(service.changes, [3])

    def test_api_path_never_downscales(self):
        service = FakeService(3, "SLEEPING")
        self.assertEqual(self.run_scaler(service), "idle")
        self.assertEqual(service.changes, [])

    def test_control_plane_failure_is_redacted_and_releases_lock(self):
        self.queue(3)
        secret_marker = "must-not-appear"
        service = FakeService()
        service.resize = lambda _: (_ for _ in ()).throw(RuntimeError(secret_marker))
        logs = []
        self.assertEqual(scaling.reconcile(self.redis, service=service, now=2000,
                                           log=logs.append), "failed")
        self.assertNotIn(secret_marker, str(logs))
        self.assertFalse(self.redis.exists(scaling.LOCK))

    def test_missing_token_does_not_change_capacity(self):
        self.queue(3)
        with patch.dict(os.environ, {"RAILWAY_RENDER_SCALING_TOKEN": ""}):
            self.assertEqual(scaling.reconcile(self.redis), "missing_token")

    def test_disabled_scaling_does_not_touch_redis(self):
        with patch.dict(os.environ, {"RENDER_AUTOSCALE_ENABLED": "0"}):
            self.assertEqual(self.run_scaler(FakeService()), "disabled")
        self.assertEqual(self.redis.keys(), [])

    def test_drain_registration_blocks_resize_and_independent_replicas_release_independently(self):
        with patch.dict(os.environ, {"WORKER_LAUNCH_JOB_NAME": "lekha-render", "RAILWAY_REPLICA_ID": "a"}):
            a = worker_launcher.WorkerLease(self.redis, ["export"])
        with patch.dict(os.environ, {"WORKER_LAUNCH_JOB_NAME": "lekha-render", "RAILWAY_REPLICA_ID": "b"}):
            b = worker_launcher.WorkerLease(self.redis, ["export"])
        a.refresh()
        b.refresh()
        self.assertNotEqual(a.key, b.key)
        a.release()
        self.assertTrue(self.redis.exists(b.key))
        self.assertEqual(self.run_scaler(FakeService(3, "SLEEPING"), allow_down=True), "busy")
        b.release()
        self.assertEqual(self.run_scaler(FakeService(3, "SLEEPING"), allow_down=True), "scaled_down")

    def test_resize_guard_blocks_new_burst_registration_until_released(self):
        self.redis.set(scaling.LOCK, "controller", ex=60)
        lease = scaling.DrainLease(self.redis, "new-replica")
        def release_guard(_):
            self.assertFalse(self.redis.exists(lease.key))
            self.redis.delete(scaling.LOCK)
        with patch.object(scaling.time, "sleep", release_guard):
            lease.refresh()
        self.assertTrue(self.redis.exists(lease.key))
        lease.release()

    def test_replacement_workers_cannot_exceed_three_active_drains(self):
        old = scaling.DrainLease(self.redis, "old-deployment")
        a = scaling.DrainLease(self.redis, "new-a")
        b = scaling.DrainLease(self.redis, "new-b")
        fourth = scaling.DrainLease(self.redis, "new-c")
        for lease in (old, a, b):
            lease.refresh()
        def finish_old(_):
            self.assertFalse(self.redis.exists(fourth.key))
            self.assertEqual(self.redis.zcard(scaling.DRAIN_SLOTS), 3)
            old.release()
        with patch.object(scaling.time, "sleep", finish_old):
            fourth.refresh()
        self.assertEqual(self.redis.zcard(scaling.DRAIN_SLOTS), 3)
        self.assertFalse(self.redis.exists(old.key))
        a.refresh()
        self.assertTrue(self.redis.exists(a.key))

    def test_expired_slot_does_not_block_replacement(self):
        self.redis.zadd(scaling.DRAIN_SLOTS, {"dead": 1, "dead2": 1, "dead3": 1})
        lease = scaling.DrainLease(self.redis, "replacement")
        lease.refresh()
        self.assertEqual(self.redis.zcard(scaling.DRAIN_SLOTS), 1)
        lease.release()
        self.assertEqual(self.redis.zcard(scaling.DRAIN_SLOTS), 0)

    def test_pending_deployment_is_not_resized_again(self):
        self.queue(3)
        service = FakeService(1, "DEPLOYING")
        self.assertEqual(self.run_scaler(service), "deploying")
        self.assertEqual(service.changes, [])

    def test_provider_requires_effective_image_shutdown_grace(self):
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID": "env",
                                   "RENDER_AUTOSCALE_SERVICE_ID": "render"}):
            service = scaling.RailwayRenderService()
        deploy = {"sleepApplication": True,
                  "multiRegionConfig": {service.region: {"numReplicas": 1}}}
        data = {"environment": {"config": {"services": {"render": {"deploy": deploy}}}},
                "serviceInstance": {"serviceName": "lekha-render", "latestDeployment": {
                    "status": "SUCCESS", "meta": {"serviceManifest": {"deploy": {}}}}}}
        with patch.object(scaling, "_graphql", return_value=data):
            with self.assertRaisesRegex(RuntimeError, "shutdown grace"):
                service.state()
            data["serviceInstance"]["latestDeployment"]["meta"]["serviceManifest"]["deploy"]["drainingSeconds"] = 1860
            self.assertEqual(service.state(), (1, "SUCCESS"))

    def test_replica_wake_fans_out_only_over_private_network(self):
        urls = []
        addresses = [(2, 1, 6, "", ("10.0.0.1", 8080)),
                     (2, 1, 6, "", ("10.0.0.2", 8080))]
        with patch.dict(os.environ, {
            "WORKER_WAKE_URLS": '{"lekha-render":"http://render.railway.internal:8080/wake"}',
            "WORKER_WAKE_SECRET": "test-only-not-a-secret",
        }), patch.object(worker_launcher.socket, "getaddrinfo", return_value=addresses), \
                patch.object(worker_launcher, "_deliver_wake", side_effect=lambda url, *_: urls.append(url)):
            worker_launcher._wake_http_worker("lekha-render", 0)
        self.assertEqual(len(urls), 3)
        self.assertIn("http://10.0.0.2:8080/wake", urls)

    def test_transcription_still_has_only_one_launch_slot(self):
        self.redis.rpush("rq:queue:scan", "one", "two", "three")
        launched = []
        with patch.object(worker_launcher, "MAX_PARALLEL", 3):
            for _ in range(3):
                worker_launcher.kick(self.redis, "scan", launcher=lambda *args: launched.append(args))
        self.assertEqual(launched, [("lekha-transcription", 0)])

    def test_resize_range_validated_before_cloud_request(self):
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID": "test-env",
                                   "RENDER_AUTOSCALE_SERVICE_ID": "test-service"}):
            service = scaling.RailwayRenderService()
        with patch.object(scaling, "_graphql") as call:
            for count in (0, 4):
                with self.assertRaises(ValueError):
                    service.resize(count)
            call.assert_not_called()
