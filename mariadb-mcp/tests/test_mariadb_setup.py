import json
import stat as stat_mod
from pathlib import Path
import pexpect
import pytest


INSTALL_DIR_RELATIVE = ".claude/mcp-servers/mariadb"
CLAUDE_JSON = ".claude.json"
FIXTURE_SERVER = Path(__file__).parent / "fixtures" / "mariadb-mcp-server"


def send_and_wait(child, text, next_expect_pattern, timeout=30):
    """Send a line and wait for Claude's next prompt."""
    child.sendline(text)
    child.expect(next_expect_pattern, timeout=timeout)


class TestFreshInstall:
    def test_fresh_install_writes_env_and_config(self, claude_session, tmp_home, fake_bin):
        child = claude_session
        # Wait for claude prompt
        child.expect(r"[>$]", timeout=30)

        # Invoke setup
        child.sendline("/mariadb-setup")

        # Claude should ask for host
        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")

        # Port
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")

        # User
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("testuser")

        # Password
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("testpass")

        # Read-only
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        # Wait for completion signal
        child.expect(r"[Rr]estart", timeout=60)

        # Assert .env written
        install_dir = tmp_home / INSTALL_DIR_RELATIVE
        env_file = install_dir / ".env"
        assert env_file.exists(), ".env file not written"
        env_content = env_file.read_text()
        assert "DB_HOST=localhost" in env_content
        assert "DB_USER=testuser" in env_content
        assert "DB_PASSWORD=testpass" in env_content

        # Assert ~/.claude.json updated
        config = json.loads((tmp_home / CLAUDE_JSON).read_text())
        assert "mariadb" in config.get("mcpServers", {}), "mariadb not in mcpServers"
        mcp_entry = config["mcpServers"]["mariadb"]
        assert "uv" in mcp_entry.get("command", "") or any(
            "uv" in str(a) for a in mcp_entry.get("args", [])
        )


class TestExistingInstall:
    def test_update_preserves_credentials(self, tmp_home_with_install, fake_bin):
        env = {
            "HOME": str(tmp_home_with_install),
            "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", ""),
        }
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("update")

        child.expect(r"[Rr]estart|[Uu]pdat", timeout=60)

        # Credentials unchanged
        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=oldhost" in env_content

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reconfigure_updates_env_only(self, tmp_home_with_install, fake_bin):
        env = {
            "HOME": str(tmp_home_with_install),
            "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", ""),
        }
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reconfigure")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("newhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("newpass")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        child.expect(r"[Rr]estart|[Ss]aved", timeout=60)

        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=newhost" in env_content
        assert "DB_PASSWORD=newpass" in env_content

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reinstall_confirm_deletes_and_reinstalls(self, tmp_home_with_install, fake_bin):
        env = {
            "HOME": str(tmp_home_with_install),
            "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", ""),
        }
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reinstall")

        # Claude should ask for confirmation mentioning the path
        child.expect(r"[Dd]elete|[Pp]ermanent|[Ss]ure", timeout=30)
        child.sendline("yes")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        child.expect(r"[Rr]estart", timeout=60)

        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        assert install_dir.exists(), "Install dir should be recreated"
        assert (install_dir / ".env").exists(), ".env should be written"

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)

    def test_reinstall_cancel_does_nothing(self, tmp_home_with_install, fake_bin):
        env = {
            "HOME": str(tmp_home_with_install),
            "PATH": str(fake_bin) + ":" + __import__("os").environ.get("PATH", ""),
        }
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Uu]pdate|[Rr]econfigure|[Ee]xisting", timeout=30)
        child.sendline("reinstall")

        child.expect(r"[Ss]ure|[Cc]onfirm|[Dd]elete", timeout=30)
        child.sendline("no")

        child.expect(r"[Cc]ancel|[Aa]bort|[Nn]othing", timeout=30)

        # Install dir unchanged
        install_dir = tmp_home_with_install / INSTALL_DIR_RELATIVE
        env_content = (install_dir / ".env").read_text()
        assert "DB_HOST=oldhost" in env_content, "Credentials should be unchanged"

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)


class TestConnectionFailure:
    def test_connection_fail_reports_error(self, tmp_home, tmp_path):
        """When uv run returns failure, Claude should report error (config still written)."""
        bin_dir = tmp_path / "bin"
        bin_dir.mkdir()

        git = bin_dir / "git"
        git.write_text(f"""#!/bin/bash
cp -r "{FIXTURE_SERVER}/." "${{@: -1}}"
exit 0
""")
        git.chmod(git.stat().st_mode | stat_mod.S_IEXEC)

        uv = bin_dir / "uv"
        uv.write_text("""#!/bin/bash
if [[ "$1" == "sync" ]]; then echo "Resolved"; exit 0; fi
# Simulate connection failure
echo "ERROR: Connection refused" >&2
exit 1
""")
        uv.chmod(uv.stat().st_mode | stat_mod.S_IEXEC)

        env = {
            "HOME": str(tmp_home),
            "PATH": str(bin_dir) + ":" + __import__("os").environ.get("PATH", ""),
        }
        child = pexpect.spawn("claude", env=env, timeout=60, encoding="utf8")

        child.expect(r"[>$]", timeout=30)
        child.sendline("/mariadb-setup")

        child.expect(r"[Hh]ost", timeout=30)
        child.sendline("localhost")
        child.expect(r"[Pp]ort", timeout=30)
        child.sendline("3306")
        child.expect(r"[Uu]ser", timeout=30)
        child.sendline("root")
        child.expect(r"[Pp]ass", timeout=30)
        child.sendline("")
        child.expect(r"[Rr]ead.only", timeout=30)
        child.sendline("yes")

        # Claude should report connection failure
        child.expect(r"[Ff]ail|[Ee]rror|[Rr]econfigur", timeout=60)

        # Config should still be written
        install_dir = tmp_home / INSTALL_DIR_RELATIVE
        assert (
            install_dir / ".env"
        ).exists(), ".env should be written even on connection failure"
        config = json.loads((tmp_home / CLAUDE_JSON).read_text())
        assert "mariadb" in config.get("mcpServers", {})

        if child.isalive():
            child.sendline("/exit")
            child.expect(pexpect.EOF, timeout=10)
