# Lekha Captions — Codex Project Context

This repository is shared between Claude Code and Codex. The active Git
worktree is the source of truth: committed and uncommitted changes made by
either assistant are immediately shared. Never discard or overwrite an existing
dirty change unless the user explicitly asks for that exact operation.

## Session startup

Before changing project files:

1. Read `CLAUDE.md` completely. Its architecture notes, commands, conventions,
   and known-fixed-bug list apply equally to Codex.
2. Read `DEVELOPMENT_LOG.md` completely. It is the cross-assistant work diary
   and contains the current TODO list and recent implementation context.
3. Run `git status --short` and inspect relevant existing diffs. Work with those
   changes in place; do not assume they are stale or invisible.

## Shared handoff rule

When the user asks to update the project log or hand work between Claude and
Codex, append one dated entry to `DEVELOPMENT_LOG.md` describing the durable
behavior changes, files touched, verification run, and remaining known failures.
Keep `CLAUDE.md` and this file stable; session-by-session details belong in the
development log.

## Project location

Run frontend commands from this directory. Run backend commands from
`backend/`. The outer repository directory contains this app as a nested folder,
so Git paths appear prefixed with `caption-studio-publish-main/` when commands
are run from the outer root.
