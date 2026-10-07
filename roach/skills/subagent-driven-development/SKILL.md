---
name: subagent-driven-development
description: Use when executing an implementation plan in this session with a fresh subagent per task — the user chose subagent-driven execution, or wants a review gate on every task
---

# Subagent-Driven Development

You are the controller. A fresh implementer subagent does each task, a fresh reviewer checks it, and one review covers the whole branch at the end. You coordinate: write briefs, dispatch, read verdicts, keep the ledger. You never edit code yourself — your context stays clean for coordination, and controller fixes skip review.

**Announce at start:** "I'm using subagent-driven-development to execute this plan."

Don't enter plan mode — it blocks the Write/Edit tools you need for briefs and the ledger.

## Keep Going

Run every task before ending your turn. The user picked this mode to get the plan done; progress lives in `.tasks.json` and git. None of these is a reason to stop:
- A task or milestone is done, or the turn has grown long
- You want to show progress or ask whether to continue
- You've decided the next step — run it instead of announcing it
- A decision that doesn't block the remaining work — make it and record a ruling

Stop and ask only for:
- An irreversible or destructive operation outside what the plan specifies
- A side effect beyond the working tree that people normally ask about first: push to a shared branch, merge, publish, deploy
- A security-sensitive action the plan doesn't cover
- A failure whose only way past is weakening, skipping or deleting an existing test
- A change that would break the plan's Global Constraints
- A plan so broken that every way forward is a guess

## Rulings

Conflicts, ambiguities, plan defects, an implementer's cross-task question, a finding the plan mandates — decide them, with the spec as the authority and the plan as its argument. Append each to the `rulings` array in `.tasks.json` and carry it into every later dispatch it affects:

```json
{"task": 3, "ruling": "use the existing DateRange type instead of a new Period", "why": "src/time/range.ts:12 already models it", "costIfWrong": "one type swap"}
```

A wrong ruling costs rework the user can see and undo; a run parked on a question costs their whole day.

Routine choices the plan leaves open — commit wording, placing code by existing conventions, a test file's name — need no ruling. Keep the list to decisions the user would want to check.

## Setup

1. Never start on main/master without the user's explicit consent.
2. Read the plan once, and the spec if its header names one. Note the Global Constraints.
3. Load `<plan-path>.tasks.json`. Tasks marked `completed` are done — their commits exist even if you don't remember making them. Reconcile with `git log --oneline` and resume at the first task not completed; never re-dispatch a completed task. Mirror the tasks with TaskCreate for a live view.
4. Scratch space is `thoughts/.sdd/<plan-basename>/` — briefs, reports and review packages for this plan only. Add `thoughts/.sdd/` to `.git/info/exclude` so it can't be committed by accident.
5. **Pre-flight scan.** Where a task consumes what an earlier task produces, compare the Interfaces blocks. Check each task's tests against its own code steps, and anything the plan mandates that the reviewer would flag as a defect (a test that asserts nothing, duplicated logic). Rule on every conflict before Task 1.

## Model Selection

Specify the model on every dispatch — an omitted model inherits the session's, usually the most expensive. Pick the least capable model that does the job in few turns; cheap models often take 2-3× the turns on multi-step work and cost more overall.

| Role | Model |
|---|---|
| Implementer: brief carries complete code (transcription plus tests) | cheapest |
| Implementer: signatures and tests given, or multi-file integration | standard |
| Implementer: design judgment or broad codebase understanding | most capable |
| Single-file mechanical fix | cheapest |
| Task reviewer | standard floor; most capable for subtle or risky diffs |
| Scoped re-review of a small fix | cheapest to standard |
| Fix rounds 4-5 | one tier above the implementer that got stuck |
| Final whole-branch review | most capable |

## Per Task

Everything you paste into a dispatch, and everything a subagent prints back, stays in your context for the rest of the run. Move bulk text as files.

**Batch small same-shape work.** Several tasks that are each the same small edit across files (a one-line fix, a constant, a field) go to one subagent in one brief, reviewed as one diff.

### 1. Dispatch the implementer

- Record BASE: `git rev-parse HEAD`.
- Write the task's full text from the plan, including its **Reuse:** line, to `task-N-brief.md`.
- Dispatch with [implementer-prompt.md](implementer-prompt.md). The prompt carries only: one line on where the task fits; the brief path ("read this first — it is your requirements, exact values verbatim"); interfaces, decisions and rulings from earlier tasks that the brief can't know; the report path. Never paste prior-task history or make the subagent read the whole plan.
- Note the implementer's agent ID; fix rounds 1-3 resume it.
- One implementer at a time — parallel implementers conflict.

### 2. Handle the status

- **DONE** → review.
- **DONE_WITH_CONCERNS** → read the concerns. Correctness or scope doubts get resolved (a ruling, more context) before review; observations go to review as-is.
- **NEEDS_CONTEXT** → supply it, or rule on the question, and resume the implementer.
- **BLOCKED** → change something: more context, a more capable model, a smaller task, or a ruling that corrects the plan. Never retry unchanged.

### 3. Review

- Write the review package to `task-N-review.md`: `git log --oneline BASE..HEAD`, `git diff --stat BASE..HEAD`, `git diff -U10 BASE..HEAD`. Use the recorded BASE, never `HEAD~1` — it drops all but the last commit of a multi-commit task.
- Dispatch [task-reviewer-prompt.md](task-reviewer-prompt.md) with the brief, report and package paths, plus the Global Constraints copied verbatim — exact values, formats, stated relationships. That block is the reviewer's attention lens.
- Don't pre-judge. If your prompt says "don't flag", "at most Minor" or "the plan chose it", you are trying to skip a fix loop; let the reviewer raise it.
- The reviewer may list "⚠️ cannot verify from diff" items. Check each yourself — you hold the cross-task context. A confirmed gap counts as a failed review.

### 4. Fix loop

Triggers: spec ❌, any Critical or Important finding, or a confirmed ⚠️ gap. Before it starts:
- **Minor findings** go to the `deferred` array in `.tasks.json`; they never enter the loop.
- **Findings that conflict with the plan's text** get a ruling first; then fix per the ruling.

A round is one fix plus one scoped re-review. At most five rounds per task:
- **Rounds 1-3:** resume the original implementer (SendMessage) with the open findings verbatim. If it can't be resumed, dispatch a fresh one with the brief, report and findings — the report file carries the memory.
- **Rounds 4-5:** a fresh implementer one model tier up, framed as "a prior implementer tried this N times; you own it now — read the report file." A loop that survives three resumes usually means the implementer can't see its own problem.
- Each round, the implementer re-runs the covering tests and appends a fix report. Confirm it names the tests, command and output, then write a package for FIX_BASE..HEAD (FIX_BASE = the head the last review saw) and dispatch [re-review-prompt.md](re-review-prompt.md). New Critical/Important breakage in the fix joins the open list; out-of-scope observations go to `deferred`.

**At the cap,** adjudicate each open finding:
- Wrong or contestable, or real but nothing builds on it → add to `deferred` with a ruling on why the code stands.
- Real and load-bearing (a later task builds on it, or it reveals a plan defect) → rule on the smallest change that unblocks dependent work and carry it into the next dispatch.

Adjudicate only at the cap; doing it earlier to end a loop is pre-judging.

### 5. Complete the task

In `.tasks.json`, in one write: status `completed`, `"commits": "<base7>..<head7>"`, `lastUpdated`. Mark the TaskUpdate complete and move on. Never advance with open Critical/Important findings that are neither fixed nor ruled on at the cap.

## Final Review

1. Run the project's full test command yourself and read the totals — implementer reports are claims until you've watched the suite pass.
2. Invoke requesting-code-review over the whole branch with explicit arguments, pointing it at the rulings and deferred items so it can triage what must be fixed before merge:
   ```
   Skill("requesting-code-review", "<MERGE_BASE> <HEAD> 'what was built; rulings and deferred findings in <plan>.tasks.json' '<plan path> <spec path>'")
   ```
   MERGE_BASE is `git merge-base main HEAD`.
3. On findings, dispatch ONE fix subagent with the complete list — per-finding fixers each rebuild context and re-run suites. Then one scoped re-review of the fix range. Adjudicate what remains as at the cap. There is no second fix wave.

## Finish

End with:
- What was built and the final test-suite result
- **Rulings I made** — every ruling in `.tasks.json`, with its cost if wrong
- **Deferred findings** — with whether the final review cleared them
- Anything blocked: what you left out and why

Delete `thoughts/.sdd/<plan-basename>/`; git history is the record now. Then ask whether to push, open a PR, or keep going.

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "I'll fix it myself, dispatching is overhead" | Controller fixes pollute your context and skip review. Resume the implementer. |
| "Close enough on spec compliance" | A spec gap means not done. Fix it, or reach the cap and adjudicate. |
| "One more round will converge" | Past five rounds the failure is structural. Adjudicate. |
| "This finding is obviously wrong, I'll drop it" | Adjudicate only at the cap, and every adjudication is recorded. |
| "The fix was small, skip the re-review" | Unreviewed fixes are how regressions land. |
| "The ledger can wait a few tasks" | Compaction doesn't wait. Update `.tasks.json` with each completion. |
| "The implementer spawned its own reviewer — extra assurance" | It duplicated the task review at full cost. Flag it as a defect. |

## Related Skills

- **writing-plans** — produces the plan and `.tasks.json`
- **executing-plans** — inline alternative: one context, one final review; cheaper when tasks are simple or few
- **requesting-code-review** — the final whole-branch review
- **test-driven-development** — implementers follow it on every task
