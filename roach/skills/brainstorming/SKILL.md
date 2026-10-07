---
name: brainstorming
description: "Use before any creative work — creating features, building components, adding functionality, or modifying behavior — before writing code or invoking an implementation skill."
---

# Brainstorming Ideas Into Designs

Turn an idea into an approved design through dialogue. Scale the ceremony to the request; never skip the approval.

Don't enter plan mode on your own — it blocks Write/Edit, and writing-plans handles structured planning.

## Approval Comes Before Implementation

Take no implementation action — product code, scaffolding, installing dependencies, invoking an implementation skill — until the user approves your path's design. Read-only exploration is fine before that.

A reply approves only the stage you actually showed: "that scope is fine" approves the scope, not a spec or plan that doesn't exist yet. "Too simple to need a design" is where unexamined assumptions waste the most work; a simple change just gets a two-sentence design.

## Pick a Path

Before your first question, classify the request and say so ("this looks bounded, so I'll design it here in chat rather than write a spec") so the user can override:

| Path | When | Process |
|---|---|---|
| **Spike** | Feasibility question: "can we…", "is it possible…", quick-and-dirty | State the question and what you'll try in 2-3 sentences, get a nod, investigate as cheaply as correctness allows, report a recommendation. Anything built is throwaway. |
| **Bounded** | Well-scoped change to a flow that already exists in this repo: a flag, a small endpoint, a one-file fix | Explore, ask what matters, present a short design in chat (approach, files touched, testing), wait for an explicit yes, then implement with test-driven-development. No spec, no plan file. |
| **Architectural** | New project or subsystem; changes to how components fit together or to interfaces others depend on | The full process below, ending in writing-plans. |

Bounded measures the repo, not your familiarity: a new project has no existing flow to change, so it's architectural. Torn between two paths, take the heavier. If hidden complexity shows up mid-task, stop, say so, and step up — nothing steps down. Keeping a spike's code is a new request; classify it.

## Show, Then Ask

The AskUserQuestion box shows only a short question and option labels. Whatever a question refers to — a design section, the approaches, a spec path — must be printed as message text earlier in the same message. After a revision, reprint the full revised section, not a summary of what changed: what the user read last turn is the old version.

Before each AskUserQuestion, check: is everything this asks about visible above it, in this message? If not, print it first.

## Architectural Process

Create a task per step and work them in order:

1. **Explore project context** — files, docs, recent commits. When the work changes an existing codebase, invoke researching-codebase with a question covering the code this touches and what it could extend or reuse (similar features, helpers, utilities). Its research document grounds the approaches and goes to writing-plans. For a new project, a quick look is enough.
2. **Establish shared understanding** — the outcome, who it's for, what success looks like. Write it back in a short note that separates what the user said from your assumptions, and fold in their corrections. If they already gave purpose and constraints, reflect them back rather than re-asking.
   If the user already has a design in mind or asks to be grilled, run grill-me instead of steps 2-3; it produces a decisions document. Resume at step 4 without re-asking what it settled.
3. **Ask clarifying questions** — only ones whose answers change the design. Related questions can share one AskUserQuestion call (up to 4); prefer multiple choice. If the request spans several independent subsystems, say so before anything else, help split it, and design the first piece.
4. **Propose 2-3 approaches** — trade-offs, leading with your recommendation and why. Where existing code could plausibly carry the feature, one approach extends it. Cut unneeded features from every option.
5. **Present the design** in sections scaled to their complexity (a few sentences up to ~300 words): architecture, components, data flow, error handling, testing. Get approval per section; revise as needed.
6. **Write the spec** to `thoughts/shared/plans/<domain>/YYYY-MM-DD-<topic>-design.md` (domain from context; ask if unclear).
7. **Self-review the spec** inline: placeholders or TBDs, sections that contradict each other, scope that no longer fits one plan, requirements that read two ways (pick one and say it). Fix inline.
8. **User reviews the spec:** "Spec written to `<path>`. Please review it before we move to implementation planning." Wait for approval; on changes, edit and repeat step 7.
9. **Invoke writing-plans** with the spec path and the research document path, if any. It is the only skill to invoke next.

## Design Guidance

- Break the system into units with one clear purpose and well-defined interfaces, each understandable and testable on its own. For each unit you should be able to say what it does, how it's used, and what it depends on.
- Prefer smaller, focused files: you reason better about code you can hold in context, and your edits to it are more reliable.
- In existing code, follow established patterns. Include targeted improvements where existing problems affect the work; skip unrelated refactoring.
