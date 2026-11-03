"""Bounded-memory alternate delivery for an already authorized R2 export."""

import re

from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTask

try:
    from . import media_storage
except ImportError:
    import media_storage


def stream_export(key, filename, range_header=None):
    if range_header and not re.fullmatch(r"bytes=(?:[0-9]+-[0-9]*|-[0-9]+)", range_header):
        raise HTTPException(status_code=416, detail="Unsupported download range")
    client = media_storage._client()
    if client is None:
        raise HTTPException(status_code=503, detail="Alternate download is unavailable")
    try:
        result = client.get_object(
            Bucket=media_storage.S3_BUCKET, Key=key,
            **({"Range": range_header} if range_header else {}),
        )
    except Exception as error:
        status = getattr(error, 'response', {}).get('ResponseMetadata', {}).get('HTTPStatusCode')
        if status in (404, 416):
            raise HTTPException(status_code=status, detail="Export not found" if status == 404 else "Invalid download range") from error
        raise HTTPException(status_code=503, detail="Download connection unavailable. Please try again.") from error
    body = result['Body']

    def chunks():
        try:
            while chunk := body.read(64 * 1024):
                yield chunk
        finally:
            body.close()

    headers = {
        'Content-Disposition': media_storage.download_disposition(filename),
        'Content-Length': str(result['ContentLength']),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
    }
    if result.get('ContentRange'):
        headers['Content-Range'] = result['ContentRange']
    if result.get('ETag'):
        headers['ETag'] = result['ETag']
    return StreamingResponse(chunks(), media_type='video/mp4',
                             status_code=206 if result.get('ContentRange') else 200,
                             headers=headers, background=BackgroundTask(body.close))
