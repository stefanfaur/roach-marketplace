---
name: using-roach
description: Use when starting any conversation - establishes how to find and use skills and commands, requiring Skill tool invocation before ANY response including clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. Even a 1% chance a skill applies means invoke it to check; if it turns out wrong, you don't have to use it.

Access skills with the `Skill` tool — the content is loaded for you to follow directly. Never use the Read tool on skill files.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

After invoking, announce **"Using [skill] to [purpose]"** and follow the skill exactly.

If the skill has a checklist, create a task (**TaskCreate**) per item.

## Skill Priority

When multiple skills apply, process skills (brainstorming, systematic-debugging) come first — they set the approach; implementation skills carry it out.

- "Let's build X" → brainstorming first, then implementation skills.
- "Fix this bug" → systematic-debugging first, then domain skills.

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore/check files first" | Skills tell you HOW to explore. Check first. |
| "I remember this skill" | Skills evolve. Invoke the current version. |

## Unified Workflow

- **Research/design**: `brainstorming` (optionally opened by `grill-me`), `writing-plans`, `researching-codebase`
- **Execution**: `executing-plans`, `subagent-driven-development` (TDD, debugging, verification auto-activate)
- **Quality**: `verification-before-completion`, `requesting-code-review`
- **Continuity**: `create-handoff`, `resuming-handoff`

## Skill Types

**Rigid** (TDD, debugging): follow exactly. **Flexible** (patterns): adapt to context. The skill tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.

## File Organization

- Plans: `thoughts/shared/plans/<domain>/YYYY-MM-DD-description.md`
- Research: `thoughts/shared/research/<domain>/YYYY-MM-DD-description.md`
- Handoffs: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- Domain is auto-detected from task context; ask user if unclear

## Tool Restrictions

**Never call `EnterPlanMode` or `ExitPlanMode`.** These tools trap the session in plan mode where Write/Edit tools are restricted. Use the brainstorming and writing-plans skills instead — they manage their own structured planning flow.
