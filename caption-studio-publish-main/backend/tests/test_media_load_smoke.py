import io
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import requests

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
from media_load_smoke import _acknowledged_bytes, upload_direct, video_for_journey


class FakeResponse:
    def __init__(self, status, payload=None, headers=None):
        self.status_code = status
        self._payload = payload or {}
        self.headers = headers or {}
        self.ok = 200 <= status < 300

    def json(self):
        return self._payload


class FakeVideo:
    name = "source.mp4"

    def stat(self):
        return SimpleNamespace(st_size=8)

    def open(self, mode):
        assert mode == "rb"
        return io.BytesIO(b"abcdefgh")


class FakeSession:
    def __init__(self):
        self.puts = []
        self.posts = []

    def post(self, url, **kwargs):
        self.posts.append((url, kwargs))
        if url.endswith("/init"):
            return FakeResponse(200, {"success": True, "direct_upload_available": True,
                                      "upload_url": "https://storage.test/session", "file_id": "file-1"})
        return FakeResponse(200, {"success": True, "file_id": "file-1"})

    def put(self, url, **kwargs):
        self.puts.append((url, kwargs))
        if len(self.puts) == 1:
            return FakeResponse(308, headers={"Range": "bytes=0-3"})
        return FakeResponse(201)


class InterruptedSession(FakeSession):
    def put(self, url, **kwargs):
        self.puts.append((url, kwargs))
        if len(self.puts) == 1:
            raise requests.ConnectionError("simulated disconnect")
        if len(self.puts) == 2:
            return FakeResponse(308, headers={"Range": "bytes=0-3"})
        return FakeResponse(201)


class MediaLoadSmokeTests(unittest.TestCase):
    def test_chunked_direct_upload_and_completion(self):
        session = FakeSession()
        result = upload_direct(session, "https://api.test/", {"Authorization": "Bearer test"},
                               FakeVideo(), chunk_bytes=4)
        self.assertEqual(result["file_id"], "file-1")
        self.assertEqual([call[1]["headers"]["Content-Range"] for call in session.puts],
                         ["bytes 0-3/8", "bytes 4-7/8"])
        self.assertEqual(session.posts[-1][1]["json"], {"file_id": "file-1"})

    def test_interrupted_upload_resumes_from_confirmed_offset(self):
        session = InterruptedSession()
        with patch("media_load_smoke.time.sleep"):
            upload_direct(session, "https://api.test/", {}, FakeVideo(), chunk_bytes=4)
        self.assertEqual([call[1]["headers"]["Content-Range"] for call in session.puts],
                         ["bytes 0-3/8", "bytes */8", "bytes 4-7/8"])

    def test_invalid_storage_range_is_rejected(self):
        with self.assertRaises(RuntimeError):
            _acknowledged_bytes(FakeResponse(308, headers={"Range": "bytes=8-9"}), 8)

    def test_distinct_videos_are_assigned_round_robin(self):
        videos = [pathlib.Path("first.mp4"), pathlib.Path("second.mp4"), pathlib.Path("third.mp4")]
        args = SimpleNamespace(videos=videos)
        self.assertEqual([video_for_journey(args, index) for index in range(1, 6)],
                         [videos[0], videos[1], videos[2], videos[0], videos[1]])


if __name__ == "__main__":
    unittest.main()
