# Public Repository History Rewrite Evidence — 3 September 2026

## Outcome

- The repository owner explicitly chose to keep the repository public and
  authorized the coordinated history rewrite.
- A verified offline recovery bundle was created before rewriting any public
  ref. It is retained outside the repository and must never be pushed.
- All 24 public branches were rewritten and force-updated. The repository had
  no public tags to rewrite.
- Non-approved email addresses were replaced in text blobs and author/committer
  metadata. Binary blobs were excluded and a tree-hash equality check confirmed
  that the active release files were byte-for-byte unchanged by the rewrite.
- A fresh clone of the rewritten public refs passed the repository privacy
  audit with zero current findings and zero historical findings.
- Collaborators must re-clone instead of merging or pushing from a pre-rewrite
  clone, because doing so could republish the removed history.

## Verification

- Approved visibility: `public_rewritten`
- Public branches updated: `24`
- Public tags updated: `0`
- Rewritten revisions initially audited: `94`
- Current automated gate: `npm run privacy:audit`
- Decision record: `docs/REPOSITORY_PRIVACY_DECISION.json`

The recovery bundle contains the removed identifiers and is therefore private
operational evidence. It is not a release artifact and must be access-limited.
