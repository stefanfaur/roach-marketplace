#!/usr/bin/env node
'use strict';

var child_process = require('child_process');
var path = require('path');
var fs = require('fs');
var os = require('os');

var HOOKS_DIR = __dirname;
var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS: ' + name);
  } catch (err) {
    failed++;
    console.log('  FAIL: ' + name);
    console.log('        ' + err.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// --- session-start.js ---
console.log('\nsession-start.js');

var sessionStartOut;
try {
  sessionStartOut = child_process.execSync(
    'node ' + JSON.stringify(path.join(HOOKS_DIR, 'session-start.js')),
    { encoding: 'utf-8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'] }
  );
} catch (err) {
  sessionStartOut = null;
  console.log('  FAIL: script exited with code ' + (err.status || 'unknown'));
  if (err.stderr) console.log('        stderr: ' + err.stderr.trim().split('\n')[0]);
  failed++;
}

if (sessionStartOut !== null) {
  test('outputs valid JSON', function () {
    JSON.parse(sessionStartOut);
  });

  test('has hookSpecificOutput.additionalContext', function () {
    var obj = JSON.parse(sessionStartOut);
    assert(obj.hookSpecificOutput, 'missing hookSpecificOutput');
    assert(typeof obj.hookSpecificOutput.additionalContext === 'string', 'additionalContext is not a string');
  });

  test('additionalContext contains using-roach skill content', function () {
    var obj = JSON.parse(sessionStartOut);
    var ctx = obj.hookSpecificOutput.additionalContext;
    assert(ctx.indexOf('roach') !== -1, 'skill content not injected');
  });

  test('hookEventName is SessionStart', function () {
    var obj = JSON.parse(sessionStartOut);
    assert(obj.hookSpecificOutput.hookEventName === 'SessionStart', 'wrong hookEventName');
  });
}

// --- context-monitor.js ---
console.log('\ncontext-monitor.js');

test('exits 0 with stop_hook_active=true (no-op)', function () {
  child_process.execSync(
    'node ' + JSON.stringify(path.join(HOOKS_DIR, 'context-monitor.js')),
    { input: '{"stop_hook_active":true,"session_id":"test-smoke"}', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
});

test('exits 0 with no state file (fresh session)', function () {
  child_process.execSync(
    'node ' + JSON.stringify(path.join(HOOKS_DIR, 'context-monitor.js')),
    { input: '{"stop_hook_active":false,"session_id":"test-no-state-' + Date.now() + '"}', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
});

test('outputs block decision when context >= 80%', function () {
  var sessionId = 'test-threshold-' + Date.now();
  // Write a fake state file at 85%
  var stateFile = path.join(os.tmpdir(), 'roach-context-' + sessionId + '.json');
  fs.writeFileSync(stateFile, JSON.stringify({ pct: 85, size: 200000, ts: Math.floor(Date.now() / 1000) }));

  try {
    var out = child_process.execSync(
      'node ' + JSON.stringify(path.join(HOOKS_DIR, 'context-monitor.js')),
      { input: '{"stop_hook_active":false,"session_id":"' + sessionId + '"}', encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    var obj = JSON.parse(out);
    assert(obj.decision === 'block', 'expected decision=block, got ' + obj.decision);
  } finally {
    // Cleanup
    try { fs.unlinkSync(stateFile); } catch (_) {}
    try { fs.unlinkSync(path.join(os.tmpdir(), 'roach-asked-80-' + sessionId)); } catch (_) {}
  }
});

// --- statusline-wrapper.js ---
console.log('\nstatusline-wrapper.js');

test('writes state file from context data', function () {
  var sessionId = 'test-statusline-' + Date.now();
  var input = JSON.stringify({ session_id: sessionId, context_window: { used_percentage: 42, context_window_size: 200000 } });
  var stateFile = path.join(os.tmpdir(), 'roach-context-' + sessionId + '.json');

  try {
    child_process.execSync(
      'node ' + JSON.stringify(path.join(HOOKS_DIR, 'statusline-wrapper.js')),
      { input: input, encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (_) {
    // claude-hud not installed is fine — we only care about the state file
  }

  assert(fs.existsSync(stateFile), 'state file not created at ' + stateFile);
  var state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
  assert(state.pct === 42, 'expected pct=42, got ' + state.pct);
  assert(state.size === 200000, 'expected size=200000, got ' + state.size);
  assert(typeof state.ts === 'number', 'ts is not a number');

  // Cleanup
  try { fs.unlinkSync(stateFile); } catch (_) {}
});

// --- Summary ---
console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
