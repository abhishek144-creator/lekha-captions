"""Stage Railway live payment and Sentry settings as a new GCP secret version.

Dry-run by default. This never prints secret values and never changes the live
instance template; a separate reviewed rollout must pin the new version.
"""

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse


MIGRATED_KEYS = (
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "SENTRY_DSN",
)


def run(args, *, input_text=None, redactions=()):
    result = subprocess.run(args, input=input_text, text=True, capture_output=True)
    if result.returncode:
        message = result.stderr.strip()
        for value in sorted((str(value) for value in redactions if value), key=len, reverse=True):
            message = message.replace(value, "[redacted]")
        raise RuntimeError(f"Command failed: {args[0]} {args[1]}; {message[:700]}")
    return result.stdout


def railway_values(railway, service, environment):
    raw = run([railway, "variable", "list", "--service", service,
               "--environment", environment, "--json"])
    payload = json.loads(raw)
    if isinstance(payload, list):
        return {item.get("name", item.get("key", "")): item.get("value", "")
                for item in payload if isinstance(item, dict)}
    if isinstance(payload, dict):
        return {key: value.get("value", "") if isinstance(value, dict) else value
                for key, value in payload.items()}
    raise RuntimeError("Unrecognized Railway variable response")


def validated_source(values):
    selected = {key: str(values.get(key) or "").strip() for key in MIGRATED_KEYS}
    if not selected["RAZORPAY_KEY_ID"].startswith("rzp_live_"):
        raise RuntimeError("Railway source does not have a live Razorpay key ID")
    if not selected["RAZORPAY_KEY_SECRET"] or not selected["RAZORPAY_WEBHOOK_SECRET"]:
        raise RuntimeError("Railway source is missing a payment secret")
    dsn = urlparse(selected["SENTRY_DSN"])
    if dsn.scheme != "https" or not dsn.username or not dsn.hostname or not dsn.path.strip("/"):
        raise RuntimeError("Railway source is missing a valid HTTPS Sentry DSN")
    if any("\n" in value or "\r" in value for value in selected.values()):
        raise RuntimeError("Source values cannot contain line breaks")
    return selected


def updated_runtime(raw, updates, expected_release):
    existing = dict(line.split("=", 1) for line in raw.splitlines()
                    if "=" in line and not line.lstrip().startswith("#"))
    if existing.get("APP_RELEASE", "").strip() != expected_release:
        raise RuntimeError("Base runtime release differs from --expected-release")
    lines = [line for line in raw.splitlines()
             if line.partition("=")[0] not in updates]
    lines.extend(f"{key}={updates[key]}" for key in MIGRATED_KEYS)
    return "\n".join(lines) + "\n", existing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", required=True)
    parser.add_argument("--base-version", required=True, type=int)
    parser.add_argument("--expected-release", required=True)
    parser.add_argument("--source-service", default="web")
    parser.add_argument("--source-environment", default="production")
    parser.add_argument("--secret", default="lekha-runtime-env")
    parser.add_argument("--stage", action="store_true",
                        help="Create a new Secret Manager version; no deployment")
    args = parser.parse_args()
    if args.base_version < 1 or not re.fullmatch(r"[0-9a-f]{40}", args.expected_release):
        parser.error("base version and full release SHA are required")
    railway = shutil.which("railway.cmd") or shutil.which("railway")
    gcloud = shutil.which("gcloud.cmd") or shutil.which("gcloud")
    if not railway or not gcloud:
        parser.error("railway and gcloud CLIs are required")

    source = validated_source(railway_values(railway, args.source_service,
                                              args.source_environment))
    base = [gcloud, "secrets", "versions"]
    current = run(base + ["access", str(args.base_version),
                          f"--secret={args.secret}", f"--project={args.project}"])
    candidate, existing = updated_runtime(current, source, args.expected_release)
    payload = candidate.encode("utf-8")
    if len(payload) > 65536:
        raise RuntimeError("Updated runtime payload exceeds Secret Manager's 64 KiB limit")
    old_mode = "live" if existing.get("RAZORPAY_KEY_ID", "").startswith("rzp_live_") else "test"
    print(f"Base version: {args.base_version}; release: {args.expected_release}")
    print(f"Razorpay mode: {old_mode} -> live; Sentry DSN: {'present' if existing.get('SENTRY_DSN') else 'absent'} -> present")
    print("Keys prepared: " + ", ".join(MIGRATED_KEYS))
    print(f"Runtime payload: {len(payload)} bytes")
    if not args.stage:
        print("Dry run only; no Secret Manager version created")
        return
    with tempfile.TemporaryDirectory(prefix="lekha-runtime-stage-") as temp_dir:
        payload_path = Path(temp_dir) / "runtime.env"
        payload_path.write_bytes(payload)
        created = run(base + ["add", args.secret, f"--data-file={payload_path}",
                              f"--project={args.project}", "--format=value(name)", "--quiet"],
                      redactions=tuple(source.values()) + tuple(existing.values())).strip()
    if not created or not created.rsplit("/", 1)[-1].isdigit():
        raise RuntimeError("Secret version was created, but its number was not returned")
    version = created.rsplit("/", 1)[-1]
    verified = run(base + ["access", version, f"--secret={args.secret}",
                           f"--project={args.project}"])
    if verified != candidate:
        raise RuntimeError("Staged secret verification failed; do not pin this version")
    print(f"Staged secret version {version}; live templates remain pinned to {args.base_version}")


if __name__ == "__main__":
    main()
