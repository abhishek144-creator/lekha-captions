"""Run a real authenticated upload -> transcription -> export smoke in staging."""

import argparse
import atexit
import json
import os
import pathlib
import re
import sys
import time
import uuid
from urllib.parse import urljoin

import requests
from media_job_client import await_transcription


def require_ok(response: requests.Response, action: str) -> dict:
    try:
        payload = response.json()
    except ValueError as exc:
        raise RuntimeError(f"{action} returned non-JSON HTTP {response.status_code}") from exc
    if not response.ok or payload.get("success") is False:
        detail = payload.get("detail") or payload.get("error") or payload
        raise RuntimeError(f"{action} failed (HTTP {response.status_code}): {detail}")
    return payload


def upload_direct(session, base_url, video, headers):
    total = video.stat().st_size
    initialized = require_ok(session.post(
        urljoin(base_url, "api/uploads/init"),
        json={"filename": video.name, "content_type": "video/mp4", "size_bytes": total},
        headers=headers, timeout=30,
    ), "direct upload initialization")
    if not initialized.get("direct_upload_available") or not initialized.get("upload_url"):
        raise RuntimeError("Direct upload is unavailable")
    upload_url = initialized["upload_url"]
    offset = 0
    retries = 0
    with video.open("rb") as media:
        while offset < total:
            media.seek(offset)
            chunk = media.read(min(8 * 1024 * 1024, total - offset))
            try:
                response = session.put(upload_url, data=chunk, headers={
                    "Content-Type": "video/mp4",
                    "Content-Range": f"bytes {offset}-{offset + len(chunk) - 1}/{total}",
                }, timeout=120)
                if response.status_code in (200, 201):
                    offset = total
                elif response.status_code == 308:
                    match = re.fullmatch(r"bytes=0-(\d+)", response.headers.get("Range", ""))
                    acknowledged = int(match.group(1)) + 1 if match else 0
                    if acknowledged <= offset or acknowledged > total:
                        raise RuntimeError("Storage did not acknowledge upload progress")
                    offset = acknowledged
                else:
                    response.raise_for_status()
                    raise RuntimeError(f"Unexpected direct upload HTTP {response.status_code}")
                retries = 0
            except requests.RequestException:
                if retries >= 3:
                    raise
                retries += 1
                time.sleep(min(2 ** retries, 8))
                probe = session.put(upload_url, headers={
                    "Content-Range": f"bytes */{total}",
                }, timeout=30)
                if probe.status_code in (200, 201):
                    offset = total
                elif probe.status_code == 308:
                    match = re.fullmatch(r"bytes=0-(\d+)", probe.headers.get("Range", ""))
                    offset = int(match.group(1)) + 1 if match else 0
                else:
                    probe.raise_for_status()
                    raise RuntimeError(f"Unexpected upload probe HTTP {probe.status_code}")
    return require_ok(session.post(
        urljoin(base_url, "api/uploads/complete"),
        json={"file_id": initialized["file_id"]}, headers=headers, timeout=30,
    ), "direct upload completion")


def cleanup_file(session, base_url, file_id, id_token, headers):
    try:
        response = session.post(
            urljoin(base_url, "api/delete-file"),
            json={"file_id": file_id, "id_token": id_token},
            headers=headers, timeout=30,
        )
        require_ok(response, "test media cleanup")
    except (requests.RequestException, RuntimeError) as exc:
        print(f"Test media cleanup failed for {file_id}: {exc}", file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Deployed staging API origin")
    parser.add_argument("--id-token", default=os.environ.get("STAGING_ID_TOKEN", ""),
                        help="Short-lived Firebase ID token; STAGING_ID_TOKEN also works")
    parser.add_argument(
        "--app-check-token",
        default=os.environ.get("STAGING_APP_CHECK_TOKEN", ""),
        help="Short-lived Firebase App Check token when staging enforces browser attestation",
    )
    parser.add_argument("--video", required=True, type=pathlib.Path, help="Short MP4 containing clearly spoken audio")
    parser.add_argument("--upload-path", choices=("api", "direct"), default="api")
    parser.add_argument("--cleanup", action="store_true",
                        help="Delete test media on exit, including after a failed journey")
    parser.add_argument("--language", default="english")
    parser.add_argument("--timeout", type=int, default=600, help="Maximum export wait in seconds")
    args = parser.parse_args()

    if not args.id_token:
        parser.error("--id-token or STAGING_ID_TOKEN is required")

    if not args.video.is_file():
        raise SystemExit(f"Video does not exist: {args.video}")

    base_url = args.base_url.rstrip("/") + "/"
    headers = {"Authorization": f"Bearer {args.id_token}"}
    if args.app_check_token:
        headers["X-Firebase-AppCheck"] = args.app_check_token
    session = requests.Session()
    journey_started = time.monotonic()

    require_ok(
        session.post(
            urljoin(base_url, "api/account-bootstrap"),
            json={"id_token": args.id_token},
            headers=headers,
            timeout=30,
        ),
        "account bootstrap",
    )

    upload_started = time.monotonic()
    if args.upload_path == "direct":
        upload = upload_direct(session, base_url, args.video, headers)
    else:
        with args.video.open("rb") as media:
            upload = require_ok(
                session.post(
                    urljoin(base_url, "api/upload"),
                    files={"file": (args.video.name, media, "video/mp4")},
                    headers=headers,
                    timeout=120,
                ),
                "upload",
            )
    file_id = upload["file_id"]
    if args.cleanup:
        atexit.register(cleanup_file, session, base_url, file_id, args.id_token, headers)
    upload_seconds = time.monotonic() - upload_started
    print(f"upload ok: {file_id}")

    transcription_started = time.monotonic()
    process_deadline = time.monotonic() + args.timeout
    processed = require_ok(
        session.post(
            urljoin(base_url, "api/process"),
            json={
                "file_id": file_id,
                "language": args.language,
                "min_words": 2,
                "max_words": 5,
                "id_token": args.id_token,
            },
            headers=headers,
            timeout=240,
        ),
        "process",
    )
    processed = await_transcription(session, base_url, {
        "file_id": file_id, "language": args.language, "min_words": 2, "max_words": 5,
        "id_token": args.id_token,
    }, headers, processed, deadline=process_deadline)
    captions = processed.get("captions") or []
    if not captions:
        raise RuntimeError("process succeeded without captions")
    transcription_seconds = time.monotonic() - transcription_started
    print(f"process ok: {len(captions)} captions")

    export_started = time.monotonic()
    export = require_ok(
        session.post(
            urljoin(base_url, "api/export"),
            json={
                "file_id": file_id,
                "captions": captions,
                "style": {},
                "word_layouts": {},
                "id_token": args.id_token,
                "idempotency_key": f"staging-smoke-{uuid.uuid4()}",
                "quality": "1080p",
                "fps": 30,
            },
            headers=headers,
            timeout=120,
        ),
        "export",
    )
    job_id = export.get("export_job_id")
    deadline = time.monotonic() + args.timeout
    while export.get("queued") or export.get("status") in {"queued", "started", "processing"}:
        if not job_id or time.monotonic() >= deadline:
            raise RuntimeError(f"export did not complete within {args.timeout}s (job={job_id})")
        time.sleep(3)
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

    video_url = export.get("video_url")
    if not video_url:
        raise RuntimeError("completed export has no video_url")
    export_seconds = time.monotonic() - export_started
    download_started = time.monotonic()
    download = session.get(urljoin(base_url, video_url), headers=headers, timeout=120)
    download.raise_for_status()
    if len(download.content) < 1024 or b"ftyp" not in download.content[:64]:
        raise RuntimeError("downloaded export is empty or is not an MP4")
    print(f"export ok: job={job_id or 'synchronous'} bytes={len(download.content)}")
    print("SMOKE_METRICS_JSON=" + json.dumps({
        "upload_seconds": round(upload_seconds, 3),
        "transcription_seconds": round(transcription_seconds, 3),
        "export_seconds": round(export_seconds, 3),
        "download_seconds": round(time.monotonic() - download_started, 3),
        "journey_seconds": round(time.monotonic() - journey_started, 3),
    }))


if __name__ == "__main__":
    main()
