---
name: mariadb-setup
description: Install and configure the MariaDB MCP server
model: sonnet
---

# MariaDB MCP Server Setup

This command automates installation and configuration of the MariaDB MCP server.

## What it does

- Checks prerequisites (Python 3.11+, uv, git)
- Detects existing installations at ~/.claude/mcp-servers/mariadb/
- Clones or updates the MariaDB MCP repository
- Prompts for database connection details interactively
- Generates .env configuration file
- Updates ~/.claude.json with MCP server configuration
- Tests the database connection
- Displays next steps

## Usage

Run this command to install, update, or reconfigure the MariaDB MCP server.

If an existing installation is detected, you'll be offered options to:
- (U) Update code from GitHub
- (R) Reconfigure connection details
- (B) Both update and reconfigure
- (Re) Reinstall from scratch
- (C) Cancel

## Implementation

The command executes: `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.js`
