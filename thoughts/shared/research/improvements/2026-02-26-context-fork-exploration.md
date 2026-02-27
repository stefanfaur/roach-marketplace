---
title: context:fork — Skill Forking Exploration for Roach
date: 2026-02-26
domain: improvements
status: validated
depends_on: 2026-02-26-roach-validated-improvements.md
---

# context:fork — Skill Forking Exploration for Roach

## What `context: fork` Does

Adds `context: fork` to a skill's YAML frontmatter. When Claude Code invokes that skill via
the Skill tool, instead of loading the skill instructions inline into the main context, a
subagent is spawned with the SKILL.md as its task prompt. Only the final summary returns to
the main conversation. Intermediate tool calls, file reads, grep results — none of it enters
the main context window.

**The forked context gets:**
- SKILL.md content as its task
- CLAUDE.md from the project
- System prompt from the chosen `agent:` type
- Tools appropriate to the agent type

**The forked context does NOT get:**
- Conversation history — primary isolation mechanism
- Main context's in-flight state

**The `agent:` companion field** specifies which subagent type drives execution:
`Explore` (read-only, lighter model), `Plan`, `general-purpose`, or any custom agent
in `.claude/agents/`. Defaults to `general-purpose` if omitted.

**Feature status:** Live as of January 10, 2026 (issue #17283 closed/completed).

---

## Critical Constraint: Task Tool Unavailable

The Task tool is **not available** inside forked skill contexts. This is a hard architectural
constraint: any skill whose mechanism IS dispatching subagents cannot be forked.

---

## Two Disqualifying Patterns

**Pattern 1 — Behavioral guidelines (not tasks):**
Skills that exist to modify the main agent's behavior, not to execute a self-contained task.
These have no actionable prompt for a forked agent. The official docs explicitly warn:
> "context: fork only makes sense for skills with explicit instructions. If your skill
> contains guidelines without a task, the subagent receives the guidelines but no
> actionable prompt, and returns without meaningful output."

**Pattern 2 — Subagent orchestrators:**
Skills that use the Task tool as their primary mechanism. Forking disables the mechanism.

---

## Per-Skill Verdicts

| Skill | Verdict | Reason |
|-------|---------|--------|
| `systematic-debugging` | DO NOT FORK | Pure guideline; requires full conversation history; human back-and-forth throughout |
| `subagent-driven-development` | DO NOT FORK | Task tool is its entire mechanism; unavailable in forked context |
| `executing-plans` | DO NOT FORK | Human checkpoint loops between batches are central; fork breaks review cycle |
| `requesting-code-review` | **BENEFIT — with redesign** | Review work should be isolated; only summary needs to return |
| `writing-plans` | **BENEFIT — with redesign** | Codebase exploration bloats main context; clean artifact (plan file) is the output |
| `brainstorming` | DO NOT FORK | Multi-turn Socratic dialogue; conversation history IS the medium |
| `verification-before-completion` | DO NOT FORK | Textbook guideline-without-task; returns empty |
| `dispatching-parallel-agents` | DO NOT FORK | Task tool is its entire mechanism; unavailable in forked context |

---

## The Two Candidates in Detail

### `requesting-code-review`

**Why it fits:**
- Does expensive exploratory work: reads file diffs, scans implementation, checks plan compliance
- These intermediate reads don't need to be in the main context
- Clean artifact output: a structured Strengths / Issues / Assessment block

**Required redesign:**
Currently delegates to a `code-reviewer` subagent via Task tool. In a forked version, the
`code-reviewer` instructions must be embedded directly in the SKILL.md (the fork IS the
agent — no further Task dispatch available).

**Pattern:**
```yaml
---
name: requesting-code-review
context: fork
agent: Explore
---
[embedded code-reviewer instructions here, replacing the Task dispatch]
```

Shell injection can provide the diff upfront:
```
!`git diff $BASE_SHA..$HEAD_SHA -- .`
```

**What changes:** The code-reviewer subagent definition becomes redundant for this path.
The fork runs the review directly. The main context receives one clean review block.

---

### `writing-plans`

**Why it fits:**
- Reads 10-20 files during codebase exploration before writing the plan
- Those intermediate reads currently enter the main context unnecessarily
- Clean artifact output: a plan file at a known path

**Required redesign:**
The skill's current requirement-gathering dialogue (one question at a time, clarify domain)
must happen in the main context BEFORE forking. The fork receives gathered requirements as
`$ARGUMENTS` and runs the exploration + writing in isolation.

**Two-phase structure:**
1. **Inline phase** (main context): Ask clarifying questions, gather domain + requirements
2. **Fork phase** (isolated): Run codebase exploration, write plan file, return path

**Pattern:**
```yaml
---
name: writing-plans
context: fork
agent: Explore
argument-hint: "domain, requirements summary, key files to examine"
---
[plan-writing instructions here, expecting $ARGUMENTS with gathered context]
```

**What changes:** The brainstorming/requirements phase moves upstream (before the Skill
tool invocation). The Skill tool call carries gathered context as arguments.

---

## Implementation Order

1. `requesting-code-review` first — simpler redesign, no pre-fork phase needed
2. `writing-plans` second — requires splitting the skill into inline + forked phases

Both require writing the embedded agent instructions directly into SKILL.md rather than
delegating via Task. The code-reviewer.md template content becomes the fork's body.
