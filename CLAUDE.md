# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A private Claude Code plugin marketplace bundling **roach** (research-first workflow methodology), **preroach** (legacy plan-centric workflow skills), and **agent-browser** (browser automation wrapping Vercel's agent-browser CLI). Derived from HumanLayer and obra/superpowers configurations.

There is no application code, build system, or test suite. The repository contains only markdown files (skills, agents), Node.js scripts (hooks), and JSON configuration.

## Repository Layout

```
.claude-plugin/marketplace.json    # Marketplace manifest
roach/                             # Main plugin: agents, hooks, skills, scripts
preroach/                          # Legacy plan-centric workflow skills
agent-browser/                     # Browser automation agent + skill
```

### roach Internal Structure

- `agents/` — 7 specialized subagents (codebase-analyzer, codebase-locator, codebase-pattern-finder, code-reviewer, thoughts-analyzer, thoughts-locator, web-search-researcher)
- `skills/` — skills, each in `skills/<name>/SKILL.md` (brainstorming, committing, dispatching-parallel-agents, executing-plans, initializing-codebase-index, receiving-code-review, requesting-code-review, researching-codebase, resuming-handoff, subagent-driven-development, systematic-debugging, test-driven-development, using-roach, verification-before-completion, writing-plans, writing-skills, and more)

### preroach Internal Structure

- `skills/` — legacy plan workflow skills (creating-plans, implementing-plans, validating-plans, iterating-plans)
- `hooks/` — hooks.json + Node.js scripts (session-start.js runs on startup/resume/clear/compact; context-monitor.js runs on Stop)
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

Same pattern for agent-browser.

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

`session-start.js` runs asynchronously on every session start and:
1. Checks for companion CLI tools (ripgrep, agent-browser)
2. Detects JetBrains MCP availability and reports whether IDE tools are usable
3. Checks WebSearch/WebFetch blanket permissions and offers to configure them
4. Injects the `using-roach` skill content into the session context

## Required CLI Tools

- `ripgrep` (rg) — file content searching
- `gh` — GitHub CLI for repo access
- `agent-browser` (optional) — browser automation
