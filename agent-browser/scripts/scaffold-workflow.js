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

// Parse --replay flag
var replayPath = null;
var positionalArgs = [];
for (var a = 0; a < args.length; a++) {
  if (args[a] === '--replay' && args[a + 1]) {
    replayPath = args[++a];
  } else {
    positionalArgs.push(args[a]);
  }
}

var url, action, domain, filename, domainMatch;

if (replayPath) {
  // Derive filename from replay path: foo--bar.replay.json -> foo--bar.md
  var replayBasename = path.basename(replayPath, '.replay.json');
  filename = replayBasename + '.md';
  // Extract domain from replay basename (everything before first --)
  var domainPart = replayBasename.split('--')[0] || replayBasename;
  domain = domainPart;
  // Use positional args for frontmatter if provided, otherwise derive from replay name
  url = positionalArgs[0] || '';
  action = positionalArgs.slice(1).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!action) {
    action = replayBasename.split('--').slice(1).join('-') || 'workflow';
  }
  domainMatch = url.match(/^https?:\/\/([^/]+)/);
} else {
  // Original behavior: derive from url + action-description
  if (positionalArgs.length < 2) {
    console.error('Usage: scaffold-workflow.js [--replay <replay.json>] <url> <action-description>');
    console.error('Example: scaffold-workflow.js https://github.com create-pull-request');
    console.error('Example: scaffold-workflow.js --replay thoughts/shared/browser/github-com--create-pr.replay.json');
    process.exit(1);
  }
  url = positionalArgs[0];
  action = positionalArgs.slice(1).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
  domainMatch = url.match(/^https?:\/\/([^/]+)/);
  if (!domainMatch) {
    console.error('ERROR: Could not parse domain from URL: ' + url);
    process.exit(1);
  }
  domain = domainMatch[1].replace(/\./g, '-');
  filename = domain + '--' + action + '.md';
}

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
  'title: "' + (domainMatch ? domainMatch[1] : domain.replace(/-/g, '.')) + ' - ' + action.replace(/-/g, ' ') + '"',
  'description: ""',
  'domain: ' + (domainMatch ? domainMatch[1] : domain.replace(/-/g, '.')),
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
