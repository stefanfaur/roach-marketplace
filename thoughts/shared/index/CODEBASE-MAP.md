# Codebase Map
> Last updated: 2026-02-27 · "initial index — added using/update-codebase-index skills and init_codebase_index command; wired index pre/post steps into agents and skills"

## Physical Modules
- **roach**                   → research-first workflow methodology: agents, commands, hooks, skills
- **agent-browser**           → browser automation agent + skill (wraps Vercel agent-browser CLI)
- **mariadb-mcp**             → MariaDB MCP server skills, commands, hooks
- **ci-cd-pipeline-builder**  → CI/CD pipeline builder skills and commands
- **database-query-profiler** → database query profiling skills and commands
- **docker-compose-generator** → docker-compose generation skills and commands
- **ansible-playbook-creator** → ansible playbook creation skills and commands

## Tech Stack
- Markdown only (skills, commands, agents, docs)
- Node.js (hooks: session-start.js, context-monitor.js, scripts/spec_metadata.js)
- JSON (marketplace.json, hooks.json, plugin manifests)

## Logical Domains → Detail Files
- **skills**   → thoughts/shared/index/skills.md
- **commands** → thoughts/shared/index/commands.md
- **agents**   → thoughts/shared/index/agents.md
