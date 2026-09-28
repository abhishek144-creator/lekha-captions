# Batch exports

Authenticated product clients can submit 1–10 normal export payloads in one
request:

```http
POST /api/batch/exports
Content-Type: application/json

{
  "id_token": "FIREBASE_ID_TOKEN",
  "idempotency_key": "customer-generated-stable-key",
  "exports": [
    { "file_id": "...", "captions": [{ "text": "Hello", "start_time": 0, "end_time": 1 }], "quality": "1080p", "fps": 30 }
  ]
}
```

Every item passes the same ownership, malware-state, predicted-work admission,
tiered queue, plan, credit, render, and persistence checks as `/api/export`.
The account concurrency lock serializes items for one customer. A partial
admission returns accepted jobs plus rejected item reasons; replaying the same
idempotency key returns the original batch.

Poll `GET /api/batch/exports/{batch_id}` with the Firebase bearer token for
per-item terminal status.
