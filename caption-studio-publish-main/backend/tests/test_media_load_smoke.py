import io
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

import requests

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "scripts"))
from media_load_smoke import _acknowledged_bytes, download_export, run_journey, upload_direct, video_for_journey, video_sha256


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
    def test_failed_journey_preserves_admission_retry_count(self):
        args = SimpleNamespace(base_url='https://api.test', videos=[FakeVideo()],
            upload_mode='direct', upload_timeout=30, process_timeout=30, language='english',
            export_barrier=None, export_wait_timeout=30, export_submit_timeout=30,
            quality='1080p', fps=30, cleanup=False, poll_interval=0)
        session = Mock()
        session.post.side_effect = [
            FakeResponse(200, {'captions': [{'text': 'Real speech', 'start_time': 0, 'end_time': 2}]}),
            FakeResponse(429, headers={'Retry-After': '1'}),
            FakeResponse(503, headers={'Retry-After': '1'}),
            requests.ConnectionError('lost export response'),
        ]
        with patch('media_load_smoke.requests.Session', return_value=session), \
             patch('media_load_smoke.upload_direct', return_value={'file_id': 'file-1'}), \
             patch('media_load_smoke.time.sleep'):
            result = run_journey(1, {'id_token': 'test', 'bootstrap': False}, args)
        self.assertFalse(result['ok'])
        self.assertEqual(result['admission_retries'], 2)

    def test_signed_download_does_not_transmit_api_credentials(self):
        response = requests.Response()
        response.status_code = 200
        session = Mock()
        session.get.return_value = response
        result = download_export(session, 'https://api.test/',
            {'Authorization': 'Bearer identity', 'X-Firebase-AppCheck': 'attestation'},
            {'download_url': 'https://r2.test/signed', 'video_url': '/api/video/id'}, timeout=30)
        self.assertIs(result, response)
        session.get.assert_called_once_with('https://r2.test/signed', headers={}, timeout=30, allow_redirects=False)

    def test_api_download_redirect_strips_both_firebase_headers(self):
        redirect = requests.Response()
        redirect.status_code = 302
        redirect.headers['Location'] = 'https://r2.test/signed'
        response = requests.Response()
        response.status_code = 200
        session = Mock()
        session.get.side_effect = [redirect, response]
        headers = {'Authorization': 'Bearer identity', 'X-Firebase-AppCheck': 'attestation'}
        self.assertIs(download_export(session, 'https://api.test/', headers,
            {'video_url': '/api/video/id'}, timeout=30), response)
        calls = session.get.call_args_list
        self.assertEqual(calls[0].kwargs['headers'], headers)
        self.assertEqual(calls[1].kwargs['headers'], {})
        self.assertTrue(all(call.kwargs['allow_redirects'] is False for call in calls))

    def test_download_rejects_insecure_storage_and_bounds_redirects(self):
        session = Mock()
        with self.assertRaisesRegex(RuntimeError, 'unsafe URL'):
            download_export(session, 'https://api.test/', {}, {'download_url':'http://r2.test/file'}, timeout=30)
        session.get.assert_not_called()
        response = requests.Response()
        response.status_code = 302
        response.headers['Location'] = '/loop'
        session.get.return_value = response
        with self.assertRaisesRegex(RuntimeError, 'redirect limit'):
            download_export(session, 'https://api.test/', {}, {'video_url':'/loop'}, timeout=30)
        self.assertEqual(session.get.call_count, 4)

    def multipart_session(self, statuses):
        class MultipartSession(FakeSession):
            def post(self, url, **kwargs):
                self.posts.append((url, kwargs))
                if url.endswith('/init'):
                    return FakeResponse(200, {'success': True, 'direct_upload_available': True,
                                              'upload_protocol': 's3_multipart', 'file_id': 'file-1',
                                              'part_size': 5, 'part_count': 2})
                if url.endswith('/parts'):
                    number = kwargs['json']['part_numbers'][0]
                    return FakeResponse(200, {'parts': [{'part_number': number,
                        'content_length': 5 if number == 1 else 3, 'url': f'https://r2.test/{number}'}]})
                return FakeResponse(200, {'success': True, 'file_id': 'file-1'})

            def put(self, url, **kwargs):
                self.puts.append((url, kwargs))
                outcome = statuses.pop(0)
                if isinstance(outcome, Exception):
                    raise outcome
                return FakeResponse(outcome)
        return MultipartSession()

    def test_r2_upload_uses_signed_part_lengths_without_api_credentials(self):
        session = self.multipart_session([200, 200])
        result = upload_direct(session, 'https://api.test/', {'Authorization': 'Bearer test'}, FakeVideo())
        self.assertEqual(result['file_id'], 'file-1')
        self.assertEqual([call[1]['data'] for call in session.puts], [b'abcde', b'fgh'])
        self.assertEqual([call[1]['headers'] for call in session.puts],
                         [{'Content-Length': '5'}, {'Content-Length': '3'}])
        self.assertTrue(session.posts[-1][0].endswith('/complete'))

    def test_r2_dropped_response_retries_the_same_part_before_completion(self):
        session = self.multipart_session([requests.ConnectionError('disconnect'), 200, 200])
        with patch('media_load_smoke.time.sleep'):
            upload_direct(session, 'https://api.test/', {}, FakeVideo())
        self.assertEqual([call[0] for call in session.puts],
                         ['https://r2.test/1', 'https://r2.test/1', 'https://r2.test/2'])
        self.assertEqual(session.puts[0][1]['data'], session.puts[1][1]['data'])

    def test_r2_rejection_never_completes_an_incomplete_upload(self):
        session = self.multipart_session([403])
        with self.assertRaises(RuntimeError):
            upload_direct(session, 'https://api.test/', {}, FakeVideo())
        self.assertFalse(any(url.endswith('/complete') for url, _ in session.posts))

    def test_r2_signed_size_mismatch_is_rejected_before_upload(self):
        session = self.multipart_session([200, 200])
        real_post = session.post

        def post(url, **kwargs):
            response = real_post(url, **kwargs)
            if url.endswith('/parts'):
                response._payload['parts'][0]['content_length'] = 9
            return response

        session.post = post
        with self.assertRaisesRegex(RuntimeError, 'Signed part'):
            upload_direct(session, 'https://api.test/', {}, FakeVideo())
        self.assertEqual(session.puts, [])

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

    def test_video_fingerprint_changes_with_the_content(self):
        class InMemoryVideo:
            def __init__(self, content):
                self.content = content

            def open(self, mode):
                assert mode == "rb"
                return io.BytesIO(self.content)

        self.assertNotEqual(video_sha256(InMemoryVideo(b"first media")),
                            video_sha256(InMemoryVideo(b"second media")))


if __name__ == "__main__":
    unittest.main()
