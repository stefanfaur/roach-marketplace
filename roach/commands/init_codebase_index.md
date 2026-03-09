---
description: Bootstrap the codebase index from scratch for a project with no existing index. Run once when adopting roach on an existing project. Produces CODEBASE-MAP.md and initial domain detail files via a thorough structural scan.
model: opus
---

# Init Codebase Index

You are initializing the codebase index for a project that has none. This is a
one-time deep scan. Produce `thoughts/shared/index/CODEBASE-MAP.md` and initial
domain detail files.

## Steps

**1. Check for existing index**

```bash
ls thoughts/shared/index/CODEBASE-MAP.md 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

If EXISTS: stop immediately and tell the user:
> Index already exists at `thoughts/shared/index/CODEBASE-MAP.md`.
> `/init_codebase_index` is a one-time bootstrap command.
> To update the existing index, invoke `update-codebase-index` instead.
> To rebuild from scratch, delete `thoughts/shared/index/` first.

**2. Scan project structure**

```bash
# Keep in sync with roach/skills/update-codebase-index/SKILL.md (same scan command used there)
find . -mindepth 1 -maxdepth 2 -type d | grep -v '.git' | grep -v 'node_modules' | grep -v 'target' | grep -v '.idea' | grep -v 'dist' | grep -v '.angular' | sort
```

**3. Detect tech stack**

Check for: `pom.xml`, `package.json`, `go.mod`, `pyproject.toml`, `build.gradle`,
`Cargo.toml`. Read any found to identify key dependencies, frameworks, and versions.

**4. Identify physical modules**

For each top-level source directory, determine its purpose (backend module, frontend,
DB migrations, infrastructure, etc.) from its name and a brief look at its contents.

**5. Identify logical domains**

From the modules found, infer cross-cutting logical domains (e.g. `auth`, `api`,
`domain-model`, `frontend`, `database`, `infra`). These become the detail files.

**6. Create index directory**

```bash
mkdir -p thoughts/shared/index
```

**7. Write CODEBASE-MAP.md**

Create `thoughts/shared/index/CODEBASE-MAP.md`:

```markdown
# Codebase Map
> Last updated: YYYY-MM-DD · "initial index (bootstrapped by /init_codebase_index)"

## Physical Modules
- **module-name**   → one-liner purpose

## Tech Stack
- Backend: ...
- Frontend: ...
- DB: ...

## Logical Domains → Detail Files
- **domain** → thoughts/shared/index/domain.md
```

Target: under 40 lines regardless of project size. Describe modules and domains —
never individual files.

**8. Write domain detail files**

For each logical domain, create `thoughts/shared/index/<domain>.md`. Populate
Key Files with the 3-5 most important files found in that domain. Derive
"How It Works" and "Where to Look" from a brief read of those files.

```markdown
# Domain: <Name>
> Last updated: YYYY-MM-DD

## Key Files
- path/to/file.ext:line  # ClassName — what it does

## How It Works
[2-3 sentences on the domain flow]

## Where to Look
- To do X → file.ext:line
- To do Y → other-file.ext:line
```

**9. Report and remind**

Announce what was created:
```
Codebase index initialized:
- thoughts/shared/index/CODEBASE-MAP.md
- thoughts/shared/index/<domain>.md  [list each]
```

Remind the user:
> Update the index after each significant change by invoking `update-codebase-index`
> at the end of implementation or research sessions.
