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


if __name__ == "__main__":
    unittest.main()
