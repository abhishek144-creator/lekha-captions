from __future__ import annotations

import argparse
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT_DIR = Path(__file__).resolve().parents[1]
DIST_DIR = ROOT_DIR / "dist"
DEFAULT_BACKEND = "http://127.0.0.1:8000"
PROXY_PREFIXES = ("/api/", "/uploads/")


class LocalPreviewHandler(BaseHTTPRequestHandler):
    backend_base = DEFAULT_BACKEND
    dist_dir = DIST_DIR

    def do_GET(self):
        self._handle_request(with_body=False)

    def do_HEAD(self):
        self._handle_request(with_body=False, send_body=False)

    def do_POST(self):
        self._handle_request(with_body=True)

    def do_PUT(self):
        self._handle_request(with_body=True)

    def do_PATCH(self):
        self._handle_request(with_body=True)

    def do_DELETE(self):
        self._handle_request(with_body=True)

    def do_OPTIONS(self):
        self._handle_request(with_body=False)

    def log_message(self, format: str, *args):
        return

    def _handle_request(self, with_body: bool, send_body: bool = True):
        if self.path.startswith(PROXY_PREFIXES):
            self._proxy_request(with_body=with_body, send_body=send_body)
            return
        self._serve_static(send_body=send_body)

    def _proxy_request(self, with_body: bool, send_body: bool):
        target = f"{self.backend_base}{self.path}"
        body = None
        if with_body:
            length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(length) if length > 0 else None

        headers = {
            key: value
            for key, value in self.headers.items()
            if key.lower() not in {"host", "connection", "content-length"}
        }
        headers["Host"] = urlsplit(self.backend_base).netloc

        request = Request(target, data=body, headers=headers, method=self.command)

        try:
            with urlopen(request, timeout=120) as response:
                payload = response.read()
                self.send_response(response.status)
                for key, value in response.getheaders():
                    if key.lower() in {"connection", "transfer-encoding", "content-encoding"}:
                        continue
                    self.send_header(key, value)
                self.end_headers()
                if send_body and payload:
                    self.wfile.write(payload)
        except HTTPError as error:
            payload = error.read()
            self.send_response(error.code)
            for key, value in error.headers.items():
                if key.lower() in {"connection", "transfer-encoding", "content-encoding"}:
                    continue
                self.send_header(key, value)
            self.end_headers()
            if send_body and payload:
                self.wfile.write(payload)
        except URLError as error:
            payload = f"Backend request failed: {error}".encode("utf-8")
            self.send_response(502)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            if send_body:
                self.wfile.write(payload)

    def _serve_static(self, send_body: bool):
        request_path = urlsplit(self.path).path or "/"
        relative_path = request_path.lstrip("/")
        file_path = (self.dist_dir / relative_path).resolve()

        try:
            file_path.relative_to(self.dist_dir.resolve())
        except ValueError:
            self._send_not_found()
            return

        if request_path.endswith("/") or not file_path.exists() or file_path.is_dir():
            file_path = self.dist_dir / "index.html"

        if not file_path.exists():
            self._send_not_found()
            return

        content = file_path.read_bytes()
        content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if send_body:
            self.wfile.write(content)

    def _send_not_found(self):
        payload = b"Not found"
        self.send_response(404)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


def main():
    parser = argparse.ArgumentParser(description="Serve dist/ with backend proxying for local preview.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--backend", default=os.environ.get("PREVIEW_BACKEND_URL", DEFAULT_BACKEND))
    args = parser.parse_args()

    LocalPreviewHandler.backend_base = args.backend.rstrip("/")
    server = ThreadingHTTPServer((args.host, args.port), LocalPreviewHandler)
    print(f"Local preview server running at http://{args.host}:{args.port}")
    print(f"Proxying /api and /uploads to {LocalPreviewHandler.backend_base}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
