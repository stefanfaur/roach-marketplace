---
name: update-codebase-index
description: Use after completing implementation plans, research sessions, or significant architectural changes — preserves structural knowledge from the session in the persistent codebase navigation index.
context: fork
agent: Explore
argument-hint: "modules='<modules-or-empty>' domains='<domains>' summary='<what changed>' first-time=<true|false>"
---

# Update Codebase Index

## Before Invoking This Skill (runs in main context)

**When to invoke — mandatory:**
- After `executing-plans` completes all tasks
- After `subagent-driven-development` completes all tasks
- After `/research_codebase` command finishes
- After `brainstorming` when significant architectural decisions were made

**Gather before invoking:**
1. Which physical modules were touched (e.g. `eit-app, eit-domain`). Pass `modules=''` if no code was touched (e.g. research-only sessions).
2. Which logical domains were touched (e.g. `auth, rest-api`)
3. A 1-2 sentence summary of what changed (e.g. "added LDAP sync service in
   eit-extension-bjb; new Flyway migration V42 for user_roles table")
4. Whether `thoughts/shared/index/CODEBASE-MAP.md` exists:
   ```bash
   ls thoughts/shared/index/CODEBASE-MAP.md 2>/dev/null && echo "EXISTS" || echo "FIRST-TIME"
   ```

**Then invoke:**
```
Skill("update-codebase-index", "modules='<modules>' domains='<domains>' summary='<what changed>' first-time=<true|false>")
```

**After the fork returns:**
- Note which files were updated (the fork outputs a list)
- Continue with the session normally

---

# Index Writer Instructions (runs in forked Explore context)

## Context
$ARGUMENTS

Parse $ARGUMENTS for these keys:
- `modules` — physical modules touched
- `domains` — logical domains touched
- `summary` — what changed this session
- `first-time` — `true` means CODEBASE-MAP.md must be created from scratch

---

## For first-time (first-time=true)

**1. Scan project structure**

```bash
# Keep in sync with roach/commands/init_codebase_index.md (same scan command used there)
find . -mindepth 1 -maxdepth 2 -type d | grep -v '.git' | grep -v 'node_modules' | grep -v 'target' | grep -v '.idea' | grep -v 'dist' | grep -v '.angular' | sort
```

Also check for build files: `pom.xml`, `package.json`, `go.mod`, `pyproject.toml`,
`build.gradle`, `Cargo.toml`. Read any found to identify tech stack.

**2. Create the index directory**

```bash
mkdir -p thoughts/shared/index
```

**3. Write CODEBASE-MAP.md**

Create `thoughts/shared/index/CODEBASE-MAP.md`:

```markdown
# Codebase Map
> Last updated: YYYY-MM-DD · "<summary from $ARGUMENTS>"

## Physical Modules
- **module-name**   → one-liner purpose
[one entry per top-level source directory found in scan]

## Tech Stack
- [detected from build files]

## Logical Domains → Detail Files
- **domain** → thoughts/shared/index/domain.md
[list domains from $ARGUMENTS — add more incrementally over time]
```

Target: under 40 lines always.

**4. Create domain stub files**

For each domain in `domains` from $ARGUMENTS, create
`thoughts/shared/index/<domain>.md`:

```markdown
# Domain: <Name>
> Last updated: YYYY-MM-DD

## Key Files
[list key files from modules in $ARGUMENTS — derive from session summary]

## How It Works
[derive from summary in $ARGUMENTS — 2-3 sentences]

## Where to Look
[derive from summary in $ARGUMENTS]
```

---

## For incremental updates (first-time=false)

**1. Read existing files**

Read `thoughts/shared/index/CODEBASE-MAP.md` and the domain detail files for each
domain listed in `domains` from $ARGUMENTS.

**2. Update CODEBASE-MAP.md**

- Update the `> Last updated` line: today's date + session summary
- If `modules` is non-empty, add any new modules not already listed. Skip this step if `modules=''`.
- Add any new domain → detail file entries for new domains

**3. Patch affected domain files**

For each domain in `domains` from $ARGUMENTS:
- **File exists**: append/update entries using the session summary. Update
  the `> Last updated` line.
- **File missing**: create it as a stub using the session summary as content.

**Do NOT rewrite unaffected domain files.** Only touch what changed.

---

## Rules

- **Session context is the source of truth** — do not re-explore what the summary
  already tells you. Read only the files you intend to update.
- **CODEBASE-MAP.md must stay under 40 lines** — describe modules and domains,
  never individual files.
- **Exact paths only** — verify any path you write exists or is a correct new path.

## Output

Return only the list of files written:

```
Index updated:
- thoughts/shared/index/CODEBASE-MAP.md
- thoughts/shared/index/auth.md
```
