import io
import unittest
from unittest.mock import Mock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from botocore.exceptions import ClientError

from backend import main, export_stream

media_api = main.media_api
media_records = main.media_records


class AlternateExportTests(unittest.TestCase):
    def setUp(self):
        import time
        self.filename = 'export_123e4567-e89b-12d3-a456-426614174000_abcdef123456.mp4'
        self.token = media_records._create_media_token({
            'kind': 'export', 'uid': 'owner', 'filename': self.filename,
            'download_filename': 'my clip.mp4', 'exp': int(time.time()) + 60,
        })
        app = FastAPI()
        app.include_router(media_api.router)
        self.client = TestClient(app)
        self.url = f'/api/media/export/{self.filename}?token={self.token}&delivery=alternate'
        self.account = patch.object(media_api.request_security, '_assert_account_not_deleting')
        self.account.start()
        self.addCleanup(self.account.stop)

    def test_streams_in_chunks_and_preserves_attachment_and_length(self):
        content = b'video' * 30000
        body = io.BytesIO(content)
        storage = Mock()
        storage.get_object.return_value = {'Body': body, 'ContentLength': len(content), 'ETag': 'immutable'}
        with patch.object(media_api.media_storage, 'is_configured', return_value=True), \
                patch.object(export_stream.media_storage, '_client', return_value=storage), \
                patch.object(media_api.firebase_admin_setup, 'signed_export_download_url') as redirect:
            response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, content)
        self.assertEqual(response.headers['content-length'], str(len(content)))
        self.assertEqual(response.headers['accept-ranges'], 'bytes')
        self.assertIn('attachment;', response.headers['content-disposition'])
        self.assertIn('my%20clip.mp4', response.headers['content-disposition'])
        self.assertTrue(body.closed)
        redirect.assert_not_called()
        self.assertEqual(storage.get_object.call_args.kwargs['Key'], f'exports/owner/{self.filename}')

    def test_chrome_can_resume_a_partial_transfer(self):
        storage = Mock()
        storage.get_object.return_value = {'Body': io.BytesIO(b'last'), 'ContentLength': 4,
                                           'ContentRange': 'bytes 6-9/10'}
        with patch.object(media_api.media_storage, 'is_configured', return_value=True), \
                patch.object(export_stream.media_storage, '_client', return_value=storage):
            response = self.client.get(self.url, headers={'Range': 'bytes=6-'})
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response.content, b'last')
        self.assertEqual(response.headers['content-range'], 'bytes 6-9/10')
        self.assertEqual(storage.get_object.call_args.kwargs['Range'], 'bytes=6-')

    def test_unauthorized_or_wrong_file_never_opens_storage(self):
        with patch.object(export_stream, 'stream_export') as stream:
            self.assertEqual(self.client.get(self.url.replace(self.token, 'invalid')).status_code, 401)
            self.assertEqual(self.client.get(self.url.replace('abcdef123456', 'abcdef123457')).status_code, 403)
        stream.assert_not_called()

    def test_multi_range_rejected_and_storage_failures_are_sanitized(self):
        storage = Mock()
        with patch.object(media_api.media_storage, 'is_configured', return_value=True), \
                patch.object(export_stream.media_storage, '_client', return_value=storage):
            self.assertEqual(self.client.get(self.url, headers={'Range': 'bytes=0-1,4-5'}).status_code, 416)
            storage.get_object.assert_not_called()
            for status in (404, 416, 500):
                storage.get_object.side_effect = ClientError({'Error': {'Code': 'private'},
                    'ResponseMetadata': {'HTTPStatusCode': status}}, 'GetObject')
                response = self.client.get(self.url)
                self.assertEqual(response.status_code, status if status in (404, 416) else 503)
                self.assertNotIn('private', response.text)
