#!/usr/bin/env node
'use strict';

// Context Monitor - PostToolUse hook
// Reads context_window metrics from stdin (provided by Claude Code on every
// PostToolUse event) and injects advisory messages when context is running low.
//
// Thresholds:
//   WARNING  (remaining <= 35%): Suggest creating a handoff soon
//   CRITICAL (remaining <= 25%): Urge immediate handoff creation
//
// Debounce: 5 tool uses between warnings (severity escalation bypasses debounce)

var fs = require('fs');
var os = require('os');
var path = require('path');

var WARNING_THRESHOLD = 35;
var CRITICAL_THRESHOLD = 25;
var DEBOUNCE_CALLS = 5;

var input = '';
var stdinTimeout = setTimeout(function () { process.exit(0); }, 3000);

process.stdin.setEncoding('utf8');
process.stdin.on('data', function (chunk) { input += chunk; });
process.stdin.on('end', function () {
  clearTimeout(stdinTimeout);
  try {
    var data = JSON.parse(input);
    var sessionId = data.session_id;
    var remaining = data.context_window && data.context_window.remaining_percentage;

    if (!sessionId || remaining == null || remaining > WARNING_THRESHOLD) {
      process.exit(0);
    }

    // Debounce: track warnings per session
    var tmpDir = os.tmpdir();
    var warnPath = path.join(tmpDir, 'roach-ctx-' + sessionId + '-warned.json');
    var warnData = { callsSinceWarn: 0, lastLevel: null };

    var firstWarn = true;
    if (fs.existsSync(warnPath)) {
      try {
        warnData = JSON.parse(fs.readFileSync(warnPath, 'utf8'));
        firstWarn = false;
      } catch (_) {
        // Corrupted file, reset
      }
    }

    warnData.callsSinceWarn = (warnData.callsSinceWarn || 0) + 1;

    var isCritical = remaining <= CRITICAL_THRESHOLD;
    var currentLevel = isCritical ? 'critical' : 'warning';

    // Emit on first warning, then debounce; severity escalation bypasses debounce
    var severityEscalated = currentLevel === 'critical' && warnData.lastLevel === 'warning';
    if (!firstWarn && warnData.callsSinceWarn < DEBOUNCE_CALLS && !severityEscalated) {
      fs.writeFileSync(warnPath, JSON.stringify(warnData));
      process.exit(0);
    }

    // Reset debounce counter
    warnData.callsSinceWarn = 0;
    warnData.lastLevel = currentLevel;
    fs.writeFileSync(warnPath, JSON.stringify(warnData));

    // Build advisory message
    var usedPct = Math.max(0, Math.min(100, Math.round(100 - remaining)));
    var message;

    if (isCritical) {
      message = 'CONTEXT CRITICAL: Usage at ' + usedPct + '%. Remaining: ' + remaining + '%. '
        + 'Context is nearly exhausted. Inform the user that context is low and suggest '
        + 'creating a handoff (invoke create-handoff skill) before auto-compaction loses context. '
        + 'Do NOT autonomously write handoff files unless the user agrees.';
    } else {
      message = 'CONTEXT WARNING: Usage at ' + usedPct + '%. Remaining: ' + remaining + '%. '
        + 'Context is getting limited. Avoid starting new complex work. Consider suggesting '
        + 'a handoff (create-handoff skill) if there is significant in-progress state to preserve.';
    }

    var output = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: message
      }
    };

    process.stdout.write(JSON.stringify(output));
  } catch (_) {
    // Silent fail — never block tool execution
    process.exit(0);
  }
});
