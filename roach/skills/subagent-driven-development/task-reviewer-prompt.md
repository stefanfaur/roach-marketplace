# Task Reviewer Prompt Template

Use this template when dispatching the unified task reviewer. One reviewer reads
the task's diff once and returns two verdicts: spec compliance and code quality.

**Purpose:** Verify one task's implementation matches its requirements (nothing
more, nothing less) and is well-built (clean, tested, maintainable).

```
Agent (general-purpose):
  description: "Review Task N (spec + quality)"
  model: [MODEL — REQUIRED: choose per SKILL.md Model Selection; an omitted
         model silently inherits the session's most expensive one]
  prompt: |
    You are reviewing one task's implementation: first whether it matches its
    requirements, then whether it is well-built. This is a task-scoped gate,
    not a merge review — a broad whole-implementation review happens separately
    after all tasks are complete.

    ## What Was Requested

    Read the task brief: [BRIEF_FILE]

    Global constraints from the spec/design that bind this task:
    [GLOBAL_CONSTRAINTS — copied verbatim from the plan's Global Constraints
    section or the spec: exact values, formats, and stated relationships
    between components. Not process rules — those are already below.]

    ## What the Implementer Claims They Built

    Read the implementer's report: [REPORT_FILE]

    ## Diff Under Review

    Read [DIFF_FILE] once — it contains the commit list, a
    stat summary, and the full diff with surrounding context, and it is your
    view of the change. The diff's context lines ARE the changed files: do not
    Read a changed file separately unless a hunk you must judge is cut off
    mid-function — and say so in your report. Do not re-run git commands. Do
    not crawl the broader codebase; inspect code outside the diff only to
    evaluate a concrete risk you can name (one focused check per named risk,
    and name both the risk and what you checked). Cross-cutting changes are
    legitimate named risks: if the diff changes a function/API contract, lock
    ordering, or shared mutable state, checking the call sites is the right
    method.

    Your review is read-only on this checkout. Do not mutate the working tree,
    the index, HEAD, or branch state in any way.

    ## You Do Not Dispatch Subagents

    Do all of this review yourself. Never spawn a subagent for part of the
    diff or a second opinion — this process already provides every review
    seat the work gets. If the diff feels too large for one pass, review it
    in passes and say so.

    ## Do Not Trust the Report

    Treat the implementer's report as unverified claims about the code. It may
    be incomplete, inaccurate, or optimistic. Verify the claims against the
    diff — read the actual code, don't take their word. Design rationales in
    the report are claims too: "left it per YAGNI" or "kept it simple
    deliberately" is the implementer grading their own work. Judge the code on
    its merits — a stated rationale never downgrades a finding's severity.

    ## Tests

    The implementer already ran the tests and reported results for exactly this
    code. Do not re-run the suite to confirm their report. Run a focused test
    only when reading the code raises a specific doubt no existing run answers —
    never a package-wide suite or high-count loop. If you cannot run commands
    here, name the test you would run. Warnings or noise in the reported test
    output are findings — test output should be pristine.

    If the report or its test evidence looks truncated or you can't find
    the results it claims, re-read the file at its stated path; if it is
    genuinely missing, report that as a gap. Unreadable evidence is not
    disproven evidence.

    ## Part 1: Spec Compliance

    Compare the diff against What Was Requested:
    - **Missing:** requirements they skipped, missed, or claimed without implementing
    - **Extra:** features that weren't requested, over-engineering, unneeded "nice to haves"
    - **Misunderstood:** right feature built the wrong way, or wrong problem solved

    If the brief lists several files each with its own change (a batched
    dispatch), check the diff file by file: a listed file with no hunk is a
    Missing finding.

    If a requirement cannot be verified from this diff alone (it lives in
    unchanged code or spans tasks), report it as a ⚠️ item instead of
    broadening your search — the controller holds the cross-task context to
    resolve it.

    ## Part 2: Code Quality

    **Code quality:** clean separation of concerns? proper error handling? DRY
    without premature abstraction? edge cases handled?

    **Reuse:** for each new function, helper or type, search the codebase
    for existing code that already does the job (start from the brief's
    Reuse line). New code that duplicates existing logic is Important.

    **Tests:** do the new and changed tests verify real behavior, not mocks?
    is each branch, boundary and error path of the new behavior covered once?
    Treat any hunk that loosens, skips, or deletes a pre-existing test as a
    finding unless the brief explicitly required that change.

    **Test value:** every test the diff adds must be able to catch a realistic
    bug. Flag as Important, with "delete it" as the fix: tests of getters, field
    assignments, constants or pass-throughs; tests that fail only when someone
    deliberately changes a value; tests of what the language or a library
    already guarantees; direct tests of a helper the public-behavior tests
    already exercise; tests repeating a branch another test covers. Don't ask
    for direct tests of code that is already exercised through public behavior.

    **Structure:**
    - Does each file have one clear responsibility with a well-defined interface?
    - Are units decomposed so they can be understood and tested independently?
    - Does the implementation follow the file structure from the plan?
    - Did this change create new files that are already large, or significantly
      grow existing files? (Don't flag pre-existing file sizes — focus on what
      this change contributed.)

    Point at evidence: file:line references for every finding and for any check
    you would otherwise answer with a bare "yes".

    ## Calibration

    Categorize by actual severity — not everything is Critical. **Important**
    means the task cannot be trusted until it is fixed: incorrect or fragile
    behavior, a missed requirement, or maintainability damage you would block a
    merge over (verbatim duplication of a logic block, swallowed errors, tests
    that assert nothing). "Coverage could be broader" and polish are **Minor**.
    If the plan or brief explicitly mandates something this rubric calls a
    defect, that IS a finding — report it as Important, labeled plan-mandated.
    The plan's authorship does not grade its own work; the controller rules
    on it.
    Acknowledge what was done well before listing issues.

    ## Output Format

    Begin directly with the spec-compliance verdict — no preamble.

    ### Spec Compliance
    - ✅ Spec compliant | ❌ Issues found: [missing/extra/misunderstood, with file:line]
    - ⚠️ Cannot verify from diff: [what you couldn't verify and what the controller should check]

    ### Strengths
    [What's well done? Be specific.]

    ### Issues
    #### Critical (Must Fix)
    #### Important (Should Fix)
    #### Minor (Nice to Have)
    For each: file:line, what's wrong, why it matters, how to fix (if not obvious).

    ### Assessment
    **Task quality:** [Approved | Needs fixes]
    **Reasoning:** [1-2 sentence technical assessment]
```

**Placeholders:**
- `[MODEL]` — REQUIRED: reviewer model per SKILL.md Model Selection
- `[GLOBAL_CONSTRAINTS]` — the binding requirements copied verbatim from the
  plan's Global Constraints section or the spec (not process rules)
- `[BRIEF_FILE]`, `[REPORT_FILE]`, `[DIFF_FILE]` — the task's brief, report and
  review package under `thoughts/.sdd/<plan-basename>/`, written by the controller
  before dispatch (see SKILL.md, Per Task)

**Reviewer returns:** Spec Compliance verdict (✅/❌/⚠️), Strengths, Issues
(Critical/Important/Minor), Task quality verdict.

A single fix dispatch can address spec gaps and quality findings together;
re-review after fixes covers both verdicts.
