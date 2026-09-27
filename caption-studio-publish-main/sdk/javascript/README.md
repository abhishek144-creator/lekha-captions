# Lekha JavaScript SDK

Create a revocable key from `POST /api/developer/api-keys`. The secret is shown
once and stored by the service only as a SHA-256 digest.

```js
import { LekhaClient } from '@lekha-captions/sdk'

const lekha = new LekhaClient({ apiKey: process.env.LEKHA_API_KEY })
const projects = await lekha.listProjects()
const exportJob = await lekha.getExport('export-job-id')
```

The first public release is intentionally read-only. Keys have explicit
`projects:read` and `exports:read` scopes, per-key hourly limits, revocation,
and owner checks on every resource. Batch writes use the authenticated product
endpoint until a write-scoped public contract is versioned.
