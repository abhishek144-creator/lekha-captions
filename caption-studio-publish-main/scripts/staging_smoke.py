"""Run a real authenticated upload -> transcription -> export smoke in staging."""

import argparse
import pathlib
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True, help="Deployed staging API origin")
    parser.add_argument("--id-token", required=True, help="Short-lived Firebase ID token for a staging user")
    parser.add_argument("--video", required=True, type=pathlib.Path, help="Short MP4 containing clearly spoken audio")
    parser.add_argument("--language", default="english")
    parser.add_argument("--timeout", type=int, default=600, help="Maximum export wait in seconds")
    args = parser.parse_args()

    if not args.video.is_file():
        raise SystemExit(f"Video does not exist: {args.video}")

    base_url = args.base_url.rstrip("/") + "/"
    headers = {"Authorization": f"Bearer {args.id_token}"}
    session = requests.Session()

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
    print(f"upload ok: {file_id}")

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
    captions = processed.get("captions") or []
    if not captions:
        raise RuntimeError("process succeeded without captions")
    print(f"process ok: {len(captions)} captions")

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
    download = session.get(urljoin(base_url, video_url), headers=headers, timeout=120)
    download.raise_for_status()
    if len(download.content) < 1024 or b"ftyp" not in download.content[:64]:
        raise RuntimeError("downloaded export is empty or is not an MP4")
    print(f"export ok: job={job_id or 'synchronous'} bytes={len(download.content)}")


if __name__ == "__main__":
    main()
