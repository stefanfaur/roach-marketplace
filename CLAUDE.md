# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A private Claude Code plugin marketplace bundling **roach** (research-first workflow methodology), **mariadb-mcp** (MariaDB MCP server integration), and four community plugins from Jeremy Longshore (CI/CD, Ansible, Docker Compose, database query profiling). Core plugins derive from HumanLayer and obra/superpowers configurations.

There is no application code or build system. The repository contains markdown files (skills, agents), a bash SessionStart hook, a small Node.js utility script (roach's metadata helper), and JSON configuration.

## Repository Layout

```
.claude-plugin/marketplace.json    # Marketplace manifest (6 plugins)
roach/                             # Main plugin: agents, hooks, skills, scripts, lib
mariadb-mcp/                       # MariaDB MCP integration: commands, hooks, skills, tests
ci-cd-pipeline-builder/            # CI/CD pipeline generation (Jeremy Longshore)
ansible-playbook-creator/          # Ansible playbook creation (Jeremy Longshore)
docker-compose-generator/          # Docker Compose generation (Jeremy Longshore)
database-query-profiler/           # Database query profiling (Jeremy Longshore)
```

### roach Internal Structure

- `agents/` — 7 specialized subagents (codebase-analyzer, codebase-locator, codebase-pattern-finder, code-reviewer, thoughts-analyzer, thoughts-locator, web-search-researcher)
- `skills/` — 18 skills, each in `skills/<name>/SKILL.md` (brainstorming, committing, create-handoff, dispatching-parallel-agents, executing-plans, grill-me, receiving-code-review, requesting-code-review, researching-codebase, resuming-handoff, subagent-driven-development, systematic-debugging, test-driven-development, using-roach, verification-before-completion, writing-natural, writing-plans, writing-skills)
- `hooks/` — hooks.json, session-start.sh (SessionStart, bash)
- `lib/elements-of-style.md` — Style reference for documentation quality
- `scripts/spec_metadata.js` — Metadata extraction utility (Node.js, cross-platform)

## Development Workflow

Plugins are developed locally at `~/.claude/plugins/roach` and synced to this repo for distribution:

```bash
# Sync local plugin changes to this repo
rm -rf roach
cp -R ~/.claude/plugins/roach roach
git add -A && git commit -m "Sync roach"
git push
```

## Key Conventions

- **`thoughts/` directory**: All persistent artifacts (plans, research, handoffs, browser workflows, doc notes) are stored under `thoughts/shared/` in the target project, organized by domain subdirectories
- **Plans path**: `thoughts/shared/plans/<domain>/YYYY-MM-DD-description.md`
- **Research path**: `thoughts/shared/research/<domain>/YYYY-MM-DD-description.md`
- **Handoffs path**: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- **File references**: Always use `file_path:line_number` format in plans and research
- **Skills-first enforcement**: Skills must be invoked if there's any possibility they apply (the "1% rule")
- **Process skills before implementation skills**: brainstorming/debugging first, then domain-specific skills
- **Commits**: Never add `Co-Authored-By: Claude` lines. Use `git commit <files> -m "message"` (not `git add` then `git commit`)

## Hook Behavior

roach registers a single hook. `session-start.sh` (`SessionStart`, bash, matcher `startup|clear|compact`) injects the `using-roach` skill content into the session context. It is cat-only — no subprocess spawns, no network calls, no settings scans, and no IDE or permission probing. That is the entirety of roach's hook footprint: no other events are hooked.

roach does not monitor context-window usage; use the `create-handoff` skill proactively before context fills up.

## Recommended CLI Tools

The hook no longer probes for these; they are companions you install yourself:

- `ripgrep` (rg) — file content searching
- `gh` — GitHub CLI for repo access
- `agent-browser` (optional) — browser automation
