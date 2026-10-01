"""Export state transitions.

Firestore is the one authoritative record of an export job whenever it is
available (see `transition_firestore`). The Redis path remains only for a
deployment without Firestore; the local path is for tests and dev.
"""
import json
import threading
import zlib

TRANSITIONS = {
    "": {"queued"},
    "queued": {"queued", "starting", "cancelled", "failed"},
    "starting": {"processing", "finalizing", "retrying", "failed"},
    "processing": {"processing", "finalizing", "retrying", "failed"},
    "finalizing": {"completed", "retrying", "failed"},
    "retrying": {"starting", "cancelled", "failed"},
    "completed": set(),
    "failed": set(),
    "cancelled": set(),
}
LOCAL_LOCK = threading.RLock()

# Check and write in one Redis operation; a stale API/worker cannot resurrect a
# cancelled job or overwrite a terminal result. A seed supports Redis recovery
# from the persisted Firestore snapshot without trusting process-local state.
TRANSITION_SCRIPT = """
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
"""


class InvalidJobTransition(RuntimeError):
    pass


# Firestore caps a record at 1 MiB. The export request copy (captions, styles,
# template markup) is the only large field, so it is stored zlib-compressed.
SNAPSHOT_FIELD = "request_snapshot"
PACKED_SNAPSHOT_FIELD = "request_snapshot_zlib"
MAX_PACKED_SNAPSHOT_BYTES = 900_000


def pack_snapshot(snapshot):
    return zlib.compress(json.dumps(snapshot, default=str, separators=(",", ":")).encode("utf-8"), 6)


def snapshot_fits(snapshot):
    return len(pack_snapshot(snapshot)) <= MAX_PACKED_SNAPSHOT_BYTES


def to_stored(record):
    if SNAPSHOT_FIELD not in record:
        return record
    stored = dict(record)
    stored[PACKED_SNAPSHOT_FIELD] = pack_snapshot(stored.pop(SNAPSHOT_FIELD))
    return stored


def from_stored(record):
    if PACKED_SNAPSHOT_FIELD not in record:
        return record
    loaded = dict(record)
    loaded[SNAPSHOT_FIELD] = json.loads(zlib.decompress(loaded.pop(PACKED_SNAPSHOT_FIELD)).decode("utf-8"))
    return loaded


def apply_transition(current, update, *, expected_status=None):
    """Validate one state change against `current` and return the new record."""
    destination = update["status"]
    allowed = [source for source, targets in TRANSITIONS.items() if destination in targets]
    if expected_status is not None and current.get("status") != expected_status:
        raise InvalidJobTransition("Job changed before the conditional transition")
    if current.get("status", "") not in allowed:
        raise InvalidJobTransition(f"Cannot transition {current.get('status', '')} to {destination}")
    return {**current, **update, "revision": int(current.get("revision", 0)) + 1}


def transition_firestore(ref, transactional, transaction, seed, update, *, expected_status=None, extra=None):
    """Check and write one export state change inside a Firestore transaction.

    Firestore retries the transaction on contention, so two writers can never
    both win: a stale API or worker cannot resurrect a cancelled job or
    overwrite a terminal result. `seed` is used only when no record exists yet.
    """
    @transactional
    def run(txn):
        snapshot = ref.get(transaction=txn)
        current = from_stored(snapshot.to_dict() or {}) if snapshot.exists else dict(seed or {})
        result = apply_transition(current, update, expected_status=expected_status)
        txn.set(ref, to_stored({**result, **(extra or {})}))
        return result

    return run(transaction)


def transition(client, job_id, seed, update, *, expected_status=None):
    if client is not None:
        # Serialize in Python: Redis cjson turns empty JSON arrays into objects,
        # which would corrupt captions/word arrays in replay snapshots.
        for _ in range(8):
            raw = client.get(f"export_job:{job_id}")
            current = json.loads(raw) if raw else seed
            result = apply_transition(current, update, expected_status=expected_status)
            if client.eval(TRANSITION_SCRIPT, 1, f"export_job:{job_id}", raw or "",
                           json.dumps(result, default=str), 7 * 86400):
                return result
        raise RuntimeError("Export state is busy; retry the operation")
    return apply_transition(seed, update, expected_status=expected_status)
