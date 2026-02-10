---
description: Create git commits with user approval and no Claude attribution
---

# Commit Changes

You are tasked with creating git commits for the changes made during this session.

## Process:

1. **Think about what changed:**
   - Review the conversation history and understand what was accomplished
   - Run `git status` to see current changes (note: never use `-uall` flag)
   - Run `git diff` to understand the modifications
   - Consider whether changes should be one commit or multiple logical commits

2. **Safety check for pre-staged files:**
   - Run `git diff --cached --stat` to check if ANY files are already staged
   - If other files are staged (e.g., from IntelliJ changelists), DO NOT use `git add` workflow
   - This is critical: the user may have files staged in IDE changelists that must not be committed

3. **Plan your commit(s):**
   - Identify which files belong together
   - Draft clear, descriptive commit messages
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

4. **Present your plan to the user:**
   - List the exact files for each commit
   - Show the commit message(s) you'll use
   - If pre-staged files were detected, explicitly note: "I will commit ONLY these files (other staged files will not be affected)"
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

5. **Execute upon confirmation:**
   - **ALWAYS use direct commit syntax**: `git commit <file1> <file2> ... -m "message"`
   - **NEVER use** `git add` followed by `git commit -m` (this commits ALL staged files!)
   - The direct syntax commits ONLY the specified files, preserving other staged files
   - Show the result with `git log --oneline -n [number]`

## Critical Safety Rules:
- **NEVER use `git add` + `git commit -m`** - this pattern commits ALL staged files, breaking IDE changelists
- **ALWAYS use `git commit <files> -m`** - this commits ONLY the specified files
- **NEVER run `git reset HEAD`** or similar commands that modify the staging area without explicit user request
- The user may have IntelliJ changelists with carefully organized staged files - preserve them!

## Important:
- **NEVER add co-author information or Claude attribution**
- Commits should be authored solely by the user
- Do not include any "Generated with Claude" messages
- Do not add "Co-Authored-By" lines
- Write commit messages as if the user wrote them

## Remember:
- You have the full context of what was done in this session
- Group related changes together
- Keep commits focused and atomic when possible
- The user trusts your judgment - they asked you to commit

## Example - Correct vs Incorrect:
```bash
# ✗ WRONG - commits everything staged (breaks changelists!)
git add file1.java file2.java
git commit -m "message"

# ✓ CORRECT - commits only these files
git commit file1.java file2.java -m "message"
```