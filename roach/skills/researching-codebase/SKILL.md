---
name: researching-codebase
description: Use when documenting codebase as-is through parallel agent research, producing a research document in thoughts/ to answer a specific question about how existing code works
---

# Research Codebase

Answer a question about how the codebase works today by dispatching research agents and synthesizing what they find.

Document what exists — where it lives, how it works, how the pieces connect — and leave out critique, improvement ideas, refactoring suggestions and root-cause analysis unless the user asks for them. The output is a map that other work builds on; brainstorming and code review do the evaluating, and opinions mixed into the map make it harder to trust. Tell every agent you dispatch the same: they are documenting, not evaluating.

## Getting the Question

If you were invoked with a research question (for example, from brainstorming), start at step 1. Otherwise reply:

```
I'm ready to research the codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring relevant components and connections.
```

and wait for the question.

## Scale to the Question

- **One-area question** ("where is X configured?", "what calls Y?") — one codebase-locator or codebase-pattern-finder dispatch, answer in chat, no document unless asked.
- **Multi-area question** (how a feature flows end to end, what a change would touch, what exists to reuse) — the full process below, with a research document.

Invocation from brainstorming always gets a document, since writing-plans reads it.

## Process

1. **Read mentioned files first.** Read any files the user or calling skill named — in full — before dispatching anything, so you can decompose the question with real context.

2. **Decompose.** Split the question into areas that can be researched independently, and track them with TaskCreate. Think through how the areas likely connect so each agent gets a focused question.

3. **Dispatch agents in parallel**, one per area:
   - **codebase-locator** — where files and components live
   - **codebase-analyzer** — how specific code works
   - **codebase-pattern-finder** — existing examples of a pattern, and code that could be reused
   - **thoughts-locator** / **thoughts-analyzer** — earlier research, plans and decisions in `thoughts/`
   - **web-search-researcher** — only if the user asks; have it return links and include them

   Start with locators, then point analyzers at the most promising finds. Tell each agent what to find, not how to search — they know their job.

4. **Synthesize** once all agents have returned. Live code is the source of truth; `thoughts/` documents are historical context. Connect findings across components, answer the question with concrete evidence, and cite every claim as `path/to/file.ext:line`.

5. **Check for gaps** (multi-area research only). List what the question asked that the findings don't answer. If anything matters, run one round of targeted agents for those gaps; whatever is still open after that goes under Open Questions.

6. **Write the document** to `thoughts/shared/research/<domain>/YYYY-MM-DD-<kebab-description>.md`. Infer the domain from the question; ask if unclear. Get metadata from `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec_metadata.js` and fill every field — no placeholders.

7. **Report.** Give a short summary with the key file references. If another skill invoked you, return the document path to it and stop; otherwise ask whether the user has follow-up questions.

## Document Format

```markdown
---
date: [ISO date-time with timezone]
researcher: [git user.name]
git_commit: [commit hash]
branch: [branch]
repository: [repository]
topic: "[question or topic]"
tags: [research, codebase, component-names]
status: complete
last_updated: [YYYY-MM-DD]
last_updated_by: [git user.name]
---

# Research: [question or topic]

## Research Question
[The original question]

## Summary
[What exists, answering the question]

## Detailed Findings

### [Component or area]
- What exists and how it works (`file.ext:line`)
- How it connects to other components

## Code References
- `path/to/file.py:123` — what's there

## Reusable Code
[Existing helpers, utilities and patterns relevant to the question, with `file:line` — omit if none]

## Historical Context
[Relevant thoughts/ documents, with paths]

## Open Questions
[What the research couldn't answer]
```

Use snake_case for multi-word frontmatter fields; other skills read them.

## Follow-ups

For follow-up questions, append a `## Follow-up Research [timestamp]` section to the same document, update `last_updated` and `last_updated_by`, add a `last_updated_note`, and dispatch new agents as needed. Always research the live code again rather than relying on an earlier document alone.
