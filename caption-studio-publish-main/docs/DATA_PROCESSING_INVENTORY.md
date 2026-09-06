# Data Processing Inventory

| System | Data | Purpose | Retention | Legal basis / control |
|---|---|---|---|---|
| Firebase Authentication | UID, email, name, avatar, login metadata | Account authentication | Account lifetime; authentication-provider policy may also apply | Contract; account deletion endpoint |
| Firestore `users` | Profile, tier, credits, short export history, consent versions | Account and entitlement operation | Account lifetime, except legally required records | Contract and consent; export/delete endpoints |
| Firestore payment records | Razorpay IDs, plan, amount, currency, timestamps | Billing, reconciliation, fraud and accounting | Required accounting/legal period | Contract and legal obligation |
| Firebase Storage `uploads/` | Uploaded source media | Transcription and rendering | Scheduled deletion within 6 hours | Contract; signed access only |
| Firebase Storage `exports/` | Rendered videos | Customer download | 2–72 hours by plan | Contract; signed access only |
| Redis | Rate limits, idempotency, queue/job state, temporary upload metadata | Reliability and abuse prevention | Key TTLs of hours to days | Legitimate interest/security |
| Firestore `account_deletions` | UID document key, pending status and request timestamp | Prevent delayed jobs, uploads, bootstrap and payment events from recreating deleted accounts | No automatic expiry in this revision; retention review required before release | Restricted server access; retained outside user subtree; authenticated account export includes the record while the Auth identity exists, subsequent requests through support |
| Browser local storage | Owner-tagged caption draft, timing/styles and media references | Local editor restore/autosave | Until replaced, cleared or removed by account/logout flows | Device-local cache; not a cloud backup or cross-device project store |
| Firestore user `drafts` / `draft_revisions` | Captions, canonical style state, source ID and revision | Cross-device draft saving and recovery | Latest draft and five rotating snapshots until account deletion | Authenticated server access, optimistic conflict check, included in account export; media URLs excluded |
| Firestore user `transcription_jobs` / `operation_locks` | Settings, job state, result captions and operation ownership | Durable admission/result recovery and duplicate suppression | Seven-day job expiry field; locks hold only latest operation metadata until account deletion | Account-owned subtree, deletion fence and transaction claim; expiry policy must be deployed |
| Firestore transcription outbox | Environment-scoped dispatch pointer, UID/job ID, dispatch attempts | Recover queue delivery after API/Redis interruption | Removed on terminal completion/reconciliation | No media or caption payload; staging dispatch namespace separated |
| Configured S3-compatible media backend | Source and rendered media, object metadata | Alternative to Firebase object storage | Same application expiry intent; actual bucket lifecycle requires verification | Private backend credentials and signed access; provider/location must be recorded in release configuration |
| OpenAI | Audio and caption text | Transcription, language detection, translation | Provider agreement and configured provider policy | Contract; data minimization |
| Sarvam | Audio for supported Indic languages | Transcription | Provider agreement and configured provider policy | Contract; data minimization |
| Razorpay | Payment and transaction details | Payment processing | Provider and legal retention requirements | Contract and legal obligation |
| Operational telemetry | Request IDs, route latency, bounded event metadata | Reliability and security | Bounded collection TTLs | Legitimate interest/security |

Do not add a new datastore, provider, or telemetry field without updating this inventory, the public privacy policy, and the deletion/export paths.
