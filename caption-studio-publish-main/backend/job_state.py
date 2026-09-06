"""Export state transitions. Redis is authoritative while the queue is enabled."""
import json
import threading

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


def transition(client, job_id, seed, update):
    destination = update["status"]
    allowed = [source for source, targets in TRANSITIONS.items() if destination in targets]
    if client is not None:
        # Serialize in Python: Redis cjson turns empty JSON arrays into objects,
        # which would corrupt captions/word arrays in replay snapshots.
        for _ in range(8):
            raw = client.get(f"export_job:{job_id}")
            current = json.loads(raw) if raw else seed
            if current.get("status", "") not in allowed:
                raise InvalidJobTransition(f"Cannot transition {current.get('status', '')} to {destination}")
            result = {**current, **update, "revision": int(current.get("revision", 0)) + 1}
            if client.eval(TRANSITION_SCRIPT, 1, f"export_job:{job_id}", raw or "",
                           json.dumps(result, default=str), 7 * 86400):
                return result
        raise RuntimeError("Export state is busy; retry the operation")
    if seed.get("status", "") not in allowed:
        raise InvalidJobTransition(f"Cannot transition {seed.get('status', '')} to {destination}")
    return {**seed, **update, "revision": int(seed.get("revision", 0)) + 1}
