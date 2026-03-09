#!/usr/bin/env node
'use strict';

var fs = require('fs');
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

var args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: scaffold-workflow.js <url> <action-description>');
  console.error('Example: scaffold-workflow.js https://github.com create-pull-request');
  process.exit(1);
}

var url = args[0];
var action = args.slice(1).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');

// Derive domain slug from URL
var domainMatch = url.match(/^https?:\/\/([^/]+)/);
if (!domainMatch) {
  console.error('ERROR: Could not parse domain from URL: ' + url);
  process.exit(1);
}
var domain = domainMatch[1].replace(/\./g, '-');
var filename = domain + '--' + action + '.md';

var browserDir = path.join(process.cwd(), 'thoughts', 'shared', 'browser');
var filePath = path.join(browserDir, filename);

// Ensure directory exists
if (!fs.existsSync(browserDir)) {
  fs.mkdirSync(browserDir, { recursive: true });
}

if (fs.existsSync(filePath)) {
  console.log('EXISTS: update at ' + filePath);
  process.exit(0);
}

// Gather metadata (same as spec_metadata.js)
var toplevel = run('git rev-parse --show-toplevel', process.cwd());
var metadata = {
  date: new Date().toISOString(),
  git_branch: run('git rev-parse --abbrev-ref HEAD'),
  git_commit: run('git rev-parse --short HEAD'),
  repository: path.basename(toplevel),
  cwd: process.cwd(),
};

var content = [
  '---',
  'date: ' + metadata.date,
  'git_branch: ' + metadata.git_branch,
  'git_commit: ' + metadata.git_commit,
  'repository: ' + metadata.repository,
  'cwd: ' + metadata.cwd,
  'title: "' + domainMatch[1] + ' - ' + action.replace(/-/g, ' ') + '"',
  'description: ""',
  'domain: ' + domainMatch[1],
  '---',
  '',
  '## Steps',
  '',
  '1. <!-- First step with URL and action -->',
  '2. <!-- Continue... -->',
  '',
  '## Authentication',
  '',
  '<!-- How to authenticate: state file location, login steps, or "No authentication required" -->',
  '',
  '## Gotchas',
  '',
  '- <!-- Timing issues, redirects, dynamic content, elements that change refs -->',
].join('\n');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('CREATED: ' + filePath);
console.log('WORKFLOW_FILE: ' + filePath);
