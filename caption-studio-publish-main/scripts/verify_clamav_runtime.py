"""Final-image scan acceptance: clean 500 MiB input, threat, and limits."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time

from backend.services import malware


def verify():
    os.environ["CLAMAV_SCAN_CMD"] = "clamscan --stdout --database=/opt/clamav-db"
    os.environ["CLAMAV_SCAN_TIMEOUT_SECONDS"] = "180"
    os.environ["CLAMAV_HOST"] = ""
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        large = root / "upload-limit.bin"
        # Reproducible inert data, no network, exactly the largest allowed upload.
        block = bytes(range(256)) * 4096
        with large.open("wb") as target:
            for _ in range(500):
                target.write(block)
        threat = root / "scanner-test.txt"
        # Standard harmless EICAR antivirus test string.
        threat.write_bytes(b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*")
        assert large.stat().st_size == 524288000
        assert malware.scan_upload_for_threat(large), "CLI rejected clean maximum upload"
        assert not malware.scan_upload_for_threat(threat), "CLI missed EICAR fixture"
        limited = subprocess.run([
            "clamscan", "--database=/opt/clamav-db", "--max-filesize=1M",
            "--alert-exceeds-max=yes", "--no-summary", str(large),
        ], capture_output=True, text=True, timeout=180)
        assert limited.returncode == 1, "Scan limit did not fail closed"
        assert "Heuristics.Limits.Exceeded" in limited.stdout + limited.stderr
        with (root / "clamd.log").open("w") as log:
            daemon = subprocess.Popen([
                "clamd", "--config-file=/app/deploy/clamav/clamd.conf",
            ], stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 90
                while True:
                    if daemon.poll() is not None:
                        raise RuntimeError("Final-image clamd exited during startup")
                    try:
                        with socket.create_connection(("127.0.0.1", 3310), timeout=1) as client:
                            client.sendall(b"zPING\0")
                            if client.recv(64).rstrip(b"\0") == b"PONG":
                                break
                    except OSError:
                        pass
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Final-image clamd startup exceeded 90 seconds")
                    time.sleep(0.5)
                os.environ["CLAMAV_HOST"] = "127.0.0.1"
                # Disable the CLI fallback: this must exercise the loaded daemon.
                os.environ["CLAMAV_SCAN_CMD"] = ""
                assert malware.scan_upload_for_threat(large), "Daemon rejected clean maximum upload"
                assert not malware.scan_upload_for_threat(threat), "Daemon missed EICAR fixture"
            finally:
                daemon.terminate()
                try:
                    daemon.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    daemon.kill()
                    daemon.wait(timeout=10)
    print(json.dumps({"verified": True, "clean_bytes": 524288000,
                      "paths": ["clamscan", "clamd"], "eicar_detected": True,
                      "scan_limit_rejected": True}))


if __name__ == "__main__":
    verify()
