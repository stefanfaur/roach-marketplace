# MariaDB Setup Command Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Create `/mariadb-setup` command to automate installation and configuration of the MariaDB MCP server with interactive prompts, prerequisite checking, update/reconfigure flows, and connection testing.

**Architecture:** Node.js script (`scripts/setup.js`) invoked by command markdown file. Script handles: prerequisite detection, git operations, uv package management, interactive readline prompts, .env generation, ~/.claude.json updates, and MySQL connection testing. Follows existing roach hook patterns (no external deps, CommonJS, sync operations).

**Tech Stack:** Node.js built-in modules (fs, child_process, readline, path, os), MariaDB MCP server (Python/uv), git

---

### Task 1: Create Command Markdown File

**Files:**
- Create: `mariadb-mcp/commands/mariadb-setup.md`

**Step 1: Create the command definition file**

Create `mariadb-mcp/commands/mariadb-setup.md`:

```markdown
---
name: mariadb-setup
description: Install and configure the MariaDB MCP server
model: sonnet
---

# MariaDB MCP Server Setup

This command automates installation and configuration of the MariaDB MCP server.

## What it does

- Checks prerequisites (Python 3.11+, uv, git)
- Detects existing installations at ~/.claude/mcp-servers/mariadb/
- Clones or updates the MariaDB MCP repository
- Prompts for database connection details interactively
- Generates .env configuration file
- Updates ~/.claude.json with MCP server configuration
- Tests the database connection
- Displays next steps

## Usage

Run this command to install, update, or reconfigure the MariaDB MCP server.

If an existing installation is detected, you'll be offered options to:
- (U) Update code from GitHub
- (R) Reconfigure connection details
- (B) Both update and reconfigure
- (Re) Reinstall from scratch
- (C) Cancel

## Implementation

The command executes: `node ${CLAUDE_PLUGIN_ROOT}/scripts/setup.js`
```

**Step 2: Verify the file was created**

Run: `cat mariadb-mcp/commands/mariadb-setup.md`

Expected: File exists with content above

---

### Task 2: Create Setup Script Scaffold

**Files:**
- Create: `mariadb-mcp/scripts/setup.js`

**Step 1: Create scripts directory and setup.js**

```bash
mkdir -p mariadb-mcp/scripts
```

Create `mariadb-mcp/scripts/setup.js`:

```javascript
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

// Main execution
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

  try {
    // TODO: Check prerequisites
    // TODO: Detect existing installation
    // TODO: Install or update
    // TODO: Configure
    // TODO: Test connection

    console.log('\n✅ Setup placeholder - implementation coming soon');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}

// Helper functions will be added here

main();
```

**Step 2: Make the script executable**

Run: `chmod +x mariadb-mcp/scripts/setup.js`

**Step 3: Test the scaffold runs**

Run: `node mariadb-mcp/scripts/setup.js`

Expected: Prints "=== MariaDB MCP Server Setup ===" and "Setup placeholder" then exits 0

---

### Task 3: Implement Prerequisite Checks

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add prerequisite checking functions**

Add these functions before `main()` in `mariadb-mcp/scripts/setup.js`:

```javascript
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
```

**Step 2: Update main() to call checkPrerequisites**

Replace the TODO comment in `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

  try {
    // Check prerequisites
    if (!checkPrerequisites()) {
      process.exit(1);
    }

    // TODO: Detect existing installation
    // TODO: Install or update
    // TODO: Configure
    // TODO: Test connection

    console.log('\n✅ Prerequisites check passed');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test prerequisite checking**

Run: `node mariadb-mcp/scripts/setup.js`

Expected: Shows checkmarks for Python, uv, git (or error messages if missing)

**Step 4: Test with missing prerequisite (simulate)**

Temporarily modify `checkPrerequisites()` to force a failure:

```javascript
// Add this at start of checkPrerequisites() for testing
// checks.push({ name: 'test-tool', ok: false, instructions: 'Test missing tool' });
```

Run: `node mariadb-mcp/scripts/setup.js`

Expected: Shows "❌ Missing prerequisites" and instructions

Remove the test line after verification.

---

### Task 4: Implement Existing Installation Detection

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add installation detection and update flow functions**

Add these functions before `main()`:

```javascript
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
```

**Step 2: Update main() to detect existing installation**

Replace the TODO in `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

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

    console.log(`\nMode: ${mode}`);
    rl.close();

    // TODO: Install or update based on mode
    // TODO: Configure
    // TODO: Test connection

    console.log('\n✅ Detection complete');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test existing installation detection**

Create a test directory:
```bash
mkdir -p ~/.claude/mcp-servers/mariadb
```

Run: `node mariadb-mcp/scripts/setup.js`

Expected: Shows "Found existing MariaDB MCP installation" and prompts for choice

Test each option (U, R, B, Re with confirmation, C)

Remove test directory:
```bash
rm -rf ~/.claude/mcp-servers/mariadb
```

---

### Task 5: Implement Fresh Installation Flow

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add installation functions**

Add these functions before `main()`:

```javascript
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
```

**Step 2: Update main() to call installation functions**

Update `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

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

    // TODO: Configure (prompt for credentials)
    // TODO: Test connection

    rl.close();
    console.log('\n✅ Installation complete');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test fresh installation**

Ensure `~/.claude/mcp-servers/mariadb/` does NOT exist:
```bash
rm -rf ~/.claude/mcp-servers/mariadb
```

Run: `node mariadb-mcp/scripts/setup.js`

Expected:
- Prerequisites pass
- Clones repository to `~/.claude/mcp-servers/mariadb/`
- Runs `uv sync` to install dependencies
- Shows "✅ Installation complete"

Verify:
```bash
ls ~/.claude/mcp-servers/mariadb/
```
Expected: See `server.py`, `config.py`, `pyproject.toml`, etc.

**Step 4: Test update flow**

Run: `node mariadb-mcp/scripts/setup.js`

Expected:
- Detects existing installation
- Prompt appears - choose (U) Update
- Runs `git pull` and `uv sync`
- Shows "✅ Installation complete"

---

### Task 6: Implement Interactive Credential Prompts

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add credential prompting functions**

Add these functions before `main()`:

```javascript
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
```

**Step 2: Update main() to prompt for credentials**

Update `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

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
    let credentials = null;
    if (mode === 'fresh' || mode === 'reconfigure' || mode === 'both') {
      const existingEnv = mode === 'fresh' ? {} : readExistingEnv();
      credentials = await promptForCredentials(rl, existingEnv);
    }

    console.log('\nConfiguration:', credentials);

    // TODO: Write .env file
    // TODO: Update ~/.claude.json
    // TODO: Test connection

    rl.close();
    console.log('\n✅ Setup progress');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test credential prompts**

Run: `node mariadb-mcp/scripts/setup.js`

If fresh install:
- Enter credentials interactively
- Press Enter to accept defaults
- Verify credentials object is logged

If existing install, choose (R) Reconfigure:
- Should show existing values as defaults
- Override or accept existing values
- Verify new credentials are logged

---

### Task 7: Implement .env File Generation

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add .env writing function**

Add this function before `main()`:

```javascript
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
```

**Step 2: Update main() to write .env**

Update `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

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
      const credentials = await promptForCredentials(rl, existingEnv);
      writeEnvFile(credentials);
    }

    // TODO: Update ~/.claude.json
    // TODO: Test connection

    rl.close();
    console.log('\n✅ Configuration written');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test .env file generation**

Run: `node mariadb-mcp/scripts/setup.js`

Choose fresh install or reconfigure, enter credentials.

Verify:
```bash
cat ~/.claude/mcp-servers/mariadb/.env
```

Expected: File contains DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, MCP_READ_ONLY with entered values

---

### Task 8: Implement ~/.claude.json Configuration Update

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add ~/.claude.json update function**

Add this function before `main()`:

```javascript
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
```

**Step 2: Update main() to call updateClaudeConfig**

Update `main()`:

```javascript
async function main() {
  console.log('=== MariaDB MCP Server Setup ===\n');

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
      const credentials = await promptForCredentials(rl, existingEnv);
      writeEnvFile(credentials);
    }

    // Update Claude Code configuration
    updateClaudeConfig();

    // TODO: Test connection

    rl.close();
    console.log('\n✅ Claude Code configured');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
```

**Step 3: Test ~/.claude.json update**

Backup existing config if present:
```bash
cp ~/.claude.json ~/.claude.json.backup
```

Run: `node mariadb-mcp/scripts/setup.js`

Complete the setup flow.

Verify:
```bash
cat ~/.claude.json
```

Expected: JSON contains:
```json
{
  "mcpServers": {
    "mariadb": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/username/.claude/mcp-servers/mariadb",
        "run",
        "mariadb-mcp"
      ]
    }
  }
}
```

Other existing content should be preserved.

Restore backup:
```bash
mv ~/.claude.json.backup ~/.claude.json
```

---

### Task 9: Implement Connection Testing

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add connection testing function**

Add this function before `main()`:

```javascript
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
```

**Step 2: Update main() to test connection**

Update `main()`:

```javascript
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
```

**Step 3: Test connection testing**

Run: `node mariadb-mcp/scripts/setup.js`

**With correct credentials:**
Expected: "✅ Connection test passed" and success message

**With incorrect credentials (e.g., wrong password):**
Expected: "❌ Connection test failed" with MySQL error details

---

### Task 10: Add Signal Handling for Ctrl+C

**Files:**
- Modify: `mariadb-mcp/scripts/setup.js`

**Step 1: Add signal handler at the top of the file**

Add this after the constants and before `main()`:

```javascript
// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\nSetup cancelled by user.');
  process.exit(130);
});
```

**Step 2: Test signal handling**

Run: `node mariadb-mcp/scripts/setup.js`

During a prompt, press Ctrl+C

Expected: Shows "Setup cancelled by user." and exits cleanly

---

### Task 11: Integration Testing

**Files:**
- Test: `mariadb-mcp/scripts/setup.js`

**Step 1: Test complete fresh installation flow**

Prerequisites:
- Ensure MariaDB is running locally (or use remote instance)
- Remove existing installation: `rm -rf ~/.claude/mcp-servers/mariadb`
- Backup ~/.claude.json: `cp ~/.claude.json ~/.claude.json.backup`

Run: `node mariadb-mcp/scripts/setup.js`

Actions:
1. Verify prerequisites pass
2. No existing installation detected
3. Repository clones successfully
4. Dependencies install with `uv sync`
5. Enter valid MariaDB credentials
6. .env file created
7. ~/.claude.json updated
8. Connection test passes
9. Success message displayed

Verify:
- `ls ~/.claude/mcp-servers/mariadb/` shows repo files
- `cat ~/.claude/mcp-servers/mariadb/.env` shows credentials
- `cat ~/.claude.json` shows mariadb MCP server config
- Exit code is 0

**Step 2: Test update flow**

Run: `node mariadb-mcp/scripts/setup.js`

Actions:
1. Detects existing installation
2. Choose (U) Update
3. Runs git pull and uv sync
4. Keeps existing .env
5. Updates ~/.claude.json
6. Connection test passes with existing credentials

**Step 3: Test reconfigure flow**

Run: `node mariadb-mcp/scripts/setup.js`

Actions:
1. Detects existing installation
2. Choose (R) Reconfigure
3. Shows existing credentials as defaults
4. Enter new credentials (or keep same)
5. Overwrites .env
6. Connection test runs with new credentials

**Step 4: Test reinstall flow**

Run: `node mariadb-mcp/scripts/setup.js`

Actions:
1. Detects existing installation
2. Choose (Re) Reinstall
3. Confirms deletion
4. Removes ~/.claude/mcp-servers/mariadb/
5. Performs fresh install
6. All steps complete successfully

**Step 5: Test error scenarios**

Test missing prerequisite:
- Temporarily rename `uv` command
- Run setup
- Expected: Shows uv installation instructions and exits

Test invalid credentials:
- Run setup with wrong MariaDB password
- Expected: Connection test fails with clear error

Test malformed ~/.claude.json:
- Manually corrupt ~/.claude.json (add syntax error)
- Run setup
- Expected: Shows JSON parse error with validation link

Restore:
```bash
mv ~/.claude.json.backup ~/.claude.json
```

---

### Task 12: Update Marketplace Manifest

**Files:**
- Modify: `.claude-plugin/marketplace.json`

**Step 1: Add setup command to plugin.json**

Read the current mariadb-mcp plugin.json:

```bash
cat mariadb-mcp/.claude-plugin/plugin.json
```

Note: The plugin.json doesn't explicitly list commands (they're discovered from the commands/ directory), so no change needed there.

Verify commands are discovered:
```bash
ls mariadb-mcp/commands/
```

Expected: Shows mariadb.md, mariadb-review.md, mariadb-setup.md

**Step 2: Verify marketplace.json entry**

Read:
```bash
cat .claude-plugin/marketplace.json
```

Verify the mariadb-mcp entry exists and version is correct. No changes needed unless version should be bumped.

---

### Task 13: Update README Documentation

**Files:**
- Modify: `mariadb-mcp/README.md`

**Step 1: Add setup command section to README**

Read the current README:
```bash
cat mariadb-mcp/README.md
```

Add a new section after the existing content (before "Available skill, commands"):

```markdown
## Quick Start

### 1. Install and Configure

Run the setup command to automatically install and configure the MariaDB MCP server:

```
/mariadb-setup
```

The setup command will:
- Check prerequisites (Python 3.11+, uv, git)
- Clone the MariaDB MCP server to `~/.claude/mcp-servers/mariadb/`
- Install Python dependencies
- Prompt for your MariaDB connection details
- Generate configuration files
- Update `~/.claude.json` with MCP server settings
- Test the database connection

After setup completes, restart Claude Code to activate the MCP server.

### 2. Update or Reconfigure

Run `/mariadb-setup` again to:
- (U) Update to the latest version from GitHub
- (R) Reconfigure connection details
- (B) Both update and reconfigure
- (Re) Reinstall from scratch

### Manual Setup (Alternative)

If you prefer manual installation, follow these steps:

```

Continue with the existing "Prerequisites" section and manual setup instructions.

Update the "Available skill, commands" section to include `/mariadb-setup`:

```markdown
## Available Commands

- `/mariadb-setup` - Install and configure the MariaDB MCP server
- `/mariadb` - Run database assessment
- `/mariadb-review` - Review codebase for MariaDB issues
```

**Step 2: Verify README is updated**

Read:
```bash
cat mariadb-mcp/README.md
```

Verify the new Quick Start section is present and all commands are documented.

---

### Task 14: Final Verification and Commit

**Files:**
- Verify: All modified files
- Commit: Implementation

**Step 1: Verify all files are in place**

Check command file exists:
```bash
cat mariadb-mcp/commands/mariadb-setup.md
```

Check setup script exists and is executable:
```bash
ls -lh mariadb-mcp/scripts/setup.js
```

Check README is updated:
```bash
grep -A 5 "Quick Start" mariadb-mcp/README.md
```

**Step 2: Test the complete flow one more time**

Clean slate:
```bash
rm -rf ~/.claude/mcp-servers/mariadb
cp ~/.claude.json ~/.claude.json.backup
```

Run: `node mariadb-mcp/scripts/setup.js`

Complete full fresh installation with valid credentials.

Verify:
- ✅ Prerequisites pass
- ✅ Repository cloned
- ✅ Dependencies installed
- ✅ Credentials prompted
- ✅ .env file created
- ✅ ~/.claude.json updated
- ✅ Connection test passes
- ✅ Success message shown

**Step 3: Test in Claude Code**

Start Claude Code and run:
```
/mariadb-setup
```

Verify it executes the script successfully.

After restart, verify MariaDB MCP tools are available in session-start message.

**Step 4: Commit the implementation**

```bash
git add mariadb-mcp/commands/mariadb-setup.md
git add mariadb-mcp/scripts/setup.js
git add mariadb-mcp/README.md
git commit -m "Add /mariadb-setup command for automated MCP server installation

- Interactive setup with prerequisite checks
- Support for fresh install, update, reconfigure, and reinstall
- Automatic .env generation and ~/.claude.json configuration
- Connection testing with clear error messages
- Comprehensive documentation in README"
```

---

## Execution Notes

- All interactive prompts use Node.js readline for cross-platform compatibility
- Error messages include actionable next steps and relevant documentation links
- The script handles Ctrl+C gracefully to avoid partial installations
- Connection testing validates credentials before declaring success
- Existing installations are preserved and only modified when explicitly requested

## Dependency Graph

```
Task 1 (command file)
  └─> Task 2 (script scaffold)
        └─> Task 3 (prerequisites)
              └─> Task 4 (detection)
                    └─> Task 5 (installation)
                          └─> Task 6 (prompts)
                                └─> Task 7 (.env)
                                      └─> Task 8 (claude.json)
                                            └─> Task 9 (connection test)
                                                  └─> Task 10 (signals)
                                                        └─> Task 11 (integration tests)
                                                              └─> Task 12 (marketplace)
                                                                    └─> Task 13 (README)
                                                                          └─> Task 14 (commit)
```
