# roach Marketplace

Private Claude Code plugin marketplace.

## Background

The core plugins — roach, preroach, and agent-browser — derive from the Claude Code configurations of [HumanLayer](https://github.com/humanlayer) and [obra/superpowers](https://github.com/obra), restructured into a unified plugin with domain-scoped artifact storage (`thoughts/shared/{plans|research|handoffs}/<domain>/`).

The marketplace also includes community-contributed plugins from Jeremy Longshore for CI/CD, Ansible, Docker Compose, and database query profiling.

## Included Plugins

| Plugin | Author | Description |
|--------|--------|-------------|
| **roach** | Stefan Faur | Research-first methodology with skills-first enforcement |
| **preroach** | Stefan Faur | Legacy plan-centric workflow skills (creating, implementing, validating, iterating plans) |
| **agent-browser** | Stefan Faur | Browser automation with workflow persistence (requires `agent-browser` CLI) |
| **mariadb-mcp** | Stefan Faur | MariaDB MCP server integration with automated setup and database best practices |
| **ci-cd-pipeline-builder** | Jeremy Longshore | Build CI/CD pipelines for GitHub Actions, Gitea, GitLab CI, Jenkins |
| **ansible-playbook-creator** | Jeremy Longshore | Create and validate Ansible playbooks |
| **docker-compose-generator** | Jeremy Longshore | Generate Docker Compose files with validation |
| **database-query-profiler** | Jeremy Longshore | Profile and optimize database queries |

## Installation

### Prerequisites

**1. Install and authenticate the GitHub CLI:**

| Platform | Command |
|----------|---------|
| macOS | `brew install gh` |
| Linux | See [gh installation docs](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) |
| Windows | `winget install GitHub.cli` or `choco install gh` |

```bash
# All platforms — log in and select HTTPS when prompted
gh auth login
gh auth status
```

**2. Verify access to this repository:**

```bash
gh repo view stefanfaur/roach-marketplace --json name
```

### Add the marketplace

```
/plugin
# Select "Add Marketplace"
# Enter: https://github.com/stefanfaur/roach-marketplace.git
```

### Enable plugins

After adding the marketplace, enable the plugins you want. Available plugins: `roach`, `preroach`, `agent-browser`, `mariadb-mcp`, `ci-cd-pipeline-builder`, `ansible-playbook-creator`, `docker-compose-generator`, `database-query-profiler`.

### Install required CLI tools

**ripgrep** (required — used by Claude Code for codebase searching):

| Platform | Command |
|----------|---------|
| macOS | `brew install ripgrep` |
| Linux | `apt install ripgrep` or `cargo install ripgrep` |
| Windows | `winget install BurntSushi.ripgrep.MSVC` or `choco install ripgrep` |

**agent-browser** (recommended — enables browser automation):
```bash
# All platforms (requires Node.js)
npm install -g agent-browser
agent-browser install
```

### Configure JetBrains MCP (recommended)

If you use a JetBrains IDE (IntelliJ, WebStorm, PyCharm, etc.):

1. Open your JetBrains IDE
2. Go to **Settings > Tools > MCP Server**
3. Check **Enable MCP Server**
4. In the **Clients Auto-Configuration** section, click **Auto-Configure** next to Claude Code
5. Restart Claude Code

roach detects JetBrains MCP availability at session start and tells the agent whether to use JetBrains tools or fall back to built-in tools.

roach warns at session start if any companion is missing.

## Team Distribution

Add this to your project's `.claude/settings.json` to auto-prompt teammates:
```json
{
  "extraKnownMarketplaces": {
    "roach-marketplace": {
      "source": {
        "source": "github",
        "repo": "stefanfaur/roach-marketplace"
      }
    }
  }
}
```

## What Each Plugin Does

### roach

The core plugin. Derived from [obra/superpowers](https://github.com/obra) and [HumanLayer](https://github.com/humanlayer)'s Claude Code configurations, restructured into a single plugin with domain-scoped artifact storage (`thoughts/shared/{plans|research|handoffs}/<domain>/`).

A `SessionStart` hook injects the foundational skill into every session, forcing Claude to check for applicable skills before responding. A `PostToolUse` hook monitors context window usage after every tool call and warns when remaining context drops below 35% (warning) or 25% (critical), prompting handoff creation before context runs out.

#### Skills

| Skill | What it does |
|-------|-------------|
| `using-roach` | Injected at session start. Forces skill lookup before any response |
| `brainstorming` | Explore intent and design before writing code |
| `writing-plans` | Break work into 2-5 minute tasks with success criteria |
| `executing-plans` | Execute plans in batches with review checkpoints |
| `subagent-driven-development` | One fresh subagent per task, two-stage review (spec compliance + code quality) |
| `dispatching-parallel-agents` | Run independent investigations concurrently |
| `test-driven-development` | No production code without a failing test first |
| `systematic-debugging` | Root cause investigation before proposing fixes |
| `verification-before-completion` | Run the command and read the output before claiming success |
| `requesting-code-review` | Dispatch reviewer subagent after completing work |
| `receiving-code-review` | Evaluate review feedback technically, push back when warranted |
| `writing-skills` | TDD for skill authoring — pressure-test without the skill, then write it to counter the failure modes |
| `writing-natural` | Apply Elements of Style principles to any prose output |
| `committing` | Git commit with user approval; never uses `git add` (preserves IDE changelists) |
| `researching-codebase` | Document code as-is via parallel agents into `thoughts/shared/research/` |
| `resuming-handoff` | Resume from a handoff document with context validation and action planning |
| `create-handoff` | Save context for another session to pick up |

#### Agents

| Agent | What it does |
|-------|-------------|
| `codebase-locator` | Finds files/directories relevant to a task |
| `codebase-analyzer` | Documents how code works with file:line references |
| `codebase-pattern-finder` | Surfaces existing patterns to model after |
| `thoughts-locator` | Finds relevant documents in `thoughts/` |
| `thoughts-analyzer` | Extracts decisions and constraints from thought documents |
| `web-search-researcher` | Web research for info not in training data |
| `code-reviewer` | Reviews completed work against plans and standards |

All codebase agents are documentarians — they describe what exists without suggesting improvements.

### preroach

Legacy plan-centric workflow skills, kept separate from the main roach plugin for clarity. These skills predate the `brainstorming` → `writing-plans` → `executing-plans` flow and implement the older interactive plan creation and execution workflow.

| Skill | What it does |
|-------|-------------|
| `creating-plans` | Create a detailed implementation plan through interactive research and parallel agent investigation |
| `implementing-plans` | Execute a plan phase-by-phase with automated and manual verification checkpoints |
| `validating-plans` | Check implementation against plan success criteria and produce a validation report |
| `iterating-plans` | Update an existing plan surgically based on new requirements or feedback |

### agent-browser

Wraps [Vercel's agent-browser CLI](https://github.com/vercel/agent-browser) with a single skill and agent. The CLI gives Claude a headless Chromium it drives step by step: open URL, snapshot, click, fill, snapshot again.

The key difference from raw browser tools: `snapshot -i` returns only interactive elements (buttons, links, inputs) with refs like `@e1`, `@e2` — roughly 80% less context than a full DOM. Semantic locators (`find text "Sign In" click`) handle dynamic pages where element refs aren't stable enough.

The plugin adds workflow persistence on top. Before touching the browser, the agent checks `thoughts/shared/browser/` for saved workflows matching the domain and task. After a successful run, it saves the workflow with steps, auth notes, and gotchas. Future runs of the same task reuse the saved workflow instead of rediscovering everything. Session state (`state save/load`) persists authentication so login flows only need to be solved once.

All browser interaction runs in an isolated subagent to keep the main context window clean.

### mariadb-mcp

Integrates the [MariaDB MCP server](https://github.com/MariaDB/mcp) with one-command automated setup and comprehensive database best practices.

**One-command setup**: `/mariadb-setup` installs the MariaDB MCP server, prompts for credentials, generates configuration, and tests the connection. No manual cloning, environment setup, or config file editing. Supports update, reconfigure, and reinstall flows.

**Best practices guidance**: Router skill (`mariadb-best-practices`) activates on database tasks and pulls from reference files covering schema design, indexing, query optimization, Hibernate/QueryDSL patterns, performance tuning, security hardening, backup/replication, and migrations. If MCP is connected, validates advice against your actual database.

**Commands**:
- `/mariadb-setup` — Install/update/reconfigure the MCP server
- `/mariadb` — Guided database health assessment (schema audit, index analysis, configuration review, security scan)
- `/mariadb-review` — Review Java codebase for MariaDB/Hibernate/QueryDSL issues (no connection required)

**Session hook**: Auto-detects MCP server configuration at startup and reports availability.

## Updating Plugins

To sync the latest from this marketplace:
```
/plugin
# Select "Update Marketplace"
```

## Development

To update the marketplace with local plugin changes:
```bash
# From this repo root
rm -rf roach
cp -R ~/.claude/plugins/roach roach
git add -A && git commit -m "Sync roach"
git push
```
