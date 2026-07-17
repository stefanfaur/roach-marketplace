---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
context: fork
agent: general-purpose
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

**3.5. Pre-save self-review**

After writing the complete plan, review it against the spec yourself — a checklist you run inline, not a subagent dispatch:
1. **Spec coverage:** skim each spec requirement; can you point to a task that implements it? Add tasks for any gaps.
2. **Placeholder scan:** search the plan for the "No Placeholders" red flags below; fix any you find.
3. **Interface consistency:** do the types, signatures, and names used in later tasks match what earlier tasks define? (`clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.)
4. **Scope vs. requirements:** every task traces back to a spec requirement; no invented scope.

Fix issues inline — no re-review needed. The user review gate happens after this fork returns: the plan path is presented and the user picks the execution approach (see "Before Invoking This Skill").

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

## Global Constraints

[The spec's project-wide invariants that every task must respect — version floors,
dependency limits, naming/copy rules, platform or environment assumptions, key
integration points — one line each, exact values copied verbatim from the spec.
Every task's requirements implicitly include this section.]

---
```

## Task Right-Sizing

A task is the smallest unit that carries its own verification cycle and is worth a fresh reviewer's gate. When drawing task boundaries: fold setup, configuration, scaffolding, and documentation steps into the task whose deliverable needs them; split only where a reviewer could meaningfully reject one task while approving its neighbor. Each task ends with one independently testable deliverable — no mid-task user gates.

## Task Structure

Each task follows this pattern:

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/new-file.ts`
- Modify: `exact/path/to/existing.ts:42-67`
- Test: `tests/exact/path/to/test.ts`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [what later tasks rely on — exact function/type names with parameter
  and return types. An implementer sees only their own task; this block is how
  they learn the names and types neighboring tasks expose, without guessing.]

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

## No Placeholders

Every step must contain the actual content an implementer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without the actual test code)
- "Similar to Task N" (repeat the code — tasks may be read out of order)
- Steps that say what to do without showing how (code steps require code blocks)
- References to types, functions, or methods not defined in any task's Interfaces

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
