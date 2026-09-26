"""Persist production queue and autoscaling telemetry settings without exposing secrets."""

import argparse
import subprocess


parser = argparse.ArgumentParser()
parser.add_argument("--gcloud", default="gcloud")
parser.add_argument("--project", required=True)
parser.add_argument("--source-version", required=True, type=int)
args = parser.parse_args()
if args.source_version < 1:
    raise SystemExit("--source-version must be a positive numeric Secret Manager version")

base = [args.gcloud, "--project", args.project, "secrets", "versions"]
raw = subprocess.check_output(
    base + ["access", str(args.source_version), "--secret=lekha-runtime-env"],
    text=True,
)
updates = {
    "EXPORT_MAX_PENDING_JOBS": "80",
    "EXPORT_MAX_QUEUE_WAIT_SECONDS": "600",
    "QUEUE_METRICS_ENABLED": "1",
    "QUEUE_METRICS_INTERVAL_SECONDS": "30",
    "WORKER_MIG_NAME": "lekha-worker-staging-mig",
}
lines = [line for line in raw.splitlines() if line.partition("=")[0] not in updates]
lines.extend(f"{key}={value}" for key, value in updates.items())
result = subprocess.run(
    base + ["add", "lekha-runtime-env", "--data-file=-", "--quiet"],
    input="\n".join(lines) + "\n",
    text=True,
    capture_output=True,
)
if result.returncode:
    raise SystemExit("Capacity settings update failed; credentials withheld")
print("Capacity and queue telemetry settings saved as a new version; previous versions retained")
