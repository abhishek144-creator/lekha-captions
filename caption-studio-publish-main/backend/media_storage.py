"""S3-compatible durable media storage used by Railway deployments."""

import os
from functools import lru_cache
from typing import Dict, Iterable

try:
    import boto3
    from botocore.config import Config
    from botocore.exceptions import ClientError
except ImportError:  # pragma: no cover - production dependency is pinned
    boto3 = None
    Config = None
    ClientError = Exception


S3_ENDPOINT = os.environ.get("MEDIA_S3_ENDPOINT", "").strip()
S3_REGION = os.environ.get("MEDIA_S3_REGION", "auto").strip() or "auto"
S3_BUCKET = os.environ.get("MEDIA_S3_BUCKET", "").strip()
S3_ACCESS_KEY_ID = os.environ.get("MEDIA_S3_ACCESS_KEY_ID", "").strip()
S3_SECRET_ACCESS_KEY = os.environ.get("MEDIA_S3_SECRET_ACCESS_KEY", "").strip()
S3_ADDRESSING_STYLE = os.environ.get("MEDIA_S3_ADDRESSING_STYLE", "virtual").strip() or "virtual"


def is_configured() -> bool:
    return bool(
        boto3
        and S3_ENDPOINT
        and S3_BUCKET
        and S3_ACCESS_KEY_ID
        and S3_SECRET_ACCESS_KEY
    )


@lru_cache(maxsize=1)
def _client():
    if not is_configured():
        return None
    return boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT,
        region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 4, "mode": "standard"},
            s3={"addressing_style": S3_ADDRESSING_STYLE},
            connect_timeout=10,
            read_timeout=120,
        ),
    )


def upload_file(
    local_path: str,
    remote_path: str,
    content_type: str = "application/octet-stream",
    metadata: Dict[str, str] | None = None,
) -> bool:
    client = _client()
    if client is None:
        return False
    extra_args = {
        "ContentType": content_type,
        "Metadata": {str(key): str(value) for key, value in (metadata or {}).items()},
    }
    if remote_path.startswith("exports/"):
        # Preserve attachment behavior even on S3-compatible providers that
        # ignore a GET response-header override.
        extra_args["ContentDisposition"] = download_disposition()
    client.upload_file(local_path, S3_BUCKET, remote_path, ExtraArgs=extra_args)
    return True


def bucket_ready() -> bool:
    if not is_configured():
        return False
    # Bound this diagnostic separately from large media transfers.
    probe = boto3.client(
        "s3", endpoint_url=S3_ENDPOINT, region_name=S3_REGION,
        aws_access_key_id=S3_ACCESS_KEY_ID, aws_secret_access_key=S3_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4", connect_timeout=3, read_timeout=3,
                      retries={"total_max_attempts": 1}, s3={"addressing_style": S3_ADDRESSING_STYLE}),
    )
    try:
        probe.head_bucket(Bucket=S3_BUCKET)
        return True
    finally:
        probe.close()


def download_file(remote_path: str, local_path: str) -> bool:
    client = _client()
    if client is None:
        return False
    client.download_file(S3_BUCKET, remote_path, local_path)
    return os.path.isfile(local_path) and os.path.getsize(local_path) > 0


def delete_file(remote_path: str) -> bool:
    client = _client()
    if client is None:
        return False
    client.delete_object(Bucket=S3_BUCKET, Key=remote_path)
    return True


def object_exists(remote_path: str) -> bool:
    client = _client()
    if client is None:
        return False
    try:
        client.head_object(Bucket=S3_BUCKET, Key=remote_path)
        return True
    except ClientError as error:
        status = int(error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
        if status == 404:
            return False
        raise


def iter_objects(prefix: str) -> Iterable[dict]:
    client = _client()
    if client is None:
        return []
    paginator = client.get_paginator("list_objects_v2")
    rows = []
    for page in paginator.paginate(Bucket=S3_BUCKET, Prefix=prefix):
        rows.extend(page.get("Contents", []))
    return rows


def create_multipart_upload(remote_path: str, content_type: str, metadata: Dict[str, str] | None = None) -> str:
    """Start a browser-direct multipart upload and return its upload ID."""
    client = _client()
    if client is None:
        raise RuntimeError("S3-compatible storage is not configured")
    response = client.create_multipart_upload(
        Bucket=S3_BUCKET,
        Key=remote_path,
        ContentType=content_type or "application/octet-stream",
        Metadata={str(key): str(value) for key, value in (metadata or {}).items()},
    )
    return str(response["UploadId"])


def presign_upload_part(remote_path: str, upload_id: str, part_number: int,
                        content_length: int, expiration_seconds: int) -> str:
    """Sign one part PUT. The exact Content-Length is part of the signature."""
    client = _client()
    if client is None:
        raise RuntimeError("S3-compatible storage is not configured")
    return client.generate_presigned_url(
        "upload_part",
        Params={
            "Bucket": S3_BUCKET,
            "Key": remote_path,
            "UploadId": upload_id,
            "PartNumber": int(part_number),
            "ContentLength": int(content_length),
        },
        ExpiresIn=max(60, min(int(expiration_seconds), 6 * 3600)),
    )


def list_uploaded_parts(remote_path: str, upload_id: str) -> list[dict]:
    """Return [{"PartNumber", "ETag", "Size"}] for parts storage has received."""
    client = _client()
    if client is None:
        raise RuntimeError("S3-compatible storage is not configured")
    parts: list[dict] = []
    marker = 0
    while True:
        response = client.list_parts(
            Bucket=S3_BUCKET, Key=remote_path, UploadId=upload_id, PartNumberMarker=marker,
        )
        parts.extend(response.get("Parts", []))
        if not response.get("IsTruncated"):
            return parts
        marker = int(response.get("NextPartNumberMarker") or 0)


def complete_multipart_upload(remote_path: str, upload_id: str, parts: Iterable[dict]) -> None:
    client = _client()
    if client is None:
        raise RuntimeError("S3-compatible storage is not configured")
    client.complete_multipart_upload(
        Bucket=S3_BUCKET,
        Key=remote_path,
        UploadId=upload_id,
        MultipartUpload={"Parts": [
            {"PartNumber": int(part["PartNumber"]), "ETag": str(part["ETag"])}
            for part in sorted(parts, key=lambda item: int(item["PartNumber"]))
        ]},
    )


def abort_multipart_upload(remote_path: str, upload_id: str) -> None:
    client = _client()
    if client is None:
        return
    try:
        client.abort_multipart_upload(Bucket=S3_BUCKET, Key=remote_path, UploadId=upload_id)
    except ClientError as error:
        status = int(error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
        if status != 404:
            raise


def object_size(remote_path: str) -> int | None:
    """Object size in bytes, or None when the object does not exist."""
    client = _client()
    if client is None:
        return None
    try:
        return int(client.head_object(Bucket=S3_BUCKET, Key=remote_path).get("ContentLength") or 0)
    except ClientError as error:
        status = int(error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
        if status == 404:
            return None
        raise


def object_metadata(remote_path: str) -> Dict[str, str] | None:
    """User metadata of an object, or None when the object does not exist."""
    client = _client()
    if client is None:
        return None
    try:
        return dict(client.head_object(Bucket=S3_BUCKET, Key=remote_path).get("Metadata") or {})
    except ClientError as error:
        status = int(error.response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0))
        if status == 404:
            return None
        raise


def download_disposition(filename="captioned_video.mp4"):
    from urllib.parse import quote
    name = str(filename or "captioned_video.mp4").replace("\\", "/").split("/")[-1]
    name = "".join(char for char in name if ord(char) >= 32 and ord(char) != 127)[:180]
    return 'attachment; filename="captioned_video.mp4"; filename*=UTF-8\'\'' + quote(name or "captioned_video.mp4", safe="")


def signed_download_url(remote_path: str, expiration_seconds: int,
                        download_filename="captioned_video.mp4") -> str | None:
    client = _client()
    if client is None:
        return None
    return client.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": S3_BUCKET, "Key": remote_path,
            # Cross-origin anchors cannot force a download themselves. Let
            # storage send an attachment so the browser streams directly to disk.
            **({"ResponseContentDisposition": download_disposition(download_filename)}
               if remote_path.startswith("exports/") else {}),
        },
        ExpiresIn=max(60, min(int(expiration_seconds), 7 * 24 * 3600)),
    )
