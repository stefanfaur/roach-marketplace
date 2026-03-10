#!/usr/bin/env node
'use strict';

var { execSync } = require('child_process');
var fs = require('fs');
var path = require('path');

// Parse args: [--record <replay-path>] [--session <name>] < commands on stdin
var args = process.argv.slice(2);
var recordPath = null;
var session = null;

for (var i = 0; i < args.length; i++) {
  if (args[i] === '--record' && args[i + 1]) {
    recordPath = args[++i];
  } else if (args[i] === '--session' && args[i + 1]) {
    session = args[++i];
  }
}

// Read commands from stdin
var input = fs.readFileSync('/dev/stdin', 'utf-8').trim();
var commands = input.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);

if (commands.length === 0) {
  console.error('No commands provided on stdin');
  process.exit(1);
}

// State for recording
var lastSnapshot = null;     // parsed element list from most recent snapshot
var recordedActions = [];     // actions with semantic locators for replay capture

function runCmd(cmd) {
  var fullCmd = 'agent-browser ' + cmd;
  if (session) {
    fullCmd += ' --session "' + session + '"';
  }
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

// Parse a snapshot output into a map of ref -> element description
// Example line: "@e7  button "Create pull request""
function parseSnapshot(output) {
  var elements = {};
  var lines = output.split('\n');
  for (var j = 0; j < lines.length; j++) {
    var match = lines[j].match(/^(@e\d+)\s+(.+)$/);
    if (match) {
      elements[match[1]] = match[2].trim();
    }
  }
  return elements;
}

// Extract semantic locators from an element description string
// Example: 'button "Create pull request"' -> [{strategy:"role", role:"button", name:"Create pull request"}]
function extractLocators(description) {
  var locators = [];
  // Pattern: role "name"
  var roleMatch = description.match(/^(\w+)\s+"([^"]+)"$/);
  if (roleMatch) {
    locators.push({ strategy: 'role', role: roleMatch[1], name: roleMatch[2] });
    locators.push({ strategy: 'text', text: roleMatch[2] });
    return locators;
  }
  // Pattern: role [name="x"] "label"  (input fields)
  var inputMatch = description.match(/^(\w+)\s+(?:\[([^\]]+)\]\s*)?"?([^"]*)"?$/);
  if (inputMatch) {
    var role = inputMatch[1];
    var attrs = inputMatch[2] || '';
    var label = inputMatch[3] || '';
    if (label) {
      locators.push({ strategy: 'label', text: label });
    }
    if (role) {
      var loc = { strategy: 'role', role: role };
      if (label) loc.name = label;
      locators.push(loc);
    }
    var nameAttr = attrs.match(/name="([^"]+)"/);
    if (nameAttr) {
      locators.push({ strategy: 'attr', attr: 'name', value: nameAttr[1] });
    }
  }
  // Fallback: just use the full description as text
  if (locators.length === 0 && description.length > 0) {
    var textMatch = description.match(/"([^"]+)"/);
    if (textMatch) {
      locators.push({ strategy: 'text', text: textMatch[1] });
    }
  }
  return locators;
}

// Extract the ref and action details from a command string for recording
function parseCommand(cmd) {
  // click @e7
  var clickMatch = cmd.match(/^click\s+(@e\d+)$/);
  if (clickMatch) return { action: 'click', ref: clickMatch[1] };
  // fill @e7 "value"
  var fillMatch = cmd.match(/^fill\s+(@e\d+)\s+"([^"]*)"$/);
  if (fillMatch) return { action: 'fill', ref: fillMatch[1], value: fillMatch[2] };
  // select @e7 "value"
  var selectMatch = cmd.match(/^select\s+(@e\d+)\s+"([^"]*)"$/);
  if (selectMatch) return { action: 'select', ref: selectMatch[1], value: selectMatch[2] };
  // type @e7 "value"
  var typeMatch = cmd.match(/^type\s+(@e\d+)\s+"([^"]*)"$/);
  if (typeMatch) return { action: 'type', ref: typeMatch[1], value: typeMatch[2] };
  // check/uncheck @e7
  var checkMatch = cmd.match(/^(check|uncheck)\s+(@e\d+)$/);
  if (checkMatch) return { action: checkMatch[1], ref: checkMatch[2] };
  // Non-interaction commands (wait, open, snapshot, get, etc.)
  return null;
}

var results = [];
var failed = false;

for (var c = 0; c < commands.length; c++) {
  var cmd = commands[c];
  var result = runCmd(cmd);

  if (result.success) {
    // Track snapshots for recording
    if (cmd.match(/^snapshot\b/)) {
      lastSnapshot = parseSnapshot(result.output);
    }

    // Record interaction commands with semantic locators
    if (recordPath) {
      var parsed = parseCommand(cmd);
      if (parsed && lastSnapshot && parsed.ref && lastSnapshot[parsed.ref]) {
        var locators = extractLocators(lastSnapshot[parsed.ref]);
        var recorded = { action: parsed.action, locators: locators };
        if (parsed.value !== undefined) recorded.value = parsed.value;
        recorded.comment = lastSnapshot[parsed.ref];
        recordedActions.push(recorded);
      } else if (!parsed) {
        // Non-interaction command — record as-is for replay
        if (cmd.match(/^wait\b/)) {
          recordedActions.push({ action: 'wait', args: cmd.replace(/^wait\s*/, '').split(/\s+/) });
        } else if (cmd.match(/^open\b/)) {
          recordedActions.push({ action: 'open', url: cmd.replace(/^open\s+/, '') });
        }
        // snapshot commands are not recorded — they are implicit in replay
      }
    }

    results.push('OK ' + cmd);

    // Only print output for the LAST command or for snapshots
    if (c === commands.length - 1 || cmd.match(/^snapshot\b/) || cmd.match(/^get\b/) || cmd.match(/^screenshot\b/)) {
      if (result.output) {
        results.push(result.output);
      }
    }
  } else {
    results.push('FAIL ' + cmd);
    results.push(result.output);
    // On failure, take a recovery snapshot
    var recovery = runCmd('snapshot -i');
    if (recovery.success) {
      results.push('--- Recovery snapshot ---');
      results.push(recovery.output);
    }
    failed = true;
    break;
  }
}

// Write recorded actions if recording was requested and we didn't fail
if (recordPath && recordedActions.length > 0) {
  var existing = {};
  if (fs.existsSync(recordPath)) {
    try { existing = JSON.parse(fs.readFileSync(recordPath, 'utf-8')); } catch (_) {}
  }
  // Append to existing steps or create new
  if (!existing.steps) {
    existing = {
      version: 1,
      captured: new Date().toISOString(),
      steps: []
    };
  }
  existing.steps = existing.steps.concat(recordedActions);
  existing.captured = new Date().toISOString();

  var dir = path.dirname(recordPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(recordPath, JSON.stringify(existing, null, 2), 'utf-8');
  results.push('RECORDED: ' + recordedActions.length + ' actions to ' + recordPath);
}

console.log(results.join('\n'));
process.exit(failed ? 1 : 0);
