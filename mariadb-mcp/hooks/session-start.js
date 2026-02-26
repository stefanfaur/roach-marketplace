#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var net = require('net');

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
// Returns { data, error } — error is null for missing file, message string for bad JSON
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

async function main() {
  var claudeJsonPath = path.join(os.homedir(), '.claude.json');
  var claudeJson = readJSON(claudeJsonPath);
  var statusMessage = '';

  if (claudeJson.error) {
    statusMessage = '~/.claude.json contains invalid JSON — run `jsonlint ~/.claude.json` to diagnose. '
      + 'Details: ' + claudeJson.error;
  } else if (!claudeJson.data) {
    statusMessage = 'MariaDB MCP is not configured (~/.claude.json not found). '
      + 'To set up: run /mariadb-setup.';
  } else {
    // Look through mcpServers for keys containing 'mariadb' (case-insensitive)
    var mcpServers = claudeJson.data.mcpServers || {};
    var mariadbKeys = Object.keys(mcpServers).filter(function (key) {
      return key.toLowerCase().indexOf('mariadb') !== -1;
    });

    var mariadbKey = null;
    var mariadbConfig = null;

    if (mariadbKeys.length > 1) {
      // Prefer exact key 'mariadb'; otherwise take first match
      mariadbKey = mariadbKeys.indexOf('mariadb') !== -1 ? 'mariadb' : mariadbKeys[0];
      mariadbConfig = mcpServers[mariadbKey];
      statusMessage += '(Note: multiple mariadb MCP entries found; using "' + mariadbKey + '") ';
    } else if (mariadbKeys.length === 1) {
      mariadbKey = mariadbKeys[0];
      mariadbConfig = mcpServers[mariadbKey];
    }

    if (!mariadbKey) {
      statusMessage = 'MariaDB MCP server is not configured. '
        + 'To set up: install from https://github.com/MariaDB/mcp and add a "mariadb" entry to mcpServers in ~/.claude.json.';
    } else if (mariadbConfig.url) {
      // SSE/HTTP transport — use WHATWG URL API to extract port correctly
      var urlPort = null;
      try {
        urlPort = new URL(mariadbConfig.url).port;
      } catch (_) {}
      var port = urlPort ? parseInt(urlPort, 10) : null;

      if (port) {
        var reachable = await checkPort('localhost', port, 1000);
        if (reachable) {
          statusMessage += 'MariaDB MCP server "' + mariadbKey + '" is available (port ' + port + ' reachable). '
            + 'MCP tools (list_databases, list_tables, get_table_schema, execute_sql, etc.) are ready to use.';
        } else {
          statusMessage += 'MariaDB MCP server "' + mariadbKey + '" is configured but NOT reachable (port ' + port + '). '
            + 'Start the MCP server before using database tools.';
        }
      } else {
        statusMessage += 'MariaDB MCP server "' + mariadbKey + '" is configured with URL: ' + mariadbConfig.url + '. '
          + 'Could not determine port for reachability check.';
      }
    } else if (mariadbConfig.command) {
      // stdio transport — just report as configured
      statusMessage += 'MariaDB MCP server "' + mariadbKey + '" is configured via stdio (command: ' + mariadbConfig.command + '). '
        + 'MCP tools (list_databases, list_tables, get_table_schema, execute_sql, etc.) should be available.';
    } else {
      statusMessage += 'MariaDB MCP server "' + mariadbKey + '" is configured but has no url or command. Check your ~/.claude.json configuration.';
    }
  }

  var output = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: '--- MariaDB MCP ---\n' + statusMessage + '\n---'
    }
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(function (err) {
  process.stderr.write('mariadb-mcp session-start.js error: ' + err.message + '\n');
  process.exit(1);
});
