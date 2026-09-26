import unittest

from backend.services.media_scan_jobs import MediaScanJobs


class Snapshot:
    def __init__(self, reference):
        self.reference = reference
        self.id = reference.id

    @property
    def exists(self):
        return self.id in self.reference.collection.rows

    def to_dict(self):
        return dict(self.reference.collection.rows.get(self.id, {}))


class Document:
    def __init__(self, collection, document_id):
        self.collection = collection
        self.id = document_id

    def get(self):
        return Snapshot(self)

    def set(self, values, merge=False):
        prior = self.collection.rows.get(self.id, {}) if merge else {}
        self.collection.rows[self.id] = {**prior, **values}

    def delete(self):
        self.collection.rows.pop(self.id, None)


class Collection:
    def __init__(self):
        self.rows = {}

    def document(self, document_id):
        return Document(self, document_id)

    def limit(self, _count):
        return self

    def stream(self):
        return iter([Snapshot(Document(self, key)) for key in list(self.rows)])


class Database:
    def __init__(self):
        self.collections = {}

    def collection(self, name):
        return self.collections.setdefault(name, Collection())


class Queue:
    def __init__(self):
        self.enqueued = []

    def fetch_job(self, _job_id):
        return None

    def enqueue(self, function, *args, **kwargs):
        self.enqueued.append((function, args, kwargs))


class MediaScanJobsTests(unittest.TestCase):
    def setUp(self):
        self.db = Database()
        self.db.collection("uploads").rows["file-1"] = {
            "uid": "owner", "upload_state": "pending_scan",
        }
        self.jobs = MediaScanJobs(self.db)

    def test_upload_completion_creates_and_dispatches_durable_scan(self):
        self.assertTrue(self.jobs.create("owner", "file-1"))
        queue = Queue()
        self.assertEqual(self.jobs.dispatch(queue), 1)
        function, args, options = queue.enqueued[0]
        self.assertEqual(function, "backend.main.run_media_scan_job_task")
        self.assertEqual(args, ("owner", "file-1"))
        self.assertEqual(options["job_id"], "media-scan-file-1")
        pointer = self.db.collection(self.jobs.outbox_collection).rows["file-1"]
        self.assertEqual(pointer["attempts"], 1)

    def test_terminal_scan_state_removes_stale_outbox_entry(self):
        self.jobs.create("owner", "file-1")
        self.db.collection("uploads").rows["file-1"]["upload_state"] = "clean"
        self.assertEqual(self.jobs.dispatch(Queue()), 0)
        self.assertNotIn("file-1", self.db.collection(self.jobs.outbox_collection).rows)


if __name__ == "__main__":
    unittest.main()
