# mariadb-mcp Test Suite

Integration tests for the `/mariadb-setup` command. Tests spawn a real `claude` process via pexpect, drive it through the setup conversation, and assert filesystem state afterwards.

The tests require a running `claude` CLI because they are testing Claude's behavior, not just the shell script. Claude must read the command instructions, ask the credential questions in the right order, handle confirmation prompts (e.g. reinstall guard), call `setup.js` with the correct flags, parse the JSON result, and produce the right completion message. The LLM reasoning is what's under test. The fake binaries only replace external side-effects (git, uv) so tests don't need network access or a live database.

## Prerequisites

- Python 3.11+
- `uv` — [install](https://docs.astral.sh/uv/getting-started/installation/)
- `claude` CLI in `PATH`
- Claude Code authenticated (`claude` CLI works in your terminal)

## Running the tests

```bash
cd mariadb-mcp
uv run --project tests pytest tests/ -v
```

Expected output: 6 tests pass in under 2 minutes.

## How it works

### Isolation

Each test gets its own `HOME` directory under pytest's `tmp_path`. Nothing touches your real `~/.claude.json` or `~/.claude/mcp-servers/`.

### Fake binaries

`conftest.py` builds a `bin/` directory prepended to `PATH` containing stub `git` and `uv` scripts:

- `git clone` — copies the fixture server tree into the target directory instead of hitting GitHub
- `git pull` — prints "Already up to date." and exits 0
- `uv sync` — prints "Resolved" and exits 0
- `uv run` — prints "SUCCESS" and exits 0 (simulates a passing DB connection)

The `TestConnectionFailure` class overrides `uv run` to exit 1, simulating a refused connection.

### Fixture server

`fixtures/mariadb-mcp-server/` is a minimal Python project accepted by `uv sync`. It satisfies the installer without pulling any real packages.

### Conversation flow

Each test:
1. Spawns `claude` with isolated `HOME` and fake `PATH`
2. Sends `/mariadb-setup`
3. Answers Claude's questions (host, port, user, password, read-only)
4. Waits for a completion or error signal
5. Asserts the expected files exist with the expected content

## Test cases

| Test | Scenario | Asserts |
|------|----------|---------|
| `test_fresh_install_writes_env_and_config` | No existing install → full install flow | `.env` written with correct values; `mariadb` entry added to `~/.claude.json` |
| `test_update_preserves_credentials` | Existing install, user chooses "update" | `.env` credentials unchanged after code update |
| `test_reconfigure_updates_env_only` | Existing install, user chooses "reconfigure" | `.env` updated with new credentials; no git pull |
| `test_reinstall_confirm_deletes_and_reinstalls` | Existing install, user chooses "reinstall" then confirms | Install dir recreated; new `.env` written |
| `test_reinstall_cancel_does_nothing` | Existing install, user chooses "reinstall" then cancels | Install dir and `.env` unchanged |
| `test_connection_fail_reports_error` | `uv run` returns exit 1 | Claude reports connection failure; `.env` and `~/.claude.json` still written |

## Debugging

Each test writes a full pexpect transcript to `pexpect.log` in its isolated HOME. When a test times out or fails, retrieve the path from the pytest output and inspect it:

```
cat /tmp/pytest-of-*/pytest-*/test_*/home/pexpect.log
```

The log shows every character Claude sent and received, making it straightforward to see where the conversation diverged from what the test expected.

## Unit-level checks (no API key needed)

`scripts/setup.js` can be verified independently:

```bash
# Missing --action → exit 1, JSON error
node scripts/setup.js
echo $?   # 1

# Bad pass-file → exit 1, JSON error
node scripts/setup.js --action install --host localhost --port 3306 --user root --pass-file /nonexistent
echo $?   # 1

# Help text
node scripts/setup.js --help
```
