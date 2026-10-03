import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker_launcher
from worker_launcher import WorkerLease, kick, lease_key

JOBS = json.dumps({"scan": "lekha-transcription", "transcribe": "lekha-transcription", "render": "lekha-render"})


class WorkerLauncherTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.launched = []
        self.env = patch.dict(os.environ, {"WORKER_LAUNCH_JOBS": JOBS}, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)

    def launch(self, job, slot):
        self.launched.append((job, slot))

    def enqueue(self, queue):
        self.redis.rpush(f"rq:queue:{queue}", "job")

    def test_disabled_without_job_map(self):
        self.enqueue("render")
        with patch.dict(os.environ, {"WORKER_LAUNCH_JOBS": ""}):
            self.assertFalse(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))
        self.assertEqual(self.launched, [])

    def test_launches_one_worker_per_backlog_and_not_for_empty_queue(self):
        self.assertFalse(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))
        self.enqueue("render")
        self.assertTrue(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))
        self.assertFalse(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))
        self.assertEqual(self.launched, [("lekha-render", 0)])

    def test_queues_sharing_a_job_share_its_lease(self):
        self.enqueue("scan")
        kick(self.redis, "scan", launcher=self.launch, log=lambda _: None)
        kick(self.redis, "transcribe", launcher=self.launch, log=lambda _: None)
        self.assertEqual(self.launched, [("lekha-transcription", 0)])

    def test_failed_launch_frees_the_lease_for_a_retry(self):
        self.enqueue("render")
        def broken(_job, _slot):
            raise RuntimeError("api down")
        self.assertFalse(kick(self.redis, "render", launcher=broken, log=lambda _: None))
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))
        self.assertTrue(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))

    def test_extra_workers_only_when_backlog_outgrows_running_ones(self):
        with patch.object(worker_launcher, "MAX_PARALLEL", 2):
            self.enqueue("render")
            kick(self.redis, "render", launcher=self.launch, log=lambda _: None)
            self.enqueue("render")
            kick(self.redis, "render", launcher=self.launch, log=lambda _: None)
            self.enqueue("render")
            kick(self.redis, "render", launcher=self.launch, log=lambda _: None)
        self.assertEqual(self.launched, [("lekha-render", 0), ("lekha-render", 1)])

    def test_exiting_worker_keeps_going_when_a_job_arrived_during_its_lease(self):
        self.enqueue("render")
        kick(self.redis, "render", launcher=self.launch, log=lambda _: None)
        with patch.dict(os.environ, {"CLOUD_RUN_JOB": "lekha-render", "WORKER_LAUNCH_SLOT": "0"}):
            lease = WorkerLease(self.redis, ["render"])
        # The API enqueued while the lease was held, so it launched nothing new.
        self.assertFalse(kick(self.redis, "render", launcher=self.launch, log=lambda _: None))
        self.assertTrue(lease.release_and_should_continue())
        self.redis.delete("rq:queue:render")
        self.assertFalse(lease.release_and_should_continue())
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))
        self.assertEqual(len(self.launched), 1)


class WakeLauncherTests(unittest.TestCase):
    URLS = json.dumps({"lekha-render": "http://render.railway.internal:8080/wake"})

    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.env = patch.dict(os.environ, {
            "WORKER_LAUNCH_JOBS": json.dumps({"render": "lekha-render"}),
            "WORKER_WAKE_URLS": self.URLS,
            "WORKER_WAKE_SECRET": "s" * 32,
        }, clear=False)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_wake_posts_secret_to_the_worker_url(self):
        sent = []

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return b""

        def fake_urlopen(request, timeout):
            sent.append((request.full_url, request.get_header("X-worker-wake-secret"), timeout))
            return Response()

        with patch.object(worker_launcher.urllib.request, "urlopen", fake_urlopen):
            worker_launcher._wake_http_worker("lekha-render", 0)
        self.assertEqual(sent, [("http://render.railway.internal:8080/wake", "s" * 32, worker_launcher.WAKE_TIMEOUT_SECONDS)])

    def test_slow_wake_counts_as_delivered_and_keeps_the_lease(self):
        def slow(_request, timeout):
            raise worker_launcher.urllib.error.URLError(TimeoutError("timed out"))

        self.redis.rpush("rq:queue:render", "job")
        with patch.object(worker_launcher.urllib.request, "urlopen", slow):
            self.assertTrue(kick(self.redis, "render", log=lambda _: None))
        self.assertTrue(self.redis.exists(lease_key("lekha-render", 0)))

    def test_gateway_error_while_waking_counts_as_delivered(self):
        def booting(request, timeout):
            raise worker_launcher.urllib.error.HTTPError(request.full_url, 502, "Bad Gateway", {}, None)

        self.redis.rpush("rq:queue:render", "job")
        with patch.object(worker_launcher.urllib.request, "urlopen", booting):
            self.assertTrue(kick(self.redis, "render", log=lambda _: None))
        self.assertTrue(self.redis.exists(lease_key("lekha-render", 0)))

    def test_rejected_wake_secret_frees_the_lease(self):
        def forbidden(request, timeout):
            raise worker_launcher.urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)

        self.redis.rpush("rq:queue:render", "job")
        with patch.object(worker_launcher.urllib.request, "urlopen", forbidden):
            self.assertFalse(kick(self.redis, "render", log=lambda _: None))
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))

    def test_refused_wake_frees_the_lease_for_a_retry(self):
        def refused(_request, timeout):
            raise worker_launcher.urllib.error.URLError(ConnectionRefusedError("refused"))

        self.redis.rpush("rq:queue:render", "job")
        with patch.object(worker_launcher.urllib.request, "urlopen", refused):
            self.assertFalse(kick(self.redis, "render", log=lambda _: None))
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))

    def test_default_launcher_prefers_the_wake_url_over_cloud_run(self):
        calls = []
        with patch.object(worker_launcher, "_wake_http_worker", lambda job, slot: calls.append(("wake", job))), \
                patch.object(worker_launcher, "_run_cloud_run_job", lambda job, slot: calls.append(("run", job))):
            worker_launcher._default_launcher("lekha-render", 0)
            worker_launcher._default_launcher("lekha-transcription", 0)
        self.assertEqual(calls, [("wake", "lekha-render"), ("run", "lekha-transcription")])

    def test_missing_secret_is_a_failed_launch(self):
        with patch.dict(os.environ, {"WORKER_WAKE_SECRET": ""}):
            with self.assertRaises(RuntimeError):
                worker_launcher._wake_http_worker("lekha-render", 0)


if __name__ == "__main__":
    unittest.main()
