---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
context: fork
agent: Explore
argument-hint: "domain, feature description, key files or components involved, any constraints"
---

# Writing Plans

## Before Invoking This Skill (runs in main context)

**Announce:** "I'm using writing-plans to create the implementation plan."

**Gather before invoking:**
1. Determine the domain from task context (e.g., auth, payments, search). If unclear, ask:
   "What domain is this for?"
2. If the user mentioned specific files or existing patterns, note them.
3. If there are constraints (must be stateless, must match existing patterns, etc.), note them.

**Then invoke:**
```
Skill("writing-plans", "domain=<domain> feature='<description>' files='<key files if known>' constraints='<constraints if any>'")
```

**After the fork returns the plan path:**

Print the following as visible message text — the plan path must appear in your message, never only inside a question box. Then ask for the execution choice:

"Plan complete and saved to `<returned path>`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between
tasks, fast iteration. REQUIRED SUB-SKILL: subagent-driven-development.

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution
with checkpoints. REQUIRED SUB-SKILL: executing-plans in the new session.

Which approach?"

---

# Plan Writer Instructions (runs in forked Explore context)

## Task
Write a comprehensive implementation plan for: $ARGUMENTS

## CRITICAL CONSTRAINTS

**You MUST NOT call `EnterPlanMode` or `ExitPlanMode` at any point during this skill.** This skill operates in normal mode. Calling `EnterPlanMode` traps the session in plan mode where Write/Edit are restricted. Calling `ExitPlanMode` breaks the workflow and skips the user's execution choice.

## Steps

**Scope Check:** If the spec covers multiple independent subsystems that should have been split during brainstorming, suggest breaking into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

**1. Explore the codebase for relevant context**

Based on $ARGUMENTS, identify and read:
- Files most likely to be modified or extended
- Existing similar implementations to use as patterns
- Current test structure and conventions
- Tech stack details (package.json, pyproject.toml, go.mod, etc.) if needed

**2. Determine exact file paths**

Every task in the plan must reference real, exact paths — not invented ones. Verify paths exist
or confirm they are correct new-file paths based on existing conventions.

**3. Write the plan**

Follow the structure below exactly. Save to:
`thoughts/shared/plans/<domain>/YYYY-MM-DD-<feature-name>.md`

where `<domain>` and `<feature-name>` come from $ARGUMENTS.

**3.5. Plan review loop**

After writing the complete plan:
1. Dispatch a plan-document-reviewer subagent (use code-reviewer agent in review mode) — provide the plan path and spec path, never your session history
2. If issues found: fix, re-dispatch reviewer (max 3 iterations)
3. If approved: proceed to save and return

**4. Return the saved path**

Output only: `Plan written to thoughts/shared/plans/<domain>/<filename>.md`

---

## Plan Document Structure

Every plan starts with this exact header:

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach and key decisions]

**Tech Stack:** [Key technologies, libraries, versions]

---
```

## Task Structure

Each task follows this pattern:

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/new-file.ts`
- Modify: `exact/path/to/existing.ts:42-67`
- Test: `tests/exact/path/to/test.ts`

**Step 1: Write the failing test**

```typescript
it('should do specific thing', () => {
  const result = functionUnderTest(input);
  expect(result).toEqual(expected);
});
```

**Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern="path/to/test"
```
Expected: FAIL — "functionUnderTest is not defined" or equivalent.

**Step 3: Write minimal implementation**

```typescript
export function functionUnderTest(input: InputType): OutputType {
  // minimal implementation
}
```

**Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern="path/to/test"
```
Expected: PASS.

**Step 5: Commit**

```bash
git add exact/path/to/new-file.ts tests/exact/path/to/test.ts
git commit -m "feat: add specific component"
```
```

## Plan Writing Rules

- Exact file paths always — verify against actual codebase
- Complete code in plan steps, not "add validation here"
- Exact commands with expected output
- Each step is one action (2-5 minutes)
- DRY, YAGNI, TDD, frequent commits
- Assume the implementer is skilled but knows nothing about this codebase or domain
- Assume poor test design intuition — be explicit about what to test and how

## Task Persistence

At plan completion, write a task persistence file co-located with the plan:

If the plan is saved to `thoughts/shared/plans/<domain>/2026-01-15-feature.md`, save tasks to `thoughts/shared/plans/<domain>/2026-01-15-feature.md.tasks.json`.

```json
{
  "planPath": "thoughts/shared/plans/<domain>/2026-01-15-feature.md",
  "tasks": [
    {"id": 0, "subject": "Task 0: ...", "status": "pending"},
    {"id": 1, "subject": "Task 1: ...", "status": "pending", "blockedBy": [0]}
  ],
  "lastUpdated": "<timestamp>"
}
```

Any new session can resume by running the executing-plans skill with the plan path. It reads `.tasks.json` and continues from where it left off.
