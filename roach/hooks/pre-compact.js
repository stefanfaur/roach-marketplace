#!/usr/bin/env node
'use strict';

var fs = require('fs');

// Read stdin (PreCompact hook JSON)
var input = fs.readFileSync(0, 'utf-8');
var data;
try {
  data = JSON.parse(input);
} catch (_) {
  process.exit(0);
}

// Only act on automatic compaction (not user-triggered manual compact)
var trigger = data.trigger || 'auto';
if (trigger !== 'auto') {
  process.exit(0);
}

// Inject a suggestion into the compaction summary via additionalContext
var output = {
  hookSpecificOutput: {
    hookEventName: 'PreCompact',
    additionalContext: [
      'IMPORTANT: Context is about to be automatically compacted.',
      'Before compaction proceeds, strongly consider running /create_handoff to preserve',
      'structured context (current task, open decisions, key file references, action items).',
      'The handoff document will survive compaction and can be resumed with /resume_handoff.',
      'If the current work is at a clean stopping point, create the handoff now.'
    ].join(' ')
  }
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
