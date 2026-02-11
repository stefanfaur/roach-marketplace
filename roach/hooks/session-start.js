#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var net = require('net');
var child_process = require('child_process');

var PLUGIN_ROOT = path.resolve(__dirname, '..');

// --- Helper: check if a command exists on PATH ---
function commandExists(cmd) {
  try {
    var check = process.platform === 'win32' ? 'where ' + cmd : 'command -v ' + cmd;
    child_process.execSync(check, { stdio: 'pipe' });
    return true;
  } catch (_) {
    return false;
  }
}

// --- Helper: check if a TCP port is reachable ---
function checkPort(host, port, timeoutMs) {
  timeoutMs = timeoutMs || 1000;
  return new Promise(function (resolve) {
    var socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', function () { socket.destroy(); resolve(true); });
    socket.on('timeout', function () { socket.destroy(); resolve(false); });
    socket.on('error', function () { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

// --- Helper: safely read and parse JSON file ---
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

// --- Helper: safe execSync ---
function run(cmd, fallback) {
  fallback = fallback || '';
  try {
    return child_process.execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return fallback;
  }
}

async function main() {
  var missing = [];
  var settingsFile = path.join(os.homedir(), '.claude', 'settings.json');

  // --- Companion dependency checks ---

  // Check ripgrep
  if (!commandExists('rg')) {
    missing.push("CLI tool 'ripgrep' (rg) is not installed. Install via: brew install ripgrep (macOS), apt install ripgrep (Linux), or winget install BurntSushi.ripgrep.MSVC (Windows).");
  }

  // Check frontend-design plugin via settings.json
  var settings = readJSON(settingsFile);
  if (settings) {
    var found = false;
    try {
      var settingsRaw = fs.readFileSync(settingsFile, 'utf-8');
      if (/"frontend-design@[^"]*"\s*:\s*true/.test(settingsRaw)) {
        found = true;
      }
    } catch (_) { /* ignore */ }
    if (!found) {
      missing.push("Plugin 'frontend-design' is not enabled. Install it from the claude-code-plugins marketplace.");
    }
  } else {
    missing.push("Plugin 'frontend-design' is not enabled (settings.json not found).");
  }

  // Check agent-browser
  if (!commandExists('agent-browser')) {
    missing.push("CLI tool 'agent-browser' is not installed. Install via: npm install -g agent-browser.");
  }

  // Check claude-hud plugin (needed for statusline + context monitoring)
  var hudCacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'claude-hud');
  if (!fs.existsSync(hudCacheDir)) {
    missing.push("Plugin 'claude-hud' is not installed. Required for statusline display and context window monitoring. See: https://github.com/anthropics/claude-hud");
  }

  // --- WebSearch / WebFetch permission check ---
  var webPermissionsWarning = '';
  var projectDir = run('git rev-parse --show-toplevel', process.cwd());

  var settingsFiles = [
    path.join(projectDir, '.claude', 'settings.local.json'),
    path.join(projectDir, '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude', 'settings.json')
  ];

  var hasWebsearch = false;
  var hasWebfetch = false;

  settingsFiles.forEach(function (sf) {
    var data = readJSON(sf);
    if (!data || !data.permissions || !Array.isArray(data.permissions.allow)) return;
    data.permissions.allow.forEach(function (perm) {
      if (perm === 'WebSearch') hasWebsearch = true;
      if (perm === 'WebFetch') hasWebfetch = true;
    });
  });

  var missingWeb = [];
  if (!hasWebsearch) missingWeb.push('WebSearch');
  if (!hasWebfetch) missingWeb.push('WebFetch');

  if (missingWeb.length > 0) {
    var missingList = missingWeb.join(', ');
    var targetFile = path.join(projectDir, '.claude', 'settings.local.json');
    webPermissionsWarning = '\n\n--- ACTION REQUIRED: Web Permissions ---\n'
      + 'The following tools are NOT blanket-allowed in this project: ' + missingList + '.\n'
      + 'Without blanket permissions, the web-search-researcher agent will prompt for approval on every new domain.\n\n'
      + 'YOU MUST DO THIS IMMEDIATELY: Before responding to the user\'s first message, warn them that ' + missingList + ' permissions are missing and ask if they\'d like you to add blanket permissions to ' + targetFile + '. Use AskUserQuestion with options "Yes, add permissions" and "No, skip". If they agree, read the file first, then add ' + missingList + ' to the permissions.allow array (create the file if needed). This takes priority over all other tasks.\n---';
  }

  // --- JetBrains MCP detection ---
  var jetbrainsContext = '';
  var claudeJsonPath = path.join(os.homedir(), '.claude.json');
  var claudeJson = readJSON(claudeJsonPath);

  if (claudeJson) {
    var jbUrl = (claudeJson.mcpServers && claudeJson.mcpServers.jetbrains && claudeJson.mcpServers.jetbrains.url) || '';

    if (jbUrl) {
      // Parse port from URL like http://localhost:64342/sse
      var portMatch = jbUrl.match(/:(\d+)/);
      var jbPort = portMatch ? parseInt(portMatch[1], 10) : null;

      if (jbPort) {
        var reachable = await checkPort('localhost', jbPort, 1000);
        if (reachable) {
          jetbrainsContext = '\n\n--- JetBrains MCP ---\n'
            + 'JetBrains IDE detected on port ' + jbPort + '. The JetBrains MCP server is available this session. Use mcp__jetbrains__* tools when they can help (code analysis, refactoring, inspections, run configurations, project structure).\n---';
        } else {
          jetbrainsContext = '\n\n--- JetBrains MCP ---\n'
            + 'JetBrains MCP is configured but the IDE is NOT running (port ' + jbPort + ' unreachable). Do NOT attempt to use mcp__jetbrains__* tools this session - they will fail. Use Ripgrep, Glob, Read, and other built-in tools instead.\n---';
        }
      }
    } else {
      jetbrainsContext = '\n\n--- JetBrains MCP ---\n'
        + 'JetBrains MCP is not configured. To enable: open your JetBrains IDE, go to Settings > Tools > MCP Server, enable it, and auto-configure for Claude Code. Do NOT attempt to use mcp__jetbrains__* tools this session.\n---';
    }
  } else {
    if (!fs.existsSync(claudeJsonPath)) {
      jetbrainsContext = '\n\n--- JetBrains MCP ---\n'
        + 'JetBrains MCP is not configured (~/.claude.json not found). Do NOT attempt to use mcp__jetbrains__* tools this session.\n---';
    } else {
      jetbrainsContext = '\n\n--- JetBrains MCP ---\n'
        + 'JetBrains MCP configuration could not be read (~/.claude.json parse error). Do NOT attempt to use mcp__jetbrains__* tools this session.\n---';
    }
  }

  // --- Build companion warning ---
  var companionWarning = '';
  if (missing.length > 0) {
    companionWarning = '\n\n--- roach companion check ---\nThe following recommended companions are missing:';
    missing.forEach(function (msg) {
      companionWarning += '\n- ' + msg;
    });
    companionWarning += '\n---';
  }

  // --- Read skill content ---
  var usingForgeContent;
  try {
    usingForgeContent = fs.readFileSync(path.join(PLUGIN_ROOT, 'skills', 'using-roach', 'SKILL.md'), 'utf-8');
  } catch (err) {
    usingForgeContent = 'Error reading using-roach skill: ' + err.message;
  }

  // --- JSON escape using JSON.stringify (handles all special chars) ---
  var usingForgeEscaped = JSON.stringify(usingForgeContent).slice(1, -1);

  // --- Output context injection as JSON ---
  var output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '<EXTREMELY_IMPORTANT>\nYou have roach.\n\n'
        + '**Below is the full content of your \'using-roach\' skill - your introduction to using skills and commands. For all other skills, use the \'Skill\' tool:**\n\n'
        + usingForgeEscaped
        + companionWarning
        + jetbrainsContext
        + webPermissionsWarning
        + '\n</EXTREMELY_IMPORTANT>'
    }
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(function (err) {
  process.stderr.write('session-start.js error: ' + err.message + '\n');
  process.exit(1);
});
