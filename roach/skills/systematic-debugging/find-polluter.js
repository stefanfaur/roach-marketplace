#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

if (process.argv.length !== 4) {
  console.log('Usage: node find-polluter.js <file_to_check> <test_pattern>');
  console.log("Example: node find-polluter.js '.git' 'src/**/*.test.ts'");
  process.exit(1);
}

var pollutionCheck = process.argv[2];
var testPattern = process.argv[3];

console.log('Searching for test that creates: ' + pollutionCheck);
console.log('Test pattern: ' + testPattern);
console.log('');

// Recursive glob implementation (no external dependencies)
function glob(dir, pattern) {
  var results = [];
  // Convert glob pattern to regex
  var regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  var regex = new RegExp('^' + regexStr + '$');

  function walk(currentDir, relativePath) {
    var entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    entries.forEach(function (entry) {
      var rel = relativePath ? relativePath + '/' + entry.name : entry.name;
      var full = path.join(currentDir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        walk(full, rel);
      } else if (entry.isFile() && regex.test(rel)) {
        results.push(rel);
      }
    });
  }

  walk(dir, '');
  return results.sort();
}

var testFiles = glob('.', testPattern);
var total = testFiles.length;

console.log('Found ' + total + ' test files');
console.log('');

var count = 0;
for (var i = 0; i < testFiles.length; i++) {
  var testFile = testFiles[i];
  count++;

  // Skip if pollution already exists
  if (fs.existsSync(pollutionCheck)) {
    console.log('Warning: Pollution already exists before test ' + count + '/' + total);
    console.log('   Skipping: ' + testFile);
    continue;
  }

  console.log('[' + count + '/' + total + '] Testing: ' + testFile);

  // Run the test
  try {
    child_process.execSync('npm test "' + testFile + '"', {
      stdio: 'pipe',
      timeout: 60000
    });
  } catch (_) {
    // Test failure is ok — we're looking for pollution, not pass/fail
  }

  // Check if pollution appeared
  if (fs.existsSync(pollutionCheck)) {
    console.log('');
    console.log('FOUND POLLUTER!');
    console.log('   Test: ' + testFile);
    console.log('   Created: ' + pollutionCheck);
    console.log('');
    console.log('To investigate:');
    console.log('  npm test "' + testFile + '"    # Run just this test');
    process.exit(1);
  }
}

console.log('');
console.log('No polluter found - all tests clean!');
process.exit(0);
