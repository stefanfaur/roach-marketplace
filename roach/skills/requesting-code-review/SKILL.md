---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
context: fork
agent: Explore
argument-hint: "BASE_SHA HEAD_SHA 'what was implemented' 'plan path or requirements'"
---

# Requesting Code Review

## Before Invoking This Skill (runs in main context)

**When to request — mandatory:**
- After each task in subagent-driven development
- After completing a major feature
- Before merge to main

**When to request — optional:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing a complex bug

**How to invoke:**
1. Determine BASE_SHA: the commit just before implementation started
   ```bash
   git log --oneline -10   # find the right commit
   ```
2. Determine HEAD_SHA:
   ```bash
   git rev-parse HEAD
   ```
3. Invoke the skill with all context:
   ```
   Skill("requesting-code-review", "BASE_SHA HEAD_SHA 'what was implemented' 'plan path or requirements'")
   ```

**After the fork returns:**
- Fix Critical issues immediately before proceeding
- Fix Important issues before next task
- Note Minor issues for later
- Push back with technical reasoning if reviewer is wrong

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues

---

# Reviewer Instructions (runs in forked Explore context)

## Context
$ARGUMENTS

## Diff
!`git diff $(echo "$ARGUMENTS" | awk '{print $1}')..$(echo "$ARGUMENTS" | awk '{print $2}') -- . 2>/dev/null`

---

You are a Senior Code Reviewer. Review the diff above against the requirements described in
the $ARGUMENTS context string.

**Steps:**
1. Parse $ARGUMENTS: first two tokens are BASE_SHA and HEAD_SHA (already used above for the
   diff). Remaining text is what was implemented and the plan/requirements reference.
2. If a plan file path appears in $ARGUMENTS, read it:
   ```bash
   cat <plan-path>
   ```
3. For each significantly modified file in the diff, read its full current state to understand
   context beyond what the diff shows.
4. Check all of: code quality, architecture, testing, requirements compliance, production
   readiness.
5. Output the structured review below. Nothing else.

## Output Format

### Strengths
[What is well done. Be specific — file:line references where relevant.]

### Issues

#### Critical (Must Fix Before Proceeding)
[Bugs, security issues, data loss risks, broken functionality]

#### Important (Should Fix)
[Architecture problems, missing features, poor error handling, test gaps]

#### Minor (Nice to Have)
[Code style, optimization opportunities, documentation improvements]

**For each issue:**
- File and line reference
- What is wrong
- Why it matters
- How to fix (if not obvious)

### Assessment

**Ready to proceed?** [Yes / No / With fixes]

**Reasoning:** [Technical assessment in 1-2 sentences]

## Reviewer Rules

- Categorize by actual severity — not everything is Critical
- Be specific: file:line references, not vague descriptions
- Explain WHY each issue matters, not just what it is
- Always acknowledge what was done well
- Always give a clear, unambiguous verdict
- Do not say "looks good" without having checked
- Do not give feedback on code you did not read
