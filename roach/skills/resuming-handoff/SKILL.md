---
name: resuming-handoff
description: Use when resuming work from a handoff document, given its path or a domain name
---

# Resume Work From a Handoff

Pick up where a previous session stopped: load the handoff, check it against the code as it is now, and continue. The handoff describes the past; the repo and the ledger describe the present, and the present wins.

## 1. Find the handoff

- **Path given:** use it.
- **Domain given:** list `thoughts/shared/handoffs/<domain>/` and take the most recent file by its `YYYY-MM-DD_HH-MM-SS` name. If the directory is missing or empty, ask for the path.
- **Nothing given:** list `thoughts/shared/handoffs/` and ask which one to resume.

## 2. Load context

Read yourself, in full: the handoff, then the plan, spec and research documents it links under `thoughts/shared/`. These set direction, so a subagent's summary isn't enough. Then read the key files it names. Older handoffs use different section names (Task(s), Recent Changes, Action Items) — read them the same way.

## 3. Check the present against the handoff

- `git status` and `git log --oneline` since the handoff's `git_commit`: are the described changes there? Has anything landed since?
- If a plan is being executed, read `<plan>.tasks.json` and reconcile it with `git log`. Tasks marked `completed` are done — their commits exist — and are never redone. Rulings and deferred findings stay as recorded.
- Are the in-flight edits the handoff describes still in the working tree?
- Do the files and `file:line` references in Learnings still match?

## 4. Continue

**A plan is mid-execution and the check is clean:** resume it with the executor the user already chose (executing-plans or subagent-driven-development), at the first task not completed — or, for subagent-driven work, at the recorded fix round. Don't ask again; the user made that choice when execution started. Say in one line where you're resuming, then work.

**Otherwise,** present a short summary — where things stand, what changed since the handoff, the next steps you'll take — and ask before starting only if:
- the handoff lists open questions that block the next step,
- the code contradicts the handoff (changes missing, unexpected commits, references that no longer match), or
- there's no plan and the next step is a real choice between directions.

If none of those apply, state the next step and start it.

Throughout, apply the handoff's Learnings — they record mistakes already paid for. When stopping again, write a new handoff with create-handoff.
