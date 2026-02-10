---
description: Write documentation with Elements of Style quality. Capture intermediary notes during implementation or finalize polished docs.
model: opus
---

# Write Documentation

You write or capture documentation. You operate in two modes based on what the user asks.

## Mode Detection

Read the user's instructions carefully:
- If they mention "capture", "notes", "interim", "jot down", or are mid-implementation → **Capture Mode**
- If they mention "finalize", "write", "produce", "polish", or implementation is complete → **Finalize Mode**
- If unclear, use AskUserQuestion to ask:
  - "Capture intermediary notes" (description: "Append documentation-relevant observations for later. Use during or between implementation sessions.")
  - "Write final documentation" (description: "Produce polished documentation from accumulated notes, plan, and code changes.")

---

## Capture Mode

Create or append intermediary documentation notes. These accumulate context across sessions so the final documentation pass has full information.

**This mode is lightweight.** Do not load any style guides or reference files. Focus on capturing facts quickly and accurately.

### Process:

1. **Determine the domain** from task context (e.g., accrual, kpi, project-management). If unclear, ask.

2. **Determine the feature name** from the user's instructions or the current plan. Use kebab-case.

3. **Check for existing notes** at `thoughts/shared/docs/<domain>/<feature>-notes.md`
   - If the file exists, read it fully and append a new section
   - If not, create it with the header below

4. **Gather what's documentable** by reviewing:
   - Recent git changes: run `git diff --stat` and `git log --oneline -10`
   - The current plan (if referenced or findable in `thoughts/shared/plans/<domain>/`)
   - What the user tells you
   - Do NOT spawn subagents. This should be fast.

5. **Write or append** to the notes file using this structure:

For a new file:
```markdown
# Documentation Notes: <Feature Name>

**Domain**: <domain>
**Plan**: `thoughts/shared/plans/<domain>/<plan-file>.md` (if applicable)
**Created**: YYYY-MM-DD

---
```

For each capture session, append:
```markdown
## [YYYY-MM-DD HH:MM] Session Notes

### What Changed
- [Concrete description of code/behavior changes with file:line refs]

### User-Facing Impact
- [How this affects users, if at all. "None" if purely internal.]

### API / Configuration Changes
- [New endpoints, changed parameters, new config options. "None" if N/A.]

### Key Decisions Made
- [Why certain approaches were chosen over alternatives]

### Still To Document
- [Things that need to be captured in future sessions]

---
```

6. **Confirm** to the user what was captured and where. Keep confirmation brief.

---

## Finalize Mode

Produce polished documentation by synthesizing all available context, then copyedit via a subagent loaded with Elements of Style rules.

### Process:

1. **Gather all inputs** (read each fully):
   - Intermediary notes: `thoughts/shared/docs/<domain>/<feature>-notes.md`
   - Implementation plan: find in `thoughts/shared/plans/<domain>/`
   - Research docs: find in `thoughts/shared/research/<domain>/` if relevant
   - Code changes: run `git log --oneline` and `git diff` for the feature
   - Any existing documentation the user points to

2. **Determine output location** by asking the user via AskUserQuestion:
   - "Update existing docs" (description: "Edit an existing documentation file like README, CHANGELOG, or docs/ files")
   - "Create new doc file" (description: "Write a new documentation file at a path you specify")
   - "Write to thoughts/" (description: "Save as a documentation draft in thoughts/shared/docs/<domain>/")

3. **Draft the documentation**:
   - Synthesize all inputs into a coherent narrative
   - Focus on WHAT changed, WHY, and HOW to use it
   - Write for the target audience (developers, users, ops - infer from context or ask)
   - Use active voice, positive form, specific language, and omit needless words

4. **Copyedit via subagent**:

   Dispatch a subagent using the Task tool (subagent_type: `general-purpose`) with this prompt:

   ```
   You are a technical writing copyeditor. You have two inputs:

   1. A DRAFT of technical documentation (below)
   2. The ELEMENTS OF STYLE reference (below)

   Your job: copyedit the draft applying Elements of Style rules. Focus especially on:
   - Rule 10: Use active voice
   - Rule 11: Put statements in positive form
   - Rule 12: Use definite, specific, concrete language
   - Rule 13: Omit needless words
   - Rule 16: Keep related words together
   - Rule 18: Place emphatic words at end of sentence

   Preserve all technical accuracy. Do not add information. Do not remove necessary detail.
   Fix grammar, tighten prose, strengthen verbs. Return ONLY the revised text.

   ## DRAFT:
   <the draft you wrote>

   ## ELEMENTS OF STYLE REFERENCE:
   <contents of ${CLAUDE_PLUGIN_ROOT}/lib/elements-of-style.md>
   ```

   Read `${CLAUDE_PLUGIN_ROOT}/lib/elements-of-style.md` and include its full contents in the subagent prompt. The subagent, not the main context, bears the ~12K token cost of the style guide.

5. **Write the final documentation** to the chosen location using the subagent's copyedited revision.

6. **Ask about cleanup**: Use AskUserQuestion:
   - "Delete intermediary notes" (description: "Remove thoughts/shared/docs/<domain>/<feature>-notes.md now that final docs are written")
   - "Keep intermediary notes" (description: "Preserve the notes for future reference")

---

## File Organization

- Intermediary notes: `thoughts/shared/docs/<domain>/<feature>-notes.md`
- Domain is auto-detected from task context; ask user if unclear
- Feature name is kebab-case, derived from the plan or user input
- Create `thoughts/shared/docs/<domain>/` if it doesn't exist (use `mkdir -p`)

---

## Examples

### Capture Mode
```
User: /write_docs capture notes for the accrual period type feature
Agent: [Reviews recent changes, appends to thoughts/shared/docs/accrual/accrual-period-type-notes.md]
```

### Finalize Mode
```
User: /write_docs finalize documentation for accrual period types
Agent: [Reads notes + plan + code, drafts docs, dispatches copyedit subagent, writes final output]
```

### In a Plan (Documentation Phase)
```
## Phase N: Documentation

### Overview
Produce final documentation for this feature using accumulated intermediary notes.

### Process
1. Run `/write_docs finalize <feature-name>`
2. Review the output
3. Commit the documentation
```
