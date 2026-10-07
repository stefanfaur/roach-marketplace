---
name: committing
description: Use when creating git commits with user approval, whether committing explicit file paths or auto-discovering all changes
---

# Commit Changes

You are tasked with creating git commits. You support two modes: explicit file paths as arguments, or auto-discovery when no arguments are given.

## Mode 1: Explicit Files

If file paths are provided as arguments:

1. **Read scoped diffs:**
   - Run `git diff -- <file1> <file2> ...` scoped to the provided files only
   - Skip blanket `git status`, `git diff` and `git diff --cached` — the user scoped the commit, and other changes aren't yours to read

2. **Analyze and split intelligently:**
   - Determine whether the files form one logical commit or should be split
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

3. **Present your plan to the user:**
   - List the exact files for each commit
   - Show the commit message(s) you'll use
   - If splitting into multiple commits, explain the reasoning
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

4. **Execute upon confirmation** (see Commit Syntax):
   - `git commit <file1> <file2> ... -m "message"`
   - Show the result with `git log --oneline -n [number of commits created]`

## Mode 2: No Arguments (Auto-Discovery)

If no file paths are provided:

1. **Discover all changes:**
   - Run `git status` to list all staged and unstaged files
   - Run `git diff --cached` to inspect staged changes
   - Run `git diff` to inspect unstaged changes

2. **Analyze and propose grouping:**
   - Group files by logical relationship: same feature, same domain, same type of change (e.g. config vs. implementation vs. tests)
   - Always propose a grouping, whether that results in one commit or several
   - If a file has both staged and unstaged changes, note it explicitly:
     > "note: file.ts has both staged and unstaged changes — this will commit only the staged portion"

3. **Present the proposal — always required:**

   ```
   I found changes across N files. Here's how I'd group them:

   Commit 1: "feat: add X"
     - path/to/file1.ts
     - path/to/file2.ts

   Commit 2: "chore: update config"
     - config/settings.json

   Does this grouping look right, or would you like to adjust?
   ```

4. **Wait for user confirmation.** The user may approve as-is or adjust (merge commits, exclude files, reword messages). Commit only after they confirm.

5. **Execute upon confirmation** (see Commit Syntax):
   - `git commit <file1> <file2> ... -m "message"` per commit, in the order proposed
   - Show the result with `git log --oneline -n [number of commits created]`

## Commit Syntax

Always name the files on the commit itself: `git commit <file1> <file2> ... -m "message"`. Never `git add` then a bare `git commit -m` — that commits everything staged, including changes the user parked in other IDE changelists.

`git commit <paths>` only accepts tracked files. For a new, untracked file, `git add <that file>` first; the path-scoped `git commit` still commits only the listed paths.

## Authorship

Commits are authored solely by the user. Don't add Co-Authored-By lines, Claude attribution, or "Generated with Claude" messages; write messages as if the user wrote them.
