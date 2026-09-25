"""Lifecycle management for the render worker's warm Chromium process."""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import tempfile
import time


class ChromiumPool:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.process = None
        self.endpoint_path = Path(tempfile.gettempdir()) / f"lekha-chromium-{os.getpid()}.json"

    def start(self, timeout_seconds: float = 30.0) -> bool:
        if self.process is not None and self.process.poll() is None and self.endpoint_path.exists():
            return True
        self.stop()
        self.endpoint_path.unlink(missing_ok=True)
        script = self.project_root / "scripts" / "chromium_pool.mjs"
        self.process = subprocess.Popen(  # noqa: S603 - fixed executable and repository script
            ["node", str(script), str(self.endpoint_path)],
            cwd=str(self.project_root),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                break
            try:
                payload = json.loads(self.endpoint_path.read_text(encoding="utf-8"))
                if str(payload.get("browserWSEndpoint", "")).startswith("ws://"):
                    os.environ["PUPPETEER_WS_ENDPOINT_FILE"] = str(self.endpoint_path)
                    return True
            except (OSError, ValueError):
                pass
            time.sleep(0.1)
        self.stop()
        return False

    def stop(self) -> None:
        os.environ.pop("PUPPETEER_WS_ENDPOINT_FILE", None)
        if self.process is not None and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)
        self.process = None
        self.endpoint_path.unlink(missing_ok=True)
