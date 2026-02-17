#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

// Constants
const MCP_INSTALL_DIR = path.join(os.homedir(), '.claude', 'mcp-servers', 'mariadb');
const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const MARIADB_MCP_REPO = 'https://github.com/MariaDB/mcp.git';

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user.');
  process.exit(130);
});

// Main execution
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

  let credentials = null;

  try {
    // Check prerequisites
    if (!checkPrerequisites()) {
      process.exit(1);
    }

    // Detect existing installation
    const rl = createPrompt();
    let mode = 'fresh';

    if (fs.existsSync(MCP_INSTALL_DIR)) {
      mode = await handleExistingInstallation(rl);
    }

    // Install or update based on mode
    if (mode === 'fresh') {
      performFreshInstall();
    } else if (mode === 'update' || mode === 'both') {
      performUpdate();
    }

    // Configure (prompt for credentials if fresh, reconfigure, or both)
    if (mode === 'fresh' || mode === 'reconfigure' || mode === 'both') {
      const existingEnv = mode === 'fresh' ? {} : readExistingEnv();
      credentials = await promptForCredentials(rl, existingEnv);
      writeEnvFile(credentials);
    } else {
      // For update-only mode, read existing credentials for testing
      credentials = readExistingEnv();
    }

    // Update Claude Code configuration
    updateClaudeConfig();

    rl.close();

    // Test connection
    const connectionOk = testConnection(credentials);

    // Show final message
    console.log('\n' + '='.repeat(60));

    if (connectionOk) {
      console.log('✅ MariaDB MCP server installed successfully!');
      console.log('✅ Connection test passed\n');
      console.log('Configuration saved to:');
      console.log(`  - Server: ${MCP_INSTALL_DIR}`);
      console.log(`  - Config: ${CLAUDE_CONFIG_PATH}\n`);
      console.log('⚠️  IMPORTANT: Restart Claude Code for the MCP server to become available.\n');
      console.log('After restarting, try:');
      console.log('  - /mariadb - Run database assessment');
      console.log('  - /mariadb-review - Review codebase for MariaDB issues');
    } else {
      console.log('✅ MariaDB MCP server installed');
      console.log('❌ Connection test failed - see error above\n');
      console.log('Configuration saved to:');
      console.log(`  - Server: ${MCP_INSTALL_DIR}`);
      console.log(`  - Config: ${CLAUDE_CONFIG_PATH}`);
    }

    console.log('='.repeat(60));

    process.exit(connectionOk ? 0 : 1);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Helper functions

/**
 * Check if a command exists in PATH
 */
function commandExists(command) {
  try {
    execSync(`command -v ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get version from command output
 */
function getVersion(command, args = ['--version']) {
  try {
    const result = execSync(`${command} ${args.join(' ')}`, { encoding: 'utf8' });
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Check Python version >= 3.11
 */
function checkPythonVersion() {
  const pythonCmd = commandExists('python3') ? 'python3' : 'python';

  if (!commandExists(pythonCmd)) {
    return { ok: false, message: 'Python not found' };
  }

  const versionOutput = getVersion(pythonCmd);
  const match = versionOutput.match(/Python (\d+)\.(\d+)/);

  if (!match) {
    return { ok: false, message: 'Could not parse Python version' };
  }

  const major = parseInt(match[1]);
  const minor = parseInt(match[2]);

  if (major < 3 || (major === 3 && minor < 11)) {
    return {
      ok: false,
      message: `Python ${major}.${minor} found, but 3.11+ required`
    };
  }

  return { ok: true, version: `${major}.${minor}` };
}

/**
 * Check all prerequisites and show installation instructions if missing
 */
function checkPrerequisites() {
  console.log('Checking prerequisites...\n');

  const checks = [];

  // Check Python 3.11+
  const pythonCheck = checkPythonVersion();
  if (!pythonCheck.ok) {
    checks.push({
      name: 'Python 3.11+',
      ok: false,
      instructions: `
${pythonCheck.message}

Python 3.11 or higher is required.

Install from: https://www.python.org/downloads/

After installation, run /mariadb-setup again.
`
    });
  } else {
    console.log(`✅ Python ${pythonCheck.version}`);
  }

  // Check uv
  if (!commandExists('uv')) {
    checks.push({
      name: 'uv',
      ok: false,
      instructions: `
uv is required to install Python dependencies for the MariaDB MCP server.

Install it with:
  curl -LsSf https://astral.sh/uv/install.sh | sh

Or visit: https://docs.astral.sh/uv/getting-started/installation/

After installation, run /mariadb-setup again.
`
    });
  } else {
    console.log(`✅ uv ${getVersion('uv').split('\n')[0]}`);
  }

  // Check git
  if (!commandExists('git')) {
    checks.push({
      name: 'git',
      ok: false,
      instructions: `
git is required to clone the MariaDB MCP server repository.

Install from: https://git-scm.com/downloads

After installation, run /mariadb-setup again.
`
    });
  } else {
    console.log(`✅ git ${getVersion('git').split('\n')[0]}`);
  }

  // Show errors if any
  const failed = checks.filter(c => !c.ok);
  if (failed.length > 0) {
    console.log('\n❌ Missing prerequisites:\n');
    failed.forEach(check => {
      console.log(`--- ${check.name} ---`);
      console.log(check.instructions);
    });
    return false;
  }

  console.log('\n✅ All prerequisites met\n');
  return true;
}

/**
 * Create readline interface for prompts
 */
function createPrompt() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Ask a question and return the answer
 */
function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

/**
 * Test database connection
 */
function testConnection(credentials) {
  console.log('\nTesting database connection...');

  // Create a test Python script
  const testScript = `
import os
import sys

# Set environment variables
os.environ['DB_HOST'] = '${credentials.DB_HOST}'
os.environ['DB_PORT'] = '${credentials.DB_PORT}'
os.environ['DB_USER'] = '${credentials.DB_USER}'
os.environ['DB_PASSWORD'] = '${credentials.DB_PASSWORD}'

try:
    import mysql.connector

    conn = mysql.connector.connect(
        host=os.environ['DB_HOST'],
        port=int(os.environ['DB_PORT']),
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD']
    )

    cursor = conn.cursor()
    cursor.execute('SHOW DATABASES')
    databases = cursor.fetchall()

    conn.close()

    print('SUCCESS')
    sys.exit(0)

except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
`;

  try {
    const result = execSync(
      `uv run python -c "${testScript.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      {
        cwd: MCP_INSTALL_DIR,
        encoding: 'utf8',
        stdio: 'pipe'
      }
    );

    if (result.includes('SUCCESS')) {
      console.log(`✅ Connection test passed - connected to MariaDB at ${credentials.DB_HOST}:${credentials.DB_PORT}`);
      return true;
    } else {
      console.log('❌ Connection test failed: Unexpected response');
      return false;
    }
  } catch (error) {
    const errorOutput = error.stderr || error.message;
    console.log(`❌ Connection test failed: ${errorOutput}`);
    console.log('\nPlease check your connection details and run:');
    console.log('  /mariadb-setup');
    console.log('Select (R)econfigure to update your credentials.');
    return false;
  }
}

/**
 * Update ~/.claude.json with MCP server configuration
 */
function updateClaudeConfig() {
  console.log('\nUpdating Claude Code configuration...');

  let config = {};

  // Read existing config if it exists
  if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
    try {
      const content = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
      config = JSON.parse(content);
    } catch (error) {
      throw new Error(`Cannot parse ${CLAUDE_CONFIG_PATH} - invalid JSON\n\nPlease fix the JSON syntax errors and run /mariadb-setup again.\nYou can validate JSON at: https://jsonlint.com`);
    }
  }

  // Ensure mcpServers object exists
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Add or update mariadb MCP server configuration
  config.mcpServers.mariadb = {
    command: 'uv',
    args: [
      '--directory',
      MCP_INSTALL_DIR,
      'run',
      'mariadb-mcp'
    ]
  };

  // Write back to file
  try {
    fs.writeFileSync(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
    console.log(`✅ Configuration saved to ${CLAUDE_CONFIG_PATH}`);
  } catch (error) {
    throw new Error(`Permission denied writing to ${CLAUDE_CONFIG_PATH}\n\nCheck directory permissions and try again.`);
  }
}

/**
 * Write credentials to .env file
 */
function writeEnvFile(credentials) {
  console.log('\nWriting .env configuration...');

  const envPath = path.join(MCP_INSTALL_DIR, '.env');

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

  try {
    fs.writeFileSync(envPath, content, 'utf8');
    console.log(`✅ Configuration saved to ${envPath}`);
  } catch (error) {
    throw new Error(`Failed to write .env file: ${error.message}`);
  }
}

/**
 * Read existing .env file if it exists
 */
function readExistingEnv() {
  const envPath = path.join(MCP_INSTALL_DIR, '.env');

  if (!fs.existsSync(envPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};

    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });

    return env;
  } catch (error) {
    return {};
  }
}

/**
 * Prompt for database credentials interactively
 */
async function promptForCredentials(rl, existingEnv = {}) {
  console.log('\n--- Database Connection Details ---\n');

  const defaults = {
    DB_HOST: existingEnv.DB_HOST || 'localhost',
    DB_PORT: existingEnv.DB_PORT || '3306',
    DB_USER: existingEnv.DB_USER || 'root',
    DB_PASSWORD: existingEnv.DB_PASSWORD || '',
    MCP_READ_ONLY: existingEnv.MCP_READ_ONLY || 'true'
  };

  const config = {};

  // Prompt for each value
  const host = await question(rl, `MariaDB Host [${defaults.DB_HOST}]: `);
  config.DB_HOST = host || defaults.DB_HOST;

  const port = await question(rl, `MariaDB Port [${defaults.DB_PORT}]: `);
  config.DB_PORT = port || defaults.DB_PORT;

  const user = await question(rl, `MariaDB User [${defaults.DB_USER}]: `);
  config.DB_USER = user || defaults.DB_USER;

  const password = await question(rl, `MariaDB Password [${defaults.DB_PASSWORD ? '****' : ''}]: `);
  config.DB_PASSWORD = password || defaults.DB_PASSWORD;

  // Always set read-only mode to true
  config.MCP_READ_ONLY = 'true';

  return config;
}

/**
 * Clone the MariaDB MCP repository
 */
function cloneRepository() {
  console.log('\nCloning MariaDB MCP server...');

  try {
    // Create parent directory
    const parentDir = path.dirname(MCP_INSTALL_DIR);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Clone repository
    execSync(`git clone ${MARIADB_MCP_REPO} "${MCP_INSTALL_DIR}"`, {
      stdio: 'inherit'
    });

    console.log('✅ Repository cloned');
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error.message}\n\nPlease check your internet connection and try again.\nIf the problem persists, clone manually:\n  git clone ${MARIADB_MCP_REPO} ${MCP_INSTALL_DIR}`);
  }
}

/**
 * Update existing repository
 */
function updateRepository() {
  console.log('\nUpdating MariaDB MCP server code...');

  try {
    execSync('git pull origin main', {
      cwd: MCP_INSTALL_DIR,
      stdio: 'inherit'
    });

    console.log('✅ Repository updated');
  } catch (error) {
    throw new Error(`Failed to update repository: ${error.message}`);
  }
}

/**
 * Install Python dependencies with uv
 */
function installDependencies() {
  console.log('\nInstalling Python dependencies...');

  try {
    execSync('uv sync', {
      cwd: MCP_INSTALL_DIR,
      stdio: 'inherit'
    });

    console.log('✅ Dependencies installed');
  } catch (error) {
    throw new Error(`Failed to install dependencies: ${error.message}\n\nEnsure you have Python 3.11+ and try again.\nCheck the error above for details.`);
  }
}

/**
 * Perform fresh installation
 */
function performFreshInstall() {
  cloneRepository();
  installDependencies();
}

/**
 * Perform update of existing installation
 */
function performUpdate() {
  updateRepository();
  installDependencies();
}

/**
 * Handle existing installation - offer update/reconfigure options
 */
async function handleExistingInstallation(rl) {
  console.log(`Found existing MariaDB MCP installation at ${MCP_INSTALL_DIR}\n`);
  console.log('What would you like to do?');
  console.log('  (U) Update - Pull latest code from GitHub');
  console.log('  (R) Reconfigure - Update connection details');
  console.log('  (B) Both - Update code and reconfigure');
  console.log('  (Re) Reinstall - Delete and reinstall from scratch');
  console.log('  (C) Cancel\n');

  const choice = await question(rl, 'Choice: ');
  const choiceLower = choice.toLowerCase();

  if (choiceLower === 'c' || choiceLower === 'cancel') {
    console.log('\nSetup cancelled.');
    rl.close();
    process.exit(0);
  }

  if (choiceLower === 're' || choiceLower === 'reinstall') {
    const confirm = await question(
      rl,
      `\nThis will delete ${MCP_INSTALL_DIR} and reinstall. Continue? (y/N): `
    );

    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('\nSetup cancelled.');
      rl.close();
      process.exit(0);
    }

    console.log('\nRemoving existing installation...');
    fs.rmSync(MCP_INSTALL_DIR, { recursive: true, force: true });
    return 'fresh';
  }

  if (choiceLower === 'u' || choiceLower === 'update') {
    return 'update';
  }

  if (choiceLower === 'r' || choiceLower === 'reconfigure') {
    return 'reconfigure';
  }

  if (choiceLower === 'b' || choiceLower === 'both') {
    return 'both';
  }

  console.log('\nInvalid choice. Please run /mariadb-setup again.');
  rl.close();
  process.exit(1);
}

main();
