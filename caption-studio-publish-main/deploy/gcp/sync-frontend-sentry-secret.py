"""Copy a pinned runtime version's public Sentry DSN to the frontend build secret."""

import argparse
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse


def run(args):
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(f"Command failed: {args[0]} {args[1]}; output withheld")
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--runtime-version", required=True, type=int)
    parser.add_argument("--stage", action="store_true",
                        help="Create the build secret/version; dry run by default")
    args = parser.parse_args()
    if args.runtime_version < 1:
        parser.error("runtime-version must be a positive numeric version")
    gcloud = shutil.which("gcloud.cmd") or shutil.which("gcloud")
    if not gcloud:
        parser.error("gcloud was not found")

    raw = run([gcloud, "secrets", "versions", "access", str(args.runtime_version),
               "--secret=lekha-runtime-env", f"--project={args.project}"])
    values = dict(line.split("=", 1) for line in raw.splitlines() if "=" in line)
    dsn = values.get("SENTRY_DSN", "").strip()
    parsed = urlparse(dsn)
    if parsed.scheme != "https" or not parsed.username or not parsed.hostname or not parsed.path.strip("/"):
        raise RuntimeError("Runtime version has no valid HTTPS Sentry DSN")

    secret = "lekha-frontend-sentry-dsn"
    existing = subprocess.run([gcloud, "secrets", "describe", secret,
                               f"--project={args.project}"],
                              text=True, capture_output=True).returncode == 0
    print(f"Runtime version {args.runtime_version}: valid Sentry DSN; build secret {'exists' if existing else 'absent'}")
    if not args.stage:
        print("Dry run only; no build secret created")
        return
    if not existing:
        run([gcloud, "secrets", "create", secret, f"--project={args.project}",
             "--replication-policy=automatic", "--quiet"])
    with tempfile.TemporaryDirectory(prefix="lekha-sentry-stage-") as temp_dir:
        path = Path(temp_dir) / "dsn"
        path.write_text(dsn, encoding="utf-8")
        created = run([gcloud, "secrets", "versions", "add", secret,
                       f"--project={args.project}", f"--data-file={path}",
                       "--format=value(name)", "--quiet"]).strip()
    version = created.rsplit("/", 1)[-1]
    if not version.isdigit():
        raise RuntimeError("Build secret version was created but its number was not returned")
    verified = run([gcloud, "secrets", "versions", "access", version,
                    f"--secret={secret}", f"--project={args.project}"])
    if verified != dsn:
        raise RuntimeError("Build secret verification failed")
    print(f"Staged frontend Sentry build secret version {version}; no frontend deployed")


if __name__ == "__main__":
    main()
