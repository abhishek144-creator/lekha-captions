"""Update non-secret release settings without printing runtime credentials."""
import argparse
import os
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
parser.add_argument("--gcloud", default="gcloud")
parser.add_argument("--project", required=True)
parser.add_argument("--release", required=True)
parser.add_argument("--region", default="asia-south1")
parser.add_argument("--redis-instance", default="lekha-redis-ha")
args = parser.parse_args()
if len(args.release) != 40 or any(c not in "0123456789abcdef" for c in args.release):
    raise SystemExit("A full commit SHA is required")
gcloud = shutil.which(args.gcloud) or shutil.which(f"{args.gcloud}.cmd") or args.gcloud
base = [gcloud, "--project", args.project, "secrets", "versions"]
raw = subprocess.check_output(base + ["access", "latest", "--secret=lekha-runtime-env"], text=True)
redis_host = subprocess.check_output([
    gcloud, "redis", "instances", "describe", args.redis_instance,
    f"--region={args.region}", f"--project={args.project}", "--format=value(host)",
], text=True).strip()
if not redis_host:
    raise SystemExit("The Standard HA Redis endpoint is unavailable")
updates = {
    "APP_RELEASE": args.release,
    "RELEASE_VERSION": f"gcp-staging-{args.release[:7]}",
    "APP_BUILD_TIME": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "RELEASE_ENVIRONMENT": "production",
    "APP_ENV": "production",
    "REDIS_URL": f"redis://{redis_host}:6379/0",
    "GCS_MEDIA_BUCKET": "lekha-media-project-0cc7c839-b9c7-4734-ad0",
    "TRANSCRIPTION_QUEUE_NAME": "caption_transcription_jobs_staging",
    "EXPORT_MAX_PENDING_JOBS": "80",
    "EXPORT_MAX_QUEUE_WAIT_SECONDS": "600",
    "QUEUE_METRICS_ENABLED": "1",
    "QUEUE_METRICS_INTERVAL_SECONDS": "30",
    "WORKER_MIG_NAME": "lekha-worker-staging-mig",
}
lines = [line for line in raw.splitlines() if line.partition("=")[0] not in updates]
lines.extend(f"{key}={value}" for key, value in updates.items())
runtime_path = ""
try:
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="\n", delete=False, suffix=".env"
    ) as runtime_file:
        runtime_file.write("\n".join(lines) + "\n")
        runtime_path = runtime_file.name
    result = subprocess.run(
        base + ["add", "lekha-runtime-env", f"--data-file={runtime_path}", "--quiet"],
        text=True,
        capture_output=True,
    )
    if result.returncode:
        raise SystemExit("Runtime secret update failed; credentials withheld")
finally:
    if runtime_path:
        try:
            os.remove(runtime_path)
        except FileNotFoundError:
            pass
print("Runtime release settings saved as a new secret version; previous versions retained")
