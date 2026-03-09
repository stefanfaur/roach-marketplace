# Domain: Skills
> Last updated: 2026-02-27

## Key Files
- roach/skills/using-codebase-index/SKILL.md   — read-path: check index before exploration
- roach/skills/update-codebase-index/SKILL.md  — write-path (context:fork): patch index after sessions
- roach/skills/writing-plans/SKILL.md          — plan creation (context:fork, Explore agent)
- roach/skills/executing-plans/SKILL.md        — batch plan execution with review checkpoints
- roach/skills/brainstorming/SKILL.md          — idea-to-design dialogue before implementation
- roach/skills/subagent-driven-development/SKILL.md — per-task subagent dispatch with two-stage review

## How It Works
Skills are SKILL.md files with YAML frontmatter (name, description, optional context/agent/argument-hint).
`context: fork` skills run in a forked Explore agent; others run inline in the main context.
Skills are invoked via `Skill("skill-name")` or `Skill("skill-name", "args")`.

## Where to Look
- To add a new skill → create roach/skills/<name>/SKILL.md
- To find fork-pattern skills → grep for `context: fork` in roach/skills/
- To see index-aware skills → roach/skills/using-codebase-index/, roach/skills/update-codebase-index/
