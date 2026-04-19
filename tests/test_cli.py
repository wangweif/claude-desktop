"""Tests for backend.cli — core business logic."""

import json
import os
import tempfile

import pytest

from backend import cli


# ── Fixtures ──

@pytest.fixture
def tmp_home(monkeypatch):
    """Redirect HOME to a temp dir so tests don't touch real config."""
    with tempfile.TemporaryDirectory() as td:
        monkeypatch.setenv("HOME", td)
        monkeypatch.setattr(cli, "_augmented_path", None)
        yield td


# ── Path helpers ──

class TestWhich:
    def test_finds_existing_command(self):
        result = cli.which("python3")
        assert result is not None
        assert "python3" in result

    def test_returns_none_for_missing(self):
        result = cli.which("nonexistent_binary_xyz_123")
        assert result is None


class TestGetClaudePath:
    def test_returns_path_or_none(self):
        result = cli.get_claude_path()
        assert result is None or "claude" in result


class TestGetAugmentedPath:
    def test_contains_standard_dirs(self):
        path = cli.get_augmented_path()
        assert "/usr/local/bin" in path or "/opt/homebrew/bin" in path

    def test_refresh_resets_cache(self):
        p1 = cli.get_augmented_path()
        cli.refresh_environment()
        p2 = cli.get_augmented_path()
        assert p1 == p2  # same machine, same result


# ── JSON helpers ──

class TestJsonHelpers:
    def test_read_json_file_missing(self):
        result = cli.read_json_file("/nonexistent/path/file.json")
        assert result is None

    def test_read_json_file_invalid(self, tmp_path):
        f = tmp_path / "bad.json"
        f.write_text("not json{")
        result = cli.read_json_file(str(f))
        assert result is None

    def test_write_and_read_json(self, tmp_path):
        data = {"key": "value", "nested": [1, 2, 3]}
        path = str(tmp_path / "test.json")
        cli.write_json_file(path, data)
        result = cli.read_json_file(path)
        assert result == data

    def test_write_creates_parent_dirs(self, tmp_path):
        path = str(tmp_path / "deep" / "nested" / "file.json")
        cli.write_json_file(path, {"ok": True})
        assert os.path.isfile(path)


# ── Settings ──

class TestSettings:
    def test_read_settings_structure(self):
        result = cli.read_settings()
        assert "data" in result
        assert "path" in result

    def test_write_and_read_settings(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        test_settings = {"env": {"TEST_KEY": "test_value"}, "mcpServers": {}}
        result = cli.write_settings(test_settings)
        assert result["success"] is True

        read_back = cli.read_settings()
        assert read_back["data"]["env"]["TEST_KEY"] == "test_value"

    def test_write_settings_to_missing_dir(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        # .claude dir may not exist yet
        result = cli.write_settings({"env": {}, "mcpServers": {}})
        assert result["success"] is True


# ── MCP ──

class TestMcpServers:
    def test_install_and_list(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        # Write a base settings file first
        cli.write_json_file(cli.get_settings_path(), {"env": {}, "mcpServers": {}})

        config = {"command": "test-cmd", "args": ["-y", "test-pkg"]}
        result = cli.install_mcp_server("test-server", config)
        assert result["success"] is True

        servers = cli.check_mcp_servers()
        names = [s["name"] for s in servers]
        assert "test-server" in names

    def test_install_duplicate(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        cli.write_json_file(cli.get_settings_path(), {"env": {}, "mcpServers": {}})

        config = {"command": "cmd", "args": []}
        cli.install_mcp_server("dup", config)
        result = cli.install_mcp_server("dup", config)
        assert result["success"] is True  # overwrites, no error

    def test_uninstall_existing(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        cli.write_json_file(cli.get_settings_path(), {"env": {}, "mcpServers": {"rm-me": {"command": "x"}}})

        result = cli.uninstall_mcp_server("rm-me")
        assert result["success"] is True
        servers = cli.check_mcp_servers()
        assert all(s["name"] != "rm-me" for s in servers)

    def test_uninstall_nonexistent(self, tmp_home, monkeypatch):
        monkeypatch.setattr(cli, "_augmented_path", None)
        cli.write_json_file(cli.get_settings_path(), {"env": {}, "mcpServers": {}})

        result = cli.uninstall_mcp_server("ghost")
        assert result["success"] is False


# ── Node / Claude Code detection ──

class TestCheckNode:
    def test_returns_expected_keys(self):
        result = cli.check_node()
        assert "installed" in result
        assert "version" in result
        assert "path" in result
        assert "nvm" in result
        assert "recommended" in result


class TestCheckClaudeCode:
    def test_returns_expected_keys(self):
        result = cli.check_claude_code()
        assert "installed" in result
        assert "version" in result
        assert "path" in result


# ── Status ──

class TestGetStatus:
    def test_returns_all_keys(self):
        result = cli.get_status()
        expected_keys = {"node", "claudeCode", "wechatAcp", "mcpServers", "settingsPath", "claudeDir"}
        assert expected_keys.issubset(result.keys())


# ── Doctor ──

class TestRunDoctor:
    def test_returns_results_list(self):
        output = []
        result = cli.run_doctor(on_output=output.append)
        assert "success" in result
        assert "results" in result
        assert len(result["results"]) > 0
        assert len(output) > 0  # output callback was called

    def test_each_result_has_required_fields(self):
        result = cli.run_doctor()
        for r in result["results"]:
            assert "check" in r
            assert "status" in r
            assert "message" in r
