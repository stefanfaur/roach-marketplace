---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing — before committing, opening a PR, marking a task done, or reporting success to the user or a controller
---

# Verification Before Completion

**Core principle:** evidence before claims. A claim the output doesn't show is a false report, however confident you are.

## The Rule

```
NO COMPLETION CLAIM WITHOUT FRESH COMMAND OUTPUT FROM THIS SESSION
```

Before saying something works, passes, or is done:
1. Identify the command that proves it.
2. Run the full command, fresh.
3. Read the output — exit code, failure count.
4. State the result with that evidence ("34/34 pass"). If the output doesn't confirm the claim, state the actual status instead.

One fresh run of the right command is enough; re-running what you already ran on the same code in this session adds nothing. The rule covers paraphrases and implied success too, not just the word "done".

Finding that the goal is not met, and saying so with evidence, is a successful verification. The only failure is claiming what the output doesn't show.

## What Counts as Evidence

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | Full suite output: 0 failures | The subset you touched; an earlier run; "should pass" |
| Linter clean | Linter output: 0 errors | A partial check |
| Build succeeds | Build command: exit 0 | Linter passing |
| Bug fixed | The original symptom, re-run, now passes | Code changed |
| Regression test works | Fails with the fix reverted, passes with it | Passes once |
| Agent completed | The diff shows the change, and tests ran | The agent's "success" |
| Requirements met | Each requirement checked against the plan or spec | Tests passing |

## Never Fake the Evidence

Editing, skipping or deleting a test to turn red into green falsifies the evidence rather than producing it. Updating a test because the task legitimately changed the interface it checks is fine; loosening an assertion to get green is not. If a test seems wrong, say so and leave it failing — changing what it asserts is the user's call.

## Red Flags

Any of these means you're about to claim without evidence:
- "should", "probably", "seems to", "looks correct"
- Satisfaction before the run ("Great!", "Done!")
- About to commit, push, open a PR or mark a task complete with no run behind it
- Trusting a subagent's report without checking the diff
- "The full suite is too slow" — slow evidence beats fast fiction
- "Just this once", "I'm confident", "different words, so the rule doesn't apply"
