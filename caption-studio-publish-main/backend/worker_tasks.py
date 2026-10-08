"""Worker tasks for an explicit application context."""
from types import SimpleNamespace


def create_worker_tasks(context):
    def recover_interrupted_export_retry(export_job_id: str):
        """Called only after RQ confirms a failed or abandoned execution will retry."""
        record = context._load_export_job(export_job_id) or {}
        status = record.get("status")
        if status not in {"starting", "processing", "finalizing"}:
            return
        if status == "finalizing" and context._load_recorded_export_result(
            record.get("uid", ""), export_job_id, record.get("file_id", "")
        ):
            # The retry recovers this paid result without rendering or charging again.
            return
        try:
            context._set_export_job(export_job_id, "retrying", expected_status=status,
                            error="Worker interrupted; export will retry")
        except context.InvalidJobTransition:
            # A concurrent completion/cancellation remains authoritative.
            return


    def run_export_job_task(
        export_job_id: str,
        req_payload: context.Dict[str, context.Any],
        uid: str,
        idempotency_key: str = "",
        idempotency_request_hash: str = "",
    ):
        rid = f"worker-{export_job_id[:8]}"
        slot_acquired = False
        # RQ has removed the job ID from the pending list before invoking us. Keep
        # the atomic admission ledger aligned with pending work, not active work.
        context._release_export_pending_work(export_job_id)
        existing_job = context._load_export_job(export_job_id) or {}
        if existing_job.get("status") == "completed":
            return existing_job.get("payload") or {}
        try:
            if existing_job.get("status") == "finalizing":
                context._assert_account_not_deleting(uid)
                recorded = context._load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
                if recorded:
                    context._set_export_job(export_job_id, "completed", payload=recorded,
                                    completed_at=context.time.time(), recovered_from_usage=True)
                    if idempotency_key:
                        context._idem_set(idempotency_key, {"status": "completed", "ts": context.time.time(), "payload": recorded,
                                                   "request_hash": idempotency_request_hash, "job_id": export_job_id})
                    return recorded
            context._set_export_job(export_job_id, "starting", worker_release=context.APP_RELEASE)
        except context.InvalidJobTransition:
            current = context._load_export_job(export_job_id) or {}
            return {"success": False, "status": current.get("status"), "export_job_id": export_job_id}
        try:
            if (existing_job.get("status") or "").lower() == "cancelled":
                context._json_log("info", "cancelled_export_skipped", job_id=export_job_id, uid=uid)
                return {
                    "success": False,
                    "status": "cancelled",
                    "export_job_id": export_job_id,
                }
            slot_acquired = context._acquire_export_slot(uid, export_job_id)
            if not slot_acquired:
                wait_retry = context._export_slot_wait_retry()
                if wait_retry is not None:
                    # Batch items for one account share its single export slot. Waiting
                    # for a sibling render is not a failure: reschedule without using
                    # the job's failure retries (a 10-item batch outlived them) and
                    # without dead-lettering every poll.
                    context._set_export_job(export_job_id, "retrying", error=None)
                    context._json_log("info", "export_waiting_for_account_slot", job_id=export_job_id)
                    return wait_retry
                raise RuntimeError("Another export currently owns this account's export slot")
            req = context.ExportRequest(**req_payload)
            payload = context.asyncio.run(context._process_export_job_core(req, uid, rid, export_job_id))
            if idempotency_key:
                context._idem_set(idempotency_key, {
                    "status": "completed",
                    "ts": context.time.time(),
                    "payload": payload,
                    "request_hash": idempotency_request_hash,
                    "job_id": export_job_id,
                })
            return payload
        except Exception as e:
            # Completion storage/telemetry may fail AFTER the atomic debit. In that
            # case the export succeeded: preserve its idempotency result and do not
            # turn a paid result into a fresh render on the next submission.
            usage_recovery_unknown = False
            try:
                recorded = context._load_recorded_export_result(uid, export_job_id, str(req_payload.get("file_id") or ""))
            except Exception as recovery_error:
                recorded = None
                usage_recovery_unknown = True
                context._json_log("warning", "export_usage_recovery_unavailable", job_id=export_job_id,
                          error=type(recovery_error).__name__)
            if recorded:
                try:
                    current = context._load_export_job(export_job_id) or {}
                    if current.get("status") == "finalizing":
                        context._set_export_job(export_job_id, "completed", payload=recorded,
                                        completed_at=context.time.time(), recovered_from_usage=True)
                    if idempotency_key:
                        context._idem_set(idempotency_key, {"status": "completed", "ts": context.time.time(), "payload": recorded,
                                                   "request_hash": idempotency_request_hash, "job_id": export_job_id})
                except Exception as recovery_error:
                    context._json_log("warning", "export_completion_recovery_pending", job_id=export_job_id,
                              error=type(recovery_error).__name__)
                return recorded
            try:
                from rq import get_current_job
                rq_job = get_current_job()
                retryable = not isinstance(e, context.HTTPException) or e.status_code >= 500
                retry_pending = bool(rq_job and rq_job.retries_left and retryable)
                if rq_job and not retryable:
                    rq_job.retries_left = 0
                    rq_job.save()
                context._set_export_job(export_job_id, "retrying" if retry_pending else "failed",
                                failed_at=context.time.time(), error="Export failed. Please retry or contact support.")
            except Exception as state_error:
                context._json_log(
                    "error",
                    "export_failure_state_persist_failed",
                    job_id=export_job_id,
                    error=str(state_error),
                )
            failed_job = context._load_export_job(export_job_id) or {}
            entered_at = float(failed_job.get("queue_entered_at") or context.time.time())
            context._json_log(
                "warning", "export_observation", job_id=export_job_id,
                status="retrying" if locals().get("retry_pending", False) else "failed",
                queue_wait_ms=failed_job.get("queue_wait_ms"),
                elapsed_ms=max(0, int((context.time.time() - entered_at) * 1000)),
            )
            if idempotency_key and not locals().get("retry_pending", False) and not usage_recovery_unknown:
                context._idem_delete(idempotency_key)
            context._write_dead_letter(
                export_job_id,
                str(e),
                {"req_payload": context._sanitize_export_request_payload(req_payload), "uid": uid},
            )
            raise
        finally:
            if slot_acquired:
                context._release_export_slot(uid, export_job_id)


    def run_media_scan_job_task(uid: str, file_id: str):
        """Materialize and scan one upload; duplicate deliveries are harmless."""
        context._assert_account_not_deleting(uid)
        context._assert_upload_owner(file_id, uid)
        metadata = context._load_upload_metadata(file_id)
        if str(metadata.get("upload_state") or "").lower() in {"clean", "rejected"}:
            context.MediaScanJobs(context.get_db()).finish(file_id)
            return {"status": str(metadata.get("upload_state"))}
        input_path = context._safe_find_upload(file_id)
        if not input_path:
            raise RuntimeError("Uploaded media could not be materialized for scanning")
        try:
            result = context._ensure_upload_clean(file_id, uid, input_path)
            context.MediaScanJobs(context.get_db()).finish(file_id)
            return {"status": str(result.get("upload_state") or "clean")}
        except context.HTTPException:
            # A malware rejection is terminal and already persisted by
            # _ensure_upload_clean. Scanner/runtime failures stay in the outbox.
            current = context._load_upload_metadata(file_id)
            if str(current.get("upload_state") or "").lower() == "rejected":
                context.MediaScanJobs(context.get_db()).finish(file_id)
                return {"status": "rejected"}
            raise


    return SimpleNamespace(
        recover_interrupted_export_retry=recover_interrupted_export_retry,
        run_export_job_task=run_export_job_task,
        run_media_scan_job_task=run_media_scan_job_task,
    )
