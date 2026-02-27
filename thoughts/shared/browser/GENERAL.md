# Browser Automation Guidelines

## Purpose
- Capture evergreen notes for browser automation steps executed via agent-browser or related tooling.
- Keep this document concise so it can be referenced from any project using shared browser state.

## Authentication
- Login URL: `https://<your-app>/login` (replace placeholder with actual endpoint).
- Required form fields/IDs: `username`, `password`, and any additional controls (e.g., `otpCode`, `rememberMe`).
- Use standard selectors (IDs, names) and avoid embedding credentials in this file.

## Credential Source
- Credentials should come from secure sources such as `AGENT_BROWSER_USERNAME` / `AGENT_BROWSER_PASSWORD` environment variables or a vault reference; do not store secrets here.

## Session Reuse
- Persist cookies or session state to files like `~/.agent-browser/session-state.json` if supported.
- Reload from those files before running automation to skip repeated logins, but always verify the login state is current.

## Shared Setup
- Default user agent: `agent-browser/1.0` (override if needed for compatibility).
- Default viewport: `1280x720` unless the target UI requires a different size.
- Base URL: `https://<your-app>` (update per environment) to scope navigation steps consistently.

## Safety
- Do not automate navigation to sensitive/blocked domains; list any disallowed hosts here once known.
- Never log PII (usernames, emails, tokens) in automation outputs. Use placeholders or refer to environment variables instead.
