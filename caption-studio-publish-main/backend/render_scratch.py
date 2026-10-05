"""Container-local render leases survive abrupt RQ child termination safely."""
import os
import shutil
import time
import uuid
from pathlib import Path

STALE_SECONDS = 40 * 60  # longer than the 30-minute RQ render deadline
MIN_FREE_BYTES = 256 * 1024 * 1024


def _lock(handle):
    if os.name == "nt":
        import msvcrt
        handle.seek(0)
        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
    else:
        import fcntl
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def sweep_render_scratch(root, now=None):
    """Remove only expired, unleased children; never follow directory symlinks."""
    root = Path(root)
    deleted = 0
    if not root.is_dir() or root.is_symlink():
        return deleted
    now = time.time() if now is None else now
    for path in root.iterdir():
        if not path.name.startswith("caption-template-overlay-") or path.is_symlink() or not path.is_dir():
            continue
        lease = None
        try:
            if now - path.stat().st_mtime < STALE_SECONDS:
                continue
            lock_path = path / ".lease"
            if lock_path.is_symlink():
                continue
            if lock_path.exists():
                lease = lock_path.open("r+b")
                _lock(lease)  # OS releases the lock even when RQ kills its child
            # Windows cannot unlink an open lock file. Once obtained, the old
            # UUID cannot be reused by a new renderer, so closing is safe.
            if lease:
                lease.close()
                lease = None
            shutil.rmtree(path)
            deleted += 1
        except OSError:
            # An active lease, another sweeper, or a filesystem error: leave it.
            pass
        finally:
            if lease:
                lease.close()
    return deleted


class RenderScratch:
    def __init__(self, root):
        root = Path(root)
        root.mkdir(parents=True, exist_ok=True)
        sweep_render_scratch(root)
        if shutil.disk_usage(root).free < MIN_FREE_BYTES:
            raise RuntimeError("Insufficient temporary disk space for rendering")
        self.path = str(root / f"caption-template-overlay-{uuid.uuid4().hex}")
        Path(self.path).mkdir()
        self._lease = open(Path(self.path) / ".lease", "w+b")
        self._lease.write(b"1")
        self._lease.flush()
        _lock(self._lease)

    def close(self):
        self._lease.close()
        shutil.rmtree(self.path, ignore_errors=True)
