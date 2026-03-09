---
name: agent-browser
description: Use when the user needs to interact with websites — navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or any browser task requiring programmatic web interaction.
---

# agent-browser: AI-First Browser Automation

Use the `agent-browser` CLI to control a headless Chromium browser. **All browser automation must be delegated to the `browser-agent` subagent** — invoke it via the Agent tool with `subagent_type: "browser-agent"`.

## Why Delegate?

- Runs in an isolated context window (keeps your main conversation clean)
- Checks `thoughts/shared/browser/` for saved workflows before starting (avoids re-discovering navigation paths)
- Saves successful workflows after completion (builds institutional knowledge)
- Maintains `thoughts/shared/browser/GENERAL.md` with cross-cutting facts (auth endpoints, credential sources, session state files)

## How to Delegate

```
Agent(
  subagent_type: "browser-agent",
  prompt: "Navigate to https://example.com and fill out the contact form with name 'John' and email 'john@example.com'"
)
```

Be specific: target URL, actions to perform, what constitutes success.

## Quick Command Reference

| Command | Purpose |
|---------|---------|
| `open <url>` | Navigate to URL |
| `snapshot -i` | List interactive elements with refs |
| `click @e1` | Click element |
| `fill @e2 "text"` | Clear and type into input |
| `select @e3 "option"` | Select dropdown option |
| `wait --load networkidle` | Wait for page to finish loading |
| `get text @e1` | Extract text from element |
| `screenshot` | Capture viewport |
| `state save/load <file>` | Persist or restore session cookies |
