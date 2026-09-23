"""Measure concurrent authenticated upload, transcription, export, and download journeys.

Accounts JSONL contains one disposable account per line with id_token and optional
app_check_token. Keep that file outside Git. Tokens are passed to the smoke test
through environment variables, never command-line arguments or result output.
"""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import time
from urllib.parse import urlparse


def percentile(values, percent):
    if not values:
        return None
    ordered = sorted(values)
    rank = (len(ordered) - 1) * percent / 100
    lower = int(rank)
    upper = min(lower + 1, len(ordered) - 1)
    return round(ordered[lower] + (ordered[upper] - ordered[lower]) * (rank - lower), 3)


def load_accounts(path, jobs):
    accounts = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            account = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON on accounts line {line_number}") from exc
        if not isinstance(account, dict) or not str(account.get("id_token") or "").strip():
            raise ValueError(f"Missing id_token on accounts line {line_number}")
        accounts.append(account)
    if len(accounts) < jobs:
        raise ValueError(f"Need {jobs} disposable account tokens; found {len(accounts)}")
    chosen = accounts[:jobs]
    if len({account["id_token"] for account in chosen}) != jobs:
        raise ValueError("Each journey needs a distinct account token")
    return chosen


def run_journey(index, account, args):
    env = os.environ.copy()
    env["STAGING_ID_TOKEN"] = account["id_token"]
    env["STAGING_APP_CHECK_TOKEN"] = str(account.get("app_check_token") or "")
    command = [
        sys.executable, str(Path(__file__).with_name("staging_smoke.py")),
        "--base-url", args.base_url, "--video", str(args.video),
        "--language", args.language, "--timeout", str(args.timeout),
        "--upload-path", args.upload_path, "--cleanup",
    ]
    started = time.monotonic()
    try:
        result = subprocess.run(command, env=env, capture_output=True, text=True,
                                timeout=2 * args.timeout + 360, check=False)
        metrics = None
        for line in result.stdout.splitlines():
            if line.startswith("SMOKE_METRICS_JSON="):
                metrics = json.loads(line.partition("=")[2])
        return {"index": index, "success": result.returncode == 0,
                "seconds": round(time.monotonic() - started, 3),
                "exit_code": result.returncode, "metrics": metrics}
    except subprocess.TimeoutExpired:
        return {"index": index, "success": False,
                "seconds": round(time.monotonic() - started, 3), "exit_code": "timeout"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--accounts-jsonl", required=True, type=Path)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--jobs", type=int, default=100)
    parser.add_argument("--concurrency", type=int, default=20)
    parser.add_argument("--language", default="english")
    parser.add_argument("--upload-path", choices=("api", "direct"), default="direct")
    parser.add_argument("--timeout", type=int, default=900)
    parser.add_argument("--results-json", type=Path)
    parser.add_argument("--confirm-controlled-load", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.jobs <= 100 or not 1 <= args.concurrency <= args.jobs:
        parser.error("jobs must be 1–100 and concurrency must be 1–jobs")
    if not args.video.is_file() or not args.accounts_jsonl.is_file():
        parser.error("video and accounts JSONL files must exist")
    if not args.confirm_controlled_load or os.environ.get("ALLOW_REAL_EXPORT_BURST") != "1":
        parser.error("Controlled load requires --confirm-controlled-load and ALLOW_REAL_EXPORT_BURST=1")
    parsed_url = urlparse(args.base_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        parser.error("base-url must be an HTTPS API origin")
    try:
        accounts = load_accounts(args.accounts_jsonl, args.jobs)
    except ValueError as exc:
        parser.error(str(exc))

    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        futures = [pool.submit(run_journey, index, account, args)
                   for index, account in enumerate(accounts)]
        results = [future.result() for future in as_completed(futures)]
    elapsed = round(time.monotonic() - started, 3)
    successes = [result["seconds"] for result in results if result["success"]]
    export_times = [result["metrics"]["export_seconds"] for result in results
                    if result["success"] and result.get("metrics")]
    summary = {
        "requested": args.jobs, "concurrency": args.concurrency,
        "completed": len(successes), "failed": args.jobs - len(successes),
        "wall_seconds": elapsed,
        "journey_p50_seconds": percentile(successes, 50),
        "journey_p95_seconds": percentile(successes, 95),
        "journey_p99_seconds": percentile(successes, 99),
        "export_p50_seconds": percentile(export_times, 50),
        "export_p95_seconds": percentile(export_times, 95),
        "export_p99_seconds": percentile(export_times, 99),
        "mean_seconds": round(statistics.mean(successes), 3) if successes else None,
        "results": sorted(results, key=lambda result: result["index"]),
    }
    serialized = json.dumps(summary, indent=2)
    if args.results_json:
        args.results_json.write_text(serialized + "\n", encoding="utf-8")
    print(serialized)
    if summary["failed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
