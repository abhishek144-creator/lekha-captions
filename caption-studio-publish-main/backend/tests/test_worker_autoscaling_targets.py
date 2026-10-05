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


JOBS = json.dumps({
    "export": "lekha-render",
    "scan": "lekha-transcription",
    "transcribe": "lekha-transcription",
})


class ConfigurableReplicaTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.env = patch.dict(os.environ, {
            "RENDER_AUTOSCALE_ENABLED": "1",
            "TRANSCRIPTION_AUTOSCALE_ENABLED": "1",
            "WORKER_LAUNCH_JOBS": JOBS,
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def run_scaler(self, service, target, **kwargs):
        return scaling.reconcile(self.redis, service=service, now=2000, log=lambda _: None,
                                 target=target, **kwargs)

    def test_render_ceiling_follows_configuration(self):
        self.redis.rpush("rq:queue:export", *range(20))
        service = FakeService()
        with patch.dict(os.environ, {"RENDER_AUTOSCALE_MAX_REPLICAS": "6"}):
            self.assertEqual(self.run_scaler(service, scaling.RENDER), "scaled_up")
        self.assertEqual(service.changes, [6])

    def test_ceiling_is_clamped_and_invalid_values_fall_back(self):
        for raw, expected in (("0", 1), ("99", scaling.REPLICA_CEILING), ("six", 3), ("", 3)):
            with self.subTest(raw=raw), patch.dict(os.environ, {"RENDER_AUTOSCALE_MAX_REPLICAS": raw}):
                self.assertEqual(scaling.RENDER.max_replicas(), expected)

    def test_transcription_scales_independently_with_its_own_keys(self):
        self.redis.rpush("rq:queue:scan", "a", "b")
        self.redis.rpush("rq:queue:transcribe", "c", "d", "e")
        render = FakeService()
        transcription = FakeService()
        with patch.dict(os.environ, {"TRANSCRIPTION_AUTOSCALE_MAX_REPLICAS": "3"}):
            self.assertEqual(self.run_scaler(transcription, scaling.TRANSCRIPTION), "scaled_up")
            self.assertEqual(self.run_scaler(render, scaling.RENDER), "idle")
        self.assertEqual(transcription.changes, [3])
        self.assertEqual(render.changes, [])
        self.assertEqual(self.redis.get(scaling.TRANSCRIPTION.current_replicas), b"3")
        self.assertIsNone(self.redis.get(scaling.RENDER.current_replicas))

    def test_disabled_transcription_scaling_never_touches_railway(self):
        with patch.dict(os.environ, {"TRANSCRIPTION_AUTOSCALE_ENABLED": "0"}):
            self.assertEqual(self.run_scaler(FakeService(), scaling.TRANSCRIPTION), "disabled")
            self.assertIsNone(scaling.target_for_job("lekha-transcription"))

    def test_resize_rejects_counts_above_the_configured_maximum(self):
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID": "env",
                                     "TRANSCRIPTION_AUTOSCALE_SERVICE_ID": "svc",
                                     "TRANSCRIPTION_AUTOSCALE_MAX_REPLICAS": "3"}):
            service = scaling.RailwayScaledService(scaling.TRANSCRIPTION)
            with patch.object(scaling, "_graphql") as call:
                with self.assertRaises(ValueError):
                    service.resize(4)
                service.resize(3)
        call.assert_called_once()

    def test_service_identity_must_match_the_target(self):
        with patch.dict(os.environ, {"RAILWAY_ENVIRONMENT_ID": "env",
                                     "TRANSCRIPTION_AUTOSCALE_SERVICE_ID": "svc"}):
            service = scaling.RailwayScaledService(scaling.TRANSCRIPTION)
        deploy = {"sleepApplication": True, "multiRegionConfig": {service.region: {"numReplicas": 1}}}
        data = {"environment": {"config": {"services": {"svc": {"deploy": deploy}}}},
                "serviceInstance": {"serviceName": "lekha-render", "latestDeployment": {
                    "status": "SUCCESS", "meta": {"serviceManifest": {"deploy": {"drainingSeconds": 1860}}}}}}
        with patch.object(scaling, "_graphql", return_value=data):
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                service.state()
            data["serviceInstance"]["serviceName"] = "lekha-transcription"
            self.assertEqual(service.state(), (1, "SUCCESS"))

    def test_kick_scales_and_wakes_an_autoscaled_transcription_service(self):
        self.redis.rpush("rq:queue:scan", "a", "b", "c")
        reconciled, launched = [], []
        with patch.object(scaling, "reconcile", side_effect=lambda *a, **k: reconciled.append(k["target"])):
            self.assertTrue(worker_launcher.kick(self.redis, "scan", launcher=lambda *args: launched.append(args),
                                                 log=lambda _: None))
        self.assertEqual(reconciled, [scaling.TRANSCRIPTION])
        self.assertEqual(launched, [("lekha-transcription", 0)])

    def test_transcription_replicas_register_drain_leases(self):
        with patch.dict(os.environ, {"WORKER_LAUNCH_JOB_NAME": "lekha-transcription",
                                     "RAILWAY_REPLICA_ID": "replica-a"}):
            lease = worker_launcher.WorkerLease(self.redis, ["scan", "transcribe"])
        lease.refresh()
        self.assertTrue(self.redis.exists(scaling.TRANSCRIPTION.drains + "replica-a"))
        self.assertFalse(self.redis.exists(scaling.RENDER.drains + "replica-a"))
        lease.release()
        self.assertFalse(self.redis.exists(scaling.TRANSCRIPTION.drains + "replica-a"))

    def test_wake_fan_out_covers_every_allowed_replica(self):
        urls = []
        addresses = [(2, 1, 6, "", (f"10.0.0.{index}", 8080)) for index in range(1, 13)]
        with patch.dict(os.environ, {
            "WORKER_WAKE_URLS": '{"lekha-render":"http://render.railway.internal:8080/wake"}',
            "WORKER_WAKE_SECRET": "test-only-not-a-secret",
            "RENDER_AUTOSCALE_MAX_REPLICAS": "6",
        }), patch.object(worker_launcher.socket, "getaddrinfo", return_value=addresses), \
                patch.object(worker_launcher, "_deliver_wake", side_effect=lambda url, *_: urls.append(url)):
            worker_launcher._wake_http_worker("lekha-render", 0)
        self.assertEqual(len(urls), 13)


if __name__ == "__main__":
    unittest.main()
