---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies
---

# Dispatching Parallel Agents

Dispatch one agent per independent problem, all at once. Each gets a context you build for it — never your session's history — which keeps it focused and keeps your own context free for coordination.

## When to Use

Use when each problem can be understood and fixed without the others: test files failing for different root causes, subsystems broken independently, several areas of a codebase to map.

Don't parallelize when:
- **Failures may share a cause** — fixing one might fix the rest. Investigate together first.
- **You don't know what's broken yet** — explore before splitting.
- **Agents would touch the same files or resources** (a shared database, a port, a lockfile) — they'd overwrite each other. Run those one after another.

## The Pattern

1. **Split by domain.** Group the work by what's broken — e.g. abort logic in `agent-tool-abort.test.ts`, event delivery in `batch-completion-behavior.test.ts`, counting in `tool-approval-race-conditions.test.ts`. Confirm no two groups edit the same file.
2. **Pick the agent type.**
   - Read-only investigation → roach's scoped agents: `codebase-locator` (where things live), `codebase-analyzer` (how a component works), `codebase-pattern-finder` (similar implementations), `thoughts-locator` (existing docs under `thoughts/`), `web-search-researcher` (external information). They can't edit code by accident.
   - Anything that edits files → `general-purpose`.
3. **Write a self-contained prompt per agent** (below). Specify the model on every dispatch — an omitted one inherits the session's, usually the most expensive. Use the least capable model that finishes in few turns.
4. **Dispatch them all in one response.** Several Agent calls in one message run concurrently; one per message runs them in sequence.
5. **Integrate** (see After Agents Return).

Editing agents that commit in the same checkout can collide on git's index lock. Either have them leave changes uncommitted and commit yourself after integrating, or give each its own worktree (`isolation: "worktree"`).

## Writing the Prompt

Subagents can't see your conversation and can't use AskUserQuestion, so the prompt is everything they get. Each one needs:
- **Scope:** one file or subsystem, and what not to touch
- **Context:** error messages, test names, relevant paths
- **Goal and constraints:** what done means, and which shortcuts are off-limits
- **Output:** what to return, kept short — root cause, files changed, test result. Everything an agent prints stays in your context, so for bulky output have it write a file and return the path.

```markdown
Fix the 3 failing tests in src/agents/agent-tool-abort.test.ts:

1. "should abort tool with partial output capture" — expects 'interrupted at' in message
2. "should handle mixed completed and aborted tools" — fast tool aborted instead of completed
3. "should properly track pendingToolCount" — expects 3 results but gets 0

These look like timing issues. Find the root cause: replace arbitrary timeouts
with event-based waiting, and fix real bugs in the abort implementation. Don't
just raise timeouts, and don't edit other test files.

Return: root cause, files changed, and the test command with its pass/fail counts.
```

| Mistake | Fix |
|---|---|
| "Fix all the tests" — the agent gets lost | One file or subsystem per agent |
| "Fix the race condition" — the agent doesn't know where | Paste the errors and test names |
| No constraints — the agent refactors everything | Say what's off-limits |
| "Fix it" — you can't tell what changed | Ask for root cause, changes and test evidence |

## After Agents Return

1. Read each summary, then check the diff — a report is a claim.
2. Check for conflicts: did two agents touch the same code?
3. Run the full test suite yourself; each agent's passing tests don't prove the fixes work together.
4. Spot-check: parallel agents can make the same systematic mistake.

## Tracking

Create a task per agent with TaskCreate (no `blockedBy` — parallel work is independent) and mark it complete once its result is verified. If the work belongs to a plan, you — not the agents — update `<plan-path>.tasks.json` in the same step: the task's `status` to `completed`, `commits` to its `<base7>..<head7>` range, decisions you made to `rulings`, findings you chose not to act on to `deferred`, and `lastUpdated`.
