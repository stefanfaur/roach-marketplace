---
name: create-handoff
description: Use when context is getting long, before pausing or ending a work session, or when transferring ongoing work to a new session. ALWAYS prefer this over auto-compacting — use proactively before context fills up.
---

# Create Handoff

## Overview

Creates a structured document to transfer session context. **Prefer this over auto-compacting** — handoffs preserve richer, structured context that a new agent can immediately act on.

**Use proactively.** Don't wait until context is full — create a handoff when you sense work is pausing or the session is getting long.

## When to Use

- Context is growing long (before it forces auto-compaction)
- Pausing work mid-task
- Ending a session with unfinished work
- Handing off to another agent or session

## Process

### 1. Determine filepath & metadata

- Detect domain from task context (e.g., `accrual`, `kpi`, `general`)
- Path: `thoughts/shared/handoffs/<domain>/YYYY-MM-DD_HH-MM-SS_description.md`
- Run to get metadata: `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec_metadata.js`

### 2. Write the document

```markdown
---
date: [ISO datetime with timezone]
researcher: [from thoughts status]
git_commit: [current commit hash]
branch: [current branch]
repository: [repo name]
topic: "[Feature/Task] Implementation Strategy"
tags: [implementation, strategy, component-names]
status: complete
last_updated: [YYYY-MM-DD]
last_updated_by: [researcher name]
type: implementation_strategy
---

# Handoff: {concise description}

## Task(s)
{Tasks with status: completed / in progress / planned. Reference plan/research docs if applicable. If on a plan, call out the current phase.}

## Critical References
{2-3 most important file paths. Leave blank if none.}

## Recent Changes
{Changes made this session in line:file syntax}

## Learnings
{Key patterns, root causes, important context for the next agent. Include explicit file paths.}

## Artifacts
{Exhaustive list of produced/updated files and file:line references}

## Action Items & Next Steps
{What the next agent should do, based on task statuses}

## Other Notes
{Other useful context — relevant codebase locations, important patterns, anything else worth passing on}
```

### 3. Confirm

After saving the file, respond:

```
Handoff created! Resume in a new session with:

/roach:resuming-handoff path/to/handoff.md
```

## Key Principles

- **More information, not less** — this template is the minimum; always add more if needed
- **Be thorough and precise** — include both high-level objectives and lower-level details
- **Prefer file:line references over code snippets** — avoid large code blocks unless debugging a specific error
