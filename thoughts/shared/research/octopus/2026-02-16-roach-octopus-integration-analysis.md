# roach + claude-octopus In-Roach Integration Analysis

Date: 2026-02-16
Repository: roach-marketplace
Method: Brainstorming skill workflow pattern (context scan -> architecture options -> recommendation)
Status: Revised for clarified goal (integrate octopus WITH roach, not as a sibling plugin)

## 1) Clarified Objective

You clarified that the target is not running `claude-octopus` as a separate plugin.
The target is to integrate selected octopus capabilities into `roach` so Claude Code workflows can orchestrate Codex/Gemini where useful, while preserving roach's process discipline and avoiding bloat.

Success criteria inferred from your request:
- Keep roach as the primary workflow system.
- Add reliable multi-provider orchestration (Codex/Gemini + Claude synthesis).
- Avoid importing octopus wholesale.
- Avoid path/state fragmentation.
- Keep runtime predictable and testable.

## 2) Evidence and Analysis Inputs

### 2.1 Files and subsystems reviewed

Roach core:
- `roach/.claude-plugin/plugin.json`
- `roach/hooks/hooks.json`
- `roach/hooks/session-start.js`
- `roach/hooks/context-monitor.js`
- `roach/hooks/statusline-wrapper.js`
- `roach/commands/*.md`
- `roach/skills/*/SKILL.md`
- `roach/agents/*.md`

Octopus core:
- `claude-octopus/.claude-plugin/plugin.json`
- `claude-octopus/.claude-plugin/hooks.json`
- `claude-octopus/.claude/commands/*.md`
- `claude-octopus/.claude/skills/*.md`
- `claude-octopus/scripts/orchestrate.sh`
- `claude-octopus/scripts/{provider-router,session-manager,state-manager,context-manager,task-manager,metrics-tracker,octo-state}.sh`
- `claude-octopus/hooks/*.sh`
- `claude-octopus/docs/{ARCHITECTURE,PLUGIN-ARCHITECTURE,NATIVE-INTEGRATION,TRIGGERS,COMMAND-REFERENCE,SCHEDULER}.md`
- `claude-octopus/tests/*`

### 2.2 Local test runs performed

Octopus:
- `bash tests/smoke/test-syntax.sh` -> pass
- `bash tests/smoke/test-packaging-integrity.sh` -> pass
- `bash tests/test-command-registration.sh` -> pass
- `bash tests/test-version-consistency.sh` -> pass

Roach:
- `node hooks/test-hooks.js` -> pass
- `node hooks/test-integration.js` -> inconclusive (prompt-answer style check did not produce deterministic YES/NO output here)

### 2.3 Quantitative footprint

Roach:
- ~54 files
- ~10,380 lines
- ~516 KB

Octopus:
- ~396 files
- ~106,395 lines
- ~6.7 MB

High-mass octopus components:
- `scripts/orchestrate.sh`: 15,291 LOC
- `scripts` directory total: ~1.4 MB
- `hooks` directory total: ~100 KB
- `.claude` commands+skills total: ~896 KB
- nested `.git`: ~2.4 MB (must not be shipped)

## 3) Deep Analysis: roach Baseline

### 3.1 Architecture profile

Roach is compact and process-centric:
- Hook surface is small and understandable.
- Commands and skills are designed to enforce disciplined execution.
- Primary artifact model is `thoughts/shared/{plans|research|handoffs|docs}/...`.
- Runtime behavior is intentionally lightweight; behavior is mostly declarative in markdown workflows.

### 3.2 Hook behavior

Roach currently wires only:
- `SessionStart` -> injects strong process/system context via `using-roach` plus environment checks.
- `Stop` -> context threshold check and forced handoff prompt when nearing window limits.

Operational effect:
- Predictable, low-noise lifecycle.
- Strong startup governance.
- Low accidental interference with ordinary tool usage.

### 3.3 Process governance strengths

- Mandatory skill-first discipline in `using-roach`.
- Strong planning/execution/validation command chain.
- High emphasis on artifact continuity (`thoughts/shared/*`).
- Built-in context hygiene through handoff flow.

### 3.4 Constraints for octopus merge

- Roach assumes Claude-native process control, not a giant shell orchestration runtime.
- Session-start injection is strict; any imported behavior must align with it.
- No existing provider routing state model in roach today.

## 4) Deep Analysis: claude-octopus Structure

### 4.1 What octopus is, practically

Octopus is not just a command pack; it is a platform:
- 41 commands + 44 skills.
- Multi-event hooks (`PreToolUse`, `PostToolUse`, `SessionStart`, `TeammateIdle`, `TaskCompleted`).
- Large bash runtime kernel (`orchestrate.sh`) with many subfeatures.
- Multi-layer state and metrics files across project and home directories.
- Optional scheduler/daemon with security gates and policy system.

### 4.2 High-value core relevant to your goal

For Codex/Gemini orchestration, the highest-value components are:
- `scripts/orchestrate.sh` phase execution logic (discover/define/develop/deliver/debate/review pattern).
- `scripts/provider-router.sh` provider strategy.
- `scripts/metrics-tracker.sh` cost/latency accounting.
- selective command UX (`discover`, `develop`, `review`, `research`, `debate`, `multi`, `setup`).

### 4.3 Heavy or tightly coupled areas

Tightly coupled to octopus-specific state/contracts:
- `.octo/STATE.md` and related lifecycle files (`PROJECT.md`, `ROADMAP.md`, `LESSONS.md`, `ISSUES.md`).
- `.claude-octopus/state.json` and context files.
- `~/.claude-octopus/results/`, logs, analytics, metrics, debates.
- hooks that assume task queue/state files under octopus paths.

High-intrusion hooks:
- Task lifecycle hooks (`TaskCreate`, `TaskUpdate`, `TaskCompleted`) tied to octopus checkpoint/state logic.
- `TeammateIdle` dispatch flow with queue and session file assumptions.
- Scheduler security gate tied to octopus scheduler job files.

### 4.4 Reliability caveat from upstream tests/docs

Important: octopus test docs explicitly acknowledge that many "enforced" workflow patterns are documentation-level conventions, not guaranteed hard runtime enforcement by Claude lifecycle primitives.

Implication for merge:
- Treat many command/skill contracts as guidance patterns, not strict guarantees.
- Keep runtime enforcement where technically explicit (hook scripts, shell checks), and reduce reliance on declarative "must" wording alone.

## 5) Coupling and Portability Matrix

### 5.1 Portable with low refactor effort (recommended import candidates)

- Provider detection/routing and preflight logic.
- Multi-provider execution pipeline in orchestrator (core phases only).
- Cost and latency metrics tracker.
- Visual provider-warning prompts (Codex/Gemini credential usage) when external CLIs run.

### 5.2 Moderate refactor required

- Command docs that reference `/octo:*` namespace.
- Skill docs with heavy `AskUserQuestion` and task contracts that need alignment with roach tone/process.
- Session-manager path assumptions (`~/.claude-octopus/sessions/...`).

### 5.3 High refactor or postpone

- `.octo/` project-state lifecycle (`octo-state.sh`) unless remapped.
- Scheduler daemon stack and security gate.
- Team idle auto-dispatch and task checkpoint hooks.
- Broad quality gates with persona-specific text heuristics (may produce noisy or false blocks in roach context).

## 6) Key Integration Frictions (In-Roach Merge)

1. State model conflict:
- roach canonical artifacts: `thoughts/shared/*`
- octopus canonical artifacts: `.octo/*` and `~/.claude-octopus/*`

2. Hook philosophy conflict:
- roach hooks are sparse and high signal.
- octopus hooks are broad and invasive.

3. Command philosophy conflict:
- roach commands are workflow-governance artifacts.
- octopus commands are external orchestrator launchers plus optional interaction contracts.

4. Runtime complexity jump:
- importing 15k-line orchestration shell script without feature slicing increases maintenance burden and defect surface.

5. Namespace expectations:
- octopus docs assume `/octo:*` command paths from plugin name lock.
- merged roach will not naturally retain that namespace unless wrappers are created.

## 7) Integration Options Considered

### Option A: Full octopus transplant into roach (reject)

- Copy almost all octopus commands/skills/hooks/scripts into roach.
- Pros: maximum feature parity.
- Cons: defeats roach simplicity, large reliability and maintenance risk, high bloat, conflicting behavior models.

### Option B: Minimal orchestration capability layer inside roach (recommended)

- Import only core orchestration runtime pieces and a small command surface.
- Keep roach process commands as top-level control plane.
- Remap octopus state/artifacts into roach `thoughts/shared/...` conventions.
- Pros: preserves roach identity, materially adds Codex/Gemini leverage, bounded complexity.
- Cons: requires careful refactor and compatibility shims.

### Option C: Thin wrappers around existing octopus folder from roach (short-term bridge)

- Keep octopus code mostly in place, add roach wrapper commands.
- Pros: fast initial velocity.
- Cons: still carries high bloat and dual-state risk; not a clean merged architecture.

## 8) Recommended Target Architecture (Merge-In)

### 8.1 Control plane

Keep roach as the only active plugin identity and workflow governor.

- roach commands remain the default lifecycle (`/create_plan`, `/implement_plan`, `/validate_plan`, etc.).
- new roach commands expose multi-provider orchestration intentionally, not globally.

### 8.2 Capability plane (new roach-owned octopus module)

Introduce a bounded module under roach, e.g.:
- `roach/octopus/scripts/*` (curated script subset)
- `roach/octopus/hooks/*` (very small subset)
- `roach/commands/octo_*.md` (roach-wrapped command entry points)
- `roach/skills/octopus/*` (optional skill adapters)

### 8.3 Artifact and state unification

Use roach-first project-local paths.

Recommended mapping:
- `~/.claude-octopus/results/*` -> `thoughts/shared/research/octopus/runs/<session-id>/results/*`
- `~/.claude-octopus/logs/*` -> `thoughts/shared/research/octopus/runs/<session-id>/logs/*`
- `~/.claude-octopus/metrics/*` -> `thoughts/shared/research/octopus/runs/<session-id>/metrics/*`
- `.claude-octopus/state.json` -> `thoughts/shared/research/octopus/state/state.json`
- `.octo/STATE.md` -> `thoughts/shared/research/octopus/state/STATE.md` (or drop this layer initially)

Compatibility strategy:
- Add env-based path override in imported scripts (single source of truth).
- Keep optional read-compatibility for legacy locations during migration.

### 8.4 Command surface in merged roach

Do not import all 41 commands.

Initial merged set (suggested):
- `/octo_research`
- `/octo_discover`
- `/octo_define`
- `/octo_develop`
- `/octo_review`
- `/octo_debate`
- `/octo_multi`
- `/octo_setup`

Why this set:
- directly aligned to Codex/Gemini multi-perspective value
- avoids scheduler/deck/extract/legacy task mgmt bloat
- clear entry points for users

## 9) Hook Consolidation Plan

### 9.1 Keep roach hooks as baseline

Retain:
- `SessionStart` (roach context injection)
- `Stop` (context monitor/handoff)

### 9.2 Add only low-noise octopus hook behavior

Candidate additions:
- PreTool warning prompts for `codex exec` and `gemini` execution.
- Provider preflight validator when running roach octo wrapper commands.

### 9.3 Postpone or reject for phase 1

Do not import initially:
- `TaskCreate` dependency validator
- `TaskUpdate` checkpoint hook
- `TaskCompleted` transition hook
- `TeammateIdle` dispatch hook
- scheduler security gate hook

Reason:
- these assume octopus task/session storage contracts and add lifecycle noise.

## 10) Keep/Drop Decision Matrix (Detailed)

Keep now:
- Core orchestration execution logic from `orchestrate.sh` (phase operations only).
- `provider-router.sh` (routing strategy).
- `metrics-tracker.sh` (cost/latency observability).
- `mcp-provider-detection.sh` (if used by your workflows).
- small subset of command UX wrappers relevant to research/build/review/debate.

Refactor before keep:
- `session-manager.sh` paths from `~/.claude-octopus` to roach thoughts paths.
- `state-manager.sh` project-local state path mapping.
- command/skill docs that assume `/octo:*` namespace and standalone plugin identity.

Drop/postpone:
- scheduler stack (`scripts/scheduler/*`, `/scheduler`, `/schedule`).
- `.octo` lifecycle manager (`octo-state.sh`) unless explicitly required later.
- deck/docs/extract pipelines unless concrete business need appears.
- broad persona quality-gate hook scripts until proven useful in roach context.
- nested upstream `.git` and non-runtime dev artifacts from integrated payload.

## 11) Command and Skill Harmonization with roach

### 11.1 roach-first workflow contract

Recommended merged contract:
1. Use roach planning/research commands to frame and scope the task.
2. Invoke octopus-enhanced command only when external model diversity adds value.
3. Persist synthesis to `thoughts/shared/research/octopus/...`.
4. Return to roach implementation/validation commands for execution closure.

### 11.2 Where to update roach guidance

Update `roach/skills/using-roach/SKILL.md` with a compact section:
- when to use `octo_*` commands (debate, adversarial review, uncertain architecture, multi-provider research)
- when not to use them (trivial edits, local code lookup, deterministic small fixes)

### 11.3 Avoiding command confusion

Because merged roach will not naturally expose `/octo:*` prefix, choose explicit roach-native names (`/octo_research` style) and provide mapping help text.

## 12) Reliability Risks and Mitigations

High risks:
- Monolithic shell runtime regressions when slicing features.
- Path/state migration bugs causing missing outputs.
- Hook overreach reducing predictability.

Mitigations:
- Feature-flag imported modules (`ROACH_OCTO_ENABLED`, `ROACH_OCTO_STRICT`).
- Single path configuration root (`ROACH_OCTO_ROOT`) used by all imported scripts.
- Keep hook additions minimal and scoped by command pattern.
- Add deterministic smoke tests for every imported wrapper command.

Medium risks:
- CLI dependency drift (`codex`, `gemini`, `jq`) and auth state.
- docs/skills expecting AskUserQuestion patterns not always needed in roach flow.

Mitigations:
- preflight command in `/octo_setup` with explicit PASS/FAIL diagnostics.
- simplify interactive question requirements to roach-style pragmatic prompting.

Low risks:
- direct command filename collisions (none observed with current roach command set).

## 13) Phased Merge Plan (Practical)

### Phase 0 - Extraction and hardening

- Extract minimal script subset into `roach/octopus/scripts`.
- Introduce path abstraction layer for state/results/logs/metrics.
- Remove hard-coded `~/.claude-octopus` and `.octo` defaults for merged mode.

Gate:
- syntax checks pass
- preflight works with missing-provider degraded mode

### Phase 1 - Minimal command integration

- Add `octo_*` wrapper commands in `roach/commands`.
- Implement only discover/define/develop/review/debate/research/setup/multi.
- Persist all outputs in `thoughts/shared/research/octopus/...`.

Gate:
- each wrapper command runs end-to-end in at least one real scenario
- artifacts are written only under roach thoughts paths

### Phase 2 - Hook integration (light)

- Add provider execution warning hooks and optional provider validation hook.
- no task lifecycle automation hooks yet.

Gate:
- no unexpected hook blocks on unrelated roach tasks
- no duplicate/noisy prompts

### Phase 3 - Process integration

- Update `using-roach` with octo usage boundaries.
- Add examples to research/planning docs showing where octo assists.

Gate:
- user can follow one coherent roach-first workflow that includes octo steps without state fragmentation

### Phase 4 - Optional expansion

- Evaluate scheduler, richer gates, or deeper task automation only with demonstrated need.

Gate:
- explicit performance/reliability evidence and test coverage before enabling

## 14) What This Means for Your Goal

For efficient Codex + Gemini session management from Claude Code inside roach:
- Yes, this is feasible and can be reliable.
- Reliability depends on selective integration, path unification, and hook restraint.
- Importing octopus wholesale into roach is likely to create avoidable complexity and behavior noise.

Best route:
- merge a curated octopus orchestration core into roach
- standardize on roach artifact/state conventions
- keep roach as the process control plane

## 15) Concrete Next Implementation Slice (Suggested)

First implementation slice should be deliberately small:
1. Add `roach/octopus/scripts` with curated scripts (`orchestrate`, `provider-router`, `metrics-tracker`, optional detection helper).
2. Add one wrapper command: `/octo_research`.
3. Persist outputs to `thoughts/shared/research/octopus/runs/<session>/...`.
4. Add a preflight check command `/octo_setup`.
5. Add smoke tests for these two commands before expanding.

This gives immediate value with minimal risk and validates the merged architecture before broader import.

## 16) Appendix: Current Command/Skill Inventory Snapshot

Roach:
- Commands: 9
- Skills: 12
- Hooks: SessionStart, Stop

Octopus:
- Commands: 41
- Skills: 44
- Hooks: PreToolUse, PostToolUse, SessionStart, TeammateIdle, TaskCompleted

Observation:
- octopus breadth is far larger than needed for your stated objective.
- selective import is necessary to preserve roach's quality-to-complexity ratio.
