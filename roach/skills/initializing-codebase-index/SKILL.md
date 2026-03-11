---
name: initializing-codebase-index
description: Use when bootstrapping a comprehensive codebase index on a project with no existing thoughts/shared/index/, or when the user explicitly requests a deep index scan
---

# Init Codebase Index (Deep Scan)

One-time deep scan using parallel subagents. Produces `thoughts/shared/index/CODEBASE-MAP.md`
and rich domain detail files. For the lightweight auto-triggered path, see `update-codebase-index`
with `first-time=true`.

## When to Use

- User explicitly asks to index the codebase
- You want a comprehensive index with deep file-level analysis
- The lightweight auto-triggered index (via `using-codebase-index`) is insufficient

**Do NOT use when:**
- Index already exists — use `update-codebase-index` instead
- You want a quick background bootstrap — `using-codebase-index` handles that automatically

## Steps

**1. Check for existing index**

```bash
ls thoughts/shared/index/CODEBASE-MAP.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If EXISTS: stop and tell the user:
> Index already exists. Use `update-codebase-index` to update it,
> or delete `thoughts/shared/index/` to rebuild from scratch.

**2. Scan project structure**

```bash
# Keep in sync with roach/skills/update-codebase-index/SKILL.md
find . -mindepth 1 -maxdepth 2 -type d | grep -v '.git' | grep -v 'node_modules' | grep -v 'target' | grep -v '.idea' | grep -v 'dist' | grep -v '.angular' | sort
```

Identify all top-level physical modules (source directories).

**3. Detect tech stack**

Check for: `pom.xml`, `package.json`, `go.mod`, `pyproject.toml`, `build.gradle`,
`Cargo.toml`. Read any found to identify key dependencies, frameworks, and versions.

**4. Dispatch parallel subagents — one per physical module**

For each physical module, dispatch a `roach:codebase-analyzer` subagent with this prompt
template (adapt module name and path):

> Analyze the module at `<module-path>/`. Produce a structured report:
>
> 1. **Purpose** — one sentence describing what this module does
> 2. **Key files** — the 3-5 most important files with line references (path:line) and
>    a brief description of each (ClassName — what it does)
> 3. **Internal patterns** — how code is organized within the module (e.g., layered
>    architecture, feature folders, etc.)
> 4. **Dependencies** — which other modules this one depends on or is depended upon by
> 5. **Logical domains** — which cross-cutting domains this module participates in
>    (e.g., auth, api, database, frontend)
>
> Return ONLY the structured report, no preamble.

Dispatch all subagents in a single message for maximum parallelization.

**5. Synthesize results**

Read all module reports. From them:

a. **Identify logical domains** — deduplicate domain tags across all module reports.
   Each unique domain becomes a detail file.

b. **Create index directory:**
```bash
mkdir -p thoughts/shared/index
```

c. **Write CODEBASE-MAP.md** — same format as `update-codebase-index`, under 40 lines:

```markdown
# Codebase Map
> Last updated: YYYY-MM-DD · "deep scan (bootstrapped by initializing-codebase-index)"

## Physical Modules
- **module-name**   → one-liner purpose (from subagent reports)

## Tech Stack
- Backend: ...
- Frontend: ...
- DB: ...

## Logical Domains → Detail Files
- **domain** → thoughts/shared/index/domain.md
```

d. **Write domain detail files** — for each logical domain, create
   `thoughts/shared/index/<domain>.md`. Populate from subagent reports — these should be
   rich, not stubs:

```markdown
# Domain: <Name>
> Last updated: YYYY-MM-DD

## Key Files
- path/to/file.ext:line  # ClassName — what it does
[populated from subagent reports — all key files tagged with this domain]

## How It Works
[2-3 sentences synthesized from subagent reports on the domain flow]

## Where to Look
- To do X → file.ext:line
- To do Y → other-file.ext:line
[derived from key files and internal patterns in subagent reports]
```

**6. Report**

Announce what was created:
```
Codebase index initialized (deep scan):
- thoughts/shared/index/CODEBASE-MAP.md
- thoughts/shared/index/<domain>.md  [list each]

N modules scanned via parallel subagents.
```

Remind the user:
> Update the index after significant changes by invoking `update-codebase-index`.
