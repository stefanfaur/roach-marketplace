# Codebase Map
> Last updated: 2026-03-11 · "roach 1.0.4: commands removed, skills expanded; agent-browser 1.2.0: batch/replay scripts added; preroach module added to index"

## Physical Modules
- **roach**                    → research-first workflow methodology: agents, hooks, skills, scripts
- **agent-browser**            → browser automation agent + skill (wraps Vercel agent-browser CLI; batch/replay recording)
- **preroach**                 → legacy plan-centric workflow skills (creating/implementing/validating/iterating plans)
- **mariadb-mcp**              → MariaDB MCP server skills, commands, hooks
- **ci-cd-pipeline-builder**   → CI/CD pipeline builder skills and commands
- **database-query-profiler**  → database query profiling skills and commands
- **docker-compose-generator** → docker-compose generation skills and commands
- **ansible-playbook-creator** → ansible playbook creation skills and commands

## Tech Stack
- Markdown only (skills, agents, docs)
- Node.js (hooks: session-start.js, context-monitor.js; agent-browser scripts: batch-browser.js, replay-browser.js, finalize-replay.js)
- JSON (marketplace.json, hooks.json, plugin manifests)

## Logical Domains → Detail Files
- **skills**   → thoughts/shared/index/skills.md
- **agents**   → thoughts/shared/index/agents.md
