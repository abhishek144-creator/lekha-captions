import json
import os
import sys
import threading
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

import fakeredis

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import worker
from worker_launcher import lease_key


class FakeWorker:
    """Stands in for an RQ burst worker: runs whatever is queued right now."""

    def __init__(self, conn, queues, ran):
        self.conn, self.queues, self.ran = conn, queues, ran
        self.launch_lease = None

    def work(self, **kwargs):
        assert kwargs.get("burst") is True
        for name in self.queues:
            while self.conn.lpop(f"rq:queue:{name}"):
                self.ran.append(name)


class DrainTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.ran = []
        self.env = patch.dict(os.environ, {"WORKER_LAUNCH_JOB_NAME": "lekha-render"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def drain(self, queues, **kwargs):
        worker.drain_queues(
            self.redis, queues,
            worker_factory=lambda: FakeWorker(self.redis, queues, self.ran),
            log=lambda _: None, **kwargs,
        )

    def test_drains_everything_and_releases_the_lease(self):
        self.redis.rpush("rq:queue:render", "a", "b")
        self.drain(["render"])
        self.assertEqual(self.ran, ["render", "render"])
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))

    def test_waits_for_a_retry_that_is_due_soon(self):
        sleeps = []
        self.redis.zadd("rq:scheduled:render", {"retry": 0})

        def fake_sleep(seconds):
            sleeps.append(seconds)
            # The scheduler would have moved the due retry onto the queue.
            self.redis.delete("rq:scheduled:render")
            self.redis.rpush("rq:queue:render", "retry")

        self.drain(["render"], sleep=fake_sleep)
        self.assertEqual(len(sleeps), 1)
        self.assertEqual(self.ran, ["render"])

    def test_leaves_far_future_retries_for_a_later_wake(self):
        far = 10_000_000_000
        self.redis.zadd("rq:scheduled:render", {"retry": far})
        self.drain(["render"], sleep=lambda _s: self.fail("should not wait for a distant retry"))
        self.assertEqual(self.ran, [])


    def test_real_rq_worker_drains_on_the_main_thread(self):
        # RQ installs signal handlers in work(); that raises off the main thread.
        worker.drain_queues(self.redis, ["render"], log=lambda _: None)
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))

    def test_sigterm_during_a_drain_frees_the_slot_and_stops_serving(self):
        class StoppedWorker(FakeWorker):
            def work(self, **kwargs):
                super().work(**kwargs)
                self._shutdown_requested_date = object()

        self.redis.rpush("rq:queue:render", "a")
        self.redis.set(lease_key("lekha-render", 0), "1")
        stopped = worker.drain_queues(
            self.redis, ["render"], log=lambda _: None,
            worker_factory=lambda: StoppedWorker(self.redis, ["render"], self.ran),
        )
        self.assertFalse(stopped)
        self.assertFalse(self.redis.exists(lease_key("lekha-render", 0)))

    def test_drain_loop_returns_once_a_drain_reports_shutdown(self):
        state = worker._WakeState()
        state.requested.set()
        with patch.object(worker, "connect_redis", lambda url: self.redis), \
                patch.object(worker, "cleanup_local_media_artifacts", lambda: None):
            worker._drain_loop(state, ["render"], drain=lambda conn, queues: False)
        self.assertFalse(state.running)


class WakeEndpointTests(unittest.TestCase):
    def setUp(self):
        self.secret = "w" * 32
        patcher = patch.object(worker, "WORKER_WAKE_SECRET", self.secret)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.state = worker._WakeState()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), worker._wake_handler(self.state))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def post(self, secret):
        request = urllib.request.Request(
            f"{self.base}/wake", data=b"{}", method="POST",
            headers={"X-Worker-Wake-Secret": secret},
        )
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    def test_wrong_secret_is_rejected_and_does_not_wake(self):
        self.assertEqual(self.post("nope"), 403)
        self.assertFalse(self.state.requested.is_set())

    def test_correct_secret_requests_a_drain(self):
        self.assertEqual(self.post(self.secret), 202)
        self.assertTrue(self.state.requested.is_set())

    def test_health_reports_alive(self):
        with urllib.request.urlopen(f"{self.base}/health", timeout=5) as response:
            self.assertEqual(json.loads(response.read())["status"], "alive")


if __name__ == "__main__":
    unittest.main()
