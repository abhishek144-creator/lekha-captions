# Essential customer safeguards — 7 September 2026

Scope follows `CONTROLLED_LAUNCH_SCOPE.md`. Pentest/CA engagements, enterprise capabilities and high-traffic expansion remain deferred.

## Confirmed defect fixed

A transcription waiting behind other jobs was enqueued again every 30 seconds. After ten dispatch attempts it could be failed even though a healthy RQ delivery still waited for a worker. This could affect the existing small launch capacity, so it is a reliability fix rather than a scaling feature.

The outbox now records the RQ delivery ID. The dispatcher checks that delivery and leaves queued/started/deferred/scheduled work alone. A lost delivery can be submitted again while the durable intent remains unclaimed; a Redis probe failure does not trigger blind resubmission. Exhausted delivery attempts only fail a still-queued intent transactionally, so a concurrent worker claim cannot be overwritten. Existing durable claims still prevent repeated paid provider calls.

## Verification

- A negative-control regression reproduced the old behavior: an ordinary queue wait became failed.
- All 159 backend tests passed, including four added cases for healthy waiting, lost delivery, failed queue probes and a concurrent claim at the retry limit. Existing payment, ownership/deletion, media validation, durable-result and draft-conflict coverage remains included.
- A disposable staging exercise used real Firestore transactions and a dedicated Redis queue with no worker listening. Twenty-one dispatcher passes over a simulated ten-minute wait left one delivery and a queued intent. Deleting that delivery allowed recovery on the next pass. The queue and disposable documents were removed; no paid provider was called.
- Public DNS checks passed through Google and Cloudflare for marketing, editor and API. API liveness, readiness, version and service-status probes passed.
- Existing production-configured browser evidence covers 60 automated cases, plus 15 final live home/login/support cases. No frontend behavior changed in this fix.

The other essential areas already have implemented safeguards and earlier evidence: payment/credit verification and owner-confirmed payment/refund lifecycle; cloud draft persistence and recovery; authenticated account/media ownership and deletion; core mobile/desktop browser checks; basic alerts, support and recovery procedures. Keep those evidence dates explicit. This follow-up did not perform another real checkout, customer-device acceptance session or full backup restore, and does not claim independent assurance.
