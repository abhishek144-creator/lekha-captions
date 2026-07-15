# Data Processing Inventory

| System | Data | Purpose | Retention | Legal basis / control |
|---|---|---|---|---|
| Firebase Authentication | UID, email, name, avatar, login metadata | Account authentication | Account lifetime; authentication-provider policy may also apply | Contract; account deletion endpoint |
| Firestore `users` | Profile, tier, credits, short export history, consent versions | Account and entitlement operation | Account lifetime, except legally required records | Contract and consent; export/delete endpoints |
| Firestore payment records | Razorpay IDs, plan, amount, currency, timestamps | Billing, reconciliation, fraud and accounting | Required accounting/legal period | Contract and legal obligation |
| Firebase Storage `uploads/` | Uploaded source media | Transcription and rendering | Scheduled deletion within 6 hours | Contract; signed access only |
| Firebase Storage `exports/` | Rendered videos | Customer download | 2–72 hours by plan | Contract; signed access only |
| Redis | Rate limits, idempotency, queue/job state, temporary upload metadata | Reliability and abuse prevention | Key TTLs of hours to days | Legitimate interest/security |
| OpenAI | Audio and caption text | Transcription, language detection, translation | Provider agreement and configured provider policy | Contract; data minimization |
| Sarvam | Audio for supported Indic languages | Transcription | Provider agreement and configured provider policy | Contract; data minimization |
| Razorpay | Payment and transaction details | Payment processing | Provider and legal retention requirements | Contract and legal obligation |
| Operational telemetry | Request IDs, route latency, bounded event metadata | Reliability and security | Bounded collection TTLs | Legitimate interest/security |

Do not add a new datastore, provider, or telemetry field without updating this inventory, the public privacy policy, and the deletion/export paths.
