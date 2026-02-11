#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

function run(cmd, fallback = '') {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return fallback; }
}

function readJSON(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return null; }
}

// Detect project tech stack by checking for known project files
function detectStack(projectDir) {
  const detections = [];

  // JavaScript/TypeScript
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = readJSON(pkgPath);
    if (pkg) {
      if (pkg.scripts && pkg.scripts.lint) detections.push({ name: 'lint', command: 'npm run lint' });
      if (pkg.scripts && pkg.scripts.test) detections.push({ name: 'test', command: 'npm test' });
      if (!detections.some(d => d.name === 'lint')) {
        if ((pkg.devDependencies && pkg.devDependencies.eslint) || (pkg.dependencies && pkg.dependencies.eslint))
          detections.push({ name: 'eslint', command: 'npx eslint .' });
      }
      if (pkg.devDependencies && pkg.devDependencies.prettier)
        detections.push({ name: 'prettier-check', command: 'npx prettier --check .' });
      if ((pkg.devDependencies && pkg.devDependencies.typescript) || (pkg.dependencies && pkg.dependencies.typescript))
        detections.push({ name: 'typecheck', command: 'npx tsc --noEmit' });
    }
  }

  // Python
  if (fs.existsSync(path.join(projectDir, 'pyproject.toml')) ||
      fs.existsSync(path.join(projectDir, 'setup.py')) ||
      fs.existsSync(path.join(projectDir, 'requirements.txt'))) {
    detections.push({ name: 'lint', command: 'ruff check .' });
    detections.push({ name: 'test', command: 'pytest' });
  }

  // Go
  if (fs.existsSync(path.join(projectDir, 'go.mod'))) {
    detections.push({ name: 'vet', command: 'go vet ./...' });
    detections.push({ name: 'test', command: 'go test ./...' });
  }

  // Rust
  if (fs.existsSync(path.join(projectDir, 'Cargo.toml'))) {
    detections.push({ name: 'check', command: 'cargo check' });
    detections.push({ name: 'test', command: 'cargo test' });
    detections.push({ name: 'clippy', command: 'cargo clippy -- -D warnings' });
  }

  // Ruby
  if (fs.existsSync(path.join(projectDir, 'Gemfile'))) {
    detections.push({ name: 'rubocop', command: 'bundle exec rubocop' });
    detections.push({ name: 'test', command: 'bundle exec rspec' });
  }

  // Makefile targets
  const makefilePath = path.join(projectDir, 'Makefile');
  if (fs.existsSync(makefilePath)) {
    try {
      const makefile = fs.readFileSync(makefilePath, 'utf-8');
      var targets = ['lint', 'test', 'check', 'format'];
      for (var i = 0; i < targets.length; i++) {
        var target = targets[i];
        if (new RegExp('^' + target + '\\s*:', 'm').test(makefile) &&
            !detections.some(function(d) { return d.name === target; })) {
          detections.push({ name: target, command: 'make ' + target });
        }
      }
    } catch (e) { /* ignore */ }
  }

  return detections;
}

// Read CLAUDE.md and extract lines mentioning build/test/lint commands
function readClaudeMd(projectDir) {
  var claudePath = path.join(projectDir, 'CLAUDE.md');
  if (!fs.existsSync(claudePath)) return '';
  try {
    var content = fs.readFileSync(claudePath, 'utf-8').substring(0, 2000);
    var relevant = content.split('\n')
      .filter(function(line) {
        return /\b(lint|test|check|build|format|eslint|prettier|jest|pytest|cargo|make|ruff|rubocop|clippy|tsc)\b/i.test(line);
      })
      .slice(0, 10)
      .join('\n');
    return relevant || '';
  } catch (e) { return ''; }
}

async function main() {
  var projectDir = run('git rev-parse --show-toplevel') || process.cwd();
  var configPath = path.join(projectDir, '.claude', 'prepush.json');
  var isConfigured = fs.existsSync(configPath);

  var additionalContext = '';

  if (isConfigured) {
    // Already set up — just inject brief status
    additionalContext = '--- prepush plugin ---\nPre-push hooks are configured for this project. The developer can run /prepush_review manually or push to trigger automated checks.\n---';
  } else {
    // Not configured — detect stack and prepare onboarding instructions
    var detections = detectStack(projectDir);
    var claudeExcerpts = readClaudeMd(projectDir);
    var hasExistingHook = fs.existsSync(path.join(projectDir, '.git', 'hooks', 'pre-push'));

    // Build detected tools description
    var toolsList = '';
    if (detections.length > 0) {
      toolsList = detections.map(function(d) { return '  - ' + d.name + ': `' + d.command + '`'; }).join('\n');
    } else {
      toolsList = '  - (no tools auto-detected — the developer will need to specify manually)';
    }

    // Build CLAUDE.md excerpt
    var claudeSection = '';
    if (claudeExcerpts) {
      claudeSection = '\nCLAUDE.md relevant excerpts:\n' + claudeExcerpts.split('\n').map(function(l) { return '  ' + l; }).join('\n') + '\n';
    }

    // Build existing hook warning
    var hookWarning = '';
    if (hasExistingHook) {
      hookWarning = '\nWARNING: An existing .git/hooks/pre-push file was detected. If the developer chooses to set up, you must ask whether to back it up and replace or skip hook installation.\n';
    }

    // Build default tools JSON for the config template
    var defaultToolsJson = detections.length > 0
      ? JSON.stringify(detections.map(function(d) { return { name: d.name, command: d.command }; }), null, 4)
      : '[\n      { "name": "lint", "command": "echo \'configure your lint command\'" },\n      { "name": "test", "command": "echo \'configure your test command\'" }\n    ]';

    // Read the command template
    var commandTemplate = '';
    try {
      commandTemplate = fs.readFileSync(path.join(PLUGIN_ROOT, 'templates', 'prepush_review.md'), 'utf-8');
    } catch (e) {
      commandTemplate = '# Error: Could not read command template from plugin directory';
    }
    var commandTemplateEscaped = JSON.stringify(commandTemplate).slice(1, -1);

    // Read the git hook template
    var hookTemplate = '';
    try {
      hookTemplate = fs.readFileSync(path.join(PLUGIN_ROOT, 'lib', 'pre-push-hook.sh'), 'utf-8');
    } catch (e) {
      hookTemplate = '#!/usr/bin/env bash\necho "prepush: hook template not found"\nexit 0';
    }
    var hookTemplateEscaped = JSON.stringify(hookTemplate).slice(1, -1);

    additionalContext = '--- ACTION REQUIRED: Pre-Push Setup ---\n'
      + 'The prepush plugin detected a git repository but no pre-push configuration exists yet.\n'
      + '\nDetected tech stack and suggested quality tools:\n'
      + toolsList + '\n'
      + claudeSection
      + hookWarning
      + '\nYOU MUST DO THIS: Handle any other plugin setup prompts first (e.g., web permission warnings), then use AskUserQuestion to ask the developer about pre-push setup.\n'
      + '\nUse AskUserQuestion with these parameters:\n'
      + 'Question: "Would you like to set up pre-push quality checks and AI code review for this project?"\n'
      + 'Header: "Pre-push"\n'
      + 'Options:\n'
      + '1. Label: "Yes, set up with defaults" — Description: "Install pre-push hook with detected tools: ' + detections.map(function(d) { return d.name; }).join(', ') + '. AI review enabled in auto mode."\n'
      + '2. Label: "No, skip setup" — Description: "Don\'t set up pre-push checks. You can always set them up later."\n'
      + '3. Label: "Yes, focus on ..." — Description: "Set up pre-push checks with custom focus areas. Complete the sentence to specify focus (e.g., security, performance, test coverage)."\n'
      + 'multiSelect: false\n'
      + '\nAfter the developer responds:\n'
      + '- If "Yes, set up with defaults": Create the files below using the detected tools and default focus areas ["correctness", "security"].\n'
      + '- If "Yes, focus on ...": The developer will complete the sentence. Parse their focus areas and use them.\n'
      + '- If "No, skip setup": Acknowledge and move on to the user\'s actual task.\n'
      + '- If they type free text (Other): Parse their intent — set up with their preferences or skip.\n'
      + '\n=== FILES TO CREATE ===\n'
      + '\n--- File 1: .claude/prepush.json ---\n'
      + 'Create the .claude/ directory if it doesn\'t exist, then write this config:\n'
      + '{\n'
      + '  "version": 1,\n'
      + '  "mode": "auto",\n'
      + '  "qualityTools": ' + defaultToolsJson + ',\n'
      + '  "review": {\n'
      + '    "enabled": true,\n'
      + '    "focus": [REPLACE_WITH_FOCUS_AREAS],\n'
      + '    "command": "prepush_review"\n'
      + '  }\n'
      + '}\n'
      + 'Replace [REPLACE_WITH_FOCUS_AREAS] with the developer\'s chosen focus areas as a JSON array of strings.\n'
      + 'If "Yes, set up with defaults", use: ["correctness", "security"]\n'
      + 'If the developer specified focus areas, convert them to a JSON array.\n'
      + '\n--- File 2: .claude/commands/prepush_review.md ---\n'
      + 'Create .claude/commands/ directory if it doesn\'t exist. Write this file with placeholders replaced:\n'
      + '\nTemplate (replace {{QUALITY_TOOLS}} with a numbered list of the quality tools, and {{FOCUS_AREAS}} with bullet points for each focus area):\n'
      + '\n' + commandTemplateEscaped + '\n'
      + '\nFor {{QUALITY_TOOLS}}, generate a numbered list like:\n'
      + '1. Run lint: `npm run lint`\n'
      + '2. Run tests: `npm test`\n'
      + '\nFor {{FOCUS_AREAS}}, generate bullet points like:\n'
      + '- **Security**: Look for injection vulnerabilities, exposed secrets, insecure patterns\n'
      + '- **Correctness**: Check for logic errors, off-by-one bugs, edge cases\n'
      + '\n--- File 3: .git/hooks/pre-push ---\n'
      + (hasExistingHook
          ? 'An existing pre-push hook was detected. Use AskUserQuestion to ask:\n'
            + '  - "Replace (backup to .git/hooks/pre-push.backup)"\n'
            + '  - "Skip hook installation"\n'
            + 'If replacing, first copy the existing hook: cp .git/hooks/pre-push .git/hooks/pre-push.backup\n'
          : '')
      + 'Write this script to .git/hooks/pre-push and make it executable (chmod +x):\n'
      + '\n' + hookTemplateEscaped + '\n'
      + '\nAfter creating all files, confirm to the developer what was set up.\n'
      + '---';
  }

  if (additionalContext) {
    var output = {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext
      }
    };
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }
}

main().catch(function(err) {
  process.stderr.write('prepush session-start.js error: ' + err.message + '\n');
  process.exit(1);
});
