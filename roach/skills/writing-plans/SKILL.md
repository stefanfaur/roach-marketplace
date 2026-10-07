---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

**Announce at start:** "I'm using writing-plans to create the implementation plan."

Write the plan; don't implement it. Implementation starts after the user reviews the plan and picks how to execute it.

Don't enter plan mode on your own — it blocks Write/Edit and skips the execution choice.

## Reader

Write for a capable engineer who has never seen this codebase or the spec. Given an exact interface and an exact test, they write idiomatic code and make reasonable choices wherever the plan leaves one open. What they cannot know is what you decided: which files, which names and signatures, which values from the spec, which tests prove each task. The plan records those decisions. DRY, YAGNI, TDD, frequent commits.

## Steps

**Scope check:** If the spec covers several independent subsystems, suggest one plan per subsystem. Each plan should produce working, testable software on its own.

**1. Gather inputs.** The domain (e.g., auth, payments, search) — ask if unclear. The spec and research document, if brainstorming wrote them. Files, patterns and constraints the user mentioned.

**2. Explore the codebase.** Read the research document first, if there is one, and explore only what it doesn't cover. Read the files likely to change, similar implementations to follow, the test layout and conventions, and tech-stack files (package.json, pyproject.toml, go.mod) if needed. Search for existing helpers, utilities and abstractions each task could use — codebase-pattern-finder for broad searches — since anything the plan doesn't name, the implementer is likely to write from scratch.

**3. Map the files.** Before defining tasks, list each file to create or modify and its one responsibility. Paths must be real: verify existing ones, and derive new ones from existing conventions. Files that change together live together; follow the codebase's existing patterns.

**4. Write the plan** in the structure below. Save to `thoughts/shared/plans/<domain>/YYYY-MM-DD-<feature-name>.md`.

**5. Self-review** — a checklist you run yourself, not a subagent dispatch:
1. **Spec coverage:** point to a task for each spec requirement; add tasks for gaps.
2. **Step scan:** each step lets the implementer write exactly one reasonable thing. A line that decides nothing ("handle edge cases", "add validation", "TBD") is a gap; a function body that the signature and tests already determine is a transcript. Fix both.
3. **Test value:** every test step names behavior per test-driven-development's What Earns a Test, one test per branch or boundary. Remove planned tests of getters, constants, pass-throughs or library behavior; a task with no behavior of its own says `**Tests:** none — <why>`.
4. **Interface consistency:** names and types in later tasks match what earlier tasks define (`clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug).
5. **Scope:** every task traces back to a requirement; no invented scope.
6. **Reuse:** every new helper, type or abstraction in the plan was searched for first; if one exists, the task uses it instead.
7. **Proportion:** a plan several times longer than its spec has written the program instead of planning it. If code blocks dominate, replace bodies with signatures, test names and assertions.

Fix issues inline; no re-review.

**6. Write `.tasks.json`** (see Task Persistence).

**7. Hand off.** Print the following as message text — the path must be visible, not only inside a question box — then ask for review and the execution choice:

"Plan saved to `<path>`. Please review it. Two ways to execute:

**1. Subagent-driven** — a fresh subagent implements each task and a fresh reviewer checks it before the next starts. Most thorough; costs a fresh context per task. REQUIRED SUB-SKILL: subagent-driven-development.

**2. Inline** — I implement every task myself without stopping (here, or in a new session if this one's context is getting full), then one fresh review covers the whole branch. Faster and cheaper. REQUIRED SUB-SKILL: executing-plans.

I recommend <1 or 2> because <one sentence: how much tasks depend on each other's interfaces, how many there are, what a shipped mistake would cost>."

## Plan Header

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** Execute with subagent-driven-development or executing-plans, as the user chose at handoff. Progress is tracked in `<this file>.tasks.json`.

**Goal:** [One sentence]

**Spec:** [path to the design doc, or "none"]

**Architecture:** [2-3 sentences about approach and key decisions]

**Tech Stack:** [Key technologies, libraries, versions]

## Global Constraints

[Project-wide invariants every task must respect — version floors, dependency limits,
naming/copy rules, platform assumptions, key integration points — one line each,
exact values copied verbatim from the spec.]

---
```

## Task Right-Sizing

A task is the smallest unit that carries its own verification cycle and is worth a fresh reviewer's gate. Fold setup, configuration, scaffolding and docs into the task whose deliverable needs them; split only where a reviewer could reject one task while approving its neighbor. Each task ends with one independently testable deliverable — no mid-task user gates.

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/new-file.ts`
- Modify: `exact/path/to/existing.ts:42-67`
- Test: `tests/exact/path/to/test.ts`

**Interfaces:**
- Consumes: [what this task uses from earlier tasks — exact signatures]
- Produces: [exact function/type names with parameter and return types that later
  tasks rely on. An implementer sees only their own task; this is how they learn
  what neighbors expose.]

**Reuse:** [existing symbols this task must use, as `path:line` — or "none found" after searching]

**Step 1: Write the failing test**

```typescript
it('rejects totals above the 10,000 limit', () => {
  expect(() => validateOrder({ total: 10_001 })).toThrow(LimitExceededError);
});
```

**Step 2: Run it** — `npm test -- path/to/test` — Expected: FAIL, "validateOrder is not defined"

**Step 3: Implement `validateOrder(order: Order): void` in `src/orders/validate.ts`**

[One line on the approach when the signature and test leave a real choice.]

**Step 4: Run it** — `npm test -- path/to/test` — Expected: PASS

**Step 5: Commit** — `git add <new files>` then `git commit <task files> -m "feat: ..."`
````

## What a Step Contains

A step is ready when the implementer can write exactly one reasonable thing from it — unambiguous, not complete:
- **Test step:** the test name and its assertions as code, with the spec's exact values — only for behavior (see test-driven-development, What Earns a Test). Tasks without behavior of their own, like a type, wiring or docs, carry `**Tests:** none — <why>` instead of test steps.
- **Code step:** exact signature, the file it lives in, and any values the spec pins. Include a body only for an algorithm the signature and tests don't determine, or for exact copy the spec fixes.
- **Verification step:** the command and the output that means it passed.
- **Reference to another task:** point to that task's Interfaces block; don't repeat its code.

## Task Persistence

Next to the plan, write `<plan file>.tasks.json` (e.g. `2026-01-15-feature.md.tasks.json`):

```json
{
  "planPath": "thoughts/shared/plans/<domain>/2026-01-15-feature.md",
  "tasks": [
    {"id": 0, "subject": "Task 0: ...", "status": "pending"},
    {"id": 1, "subject": "Task 1: ...", "status": "pending", "blockedBy": [0]}
  ],
  "rulings": [],
  "lastUpdated": "<timestamp>"
}
```

Any session resumes from this file: completed tasks are skipped, and `rulings` collects the executor's decisions.
