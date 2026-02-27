# Browser GENERAL.md Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use roach:executing-plans to implement this plan task-by-task.

**Goal:** Add a concise, global `thoughts/shared/browser/GENERAL.md` that captures cross-cutting browser-agent context (auth, shared setup, safety) and ensure the browser orchestrator reads and applies it in pre-flight. Update the agent-browser skill docs so owners know to maintain it.

**Architecture:** Single global `GENERAL.md` under `thoughts/shared/browser/` with only universally relevant info. The browser orchestrator (Phase 1) reads/summarizes it before other workflows and passes essentials into the run. The agent-browser skill notes that the orchestrator owns creation/maintenance and must keep it minimal and secret-free.

**Tech Stack:** Markdown prompts; existing agent-browser prompt/skill files.

---

### Task 1: Create GLOBAL reference file for browser subagents

**Files:**
- Create: `thoughts/shared/browser/GENERAL.md`

**Step 1: Create GLOBAL skeleton**
- Content sections: Purpose; Authentication (login URL + required form fields/IDs); Credential Source (where creds come from—env/vault—no secrets in file); Session Reuse (state save/load filenames/locations allowed); Shared Setup (user agent/viewport/base URL defaults if any); Safety (placeholder for disallowed domains/PII logging rules, if provided). Keep concise and evergreen.

**Step 2: Ensure no secrets**
- Verify the file contains only references (state file names/paths, env var names) and no credentials or tokens.

**Step 3: Keep it minimal**
- Trim anything not universally needed across browser subagents.

### Task 2: Make orchestrator read and apply GENERAL.md in Phase 1

**Files:**
- Modify: `agent-browser/agents/browser-agent.md` (Phase 1 pre-flight section)

**Step 1: Add GENERAL read step**
- In Phase 1, before domain-specific workflow search, instruct: if `thoughts/shared/browser/GENERAL.md` exists, read it fully.

**Step 2: Summarize essentials**
- Add instruction to summarize key points (auth URL/fields, credential source references, session state reuse filenames, shared setup defaults, safety notes) and carry them into the run.

**Step 3: Keep prompts lean**
- Emphasize brevity (only universally relevant info) and no secrets; if missing, continue without error.

### Task 3: Update agent-browser skill doc to reference GENERAL.md ownership

**Files:**
- Modify: `agent-browser/skills/agent-browser/SKILL.md`

**Step 1: Note GENERAL.md requirement**
- Mention that the browser orchestrator maintains `thoughts/shared/browser/GENERAL.md` for cross-cutting info.

**Step 2: Describe contents briefly**
- List what belongs there (auth URL/fields, credential source refs, session reuse guidance, shared setup defaults, safety notes placeholder), stressing concision and no secrets.

### Task 4: Optional sanity check

**Files:**
- (Optional) `agent-browser/agents/browser-agent.md`

**Step 1: Dry-run lint**
- Re-read updated Phase 1 text to ensure instructions are clear, non-redundant, and don’t conflict with workflow lookup steps.

**Step 2: Confirm paths**
- Ensure references use `thoughts/shared/browser/GENERAL.md` exactly and keep workflow save/load behavior unchanged.

---

## Execution Handoff

Plan complete and saved to `thoughts/shared/plans/plugins/2026-02-11-browser-general-md-implementation.md`. Two execution options:

1) **Subagent-Driven (this session)** — I dispatch a fresh subagent per task with checkpoints (use @roach:subagent-driven-development).

2) **Parallel Session** — Open a new session and use @roach:executing-plans to run tasks in sequence.

Which approach? (If proceeding here, we’ll follow the plan task-by-task.)