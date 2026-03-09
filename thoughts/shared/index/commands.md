# Domain: Commands
> Last updated: 2026-02-27

## Key Files
- roach/commands/init_codebase_index.md  — bootstrap codebase index from scratch (model: opus)
- roach/commands/research_codebase.md   — comprehensive codebase research with parallel sub-agents
- roach/commands/create_plan.md         — plan creation entrypoint
- roach/commands/implement_plan.md      — plan execution entrypoint
- roach/commands/commit.md              — structured commit workflow

## How It Works
Commands are markdown files with YAML frontmatter (description, optional model).
They run as slash commands (`/command_name`). The `model: opus` frontmatter upgrades to Opus for deep tasks.
research_codebase uses parallel Task agents; init_codebase_index does a one-time structural scan.

## Where to Look
- To add a new command → create roach/commands/<name>.md
- To find the index bootstrap command → roach/commands/init_codebase_index.md
- To understand research flow → roach/commands/research_codebase.md (steps 0-11)
