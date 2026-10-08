---
name: using-roach
description: Use when starting any conversation — explains how to find and invoke roach skills before responding or acting, including before clarifying questions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

# Using Roach

Skills carry tested workflows for the work you do here. They shape how you explore, ask and build, so the check comes first.

**IMPORTANT: Before your first response or action on a task — including clarifying questions and exploring files — invoke any skill that plausibly applies.** Checking costs one call; skipping a workflow that applied costs a redo. If a loaded skill turns out not to fit, set it aside.

- Invoke skills with the `Skill` tool, which loads the current version. Don't Read skill files.
- Announce "Using [skill] to [purpose]", then follow it. If it has a checklist, create a task (TaskCreate) per item.
- Rigid skills (test-driven-development, systematic-debugging, verification-before-completion) are followed exactly; flexible ones are adapted to context. Each skill says which it is.

Thoughts that mean you're skipping the check:

| Thought | Reality |
|---|---|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | The skill check comes before clarifying questions. |
| "Let me explore/check files first" | Skills tell you how to explore. Check first. |
| "I remember this skill" | Skills change. Invoke the current version. |

## Which Skill First

Process skills set the approach; implementation and domain skills carry it out.
- "Let's build X" or a change in behavior → brainstorming first.
- "Fix this bug" → systematic-debugging first.

The main flow:
- **Design:** brainstorming (opened by grill-me when the user already has a design in mind) → researching-codebase for architectural changes to existing code → writing-plans
- **Execution:** executing-plans (inline, one final review); test-driven-development and systematic-debugging apply inside it
- **Quality:** verification-before-completion, requesting-code-review
- **Continuity:** create-handoff before context runs out, resuming-handoff to pick up

## Your Instructions Win

User instructions — CLAUDE.md and direct requests — take precedence over skills, and skills over default behavior. A request that only says what to do ("add X", "fix Y") doesn't waive a workflow; skip one only when the user says so.

## Plan Mode

Don't enter plan mode on your own: brainstorming and writing-plans replace it, and plan mode blocks the Write/Edit tools they need. If the user started the session in plan mode, that's their choice — work within it and present the plan with ExitPlanMode as usual.

## Files

- Plans: `thoughts/shared/plans/<domain>/YYYY-MM-DD-description.md`
- Research: `thoughts/shared/research/<domain>/YYYY-MM-DD-description.md`
- Handoffs: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- Take the domain from the task context; ask if unclear.
