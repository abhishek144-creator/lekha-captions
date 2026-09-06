"""Enforce multipart limits before Starlette spools an UploadFile to disk."""
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse


class UploadBodyLimitMiddleware:
    def __init__(self, app, max_bytes=501 * 1024 * 1024):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope.get("path") != "/api/upload":
            return await self.app(scope, receive, send)
        response = JSONResponse({"success": False, "error": "Upload body is too large"}, status_code=413)
        headers = dict(scope.get("headers", []))
        try:
            declared = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"error": "Invalid Content-Length"}, status_code=400)(scope, receive, send)
        if declared > self.max_bytes:
            return await response(scope, receive, send)
        received, exceeded, sent = 0, False, False

        async def bounded_receive():
            nonlocal received, exceeded
            message = await receive()
            received += len(message.get("body", b""))
            if received > self.max_bytes:
                exceeded = True
                raise HTTPException(413, "Upload body is too large")
            return message

        async def bounded_send(message):
            nonlocal sent
            if exceeded:
                if not sent:
                    sent = True
                    await response(scope, receive, send)
            else:
                await send(message)

        await self.app(scope, bounded_receive, bounded_send)
