"""Copy the public Sentry DSN from runtime config into a dedicated build secret."""
import argparse
import shutil
import subprocess


parser = argparse.ArgumentParser()
parser.add_argument("--project", required=True)
parser.add_argument("--source-version", required=True, type=int)
args = parser.parse_args()
if args.source_version < 1:
    raise SystemExit("--source-version must be a positive numeric Secret Manager version")
gcloud = shutil.which("gcloud") or shutil.which("gcloud.cmd")
if not gcloud:
    raise SystemExit("gcloud was not found")

runtime = subprocess.check_output([
    gcloud, "secrets", "versions", "access", str(args.source_version),
    "--secret=lekha-runtime-env", f"--project={args.project}",
], text=True)
values = dict(line.split("=", 1) for line in runtime.splitlines() if "=" in line)
dsn = values.get("SENTRY_DSN", "").strip()
if not dsn:
    raise SystemExit("SENTRY_DSN is not configured in lekha-runtime-env")

exists = subprocess.run([
    gcloud, "secrets", "describe", "lekha-frontend-sentry-dsn",
    f"--project={args.project}",
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
if not exists:
    subprocess.check_call([
        gcloud, "secrets", "create", "lekha-frontend-sentry-dsn",
        f"--project={args.project}", "--replication-policy=automatic", "--quiet",
    ])
subprocess.run([
    gcloud, "secrets", "versions", "add", "lekha-frontend-sentry-dsn",
    f"--project={args.project}", "--data-file=-", "--quiet",
], input=dsn, text=True, check=True, stdout=subprocess.DEVNULL)
print("Frontend Sentry build secret synchronized; value withheld")
