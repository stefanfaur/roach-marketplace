#!/usr/bin/env node
'use strict';

var path = require('path');
var { execSync } = require('child_process');

function run(cmd, fallback) {
  fallback = fallback || 'unknown';
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (_) {
    return fallback;
  }
}

var toplevel = run('git rev-parse --show-toplevel', process.cwd());

console.log('date: ' + new Date().toISOString());
console.log('git_branch: ' + run('git rev-parse --abbrev-ref HEAD'));
console.log('git_commit: ' + run('git rev-parse --short HEAD'));
console.log('repository: ' + path.basename(toplevel));
console.log('cwd: ' + process.cwd());
