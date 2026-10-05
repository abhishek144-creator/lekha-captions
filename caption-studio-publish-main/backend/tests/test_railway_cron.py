import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

import fakeredis
from rq import Queue, Retry
from rq.registry import ScheduledJobRegistry, StartedJobRegistry
from rq.job import JobStatus

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import railway_cron
from worker_launcher import lease_key


def noop():
    return None


class FakeHost:
    def __init__(self, connection, calls, fail=()):
        self._rq_redis_client = connection
        self._transcription_queue = "transcription-queue"
        self.calls, self.fail = calls, set(fail)
        self.asyncio = SimpleNamespace(run=lambda coroutine: coroutine)

    def _record(self, name):
        self.calls.append(name)
        if name in self.fail:
            raise RuntimeError(f"{name} broke")
        return name

    def get_db(self):
        return "db"

    def TranscriptionJobs(self, db):
        return SimpleNamespace(dispatch=lambda queue: self._record("transcription_dispatch"))

    def _dispatch_media_scans_once(self):
        return self._record("media_scan_dispatch")

    def scheduled_janitor_job(self):
        return self._record("janitor")

    def scheduled_payment_reconciliation_job(self):
        return self._record("payment_reconciliation")

    def _flush_telemetry(self):
        self.calls.append("flush_telemetry")


class RailwayCronTests(unittest.TestCase):
    def setUp(self):
        self.redis = fakeredis.FakeRedis()
        self.calls = []
        self.env = patch.dict(os.environ, {
            "WORKER_LAUNCH_JOBS": '{"caption_export_jobs": "lekha-render"}',
        })
        self.env.start()
        self.addCleanup(self.env.stop)

    def run_pass(self, **kwargs):
        with patch.object(railway_cron, "_log", lambda *args, **fields: None):
            return railway_cron.run_once(host=FakeHost(self.redis, self.calls, **kwargs))

    def test_runs_every_step_and_reports_none_failed(self):
        self.assertEqual(self.run_pass(), [])
        self.assertEqual(self.calls, [
            "transcription_dispatch", "media_scan_dispatch", "janitor",
            "payment_reconciliation", "flush_telemetry",
        ])

    def test_a_failing_step_does_not_skip_the_rest(self):
        self.assertEqual(self.run_pass(fail={"transcription_dispatch"}), ["transcription_dispatch"])
        self.assertIn("payment_reconciliation", self.calls)

    def test_staging_never_cleans_media_or_reconciles_payments(self):
        with patch.dict(os.environ, {"RELEASE_ENVIRONMENT": "staging"}):
            self.run_pass()
        self.assertNotIn("janitor", self.calls)
        self.assertNotIn("payment_reconciliation", self.calls)

    def test_due_retry_is_promoted_and_a_worker_is_woken(self):
        queue = Queue("caption_export_jobs", connection=self.redis)
        job = queue.enqueue_at(datetime.now(timezone.utc) - timedelta(seconds=5), noop)
        self.assertIn(job.id, ScheduledJobRegistry(queue=queue).get_job_ids())
        woken = []
        with patch("worker_launcher._default_launcher", lambda name, slot: woken.append((name, slot))):
            self.run_pass()
        self.assertEqual(queue.job_ids, [job.id])
        self.assertEqual(woken, [("lekha-render", 0)])
        self.assertTrue(self.redis.exists(lease_key("lekha-render", 0)))

    def test_recovery_fails_expired_job_and_preserves_live_job(self):
        queue = Queue("caption_export_jobs", connection=self.redis)
        expired = queue.enqueue(noop)
        live = queue.enqueue(noop)
        self.redis.delete(queue.key)
        for job in (expired, live):
            job.set_status(JobStatus.STARTED)
        registry = StartedJobRegistry(queue=queue)
        self.redis.zadd(registry.key, {expired.id: 1, live.id: 9999999999})
        railway_cron.recover_expired_jobs(self.redis, [queue.name])
        self.assertEqual(expired.get_status(refresh=True), JobStatus.FAILED)
        self.assertEqual(live.get_status(refresh=True), JobStatus.STARTED)
        self.assertIsNone(self.redis.zscore(registry.key, expired.id))
        self.assertIsNotNone(self.redis.zscore(registry.key, live.id))

    def test_recovery_retries_expired_job_with_remaining_attempts(self):
        queue = Queue("caption_export_jobs", connection=self.redis)
        job = queue.enqueue(noop, retry=Retry(max=1))
        self.redis.delete(queue.key)
        job.set_status(JobStatus.STARTED)
        registry = StartedJobRegistry(queue=queue)
        self.redis.zadd(registry.key, {job.id: 1})
        railway_cron.recover_expired_jobs(self.redis, [queue.name])
        self.assertEqual(job.get_status(refresh=True), JobStatus.QUEUED)
        self.assertIn(job.id, queue.job_ids)
        job.refresh()
        self.assertEqual(job.retries_left, 0)

    def test_nothing_queued_wakes_nothing(self):
        with patch("worker_launcher._default_launcher", lambda *args: self.fail("woke an idle worker")):
            self.run_pass()




class RedisMemoryCheckTests(unittest.TestCase):
    def check(self, used, maxmemory):
        alerts = []
        connection = SimpleNamespace(info=lambda section: {"used_memory": used, "maxmemory": maxmemory})
        result = railway_cron.check_redis_memory(connection, alert=alerts.append)
        return result, alerts

    def test_alerts_when_memory_nears_the_server_limit(self):
        result, alerts = self.check(900, 1000)
        self.assertEqual(result["ratio"], 0.9)
        self.assertEqual(len(alerts), 1)

    def test_quiet_below_threshold(self):
        _, alerts = self.check(100, 1000)
        self.assertEqual(alerts, [])

    def test_uses_configured_plan_size_without_server_limit(self):
        with patch.dict(os.environ, {"REDIS_MEMORY_ALERT_BYTES": "1000"}):
            result, alerts = self.check(850, 0)
        self.assertEqual(result["limit_bytes"], 1000)
        self.assertEqual(len(alerts), 1)


if __name__ == "__main__":
    unittest.main()
