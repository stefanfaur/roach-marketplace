---
name: grill-me
description: Use when the user wants their plan or design stress-tested — poke holes, challenge assumptions, devil's-advocate pushback — mentions "grill me", or arrives at brainstorming with a design already in their head.
argument-hint: "path to plan/design doc, or the topic to grill"
---

# Grill Me

Interview your human partner relentlessly about their plan or design until every branch of the decision tree is resolved. You are stress-testing their thinking, not collecting preferences.

Works standalone or as a brainstorming companion: when your partner already has a design in their head, grill first — the decisions document below then feeds the brainstorming design instead of its clarifying questions.

## Setup

1. If given a doc path, read it fully first and build the question tree from it. Otherwise build the tree from what your partner has told you so far.
2. Create a task (TaskCreate) per open branch; close each as it resolves. The session ends when no branches remain open — not when the conversation feels done.

## Asking

- One question at a time. Prefer AskUserQuestion with your recommended answer as the first option, marked "(Recommended)".
- Order by load-bearing weight: decisions with dependents first (data model, irreversibility, security, integration points); polish last. Skip questions whose answer wouldn't change the design.
- Show, then ask: if a question refers to part of a doc, quote that part in the same message.
- If a question can be answered by exploring the codebase or thoughts/ docs, explore instead of asking — dispatch the read-only agents (codebase-locator, codebase-analyzer) for anything non-trivial.

## Actually Grill

- Challenge answers that conflict with the codebase, an earlier answer, or a stated constraint — cite the conflict and make your partner pick. Never smooth it over.
- For each major decision, ask what breaks: failure modes, edge cases, "what happens when X is down / empty / huge".
- No performative agreement. If an answer creates a problem, say so with the technical reason.

## Ending: The Decisions Document (always)

Every grill session ends with a decisions document — no exceptions, including sessions your partner cuts short. Grilling that lives only in chat history is wasted.

- If you grilled an existing plan/design doc: update it in place with the resolved decisions and note "grilled YYYY-MM-DD" at the top.
- Otherwise: write `thoughts/shared/plans/<domain>/YYYY-MM-DD-<topic>-decisions.md` — one line per decision with its rationale, plus an "Unresolved" section for anything deferred or cut short.

Print the file path, then:

- **Inside brainstorming:** resume the brainstorming flow at "Propose 2-3 approaches", building on the resolved decisions — never re-open what the grill resolved; propose approaches only where branches remain open.
- **Standalone:** ask whether to proceed to brainstorming or writing-plans with the decisions document as input.
