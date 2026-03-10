#!/usr/bin/env node
'use strict';

var fs = require('fs');

// Usage: finalize-replay.js <replay.json> --url <start-url> [--auth <state-file>] [--param NAME] [--verify url_contains <value>]
var args = process.argv.slice(2);
if (args.length < 3) {
  console.error('Usage: finalize-replay.js <replay.json> --url <start-url> [--auth <state-file>] [--param NAME ...] [--verify url_contains <value>]');
  process.exit(1);
}

var replayPath = args[0];
if (!fs.existsSync(replayPath)) {
  console.error('NOT_FOUND: ' + replayPath);
  process.exit(1);
}

var replay;
try {
  replay = JSON.parse(fs.readFileSync(replayPath, 'utf-8'));
} catch (err) {
  console.error('PARSE_ERROR: ' + err.message);
  process.exit(1);
}

// Parse flags
for (var i = 1; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    replay.start_url = args[++i];
  } else if (args[i] === '--auth' && args[i + 1]) {
    replay.auth_state = args[++i];
  } else if (args[i] === '--param' && args[i + 1]) {
    if (!replay.params) replay.params = [];
    replay.params.push(args[++i]);
  } else if (args[i] === '--verify' && args[i + 1] && args[i + 2]) {
    var check = args[++i];
    var value = args[++i];
    if (!replay.steps) replay.steps = [];
    replay.steps.push({ action: 'verify', check: check, value: value });
  } else if (args[i] === '--workflow' && args[i + 1]) {
    replay.source_workflow = args[++i];
  }
}

replay.finalized = new Date().toISOString();

fs.writeFileSync(replayPath, JSON.stringify(replay, null, 2), 'utf-8');
console.log('FINALIZED: ' + replayPath);
console.log('STEPS: ' + (replay.steps || []).length);
console.log('PARAMS: ' + (replay.params || []).join(', ') || 'none');
console.log('START_URL: ' + (replay.start_url || 'none'));
console.log('AUTH_STATE: ' + (replay.auth_state || 'none'));
