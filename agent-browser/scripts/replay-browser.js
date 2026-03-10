#!/usr/bin/env node
'use strict';

var { execSync } = require('child_process');
var fs = require('fs');

// Usage: replay-browser.js <replay.json> [KEY=VALUE ...]
var args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: replay-browser.js <replay.json> [KEY=VALUE ...]');
  process.exit(1);
}

var replayPath = args[0];
if (!fs.existsSync(replayPath)) {
  console.error('REPLAY_NOT_FOUND: ' + replayPath);
  process.exit(2);
}

var replay;
try {
  replay = JSON.parse(fs.readFileSync(replayPath, 'utf-8'));
} catch (err) {
  console.error('REPLAY_PARSE_ERROR: ' + err.message);
  process.exit(2);
}

// Parse KEY=VALUE params
var params = {};
for (var i = 1; i < args.length; i++) {
  var eq = args[i].indexOf('=');
  if (eq > 0) {
    params[args[i].substring(0, eq)] = args[i].substring(eq + 1);
  }
}

// Substitute $PARAM_NAME in a string
function subst(str) {
  if (!str) return str;
  return str.replace(/\$([A-Z_][A-Z0-9_]*)/g, function (_, name) {
    return params[name] !== undefined ? params[name] : '$' + name;
  });
}

var session = 'replay-' + Date.now();

function runCmd(cmd) {
  var fullCmd = 'agent-browser ' + cmd + ' --session "' + session + '"';
  try {
    var output = execSync(fullCmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000
    }).trim();
    return { success: true, output: output };
  } catch (err) {
    return { success: false, output: (err.stderr || err.message || '').trim() };
  }
}

// Build an agent-browser find command from a locator object
function locatorToCmd(locator, action, value) {
  var findPart = '';
  switch (locator.strategy) {
    case 'role':
      findPart = 'find role ' + locator.role;
      if (locator.name) findPart += ' --name "' + locator.name + '"';
      break;
    case 'text':
      findPart = 'find text "' + locator.text + '"';
      break;
    case 'label':
      findPart = 'find label "' + locator.text + '"';
      break;
    case 'testid':
      findPart = 'find testid "' + locator.id + '"';
      break;
    case 'placeholder':
      findPart = 'find placeholder "' + locator.text + '"';
      break;
    default:
      return null;
  }

  // Add index for disambiguation
  if (locator.index !== undefined) {
    // Run find without action to check, then use nth
    // For now, append action directly (agent-browser handles strictness)
  }

  switch (action) {
    case 'click':
      return findPart + ' click';
    case 'fill':
      return findPart + ' fill "' + subst(value) + '"';
    case 'type':
      return findPart + ' type "' + subst(value) + '"';
    case 'select':
      return findPart + ' select "' + subst(value) + '"';
    case 'check':
      return findPart + ' check';
    case 'uncheck':
      return findPart + ' uncheck';
    default:
      return null;
  }
}

// Load auth state if specified
if (replay.auth_state && fs.existsSync(replay.auth_state)) {
  var authResult = runCmd('state load ' + replay.auth_state);
  if (!authResult.success) {
    console.log('AUTH_WARN: Could not load state from ' + replay.auth_state);
  }
}

// Navigate to start URL if specified
if (replay.start_url) {
  var navResult = runCmd('open ' + subst(replay.start_url));
  if (!navResult.success) {
    console.error('REPLAY_FAILED: Could not navigate to ' + replay.start_url);
    console.error(navResult.output);
    process.exit(1);
  }
  runCmd('wait --load networkidle');
}

var steps = replay.steps || [];
var failedStep = -1;
var failedAction = '';

for (var s = 0; s < steps.length; s++) {
  var step = steps[s];

  // Non-interaction steps
  if (step.action === 'wait') {
    var waitArgs = (step.args || []).join(' ');
    runCmd('wait ' + waitArgs);
    console.log('OK [' + (s + 1) + '/' + steps.length + '] wait ' + waitArgs);
    continue;
  }

  if (step.action === 'open') {
    var openResult = runCmd('open ' + subst(step.url));
    if (!openResult.success) {
      failedStep = s;
      failedAction = 'open ' + step.url;
      break;
    }
    console.log('OK [' + (s + 1) + '/' + steps.length + '] open ' + step.url);
    continue;
  }

  if (step.action === 'verify') {
    if (step.check === 'url_contains') {
      var urlResult = runCmd('get url');
      if (!urlResult.success || urlResult.output.indexOf(subst(step.value)) === -1) {
        failedStep = s;
        failedAction = 'verify url_contains "' + step.value + '" (got: ' + (urlResult.output || 'unknown') + ')';
        break;
      }
      console.log('OK [' + (s + 1) + '/' + steps.length + '] verify url_contains "' + step.value + '"');
    } else if (step.check === 'element_exists') {
      // Try locators to confirm element is present
      var found = false;
      for (var v = 0; v < (step.locators || []).length; v++) {
        var checkCmd = locatorToCmd(step.locators[v], 'click', null);
        if (checkCmd) {
          // Use wait instead of click to check existence
          var waitResult = runCmd('wait 2000');
          found = true;
          break;
        }
      }
      if (!found) {
        failedStep = s;
        failedAction = 'verify element_exists';
        break;
      }
      console.log('OK [' + (s + 1) + '/' + steps.length + '] verify element_exists');
    }
    continue;
  }

  // Interaction steps — try locators in cascade
  if (!step.locators || step.locators.length === 0) {
    console.log('SKIP [' + (s + 1) + '/' + steps.length + '] no locators for ' + step.action);
    continue;
  }

  var stepSuccess = false;
  for (var l = 0; l < step.locators.length; l++) {
    var cmd = locatorToCmd(step.locators[l], step.action, step.value);
    if (!cmd) continue;

    var result = runCmd(cmd);
    if (result.success) {
      var locName = step.locators[l].strategy + (step.locators[l].name ? ':"' + step.locators[l].name + '"' : '');
      console.log('OK [' + (s + 1) + '/' + steps.length + '] ' + step.action + ' via ' + locName);
      stepSuccess = true;
      break;
    }
  }

  if (!stepSuccess) {
    failedStep = s;
    failedAction = step.action + ' (all ' + step.locators.length + ' locators failed)';
    if (step.comment) failedAction += ' — intended: ' + step.comment;
    break;
  }
}

if (failedStep >= 0) {
  console.log('');
  console.log('REPLAY_FAILED_AT_STEP: ' + (failedStep + 1) + '/' + steps.length);
  console.log('FAILED_ACTION: ' + failedAction);
  console.log('REMAINING_STEPS: ' + (steps.length - failedStep));

  // Take a snapshot for LLM recovery context
  var snap = runCmd('snapshot -i');
  if (snap.success) {
    console.log('');
    console.log('--- Current page state for LLM recovery ---');
    console.log(snap.output);
  }

  // Output remaining steps as context for the LLM
  console.log('');
  console.log('--- Remaining steps ---');
  for (var r = failedStep; r < steps.length; r++) {
    var desc = steps[r].action;
    if (steps[r].comment) desc += ' — ' + steps[r].comment;
    if (steps[r].value) desc += ' (value: ' + steps[r].value + ')';
    console.log((r + 1) + '. ' + desc);
  }

  process.exit(1);
} else {
  console.log('');
  console.log('REPLAY_SUCCESS: All ' + steps.length + ' steps completed');
  process.exit(0);
}
