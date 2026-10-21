# Public repository cleanup — 21 October 2026

GitHub readback reports `PUBLIC`, with repository `updated_at`
`2026-10-21T13:36:58Z`. That field does not establish which setting changed at
that instant or who changed it. The preceding local privacy audit passed under
the September **private** visibility decision; that is not public-history clearance.
The owner now explicitly chose **“Keep public; report cleanup.”** Visibility was
not changed. No rewrite, branch/tag deletion, force-push or other publication is
authorized by that response. The later instruction to fix and push all branches
lifts the ordinary no-push hold. An isolated local cleanup can be prepared for
review; replacing published history and force-updating refs require explicit approval.

## Fresh public-only audit

The receipt uses the 26 heads/tags actually advertised by GitHub, excluding the
unpublished local candidate and working tree. It inspected 468 reachable
revisions. Findings are counts and fingerprints; no raw personal address or
suspected secret is reproduced here.

| Category | Occurrences | Distinct fingerprints | Scope |
| --- | --- | --- | --- |
| Email-like file content | 725 | 17 | 14 paths across 272 revisions |
| Author email metadata | 104 | 3 | 104 commit records |
| High-confidence secret patterns | 0 | 0 | Limited to the audit's supported key/token patterns |

The total is **829 occurrences**, not 829 people or distinct secrets. Some
matches are synthetic test identities; classify them before choosing a redaction
map. No detected secret pattern does not prove that every credential format is
absent. Historical author metadata cannot be removed by editing current files.

Masked evidence stays in the outer `.readiness/` directory:
`external-review-20261021-public-refs.txt`,
`external-review-20261021-public-history.json` and its `.log`.
The decision file now targets `public_rewritten`; the privacy gate must fail
until current and published historical findings are zero. Do not restore the
private-only setting merely to make a public release pass.

## Reviewable cleanup sequence, pending separate authorization

1. Preserve a private local mirror and an exact inventory of public heads,
   tags, pull-request references and source/release attachments. Preserve the
   working candidate and existing production rollback receipts separately.
2. Classify the 17 file-content fingerprints and three author fingerprints.
   Prepare a minimal replacement map for genuine operator addresses and unsafe
   real-domain fixture identities; retain useful tests and use allowed synthetic
   domains or the correct GitHub noreply attribution. Review the map privately.
3. Produce the rewritten history in an isolated local mirror. Verify every
   published ref, a zero-finding public audit and source-tree equivalence apart
   from intended redactions. Re-run only checks affected by the redactions.
4. Coordinate collaborators, deployment source pins and rollback references.
   Obtain explicit approval for the disruptive history rewrite and force-updates,
   and lift the no-push hold for that operation. No GitHub or deployment changes
   are included in the current local fixes.
5. Update all approved public heads/tags together, verify the advertised tips
   and re-audit a fresh clone. Check pull-request cached views and source/release
   attachments; request GitHub assistance where cached references cannot be
   removed through ordinary ref updates. Existing clones/forks/copies cannot be
   guaranteed to disappear. Collaborators must replace their old clones safely.
6. Prepare new release identities after the final rewritten candidate exists.
   A history rewrite changes commit IDs; do not reuse an old frontend/image
   manifest or imply that a Git history update validates running production.

No confirmed credential exposure was established by this scan. If classification
finds a credential, revoke/rotate it using a separately scoped action; deleting
the text or rewriting Git history alone does not revoke a credential.
