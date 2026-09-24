"""Run concurrent authenticated upload -> process -> export journeys in staging.

The credentials JSON must stay outside source control:
{"users": [{"id_token": "...", "app_check_token": "..."}]}

Use disposable staging identities and short, rights-cleared media. Each identity
runs at most one journey so per-user concurrency controls are not bypassed.
"""

import argparse
import concurrent.futures
import json
import mimetypes
import pathlib
import statistics
import threading
import time
import uuid
from urllib.parse import urljoin

import requests
from media_job_client import await_transcription


class PermanentUploadError(RuntimeError):
    pass


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


def _acknowledged_bytes(response, size: int) -> int:
    if response.status_code in (200, 201):
        return size
    if response.status_code != 308:
        raise RuntimeError(f"Cloud Storage upload returned HTTP {response.status_code}")
    reported = response.headers.get("Range", "")
    if not reported:
        return 0
    if not reported.startswith("bytes=0-"):
        raise RuntimeError("Cloud Storage returned an invalid upload range")
    try:
        received = int(reported.split("-", 1)[1]) + 1
    except ValueError as exc:
        raise RuntimeError("Cloud Storage returned an invalid upload range") from exc
    if received < 0 or received > size:
        raise RuntimeError("Cloud Storage acknowledged an impossible upload range")
    return received


def upload_direct(session: requests.Session, base_url: str, headers: dict,
                  video: pathlib.Path, *, chunk_bytes: int = 8 * 1024 * 1024,
                  timeout: int = 180) -> dict:
    size = video.stat().st_size
    content_type = mimetypes.guess_type(video.name)[0] or "application/octet-stream"
    initiated = require_ok(session.post(
        urljoin(base_url, "api/uploads/init"),
        json={"filename": video.name, "content_type": content_type, "size_bytes": size},
        headers=headers, timeout=30,
    ), "direct upload initiation")
    if not initiated.get("direct_upload_available"):
        raise RuntimeError("Direct upload is unavailable; cannot measure the customer path")
    session_url = initiated["upload_url"]
    offset = 0
    failures = 0
    with video.open("rb") as media:
        while offset < size:
            media.seek(offset)
            chunk = media.read(min(chunk_bytes, size - offset))
            if not chunk:
                raise RuntimeError("Source media ended before its declared size")
            try:
                response = session.put(
                    session_url, data=chunk,
                    headers={"Content-Length": str(len(chunk)),
                             "Content-Range": f"bytes {offset}-{offset + len(chunk) - 1}/{size}"},
                    timeout=timeout,
                )
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    raise PermanentUploadError(f"Cloud Storage rejected upload with HTTP {response.status_code}")
                acknowledged = _acknowledged_bytes(response, size)
            except PermanentUploadError:
                raise
            except (requests.RequestException, RuntimeError):
                failures += 1
                if failures > 6:
                    raise RuntimeError("Direct upload did not recover after six retries") from None
                time.sleep(min(2 ** failures, 8))
                try:
                    status = session.put(session_url, data=b"",
                                         headers={"Content-Length": "0",
                                                  "Content-Range": f"bytes */{size}"},
                                         timeout=20)
                    offset = _acknowledged_bytes(status, size)
                except (requests.RequestException, RuntimeError):
                    pass
                continue
            if acknowledged < offset or acknowledged > offset + len(chunk):
                raise RuntimeError("Cloud Storage acknowledged an inconsistent upload offset")
            if acknowledged == offset:
                failures += 1
                if failures > 6:
                    raise RuntimeError("Cloud Storage made no progress after six retries")
                time.sleep(min(2 ** failures, 8))
                continue
            offset = acknowledged
            failures = 0
    # Completion is idempotent in the API: a dropped tunnel response must not
    # turn an already uploaded object into a failed customer journey.
    for attempt in range(4):
        try:
            return require_ok(session.post(
                urljoin(base_url, "api/uploads/complete"),
                json={"file_id": initiated["file_id"]}, headers=headers, timeout=30,
            ), "direct upload completion")
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)


def run_journey(index: int, credential: dict, args: argparse.Namespace) -> dict:
    origins = [origin.strip().rstrip("/") + "/" for origin in args.base_url.split(",") if origin.strip()]
    base_url = origins[(index - 1) % len(origins)]
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
        if credential.get("bootstrap", True):
            require_ok(
                session.post(
                    urljoin(base_url, "api/account-bootstrap"),
                    json={"id_token": id_token},
                    headers=headers,
                    timeout=30,
                ),
                "account bootstrap",
            )
        stage_started = time.monotonic()
        if args.upload_mode == "direct":
            upload = upload_direct(session, base_url, headers, args.video,
                                   timeout=args.upload_timeout)
        else:
            with args.video.open("rb") as media:
                content_type = mimetypes.guess_type(args.video.name)[0] or "application/octet-stream"
                upload = require_ok(
                    session.post(
                        urljoin(base_url, "api/upload"),
                        files={"file": (args.video.name, media, content_type)},
                        headers=headers,
                        timeout=args.upload_timeout,
                    ),
                    "upload",
                )
        stages["upload"] = time.monotonic() - stage_started
        file_id = upload["file_id"]

        stage_started = time.monotonic()
        for process_attempt in range(4):
            process_response = session.post(
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
            )
            if process_response.status_code != 503 or process_attempt == 3:
                processed = require_ok(process_response, "process")
                break
            time.sleep(min(max(int(process_response.headers.get("Retry-After", "2")), 1), 10))
        processed = await_transcription(session, base_url, {
            "file_id": file_id, "language": args.language, "min_words": 2, "max_words": 5,
            "id_token": id_token,
        }, headers, processed, deadline=stage_started + args.process_timeout, interval=args.poll_interval)
        stages["process"] = time.monotonic() - stage_started
        captions = processed.get("captions") or []
        if not captions:
            raise RuntimeError("process succeeded without captions")
        if args.export_barrier is not None:
            try:
                args.export_barrier.wait()
            except threading.BrokenBarrierError as exc:
                raise RuntimeError("Synchronized export burst could not start") from exc

        stage_started = time.monotonic()
        export_request = {
            "file_id": file_id,
            "captions": captions,
            "style": {},
            "word_layouts": {},
            "id_token": id_token,
            "idempotency_key": f"media-load-{uuid.uuid4()}",
            "quality": args.quality,
            "fps": args.fps,
        }
        deadline = time.monotonic() + args.export_wait_timeout
        admission_retries = 0
        while True:
            submitted = session.post(
                urljoin(base_url, "api/export"), json=export_request,
                headers=headers, timeout=args.export_submit_timeout,
            )
            if submitted.status_code not in {429, 503}:
                export = require_ok(submitted, "export")
                break
            retry_after = min(max(int(submitted.headers.get("Retry-After", "5")), 1), 300)
            if time.monotonic() + retry_after >= deadline:
                raise RuntimeError(f"export admission remained full after {admission_retries} retries")
            admission_retries += 1
            time.sleep(retry_after)
        job_id = str(export.get("export_job_id") or "")
        while export.get("queued") or export.get("status") in {"queued", "started", "processing"}:
            if not job_id or time.monotonic() >= deadline:
                raise RuntimeError(f"export did not complete within {args.export_wait_timeout}s (job={job_id})")
            time.sleep(args.poll_interval)
            status = require_ok(
                session.get(urljoin(base_url, f"api/export-status/{job_id}"), headers=headers, timeout=20),
                "export status",
            )
            if status.get("status") in {"failed", "cancelled"}:
                raise RuntimeError(f"export worker failed: {status.get('error')}")
            if status.get("status") == "completed":
                if status.get("queue_wait_ms") is not None:
                    stages["queue_wait"] = float(status["queue_wait_ms"]) / 1000
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
            "admission_retries": admission_retries,
            "bytes": len(download.content),
            "stages_seconds": stages,
            "total_seconds": time.monotonic() - started,
        }
    except Exception as exc:
        if args.export_barrier is not None:
            args.export_barrier.abort()
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
    parser.add_argument("--base-url", required=True,
                        help="One or more comma-separated isolated staging API origins")
    parser.add_argument("--credentials-json", required=True, type=pathlib.Path)
    parser.add_argument("--results-json", type=pathlib.Path,
                        help="Write per-journey IDs and timing for audit and cleanup")
    parser.add_argument("--video", required=True, type=pathlib.Path)
    parser.add_argument("--upload-mode", default="direct", choices=["direct", "proxy"])
    parser.add_argument("--jobs", type=int, default=0, help="Defaults to the number of disposable users")
    parser.add_argument("--workers", type=int, default=0,
                        help="Concurrent journeys; defaults to one per test identity")
    parser.add_argument("--synchronize-exports", action="store_true",
                        help="Submit all exports together after transcription")
    parser.add_argument("--barrier-timeout", type=int, default=1800)
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

    if not [origin for origin in args.base_url.split(",") if origin.strip()]:
        raise SystemExit("At least one isolated staging API origin is required")

    if not args.video.is_file():
        raise SystemExit(f"Video does not exist: {args.video}")
    if not args.credentials_json.is_file():
        raise SystemExit(f"Credentials file does not exist: {args.credentials_json}")
    data = json.loads(args.credentials_json.read_text(encoding="utf-8"))
    users = data.get("users") if isinstance(data, dict) else data
    if not isinstance(users, list) or not users:
        raise SystemExit("Credentials JSON must contain a non-empty users array")
    jobs = args.jobs or len(users)
    if not 1 <= jobs <= 100:
        raise SystemExit("Use between 1 and 100 disposable staging identities")
    if jobs > len(users):
        raise SystemExit("Use at least one disposable staging identity per job")
    worker_count = args.workers or jobs
    if args.synchronize_exports and worker_count < jobs:
        raise SystemExit("Synchronized exports require at least one worker per journey")
    args.export_barrier = threading.Barrier(jobs, timeout=args.barrier_timeout) if args.synchronize_exports else None
    selected = users[:jobs]

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(worker_count, jobs)) as executor:
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
            for stage in ("upload", "process", "queue_wait", "export", "download")
            if successes and all(stage in result["stages_seconds"] for result in successes)
        },
        "failures": [
            {"index": result["index"], "error": result.get("error", "unknown")}
            for result in results if not result["ok"]
        ],
        "admission_retries": sum(result.get("admission_retries", 0) for result in results),
    }
    if args.results_json:
        args.results_json.parent.mkdir(parents=True, exist_ok=True)
        args.results_json.write_text(
            json.dumps({"summary": summary, "journeys": results}, indent=2),
            encoding="utf-8",
        )
    print(json.dumps(summary, indent=2))
    if success_rate < args.minimum_success_rate:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
