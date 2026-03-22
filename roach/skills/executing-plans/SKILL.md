---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

## CRITICAL CONSTRAINTS

**You MUST NOT call `EnterPlanMode` or `ExitPlanMode` during this skill.** This skill operates in normal mode, executing a plan that already exists on disk. Plan mode is unnecessary and dangerous here — it restricts Write/Edit tools needed for implementation.

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Load and Review Plan
1. Read plan file
2. Review critically - identify any questions or concerns about the plan
3. If concerns: Raise them with your human partner before starting
4. If no concerns: Create tasks and proceed

### Step 1b: Load Persisted Tasks (if available)

1. Check for `<plan-path>.tasks.json` co-located with the plan file
2. If found AND no native tasks exist: recreate from JSON using TaskCreate, restore blockedBy with TaskUpdate
3. If native tasks already exist: verify they match plan, resume from first `pending`/`in_progress`
4. If no .tasks.json: create tasks from plan headers using TaskCreate
5. **After every task status change:** sync back to `.tasks.json` — read file, update status and `lastUpdated`, write back

### Step 2: Execute Batch
**Default: First 3 tasks**

For each task:
1. Mark as in_progress
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified
4. Mark as completed

### Step 3: Report
When batch complete:
- Show what was implemented
- Show verification output
- Say: "Ready for feedback."

### Step 4: Continue
Based on feedback:
- Apply changes if needed
- Execute next batch
- Repeat until complete

### Step 5: Completion
When all tasks are done:
1. Invoke `update-codebase-index` with a summary of everything that was implemented:
   ```
   Skill("update-codebase-index", "modules='<touched modules>' domains='<touched domains>' summary='<what was built>' first-time=<true|false>")
   ```
2. Announce completion and ask the user how they'd like to proceed (commit, further testing, etc.).

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## Deviation Rules

When executing a plan and reality doesn't match (wrong paths, missing deps, etc.):

**Auto-fix (continue, note in batch report):**
- Wrong import paths, typos, broken references, incorrect file locations
- Missing error handling, input validation, null checks not in the plan but needed for correctness
- Missing dependencies, type errors, broken tests from upstream, config adjustments

**Escalate (stop batch, ask for guidance):**
- Plan says use library X but codebase uses library Y
- New database tables/schemas, new service layers, new abstractions
- Anything that would affect tasks outside the current batch

The rule: if the fix is local to the current task, fix it and note it. If it has cross-task implications, stop and ask.

When reporting at batch checkpoint, include any deviations:
- `[AUTO-FIX]` what differed and what you did
- `[ESCALATED]` what you stopped to ask about

## Related Skills

- **writing-plans** - Create plans to execute
- **subagent-driven-development** - Alternative execution approach

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Between batches: just report and wait
- Stop when blocked, don't guess
- Never start implementation on main/master branch without explicit user consent
