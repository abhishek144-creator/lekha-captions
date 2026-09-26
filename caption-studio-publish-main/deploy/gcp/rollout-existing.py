"""Run as root on an existing Lekha VM; retain the previous container for rollback."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import time


def docker(*args):
    return subprocess.check_output(["docker", *args], text=True).strip()


parser = argparse.ArgumentParser()
parser.add_argument("action", choices=["prepare", "stop", "start", "rollback"])
parser.add_argument("role", choices=["api", "render", "transcription", "worker"])
parser.add_argument("--image", required=True)
parser.add_argument("--release", required=True)
args = parser.parse_args()
if os.geteuid() != 0 or len(args.release) != 40 or any(c not in "0123456789abcdef" for c in args.release):
    raise SystemExit("Root and an immutable release are required")
name = f"lekha-{args.role}"
backup = f"{name}-rollback-{args.release[:8]}"
folder = Path("/etc/lekha/rollbacks") / args.release
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
env_file = folder / f"{args.role}.env"
snapshot = folder / f"{args.role}.json"


def exists(container):
    return subprocess.run(["docker", "inspect", container], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0


def wait_ready(container):
    probe = "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/readiness',timeout=8)"
    for _ in range(30):
        result = subprocess.run(["docker", "exec", container, "python3", "-c", probe],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode == 0:
            print(f"{container}: ready", flush=True)
            return
        time.sleep(2)
    raise RuntimeError(f"{container} failed readiness; previous container retained")


if args.action == "prepare":
    if snapshot.exists():
        raise SystemExit("Release already prepared; inspect its rollback snapshot before repeating")
    config = json.loads(docker("inspect", name))[0]
    snapshot.write_text(json.dumps(config))
    snapshot.chmod(0o600)
    env = dict(item.split("=", 1) for item in config["Config"]["Env"])
    env.update(APP_RELEASE=args.release, RELEASE_VERSION=f"gcp-staging-{args.release[:7]}",
               APP_BUILD_TIME="2026-09-09T14:40:32Z", RELEASE_ENVIRONMENT="staging",
               EXPORT_QUEUE_NAME="caption_export_jobs", FAST_EXPORT_QUEUE_NAME="caption_export_fast",
               HEAVY_EXPORT_QUEUE_NAME="caption_export_heavy", GPU_EXPORT_QUEUE_NAME="caption_export_gpu",
               TRANSCRIPTION_QUEUE_NAME="caption_transcription_jobs",
               MEDIA_SCAN_QUEUE_NAME="caption_media_scan_jobs",
               EXPORT_MAX_PENDING_JOBS="80",
               EXPORT_MAX_QUEUE_WAIT_SECONDS="600", QUEUE_METRICS_ENABLED="1",
               QUEUE_METRICS_INTERVAL_SECONDS="30", WORKER_MIG_NAME="lekha-worker-staging-mig",
               SPOT_WORKER_MIG_NAME="lekha-worker-spot-staging-mig",
               GPU_WORKER_MIG_NAME="lekha-worker-gpu-staging-mig",
               TRANSCRIPTION_PROVIDER_FAILOVER="1")
    if any("\n" in value or "\r" in value for value in env.values()):
        raise SystemExit("Multiline environment value cannot safely use Docker env-file")
    env_file.write_text("".join(f"{key}={value}\n" for key, value in env.items()))
    env_file.chmod(0o600)
    docker("pull", args.image)
    print(f"{name}: image pulled; root-only rollback saved", flush=True)
elif args.action == "stop":
    if not snapshot.exists() or exists(backup):
        raise SystemExit("Prepare first; existing rollback must not be overwritten")
    docker("stop", "--time", "1860", name)
    docker("rename", name, backup)
    print(f"{name}: stopped gracefully and retained", flush=True)
elif args.action == "start":
    if exists(name):
        raise SystemExit("Replacement name already exists; refusing to overwrite it")
    options = ["run", "-d", "--name", name, "--restart", "unless-stopped", "--stop-timeout", "1860",
               "--network", "lekha-internal", "--env-file", str(env_file),
               "-e", f"SERVICE_ROLE={args.role}", "-e", "PORT=8000",
               "-e", "MEDIA_SCRATCH_DIR=/scratch", "-e", "CLAMAV_HOST=lekha-clamav",
               "-v", "/var/lib/lekha/scratch:/scratch", "-p", "8000:8000"]
    if args.role in {"worker", "render"}:
        options += ["--cpus", "3", "--memory", "8g", "-e",
                    "WORKER_QUEUES=caption_export_fast,caption_export_jobs,caption_export_heavy"]
    elif args.role == "transcription":
        options += ["--cpus", "1", "--memory", "2g", "-e",
                    "WORKER_QUEUES=caption_media_scan_jobs,caption_transcription_jobs"]
    docker(*options, args.image)
    wait_ready(name)
elif args.action == "rollback":
    if not exists(backup):
        raise SystemExit("No previous container available for rollback")
    for container in [name]:
        if exists(container):
            docker("stop", "--time", "1860", container)
            docker("rm", container)
    docker("rename", backup, name)
    docker("start", name)
    print(f"{name}: previous container restored", flush=True)
