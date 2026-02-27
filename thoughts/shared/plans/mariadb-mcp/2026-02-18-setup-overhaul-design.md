# mariadb-mcp Plugin Overhaul Design
Date: 2026-02-18

## Problem Statement

The mariadb-mcp plugin has 14 issues. Critical ones:
- `setup.js` uses readline for interactivity — wrong paradigm inside Claude Code
- Database credentials embedded in command-line args (visible in `ps aux`)
- Read-only mode hardcoded, user preference ignored
- Reinstall confirmation logic is backwards (only `yes` works, `y` cancels)
- Multiple MariaDB MCP server handling silently uses wrong one
- Port detection regex fragile (`:(\d+)` matches wrong group in URLs with auth)
- Missing reference files: `backup-replication.md`, `migrations.md`

## Architecture Decision

**Split responsibility**: Claude Code handles all thinking/Q&A; `setup.js` is a pure executor.

```
Before:
  /mariadb-setup → command.md → node setup.js (readline Q&A + acts)

After:
  /mariadb-setup → command.md → Claude Q&A → node setup.js --flags (pure executor)
```

## Component Changes

### 1. `commands/mariadb-setup.md` — Full rewrite

Claude handles:
- Inline arg parsing: `/mariadb-setup host=prod.db user=app` skips those questions
- Fresh install vs existing install detection (reads filesystem directly)
- Q&A: host, port, user, password, read-only preference
- Existing install options: update / reconfigure / both / reinstall (natural conversation)
- Destructive reinstall: explicit path stated + confirmation via conversation
- Password written to temp file via `mktemp`, passed as `--pass-file`, deleted after

### 2. `scripts/setup.js` — Rewrite as pure CLI executor

Interface:
```
node setup.js \
  --action install|update|reconfigure|both|reinstall \
  --host <host> \
  --port <port> \
  --user <user> \
  --pass-file <path>     ← temp file, not inline arg \
  --read-only true|false \
  --install-dir <path>   ← optional override
```

- No readline, no interactive prompts
- Exit codes: 0=success, 1=prereqs missing, 2=clone/install failed, 3=config write failed
- Stdout: structured JSON for Claude to parse and report
- Password: read from file, file deleted immediately after reading
- Credential exposure fix: never pass password as CLI arg or env var in child process command line

### 3. `hooks/session-start.js` — Bug fixes

- Fix multiple server bug: warn if multiple 'mariadb' keys, prefer exact match
- Fix URL port regex: use `new URL(url).port` instead of `/:(\d+)/`
- Better error message when `~/.claude.json` has invalid JSON

### 4. `tests/` — New test suite

Language: Python + uv + pexpect
Location: `mariadb-mcp/tests/`

**Fixtures (`conftest.py`)**:
- `tmp_home` — isolated temp HOME per test, no real `~/.claude.json` touched
- `mock_git_clone` — copies `tests/fixtures/mariadb-mcp-server/` instead of GitHub clone
- `mock_connection_test` — patches Python connection check
- `claude_session(tmp_home)` — spawns `claude` via pexpect with HOME overridden

**Test cases (`test_mariadb_setup.py`)**:
```
test_fresh_install          → answer all questions, assert .env + ~/.claude.json written
test_update_existing        → existing fixture, choose update, assert git pull called
test_reconfigure_only       → existing fixture, change host, assert .env updated only
test_reinstall_confirm      → confirm reinstall, assert old dir deleted + fresh install
test_reinstall_cancel       → cancel reinstall, assert nothing deleted
test_connection_fail        → mock failure, assert .env NOT written
```

**Assertion strategy**: Filesystem-based (not output-based). pexpect uses loose regex matching
(`r'[Hh]ost'`) since LLM output is non-deterministic.

### 5. Missing reference files

Create:
- `skills/mariadb-best-practices/references/backup-replication.md`
- `skills/mariadb-best-practices/references/migrations.md`

## Files to Change

| File | Action |
|------|--------|
| `commands/mariadb-setup.md` | Rewrite |
| `scripts/setup.js` | Rewrite |
| `hooks/session-start.js` | Fix bugs (3 issues) |
| `skills/mariadb-best-practices/references/backup-replication.md` | Create |
| `skills/mariadb-best-practices/references/migrations.md` | Create |
| `tests/pyproject.toml` | Create |
| `tests/conftest.py` | Create |
| `tests/test_mariadb_setup.py` | Create |
| `tests/fixtures/mariadb-mcp-server/` | Create (minimal fixture) |
