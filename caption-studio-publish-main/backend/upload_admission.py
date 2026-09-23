"""Atomic, per-account limits for direct Cloud Storage upload sessions."""

import hashlib
import time

from fastapi import HTTPException


_RESERVE_SCRIPT = """
local now = tonumber(ARGV[1])
local expired = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now)
if #expired > 0 then
    redis.call('ZREM', KEYS[1], unpack(expired))
    redis.call('HDEL', KEYS[2], unpack(expired))
end
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now - 3600)
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[4]) then return 1 end
local outstanding = 0
for _, id in ipairs(redis.call('ZRANGE', KEYS[1], 0, -1)) do
    outstanding = outstanding + tonumber(redis.call('HGET', KEYS[2], id) or '0')
end
if outstanding + tonumber(ARGV[3]) > tonumber(ARGV[5]) then return 2 end
if redis.call('ZCARD', KEYS[3]) >= tonumber(ARGV[6]) then return 3 end
redis.call('ZADD', KEYS[1], now + tonumber(ARGV[7]), ARGV[2])
redis.call('HSET', KEYS[2], ARGV[2], ARGV[3])
redis.call('ZADD', KEYS[3], now, ARGV[2])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[7]) + 60)
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[7]) + 60)
redis.call('EXPIRE', KEYS[3], 3660)
return 0
"""

_RELEASE_SCRIPT = """
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[2], ARGV[1])
if ARGV[2] == '1' then redis.call('ZREM', KEYS[3], ARGV[1]) end
return 1
"""


def _keys(uid):
    account = hashlib.sha256(uid.encode("utf-8")).hexdigest()
    prefix = f"direct_upload:{account}"
    return (f"{prefix}:active", f"{prefix}:sizes", f"{prefix}:hourly")


def reserve_upload(client, uid, file_id, size_bytes, *, max_active=2,
                   max_outstanding_bytes=1_073_741_824, max_hourly=12,
                   ttl_seconds=6 * 3600, now=None):
    """Reserve capacity before issuing a bearer session URI; fail closed on Redis errors."""
    if client is None:
        raise HTTPException(503, "Upload admission is temporarily unavailable")
    timestamp = int(time.time() if now is None else now)
    try:
        outcome = int(client.eval(
            _RESERVE_SCRIPT, 3, *_keys(uid), timestamp, file_id, int(size_bytes),
            int(max_active), int(max_outstanding_bytes), int(max_hourly), int(ttl_seconds),
        ))
    except Exception as exc:
        raise HTTPException(503, "Upload admission is temporarily unavailable") from exc
    if outcome:
        messages = {
            1: "Too many active uploads for this account",
            2: "Active upload bytes exceed the account limit",
            3: "Too many uploads started in the last hour",
        }
        raise HTTPException(429, messages.get(outcome, "Upload capacity is temporarily full"),
                            headers={"Retry-After": "60"})


def release_upload(client, uid, file_id, *, undo_hourly=False):
    if client is None:
        return
    client.eval(_RELEASE_SCRIPT, 3, *_keys(uid), file_id, "1" if undo_hourly else "0")
