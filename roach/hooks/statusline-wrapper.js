#!/usr/bin/env node
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');
var child_process = require('child_process');

// Read full stdin from Claude Code
var input = fs.readFileSync(0, 'utf-8');

// Extract context data
var data;
try {
  data = JSON.parse(input);
} catch (_) {
  data = {};
}

var sessionId = (data.session_id || 'unknown');
var pct = data.context_window ? data.context_window.used_percentage : -1;
var size = data.context_window ? data.context_window.context_window_size : 200000;

// Write state file if we have valid data (for context-monitor.js to read)
if (pct !== -1 && pct !== null && pct !== undefined) {
  var pctInt = Math.round(Number(pct));
  var stateFile = path.join(os.tmpdir(), 'roach-context-' + sessionId + '.json');
  try {
    fs.writeFileSync(stateFile, JSON.stringify({
      pct: pctInt,
      size: size,
      ts: Math.floor(Date.now() / 1000)
    }));
  } catch (_) { /* ignore write errors */ }
}

// --- Find and run claude-hud ---

// Helper: check if command exists
function commandExists(cmd) {
  try {
    child_process.execSync(
      process.platform === 'win32' ? 'where ' + cmd : 'command -v ' + cmd,
      { stdio: 'pipe' }
    );
    return true;
  } catch (_) {
    return false;
  }
}

// Find newest claude-hud version directory in plugin cache
var cacheBase = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'claude-hud', 'claude-hud');

function findNewestVersionDir(base) {
  if (!fs.existsSync(base)) return null;
  try {
    var entries = fs.readdirSync(base, { withFileTypes: true })
      .filter(function (e) { return e.isDirectory(); })
      .map(function (e) {
        var full = path.join(base, e.name);
        return { path: full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort(function (a, b) { return b.mtime - a.mtime; });
    return entries.length > 0 ? entries[0].path : null;
  } catch (_) {
    return null;
  }
}

var hudDir = findNewestVersionDir(cacheBase);

if (hudDir) {
  var tsEntry = path.join(hudDir, 'src', 'index.ts');
  var jsEntry = path.join(hudDir, 'dist', 'index.js');

  var runtime = null;
  var entry = null;

  // Prefer compiled JS (works with plain node, no TS runtime needed)
  if (fs.existsSync(jsEntry)) {
    runtime = 'node';
    entry = jsEntry;
  }
  // Fall back to TypeScript entry with bun (native TS support)
  if (!runtime && fs.existsSync(tsEntry) && commandExists('bun')) {
    runtime = 'bun';
    entry = tsEntry;
  }
  // Fall back to TypeScript entry with npx tsx (npm ecosystem TS runner)
  if (!runtime && fs.existsSync(tsEntry) && commandExists('npx')) {
    runtime = 'npx tsx';
    entry = tsEntry;
  }

  if (runtime && entry) {
    try {
      child_process.execSync(runtime + ' "' + entry + '"', {
        input: input,
        stdio: ['pipe', process.stdout, process.stderr],
        timeout: 5000
      });
    } catch (_) {
      // claude-hud execution failed — skip silently
    }
  }
}
