---
name: using-codebase-index
description: Use when starting any codebase exploration, research, planning, or implementation task — before using Glob/Grep/Read tools to locate or understand code.
---

# Using Codebase Index

## Overview

The codebase index is a persistent navigation map at `thoughts/shared/index/`. Reading it first gives you precise file locations and domain structure without broad directory scans.

## When NOT to Use

- User provided explicit file paths and no exploration is needed
- Task is non-codebase (writing docs, creating plans with no file lookup)
- You are a subagent with a narrow, already-targeted scope given by the caller

## Steps

**1. Check for the index**

```bash
ls thoughts/shared/index/CODEBASE-MAP.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

- **MISSING**: Proceed with normal exploration. If you are the main session, invoke
  `update-codebase-index` with `first-time=true` after the task completes.
  Subagents should not invoke it — the orchestrating skill handles this.
- **EXISTS**: Read it now — it is always compact (under 40 lines).

**2. Read the map**

```
Read("thoughts/shared/index/CODEBASE-MAP.md")
```

**3. Identify relevant domains**

From your current task, identify which logical domains apply. Examples:
- "fix LDAP auth bug" → `auth`
- "add new REST endpoint" → `rest-api`
- "change DB schema" → `database`

**4. Read domain detail files**

For each relevant domain, read its detail file from the "Logical Domains → Detail Files"
section of the map. Skip domains unrelated to your task.

**5. Proceed with targeted exploration**

Use the index as your navigation guide:
- Go directly to the files/packages the index points to
- Use Glob/Grep/Read only to verify details or fill gaps the index does not cover
- Do NOT run broad directory scans if the index already answers "where do I go?"

## Key Rule

The index is a starting point, not a constraint. If the index is stale or incomplete
for your task, use normal exploration and note what is missing. The `update-codebase-index`
skill will correct it afterward.

## Common Mistakes

- Running broad Glob/Grep scans before checking the index — check first, search only to fill gaps
- Treating index file paths as authoritative without verifying they exist — always confirm before relying on them
- Invoking `update-codebase-index` from a subagent — index writes are the responsibility of the main session's orchestrating skill
