---
title: Roach Plugin — Validated Improvements
date: 2026-02-26
domain: improvements
status: validated
critical-review: passed (2 subagents, web + codebase analysis)
---

# Roach Plugin — Validated Improvements

Three improvements survived critical review. All others were net negative or neutral — largely
because roach's existing design is intentional. The "weaknesses" identified in initial analysis
were design decisions that exist for specific reasons.

---

## 1. `PreCompact` Hook in context-monitor.js

**What to change:** Replace the `Stop`-event trigger in `hooks/context-monitor.js` with the
`PreCompact` hook event.

**Why it's better:** The current `Stop`-event approach monitors context *after* a response
completes. `PreCompact` fires *before* compaction happens — earlier, cleaner intervention.
The user gets the handoff prompt before context is lost, not after.

**How:** In `hooks/hooks.json`, replace the `Stop` event entry for context-monitor with
`PreCompact`. The `auto` matcher targets automatic compaction; `manual` targets user-triggered.
Both should be handled.

**Risk:** Low. Behavioral change is timing only — earlier prompt, same outcome.

---

## 2. `${CLAUDE_PLUGIN_ROOT}` in hooks.json

**What to change:** Replace hardcoded plugin script paths in `hooks/hooks.json` with
`${CLAUDE_PLUGIN_ROOT}`.

**Why it's better:** Users who install the plugin to non-default locations get silent failures
with hardcoded paths. `${CLAUDE_PLUGIN_ROOT}` is confirmed supported in hook command strings
and resolves to the plugin's actual installation root at runtime.

**Risk:** None. Pure portability fix.

---

## 3. `context: fork` for Select Skills

**What to change:** Add `context: fork` to the YAML frontmatter of skills that do heavy
analysis or multi-step execution work.

**Why it's better:** `context: fork` runs the skill in an isolated subagent context, keeping
the main conversation window clean. Skills that consume large tool outputs or run long
execution sequences bloat the main context unnecessarily. The forked context is discarded
after the skill completes; only the result surfaces to the main session.

**Which skills are candidates:** To be determined — requires exploring which skills genuinely
benefit from isolation vs. which need access to the full conversation history to function.
See `thoughts/shared/research/improvements/2026-02-26-context-fork-exploration.md`.

**Risk:** Medium. Skills using `context: fork` lose access to conversation history. Skills
that need prior context to operate correctly (e.g. `brainstorming`, `receiving-code-review`)
must NOT use it.

---

## Improvements That Did Not Hold Up

For reference — all other proposed themes were rejected:

| Theme | Reason Rejected |
|-------|----------------|
| `maxTurns` for subagents | Defeats "repeat until approved" guarantee |
| `isolation: worktree` | Merge overhead; no observed problem |
| `skills:` pre-injection | Controller curation is the design; static injection is inflation |
| `memory: project` for codebase-analyzer | Stateless by design; stale memory = false confidence |
| Tiered verification | IS the rationalization the skill was built to prevent |
| Abort criteria in executing-plans | Already covered by "stop on any blocker" |
| `AskUserQuestion` in brainstorming | Structuralizes a deliberately conversational process |
| research-codebase skill | Category confusion; skills and commands are different paths |
| Agent selection decision tree | Descriptions already unambiguous; locator has no Read tool |
| Agent Teams for subagent-driven-development | Experimental; loses deterministic sequencing |
| Update writing-skills frontmatter | Not stale; correctly scoped to skill file format |
| `input_examples` field | REFUTED — does not exist in Claude Code skill/agent frontmatter |
