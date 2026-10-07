# Scoped Re-Review Prompt Template

Use this template after each fix round. The re-reviewer checks that each finding was addressed and that the fix broke nothing. It is not a fresh review — the full review already happened.

```
Agent (general-purpose):
  description: "Re-review Task N fix round R"
  model: [MODEL — REQUIRED: per SKILL.md Model Selection; small fix diffs
         take the cheapest to standard tier]
  prompt: |
    You are re-reviewing one task's fix round. A previous review produced
    findings; an implementer has tried to fix them. Verdict each finding and
    inspect the fix diff — nothing else.

    ## The Task

    Read the task brief: [BRIEF_FILE]

    ## Findings Under Verification

    [FINDINGS]

    ## The Fix

    Read the implementer's report; fix reports are appended at the end:
    [REPORT_FILE]

    Read [DIFF_FILE] once — the fix commits, a stat summary, and the fix diff
    ([FIX_BASE_SHA]..[HEAD_SHA]) with context. Don't re-run git commands. If
    the file is missing, run `git diff [FIX_BASE_SHA]..[HEAD_SHA]` yourself.

    Your review is read-only: don't change the working tree, index, HEAD or
    branches. Don't spawn subagents.

    ## Scope

    Verdict every finding, and check the fix diff for problems the fix
    introduced. Don't re-review code the fix didn't touch: issues entirely
    outside the fix diff go under Out-of-Scope Observations — they don't
    block this task and don't extend the loop.

    ## Tests

    Confirm the fix report names the covering tests and shows their command
    and output, and check those claims against the diff. Don't re-run the
    suite; run a focused test only when the code raises a specific doubt no
    existing run answers.

    ## Output

    Begin directly with the first verdict — no preamble.

    ### Finding Verdicts
    For each finding, in order:
    - **[finding one-liner]** — ADDRESSED | NOT ADDRESSED, with file:line.
      "Attempted" is not addressed: the specific defect must be gone.

    ### New Breakage in the Fix Diff
    Severity (Critical/Important/Minor) and file:line for each. "None" if clean.

    ### Out-of-Scope Observations
    Non-blocking; the controller defers them to the final review. "None" if none.

    ### Verdict
    **Fix round:** All findings addressed, no new Critical/Important breakage
    | Findings remain open — list them.
```

**Placeholders:**
- `[MODEL]` — REQUIRED
- `[BRIEF_FILE]`, `[REPORT_FILE]` — the same files the implementer used
- `[FINDINGS]` — the open Critical/Important findings and spec gaps, copied verbatim, one per bullet
- `[FIX_BASE_SHA]` — the head the previous review saw; `[HEAD_SHA]` — current commit
- `[DIFF_FILE]` — package for FIX_BASE..HEAD under `thoughts/.sdd/<plan-basename>/`
