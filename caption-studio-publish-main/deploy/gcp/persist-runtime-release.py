"""Update non-secret release settings without printing runtime credentials."""
import argparse
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--gcloud", default="gcloud")
parser.add_argument("--project", required=True)
parser.add_argument("--release", required=True)
args = parser.parse_args()
if len(args.release) != 40 or any(c not in "0123456789abcdef" for c in args.release):
    raise SystemExit("A full commit SHA is required")
base = [args.gcloud, "--project", args.project, "secrets", "versions"]
raw = subprocess.check_output(base + ["access", "latest", "--secret=lekha-runtime-env"], text=True)
updates = {
    "APP_RELEASE": args.release,
    "RELEASE_VERSION": f"gcp-staging-{args.release[:7]}",
    "APP_BUILD_TIME": "2026-09-09T14:40:32Z",
    "RELEASE_ENVIRONMENT": "staging",
    "TRANSCRIPTION_QUEUE_NAME": "caption_transcription_jobs_staging",
    "EXPORT_MAX_PENDING_JOBS": "80",
    "EXPORT_MAX_QUEUE_WAIT_SECONDS": "600",
    "QUEUE_METRICS_ENABLED": "1",
    "QUEUE_METRICS_INTERVAL_SECONDS": "30",
    "WORKER_MIG_NAME": "lekha-worker-staging-mig",
}
lines = [line for line in raw.splitlines() if line.partition("=")[0] not in updates]
lines.extend(f"{key}={value}" for key, value in updates.items())
result = subprocess.run(base + ["add", "lekha-runtime-env", "--data-file=-", "--quiet"],
                        input="\n".join(lines) + "\n", text=True, capture_output=True)
if result.returncode:
    raise SystemExit("Runtime secret update failed; credentials withheld")
print("Runtime release settings saved as a new secret version; previous versions retained")
