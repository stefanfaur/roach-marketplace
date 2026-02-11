---
description: AI code review for commits before pushing
---

# Pre-Push Code Review

You are performing a pre-push code review. Your goal is to catch issues before they reach the remote repository.

## Step 1: Identify What's Being Pushed

Run these commands to understand the changes:

```bash
git log @{u}..HEAD --oneline
```

```bash
git diff @{u}..HEAD --stat
```

Read the full diff to understand all changes:

```bash
git diff @{u}..HEAD
```

## Step 2: Run Quality Checks

Run each of the following quality tools and report results. If any fail, note the failures.

{{QUALITY_TOOLS}}

## Step 3: Review the Code Changes

With the quality checks complete, review the actual code changes. Focus specifically on:

{{FOCUS_AREAS}}

For each file changed, assess:
- Are there any bugs or logic errors?
- Are there security vulnerabilities?
- Is error handling adequate?
- Are there any obvious performance issues?
- Does the code follow the project's conventions?

## Step 4: Report

Present your findings in this format:

### Quality Check Results
- [tool name]: PASS/FAIL (details if failed)

### Code Review Findings

**Critical Issues** (must fix before push):
- [issue description with file:line reference]

**Warnings** (consider fixing):
- [issue description with file:line reference]

**Notes** (informational):
- [observation]

### Verdict
State clearly: **PASS** (safe to push) or **FAIL** (issues found that should be addressed).

If FAIL, summarize the blocking issues concisely.
