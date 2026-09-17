"""Isolated FFmpeg workload used only for controlled worker-capacity drills."""
import json
import os
import subprocess
import time


def run_capacity_probe_task(probe_id: str, duration_seconds: int = 30):
    duration = max(10, min(int(duration_seconds), 120))
    started = time.time()
    command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-re",
        "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
        "-t", str(duration), "-c:v", "libx264", "-preset", "veryfast",
        "-f", "null", "-",
    ]
    subprocess.run(command, check=True, timeout=duration + 90)
    elapsed = round(time.time() - started, 3)
    result = {
        "probe_id": str(probe_id),
        "elapsed_seconds": elapsed,
        "worker": os.environ.get("HOSTNAME", "unknown"),
        "release": os.environ.get("APP_RELEASE", ""),
    }
    print(json.dumps({"event": "capacity_probe_completed", **result}), flush=True)
    return result
