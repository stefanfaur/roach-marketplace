---
name: mariadb-setup
description: Install and configure the MariaDB MCP server
model: sonnet
---

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
printf '%s' 'PLACEHOLDER_PASSWORD' > "$PASS_FILE"
chmod 600 "$PASS_FILE"
echo "$PASS_FILE"
```

Replace `PLACEHOLDER_PASSWORD` with the actual password the user provided (or empty string if blank).

Store the `PASS_FILE` path for the next step.

## Step 5: Run setup.js

Run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.js \
  --action ACTION \
  --host HOST \
  --port PORT \
  --user USER \
  --pass-file PASS_FILE_PATH \
  --read-only READONLY_VALUE \
  2>&1
```

Substitute the actual collected values. Omit `--host/--port/--user/--pass-file/--read-only` for `--action update` (no credential changes needed).

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
