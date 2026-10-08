"""HTTP/worker entry point. Application composition lives in application.py."""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from .application import runtime
except ImportError:
    from application import runtime

app = runtime.app


def run_export_job_task(export_job_id, req_payload, uid, idempotency_key="", idempotency_request_hash=""):
    return runtime.run_export_job_task(export_job_id, req_payload, uid, idempotency_key, idempotency_request_hash)


def run_transcription_job_task(uid, job_id):
    return runtime.run_transcription_job_task(uid, job_id)


def run_media_scan_job_task(uid, file_id):
    return runtime.run_media_scan_job_task(uid, file_id)


def recover_interrupted_export_retry(export_job_id):
    return runtime.recover_interrupted_export_retry(export_job_id)


def __getattr__(name):
    """Read compatibility for older callers; services depend on runtime directly."""
    return getattr(runtime, name)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("BACKEND_HOST", "127.0.0.1"), port=8000)
