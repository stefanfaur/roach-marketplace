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
function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (_) {
    return null;
  }
}

async function main() {
  var claudeJsonPath = path.join(os.homedir(), '.claude.json');
  var claudeJson = readJSON(claudeJsonPath);
  var statusMessage = '';

  if (!claudeJson) {
    statusMessage = 'MariaDB MCP is not configured (~/.claude.json not found or unreadable). '
      + 'To set up: install the MariaDB MCP server from https://github.com/MariaDB/mcp and add it to your MCP configuration.';
  } else {
    // Look through mcpServers for keys containing 'mariadb' (case-insensitive)
    var mcpServers = claudeJson.mcpServers || {};
    var mariadbKey = null;
    var mariadbConfig = null;

    Object.keys(mcpServers).forEach(function (key) {
      if (key.toLowerCase().indexOf('mariadb') !== -1) {
        mariadbKey = key;
        mariadbConfig = mcpServers[key];
      }
    });

    if (!mariadbKey) {
      statusMessage = 'MariaDB MCP server is not configured. '
        + 'To set up: install from https://github.com/MariaDB/mcp and add a "mariadb" entry to mcpServers in ~/.claude.json.';
    } else if (mariadbConfig.url) {
      // SSE/HTTP transport — check port reachability
      var portMatch = mariadbConfig.url.match(/:(\d+)/);
      var port = portMatch ? parseInt(portMatch[1], 10) : null;

      if (port) {
        var reachable = await checkPort('localhost', port, 1000);
        if (reachable) {
          statusMessage = 'MariaDB MCP server "' + mariadbKey + '" is available (port ' + port + ' reachable). '
            + 'MCP tools (list_databases, list_tables, get_table_schema, execute_sql, etc.) are ready to use.';
        } else {
          statusMessage = 'MariaDB MCP server "' + mariadbKey + '" is configured but NOT reachable (port ' + port + '). '
            + 'Start the MCP server before using database tools.';
        }
      } else {
        statusMessage = 'MariaDB MCP server "' + mariadbKey + '" is configured with URL: ' + mariadbConfig.url + '. '
          + 'Could not determine port for reachability check.';
      }
    } else if (mariadbConfig.command) {
      // stdio transport — just report as configured
      statusMessage = 'MariaDB MCP server "' + mariadbKey + '" is configured via stdio (command: ' + mariadbConfig.command + '). '
        + 'MCP tools (list_databases, list_tables, get_table_schema, execute_sql, etc.) should be available.';
    } else {
      statusMessage = 'MariaDB MCP server "' + mariadbKey + '" is configured but has no url or command. Check your ~/.claude.json configuration.';
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
