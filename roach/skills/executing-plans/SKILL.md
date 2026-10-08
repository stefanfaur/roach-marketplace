---
name: executing-plans
description: Use when implementing a written plan task by task, in this session or a new one
---

# Executing Plans

Implement the plan yourself, first task to last, without pausing for check-ins. Then get one fresh review of the whole branch.

The user picked this mode to get the plan done. A "should I continue?" pause costs them a round-trip and buys nothing: progress lives in `.tasks.json` and git, and the final review is the second pair of eyes.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

Don't enter plan mode — it blocks the Write/Edit tools this skill needs.

## Keep Going

Finish every task before ending your turn. None of these is a reason to stop:
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

If one task is blocked, finish every task that doesn't depend on it, then report the block.

## Setup

1. Never start on main/master without the user's explicit consent.
2. Read the plan once, and the spec if its header names one. Where they conflict, the spec wins.
3. Load progress from `<plan-path>.tasks.json`:
   - **Found:** tasks marked `completed` are done; their commits exist even if you don't remember making them. Reconcile with `git log --oneline` and resume at the first task not completed.
   - **Missing:** create it from the plan's task headers (format in writing-plans).
   - Mirror the tasks with TaskCreate (restore `blockedBy`) for a live view. The JSON is the record that survives compaction.
4. Check the Interfaces blocks once: where a task consumes what an earlier task produces, confirm names and types match. Settle mismatches as rulings before Task 1.

## Per Task

1. Mark it `in_progress` in TaskUpdate and `.tasks.json`.
2. Work the steps in order under test-driven-development: write the test, watch it fail for the expected reason, implement, watch it pass. Plan steps give signatures and assertions; you write the bodies. Use what the task's **Reuse:** line names, and before writing any helper, search for an existing one that does the job. If the plan has you create something that already exists, use the existing code and record a ruling.
3. Run every command that has an `Expected:` line and compare the real output. On a mismatch:
   - **Code is wrong** → systematic-debugging. Fix the cause, not the symptom.
   - **Plan is wrong** (contradicts the spec, interface mismatch, command that can't work) → make the smallest change that satisfies the spec and record a ruling.
4. Commit as the plan's commit step says.
5. Mark `completed` only once the task's tests ran and passed in this session and you read the output (verification-before-completion). Update `.tasks.json` (status, `lastUpdated`) in the same step as the commit.

## Rulings

Settle conflicts, ambiguities and plan defects yourself, with the spec as the authority. Append each to a `rulings` array in `.tasks.json`, since later tasks and the final message read them from there:

```json
{"task": 2, "ruling": "use installHook, not install_hook", "why": "matches Task 1 Produces", "costIfWrong": "one rename"}
```

Routine fixes — wrong paths or imports, typos, missing dependencies, null checks or error handling needed for correctness — just make; record them only if they change what the plan says. Choosing a different library than the plan names, or adding a table, schema, service layer or abstraction, always gets a ruling: the user will want to see those.

## Final Review

After the last task, invoke requesting-code-review over the whole branch. It reads the diff range from its first two arguments, so pass them explicitly:

```
Skill("requesting-code-review", "<BASE> <HEAD> 'what was implemented; rulings are in <plan>.tasks.json' '<plan path> <spec path>'")
```

BASE is where the branch started (`git merge-base main HEAD`); HEAD is `git rev-parse HEAD`.

Severity labels are advice; grade each finding by what a user of the software would hit if it shipped:
- **Critical / Important:** fix in one pass. Each fix gets a test that fails first, then the full suite runs green. No re-review.
- **Minor:** don't fix; list under "Deferred minors".
- A finding you choose not to fix is a ruling.

## Finish

End with:
- What was built and the final test-suite result
- **Rulings I made** — every ruling, with its cost if wrong
- **Deferred minors**
- Anything blocked: what you left out and why

Then ask whether to push, open a PR, or keep going.

## Related Skills

- **writing-plans** — produces the plan and `.tasks.json`
