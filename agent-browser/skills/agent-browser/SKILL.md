---
name: agent-browser
description: Use when the user needs to interact with websites — navigating pages, filling forms, clicking buttons, taking screenshots, extracting data, testing web apps, or any browser task requiring programmatic web interaction.
---

# agent-browser: AI-First Browser Automation

**All browser automation must be delegated to the `browser-agent` subagent** — invoke it via the Agent tool with `subagent_type: "browser-agent"`.

## Why Delegate?

- Runs in an isolated context window (keeps your main conversation clean)
- **Replays known workflows instantly** — checks for `.replay.json` files first, executes without LLM involvement
- Falls back to **batch mode** for new workflows — plans multiple actions per tool call, 3-5x fewer round-trips
- Auto-captures replay files during LLM-driven runs (builds replayable knowledge)
- Maintains `thoughts/shared/browser/GENERAL.md` with cross-cutting facts (auth endpoints, credential sources, session state files)

## How to Delegate

```
Agent(
  subagent_type: "browser-agent",
  prompt: "Navigate to https://example.com and fill out the contact form with name 'John' and email 'john@example.com'"
)
```

Be specific: target URL, actions to perform, what constitutes success.

## What the Agent Does Internally

1. Discovers its scripts dynamically (no hardcoded paths)
2. Checks for existing replay files matching the target domain
3. If replay exists: runs it deterministically, no LLM reasoning needed
4. If no replay: uses batch mode — plans 3-10 actions per tool call, auto-records for future replay
5. Writes workflow documentation and finalizes replay files after every session
