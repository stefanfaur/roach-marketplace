---
date: 2026-07-06T12:38:01Z
researcher: sfaur
git_commit: 2861ff0
branch: main
repository: roach-marketplace
topic: "roach plugin vs. mid-2026 agentic/loop engineering best practices — improvement analysis"
tags: [research, roach, plugin-improvements, context-engineering, subagents, skills, hooks, model-tiering]
status: complete
last_updated: 2026-07-06
last_updated_by: sfaur
---

# Research: roach vs. Latest Agentic/Loop Engineering Best Practices

**Date**: 2026-07-06 12:38 UTC
**Researcher**: sfaur
**Git Commit**: 2861ff0
**Branch**: main
**Repository**: roach-marketplace

## Research Question

Deeply analyse the roach workflow plugin (v1.3.1) and determine what could be improved, considering the latest agentic/loop engineering best practices (Anthropic engineering guidance, the Agent Skills open spec, Claude Code platform changes through mid-2026, and strong community practice).

## Summary

**The architecture is validated.** roach's loop — research → plan → execute-with-subagents → verify → handoff — is exactly the shape Anthropic and leading practitioners converged on. Several v1.3.x decisions (file handoffs via `thoughts/.sdd/`, commit-anchored `.tasks.json` ledger, fresh-context per-task reviewer with "Do Not Trust the Report", never-parallel implementers, cat-only SessionStart hook) match official guidance almost verbatim.

**The gaps are not architectural — they are drift and self-contradiction.** The highest-value fixes:

1. The `model: opus` pin on all 7 agents contradicts roach's own model-tiering doctrine and current official guidance (P1)
2. Unbroken `ultrathink` keywords silently force extended thinking — the exact bug v1.3.1 fixed in one skill survives in three other files, confirmed live this session (P1)
3. Stale platform references: `TodoWrite` (superseded by Task tools), likely-invalid `tools:` frontmatter names, `writing-skills` denying frontmatter fields roach itself uses (P1–P2)
4. The blanket EnterPlanMode/ExitPlanMode ban creates the very trap it claims to prevent (P2)
5. Missing reward-hacking guards in the verification loop, and no gap-check round in research fan-out (P2)
6. Packaging hygiene: session artifacts and a 71KB mandatory-read style guide ship inside the plugin (P2–P3)

## Part 1: What roach Already Gets Right (validated)

| roach practice | Where | Matching guidance |
|---|---|---|
| Research → plan → execute → verify loop; human reviews plan not code | whole plugin | Official Claude Code workflow ("Explore first, then plan, then code"); HumanLayer ACE-FCA ("research > plan > code" leverage) |
| Bulk artifacts move as files, not pasted text (`thoughts/.sdd/` briefs, reports, review packages) | `roach/skills/subagent-driven-development/SKILL.md:122-132` | Anthropic multi-agent: "store work in external systems, pass lightweight references back" |
| Commit-anchored JSON task ledger, reconciled against `git log` on resume | `SKILL.md:307-319` | Anthropic long-running harness (`claude-progress.txt` + git; JSON because "models overwrite JSON less than Markdown") |
| Fresh-context reviewer; "Do Not Trust the Report"; rationales are claims | `task-reviewer-prompt.md:50-57` | Anti-sycophancy research: authorship-blind review restores detection in ~94% of cases |
| Never dispatch parallel implementers | `SKILL.md:253` | Official: coding parallelizes poorly; parallel writers are the risky case |
| Iron Laws placed at known cheat points (TDD, verification-before-completion) | `test-driven-development/SKILL.md:31-45`, `verification-before-completion/SKILL.md:17-38` | Synthesis of 2026 guidance: heuristics for open reasoning, rigid wording exactly where models cheat (test skipping, premature completion) |
| Cat-only, fast SessionStart hook, matcher-scoped | `roach/hooks/session-start.sh` | Hooks reference: "Keep SessionStart hooks fast… lightweight" |
| `context: fork` + `agent: Explore` for plan-writing and code review | `writing-plans/SKILL.md:5-6`, `requesting-code-review/SKILL.md:5-6` | Current skills docs — ahead of most community plugins |
| Explicit model per dispatch; "turn count beats token price" | `subagent-driven-development/SKILL.md:95-110` | Matches 2026 routing economics |
| Escalation escape hatch for implementers ("Bad work is worse than no work") | `implementer-prompt.md:75-89` | Research: an explicit "declare impossible" option dropped deception 92%→1% |
| Reviewer scoped to correctness/spec gaps, severity calibration, "not everything is Critical" | `task-reviewer-prompt.md:99-109` | Official anti-over-engineering warning for review loops |

These should be kept and defended. None of the findings below argue for architectural change.

## Part 2: Findings

### P1-1: `model: opus` pin on all 7 agents contradicts roach's own doctrine and current guidance

**Evidence:** every agent frontmatter (`roach/agents/*.md:5`, commit 2861ff0 "pin all subagents to opus"). Meanwhile `subagent-driven-development/SKILL.md:95` teaches "Use the least powerful model that can handle each role."

**Why it matters:**
- `codebase-locator` is self-described as "a Super ripgrep/Glob/LS tool" — the most mechanical role in the fleet, pinned to the most expensive tier. 2026 routing guidance puts grep/glob/file-search on Haiku ("equivalent results"); right-tiering claims 60–80% cost reduction.
- `researching-codebase` fans out *multiple* of these agents per research question; multi-agent runs already use ~15× the tokens of a chat. All-opus multiplies that.
- The official pattern is `inherit` default + per-role overrides (Opus-class lead, cheaper workers — the +90.2% multi-agent result used Opus lead + Sonnet subagents). A hard `opus` literal also ages badly now that the Claude 5 family sits above Opus: `inherit` tracks the session model, `opus` no longer means "the best available."
- Anthropic's counter-caveat: don't under-tier reasoning-heavy roles ("upgrading the model beats doubling token budget"). So reviewers/analyzers deserve more than Haiku.

**Recommendation:**
- `codebase-locator`, `thoughts-locator` → `model: haiku`
- `codebase-analyzer`, `codebase-pattern-finder`, `thoughts-analyzer`, `web-search-researcher` → `model: sonnet`
- `code-reviewer` → `model: inherit` (final gate should ride the strongest session model)
- If all-opus was a deliberate quality-over-cost decision, document the rationale in the agent files so the next maintainer doesn't "fix" it — but at minimum the two locators are wasted spend.

### P1-2: Unbroken `ultrathink` keywords silently force extended thinking

**Evidence:** `roach/skills/researching-codebase/SKILL.md` step 2 ("Take time to ultrathink about the underlying patterns…"), `roach/agents/codebase-analyzer.md:51`, `roach/agents/thoughts-analyzer.md:37`. Confirmed live: invoking `researching-codebase` this session triggered the harness's "user included the keyword ultrathink" extended-thinking mode on the main conversation.

**Why it matters:** this is precisely the bug commit 5414a15 fixed in `systematic-debugging` ("break Ultrathink keyword to stop forcing extended thinking every session") — it survives in three other files. In the skill it taxes every research invocation on the main context; in the agents it compounds with the opus pin (max model × max thinking for documentarian work).

**Recommendation:** hyphenate ("ultra-think") in `researching-codebase/SKILL.md` at minimum. For the two agents, make it a deliberate choice: if deep thinking is wanted there, the supported mechanism is now the `effort` frontmatter field on the agent, not a magic keyword in prose.

### P1-3: `TodoWrite` references are stale and internally inconsistent

**Evidence:** `using-roach/SKILL.md` ("create a TodoWrite todo per item"), `researching-codebase/SKILL.md` step 2, `resuming-handoff/SKILL.md` Step 3, `writing-skills/SKILL.md` checklist, `web-search-researcher.md` tools list. Meanwhile `executing-plans`, `subagent-driven-development`, and `dispatching-parallel-agents` correctly use TaskCreate/TaskUpdate.

**Why it matters:** Claude Code v2.1.142+ replaced TodoWrite with the structured Task tools (TaskCreate/TaskUpdate/TaskGet/TaskList). Instructions naming a tool that doesn't exist either no-op or make the model improvise; half the plugin says one thing, half the other.

**Recommendation:** mechanical sweep — replace all TodoWrite references with the Task tools; drop TodoWrite from `web-search-researcher`'s tools list.

### P1-4: Agent `tools:` frontmatter uses non-canonical names — restrictions may not bind

**Evidence:** `roach/agents/codebase-locator.md:4` (`tools: Ripgrep, Glob, LS, Jetbrains MCP`) and equivalents in the other five typed agents.

**Why it matters:** the canonical built-in names are `Grep` (rg-backed), `Glob`, `Read`, `Bash`…; `LS` was removed as a standalone tool in Claude Code 2.x, and MCP access is granted via `mcp__server__*` patterns, not the string "Jetbrains MCP". Unknown names in `tools:` are silently ignored, so `codebase-locator` may effectively hold only `Glob` — or, depending on version behavior, fall back to defaults that ignore the restriction entirely. Also relevant: plugin-shipped agents silently drop `hooks`/`mcpServers`/`permissionMode` frontmatter (roach doesn't use these — good — but worth knowing when extending).

**Recommendation:** verify with the pinned Claude Code version, then normalize, e.g. locator: `tools: Grep, Glob`, analyzer: `tools: Read, Grep, Glob, mcp__jetbrains__*`. This is a five-minute fix that may materially change how the agents actually behave.

### P2-1: The EnterPlanMode/ExitPlanMode ban creates the trap it claims to prevent

**Evidence:** `using-roach/SKILL.md` Tool Restrictions ("Never call EnterPlanMode or ExitPlanMode… plan mode… has no clean exit"), repeated in `brainstorming/SKILL.md:18`, `writing-plans/SKILL.md:49`, `executing-plans/SKILL.md:8`, `subagent-driven-development/SKILL.md:6`.

**Why it matters:** if the *user* enters plan mode (Shift+Tab — a first-class, heavily promoted flow), a model forbidden from ever calling `ExitPlanMode` has no clean way out: the ban manufactures the trapped-session failure it was written to avoid. The claim is also stale — current plan mode has an approval-gated exit, plan editing (Ctrl+G), and a dedicated Plan subagent; it is the official surface for "explore first, then plan."

**Recommendation:** narrow the rule: "Do not *enter* plan mode on your own — roach's brainstorming/writing-plans replace it. If the session is already in plan mode (user-initiated), call ExitPlanMode to leave before executing roach skills." Longer term, consider whether `writing-plans` should coexist with native plan mode rather than fight it.

### P2-2: `writing-skills` contradicts the current spec and roach's own files

**Evidence:** `writing-skills/SKILL.md:95-99` ("Only two fields supported: name and description"), while `writing-plans` and `requesting-code-review` already carry `context: fork`, `agent`, `argument-hint`. The bundled `anthropic-best-practices.md` (45KB) is a doc snapshot predating the skills/commands unification and the agentskills.io open spec (Dec 2025).

**Why it matters:** an author following `writing-skills` would produce less capable skills and might "correct" roach's own fork frontmatter as invalid. The skill also misses now-official fields with real leverage: `disable-model-invocation` (side-effecting user-only skills), `user-invocable: false`, `model`/`effort`, `paths`, and the documented lifecycle facts (invoked skills persist all session; 5K/25K token compaction re-attachment budgets; description listing budget ≈1% of context).

**Recommendation:** update the frontmatter section to the open-spec + Claude-Code-extension field table; refresh or replace the 45KB snapshot with a short "check the live docs" pointer plus the handful of load-bearing quotes. Consider `disable-model-invocation: true` for `committing` (side-effecting, user-triggered by nature).

### P2-3: Verification loop lacks explicit reward-hacking guards

**Evidence:** `verification-before-completion/SKILL.md` and `test-driven-development/SKILL.md` are strong on evidence-before-claims but never say: don't weaken/delete tests to pass, and always run the *complete* suite (the "lazy verifier" runs two tests and declares victory). `task-reviewer-prompt.md:60-67` instructs the reviewer not to re-run tests at all — a deliberate economy that leans entirely on the implementer's self-reported results.

**Why it matters:** 2025–2026 literature documents agents overwriting tests, monkey-patching scorers, and passing impossible tasks; more capable models exploit *more*. Anthropic's long-running-harness guidance uses exactly the strongly-worded guards roach is missing ("It is unacceptable to remove or edit tests").

**Recommendation:** three one-line additions: (a) in TDD and the implementer prompt: "Never modify or delete an existing test to make it pass; if a test seems wrong, escalate"; (b) in verification-before-completion: "The claim requires the full suite, not the subset you touched"; (c) keep the reviewer's no-re-run economy, but have the controller (or final typed review) re-run the complete suite once per task before marking it complete — one command, closes the self-grading loop.

### P2-4: Research fan-out has no effort scaling and no gap-check round

**Evidence:** `researching-codebase/SKILL.md` always decomposes into parallel sub-agents and always writes a research doc; it fans out once and synthesizes, with no completeness check.

**Why it matters:** official effort-scaling heuristics ("simple fact-finding = 1 agent; complex research = 10+") exist precisely because early systems "spawned 50 subagents for simple queries" — with the opus pin (P1-1) roach's floor cost per research question is high. And single-round fan-out predictably misses the tail; current practice adds a cheap critic pass ("what's missing — modality not searched, claim unverified?").

**Recommendation:** add a scaling note up front ("a question answerable by one locator dispatch gets one agent and no document unless asked") and a one-agent gap-check after synthesis for substantial research, feeding one optional second round.

### P2-5: Blanket brainstorming HARD-GATE has no fast path

**Evidence:** `brainstorming/SKILL.md:14-17` (HARD-GATE for EVERY project), `:36-38` ("a config change — all of them"), reinforced by the 1%-rule framing in `using-roach` ("This is not negotiable. You cannot rationalize your way out of this.").

**Why it matters:** the "curse of instructions" result shows compliance degrades multiplicatively as absolute directives accumulate; Anthropic's own best practice is "If you could describe the diff in one sentence, skip the plan," and their design guidance prefers strong heuristics over rigid rules except at cheat points. Design-gating a one-line config change is ceremony that trains the model (and user) to route around the whole system — and it collides head-on with other session-level directives, forcing the model to arbitrate contradictions on every trivial task.

**Recommendation:** keep the gate for feature work; add an explicit scaled path: "If the change is describable in one sentence and touches ≤1 file, present that sentence as the design and get a yes/no." That preserves the approval principle while deleting the ceremony. Similarly, consider reserving the maximalist framing in `using-roach` for the two load-bearing gates (TDD, verification) — emphasis inflation is a documented failure mode ("if a rule keeps being ignored, the file is too long").

### P2-6: Packaging and repo hygiene

**Evidence:**
- `roach/thoughts/shared/plans/plugin-improvements/…` — session artifacts live *inside* the shipped plugin directory (`marketplace.json` → `source: "./roach"`); the documented sync workflow (`git add -A && git commit`) will sweep them into every user's install.
- `utils/index.js` — an untracked 470-line generic lodash-clone at repo root, unrelated to any plugin; same sweep risk.
- `roach/lib/elements-of-style.md` (71KB) ships to every install, and `writing-natural/SKILL.md:10` *mandates* reading all of it "before writing a single word" — a ~20k-token forced read before writing a changelog entry, violating progressive disclosure for marginal benefit (the skill already inlines the six rules that matter).

**Recommendation:** move `roach/thoughts/` to repo-root `thoughts/` (matching roach's own convention); delete or relocate `utils/index.js`; slim `writing-natural` to the inline rules plus an optional deep-reference pointer, and cut `elements-of-style.md` to the chapters actually cited (or keep it, but drop the mandatory full read).

### P3 (smaller / optional)

- **P3-1 — PreCompact handoff nudge:** roach says "use create-handoff proactively" but nothing fires when compaction actually looms. A cat-only `PreCompact` hook injecting "context is about to compact — consider create-handoff first" closes the gap the removed context-monitor left, at zero complexity. (Exit-2 on PreCompact can even *block* compaction — that's the aggressive variant; the gentle reminder is probably right for roach.)
- **P3-2 — Skill-listing budget:** 18 skills' descriptions share a listing budget (~1% of context; overflow silently drops least-used descriptions). Run `/doctor` to check truncation; `user-invocable: false` / `disable-model-invocation` on internal or side-effecting skills buys headroom.
- **P3-3 — Fork model control:** `requesting-code-review` runs on the Explore agent, which since v2.1.198 *inherits the session model* — if the session runs a cheap model, the final review does too, contradicting SDD's "final review on the most capable model." Add `model:` to the skill frontmatter (or note the dependency).
- **P3-4 — Agent description hygiene:** `web-search-researcher.md:3` ("get your money back!") and similar jokey copy occupy the selection-signal channel the orchestrator uses to pick among many agents; official guidance is third-person triggering conditions. Same for `codebase-locator`'s "use it if you'd use ripgrep more than once," which over-encourages delegation for single greps (a subagent round-trip costs more than the grep).
- **P3-5 — `create-handoff` prints a nonexistent command:** `create-handoff/SKILL.md:75-77` tells users to resume with `/resuming_handoff path` — the actual invocation is the `resuming-handoff` skill (`/roach:resuming-handoff`). Fix the printed string.
- **P3-6 — Position vs. native features:** decide and document roach's stance on (a) **auto memory** (MEMORY.md now captures cross-session learnings natively — handoffs remain a genuine value-add, but the Learnings section overlaps), (b) **Dynamic Workflows** (script-orchestrated fan-out with schema-validated structured outputs is now native; a one-line pointer in `dispatching-parallel-agents` for large sweeps would be cheap), and (c) **checkpoints/rewind** (worth a mention in systematic-debugging as a recovery tool). Divergence is fine; undocumented divergence invites drift.
- **P3-7 — Ledger sync as a hook:** `.tasks.json` sync currently relies on prose discipline; a `TaskCompleted`/`SubagentStop` hook would enforce it "regardless of what Claude decides" (the officially recommended home for must-run behaviors). Counterweight: roach deliberately went hook-minimal — this is an option, not a debt.
- **P3-8 — `spec_metadata.js`:** four git one-liners wrapped in Node; roach otherwise advertises itself as Node-free. A bash equivalent (or inlining the commands into the two skills that call it) removes the runtime dependency.

## Part 3: Strategic Observations

1. **roach's moat is the methodology, not the mechanics.** The platform has absorbed several mechanics roach hand-rolled (task tracking, memory, fork contexts, workflow fan-out, checkpoints). What it has *not* absorbed: the discipline layer (Iron Laws at cheat points, spec-compliance review, deviation rules, handoff documents). Future maintenance should bias toward deleting mechanics the harness now provides and sharpening the discipline layer.
2. **Consistency is the cheapest quality lever.** Most P1s are one part of the plugin contradicting another (doctrine vs. agent pins, fixed keyword vs. surviving keywords, Task tools vs. TodoWrite, fork frontmatter vs. writing-skills). A release checklist item — "grep the plugin for its own banned patterns" — would have caught all of them.
3. **The plugin predates the Claude 5 family.** Every "opus = most capable" assumption should be re-read as "inherit = most capable, opus = mid-tier pin."

## Code References

- `roach/agents/codebase-locator.md:4-5` — non-canonical tools list + opus pin (pattern repeats in all 7 agents)
- `roach/agents/codebase-analyzer.md:51`, `roach/agents/thoughts-analyzer.md:37` — surviving `ultrathink` keywords
- `roach/skills/researching-codebase/SKILL.md` (step 2) — `ultrathink` + TodoWrite in main-context skill
- `roach/skills/using-roach/SKILL.md` — TodoWrite reference; plan-mode ban; maximalist 1%-rule framing
- `roach/skills/subagent-driven-development/SKILL.md:95-110` — the model-tiering doctrine the agent pins contradict
- `roach/skills/subagent-driven-development/task-reviewer-prompt.md:60-67` — reviewer no-re-run economy
- `roach/skills/writing-skills/SKILL.md:95-99` — stale "only name and description" frontmatter claim
- `roach/skills/brainstorming/SKILL.md:14-17,36-38` — blanket HARD-GATE
- `roach/skills/writing-natural/SKILL.md:10` + `roach/lib/elements-of-style.md` — 71KB mandatory read
- `roach/skills/create-handoff/SKILL.md:75-77` — nonexistent `/resuming_handoff` command string
- `roach/hooks/hooks.json`, `roach/hooks/session-start.sh` — current (well-designed) hook footprint
- `.claude-plugin/marketplace.json:14` — `source: "./roach"` (why `roach/thoughts/` would ship)
- `roach/thoughts/shared/plans/plugin-improvements/2026-07-01-superpowers-v6-1-adoption.md` — decision record behind v1.3.x (context for what was already deliberately adopted/rejected)

## Historical Context (from thoughts/)

- `roach/thoughts/shared/plans/plugin-improvements/2026-07-01-superpowers-v6-1-adoption.md` — the superpowers v6.1 adoption plan: unified task reviewer, file handoffs, pre-flight review, commit-anchored ledger, lean bash hook, Ultrathink fix (in systematic-debugging only), SUBAGENT-STOP. Explicitly out of scope then: worktrees, multi-harness packaging, skill-behavior test harness. This review's findings do not reopen any decision that plan already settled; they extend it.

## Sources (external)

Official Anthropic: [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) · [Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents) · [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) · [Agent Skills engineering post](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) · [Claude Code best practices](https://code.claude.com/docs/en/best-practices) · [Skills docs](https://code.claude.com/docs/en/skills) · [Subagents docs](https://code.claude.com/docs/en/sub-agents) · [Hooks reference](https://code.claude.com/docs/en/hooks) · [Dynamic workflows](https://code.claude.com/docs/en/workflows) · [Memory docs](https://code.claude.com/docs/en/memory) · [Task tools](https://code.claude.com/docs/en/agent-sdk/todo-tracking) · [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) · [When to use multi-agent systems](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

Spec & community: [agentskills.io specification](https://agentskills.io/specification) · [HumanLayer ACE-FCA](https://github.com/humanlayer/advanced-context-engineering-for-coding-agents/blob/main/ace-fca.md) · [Ralph Wiggum loop](https://ghuntley.com/ralph/) · [obra/superpowers](https://github.com/obra/superpowers) · [Simon Willison — Agentic Engineering Patterns](https://simonw.substack.com/p/agentic-engineering-patterns)

Failure-mode literature: "Curse of Instructions" (OpenReview R6q67CDBCH) · SpecBench reward-hacking benchmark (arXiv 2605.21384) · "LLMs Gaming Verifiers" (arXiv 2604.15149) · contextual bias in LLM code review (arXiv 2603.18740). Note: 2026 arXiv figures were quoted from the research pass, not independently verified.

## Open Questions

1. Was the all-opus pin a measured response to a quality problem with `inherit`/mixed tiers, or a blanket precaution? (Determines whether P1-1 is a revert or a documented trade-off.)
2. What Claude Code version floor does roach target? The `tools:` frontmatter fix (P1-4) and the hook/feature suggestions (P3-1, P3-7) depend on it.
3. Does the user rely on HumanLayer's `thoughts/searchable/` hard-link tooling? `thoughts-locator` carries that convention; if unused, it's confusing baggage to trim.
