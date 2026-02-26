import os
import shutil
import json
import stat
from pathlib import Path
import pytest
import pexpect

PLUGIN_ROOT = Path(__file__).parent.parent
FIXTURE_SERVER = Path(__file__).parent / "fixtures" / "mariadb-mcp-server"


@pytest.fixture
def tmp_home(tmp_path):
    """Isolated HOME directory per test."""
    home = tmp_path / "home"
    home.mkdir()
    # Minimal ~/.claude.json with no mariadb entry
    (home / ".claude.json").write_text(json.dumps({"mcpServers": {}}))
    return home


@pytest.fixture
def tmp_home_with_install(tmp_home):
    """HOME with an existing mariadb MCP installation."""
    install_dir = tmp_home / ".claude" / "mcp-servers" / "mariadb"
    install_dir.mkdir(parents=True)
    shutil.copytree(FIXTURE_SERVER, install_dir, dirs_exist_ok=True)
    # Write a pre-existing .env
    (install_dir / ".env").write_text(
        "DB_HOST=oldhost\nDB_PORT=3306\nDB_USER=root\nDB_PASSWORD=oldpass\nMCP_READ_ONLY=true\n"
    )
    # Update .claude.json to include mariadb entry
    config = json.loads((tmp_home / ".claude.json").read_text())
    config["mcpServers"]["mariadb"] = {
        "command": "uv",
        "args": ["--directory", str(install_dir), "run", "mariadb-mcp"],
    }
    (tmp_home / ".claude.json").write_text(json.dumps(config))
    return tmp_home


@pytest.fixture
def fake_bin(tmp_path):
    """Fake git and uv binaries that simulate success without network."""
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()

    git = bin_dir / "git"
    git.write_text(f"""#!/bin/bash
if [[ "$1" == "clone" ]]; then
    cp -r "{FIXTURE_SERVER}/." "${{@: -1}}"
elif [[ "$1" == "pull" ]]; then
    echo "Already up to date."
fi
exit 0
""")
    git.chmod(git.stat().st_mode | stat.S_IEXEC)

    uv = bin_dir / "uv"
    uv.write_text("""#!/bin/bash
if [[ "$1" == "sync" ]]; then
    echo "Resolved"
elif [[ "$1" == "run" ]]; then
    # Simulate successful DB connection test
    echo "SUCCESS"
fi
exit 0
""")
    uv.chmod(uv.stat().st_mode | stat.S_IEXEC)

    return bin_dir


@pytest.fixture
def claude_session(tmp_home, fake_bin):
    """Spawn claude in interactive mode with isolated HOME and fake binaries."""
    env = os.environ.copy()
    env["HOME"] = str(tmp_home)
    env["PATH"] = str(fake_bin) + ":" + env.get("PATH", "")

    child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")
    child.logfile_read = open(tmp_home / "pexpect.log", "w")  # debug log
    yield child

    if child.isalive():
        child.sendline("/exit")
        child.expect(pexpect.EOF, timeout=10)
    child.logfile_read.close()
