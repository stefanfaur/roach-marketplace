---
date: 2026-02-11T14:01:00.120Z
researcher: stefanfaur
git_commit: 3cae429
branch: main
repository: roach-marketplace
topic: "Remove unsafe blanket git operations to support IntelliJ changelist workflows"
tags: [plan, git, commit, validate-plan, write-docs, brainstorming, systematic-debugging, changelists]
status: complete
last_updated: 2026-02-11
last_updated_by: stefanfaur
---

# Plan: Git Operations Changelist Safety

**Date**: 2026-02-11T14:01:00.120Z
**Git Commit**: 3cae429
**Branch**: main
**Repository**: roach-marketplace

## Problem

The roach plugin's tools run blanket git commands (`git status`, `git diff`, `git log`, `git diff --cached`) that inspect the full staging area and working tree. When using IntelliJ changelists, many files are staged that belong to unrelated work. This causes:

- Wasted context from irrelevant file diffs
- Risk of committing files from other changelists
- Confusion when agents see unrelated staged markdown or config files

## Design Principle

**Never inspect the full staging area or run blanket git commands.** Either receive explicit file lists as arguments or scope git commands to known-relevant files only.

## Changes

### Task 1: Rewrite `roach/commands/commit.md`

**File**: `roach/commands/commit.md`

**Current behavior**: Runs `git status`, `git diff`, `git diff --cached --stat` to discover all changes, then commits.

**New behavior**: Requires explicit file paths as command arguments. Fails immediately if none provided.

**New workflow**:

1. **Validate arguments** - if no file paths provided as arguments, stop immediately and ask the developer to provide them. Do not proceed.
2. **Read scoped diffs** - run `git diff -- <file1> <file2> ...` scoped to only the provided files. Do NOT run blanket `git status` or `git diff`.
3. **Analyze and split intelligently** - understand the changes across provided files. Determine whether they form one logical commit or should be split into multiple commits (e.g., separate a refactor from a feature addition).
4. **Draft commit message(s)** - propose message(s) to the user with reasoning for any splits.
5. **Confirm with user** - present the proposed commit(s) and wait for approval.
6. **Execute** - use `git commit <files> -m "message"` (direct commit syntax, no `git add`).
7. **Show result** - run `git log --oneline -n <number of commits>` to confirm.

**Remove entirely**:
- `git status`
- `git diff` (blanket, unscoped)
- `git diff --cached --stat`
- All safety-check logic for pre-staged files (unnecessary when we never look at the staging area)
- All references to IDE changelists as a special case (this is now the default mode)

**Keep**:
- Direct commit syntax (`git commit <files> -m`)
- No `Co-Authored-By` / no AI attribution rule
- `git log` for showing results
- Never use `-uall` flag note

---

### Task 2: Rewrite `roach/commands/validate_plan.md` git section

**File**: `roach/commands/validate_plan.md`

**Current behavior**: Runs `git log --oneline -n 20` and `git diff HEAD~N..HEAD` to see implementation changes.

**New behavior**: Requires explicit file paths as command arguments. No git by default. Optionally accepts a flag or instruction indicating changes are committed.

**New workflow for "gather implementation evidence" step**:

1. **Validate arguments** - if no file paths provided, stop and ask the developer to provide them.
2. **Read the plan** - load the plan document to understand expected changes.
3. **Read provided files** - inspect each file's current on-disk state (using Read tool, not git).
4. **Cross-reference** - check whether plan requirements are reflected in the files.
5. **Run verification commands** - execute the plan's test/check commands from the project root.

**If the user specifies changes are committed**: use `git log` and `git diff` scoped to the specified commit range to gather evidence instead of reading files directly.

**Remove entirely**:
- `git log --oneline -n 20` (blanket)
- `git diff HEAD~N..HEAD` (blanket)
- `cd $(git rev-parse --show-toplevel)` (use working directory directly or a simpler method)

---

### Task 3: Remove all git from `roach/commands/write_docs.md`

**File**: `roach/commands/write_docs.md`

**Current behavior**: Runs `git diff --stat`, `git log --oneline -10` in capture mode and `git log --oneline`, `git diff` in finalize mode.

**New behavior**: No git commands at all. Relies on conversation context and explicit file references.

**Changes**:
- **Capture mode** (step 4, "Gather what's documentable"): Remove `git diff --stat` and `git log --oneline -10`. Replace with: review conversation context, any files mentioned by the user, and existing documentation notes.
- **Finalize mode**: Remove `git log --oneline` and `git diff`. Replace with: read previously captured notes and referenced source files directly.

---

### Task 4: Remove git commit from `roach/skills/brainstorming/SKILL.md`

**File**: `roach/skills/brainstorming/SKILL.md`

**Current behavior**: The "After the Design" / "Documentation" section includes "Commit the design document to git".

**New behavior**: Remove the commit instruction. The skill writes the design document to disk but does not commit. The user commits when ready using `/commit` with explicit files.

**Change**: Remove the line "- Commit the design document to git" from the Documentation section. Everything else stays the same.

---

### Task 5: Scope git diff in `roach/skills/systematic-debugging/SKILL.md`

**File**: `roach/skills/systematic-debugging/SKILL.md`

**Current behavior**: Step 3 "Check Recent Changes" references "Git diff, recent commits" broadly.

**New behavior**: Keep git diff but scope it to only the files under investigation. Add explicit awareness of changelist noise.

**Change the "Check Recent Changes" section to instruct**:
- Only run `git diff -- <specific files>` for files relevant to the bug being investigated
- Do NOT run blanket `git diff` as the staging area contains unrelated changes from other changelists
- Staged markdown files and config files from other changelists should be ignored
- If recent commits are relevant, scope `git log` to the specific files too: `git log --oneline -n 10 -- <files>`

---

## File Summary

| File | Action |
|------|--------|
| `roach/commands/commit.md` | Rewrite - require file args, scoped diff only |
| `roach/commands/validate_plan.md` | Edit git section - require file args, read files directly |
| `roach/commands/write_docs.md` | Edit - remove all git commands |
| `roach/skills/brainstorming/SKILL.md` | Edit - remove commit instruction |
| `roach/skills/systematic-debugging/SKILL.md` | Edit - scope git diff to relevant files |

## Success Criteria

- [x] `commit.md` fails gracefully when invoked without file arguments
- [x] `commit.md` never runs `git status`, `git diff` (unscoped), or `git diff --cached`
- [x] `validate_plan.md` does not run any git commands by default
- [x] `validate_plan.md` accepts optional instruction for committed changes
- [x] `write_docs.md` contains zero git commands
- [x] `brainstorming/SKILL.md` does not mention committing
- [x] `systematic-debugging/SKILL.md` only diffs specific files, not blanket
