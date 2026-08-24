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
    client.upload_file(local_path, S3_BUCKET, remote_path, ExtraArgs=extra_args)
    return True


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


def signed_download_url(remote_path: str, expiration_seconds: int) -> str | None:
    client = _client()
    if client is None:
        return None
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": remote_path},
        ExpiresIn=max(60, min(int(expiration_seconds), 7 * 24 * 3600)),
    )
