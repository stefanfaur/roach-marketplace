# mariadb-mcp Plugin Overhaul — Implementation Plan
Date: 2026-02-18

## Overview

Overhaul the mariadb-mcp plugin to make setup fully Claude Code-native. Split
responsibility: `setup.js` becomes a pure CLI executor (no readline), while the
`mariadb-setup.md` command drives all interactivity through Claude's conversation.
Fix 3 bugs in `session-start.js`. Add a pexpect-based integration test suite.

## Current State Analysis

- `scripts/setup.js` (588 lines): uses readline for all interactivity, embeds DB
  credentials in subprocess command-line args (visible in `ps aux`), hardcodes
  `MCP_READ_ONLY=true` ignoring user preference, confirmation logic for reinstall
  is reversed (only literal `yes` proceeds, `y` cancels).
- `commands/mariadb-setup.md` (36 lines): thin wrapper that just runs
  `node setup.js`, no Claude-level logic.
- `hooks/session-start.js` (96 lines): 3 bugs — multiple mariadb server keys
  silently uses last match, URL port regex `:(\d+)` matches wrong group in
  auth-containing URLs, malformed `~/.claude.json` gives unhelpful message.
- All 9 reference files exist — no missing files to create.

## Desired End State

1. `/mariadb-setup` is a pure conversation: Claude asks questions, user answers in
   the chat, Claude calls `node setup.js --flags` once all info is collected.
2. `setup.js` accepts full config via CLI flags, reads password from a temp file
   (never in args or env of subprocesses), emits JSON to stdout, exits with
   meaningful codes.
3. `session-start.js` correctly handles multiple/no mariadb servers and URL formats.
4. `mariadb-mcp/tests/` contains a working pexpect test suite runnable with `uv run pytest`.

### Verification:
- Run `/mariadb-setup` in Claude Code → conversation flow, no terminal readline
- Run `node scripts/setup.js --help` → shows usage without blocking
- Run `uv run pytest mariadb-mcp/tests/` → all 6 tests pass
- Session start context shows correct status in `~/.claude.json` scenarios

## What We're NOT Doing

- Not changing `commands/mariadb.md` or `commands/mariadb-review.md`
- Not changing `skills/mariadb-best-practices/`
- Not adding Docker-based MariaDB tests (mocked filesystem tests only)
- Not adding a `--non-interactive` flag for CI (command handles that via inline args)
- Not changing `hooks/hooks.json`

---

## Phase 1: Rewrite `scripts/setup.js` as Pure CLI Executor

### Overview

Remove all readline/interactive code. Add CLI arg parsing. Fix credential exposure
by passing password via temp file read by the script. Emit structured JSON to stdout.

### Changes Required

#### 1. `mariadb-mcp/scripts/setup.js` — Full rewrite

**CLI interface:**
```
node setup.js \
  --action    install|update|reconfigure|both|reinstall \
  --host      <host>          (required for actions that write .env) \
  --port      <port>          (required for actions that write .env) \
  --user      <user>          (required for actions that write .env) \
  --pass-file <path>          (path to temp file containing password) \
  --read-only true|false      (default: true) \
  --install-dir <path>        (default: ~/.claude/mcp-servers/mariadb)
```

**Exit codes:**
- `0` — success
- `1` — prerequisites missing (Python 3.11+, uv, git)
- `2` — clone/update/install step failed
- `3` — .env or ~/.claude.json write failed
- `4` — connection test failed (config was written, server not reachable)

**stdout — structured JSON on completion:**
```json
{
  "success": true,
  "action": "install",
  "installDir": "/Users/x/.claude/mcp-servers/mariadb",
  "configPath": "/Users/x/.claude.json",
  "connectionTest": { "passed": true, "error": null },
  "steps": [
    { "name": "prerequisites", "ok": true, "detail": "Python 3.11, uv 0.5, git 2.4" },
    { "name": "clone",         "ok": true },
    { "name": "dependencies",  "ok": true },
    { "name": "env",           "ok": true },
    { "name": "config",        "ok": true },
    { "name": "connection",    "ok": true }
  ]
}
```

On failure, same shape with `"success": false` and relevant step `"ok": false, "error": "..."`.

**Credential exposure fix — `testConnection()`:**

Replace inline string interpolation with `spawnSync` passing credentials via the
`env` option (not visible in `ps aux` command line):

```javascript
function testConnection(credentials) {
  const testScript = `
import os, sys, mysql.connector
try:
    conn = mysql.connector.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ['DB_PORT']),
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )
    conn.close()
    print('SUCCESS')
    sys.exit(0)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`;
  const result = spawnSync(
    'uv',
    ['run', 'python', '-c', testScript],
    {
      cwd: installDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        DB_HOST: credentials.DB_HOST,
        DB_PORT: credentials.DB_PORT,
        DB_USER: credentials.DB_USER,
        DB_PASSWORD: credentials.DB_PASSWORD
      }
    }
  );
  return result.status === 0;
}
```

**Password temp file — reading and cleanup:**

```javascript
function readAndDeletePassFile(passFile) {
  try {
    const password = fs.readFileSync(passFile, 'utf8').trim();
    fs.unlinkSync(passFile);
    return password;
  } catch (err) {
    throw new Error(`Cannot read pass-file ${passFile}: ${err.message}`);
  }
}
```

Call this once at startup before any credential usage; `passFile` is then gone.

**Arg parsing — no external deps, manual process.argv parsing:**

```javascript
function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}
```

Validate required args based on action; throw with clear message if missing.

**Remove:** `readline`, `createPrompt()`, `question()`, `promptForCredentials()`,
`handleExistingInstallation()`, all `console.log` status prints (JSON only on
stdout; progress can go to stderr so it doesn't pollute JSON parsing).

**Keep (adapted):** `checkPrerequisites()`, `cloneRepository()`, `updateRepository()`,
`installDependencies()`, `writeEnvFile()`, `readExistingEnv()`, `updateClaudeConfig()`,
`testConnection()`.

### Success Criteria

#### Automated Verification:
- [x] `node scripts/setup.js` (no args) exits with code 1 and JSON `{"success":false,"error":"--action required"}`
- [x] `node scripts/setup.js --action install --host x --port 3306 --user root --pass-file /nonexistent` exits with code 1 (can't read pass-file) with JSON error
- [x] No `readline` import in the file: `grep -c 'readline' mariadb-mcp/scripts/setup.js` returns `0`
- [x] Password not in any subprocess args: verify `spawnSync` is used for `uv run python`

#### Manual Verification:
- [ ] Running with valid args (with real MariaDB) completes and writes correct files

**Pause here for confirmation before proceeding to Phase 2.**

---

## Phase 2: Rewrite `commands/mariadb-setup.md`

### Overview

Replace the thin wrapper with full Claude instructions. Claude detects install state,
collects credentials via conversation, writes the password to a temp file, calls
`setup.js`, reads JSON result, reports outcome.

### Changes Required

#### 1. `mariadb-mcp/commands/mariadb-setup.md` — Full rewrite

**Frontmatter** (keep same):
```yaml
---
name: mariadb-setup
description: Install and configure the MariaDB MCP server
model: sonnet
---
```

**Command body — full Claude instructions:**

```markdown
# MariaDB MCP Server Setup

## Step 1: Parse Inline Arguments

If the user's message contains `key=value` pairs (e.g. `host=prod.db port=5506 user=app`),
extract them as pre-filled answers. Supported keys: `host`, `port`, `user`, `pass`,
`read-only` (or `readonly`).

## Step 2: Detect Existing Installation

Run:
```bash
ls ~/.claude/mcp-servers/mariadb/ 2>/dev/null && echo "EXISTS" || echo "NOT_FOUND"
```

**If EXISTS** — Ask the user (in a single message):
> "I found an existing MariaDB MCP installation at `~/.claude/mcp-servers/mariadb/`.
> What would you like to do?
> - **Update** — Pull latest code from GitHub (keeps credentials)
> - **Reconfigure** — Update connection details only (keeps code)
> - **Both** — Update code and reconfigure credentials
> - **Reinstall** — Delete and reinstall from scratch
> - **Cancel** — Do nothing"

Wait for the user's choice. Map to `--action update|reconfigure|both|reinstall`.

If they choose **Reinstall**, ask explicitly:
> "This will permanently delete `~/.claude/mcp-servers/mariadb/` and reinstall.
> Are you sure? (yes/no)"
>
> Only proceed with reinstall if they answer yes/y. Otherwise cancel.

If they choose **Cancel**, stop and say "Setup cancelled."

**If NOT_FOUND** — action is `install`.

## Step 3: Collect Missing Credentials

Skip any credential already provided as inline arg.

Actions that need credentials: `install`, `reconfigure`, `both`, `reinstall`.
For `update`, skip to Step 4 (use existing .env).

Ask one at a time, showing defaults:
1. "MariaDB host? \[localhost\]" → default `localhost`
2. "MariaDB port? \[3306\]" → default `3306`, validate it's a number 1–65535
3. "MariaDB username? \[root\]" → default `root`
4. "MariaDB password? (leave blank for none)" → no default shown
5. "Enable read-only mode? \[yes\]" → default `yes`

## Step 4: Write Password Temp File

Run:
```bash
PASS_FILE=$(mktemp /tmp/mariadb-setup-XXXXXX)
printf '%s' '<password>' > "$PASS_FILE"
chmod 600 "$PASS_FILE"
echo "$PASS_FILE"
```

(Replace `<password>` with the actual password collected. If blank, write empty string.)

Store the `PASS_FILE` path for the next step.

## Step 5: Run setup.js

Run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.js \
  --action <action> \
  --host <host> \
  --port <port> \
  --user <user> \
  --pass-file <PASS_FILE> \
  --read-only <true|false> \
  2>&1
```

Omit `--host/--port/--user/--pass-file/--read-only` for `--action update` (no credential changes).

Capture the output. The last line of stdout is JSON.

## Step 6: Clean Up and Report

The pass-file is deleted by setup.js on read. If for any reason it still exists:
```bash
rm -f "$PASS_FILE"
```

Parse the JSON result. Report to the user:

**On success (exit 0):**
> "✅ MariaDB MCP server installed/updated successfully.
>
> - Server: `~/.claude/mcp-servers/mariadb/`
> - Config: `~/.claude.json`
> - Connection test: passed ✅
>
> **Restart Claude Code** for the MCP server to become available. After restarting, try `/mariadb` or `/mariadb-review`."

**On connection failure (exit 4):**
> "✅ MariaDB MCP server installed. Config saved.
> ❌ Connection test failed: `<error>`
>
> Check your credentials and run `/mariadb-setup` again, choosing **Reconfigure**."

**On other failure (exit 1/2/3):**
> "❌ Setup failed at step `<step>`: `<error>`
>
> `<specific guidance based on which step failed>`"
```

### Success Criteria

#### Automated Verification:
- [x] Command frontmatter is valid YAML: `python3 -c "import yaml; yaml.safe_load(open('mariadb-mcp/commands/mariadb-setup.md').read().split('---')[1])"`
- [x] `node scripts/setup.js` string appears in the command body

#### Manual Verification:
- [ ] Run `/mariadb-setup` in Claude Code → Claude asks host, port, user, password, read-only sequentially
- [ ] Run `/mariadb-setup host=localhost port=3306` → Claude skips those two questions
- [ ] Reinstall path asks for confirmation before proceeding
- [ ] Cancel path exits cleanly without touching filesystem

**Pause here for confirmation before proceeding to Phase 3.**

---

## Phase 3: Fix `hooks/session-start.js`

### Overview

Three targeted bug fixes. No structural changes.

### Changes Required

#### Fix 1: Multiple mariadb server keys (lines 45–50)

**Current (buggy):** silently uses last match if multiple keys contain 'mariadb'.

**Fix:** warn if multiple found, prefer exact key `'mariadb'`:

```javascript
var mariadbKeys = Object.keys(mcpServers).filter(function(key) {
  return key.toLowerCase().indexOf('mariadb') !== -1;
});

var mariadbKey = null;
var mariadbConfig = null;

if (mariadbKeys.length > 1) {
  // Prefer exact match; otherwise take first
  mariadbKey = mariadbKeys.indexOf('mariadb') !== -1 ? 'mariadb' : mariadbKeys[0];
  mariadbConfig = mcpServers[mariadbKey];
  statusMessage += '(Note: multiple mariadb MCP entries found; using "' + mariadbKey + '") ';
} else if (mariadbKeys.length === 1) {
  mariadbKey = mariadbKeys[0];
  mariadbConfig = mcpServers[mariadbKey];
}
```

#### Fix 2: URL port regex (line 57)

**Current (buggy):** `mariadbConfig.url.match(/:(\d+)/)` — matches first `:digits` group, which in `http://user:pass@host:8000/sse` would match `:pass`.

**Fix:** use the WHATWG URL API:

```javascript
var urlPort = null;
try {
  urlPort = new URL(mariadbConfig.url).port;
} catch (_) {}
var port = urlPort ? parseInt(urlPort, 10) : null;
```

#### Fix 3: Malformed `~/.claude.json` error message (lines 23–28)

**Current:** `readJSON` swallows parse error silently, caller sees `null` and reports "not configured."

**Fix:** distinguish between missing file and malformed file:

```javascript
function readJSON(filePath) {
  try {
    var content = fs.readFileSync(filePath, 'utf-8');
    try {
      return { data: JSON.parse(content), error: null };
    } catch (parseErr) {
      return { data: null, error: 'malformed JSON: ' + parseErr.message };
    }
  } catch (_) {
    return { data: null, error: null }; // file not found — normal
  }
}
```

Update callers: `claudeJson.data` instead of `claudeJson`; check `claudeJson.error`
and report "~/.claude.json contains invalid JSON — run `jsonlint ~/.claude.json` to diagnose."

### Success Criteria

#### Automated Verification:
- [x] `grep -n 'match.*:.*\\\\d' mariadb-mcp/hooks/session-start.js` returns nothing (old regex gone)
- [x] `grep -n 'new URL' mariadb-mcp/hooks/session-start.js` returns a match (new approach present)

#### Manual Verification:
- [ ] With two mariadb keys in `~/.claude.json`, session start reports the chosen key with note
- [ ] With `http://user:pass@localhost:8000/sse` as URL, port `8000` is correctly extracted

**Pause here for confirmation before proceeding to Phase 4.**

---

## Phase 4: Integration Test Suite

### Overview

Python + uv + pexpect test suite under `mariadb-mcp/tests/`. Spawns real `claude`
in interactive mode, feeds it `/mariadb-setup` and answers. Mocks git/uv via fake
binaries prepended to PATH. Asserts filesystem state after completion.

### Changes Required

#### 1. `mariadb-mcp/tests/pyproject.toml`

```toml
[project]
name = "mariadb-mcp-tests"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "pexpect>=4.9",
]

[tool.pytest.ini_options]
timeout = 120
asyncio_mode = "auto"
```

#### 2. `mariadb-mcp/tests/fixtures/mariadb-mcp-server/`

Minimal Python project that `uv sync` accepts:

```
fixtures/mariadb-mcp-server/
├── pyproject.toml     ← [project] name="mariadb-mcp" version="0.1.0"
└── src/
    └── mariadb_mcp/
        └── __init__.py   ← empty
```

#### 3. `mariadb-mcp/tests/conftest.py`

```python
import os, shutil, json, stat
from pathlib import Path
import pytest
import pexpect

PLUGIN_ROOT = Path(__file__).parent.parent
FIXTURE_SERVER = Path(__file__).parent / "fixtures" / "mariadb-mcp-server"


@pytest.fixture
def tmp_home(tmp_path):
    """Isolated HOME directory per test."""
    home = tmp_path / "home"
    home.mkdir()
    # Minimal ~/.claude.json with no mariadb entry
    (home / ".claude.json").write_text(json.dumps({"mcpServers": {}}))
    return home


@pytest.fixture
def tmp_home_with_install(tmp_home):
    """HOME with an existing mariadb MCP installation."""
    install_dir = tmp_home / ".claude" / "mcp-servers" / "mariadb"
    install_dir.mkdir(parents=True)
    shutil.copytree(FIXTURE_SERVER, install_dir, dirs_exist_ok=True)
    # Write a pre-existing .env
    (install_dir / ".env").write_text(
        "DB_HOST=oldhost\nDB_PORT=3306\nDB_USER=root\nDB_PASSWORD=oldpass\nMCP_READ_ONLY=true\n"
    )
    # Update .claude.json to include mariadb entry
    config = json.loads((tmp_home / ".claude.json").read_text())
    config["mcpServers"]["mariadb"] = {
        "command": "uv",
        "args": ["--directory", str(install_dir), "run", "mariadb-mcp"]
    }
    (tmp_home / ".claude.json").write_text(json.dumps(config))
    return tmp_home


@pytest.fixture
def fake_bin(tmp_path):
    """Fake git and uv binaries that simulate success without network."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    git = bin_dir / "git"
    git.write_text(f"""#!/bin/bash
if [[ "$1" == "clone" ]]; then
    cp -r "{FIXTURE_SERVER}/." "${{@: -1}}"
elif [[ "$1" == "pull" ]]; then
    echo "Already up to date."
fi
exit 0
""")
    git.chmod(git.stat().st_mode | stat.S_IEXEC)

    uv = bin_dir / "uv"
    uv.write_text("""#!/bin/bash
if [[ "$1" == "sync" ]]; then
    echo "Resolved"
elif [[ "$1" == "run" ]]; then
    # Simulate successful DB connection test
    echo "SUCCESS"
fi
exit 0
""")
    uv.chmod(uv.stat().st_mode | stat.S_IEXEC)

    return bin_dir


@pytest.fixture
def claude_session(tmp_home, fake_bin):
    """Spawn claude in interactive mode with isolated HOME and fake binaries."""
    env = os.environ.copy()
    env["HOME"] = str(tmp_home)
    env["PATH"] = str(fake_bin) + ":" + env.get("PATH", "")

    child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")
    child.logfile_read = open(tmp_home / "pexpect.log", "w")  # debug log
    yield child

    if child.isalive():
        child.sendline("/exit")
        child.expect(pexpect.EOF, timeout=10)
    child.logfile_read.close()
```

#### 4. `mariadb-mcp/tests/test_mariadb_setup.py`

```python
import json, time
from pathlib import Path
import pexpect
import pytest


INSTALL_DIR_RELATIVE = ".claude/mcp-servers/mariadb"
CLAUDE_JSON = ".claude.json"


def send_and_wait(child, text, next_expect_pattern, timeout=30):
    """Send a line and wait for Claude's next prompt."""
    child.sendline(text)
    child.expect(next_expect_pattern, timeout=timeout)


class TestFreshInstall:
    def test_fresh_install_writes_env_and_config(self, claude_session, tmp_home, fake_bin):
        child = claude_session
        # Wait for claude prompt
        child.expect(r"[>$]", timeout=30)

        # Invoke setup
        child.sendline("/mariadb-setup")

        # Claude should ask for host
        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")

        # Port
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")

        # User
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("testuser")

        # Password
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("testpass")

        # Read-only
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        # Wait for completion signal
        child.expect(r"[Rr]estart", timeout=60)

        # Assert .env written
        install_dir = tmp_home / INSTALL_DIR_RELATIVE
        env_file = install_dir / ".env"
        assert env_file.exists(), ".env file not written"
        env_content = env_file.read_text()
        assert "DB_HOST=localhost" in env_content
        assert "DB_USER=testuser" in env_content
        assert "DB_PASSWORD=testpass" in env_content

        # Assert ~/.claude.json updated
        config = json.loads((tmp_home / CLAUDE_JSON).read_text())
        assert "mariadb" in config.get("mcpServers", {}), "mariadb not in mcpServers"
        mcp_entry = config["mcpServers"]["mariadb"]
        assert "uv" in mcp_entry.get("command", "") or \
               any("uv" in str(a) for a in mcp_entry.get("args", []))


class TestExistingInstall:
    def test_update_preserves_credentials(self, tmp_home_with_install, fake_bin):
        env = {"HOME": str(tmp_home_with_install),
               "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", "")}
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("update")

        child.expect(r"[Rr]estart|[Uu]pdat", timeout=60)

        # Credentials unchanged
        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=oldhost" in env_content

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reconfigure_updates_env_only(self, tmp_home_with_install, fake_bin):
        env = {"HOME": str(tmp_home_with_install),
               "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", "")}
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reconfigure")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("newhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("newpass")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        child.expect(r"[Rr]estart|[Ss]aved", timeout=60)

        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=newhost" in env_content
        assert "DB_PASSWORD=newpass" in env_content

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reinstall_confirm_deletes_and_reinstalls(self, tmp_home_with_install, fake_bin):
        env = {"HOME": str(tmp_home_with_install),
               "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", "")}
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reinstall")

        # Claude should ask for confirmation mentioning the path
        child.expect(r"[Dd]elete|[Pp]ermanent|[Ss]ure", timeout=30)
        child.sendline("yes")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        child.expect(r"[Rr]estart", timeout=60)

        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        assert install_dir.exists(), "Install dir should be recreated"
        assert (install_dir / ".env").exists(), ".env should be written"

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reinstall_cancel_does_nothing(self, tmp_home_with_install, fake_bin):
        env = {"HOME": str(tmp_home_with_install),
               "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", "")}
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reinstall")

        child.expect(r"[Ss]ure|[Cc]onfirm|[Dd]elete", timeout=30)
        child.sendline("no")

        child.expect(r"[Cc]ancel|[Aa]bort|[Nn]othing", timeout=30)

        # Install dir unchanged
        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=oldhost" in env_content, "Credentials should be unchanged"

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)


class TestConnectionFailure:
    def test_connection_fail_reports_error(self, tmp_home, tmp_path):
        """When uv run returns failure, Claude should report error (config still written)."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        import stat as stat_mod
        git = bin_dir / "git"
        git.write_text(f"""#!/bin/bash
cp -r "{Path(__file__).parent / 'fixtures' / 'mariadb-mcp-server'}/." "${{@: -1}}"
exit 0
""")
        git.chmod(git.stat().st_mode | stat_mod.S_IEXEC)

        uv = bin_dir / "uv"
        uv.write_text("""#!/bin/bash
if [[ "$1" == "sync" ]]; then echo "Resolved"; exit 0; fi
# Simulate connection failure
echo "ERROR: Connection refused" >&2
exit 1
""")
        uv.chmod(uv.stat().st_mode | stat_mod.S_IEXEC)

        env = {"HOME": str(tmp_home),
               "PATH": str(bin_dir) + ":" + __import__("os").environ.get("PATH", "")}
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        # Claude should report connection failure
        child.expect(r"[Ff]ail|[Ee]rror|[Rr]econfigur", timeout=60)

        # Config should still be written
        install_dir = tmp_home / INSTALL_DIR_RELATIVE
        assert (install_dir / ".env").exists(), ".env should be written even on connection failure"
        config = json.loads((tmp_home / CLAUDE_JSON).read_text())
        assert "mariadb" in config.get("mcpServers", {})

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)
```

### Success Criteria

#### Automated Verification:
- [ ] `cd mariadb-mcp && uv run pytest tests/ -v` — all 6 tests pass (requires `claude` CLI in PATH and valid `ANTHROPIC_API_KEY`)
- [x] `cd mariadb-mcp && uv run pytest tests/ --collect-only` — 6 tests collected without import errors
- [x] pyproject.toml parses: `python3 -c "import tomllib; tomllib.loads(open('mariadb-mcp/tests/pyproject.toml').read())"`

#### Manual Verification:
- [ ] Pexpect log (written to `tmp_home/pexpect.log`) shows Claude's conversation
- [ ] Tests complete in under 2 minutes total

**Pause here for confirmation before finalizing.**

---

## Testing Strategy

### Unit-level (no API calls):
- `node scripts/setup.js` invoked directly with flags — verify JSON output shape and exit codes
- Can be scripted in bash: verify exit code 1 for missing --action, verify .env content

### Integration-level (pexpect, requires API key):
- 6 tests as described in Phase 4
- Run with `ANTHROPIC_API_KEY=... uv run pytest tests/ -v`

### Cost management:
- Each test invokes `claude` once — roughly 6 API calls total per test run
- Keep `--max-turns` low: the setup flow needs ~8–10 turns at most

## References

- Design document: `thoughts/shared/plans/mariadb-mcp/2026-02-18-setup-overhaul-design.md`
- Current setup.js: `mariadb-mcp/scripts/setup.js`
- Current command: `mariadb-mcp/commands/mariadb-setup.md`
- Current hook: `mariadb-mcp/hooks/session-start.js`
- pexpect docs: https://pexpect.readthedocs.io/en/stable/
- Claude Code headless docs: https://code.claude.com/docs/en/headless
