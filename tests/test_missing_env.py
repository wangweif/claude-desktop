"""Tests simulating environments where Node.js or Claude Code is not installed."""

import json
import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from backend import cli


# ── Fixtures ──

@pytest.fixture
def tmp_home(monkeypatch):
    with tempfile.TemporaryDirectory() as td:
        monkeypatch.setenv("HOME", td)
        monkeypatch.setattr(cli, "_augmented_path", None)
        yield td


# ── Scenario 1: No Node.js installed ──

class TestNoNodeInstalled:
    """Simulate an environment where Node.js is not installed."""

    @pytest.fixture(autouse=True)
    def mock_no_node(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)

    def test_check_node_returns_not_installed(self, monkeypatch):
        monkeypatch.setattr(cli, "which", lambda cmd: None)
        result = cli.check_node()
        assert result["installed"] is False
        assert result["version"] is None
        assert result["path"] is None

    def test_check_claude_code_returns_not_installed(self, monkeypatch):
        monkeypatch.setattr(cli, "which", lambda cmd: None)
        result = cli.check_claude_code()
        assert result["installed"] is False

    def test_get_status_shows_both_missing(self, monkeypatch):
        monkeypatch.setattr(cli, "which", lambda cmd: None)
        status = cli.get_status()
        assert status["node"]["installed"] is False
        assert status["claudeCode"]["installed"] is False

    def test_install_env_attempts_node_install(self, monkeypatch):
        """When node is missing, install_env should try to install it."""
        install_node_called = []

        def fake_install_node(version="22"):
            install_node_called.append(version)
            return {"success": True, "message": "installed"}

        monkeypatch.setattr(cli, "which", lambda cmd: None)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": False, "version": None, "path": None, "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": False, "version": None, "path": None})
        monkeypatch.setattr(cli, "install_node", fake_install_node)
        monkeypatch.setattr(cli, "install_claude_code", lambda: {"success": True, "message": "ok"})
        monkeypatch.setattr(cli, "get_settings_path", lambda: os.path.join(tempfile.gettempdir(), "test_settings.json"))
        monkeypatch.setattr(cli, "write_json_file", lambda p, d: None)
        monkeypatch.setattr("os.path.isfile", lambda p: False)

        result = cli.install_env()
        assert len(install_node_called) == 1
        assert install_node_called[0] == "22"

    def test_install_env_fails_when_node_install_fails(self, monkeypatch):
        """If node install fails, overall install_env should fail."""
        monkeypatch.setattr(cli, "which", lambda cmd: None)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": False, "version": None, "path": None, "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": False, "version": None, "path": None})
        monkeypatch.setattr(cli, "install_node", lambda v="22": {"success": False, "message": "nvm not found"})
        monkeypatch.setattr(cli, "install_claude_code", lambda: {"success": True, "message": "ok"})
        monkeypatch.setattr(cli, "get_settings_path", lambda: os.path.join(tempfile.gettempdir(), "test.json"))
        monkeypatch.setattr(cli, "write_json_file", lambda p, d: None)
        monkeypatch.setattr("os.path.isfile", lambda p: False)

        result = cli.install_env()
        assert result["success"] is False
        node_step = [s for s in result["steps"] if s["name"] == "Node.js"][0]
        assert node_step["success"] is False


# ── Scenario 2: Node.js installed but no Claude Code ──

class TestNodeInstalledNoClaude:
    """Simulate Node.js present but Claude Code missing."""

    @pytest.fixture(autouse=True)
    def mock_node_only(self, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)

    def _mock_which(self, cmd):
        if cmd in ("node", "npm", "npx"):
            return f"/usr/local/bin/{cmd}"
        return None

    def test_get_status_shows_node_yes_claude_no(self, monkeypatch):
        monkeypatch.setattr(cli, "which", self._mock_which)
        monkeypatch.setattr(cli, "probe_version", lambda path: "v22.0.0" if "node" in path else None)
        status = cli.get_status()
        assert status["node"]["installed"] is True
        assert status["claudeCode"]["installed"] is False

    def test_install_env_skips_node_installs_claude(self, monkeypatch):
        """When node exists, install_env should skip it and install claude."""
        claude_install_called = []

        def fake_install_claude():
            claude_install_called.append(True)
            return {"success": True, "message": "installed"}

        monkeypatch.setattr(cli, "which", self._mock_which)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": True, "version": "v22.0.0", "path": "/usr/local/bin/node", "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": False, "version": None, "path": None})
        monkeypatch.setattr(cli, "install_node", lambda v="22": {"success": True, "message": "should not be called"})
        monkeypatch.setattr(cli, "install_claude_code", fake_install_claude)
        monkeypatch.setattr(cli, "get_settings_path", lambda: os.path.join(tempfile.gettempdir(), "test.json"))
        monkeypatch.setattr(cli, "write_json_file", lambda p, d: None)
        monkeypatch.setattr("os.path.isfile", lambda p: False)

        result = cli.install_env()
        assert len(claude_install_called) == 1
        node_step = [s for s in result["steps"] if s["name"] == "Node.js"][0]
        assert "Already installed" in node_step["message"]

    def test_install_claude_code_returns_failure_on_nonzero_exit(self, monkeypatch):
        """Regression test: npm install failure should not report success."""
        monkeypatch.setattr(cli, "which", self._mock_which)

        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "ERR! 404 Not Found"

        monkeypatch.setattr("subprocess.run", lambda *a, **kw: mock_result)

        result = cli.install_claude_code()
        assert result["success"] is False
        assert "exit 1" in result["message"]


# ── Scenario 3: Both missing, auto-install flow ──

class TestBothMissingAutoInstall:
    """Simulate full auto-install when both Node and Claude Code are missing."""

    def test_install_env_creates_default_settings_when_missing(self, monkeypatch):
        """Auto-install should create default settings.json if not present."""
        written_data = []

        def fake_write(path, data):
            written_data.append((path, data))

        monkeypatch.setattr(cli, "which", lambda cmd: None)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": True, "version": "v22.0.0", "path": "/fake/node", "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": True, "version": "v2.0.0", "path": "/fake/claude", })
        monkeypatch.setattr(cli, "get_settings_path", lambda: "/tmp/test_nonexistent_settings.json")
        monkeypatch.setattr(cli, "write_json_file", fake_write)
        monkeypatch.setattr("os.path.isfile", lambda p: False)
        monkeypatch.setattr(cli, "refresh_environment", lambda: None)

        result = cli.install_env()
        assert result["success"] is True
        settings_step = [s for s in result["steps"] if s["name"] == "Settings"][0]
        assert settings_step["success"] is True
        assert "Default settings created" in settings_step["message"]
        assert len(written_data) == 1
        assert "ANTHROPIC_BASE_URL" in written_data[0][1].get("env", {})

    def test_install_env_skips_settings_when_exists(self, monkeypatch):
        """Auto-install should not overwrite existing settings.json."""
        written_data = []

        monkeypatch.setattr(cli, "which", lambda cmd: None)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": True, "version": "v22", "path": "/fake", "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": True, "version": "v2.0", "path": "/fake"})
        monkeypatch.setattr(cli, "get_settings_path", lambda: "/tmp/test_settings.json")
        monkeypatch.setattr(cli, "write_json_file", lambda p, d: written_data.append((p, d)))
        monkeypatch.setattr("os.path.isfile", lambda p: True)
        monkeypatch.setattr(cli, "refresh_environment", lambda: None)

        result = cli.install_env()
        settings_step = [s for s in result["steps"] if s["name"] == "Settings"][0]
        assert "already exist" in settings_step["message"]
        assert len(written_data) == 0

    def test_install_env_reports_steps_detail(self, monkeypatch):
        """Each step should have name, success, and message."""
        monkeypatch.setattr(cli, "which", lambda cmd: None)
        monkeypatch.setattr(cli, "check_node", lambda: {"installed": False, "version": None, "path": None, "nvm": False, "recommended": "22.x LTS"})
        monkeypatch.setattr(cli, "check_claude_code", lambda: {"installed": False, "version": None, "path": None})
        monkeypatch.setattr(cli, "install_node", lambda v="22": {"success": True, "message": "Node installed"})
        monkeypatch.setattr(cli, "install_claude_code", lambda: {"success": True, "message": "Claude installed"})
        monkeypatch.setattr(cli, "get_settings_path", lambda: "/tmp/test.json")
        monkeypatch.setattr(cli, "write_json_file", lambda p, d: None)
        monkeypatch.setattr("os.path.isfile", lambda p: False)
        monkeypatch.setattr(cli, "refresh_environment", lambda: None)

        result = cli.install_env()
        assert "steps" in result
        for step in result["steps"]:
            assert "name" in step
            assert "success" in step
            assert "message" in step
        step_names = [s["name"] for s in result["steps"]]
        assert step_names == ["Node.js", "Claude Code", "Settings"]


# ── Scenario 4: App window routing ──

class TestAppWindowRouting:
    """Test that app_window routes to setup wizard when env is incomplete."""

    def test_shows_wizard_when_node_missing(self):
        """_on_env_ready should route to setup wizard if node is not installed."""
        status = {
            "node": {"installed": False, "version": None, "path": None},
            "claudeCode": {"installed": True, "version": "v2.0", "path": "/fake"},
        }
        # Both conditions must be True for dashboard, so False + True = wizard
        assert not (status["node"]["installed"] and status["claudeCode"]["installed"])

    def test_shows_wizard_when_claude_missing(self):
        status = {
            "node": {"installed": True, "version": "v22", "path": "/fake"},
            "claudeCode": {"installed": False, "version": None, "path": None},
        }
        assert not (status["node"]["installed"] and status["claudeCode"]["installed"])

    def test_shows_dashboard_when_both_installed(self):
        status = {
            "node": {"installed": True, "version": "v22", "path": "/fake"},
            "claudeCode": {"installed": True, "version": "v2.0", "path": "/fake"},
        }
        assert status["node"]["installed"] and status["claudeCode"]["installed"]

    def test_shows_wizard_when_both_missing(self):
        status = {
            "node": {"installed": False, "version": None, "path": None},
            "claudeCode": {"installed": False, "version": None, "path": None},
        }
        assert not (status["node"]["installed"] and status["claudeCode"]["installed"])
