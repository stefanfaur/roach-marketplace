# Prepush Plugin Implementation Plan

## Overview

Create a new `prepush` plugin for the roach-marketplace that installs and manages a git `pre-push` hook. The plugin provides two configurable modes: basic (runs quality tools only) and AI review (runs quality tools then invokes Claude CLI for code review). A SessionStart hook onboards developers by auto-detecting their tech stack, reading CLAUDE.md, and offering to set up the pre-push workflow with customizable focus areas.

## Current State Analysis

The marketplace currently has 3 plugins (roach, agent-browser, frontend-design) registered in `.claude-plugin/marketplace.json`. The roach plugin's `session-start.js` hook demonstrates the established pattern for SessionStart hooks: output JSON with `hookSpecificOutput.additionalContext` to inject context into Claude's session. Multiple plugins can register SessionStart hooks independently — Claude Code runs all of them and merges the `additionalContext` into separate `<system-reminder>` blocks.

### Key Discoveries:
- Hook registration: each plugin has its own `hooks.json` at `<plugin>/hooks/hooks.json` — no collision risk (`roach/hooks/hooks.json:3-12`)
- Hook output protocol: JSON on stdout with `{ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: "..." } }` (`roach/hooks/session-start.js:188-201`)
- Hook scripts use `${CLAUDE_PLUGIN_ROOT}` env var for self-referencing (`roach/hooks/hooks.json:9`)
- Plugin manifest: `<plugin>/.claude-plugin/plugin.json` with `name`, `description`, `version`, `author`, `license`, `keywords` fields (`roach/.claude-plugin/plugin.json:1-10`)
- Commands are markdown files with YAML frontmatter in `<plugin>/commands/<name>.md` (`roach/commands/commit.md:1-3`)
- AskUserQuestion is triggered indirectly: the hook injects text INSTRUCTING Claude to call AskUserQuestion, not the hook itself (`roach/hooks/session-start.js:121-126`)

## Desired End State

A fully functional `prepush` plugin that:
1. Auto-detects the project's tech stack and CLAUDE.md conventions on first session
2. Asks the developer (via Claude's AskUserQuestion) whether to set up pre-push checks, with options for focus customization
3. Generates `.claude/prepush.json` (config), `.claude/commands/prepush_review.md` (AI review command), and `.git/hooks/pre-push` (git hook)
4. The git pre-push hook runs quality tools and optionally invokes `claude -p` for AI review with JSON-structured verdict parsing
5. Operates alongside roach's startup hook without interference
6. Is listed in the marketplace manifest

### Verification:
- Install the plugin, start a session in a git project → startup hook detects stack and prompts setup
- Say "yes, focus on security" → config, command, and git hook are created correctly
- Run `git push` → quality tools run, AI review runs (in auto mode), push succeeds or is blocked based on verdict
- Start a session with roach also installed → both startup hooks produce output, no conflicts

## What We're NOT Doing

- No GUI/web UI for configuration
- No support for other git hooks (pre-commit, commit-msg, etc.) — only pre-push
- No integration with external CI/CD systems
- No hook manager integration (husky, lefthook) — standalone git hook
- No support for monorepos with per-package hooks
- No caching of review results between pushes

## Implementation Approach

Build the plugin incrementally: scaffold first, then detection logic, then config/command generation, then the git hook itself, and finally marketplace integration. The startup hook is the orchestrator — it detects, instructs Claude, and Claude does the heavy lifting (file creation, hook installation).

---

## Phase 1: Plugin Scaffold

### Overview
Create the plugin directory structure and register it in the marketplace.

### Changes Required:

#### 1. Plugin Manifest
**File**: `prepush/.claude-plugin/plugin.json`
**Changes**: Create new file

```json
{
  "name": "prepush",
  "description": "Git pre-push hook with configurable quality checks and AI-powered code review",
  "version": "1.0.0",
  "author": {
    "name": "Stefan Faur"
  },
  "license": "MIT",
  "keywords": ["git", "pre-push", "code-review", "quality", "hooks"]
}
```

#### 2. Hook Registration
**File**: `prepush/hooks/hooks.json`
**Changes**: Create new file

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"
          }
        ]
      }
    ]
  }
}
```

#### 3. Marketplace Registration
**File**: `.claude-plugin/marketplace.json`
**Changes**: Add prepush entry to the `plugins` array

```json
{
  "name": "prepush",
  "description": "Git pre-push hook with configurable quality checks and AI-powered code review",
  "version": "1.0.0",
  "source": "./prepush",
  "category": "development"
}
```

#### 4. Skeleton Session Start Hook
**File**: `prepush/hooks/session-start.js`
**Changes**: Create minimal hook that outputs valid JSON (will be expanded in Phase 2)

```javascript
#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

function run(cmd, fallback = '') {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return fallback; }
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}

async function main() {
  const projectDir = run('git rev-parse --show-toplevel') || process.cwd();
  const configPath = path.join(projectDir, '.claude', 'prepush.json');
  const isConfigured = fs.existsSync(configPath);

  let additionalContext = '';

  if (isConfigured) {
    additionalContext = '--- prepush plugin ---\nPre-push hooks are configured for this project. The developer can run /prepush_review manually or push to trigger automated checks.\n---';
  } else {
    // Phase 2 will implement detection and onboarding instructions
    additionalContext = '';
  }

  if (additionalContext) {
    const output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext
      }
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }
}

main().catch(err => {
  process.stderr.write('prepush session-start.js error: ' + err.message + '\n');
  process.exit(1);
});
```

### Success Criteria:

#### Automated Verification:
- [ ] `prepush/.claude-plugin/plugin.json` exists and is valid JSON
- [ ] `prepush/hooks/hooks.json` exists and is valid JSON
- [ ] `prepush/hooks/session-start.js` executes without error: `node prepush/hooks/session-start.js`
- [ ] `.claude-plugin/marketplace.json` includes the prepush entry and is valid JSON: `cat .claude-plugin/marketplace.json | python3 -m json.tool`

#### Manual Verification:
- [ ] Plugin directory structure matches the convention used by other plugins in the repo

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 2: Stack Detection & Onboarding

### Overview
Implement the auto-detection logic and onboarding flow in the session-start hook. The hook detects the project's tech stack, reads CLAUDE.md, and injects instructions telling Claude to ask the developer about setup.

### Changes Required:

#### 1. Full Session Start Hook Implementation
**File**: `prepush/hooks/session-start.js`
**Changes**: Replace the skeleton with full implementation

The hook must:

**a) Detect tech stack** by checking for project files:

| File | Stack | Suggested Tools |
|------|-------|-----------------|
| `package.json` | JS/TS | Check `scripts.lint`, `scripts.test`; detect eslint, prettier, typescript in devDependencies |
| `pyproject.toml` or `setup.py` or `requirements.txt` | Python | `ruff check .`, `pytest` |
| `go.mod` | Go | `go vet ./...`, `go test ./...` |
| `Cargo.toml` | Rust | `cargo check`, `cargo test`, `cargo clippy` |
| `Gemfile` | Ruby | `bundle exec rubocop`, `bundle exec rspec` |
| `Makefile` | Any | Check for `lint`, `test`, `check`, `format` targets |

**b) Read CLAUDE.md** for project conventions:
- Read the file content (first 2000 chars to keep hook fast)
- Extract any mentions of lint/test/build commands
- Include relevant excerpts in the context for Claude

**c) Check for existing pre-push hook**:
- Check if `.git/hooks/pre-push` already exists
- If it does, note this in the context so Claude can ask about it

**d) Generate AskUserQuestion instructions**:

The `additionalContext` should instruct Claude to use `AskUserQuestion` with these options:

```
--- ACTION REQUIRED: Pre-Push Setup ---
The prepush plugin detected this project but no configuration exists yet.

Detected tech stack:
- [detected items with suggested commands]

CLAUDE.md excerpts (if relevant):
- [relevant command/convention excerpts]

Existing pre-push hook: [yes/no]

YOU MUST DO THIS: Handle any other plugin setup prompts first (e.g., web permission warnings), then use AskUserQuestion to ask the developer about pre-push setup.

Question: "Would you like to set up pre-push quality checks and AI code review for this project?"
Header: "Pre-push setup"
Options:
1. "Yes, set up with detected defaults" - description: "Install pre-push hook with: [detected tools]. AI review enabled in auto mode."
2. "No, skip setup" - description: "Don't set up pre-push checks. You can always set them up later."
3. "Yes, focus on ..." - description: "Set up pre-push checks with custom focus areas. Complete the sentence to specify what the AI review should focus on (e.g., security, performance, test coverage)."

After the developer responds:
- If "Yes" or "Yes, focus on...": Proceed to create .claude/prepush.json, .claude/commands/prepush_review.md, and .git/hooks/pre-push using the instructions in the prepush plugin templates.
- If "No": Acknowledge and move on to the user's actual task.
- If free text (Other): Parse their intent and either set up with their preferences or skip.

[Include full template content and installation instructions here so Claude has everything needed to create the files — see Phase 3 and Phase 4 for the exact file contents]
---
```

**e) Handle priority ordering with other plugins**:
The instructions should use a generic deferral: "Handle any other plugin setup prompts first (e.g., web permission warnings), then proceed with pre-push setup." This ensures prepush works standalone without assuming any specific plugin (like roach) is installed. If other plugins have higher-priority prompts, they run first; if no other plugins are present, prepush proceeds immediately.

### Implementation Details for `session-start.js`:

```javascript
// Tech stack detection
function detectStack(projectDir) {
  const detections = [];

  // JavaScript/TypeScript
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = readJSON(pkgPath);
    if (pkg) {
      if (pkg.scripts?.lint) detections.push({ name: 'lint', command: 'npm run lint' });
      if (pkg.scripts?.test) detections.push({ name: 'test', command: 'npm test' });
      if (!pkg.scripts?.lint && (pkg.devDependencies?.eslint || pkg.dependencies?.eslint))
        detections.push({ name: 'eslint', command: 'npx eslint .' });
      if (pkg.devDependencies?.prettier)
        detections.push({ name: 'prettier-check', command: 'npx prettier --check .' });
      if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript)
        detections.push({ name: 'typecheck', command: 'npx tsc --noEmit' });
    }
  }

  // Python
  if (fs.existsSync(path.join(projectDir, 'pyproject.toml')) ||
      fs.existsSync(path.join(projectDir, 'setup.py')) ||
      fs.existsSync(path.join(projectDir, 'requirements.txt'))) {
    detections.push({ name: 'lint', command: 'ruff check .' });
    detections.push({ name: 'test', command: 'pytest' });
  }

  // Go
  if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
    detections.push({ name: 'vet', command: 'go vet ./...' });
    detections.push({ name: 'test', command: 'go test ./...' });
  }

  // Rust
  if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
    detections.push({ name: 'check', command: 'cargo check' });
    detections.push({ name: 'test', command: 'cargo test' });
    detections.push({ name: 'clippy', command: 'cargo clippy -- -D warnings' });
  }

  // Ruby
  if (fs.existsSync(path.join(projectDir, 'Gemfile'))) {
    detections.push({ name: 'rubocop', command: 'bundle exec rubocop' });
    detections.push({ name: 'test', command: 'bundle exec rspec' });
  }

  // Makefile targets
  const makefilePath = path.join(projectDir, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    try {
      const makefile = fs.readFileSync(makefilePath, 'utf-8');
      const targets = ['lint', 'test', 'check', 'format'];
      for (const target of targets) {
        if (new RegExp(`^${target}\\s*:`, 'm').test(makefile) &&
            !detections.some(d => d.name === target)) {
          detections.push({ name: target, command: `make ${target}` });
        }
      }
    } catch {}
  }

  return detections;
}

// Read CLAUDE.md excerpts
function readClaudeMd(projectDir) {
  const claudePath = path.join(projectDir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) return '';
  try {
    const content = fs.readFileSync(claudePath, 'utf-8').substring(0, 2000);
    // Look for lines mentioning commands, tools, testing
    const relevant = content.split('\n')
      .filter(line => /\b(lint|test|check|build|format|eslint|prettier|jest|pytest|cargo|make)\b/i.test(line))
      .slice(0, 10)
      .join('\n');
    return relevant || '';
  } catch { return ''; }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `node prepush/hooks/session-start.js` runs without error in a git repo without `.claude/prepush.json`
- [ ] `node prepush/hooks/session-start.js` outputs valid JSON with `hookSpecificOutput.additionalContext` containing "Pre-Push Setup"
- [ ] `node prepush/hooks/session-start.js` in a project with `.claude/prepush.json` outputs the "configured" message
- [ ] The hook completes in under 2 seconds (fast enough for session start)

#### Manual Verification:
- [ ] Start a Claude Code session with prepush installed alone → onboarding works standalone
- [ ] Start a session with both roach and prepush installed → other plugin prompts appear first, then prepush setup
- [ ] The detected tech stack matches the actual project
- [ ] CLAUDE.md relevant lines are included if present

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 3: Config & Command Generation

### Overview
Create the template system for generating `.claude/prepush.json` and `.claude/commands/prepush_review.md`. These templates are embedded in the session-start hook's `additionalContext` so Claude can create the files when the developer says yes.

### Changes Required:

#### 1. Config File Template
**File**: Referenced inline in `prepush/hooks/session-start.js` additionalContext

The `.claude/prepush.json` schema:

```json
{
  "version": 1,
  "mode": "auto",
  "qualityTools": [
    { "name": "lint", "command": "npm run lint" },
    { "name": "test", "command": "npm test" }
  ],
  "review": {
    "enabled": true,
    "focus": ["correctness", "security"],
    "command": "prepush_review"
  }
}
```

Fields:
- `version`: Schema version (always 1 for now)
- `mode`: `"auto"` (claude CLI invocation) or `"manual"` (block push, instruct developer)
- `qualityTools`: Array of `{ name, command }` objects — the quality checks to run before push
- `review.enabled`: Whether AI review is active
- `review.focus`: Array of focus area strings (e.g., "security", "performance", "error handling", "test coverage")
- `review.command`: The slash command name for manual mode

#### 2. Command Template
**File**: `prepush/templates/prepush_review.md`
**Changes**: Create new file

This is the template that Claude will customize and write to `.claude/commands/prepush_review.md` in the developer's project.

```markdown
---
description: AI code review for commits before pushing
---

# Pre-Push Code Review

You are performing a pre-push code review. Your goal is to catch issues before they reach the remote repository.

## Step 1: Identify What's Being Pushed

Run these commands to understand the changes:

```bash
git log @{u}..HEAD --oneline
```

```bash
git diff @{u}..HEAD --stat
```

Read the full diff to understand all changes:

```bash
git diff @{u}..HEAD
```

## Step 2: Run Quality Checks

Run each of the following quality tools and report results. If any fail, note the failures.

{{QUALITY_TOOLS}}

## Step 3: Review the Code Changes

With the quality checks complete, review the actual code changes. Focus specifically on:

{{FOCUS_AREAS}}

For each file changed, assess:
- Are there any bugs or logic errors?
- Are there security vulnerabilities?
- Is error handling adequate?
- Are there any obvious performance issues?
- Does the code follow the project's conventions?

## Step 4: Report

Present your findings in this format:

### Quality Check Results
- [tool name]: PASS/FAIL (details if failed)

### Code Review Findings

**Critical Issues** (must fix before push):
- [issue description with file:line reference]

**Warnings** (consider fixing):
- [issue description with file:line reference]

**Notes** (informational):
- [observation]

### Verdict
State clearly: **PASS** (safe to push) or **FAIL** (issues found that should be addressed).

If FAIL, summarize the blocking issues concisely.
```

The `{{QUALITY_TOOLS}}` and `{{FOCUS_AREAS}}` placeholders will be replaced by Claude during setup based on the config:

- `{{QUALITY_TOOLS}}` becomes a numbered list like:
  ```
  1. Run lint: `npm run lint`
  2. Run tests: `npm test`
  ```

- `{{FOCUS_AREAS}}` becomes a bullet list like:
  ```
  - **Security**: Look for injection vulnerabilities, exposed secrets, insecure patterns
  - **Error handling**: Check for unhandled exceptions, missing error boundaries
  ```

#### 3. Embed Templates in Session Start Hook
**File**: `prepush/hooks/session-start.js`
**Changes**: Add the template content and config schema into the `additionalContext` that gets injected

The `additionalContext` must include:
1. The full config JSON schema with field descriptions
2. The full command template (with placeholders)
3. Clear instructions for Claude on how to:
   - Replace `{{QUALITY_TOOLS}}` with the detected/confirmed tools
   - Replace `{{FOCUS_AREAS}}` with the developer's chosen focus areas
   - Write `.claude/prepush.json` with the correct values
   - Write `.claude/commands/prepush_review.md` with the customized template
   - Create `.claude/commands/` directory if it doesn't exist

The session-start.js should read the template file from `${PLUGIN_ROOT}/templates/prepush_review.md` and embed it (JSON-escaped) in the additionalContext, similar to how roach reads and embeds the using-roach skill content.

### Success Criteria:

#### Automated Verification:
- [ ] `prepush/templates/prepush_review.md` exists and contains `{{QUALITY_TOOLS}}` and `{{FOCUS_AREAS}}` placeholders
- [ ] `node prepush/hooks/session-start.js` outputs additionalContext that includes the template content
- [ ] The template is valid markdown when placeholders are replaced with sample content

#### Manual Verification:
- [ ] In a Claude Code session, after saying "Yes" to setup, Claude correctly creates `.claude/prepush.json` with detected tools
- [ ] Claude correctly creates `.claude/commands/prepush_review.md` with focus areas filled in
- [ ] The generated command is usable: running `/prepush_review` produces a meaningful code review

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 4: Git Hook & Review System

### Overview
Create the git pre-push hook script and the AI review runner. The hook is a bash script installed at `.git/hooks/pre-push` that reads config, runs quality tools, and optionally invokes Claude CLI for AI review with JSON-structured verdict parsing.

### Changes Required:

#### 1. Pre-Push Hook Script Template
**File**: `prepush/lib/pre-push-hook.sh`
**Changes**: Create new file

This bash script template is what gets installed at `.git/hooks/pre-push`. It must be self-contained (no external dependencies beyond standard Unix tools, `node`, and optionally `claude`).

```bash
#!/usr/bin/env bash
# prepush plugin - git pre-push hook
# Runs quality checks and optional AI code review before push
set -euo pipefail

CONFIG_FILE=".claude/prepush.json"

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "prepush: No configuration found at $CONFIG_FILE, skipping checks."
  exit 0
fi

# Parse config using node (available since we're in a Claude Code context)
read_config() {
  node -e "
    const cfg = JSON.parse(require('fs').readFileSync('$CONFIG_FILE', 'utf-8'));
    console.log(JSON.stringify(cfg));
  " 2>/dev/null
}

CONFIG_JSON=$(read_config)
if [ -z "$CONFIG_JSON" ]; then
  echo "prepush: Failed to read config, skipping checks."
  exit 0
fi

MODE=$(echo "$CONFIG_JSON" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).mode || 'auto')")
REVIEW_ENABLED=$(echo "$CONFIG_JSON" | node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8')).review?.enabled ?? false))")

echo "=============================="
echo "  prepush: Running pre-push checks"
echo "=============================="
echo ""

# Run quality tools
TOOLS_JSON=$(echo "$CONFIG_JSON" | node -e "
  const cfg = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
  const tools = cfg.qualityTools || [];
  tools.forEach(t => console.log(t.name + '|||' + t.command));
")

QUALITY_FAILED=0
while IFS='|||' read -r NAME CMD; do
  [ -z "$NAME" ] && continue
  echo "Running $NAME: $CMD"
  if eval "$CMD"; then
    echo "  $NAME: PASSED"
  else
    echo "  $NAME: FAILED"
    QUALITY_FAILED=1
  fi
  echo ""
done <<< "$TOOLS_JSON"

if [ "$QUALITY_FAILED" -eq 1 ]; then
  echo "prepush: Quality checks failed. Push aborted."
  exit 1
fi

echo "prepush: All quality checks passed."

# AI Review (if enabled)
if [ "$REVIEW_ENABLED" = "true" ]; then
  echo ""

  if [ "$MODE" = "auto" ]; then
    echo "prepush: Running AI code review..."

    # Check if claude CLI is available
    if ! command -v claude &>/dev/null; then
      echo "prepush: 'claude' CLI not found in PATH. Skipping AI review."
      echo "  Install Claude Code CLI or switch to manual mode in $CONFIG_FILE"
      exit 0
    fi

    # Get the changes being pushed
    DIFF=$(git diff @{u}..HEAD 2>/dev/null || git diff origin/$(git rev-parse --abbrev-ref HEAD)..HEAD 2>/dev/null || echo "Could not determine diff")
    LOG=$(git log @{u}..HEAD --oneline 2>/dev/null || echo "Could not determine commits")

    # Get focus areas from config
    FOCUS=$(echo "$CONFIG_JSON" | node -e "
      const cfg = JSON.parse(require('fs').readFileSync('/dev/stdin','utf-8'));
      const focus = cfg.review?.focus || ['general code quality'];
      console.log(focus.join(', '));
    ")

    # Build the review prompt
    REVIEW_PROMPT="You are a code reviewer performing a pre-push review.

Review the following changes. Focus on: ${FOCUS}

Commits being pushed:
${LOG}

Changes:
${DIFF}

IMPORTANT: Respond ONLY with valid JSON in exactly this format, nothing else:
{\"verdict\": \"PASS\", \"summary\": \"brief summary of review\", \"issues\": [{\"severity\": \"error\", \"file\": \"path\", \"description\": \"issue description\"}]}

Use verdict PASS if the changes are acceptable. Use verdict FAIL only for critical issues (bugs, security vulnerabilities, data loss risks). Warnings and style issues should not cause FAIL."

    # Run claude and capture output
    REVIEW_RESULT=$(claude -p "$REVIEW_PROMPT" 2>/dev/null || echo '{"verdict":"PASS","summary":"Review could not be completed","issues":[]}')

    # Parse the verdict
    VERDICT=$(echo "$REVIEW_RESULT" | node -e "
      let input = '';
      process.stdin.on('data', d => input += d);
      process.stdin.on('end', () => {
        try {
          // Try to extract JSON from the response (Claude may wrap it in markdown)
          const jsonMatch = input.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log(result.verdict || 'PASS');
          } else {
            console.log('PASS');
          }
        } catch {
          console.log('PASS');
        }
      });
    ")

    SUMMARY=$(echo "$REVIEW_RESULT" | node -e "
      let input = '';
      process.stdin.on('data', d => input += d);
      process.stdin.on('end', () => {
        try {
          const jsonMatch = input.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            console.log(result.summary || 'No summary');
            if (result.issues && result.issues.length > 0) {
              result.issues.forEach(i => {
                const sev = i.severity === 'error' ? 'ERROR' : 'WARN';
                console.log('  [' + sev + '] ' + (i.file ? i.file + ': ' : '') + i.description);
              });
            }
          }
        } catch {
          console.log('Could not parse review result');
        }
      });
    ")

    echo ""
    echo "AI Review Result: $VERDICT"
    echo "$SUMMARY"

    if [ "$VERDICT" = "FAIL" ]; then
      echo ""
      echo "prepush: AI review found critical issues. Push aborted."
      echo "  Fix the issues above or switch to manual mode in $CONFIG_FILE"
      exit 1
    fi

    echo ""
    echo "prepush: AI review passed."

  elif [ "$MODE" = "manual" ]; then
    echo "prepush: AI review is in manual mode."
    echo "  Run /prepush_review in Claude Code to review your changes before pushing."
    echo "  To push without review, temporarily set review.enabled to false in $CONFIG_FILE"
    exit 1
  fi
fi

echo ""
echo "prepush: All checks passed. Proceeding with push."
exit 0
```

#### 2. Installation Instructions in Session Start Hook
**File**: `prepush/hooks/session-start.js`
**Changes**: The `additionalContext` must include instructions for Claude to install the git hook

The instructions should tell Claude to:
1. Read the hook template from `${CLAUDE_PLUGIN_ROOT}/lib/pre-push-hook.sh` — but since Claude won't have access to the plugin root at that point, the template must be embedded in the additionalContext itself
2. Alternatively: embed the full hook script in the additionalContext (JSON-escaped), similar to how roach embeds the using-roach skill

Better approach: The session-start.js reads `pre-push-hook.sh` and embeds it in the additionalContext, alongside the command template. Then the instructions tell Claude to:
1. Create `.claude/prepush.json`
2. Create `.claude/commands/prepush_review.md`
3. Check if `.git/hooks/pre-push` exists:
   - If yes: ask the developer what to do (backup + replace, append, or skip)
   - If no: write the hook script and `chmod +x` it
4. Confirm everything is set up

#### 3. Handle Existing Pre-Push Hooks
The session-start.js should check for existing `.git/hooks/pre-push` and include this information in the additionalContext. The instructions should tell Claude:
- If no existing hook: install directly
- If existing hook exists: use AskUserQuestion to ask:
  - "Replace (backup old hook to .git/hooks/pre-push.backup)"
  - "Skip hook installation (configure manually later)"

### Implementation Details:

In `session-start.js`, read and embed the hook template:

```javascript
// Read the pre-push hook template
let hookTemplate = '';
try {
  hookTemplate = fs.readFileSync(path.join(PLUGIN_ROOT, 'lib', 'pre-push-hook.sh'), 'utf-8');
} catch (err) {
  hookTemplate = '# Error reading hook template: ' + err.message;
}

// JSON-escape for embedding
const hookTemplateEscaped = JSON.stringify(hookTemplate).slice(1, -1);
```

### Success Criteria:

#### Automated Verification:
- [ ] `prepush/lib/pre-push-hook.sh` exists and is valid bash: `bash -n prepush/lib/pre-push-hook.sh`
- [ ] The hook script handles missing config gracefully (exits 0)
- [ ] The hook script handles missing `claude` CLI gracefully (skips AI review, exits 0)
- [ ] `node prepush/hooks/session-start.js` output includes the embedded hook template

#### Manual Verification:
- [ ] In a Claude Code session, after setup, `.git/hooks/pre-push` is created and executable
- [ ] Running `git push` with all quality tools passing → push succeeds
- [ ] Running `git push` with a quality tool failing → push is blocked with clear error
- [ ] In auto mode with `claude` CLI available → AI review runs and verdict is parsed correctly
- [ ] In manual mode → push is blocked with instruction to run `/prepush_review`
- [ ] When `.git/hooks/pre-push` already exists → developer is asked what to do

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to the next phase.

---

## Phase 5: Marketplace Integration & README

### Overview
Finalize the plugin, write a concise README, and verify compatibility with the roach plugin.

### Changes Required:

#### 1. README
**File**: `prepush/README.md`
**Changes**: Create concise documentation

Contents should cover:
- What the plugin does (1-2 sentences)
- How it works (the flow: startup detection → setup → push → checks → review)
- Configuration reference (`.claude/prepush.json` fields)
- The two modes (auto vs manual)
- How to customize the review command
- How to uninstall (remove config, command, and git hook)

Keep it under 100 lines.

#### 2. Verify Marketplace Manifest
**File**: `.claude-plugin/marketplace.json`
**Changes**: Already added in Phase 1, verify it's correct

#### 3. Final Directory Structure Verification

```
prepush/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   ├── hooks.json
│   └── session-start.js
├── templates/
│   └── prepush_review.md
├── lib/
│   └── pre-push-hook.sh
└── README.md
```

### Success Criteria:

#### Automated Verification:
- [ ] All JSON files are valid: `find prepush -name "*.json" -exec python3 -m json.tool {} \;`
- [ ] `prepush/README.md` exists and is under 100 lines
- [ ] `node prepush/hooks/session-start.js` runs clean in a fresh git repo
- [ ] `.claude-plugin/marketplace.json` lists all 4 plugins (roach, frontend-design, agent-browser, prepush)
- [ ] The hook script is valid bash: `bash -n prepush/lib/pre-push-hook.sh`

#### Manual Verification:
- [ ] Start a session with prepush alone → works standalone, no missing plugin references
- [ ] Start a session with both roach and prepush installed → both produce output, no errors, correct ordering
- [ ] Full end-to-end flow works: setup → push → quality checks → AI review → verdict

**Implementation Note**: After completing this phase, the plugin is ready for distribution.

---

## Testing Strategy

### Unit-Level Testing:
- Test `session-start.js` in repos with different tech stacks (JS, Python, Go, Rust, Ruby)
- Test with and without CLAUDE.md present
- Test with existing `.claude/prepush.json` (should skip onboarding)
- Test `pre-push-hook.sh` with mock config files
- Test JSON verdict parsing with various Claude response formats (clean JSON, JSON in markdown code blocks, malformed responses)

### Integration Testing:
- Install plugin, start session, complete full setup flow
- Push with passing quality tools → should succeed
- Push with failing quality tool → should block
- Push with AI review in auto mode → should invoke claude and parse verdict
- Push with AI review in manual mode → should block with instructions

### Compatibility Testing:
- Prepush installed alone (without roach) → onboarding works standalone, no references to missing plugins
- Both roach and prepush installed simultaneously → both SessionStart hooks produce output, no errors
- Verify no file conflicts between plugins
- Verify instructions don't contradict each other
- Prepush generic deferral ("handle other plugin prompts first") works correctly in both cases

## Performance Considerations

- The session-start hook must complete fast (<2 seconds) — all detection is file-system based, no network calls
- The pre-push hook's quality tools may take time (tests), but that's expected
- The AI review via `claude -p` will take 10-30 seconds depending on diff size — this is acceptable for a pre-push check
- For very large diffs, the prompt may exceed token limits — the hook should truncate the diff to a reasonable size (e.g., first 50KB) and note the truncation

## References

- Roach session-start hook pattern: `roach/hooks/session-start.js:188-201`
- Roach hooks.json structure: `roach/hooks/hooks.json:3-12`
- Plugin manifest pattern: `roach/.claude-plugin/plugin.json:1-10`
- Marketplace manifest: `.claude-plugin/marketplace.json:1-36`
- Command frontmatter pattern: `roach/commands/commit.md:1-3`
