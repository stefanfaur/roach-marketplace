---
date: 2026-02-11T12:56:53.338Z
researcher: stefanfaur
git_commit: 3cae429
branch: main
repository: roach-marketplace
topic: "Git operations across all tools (commands, agents, skills, hooks, scripts)"
tags: [research, git, commands, skills, hooks, scripts, agents]
status: complete
last_updated: 2026-02-11
last_updated_by: stefanfaur
---

# Research: Git Operations Across All Tools

**Date**: 2026-02-11T12:56:53.338Z
**Researcher**: stefanfaur
**Git Commit**: 3cae429
**Branch**: main
**Repository**: roach-marketplace

## Research Question

Analyse the codebase and all existing tools (commands, agents, skills, hooks, scripts, configuration) to determine which ones perform git operations, what exact operations they do, and why they do them.

## Summary

Git operations exist in **3 categories** across the codebase:

1. **Scripts that directly execute git commands** (2 files) - `spec_metadata.js` and `session-start.js` use `execSync` to run git commands at the Node.js level
2. **Command/skill markdown files that instruct the AI agent** to run git commands (7 files) - these contain prose instructions that the AI follows
3. **Configuration that pre-approves git commands** (1 file) - `settings.local.json` allows `git mv`

No agent files contain git operations. The `agent-browser` and `frontend-design` plugins contain no git operations.

## Detailed Findings

### Category 1: Scripts That Directly Execute Git Commands

#### `roach/scripts/spec_metadata.js`

This is the central metadata-gathering script called by multiple commands. It executes **3 git commands** via Node.js `execSync`:

| Line | Command | Purpose |
|------|---------|---------|
| 16 | `git rev-parse --show-toplevel` | Finds the repository root directory; uses its basename as the repository name |
| 19 | `git rev-parse --abbrev-ref HEAD` | Gets the current branch name (e.g., `main`) |
| 20 | `git rev-parse --short HEAD` | Gets the abbreviated commit hash of HEAD |

All commands are wrapped in a `run()` helper (lines 7-14) that catches errors and returns `'unknown'` as a fallback. Stderr is suppressed via `stdio: ['pipe', 'pipe', 'pipe']`. The script outputs key-value pairs to stdout:

```
date: 2026-02-11T12:56:53.338Z
git_branch: main
git_commit: 3cae429
repository: roach-marketplace
```

**Callers**: `create_handoff.md`, `research_codebase.md`, and `agent-browser/agents/browser-agent.md` all invoke this script via `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec_metadata.js`.

---

#### `roach/hooks/session-start.js`

This hook runs on every session start (SessionStart event, configured in `roach/hooks/hooks.json:3-11`). It executes **1 git command**:

| Line | Command | Purpose |
|------|---------|---------|
| 96 | `git rev-parse --show-toplevel` | Finds the project root to locate `.claude/settings.local.json` and `.claude/settings.json` for WebSearch/WebFetch permission checking |

Uses the same `run()` pattern with `process.cwd()` as fallback if not in a git repository.

---

### Category 2: Commands That Instruct Git Operations

#### `roach/commands/commit.md` - The Commit Workflow

The most git-intensive component. Implements a full commit workflow with safety checks.

**Read-only operations (information gathering):**

| Line | Command | Purpose |
|------|---------|---------|
| 13 | `git status` | See what files have changed (note: never use `-uall` flag) |
| 14 | `git diff` | Understand the actual code modifications |
| 18 | `git diff --cached --stat` | **Safety check** - detect if files are already staged (e.g., from IntelliJ changelists) |
| 38 | `git log --oneline -n [number]` | Show the result after committing |

**Write operation (the actual commit):**

| Line | Command | Purpose |
|------|---------|---------|
| 35 | `git commit <file1> <file2> ... -m "message"` | Create a commit containing ONLY the specified files |

**Explicitly forbidden operations:**

| Line | Command | Why Forbidden |
|------|---------|---------------|
| 36, 41, 62 | `git add` followed by `git commit -m` | Commits ALL staged files, which breaks IDE changelists. If IntelliJ has files staged in a changelist, `git add` + `git commit` would include those unintended files. |
| 43 | `git reset HEAD` | Modifies the staging area, potentially disrupting IDE state |

**Anti-attribution rule (lines 47-50):**
The command explicitly forbids adding `Co-Authored-By: Claude` or any AI attribution lines to commits. Commits must appear as authored solely by the user.

**Safety flow:**
1. Run `git diff --cached --stat` to check for pre-staged files
2. If pre-staged files exist, must NOT use `git add` workflow
3. Always use `git commit <files> -m "message"` (direct commit syntax)

---

#### `roach/commands/validate_plan.md` - Implementation Validation

Uses git to examine what was implemented.

| Line | Command | Purpose |
|------|---------|---------|
| 23 | `git log --oneline -n 20` | View last 20 commits to identify implementation work |
| 24 | `git diff HEAD~N..HEAD` | See all changes across N implementation commits |
| 28 | `git rev-parse --show-toplevel` (in `cd $(...)`) | Navigate to repo root before running `make check test` |

---

#### `roach/commands/write_docs.md` - Documentation Capture

Uses git to understand what changed for documentation purposes.

| Line | Command | Purpose |
|------|---------|---------|
| 39 | `git diff --stat` | Get summary of file changes to identify what's documentable |
| 39 | `git log --oneline -10` | Review last 10 commits for documentation context |
| 92 | `git log --oneline` | Review commit history when finalizing documentation |
| 92 | `git diff` | See uncommitted changes when finalizing documentation |

---

#### `roach/commands/research_codebase.md` - GitHub Permalink Generation

Uses git and GitHub CLI to generate permanent code references.

| Line | Command | Purpose |
|------|---------|---------|
| 154 | `git branch --show-current` | Check if on main branch (permalinks only work for pushed commits) |
| 154 | `git status` | Check if commits are pushed |
| 155 | `gh repo view --json owner,name` | Get repository owner/name for constructing GitHub URLs |

**Permalink format**: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`

---

#### `roach/commands/create_handoff.md` - Context Preservation

Does not run git commands directly; delegates to `spec_metadata.js`.

| Line | Mechanism | Purpose |
|------|-----------|---------|
| 20 | `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec_metadata.js` | Gather git_commit, branch, repository for YAML frontmatter |

The gathered metadata is embedded in the handoff document frontmatter (lines 32-34) to record the exact git state when the handoff was created.

---

### Category 3: Skills That Reference Git Operations

#### `roach/skills/brainstorming/SKILL.md`

| Context | Command | Purpose |
|---------|---------|---------|
| Line ~42 | `git commit` (general instruction) | Commit the validated design document after brainstorming completes |

The skill instructs: "Commit the design document to git" without specifying exact syntax.

---

#### `roach/skills/writing-plans/SKILL.md`

| Context | Command | Purpose |
|---------|---------|---------|
| Lines 82-85 | `git add tests/path/test.py src/path/file.py` then `git commit -m "feat: add specific feature"` | Template for plan writers to include commit steps in their plans |

This is a **template** - plan writers are instructed to include commit steps at the end of each task in their TDD red-green-refactor cycles.

---

#### `roach/skills/writing-skills/SKILL.md`

| Context | Command | Purpose |
|---------|---------|---------|
| Line ~632 | `git commit` and `git push` | Deploy completed skills to version control and optionally push to fork |

Part of the deployment checklist: "Commit skill to git and push to your fork (if configured)".

---

#### `roach/skills/systematic-debugging/SKILL.md`

| Context | Command | Purpose |
|---------|---------|---------|
| Line ~68 | `git diff` (general reference) | Check recent changes as part of root cause investigation in Phase 1 |

Referenced as "Git diff, recent commits" in the "Check Recent Changes" investigation step.

---

#### `roach/skills/requesting-code-review/SKILL.md`

| Context | Command | Purpose |
|---------|---------|---------|
| Lines 50-51 | `git log --oneline \| rg "Task 1" \| head -1 \| awk '{print $1}'` | Extract base commit SHA for code review scope |
| Lines 50-51 | `git rev-parse HEAD` | Extract current HEAD SHA for code review scope |

These commands define the commit range that the code-reviewer subagent should examine.

---

### Category 4: Configuration

#### `.claude/settings.local.json`

| Line | Setting | Purpose |
|------|---------|---------|
| 9 | `"Bash(git mv:*)"` in `permissions.allow` | Pre-approves `git mv` commands so the AI agent can rename/move files without per-invocation user confirmation |

---

#### `CLAUDE.md` - Developer Workflow Documentation

| Lines | Command | Purpose |
|-------|---------|---------|
| 37-38 | `git add -A && git commit -m "Sync roach"` then `git push` | Developer workflow for syncing local plugin changes to this distribution repo |
| 52 | `git commit <files> -m "message"` (convention) | Reinforces the direct-commit-syntax convention from `commit.md` |

---

### Components With NO Git Operations

**All 7 agents** contain no git commands:
- `roach/agents/codebase-analyzer.md`
- `roach/agents/codebase-locator.md`
- `roach/agents/codebase-pattern-finder.md`
- `roach/agents/code-reviewer.md`
- `roach/agents/thoughts-analyzer.md`
- `roach/agents/thoughts-locator.md`
- `roach/agents/web-search-researcher.md`

**7 skills** contain no git commands:
- `dispatching-parallel-agents`
- `receiving-code-review`
- `subagent-driven-development`
- `test-driven-development`
- `verification-before-completion`
- `executing-plans`
- `using-roach`

**4 commands** contain no git commands:
- `create_plan.md`
- `implement_plan.md`
- `iterate_plan.md`
- `resuming_handoff.md`

**Hook files with no git**:
- `context-monitor.js`
- `statusline-wrapper.js`
- `test-hooks.js`
- `test-integration.js`

**Other plugins**:
- `agent-browser/` - No git operations (though `browser-agent.md` calls `spec_metadata.js`)
- `frontend-design/` - No git operations

## Code References

### Direct Script Execution
- `roach/scripts/spec_metadata.js:16` - `git rev-parse --show-toplevel`
- `roach/scripts/spec_metadata.js:19` - `git rev-parse --abbrev-ref HEAD`
- `roach/scripts/spec_metadata.js:20` - `git rev-parse --short HEAD`
- `roach/hooks/session-start.js:96` - `git rev-parse --show-toplevel`

### AI-Instructed Operations
- `roach/commands/commit.md:13-18` - Status/diff checks
- `roach/commands/commit.md:35` - Direct commit syntax
- `roach/commands/commit.md:36,41,43` - Forbidden operations
- `roach/commands/validate_plan.md:23-28` - Log/diff for validation
- `roach/commands/write_docs.md:39,92` - Log/diff for documentation
- `roach/commands/research_codebase.md:153-156` - Branch/status for permalinks
- `roach/commands/create_handoff.md:20` - Metadata script invocation
- `roach/skills/requesting-code-review/SKILL.md:50-51` - Log/rev-parse for review scope
- `roach/skills/writing-plans/SKILL.md:82-85` - Commit step template
- `roach/skills/brainstorming/SKILL.md:42` - Commit design document
- `roach/skills/systematic-debugging/SKILL.md:68` - Diff for investigation
- `roach/skills/writing-skills/SKILL.md:632` - Commit and push for deployment

### Configuration
- `.claude/settings.local.json:9` - `git mv` permission
- `CLAUDE.md:37-38` - Sync workflow
- `CLAUDE.md:52` - Commit convention

## Architecture Documentation

### Git Operation Categories

The codebase uses git operations in four distinct workflow patterns:

1. **Metadata Collection** (read-only): `spec_metadata.js` and `session-start.js` use `git rev-parse` to gather repository state. These are silent, non-interactive, and fail gracefully. They serve infrastructure purposes (settings detection, document frontmatter).

2. **Commit Workflow** (write): `commit.md` is the only component that creates commits. It implements a safety protocol around IDE changelist preservation using `git diff --cached --stat` before committing, and mandates direct commit syntax (`git commit <files> -m`) over the stage-then-commit pattern.

3. **History Inspection** (read-only): `validate_plan.md`, `write_docs.md`, `systematic-debugging`, and `requesting-code-review` use `git log` and `git diff` to examine what changed. These support validation, documentation, debugging, and code review workflows.

4. **GitHub Integration** (read-only + external API): `research_codebase.md` uses `git branch`, `git status`, and `gh repo view` to generate permanent GitHub permalinks for research documents.

### Error Handling Pattern

All direct git execution uses the same pattern:
```javascript
function run(cmd, fallback) {
  try { return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe','pipe','pipe'] }).trim(); }
  catch (_) { return fallback || 'unknown'; }
}
```
This ensures git failures never crash scripts or block sessions.

### Safety Conventions

The codebase enforces two critical safety rules for git write operations:
1. **Direct commit syntax only**: `git commit <files> -m "msg"` - never `git add` + `git commit`
2. **No AI attribution**: No `Co-Authored-By: Claude` or "Generated with Claude" lines in commits

## Complete Git Command Inventory

| Command | Type | Files Using It | Purpose Category |
|---------|------|----------------|-----------------|
| `git rev-parse --show-toplevel` | Read | spec_metadata.js, session-start.js, validate_plan.md | Metadata / Navigation |
| `git rev-parse --abbrev-ref HEAD` | Read | spec_metadata.js | Metadata |
| `git rev-parse --short HEAD` | Read | spec_metadata.js | Metadata |
| `git rev-parse HEAD` | Read | requesting-code-review | Code Review |
| `git status` | Read | commit.md, research_codebase.md | Status Check |
| `git diff` | Read | commit.md, write_docs.md, systematic-debugging | Change Inspection |
| `git diff --cached --stat` | Read | commit.md | Safety Check |
| `git diff HEAD~N..HEAD` | Read | validate_plan.md | Validation |
| `git diff --stat` | Read | write_docs.md | Documentation |
| `git log --oneline -n N` | Read | commit.md, validate_plan.md, write_docs.md | History |
| `git log --oneline` | Read | write_docs.md, requesting-code-review | History |
| `git branch --show-current` | Read | research_codebase.md | Permalink Generation |
| `git commit <files> -m "msg"` | Write | commit.md, brainstorming, writing-plans, writing-skills | Commit |
| `git add` | Write | writing-plans (template), CLAUDE.md (dev workflow) | Staging |
| `git push` | Write | writing-skills, CLAUDE.md (dev workflow) | Remote Sync |
| `git mv` | Write | settings.local.json (pre-approved) | File Rename |
| `gh repo view --json` | External API | research_codebase.md | GitHub Integration |

## Open Questions

- The `writing-plans` skill uses `git add` + `git commit` in its template, which contradicts the `commit.md` convention of direct commit syntax. This may be intentional (plan templates are illustrative) or an inconsistency.
- The `agent-browser/agents/browser-agent.md` calls `spec_metadata.js` but was not deeply analyzed as it's in a separate plugin.
