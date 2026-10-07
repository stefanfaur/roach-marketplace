---
name: writing-skills
description: Use when creating new skills, editing existing skills, or verifying skills work before deployment
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

Personal skills live in `~/.claude/skills` (Claude Code) or `~/.agents/skills/` (Codex); plugin skills live in the plugin's `skills/` directory.

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**REQUIRED BACKGROUND:** test-driven-development defines the RED-GREEN-REFACTOR cycle this skill adapts to documentation.

**Official guidance:** anthropic-best-practices.md summarizes Anthropic's current skill-authoring and prompting guidance, with links to the live docs. This skill adds the testing discipline on top.

## What is a Skill?

A **skill** is a reusable reference for a proven technique, pattern, or tool that helps future Claude instances find and apply it — not a narrative about how you solved a problem once.

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |
| **Watch it fail** | Document exact rationalizations agent uses |
| **Refactor cycle** | Find new rationalizations → plug → re-verify |

## When to Create a Skill

**Create when:**
- Technique wasn't intuitively obvious to you
- You'd reference this again across projects
- Pattern applies broadly (not project-specific)
- Others would benefit

**Don't create for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put in CLAUDE.md)
- Mechanical constraints (if it's enforceable with regex/validation, automate it—save documentation for judgment calls)

## Skill Types

- **Technique** — concrete method with steps to follow (condition-based-waiting, root-cause-tracing)
- **Pattern** — way of thinking about problems (flatten-with-flags, test-invariants)
- **Reference** — API docs, syntax guides, tool documentation (office docs)

## Directory Structure

```
skills/
  skill-name/
    SKILL.md              # Main reference (required)
    supporting-file.*     # Only if needed
```

**Flat namespace** — all skills share one searchable namespace. Supporting files only for heavy reference (100+ lines) or reusable tools; keep everything else inline.

## SKILL.md Structure

**Frontmatter (YAML):**
- Required fields: `name` and `description` (the Agent Skills spec baseline)
- Claude Code supports further optional fields — `context: fork` + `agent`, `argument-hint`, `model`, `effort`, `allowed-tools`, `disable-model-invocation`, `user-invocable` — check the live docs before using them. With `context: fork`, the main conversation sees only the description and the fork's final result, never the body, and the fork can't ask the user anything; so put any invocation contract (required arguments) in the description, and keep skills that need the conversation or user input inline (roach's requesting-code-review forks; writing-plans runs inline)
- `description` max 1024 characters; the skill listing truncates description plus `when_to_use` at 1,536 characters
- `name`: lowercase letters, numbers, and hyphens only; must match the directory name
- `description`: third person, triggering conditions only (see CSO below)
  - Start with "Use when..."
  - Include specific symptoms, situations, and contexts
  - Keep under 500 characters if possible

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---
```

Typical body sections: **Overview** (core principle in 1-2 sentences), **When to Use** (symptoms, when NOT to use, a small flowchart only if the decision is non-obvious), **Core Pattern** (before/after), **Quick Reference** (table or bullets), **Implementation** (inline code, or links to heavy reference and tools), **Common Mistakes**.

## Claude Search Optimization (CSO)

Future Claude has to find your skill before it can use it: it hits a problem ("tests are flaky"), scans skill descriptions, loads the one that matches, skims the overview, and reads examples only when implementing. Put searchable terms early.

### 1. Rich Description Field

**Purpose:** Claude reads the description to decide which skills to load for a given task. Make it answer: "Should I read this skill right now?"

**Description = when to use, not what the skill does.** Describe triggering conditions only; never summarize the skill's process or workflow.

**Why this matters:** Testing revealed that when a description summarizes the skill's workflow, Claude may follow the description instead of reading the full skill content. A description saying "code review between tasks" caused Claude to do ONE review, even though the skill's flowchart clearly showed TWO reviews (spec compliance then code quality).

When the description was changed to just "Use when executing implementation plans with independent tasks" (no workflow summary), Claude correctly read the flowchart and followed the two-stage review process.

**The trap:** Descriptions that summarize workflow create a shortcut Claude will take. The skill body becomes documentation Claude skips.

```yaml
# ❌ BAD: Summarizes workflow - Claude may follow this instead of reading skill
description: Use when executing plans - dispatches subagent per task with code review between tasks

# ❌ BAD: Too much process detail
description: Use for TDD - write test first, watch it fail, write minimal code, refactor

# ✅ GOOD: Just triggering conditions, no workflow summary
description: Use when executing implementation plans with independent tasks in the current session

# ✅ GOOD: Triggering conditions only
description: Use when implementing any feature or bugfix, before writing implementation code
```

**Content:**
- Use concrete triggers, symptoms, and situations that signal this skill applies
- Describe the *problem* (race conditions, inconsistent behavior) not *language-specific symptoms* (setTimeout, sleep)
- Keep triggers technology-agnostic unless the skill itself is technology-specific
- If skill is technology-specific, make that explicit in the trigger
- Write in third person (injected into system prompt)
- Too abstract ("For async testing") or first person ("I can help you…") both fail


### 2. Keyword Coverage

Use words Claude would search for:
- Error messages: "Hook timed out", "ENOTEMPTY", "race condition"
- Symptoms: "flaky", "hanging", "zombie", "pollution"
- Synonyms: "timeout/hang/freeze", "cleanup/teardown/afterEach"
- Tools: Actual commands, library names, file types

### 3. Descriptive Naming

Name by what you DO or the core insight, in active voice. Gerunds (-ing) work well for processes:
- ✅ `creating-skills` not `skill-creation`
- ✅ `condition-based-waiting` not `async-test-helpers`
- ✅ `flatten-with-flags` not `data-structure-refactoring`
- ✅ `root-cause-tracing` not `debugging-techniques`

### 4. Token Efficiency

Getting-started and frequently-referenced skills load into every conversation, so every token is a recurring cost.

**Target word counts** (check with `wc -w skills/path/SKILL.md`):
- getting-started workflows: <150 words each
- Frequently-loaded skills: <200 words total
- Other skills: <500 words (still be concise)

**Techniques:** move flag lists to the tool's `--help`; cross-reference another skill instead of repeating its workflow (`REQUIRED: Use [other-skill-name]`); compress examples to the minimum that shows the pattern; don't explain what's obvious from a command or include several examples of the same pattern.

### 5. Cross-Referencing Other Skills

Use the skill name only, with an explicit requirement marker:
- ✅ Good: `**REQUIRED SUB-SKILL:** Use test-driven-development`
- ✅ Good: `**REQUIRED BACKGROUND:** Understand systematic-debugging first`
- ❌ Bad: `See skills/testing/test-driven-development` (unclear if required)
- ❌ Bad: `@skills/testing/test-driven-development/SKILL.md` (force-loads, burns context)

**Why no @ links:** `@` syntax force-loads files immediately, consuming context before you need them.

## Flowchart Usage

**Use flowcharts only for:** non-obvious decision points, process loops where you might stop too early, and "when to use A vs B" decisions.

**Not for:** reference material (tables, lists), code examples (markdown blocks), linear instructions (numbered lists), or labels without semantic meaning (step1, helper2).

See `graphviz-conventions.dot` in this directory for graphviz style rules.

## Code Examples

**One excellent example beats many mediocre ones.** Use the most relevant language; make it complete, runnable, from a real scenario, with comments on the WHY. No five-language ports, fill-in-the-blank templates, or contrived cases — you're good at porting.

## File Organization

| Layout | When |
|---|---|
| `SKILL.md` only | All content fits, no heavy reference needed |
| `SKILL.md` + `example.ts` | Tool is reusable code, not just narrative |
| `SKILL.md` + reference `.md` files + `scripts/` | Reference material too large for inline |

Invoke bundled scripts through their interpreter in the prose (`bash scripts/tool.sh`, `node scripts/tool.js`, `uv run scripts/tool.py`), never by bare path: some plugin packagers strip executable bits, and a bare `scripts/tool.sh` then fails with `Permission denied`.

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

**New skills:** wrote the skill before testing? Delete it and start over. Don't keep the untested draft as "reference", and don't "adapt" it while running the baseline — it will shape what you look for.

**Edits to existing skills** also need a failing test first, scaled to the change:
- A new rule, or a rewritten discipline section → run a pressure scenario against the current version, then the edited one.
- Reworded or trimmed guidance → micro-test the changed wording against the current wording (see Micro-Test below).

"Simple additions" and "just documentation updates" are not exempt — they are where untested wording slips in.

The test-driven-development skill explains why the order matters; the same reasoning applies to documentation.

## Testing All Skill Types

| Skill type | Examples | Test with | Success when |
|---|---|---|---|
| **Discipline** (rules) | TDD, verification-before-completion | Academic questions, pressure scenarios, combined pressures (time + sunk cost + exhaustion); add counters for each rationalization | Agent follows the rule under maximum pressure |
| **Technique** (how-to) | condition-based-waiting, root-cause-tracing | Application and variation scenarios; missing-information tests | Agent applies the technique to a new scenario |
| **Pattern** (mental model) | reducing-complexity | Recognition, application, counter-examples | Agent knows when and when not to apply it |
| **Reference** (docs/APIs) | API docs, command references | Retrieval, application, gap testing | Agent finds and correctly applies the information |

## Common Rationalizations for Skipping Testing

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "It's just a reference" | References can have gaps, unclear sections. Test retrieval. |
| "I'll test if problems emerge" | Problems = agents can't use skill. Test BEFORE deploying. |
| "I'm confident it's good" | Overconfidence guarantees issues. Test anyway. |
| "Academic review is enough" | Reading ≠ using. Test application scenarios. |

All of these mean: test before deploying.

## Match the Form to the Failure

Before writing guidance, classify the baseline failure. The form that bulletproofs one failure type measurably backfires on another.

| Baseline failure | Right form | Wrong form |
|---|---|---|
| Skips/violates a rule under pressure (knows better, does it anyway) | Prohibition + rationalization table + red flags (see Bulletproofing below) | Soft guidance ("prefer...", "consider...") |
| Complies, but output has the wrong shape (bloated prompt, buried verdict, restated spec) | Positive recipe or contract: state what the output IS — its parts, in order | Prohibition list ("don't restate", "never narrate") |
| Omits a required element from something they already produce | Structural: REQUIRED field or slot in the template they fill in | Prose reminders near the template |
| Behavior should depend on a condition | Conditional keyed to an observable predicate ("if the brief exists, reference it") | Unconditional rule + exemption clauses |

**Why prohibitions backfire on shaping problems:** under a competing incentive ("make the prompt self-contained"), agents negotiate with "don't X". In head-to-head wording tests on dispatch-prompt guidance, the prohibition arm produced clearly more of the unwanted content than the recipe arm (fully separated distributions), and trended worse than even the no-guidance control — micro-test your own case rather than assuming, but never reach for the prohibition by default. A recipe leaves nothing to negotiate: the output matches the stated shape or it doesn't.

**Rules for whichever form you pick:**
- **No nuance clauses.** "Don't X unless it matters" reopens the negotiation — appending a single nuance clause to a winning recipe degraded it from consistent to noisy in the same wording tests. Express a real exception as its own conditional on an observable predicate.
- **Exemption clauses don't scope.** "This limit doesn't apply to code blocks" still suppresses code blocks. If part of the output must be exempt, restructure so the rule can't reach it.
- **Calm wording, with the reason.** Current models follow instructions closely, and capitals, CRITICAL and MUST make them overtrigger (see anthropic-best-practices.md). State the rule plainly with a one-clause why. Reserve emphasis for the one rule your baseline shows being skipped — emphasis on many lines makes none stand out.

## Bulletproofing Skills Against Rationalization

Skills that enforce discipline (like TDD) need to resist rationalization. Agents are smart and will find loopholes when under pressure.

**Scope:** this toolkit is for discipline failures — an agent that knows the rule and skips it under pressure. For wrong-shaped output or omitted elements, prohibition-based bulletproofing backfires; use the forms in Match the Form to the Failure instead.

**Psychology note:** Understanding WHY persuasion techniques work helps you apply them systematically. See persuasion-principles.md for research foundation (Cialdini, 2021; Meincke et al., 2025) on authority, commitment, scarcity, social proof, and unity principles.

### Close Every Loophole Explicitly

Don't just state the rule - forbid specific workarounds:

<Bad>
```markdown
Write code before test? Delete it.
```
</Bad>

<Good>
```markdown
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete
```
</Good>

### Address "Spirit vs Letter" Arguments

Add foundational principle early:

```markdown
**Violating the letter of the rules is violating the spirit of the rules.**
```

This cuts off entire class of "I'm following the spirit" rationalizations.

### Build Rationalization Table

Capture rationalizations from baseline testing. Every excuse agents make goes in the table:

Model it on the Common Rationalizations table above: the excuse verbatim, then the reality.

### Create Red Flags List

Make it easy for agents to self-check when rationalizing:

```markdown
## Red Flags - STOP and Start Over

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because..."

**All of these mean: Delete code. Start over with TDD.**
```

### Update CSO for Violation Symptoms

Add to the description the symptoms of being ABOUT to violate the rule:

```yaml
description: use when implementing any feature or bugfix, before writing implementation code
```

## RED-GREEN-REFACTOR for Skills

1. **RED — baseline.** Run the pressure scenario with a subagent WITHOUT the skill. Record its choices, its rationalizations verbatim, and which pressures triggered the violation. You must see what agents naturally do before writing anything.
2. **GREEN — minimal skill.** Address those specific failures, nothing hypothetical. Re-run the same scenarios WITH the skill; the agent should now comply.
3. **REFACTOR — close loopholes.** New rationalization? Add an explicit counter and re-test until it holds.

### Micro-Test Wording Before Full Scenarios

Full pressure-scenario runs are the final gate, but they are slow and expensive per iteration. Verify the wording itself first with micro-tests:

1. **One fresh-context sample per call** — a raw API call, or a single-shot subagent if you don't have API access. System prompt = the realistic context the guidance will live in (the full skill or prompt template, not the guidance in isolation); user message = a task that tempts the failure.
2. **Always include a no-guidance control.** If the control doesn't exhibit the failure, there is nothing to fix — stop, don't author the guidance.
3. **5+ reps per variant.** Single samples lie.
4. **Manually read every flagged match.** Score programmatically if you like, but template echoes and quoted counter-examples masquerade as hits; automated counts alone overstate both failure and success.
5. **Variance is a metric.** When guidance lands, reps converge on the same shape. Five different interpretations across five reps means the wording isn't binding — tighten the form before adding words.

Micro-tests verify wording; they do not replace pressure scenarios for discipline skills.

**Testing methodology:** See [testing-skills-with-subagents.md](testing-skills-with-subagents.md) for writing pressure scenarios, pressure types (time, sunk cost, authority, exhaustion), plugging holes systematically, and meta-testing.

## Anti-Patterns

| Anti-pattern | Example | Why bad |
|---|---|---|
| Narrative example | "In session 2025-10-03, we found empty projectDir caused..." | Too specific, not reusable |
| Multi-language dilution | example-js.js, example-py.py, example-go.go | Mediocre quality, maintenance burden |
| Code in flowcharts | `step1 [label="import fs"]` | Can't copy-paste, hard to read |
| Generic labels | helper1, helper2, step3 | Labels should have semantic meaning |

## Skill Creation Checklist (TDD Adapted)

Complete this checklist for each skill before starting the next one; batching untested skills is deploying untested code. Create a task (TaskCreate) for each item.

**RED Phase - Write Failing Test:**
- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT skill - document baseline behavior verbatim
- [ ] Identify patterns in rationalizations/failures

**GREEN Phase - Write Minimal Skill:**
- [ ] Name is lowercase letters, numbers, hyphens, matching the directory
- [ ] YAML frontmatter with required `name` and `description` (description max 1024 chars); optional Claude Code fields only when needed
- [ ] Description starts with "Use when..." and includes specific triggers/symptoms
- [ ] Description written in third person
- [ ] Keywords throughout for search (errors, symptoms, tools)
- [ ] Clear overview with core principle
- [ ] Address specific baseline failures identified in RED
- [ ] Code inline OR link to separate file
- [ ] One excellent example (not multi-language)
- [ ] Guidance form matches the failure type (see Match the Form to the Failure)
- [ ] For behavior-shaping guidance: wording micro-tested against a no-guidance control (5+ reps, every flagged match read manually) — N/A for pure reference skills
- [ ] Run scenarios WITH skill - verify agents now comply

**REFACTOR Phase - Close Loopholes:**
- [ ] Identify NEW rationalizations from testing
- [ ] Add explicit counters (if discipline skill)
- [ ] Build rationalization table from all test iterations
- [ ] Create red flags list
- [ ] Re-test until bulletproof

**Quality Checks:**
- [ ] Small flowchart only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] No narrative storytelling
- [ ] Supporting files only for tools or heavy reference
- [ ] Calm wording; emphasis only on a rule the baseline showed being skipped

**Deployment:**
- [ ] Commit skill to git and push to your fork (if configured)
- [ ] Consider contributing back via PR (if broadly useful)
