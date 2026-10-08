---
name: create-handoff
description: Use when context is getting long, before pausing or ending a work session, or when transferring ongoing work to a new session — prefer this over auto-compacting, and write it before context fills up.
---

# Create Handoff

Write a document that lets a fresh session pick up exactly where this one stops. A handoff keeps structure and file references that auto-compaction loses, so write one when work is pausing or the session is getting long — not after context has run out.

## 1. Path and metadata

- Domain from the task context (e.g. `accrual`, `kpi`, `general`).
- Path: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- Metadata: `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec_metadata.js` (date, branch, commit, repository).

## 2. Write the document

If a plan is being executed, its `<plan>.tasks.json` already records task status, commit ranges, rulings and deferred findings. Point to it instead of restating it; the handoff carries what the ledger can't.

```markdown
---
date: [ISO datetime with timezone]
researcher: [your name or "claude"]
git_commit: [current commit hash]
branch: [current branch]
repository: [repo name]
topic: "[Feature/Task] Implementation Strategy"
tags: [implementation, strategy, component-names]
status: complete
last_updated: [YYYY-MM-DD]
last_updated_by: [researcher name]
type: implementation_strategy
---

# Handoff: {concise description}

## Where Things Stand
{The goal in a sentence or two. If a plan is running: plan path, `.tasks.json` path,
and the current task. Otherwise: tasks with status.}

## In-Flight Work
{Anything not yet committed or not yet recorded in the ledger: uncommitted edits,
a half-finished task, a review whose findings aren't addressed yet. Write "none" if clean.}

## Open Questions
{Decisions still waiting on the user, with the options and your recommendation.
Write "none" if there are none.}

## Learnings
{Root causes, gotchas, patterns that worked or didn't — with file:line references.}

## Key References
{Spec, research doc, and the 2-5 files the next session should read first.}

## Next Steps
{What to do next, in order.}
```

Prefer `file:line` references over code blocks; include code only for a specific error being debugged.

## 3. Confirm

Reply with:

```
Handoff created. Resume in a new session with:

/roach:resuming-handoff path/to/handoff.md
```
