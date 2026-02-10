---
name: agent-browser
description: Browser automation CLI for AI agents. Use when the user needs to interact with websites, including navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or automating any browser task. Triggers include requests to "open a website", "fill out a form", "click a button", "take a screenshot", "scrape data from a page", "test this web app", "login to a site", "automate browser actions", or any task requiring programmatic web interaction.
---

# agent-browser: AI-First Browser Automation

Use the `agent-browser` CLI to control a headless Chromium browser. **All browser automation must be delegated to the `browser-agent` subagent** — invoke it via the Task tool with `subagent_type: "browser-agent"`.

## Why Delegate?

The browser-agent:
- Checks `thoughts/shared/browser/` for saved workflows before starting (avoids re-discovering navigation paths)
- Saves successful workflows after completion (builds institutional knowledge for the project)
- Runs in an isolated context window (keeps your main conversation clean)

## How to Delegate

```
Task(
  subagent_type: "browser-agent",
  prompt: "Navigate to https://example.com and fill out the contact form with name 'John' and email 'john@example.com'"
)
```

Be specific about the target URL, the actions to perform, and what constitutes success.

## Core Workflow (for reference)

The agent follows this cycle:

1. **Open**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get interactive element refs like @e1, @e2)
3. **Interact**: `agent-browser click @e1` / `agent-browser fill @e2 "text"`
4. **Re-snapshot**: After any DOM change (click, navigation, form submit), snapshot again — refs become invalid

## Key Commands

| Command | Purpose |
|---------|---------|
| `open <url>` | Navigate to URL |
| `snapshot -i` | List interactive elements with refs |
| `click @e1` | Click element |
| `fill @e2 "text"` | Clear and type into input |
| `select @e3 "option"` | Select dropdown option |
| `wait --load networkidle` | Wait for page to finish loading |
| `get text @e1` | Extract text from element |
| `get url` | Get current page URL |
| `screenshot` | Capture viewport |
| `screenshot --full` | Capture full page |
| `state save <file>` | Save cookies/session for reuse |
| `state load <file>` | Restore saved session |

## Critical Rules

- **Always use `snapshot -i`** (interactive only) — full snapshots waste context tokens
- **Always re-snapshot after DOM changes** — element refs (@e1, @e2) become stale
- **Wait for networkidle** after navigation and form submissions
- **Use `state save/load`** for authentication — login once, reuse forever
