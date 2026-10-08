import importlib.util
import tempfile
import unittest
from pathlib import Path

script = Path(__file__).resolve().parents[2] / 'scripts/verify_clamav_signatures.py'
spec = importlib.util.spec_from_file_location('clamav_signature_freshness', script)
freshness = importlib.util.module_from_spec(spec)
spec.loader.exec_module(freshness)


class ClamAVSignatureFreshnessTests(unittest.TestCase):
    now = 1791288000

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name)
        self.write('main.cvd', self.now - 400 * 86400)
        self.write('daily.cvd', self.now - 3600)

    def write(self, name, timestamp):
        header = f'ClamAV-VDB:date:27974:2000:90:md5:signature:builder:{timestamp}'
        (self.directory / name).write_bytes(header.encode().ljust(512, b' '))

    def test_accepts_fresh_daily_and_old_base_database(self):
        self.assertEqual(len(freshness.verify(self.directory, now=self.now)), 2)

    def test_accepts_incrementally_updated_cld(self):
        (self.directory / 'daily.cvd').rename(self.directory / 'daily.cld')
        self.assertEqual(freshness.verify(self.directory, now=self.now)[1]['file'], 'daily.cld')

    def test_rejects_stale_daily(self):
        self.write('daily.cvd', self.now - 8 * 86400)
        with self.assertRaisesRegex(ValueError, 'older than'):
            freshness.verify(self.directory, now=self.now)

    def test_rejects_missing_daily(self):
        (self.directory / 'daily.cvd').unlink()
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            freshness.verify(self.directory, now=self.now)

    def test_rejects_duplicate_formats(self):
        self.write('daily.cld', self.now)
        with self.assertRaisesRegex(ValueError, 'exactly one'):
            freshness.verify(self.directory, now=self.now)

    def test_rejects_malformed_header(self):
        (self.directory / 'daily.cvd').write_bytes(b'invalid'.ljust(512, b' '))
        with self.assertRaisesRegex(ValueError, 'invalid database header'):
            freshness.verify(self.directory, now=self.now)

    def test_rejects_future_timestamp(self):
        self.write('daily.cvd', self.now + 2 * 86400)
        with self.assertRaisesRegex(ValueError, 'future'):
            freshness.verify(self.directory, now=self.now)

    def test_rejects_nonpositive_age_limit(self):
        with self.assertRaisesRegex(ValueError, 'positive'):
            freshness.verify(self.directory, now=self.now, max_age_days=0)
