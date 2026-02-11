---
description: Create git commits with user approval and no Claude attribution
---

# Commit Changes

You are tasked with creating git commits for explicitly provided files.

## Arguments

This command REQUIRES file paths as arguments. If no file paths are provided, respond with:

```
I need explicit file paths to commit. Please provide them:
/commit file1.java file2.java path/to/file3.ts
```

Do NOT proceed without file arguments. Do NOT run `git status` or `git diff` to discover files.

## Process:

1. **Read scoped diffs:**
   - Run `git diff -- <file1> <file2> ...` scoped to ONLY the provided files
   - Do NOT run blanket `git status`, `git diff`, or `git diff --cached`
   - Only inspect the files you were given

2. **Analyze and split intelligently:**
   - Understand the changes across the provided files
   - Determine whether they form one logical commit or should be split into multiple commits (e.g., separate a refactor from a feature addition)
   - Use imperative mood in commit messages
   - Focus on why the changes were made, not just what

3. **Present your plan to the user:**
   - List the exact files for each commit
   - Show the commit message(s) you'll use
   - If splitting into multiple commits, explain the reasoning
   - Ask: "I plan to create [N] commit(s) with these changes. Shall I proceed?"

4. **Execute upon confirmation:**
   - **ALWAYS use direct commit syntax**: `git commit <file1> <file2> ... -m "message"`
   - **NEVER use** `git add` followed by `git commit -m` (this commits ALL staged files!)
   - Show the result with `git log --oneline -n [number of commits created]`

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
- The user trusts your judgment on splitting - they asked you to commit

## Example:
```bash
# Commits only the specified files
git commit file1.java file2.java -m "message"
```
