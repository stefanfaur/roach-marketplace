#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');

var browserDir = path.join(process.cwd(), 'thoughts', 'shared', 'browser');
var generalMd = path.join(browserDir, 'GENERAL.md');

// Ensure directory exists
if (!fs.existsSync(browserDir)) {
  fs.mkdirSync(browserDir, { recursive: true });
  console.log('CREATED: ' + browserDir);
} else {
  console.log('EXISTS: ' + browserDir);
}

// Create GENERAL.md skeleton only if missing
if (!fs.existsSync(generalMd)) {
  var skeleton = [
    '# Browser Automation — General Notes',
    '',
    'Keep this file concise. Only cross-cutting facts belong here.',
    'Workflow-specific details go in domain workflow files.',
    '',
    '## Auth Endpoints',
    '',
    '<!-- Login URLs, OAuth endpoints, SSO entry points -->',
    '',
    '## Credential Sources',
    '',
    '<!-- Where credentials live: env vars, vault paths, .env files. Never store actual secrets. -->',
    '',
    '## Session State Files',
    '',
    '<!-- Saved state file paths (thoughts/shared/browser/*.json) and which workflows use them -->',
    '',
    '## Shared Setup',
    '',
    '<!-- Base URLs, user-agent overrides, viewport settings that apply across workflows -->',
    '',
    '## Safety Notes',
    '',
    '<!-- Rate limits, captcha triggers, fragile flows, pages that must not be automated -->',
  ].join('\n');

  fs.writeFileSync(generalMd, skeleton, 'utf-8');
  console.log('CREATED: ' + generalMd);
} else {
  console.log('EXISTS: ' + generalMd);
}

console.log('GENERAL_MD: ' + generalMd);
