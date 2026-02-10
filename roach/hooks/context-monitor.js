#!/usr/bin/env node
'use strict';

var fs = require('fs');
var os = require('os');
var path = require('path');

// Read stdin (Stop hook JSON)
var input = fs.readFileSync(0, 'utf-8');
var data;
try {
  data = JSON.parse(input);
} catch (_) {
  process.exit(0);
}

var stopActive = data.stop_hook_active || false;
var sessionId = data.session_id || 'unknown';

// Don't re-trigger if already continuing from a stop hook
if (stopActive === true || stopActive === 'true') {
  process.exit(0);
}

// State file written by statusline wrapper (cross-platform temp dir)
var stateFile = path.join(os.tmpdir(), 'roach-context-' + sessionId + '.json');

// Exit if no state file yet
if (!fs.existsSync(stateFile)) {
  process.exit(0);
}

// Read state file
var state;
try {
  state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
} catch (_) {
  process.exit(0);
}

var pct = state.pct || 0;
var size = state.size || 200000;
var stateTs = state.ts || 0;

// Skip if state file is stale (>5 minutes old)
var now = Math.floor(Date.now() / 1000);
if (now - stateTs > 300) {
  process.exit(0);
}

// Flag file paths (cross-platform temp dir)
var flag80 = path.join(os.tmpdir(), 'roach-asked-80-' + sessionId);
var flag90 = path.join(os.tmpdir(), 'roach-asked-90-' + sessionId);

// Determine current threshold
var threshold = 80;
if (fs.existsSync(flag90)) {
  // Already escalated to 90%, don't ask again
  process.exit(0);
} else if (fs.existsSync(flag80)) {
  // Already asked at 80%, escalate to 90%
  threshold = 90;
}

// Check against threshold
if (pct >= threshold) {
  // Write flag file
  fs.writeFileSync(path.join(os.tmpdir(), 'roach-asked-' + threshold + '-' + sessionId), String(pct));

  // Construct message based on severity
  var urgency;
  if (threshold === 90) {
    urgency = 'URGENT: Context window is at ' + pct + '% (window size: ' + size + ' tokens). Quality will degrade soon.';
  } else {
    urgency = 'Context window is at ' + pct + '% (window size: ' + size + ' tokens).';
  }

  // Output JSON to make Claude continue and ask the user
  var output = {
    decision: 'block',
    reason: urgency + " You MUST now use AskUserQuestion to ask the user: '" + urgency + " Would you like me to create a handoff document and start a fresh session?' with options: 'Yes, create handoff' (description: 'I will run /create_handoff to preserve context, then you can /clear and /resume_handoff in a new session') and 'No, continue working' (description: 'Continue in this session without creating a handoff'). If the user chooses yes, immediately invoke the create_handoff command/skill."
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} else {
  process.exit(0);
}
