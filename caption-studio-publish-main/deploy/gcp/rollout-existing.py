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
parser.add_argument("--runtime-secret-version", type=int)
args = parser.parse_args()
if os.geteuid() != 0 or len(args.release) != 40 or any(c not in "0123456789abcdef" for c in args.release):
    raise SystemExit("Root and an immutable release are required")
if args.action != "rollback" and ("@sha256:" not in args.image or len(args.image.rsplit("@sha256:", 1)[-1]) != 64):
    raise SystemExit("Rollout requires an immutable image digest")
name = f"lekha-{args.role}"
backup = f"{name}-rollback-{args.release[:8]}"
folder = Path("/etc/lekha/rollbacks") / args.release
folder.mkdir(parents=True, exist_ok=True, mode=0o700)
env_file = folder / f"{args.role}.env"
snapshot = folder / f"{args.role}.json"
prepared = folder / f"{args.role}.prepared.json"


def exists(container):
    return subprocess.run(["docker", "inspect", container], stdout=subprocess.DEVNULL,
                          stderr=subprocess.DEVNULL).returncode == 0


def prepared_matches():
    if not prepared.exists():
        return False
    manifest = json.loads(prepared.read_text())
    return (
        manifest.get("image") == args.image
        and manifest.get("release") == args.release
        and manifest.get("secret_version") == args.runtime_secret_version
    )


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
    if not args.runtime_secret_version or args.runtime_secret_version < 1:
        raise SystemExit("prepare requires --runtime-secret-version with a positive numeric version")
    raw = subprocess.check_output(["gcloud", "secrets", "versions", "access", str(args.runtime_secret_version), "--secret=lekha-runtime-env"], text=True)
    env = dict(line.split("=", 1) for line in raw.splitlines() if "=" in line and not line.lstrip().startswith("#"))
    if any("\n" in value or "\r" in value for value in env.values()):
        raise SystemExit("Multiline environment value cannot safely use Docker env-file")
    snapshot.write_text(json.dumps(config))
    snapshot.chmod(0o600)
    env_file.write_text("".join(f"{key}={value}\n" for key, value in env.items()))
    env_file.chmod(0o600)
    docker("pull", args.image)
    image = json.loads(docker("image", "inspect", args.image))[0]
    if (image["Config"].get("Labels") or {}).get("org.opencontainers.image.revision") != args.release:
        raise SystemExit("Image revision label does not match the prepared runtime release; running container unchanged")
    docker("run", "--rm", "--network", "none", "--entrypoint", "python3", "--env-file", str(env_file), args.image,
           "/app/backend/runtime_preflight.py", "--image-release", args.release, "--secret-version", str(args.runtime_secret_version))
    prepared.write_text(json.dumps({"image": args.image, "release": args.release, "secret_version": args.runtime_secret_version}))
    prepared.chmod(0o600)
    print(f"{name}: image pulled; root-only rollback saved", flush=True)
elif args.action == "stop":
    if not snapshot.exists() or not prepared.exists() or exists(backup):
        raise SystemExit("Prepare first; existing rollback must not be overwritten")
    if not prepared_matches():
        raise SystemExit("Prepared image, release, or secret version does not match; running service unchanged")
    docker("stop", "--time", "1860", name)
    docker("rename", name, backup)
    print(f"{name}: stopped gracefully and retained", flush=True)
elif args.action == "start":
    if not prepared_matches():
        raise SystemExit("Image/configuration preflight must pass before start")
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
