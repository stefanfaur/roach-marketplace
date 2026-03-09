#!/usr/bin/env node
'use strict';

var child_process = require('child_process');
var path = require('path');
var fs = require('fs');

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

// --- Summary ---
console.log('\n' + (passed + failed) + ' tests: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
