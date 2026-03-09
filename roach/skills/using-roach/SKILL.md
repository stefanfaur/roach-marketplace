---
name: using-roach
description: Use when starting any conversation - establishes how to find and use skills and commands, requiring Skill tool invocation before ANY response including clarifying questions
---

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you-follow it directly. Never use the Read tool on skill files.

**In other environments:** Check your platform's documentation for how skills are loaded.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP-you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept != using the skill. Invoke it. |

# Available Commands

Commands are structured multi-step workflows invoked by the user:

| Command | Description |
|---------|-------------|
| `/create_plan` | Create detailed implementation plans through interactive research and iteration |
| `/research_codebase` | Document codebase as-is with thoughts directory for historical context |
| `/implement_plan` | Implement technical plans from thoughts/shared/plans with verification |
| `/validate_plan` | Validate implementation against plan, verify success criteria |
| `/iterate_plan` | Iterate on existing implementation plans with thorough research and updates |
| `/commit` | Create git commits with user approval |
| `/create_handoff` | Create handoff document for transferring work to another session |
| `/resume_handoff` | Resume work from handoff document with context analysis and validation |
| `/write_docs` | Write documentation with Elements of Style quality. Capture notes or finalize docs. |

## Unified Workflow

- **Research phase**: Use `/brainstorming` for design, /research_codebase for thorough analysis, `/writing-plans` skill for implementation planning
- **Implementation phase**: Skills activate automatically (brainstorming, TDD, debugging, verification)
- **Execution phase**: Use `executing-plans` to execute plans
- **Quality phase**: Use `/validate_plan`, `verification-before-completion`, `requesting-code-review`
- **Documentation phase** (opt-in): Use `/write_docs capture` during implementation to accumulate notes, `/write_docs finalize` at the end to produce polished docs
- **Continuity phase**: Use `/create_handoff` to preserve context, `/resume_handoff` to continue

## File Organization

- Plans: `thoughts/shared/plans/<domain>/YYYY-MM-DD-description.md`
- Research: `thoughts/shared/research/<domain>/YYYY-MM-DD-description.md`
- Handoffs: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- Domain is auto-detected from task context; ask user if unclear

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (brainstorming, debugging) - these determine HOW to approach the task
2. **Implementation skills second** (domain-specific skills) - these guide execution

"Let's build X" -> brainstorming first, then implementation skills.
"Fix this bug" -> debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
