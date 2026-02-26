#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

// Constants
const DEFAULT_INSTALL_DIR = path.join(os.homedir(), '.claude', 'mcp-servers', 'mariadb');
const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const MARIADB_MCP_REPO = 'https://github.com/MariaDB/mcp.git';

// --- Arg parsing ---
function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--help' || argv[i] === '-h') {
      args['help'] = true;
      break;
    }
    const key = argv[i].replace(/^--/, '');
    args[key] = argv[i + 1];
  }
  return args;
}

function showHelp() {
  process.stderr.write(`Usage: node setup.js --action <action> [options]

Actions:
  install      Clone repo, install deps, write .env, update config, test connection
  update       Pull latest code, reinstall deps (no credential changes)
  reconfigure  Write new .env, update config, test connection (no code changes)
  both         Update code + reconfigure credentials
  reinstall    Delete install dir, then same as install

Options:
  --host        <host>    MariaDB host (required for: install, reconfigure, both, reinstall)
  --port        <port>    MariaDB port (required for: install, reconfigure, both, reinstall)
  --user        <user>    MariaDB user (required for: install, reconfigure, both, reinstall)
  --pass-file   <path>    Path to temp file containing password (required when credentials needed)
  --read-only   true|false  Enable read-only mode (default: true)
  --install-dir <path>    Install directory (default: ~/.claude/mcp-servers/mariadb)

Exit codes:
  0  Success
  1  Prerequisites missing or invalid arguments
  2  Clone/update/install step failed
  3  .env or ~/.claude.json write failed
  4  Connection test failed (config was written, server not reachable)
`);
}

// --- Output helpers ---
const steps = [];

function addStep(name, ok, detail, error) {
  const s = { name, ok };
  if (detail) s.detail = detail;
  if (error) s.error = error;
  steps.push(s);
}

function emitResult(success, action, installDir, connectionTest, exitCode, topError) {
  const result = {
    success,
    action,
    installDir,
    configPath: CLAUDE_CONFIG_PATH,
    connectionTest: connectionTest || { passed: false, error: null },
    steps
  };
  if (topError) result.error = topError;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(exitCode);
}

function die(exitCode, topError, action, installDir) {
  emitResult(false, action || null, installDir || DEFAULT_INSTALL_DIR, null, exitCode, topError);
}

// --- Prerequisites ---
function commandExists(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(command, args) {
  args = args || ['--version'];
  try {
    const result = execSync(`${command} ${args.join(' ')}`, { encoding: 'utf8' });
    return result.trim();
  } catch {
    return null;
  }
}

function checkPythonVersion() {
  const cmd = commandExists('python3') ? 'python3' : 'python';
  if (!commandExists(cmd)) return { ok: false, message: 'Python not found' };
  const v = getVersion(cmd);
  const m = v && v.match(/Python (\d+)\.(\d+)/);
  if (!m) return { ok: false, message: 'Could not parse Python version' };
  const major = parseInt(m[1]);
  const minor = parseInt(m[2]);
  if (major < 3 || (major === 3 && minor < 11)) {
    return { ok: false, message: `Python ${major}.${minor} found, but 3.11+ required` };
  }
  return { ok: true, version: `${major}.${minor}` };
}

function checkPrerequisites() {
  const errors = [];
  const pythonCheck = checkPythonVersion();
  if (!pythonCheck.ok) errors.push(pythonCheck.message);
  if (!commandExists('uv')) errors.push('uv not found — install: curl -LsSf https://astral.sh/uv/install.sh | sh');
  if (!commandExists('git')) errors.push('git not found — install from https://git-scm.com/downloads');

  if (errors.length > 0) {
    addStep('prerequisites', false, null, errors.join('; '));
    return false;
  }

  const uvVer = (getVersion('uv') || '').split('\n')[0];
  const gitVer = (getVersion('git') || '').split('\n')[0];
  addStep('prerequisites', true, `Python ${pythonCheck.version}, ${uvVer}, ${gitVer}`);
  return true;
}

// --- Password temp file ---
function readAndDeletePassFile(passFile) {
  try {
    const password = fs.readFileSync(passFile, 'utf8').trim();
    try { fs.unlinkSync(passFile); } catch (_) {}
    return password;
  } catch (err) {
    throw new Error(`Cannot read pass-file ${passFile}: ${err.message}`);
  }
}

// --- Repo operations ---
function cloneRepository(installDir) {
  process.stderr.write('Cloning MariaDB MCP server...\n');
  const parentDir = path.dirname(installDir);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  const result = spawnSync('git', ['clone', MARIADB_MCP_REPO, installDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`git clone failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

function updateRepository(installDir) {
  process.stderr.write('Updating MariaDB MCP server code...\n');
  const result = spawnSync('git', ['pull', 'origin', 'main'], {
    cwd: installDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`git pull failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

function installDependencies(installDir) {
  process.stderr.write('Installing Python dependencies...\n');
  const result = spawnSync('uv', ['sync'], {
    cwd: installDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`uv sync failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

// --- Credential exposure fix: pass via env, not args ---
function testConnection(credentials, installDir) {
  process.stderr.write('Testing database connection...\n');
  const testScript = `
import os, sys
try:
    import mysql.connector
    conn = mysql.connector.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ['DB_PORT']),
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )
    conn.close()
    print('SUCCESS')
    sys.exit(0)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`;

  const result = spawnSync(
    'uv',
    ['run', 'python', '-c', testScript],
    {
      cwd: installDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DB_HOST: credentials.DB_HOST,
        DB_PORT: credentials.DB_PORT,
        DB_USER: credentials.DB_USER,
        DB_PASSWORD: credentials.DB_PASSWORD
      }
    }
  );

  if (result.status === 0) {
    return { passed: true, error: null };
  } else {
    const errMsg = (result.stderr || result.stdout || '').trim();
    return { passed: false, error: errMsg || 'Connection refused' };
  }
}

// --- Config writers ---
function writeEnvFile(credentials, installDir) {
  const envPath = path.join(installDir, '.env');
  const content = [
    '# MariaDB Connection Configuration',
    '# Generated by /mariadb-setup',
    '',
    `DB_HOST=${credentials.DB_HOST}`,
    `DB_PORT=${credentials.DB_PORT}`,
    `DB_USER=${credentials.DB_USER}`,
    `DB_PASSWORD=${credentials.DB_PASSWORD}`,
    `MCP_READ_ONLY=${credentials.MCP_READ_ONLY}`,
    ''
  ].join('\n');

  fs.writeFileSync(envPath, content, { encoding: 'utf8', mode: 0o600 });
}

function readExistingEnv(installDir) {
  const envPath = path.join(installDir, '.env');
  if (!fs.existsSync(envPath)) return {};
  try {
    const env = {};
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    return env;
  } catch {
    return {};
  }
}

function updateClaudeConfig(installDir) {
  let config = {};
  if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
    const content = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
    config = JSON.parse(content); // throws on invalid JSON — caught by caller
  }

  if (!config.mcpServers) config.mcpServers = {};

  config.mcpServers.mariadb = {
    command: 'uv',
    args: ['--directory', installDir, 'run', 'mariadb-mcp']
  };

  fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

// --- Main ---
function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const action = args['action'];
  const installDir = args['install-dir']
    ? path.resolve(args['install-dir'])
    : DEFAULT_INSTALL_DIR;

  if (!action) {
    process.stdout.write(JSON.stringify({ success: false, error: '--action required' }, null, 2) + '\n');
    process.exit(1);
  }

  const validActions = ['install', 'update', 'reconfigure', 'both', 'reinstall'];
  if (!validActions.includes(action)) {
    process.stdout.write(JSON.stringify({ success: false, error: `invalid --action "${action}"; must be one of: ${validActions.join(', ')}` }, null, 2) + '\n');
    process.exit(1);
  }

  const needsCredentials = action !== 'update';

  // Read password from temp file (and delete it immediately)
  let password = '';
  if (needsCredentials) {
    const passFile = args['pass-file'];
    if (!passFile) {
      process.stdout.write(JSON.stringify({ success: false, error: '--pass-file required for action: ' + action }, null, 2) + '\n');
      process.exit(1);
    }
    try {
      password = readAndDeletePassFile(passFile);
    } catch (err) {
      process.stdout.write(JSON.stringify({ success: false, error: err.message }, null, 2) + '\n');
      process.exit(1);
    }

    // Validate other required credential args
    const missing = ['host', 'port', 'user'].filter(k => !args[k]);
    if (missing.length > 0) {
      process.stdout.write(JSON.stringify({ success: false, error: `missing required args for action "${action}": ${missing.map(k => '--' + k).join(', ')}` }, null, 2) + '\n');
      process.exit(1);
    }
  }

  const credentials = needsCredentials ? {
    DB_HOST: args['host'],
    DB_PORT: args['port'],
    DB_USER: args['user'],
    DB_PASSWORD: password,
    MCP_READ_ONLY: args['read-only'] === 'false' ? 'false' : 'true'
  } : null;

  // --- Step 1: Prerequisites ---
  if (!checkPrerequisites()) {
    emitResult(false, action, installDir, null, 1, 'Prerequisites check failed');
    return;
  }

  // --- Step 2: Clone / Update ---
  const needsClone = action === 'install' || action === 'reinstall';
  const needsUpdate = action === 'update' || action === 'both';

  if (action === 'reinstall' && fs.existsSync(installDir)) {
    process.stderr.write('Removing existing installation...\n');
    fs.rmSync(installDir, { recursive: true, force: true });
  }

  if (needsClone) {
    try {
      cloneRepository(installDir);
      addStep('clone', true);
    } catch (err) {
      addStep('clone', false, null, err.message);
      emitResult(false, action, installDir, null, 2, err.message);
      return;
    }
    try {
      installDependencies(installDir);
      addStep('dependencies', true);
    } catch (err) {
      addStep('dependencies', false, null, err.message);
      emitResult(false, action, installDir, null, 2, err.message);
      return;
    }
  } else if (needsUpdate) {
    try {
      updateRepository(installDir);
      addStep('clone', true, 'updated');
    } catch (err) {
      addStep('clone', false, null, err.message);
      emitResult(false, action, installDir, null, 2, err.message);
      return;
    }
    try {
      installDependencies(installDir);
      addStep('dependencies', true);
    } catch (err) {
      addStep('dependencies', false, null, err.message);
      emitResult(false, action, installDir, null, 2, err.message);
      return;
    }
  }

  // --- Step 3: Write .env ---
  if (needsCredentials) {
    try {
      writeEnvFile(credentials, installDir);
      addStep('env', true);
    } catch (err) {
      addStep('env', false, null, err.message);
      emitResult(false, action, installDir, null, 3, err.message);
      return;
    }
  // for update action, credentials remain null — readExistingEnv is called below

  // --- Step 4: Update ~/.claude.json ---
  try {
    updateClaudeConfig(installDir);
    addStep('config', true);
  } catch (err) {
    addStep('config', false, null, err.message);
    emitResult(false, action, installDir, null, 3, err.message);
    return;
  }

  // --- Step 5: Connection test ---
  const credsForTest = credentials || readExistingEnv(installDir);
  const connResult = testConnection(credsForTest, installDir);
  addStep('connection', connResult.passed, null, connResult.passed ? null : connResult.error);

  if (!connResult.passed) {
    emitResult(false, action, installDir, connResult, 4, 'Connection test failed: ' + connResult.error);
    return;
  }

  emitResult(true, action, installDir, connResult, 0, null);
}

main();
