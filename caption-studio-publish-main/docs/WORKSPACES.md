# Team workspaces

Workspaces use separate user identities—customers must not share one login.
Owners and admins can create seven-day, email-bound invite tokens from Account.
Members can open the workspace selector in Dashboard and edit shared projects.

Shared saves use optimistic revisions. When two people save the same revision,
the later write receives `409` and must reload instead of silently overwriting
the first editor. Source media remains owned by its uploader; workspace access
produces a short-lived signed media URL and does not transfer storage ownership.

An account cannot be deleted while it owns a workspace. Ownership must first be
transferred or the workspace deliberately removed, preventing orphaned teams.
Real-time cursors and simultaneous character-level merging remain out of scope.
