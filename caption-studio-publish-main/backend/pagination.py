"""Bound Firestore collection reads and keep cursors inside the owned collection."""
from fastapi import HTTPException


def collection_page(collection, limit: int, cursor: str, order_field: str):
    if not 1 <= limit <= 100:
        raise HTTPException(422, "Page size must be between 1 and 100")
    query = collection.order_by(order_field, direction="DESCENDING")
    if cursor:
        if len(cursor) > 200 or "/" in cursor or "\\" in cursor or cursor in {".", ".."}:
            raise HTTPException(400, "Invalid page cursor")
        snapshot = collection.document(cursor).get()
        if not snapshot.exists:
            raise HTTPException(400, "Page cursor is no longer available")
        query = query.start_after(snapshot)
    snapshots = list(query.limit(limit + 1).stream())
    more = len(snapshots) > limit
    return snapshots[:limit], {
        "has_more": more,
        "next_cursor": snapshots[limit - 1].id if more else None,
    }
