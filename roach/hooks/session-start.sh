#!/usr/bin/env bash
# SessionStart hook for roach (Claude Code only).
# Injects the using-roach skill as session context. Cat-only: no subprocess
# spawns, no network, no settings scans. Scope is controlled by the hooks.json
# matcher (startup|clear|compact), NOT inside this script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

using_roach_content=$(cat "${PLUGIN_ROOT}/skills/using-roach/SKILL.md" 2>/dev/null || echo "Error reading using-roach skill")

# JSON-escape via bash parameter substitution (each pass is one C-level op).
escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

using_roach_escaped=$(escape_for_json "$using_roach_content")
session_context="<EXTREMELY_IMPORTANT>\nYou have roach.\n\n**Below is the full content of your 'using-roach' skill — your introduction to using skills and commands. For all other skills, use the 'Skill' tool:**\n\n${using_roach_escaped}\n</EXTREMELY_IMPORTANT>"

# printf (not heredoc) to avoid the bash 5.3+ heredoc hang.
printf '{\n  "hookSpecificOutput": {\n    "hookEventName": "SessionStart",\n    "additionalContext": "%s"\n  }\n}\n' "$session_context"

exit 0
