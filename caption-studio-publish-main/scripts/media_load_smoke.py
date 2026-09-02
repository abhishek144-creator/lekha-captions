"""Run concurrent authenticated upload -> process -> export journeys in staging.

The credentials JSON must stay outside source control:
{"users": [{"id_token": "...", "app_check_token": "..."}]}

Use disposable staging identities and short, rights-cleared media. Each identity
runs at most one journey so per-user concurrency controls are not bypassed.
"""

import argparse
import concurrent.futures
import json
import pathlib
import statistics
import time
import uuid
from urllib.parse import urljoin

import requests


def require_ok(response: requests.Response, action: str) -> dict:
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"{action} returned non-JSON HTTP {response.status_code}") from exc
    if not response.ok or payload.get("success") is False:
        detail = payload.get("detail") or payload.get("error") or payload
        raise RuntimeError(f"{action} failed (HTTP {response.status_code}): {detail}")
    return payload


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int(len(ordered) * fraction) - 1))
    return ordered[index]


def run_journey(index: int, credential: dict, args: argparse.Namespace) -> dict:
    base_url = args.base_url.rstrip("/") + "/"
    id_token = str(credential.get("id_token") or "").strip()
    app_check_token = str(credential.get("app_check_token") or "").strip()
    if not id_token:
        raise RuntimeError(f"credential {index} has no id_token")

    headers = {"Authorization": f"Bearer {id_token}"}
    if app_check_token:
        headers["X-Firebase-AppCheck"] = app_check_token
    session = requests.Session()
    file_id = ""
    job_id = ""
    stages: dict[str, float] = {}
    started = time.monotonic()

    try:
        stage_started = time.monotonic()
        with args.video.open("rb") as media:
            upload = require_ok(
                session.post(
                    urljoin(base_url, "api/upload"),
                    files={"file": (args.video.name, media, "video/mp4")},
                    headers=headers,
                    timeout=args.upload_timeout,
                ),
                "upload",
            )
        stages["upload"] = time.monotonic() - stage_started
        file_id = upload["file_id"]

        stage_started = time.monotonic()
        processed = require_ok(
            session.post(
                urljoin(base_url, "api/process"),
                json={
                    "file_id": file_id,
                    "language": args.language,
                    "min_words": 2,
                    "max_words": 5,
                    "id_token": id_token,
                },
                headers=headers,
                timeout=args.process_timeout,
            ),
            "process",
        )
        stages["process"] = time.monotonic() - stage_started
        captions = processed.get("captions") or []
        if not captions:
            raise RuntimeError("process succeeded without captions")

        stage_started = time.monotonic()
        export = require_ok(
            session.post(
                urljoin(base_url, "api/export"),
                json={
                    "file_id": file_id,
                    "captions": captions,
                    "style": {},
                    "word_layouts": {},
                    "id_token": id_token,
                    "idempotency_key": f"media-load-{uuid.uuid4()}",
                    "quality": args.quality,
                    "fps": args.fps,
                },
                headers=headers,
                timeout=args.export_submit_timeout,
            ),
            "export",
        )
        job_id = str(export.get("export_job_id") or "")
        deadline = time.monotonic() + args.export_wait_timeout
        while export.get("queued") or export.get("status") in {"queued", "started", "processing"}:
            if not job_id or time.monotonic() >= deadline:
                raise RuntimeError(f"export did not complete within {args.export_wait_timeout}s (job={job_id})")
            time.sleep(args.poll_interval)
            status = require_ok(
                session.get(urljoin(base_url, f"api/export-status/{job_id}"), headers=headers, timeout=20),
                "export status",
            )
            if status.get("status") == "failed":
                raise RuntimeError(f"export worker failed: {status.get('error')}")
            if status.get("status") == "completed":
                export = require_ok(
                    session.get(urljoin(base_url, f"api/export-result/{job_id}"), headers=headers, timeout=20),
                    "export result",
                )
                break
        stages["export"] = time.monotonic() - stage_started

        stage_started = time.monotonic()
        video_url = export.get("video_url")
        if not video_url:
            raise RuntimeError("completed export has no video_url")
        download = session.get(urljoin(base_url, video_url), headers=headers, timeout=args.download_timeout)
        download.raise_for_status()
        if len(download.content) < 1024 or b"ftyp" not in download.content[:64]:
            raise RuntimeError("downloaded export is empty or is not an MP4")
        stages["download"] = time.monotonic() - stage_started
        return {
            "index": index,
            "ok": True,
            "file_id": file_id,
            "job_id": job_id,
            "bytes": len(download.content),
            "stages_seconds": stages,
            "total_seconds": time.monotonic() - started,
        }
    except Exception as exc:
        return {
            "index": index,
            "ok": False,
            "file_id": file_id,
            "job_id": job_id,
            "error": str(exc),
            "stages_seconds": stages,
            "total_seconds": time.monotonic() - started,
        }
    finally:
        if args.cleanup and file_id:
            try:
                session.post(
                    urljoin(base_url, "api/delete-file"),
                    json={"file_id": file_id, "id_token": id_token},
                    headers=headers,
                    timeout=30,
                )
            except requests.RequestException:
                pass


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Isolated staging API origin")
    parser.add_argument("--credentials-json", required=True, type=pathlib.Path)
    parser.add_argument("--video", required=True, type=pathlib.Path)
    parser.add_argument("--jobs", type=int, default=0, help="Defaults to the number of disposable users")
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--language", default="english")
    parser.add_argument("--quality", default="720p", choices=["720p", "1080p"])
    parser.add_argument("--fps", type=int, default=30, choices=[24, 30, 60])
    parser.add_argument("--minimum-success-rate", type=float, default=1.0)
    parser.add_argument("--upload-timeout", type=int, default=180)
    parser.add_argument("--process-timeout", type=int, default=300)
    parser.add_argument("--export-submit-timeout", type=int, default=120)
    parser.add_argument("--export-wait-timeout", type=int, default=900)
    parser.add_argument("--download-timeout", type=int, default=180)
    parser.add_argument("--poll-interval", type=float, default=3.0)
    parser.add_argument("--cleanup", action=argparse.BooleanOptionalAction, default=True)
    args = parser.parse_args()

    if not args.video.is_file():
        raise SystemExit(f"Video does not exist: {args.video}")
    if not args.credentials_json.is_file():
        raise SystemExit(f"Credentials file does not exist: {args.credentials_json}")
    data = json.loads(args.credentials_json.read_text(encoding="utf-8"))
    users = data.get("users") if isinstance(data, dict) else data
    if not isinstance(users, list) or not users:
        raise SystemExit("Credentials JSON must contain a non-empty users array")
    jobs = args.jobs or len(users)
    if jobs > len(users):
        raise SystemExit("Use at least one disposable staging identity per job")
    selected = users[:jobs]

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(args.workers, jobs)) as executor:
        results = list(executor.map(lambda pair: run_journey(pair[0], pair[1], args), enumerate(selected, start=1)))

    successes = [result for result in results if result["ok"]]
    success_rate = len(successes) / len(results)
    summary = {
        "jobs": len(results),
        "successes": len(successes),
        "success_rate": success_rate,
        "total_seconds": {
            "p50": statistics.median([result["total_seconds"] for result in results]),
            "p95": percentile([result["total_seconds"] for result in results], 0.95),
            "max": max(result["total_seconds"] for result in results),
        },
        "stages_seconds": {
            stage: {
                "p50": statistics.median([result["stages_seconds"][stage] for result in successes]),
                "p95": percentile([result["stages_seconds"][stage] for result in successes], 0.95),
            }
            for stage in ("upload", "process", "export", "download")
            if successes and all(stage in result["stages_seconds"] for result in successes)
        },
        "failures": [
            {"index": result["index"], "error": result.get("error", "unknown")}
            for result in results if not result["ok"]
        ],
    }
    print(json.dumps(summary, indent=2))
    if success_rate < args.minimum_success_rate:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
