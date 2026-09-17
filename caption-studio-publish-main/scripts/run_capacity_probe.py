"""Enqueue and measure a controlled 100-job FFmpeg worker-capacity drill."""
import argparse
import json
import os
import statistics
import time
import uuid

import redis
from rq import Queue


parser = argparse.ArgumentParser()
parser.add_argument("--jobs", type=int, default=100)
parser.add_argument("--duration", type=int, default=30)
parser.add_argument("--timeout", type=int, default=1200)
args = parser.parse_args()
if not 1 <= args.jobs <= 100:
    raise SystemExit("jobs must be between 1 and 100")
if os.environ.get("ALLOW_CAPACITY_PROBE") != "1":
    raise SystemExit("Set ALLOW_CAPACITY_PROBE=1 for an approved controlled drill")

connection = redis.Redis.from_url(os.environ["REDIS_URL"], socket_connect_timeout=5)
queue = Queue(os.environ.get("EXPORT_QUEUE_NAME", "caption_export_jobs"), connection=connection)
run_id = f"capacity-{uuid.uuid4().hex[:12]}"
started = time.time()
jobs = [
    queue.enqueue(
        "backend.capacity_probe.run_capacity_probe_task",
        f"{run_id}-{index:03d}",
        args.duration,
        job_id=f"{run_id}-{index:03d}",
        job_timeout=args.duration + 120,
        result_ttl=3600,
        failure_ttl=3600,
    )
    for index in range(args.jobs)
]

deadline = started + args.timeout
while time.time() < deadline:
    statuses = [job.get_status(refresh=True) for job in jobs]
    terminal = sum(status in {"finished", "failed", "stopped", "canceled"} for status in statuses)
    print(json.dumps({
        "run_id": run_id,
        "elapsed_seconds": round(time.time() - started, 1),
        "queued": statuses.count("queued"),
        "started": statuses.count("started"),
        "finished": statuses.count("finished"),
        "failed": statuses.count("failed"),
    }), flush=True)
    if terminal == len(jobs):
        break
    time.sleep(10)

results = [job.return_value(refresh=True) for job in jobs if job.get_status(refresh=True) == "finished"]
elapsed = round(time.time() - started, 3)
durations = sorted(float(result["elapsed_seconds"]) for result in results if result)
summary = {
    "run_id": run_id,
    "requested": len(jobs),
    "completed": len(results),
    "failed": sum(job.get_status(refresh=True) == "failed" for job in jobs),
    "wall_seconds": elapsed,
    "jobs_per_hour": round(len(results) * 3600 / elapsed, 2) if elapsed else 0,
    "task_p50_seconds": round(statistics.median(durations), 3) if durations else 0,
    "task_p95_seconds": durations[max(0, int(len(durations) * 0.95) - 1)] if durations else 0,
    "workers_used": sorted({result["worker"] for result in results if result}),
}
print(json.dumps(summary, indent=2), flush=True)
if len(results) != len(jobs) or summary["failed"]:
    raise SystemExit(1)
