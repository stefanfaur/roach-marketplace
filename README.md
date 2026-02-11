# roach Marketplace

Private Claude Code plugin marketplace bundling **roach** and its companion plugins.

## Background

The commands, agents, and skills in roach are derived from the Claude Code configurations of [HumanLayer](https://github.com/humanlayer) and [obra/superpowers](https://github.com/obra), customized to work together as a unified plugin with a domain-focused directory structure (`thoughts/shared/plans/<domain>/`, `thoughts/shared/research/<domain>/`, etc.).

The agent-browser plugin wraps [Vercel's agent-browser CLI](https://github.com/vercel/agent-browser) with a workflow that persists relevant context as steps succeed. It returns shorter, more focused page summaries that avoid flooding the context window while remaining sufficient for most browsing tasks.

## Included Plugins

| Plugin | Description |
|--------|-------------|
| **roach** | Research-first methodology with skills-first enforcement |
| **frontend-design** | Distinctive, production-grade frontend interface generation (by Anthropic) |
| **agent-browser** | Browser automation agent with workflow persistence (requires `agent-browser` CLI) |
| **prepush** | Git pre-push hook with configurable quality checks and AI-powered code review |

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

After adding the marketplace, enable the plugins you want from the list: `roach`, `frontend-design`, `agent-browser`, `prepush`.

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

### Configure statusline with claude-hud (recommended)

Install the [claude-hud](https://github.com/anthropics/claude-hud) plugin for a live statusline in your terminal.

roach wraps claude-hud with its own statusline handler (`hooks/statusline-wrapper.js`). This wrapper intercepts context window usage data — which powers the automatic 80%/90% handoff warnings from the Stop hook — and passes it through to claude-hud for display. Without it, the context monitoring feature does not work.

After installing claude-hud, point your statusline command at the wrapper instead of claude-hud directly:

```bash
node ~/.claude/plugins/roach/hooks/statusline-wrapper.js
```

See the [claude-hud repository](https://github.com/anthropics/claude-hud) for installation and configuration.

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

A `SessionStart` hook injects the foundational skill into every session, forcing Claude to check for applicable skills before responding. A `Stop` hook monitors context window usage and warns at 80%/90%, prompting handoff creation before context runs out.

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

#### Commands

| Command | What it does |
|---------|-------------|
| `/create_plan` | Create an implementation plan through interactive research |
| `/iterate_plan` | Update an existing plan with new research |
| `/implement_plan` | Execute a plan with verification at each step |
| `/validate_plan` | Check implementation against plan success criteria |
| `/research_codebase` | Document code as-is into `thoughts/shared/research/` |
| `/commit` | Git commit that never uses `git add` (preserves IDE changelists) |
| `/create_handoff` | Save context for another session to pick up |
| `/resume_handoff` | Resume from a handoff document |
| `/write_docs` | Capture notes during implementation or produce final docs |

### frontend-design

A skill by Anthropic (Prithvi Rajasekaran, Alexander Bricken). Single skill, no agents, no commands.

Prevents Claude from generating generic-looking UIs. Before writing any frontend code, it forces a concrete aesthetic direction and provides guidelines for typography (pick distinctive fonts, avoid Inter/Roboto/system defaults), color (dominant color with sharp accents, not evenly distributed palettes), motion (CSS-first animations, staggered reveals, scroll-triggered effects), layout (asymmetry, overlap, grid-breaking), and visual texture (gradients, noise, grain — not flat solid colors). Based on Anthropic's [Frontend Aesthetics Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb).

### agent-browser

Wraps [Vercel's agent-browser CLI](https://github.com/vercel/agent-browser) with a single skill and agent. The CLI gives Claude a headless Chromium it drives step by step: open URL, snapshot, click, fill, snapshot again.

The key difference from raw browser tools: `snapshot -i` returns only interactive elements (buttons, links, inputs) with refs like `@e1`, `@e2` — roughly 80% less context than a full DOM. Semantic locators (`find text "Sign In" click`) handle dynamic pages where element refs aren't stable enough.

The plugin adds workflow persistence on top. Before touching the browser, the agent checks `thoughts/shared/browser/` for saved workflows matching the domain and task. After a successful run, it saves the workflow with steps, auth notes, and gotchas. Future runs of the same task reuse the saved workflow instead of rediscovering everything. Session state (`state save/load`) persists authentication so login flows only need to be solved once.

All browser interaction runs in an isolated subagent to keep the main context window clean.

### prepush

Installs and manages a git `pre-push` hook with configurable quality checks and optional AI code review. No agents, no skills — just a `SessionStart` hook that handles setup and a git hook that runs on push.

**First session flow**: The startup hook auto-detects your project's tech stack (JS/TS, Python, Go, Rust, Ruby, Makefile targets) and reads `CLAUDE.md` for project conventions. It asks whether you want to set up pre-push checks, with options to customize what the AI review focuses on (security, performance, test coverage, etc.). When you say yes, it creates three files:

- `.claude/prepush.json` — configuration (which tools to run, review mode, focus areas)
- `.claude/commands/prepush_review.md` — project-specific AI review slash command
- `.git/hooks/pre-push` — the git hook script

**On push**: The hook runs your configured quality tools sequentially (lint, test, typecheck, etc.). If any fail, the push is blocked. If AI review is enabled, it proceeds in one of two modes:

- **auto** (default): Invokes `claude -p` with the diff, gets a structured JSON verdict (PASS/FAIL with issues), and blocks the push only on critical issues (bugs, security vulnerabilities, data loss risks).
- **manual**: Blocks the push and tells you to run `/prepush_review` in Claude Code to review interactively before pushing.

**Configuration** (`.claude/prepush.json`):

```json
{
  "version": 1,
  "mode": "auto",
  "qualityTools": [
    { "name": "lint", "command": "npm run lint" },
    { "name": "test", "command": "npm test" }
  ],
  "review": {
    "enabled": true,
    "focus": ["correctness", "security"],
    "command": "prepush_review"
  }
}
```

Edit `.claude/commands/prepush_review.md` to customize the AI review behavior. To uninstall, remove `.claude/prepush.json`, `.claude/commands/prepush_review.md`, and `.git/hooks/pre-push`.

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
