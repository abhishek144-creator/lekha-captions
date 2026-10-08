# Previous local commit classification

> Historical classification recorded on 4 October 2026. The carry-forward
> work was subsequently integrated into reviewed main and further refactored.
> The status statements below describe that earlier point, not current source
> or production. See `MONTHLY_GITHUB_SYNC_2026-10-08.md` for the current inventory.

Compared the preserved `codex/repository-privacy-cleanup` branch with merged Railway main. No commits from that branch have been pushed. Railway worker, cron, R2 upload and Docker behavior takes precedence during any carry-forward.

| Commit | Classification | Action |
|---|---|---|
| f164d21 | (a) Dependency vulnerability patch | Already present in main: brace-expansion 1.1.21. Skip an empty duplicate. |
| 4a72873 | (a) Caption tooltip state fix | Carry forward. |
| 70261c3 | (a) Account-isolated undo/redo history | Carry forward with its regression check. |
| a28a433 | (a) Starter quota/pricing consistency | Carry forward; check against the current plan catalog. |
| 9bee63c | (b) GCP on-demand redesign | Drop the commit. Do not reintroduce Cloud Run Jobs, GCP infrastructure or its worker/Docker changes. Neutral guards must be considered separately if still missing. |
| 6d3270c | (b) Cloud Run frontend/deployment integration | Drop. The Railway API/Netlify cutover replaces it. |
| f5832f0 | (a) Parallel Chromium template frame capture | Carry forward; verify inside the existing Railway CPU/RAM caps. |
| 56fed38 | (a) Transactional Firestore export state | Carry forward; retain current R2 and Railway enqueue behavior. |
| c0a8238 | (a) Template display names | Carry forward. |
| d657734 | (a) Editor template-application extraction | Carry forward. |
| 48ba4f3 | (a) Scale-to-zero/budget launch evidence | Carry forward the platform-neutral requirements; replace obsolete GCP setup references with Railway. |
| e34efbc | (a) Export pipeline extraction | Carry forward; preserve current main behavior and RQ import paths. |
| 4a9cf0d | (a) Font table extraction | Carry forward. |
| f4c6c69 | (a) Stateless VideoPlayer rendering helpers | Carry forward remaining changes; the helper module already exists in main. |
| a8f1ef8 | (a) File-split diary | Carry forward relevant history only after the corresponding extractions are actually restored. |

The isolated carry-forward branch and cherry-picks remain separate from the production cutover. They have not yet been prepared or pushed; none of these changes is included in the deployed Railway/Netlify release.
