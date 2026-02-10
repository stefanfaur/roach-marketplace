#!/usr/bin/env node
'use strict';

var child_process = require('child_process');

// Integration test: does Claude Code invoke the session-start hook,
// and does the hook correctly report companion/permission status?
//
// Sends a single prompt via `claude -p` that asks the model to report
// on multiple pieces of injected context. One API call covers all checks.
//
// Requires:
//   - `claude` CLI installed and authenticated
//   - roach plugin enabled

console.log('Integration test: session-start hook in Claude Code\n');

var passed = 0;
var failed = 0;

// Preflight: check claude CLI exists
try {
  child_process.execSync(
    process.platform === 'win32' ? 'where claude' : 'command -v claude',
    { stdio: 'pipe' }
  );
} catch (_) {
  console.log('  SKIP: `claude` CLI not found on PATH');
  console.log('        Install Claude Code to run this test');
  process.exit(0);
}

// Single prompt that probes for all injected context at once.
// The hook injects: skill content, companion warnings, web permissions notice,
// and JetBrains MCP status — all inside additionalContext.
var probe = [
  'Examine your full system context carefully. Answer each question with EXACTLY "YES" or "NO", one per line, in this order:',
  '1. Does your context contain the text "You have roach"?',
  '2. Does your context contain a "Web Permissions Notice" section that mentions "WebSearch" or "WebFetch" not being blanket-allowed?',
  '3. Does your context contain a "JetBrains MCP" section?',
  '4. Does your context contain a "companion check" section?',
  'Reply with exactly 4 lines, each being YES or NO. Nothing else.'
].join(' ');

var output;
try {
  output = child_process.execSync(
    'claude -p ' + JSON.stringify(probe) + ' --max-turns 1',
    { encoding: 'utf-8', timeout: 60000, stdio: ['pipe', 'pipe', 'pipe'] }
  ).trim();
} catch (err) {
  console.log('  FAIL: could not run `claude` CLI');
  console.log('        ' + (err.message || String(err)).split('\n')[0]);
  if (err.stderr) console.log('        stderr: ' + err.stderr.trim().split('\n')[0]);
  process.exit(1);
}

// Parse the 4 YES/NO lines
var lines = output.split('\n').map(function (l) { return l.trim().toUpperCase(); });

// Find lines that are YES or NO (skip any preamble the model might add)
var answers = lines.filter(function (l) { return l === 'YES' || l === 'NO'; });

if (answers.length < 4) {
  console.log('  INCONCLUSIVE: expected 4 YES/NO answers, got ' + answers.length);
  console.log('  Raw response:\n    ' + output.replace(/\n/g, '\n    '));
  console.log('');
  console.log('  Try running again. If this persists, run manually:');
  console.log('    claude -p "Do you have roach?" --max-turns 1');
  process.exit(1);
}

var checks = [
  { name: 'hook injected roach context', answer: answers[0], required: true },
  { name: 'hook reports WebSearch/WebFetch permission status', answer: answers[1], required: false },
  { name: 'hook reports JetBrains MCP status', answer: answers[2], required: false },
  { name: 'hook reports companion check results', answer: answers[3], required: false }
];

// Check 1 (roach context) is the gate — if this fails, the hook didn't run at all.
if (checks[0].answer !== 'YES') {
  console.log('  FAIL: session-start hook did NOT inject context');
  console.log('');
  console.log('  Claude Code started but "You have roach" was not found.');
  console.log('  Likely causes:');
  console.log('  1. hooks.json command path is wrong or script has a runtime error');
  console.log('  2. Plugin is installed but not enabled — check: /plugin list');
  console.log('  3. Hook script fails silently — run: node hooks/test-hooks.js');
  process.exit(1);
}

passed++;
console.log('  PASS: ' + checks[0].name);

// Checks 2-4: the hook ran, now verify it produced the expected sections.
// These are YES when the relevant condition is detected (e.g. permissions missing,
// JetBrains configured/not configured, companions missing/present).
// Both YES and NO are valid — what matters is the hook produced *something*.
// We mark them as INFO when NO (the section might be absent because
// permissions are already granted, JetBrains not configured, etc.)
for (var i = 1; i < checks.length; i++) {
  if (checks[i].answer === 'YES') {
    passed++;
    console.log('  PASS: ' + checks[i].name);
  } else {
    console.log('  INFO: ' + checks[i].name + ' — not present (may be expected if already configured)');
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
console.log('\nNote: INFO items are not failures. The web permissions notice only');
console.log('appears when WebSearch/WebFetch lack blanket allow permissions.');
console.log('The companion check only appears when tools are missing.');
process.exit(failed > 0 ? 1 : 0);
