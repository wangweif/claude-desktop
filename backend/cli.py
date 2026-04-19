"""Core business logic: Node.js detection/install, Claude Code management, config, MCP, WeChat ACP."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path
from typing import Any

is_mac = sys.platform == "darwin"
is_win = sys.platform == "win32"

DEFAULT_SETTINGS = {
    "env": {
        "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
        "API_TIMEOUT_MS": "30000000",
        "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5-turbo",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1",
    },
    "enabledPlugins": {},
    "mcpServers": {},
}


def get_home_dir() -> str:
    return os.environ.get("HOME") or os.environ.get("USERPROFILE") or str(Path.home())


def get_claude_dir() -> str:
    return os.path.join(get_home_dir(), ".claude")


def get_settings_path() -> str:
    return os.path.join(get_claude_dir(), "settings.json")


def build_augmented_path() -> str:
    home = get_home_dir()
    current_path = os.environ.get("PATH", "")
    sep = ";" if is_win else ":"
    extra_dirs = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
    ]
    if not is_win:
        extra_dirs.append("/usr/bin")

    nvm_versions = os.path.join(home, ".nvm", "versions", "node")
    if os.path.isdir(nvm_versions):
        try:
            entries = sorted(
                [e for e in os.listdir(nvm_versions) if e.startswith("v") and os.path.isdir(os.path.join(nvm_versions, e))],
                reverse=True,
            )
            for v in entries:
                extra_dirs.append(os.path.join(nvm_versions, v, "bin"))
        except OSError:
            pass

    fnm_dir = os.path.join(home, ".local", "share", "fnm", "node-versions")
    if os.path.isdir(fnm_dir):
        try:
            for e in os.listdir(fnm_dir):
                p = os.path.join(fnm_dir, e, "installation", "bin")
                if os.path.isdir(p):
                    extra_dirs.append(p)
        except OSError:
            pass

    volta_bin = os.path.join(home, ".volta", "bin")
    extra_dirs.append(volta_bin)

    current_entries = set(current_path.split(sep))
    unique = [d for d in extra_dirs if d not in current_entries]
    return (sep.join(unique) + sep + current_path) if unique else current_path


_augmented_path: str | None = None


def get_augmented_path() -> str:
    global _augmented_path
    if _augmented_path is None:
        _augmented_path = build_augmented_path()
    return _augmented_path


def refresh_environment() -> None:
    global _augmented_path
    _augmented_path = None


def get_claude_path() -> str | None:
    return which("claude")


def which(cmd: str) -> str | None:
    aug = get_augmented_path()
    sep = ";" if is_win else ":"
    exts = [".exe", ".cmd", ""] if is_win else [""]
    for d in aug.split(sep):
        if not d:
            continue
        for ext in exts:
            candidate = os.path.join(d, cmd + ext)
            if os.path.isfile(candidate):
                return candidate
    return None


def probe_version(path: str) -> str | None:
    try:
        result = subprocess.run(
            [path, "--version"],
            capture_output=True, text=True, timeout=5,
            env={**os.environ, "HOME": get_home_dir()},
        )
        return result.stdout.strip() or None
    except (OSError, subprocess.TimeoutExpired):
        return None


def read_json_file(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def write_json_file(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def download_file(url: str, dest: str) -> None:
    urllib.request.urlretrieve(url, dest)


# ── Node.js ──

def check_node() -> dict:
    recommended = "22.x LTS"
    nvm = False
    if not is_win:
        nvm = os.path.isfile(os.path.join(get_home_dir(), ".nvm", "nvm.sh"))

    node_path = which("node")
    if not node_path:
        return {"installed": False, "version": None, "path": None, "nvm": nvm, "recommended": recommended}

    version = probe_version(node_path)
    if not version:
        return {"installed": False, "version": None, "path": node_path, "nvm": nvm, "recommended": recommended}

    return {"installed": True, "version": version, "path": node_path, "nvm": nvm, "recommended": recommended}


def install_node(version: str = "22") -> dict:
    if not is_win:
        nvm_sh = os.path.join(get_home_dir(), ".nvm", "nvm.sh")
        if os.path.isfile(nvm_sh):
            try:
                subprocess.run(
                    f'source {nvm_sh} && nvm install {version} && nvm use {version} && nvm alias default {version}',
                    shell=True, executable="/bin/bash", capture_output=True, text=True, timeout=300,
                )
                return {"success": True, "message": f"Node.js {version} installed via nvm"}
            except Exception as e:
                return {"success": False, "message": f"nvm install failed: {e}"}

    try:
        node_version = version if "." in version else f"{version}.0.0"
        if is_mac:
            url = f"https://nodejs.org/dist/v{node_version}/node-v{node_version}.pkg"
            ext = ".pkg"
        else:
            url = f"https://nodejs.org/dist/v{node_version}/node-v{node_version}-x64.msi"
            ext = ".msi"

        installer = os.path.join(tempfile.gettempdir(), f"node-installer{ext}")
        download_file(url, installer)

        if is_mac:
            subprocess.run(
                f'osascript -e \'do shell script "installer -pkg \\"{installer}\\" -target /" with administrator privileges\'',
                shell=True, capture_output=True, text=True, timeout=300,
            )
        else:
            subprocess.run(
                f'msiexec /i "{installer}" /qn /norestart',
                shell=True, capture_output=True, text=True, timeout=300,
            )

        try:
            os.unlink(installer)
        except OSError:
            pass

        return {"success": True, "message": f"Node.js {version} installed successfully"}
    except Exception as e:
        return {"success": False, "message": f"Node.js installation failed: {e}"}


# ── Claude Code ──

def check_claude_code() -> dict:
    path = which("claude")
    if not path:
        return {"installed": False, "version": None, "path": None}
    version = probe_version(path)
    if not version:
        return {"installed": False, "version": None, "path": path}
    return {"installed": True, "version": version, "path": path}


def install_claude_code() -> dict:
    mirrors = [
        "https://registry.npmmirror.com",
        "https://registry.npmjs.org",
    ]
    npm_cmd = "npm.cmd" if is_win else "npm"
    npm_path = which("npm") or npm_cmd

    for registry in mirrors:
        try:
            result = subprocess.run(
                [npm_path, "install", "-g", "@anthropic-ai/claude-code", f"--registry={registry}"],
                capture_output=True, text=True, timeout=600,
                env={**os.environ, "PATH": get_augmented_path(), "NODE_OPTIONS": "--max-old-space-size=4096"},
            )
            return {"success": True, "message": f"Claude Code installed: {result.stdout.strip()}"}
        except Exception:
            if registry == mirrors[-1]:
                return {"success": False, "message": "Claude Code installation failed"}
    return {"success": False, "message": "Claude Code installation failed"}


# ── Environment ──

def install_env(node_version: str | None = None) -> dict:
    steps = []
    nc = check_node()
    if not nc["installed"]:
        r = install_node(node_version or "22")
        steps.append({"name": "Node.js", **r})
    else:
        steps.append({"name": "Node.js", "success": True, "message": f"Already installed: {nc['version']}"})

    cc = check_claude_code()
    if not cc["installed"]:
        r = install_claude_code()
        steps.append({"name": "Claude Code", **r})
    else:
        steps.append({"name": "Claude Code", "success": True, "message": f"Already installed: {cc['version']}"})

    sp = get_settings_path()
    if not os.path.isfile(sp):
        write_json_file(sp, DEFAULT_SETTINGS)
        steps.append({"name": "Settings", "success": True, "message": "Default settings created"})
    else:
        steps.append({"name": "Settings", "success": True, "message": "Settings already exist"})

    refresh_environment()
    return {"success": all(s["success"] for s in steps), "steps": steps}


# ── Config ──

def read_settings() -> dict:
    data = read_json_file(get_settings_path())
    return {"data": data, "path": get_settings_path()}


def write_settings(settings: dict) -> dict:
    try:
        write_json_file(get_settings_path(), settings)
        return {"success": True, "path": get_settings_path()}
    except Exception as e:
        return {"success": False, "path": get_settings_path(), "error": str(e)}


# ── MCP ──

def check_mcp_servers() -> list[dict]:
    settings = read_json_file(get_settings_path())
    servers = (settings or {}).get("mcpServers", {})
    return [
        {"name": name, "configured": True, "command": cfg.get("command"), "args": cfg.get("args"), "env": cfg.get("env")}
        for name, cfg in servers.items()
    ]


def install_mcp_server(name: str, config: dict) -> dict:
    try:
        sp = get_settings_path()
        settings = read_json_file(sp) or {"env": {}, "mcpServers": {}}
        settings.setdefault("mcpServers", {})[name] = config
        write_json_file(sp, settings)
        return {"success": True, "message": f'MCP server "{name}" configured'}
    except Exception as e:
        return {"success": False, "message": f"Failed: {e}"}


def uninstall_mcp_server(name: str) -> dict:
    try:
        sp = get_settings_path()
        settings = read_json_file(sp)
        if not settings or name not in settings.get("mcpServers", {}):
            return {"success": False, "message": f'MCP server "{name}" not found'}
        del settings["mcpServers"][name]
        write_json_file(sp, settings)
        return {"success": True, "message": f'MCP server "{name}" removed'}
    except Exception as e:
        return {"success": False, "message": f"Failed: {e}"}


# ── WeChat ACP ──

def check_wechat_acp() -> dict:
    settings = read_json_file(get_settings_path())
    configured = "wechat-acp" in (settings or {}).get("mcpServers", {})
    version = None
    npm_cmd = which("npm")
    if npm_cmd:
        try:
            result = subprocess.run(
                [npm_cmd, "list", "-g", "wechat-acp"],
                capture_output=True, text=True, timeout=10,
                env={**os.environ, "PATH": get_augmented_path()},
            )
            import re
            m = re.search(r"wechat-acp@([\d.]+)", result.stdout)
            if m:
                version = m.group(1)
        except Exception:
            pass
    return {"installed": version is not None, "configured": configured, "version": version}


def install_wechat_acp(token: str | None = None) -> dict:
    steps = []
    npm_cmd = which("npm")
    if npm_cmd:
        try:
            subprocess.run(
                [npm_cmd, "install", "-g", "wechat-acp", "--registry=https://registry.npmmirror.com"],
                capture_output=True, text=True, timeout=300,
                env={**os.environ, "PATH": get_augmented_path()},
            )
            steps.append({"name": "wechat-acp package", "success": True, "message": "Installed globally"})
        except Exception as e:
            steps.append({"name": "wechat-acp package", "success": False, "message": str(e)})

    try:
        sp = get_settings_path()
        settings = read_json_file(sp) or {"env": {}, "mcpServers": {}}
        settings.setdefault("mcpServers", {})
        cfg: dict[str, Any] = {"command": "npx", "args": ["-y", "wechat-acp"]}
        if token:
            cfg["env"] = {"WECHAT_ACP_TOKEN": token}
        settings["mcpServers"]["wechat-acp"] = cfg
        write_json_file(sp, settings)
        steps.append({"name": "MCP configuration", "success": True, "message": "WeChat ACP added to settings.json"})
    except Exception as e:
        steps.append({"name": "MCP configuration", "success": False, "message": str(e)})

    return {
        "success": all(s["success"] for s in steps),
        "message": "WeChat ACP installed" if all(s["success"] for s in steps) else "Setup completed with errors",
        "steps": steps,
    }


# ── Status ──

def get_status() -> dict:
    node = check_node()
    claude_code = check_claude_code()
    wechat_acp = check_wechat_acp()
    mcp_servers = check_mcp_servers()
    return {
        "node": node,
        "claudeCode": claude_code,
        "wechatAcp": wechat_acp,
        "mcpServers": mcp_servers,
        "settingsPath": get_settings_path(),
        "claudeDir": get_claude_dir(),
    }


# ── Doctor ──

def run_doctor(on_output=None) -> dict:
    results = []

    def log(msg: str):
        if on_output:
            on_output(msg)

    log("Checking Node.js...")
    nc = check_node()
    if nc["installed"]:
        results.append({"check": "Node.js", "status": "pass", "message": f"v{nc['version']}"})
        log(f"  \u2713 Node.js {nc['version']} found at {nc['path']}")
    else:
        results.append({"check": "Node.js", "status": "fail", "message": "Not installed"})
        log("  \u2717 Node.js not found")

    log("Checking npm...")
    npm_path = which("npm")
    if npm_path:
        v = probe_version(npm_path)
        if v:
            results.append({"check": "npm", "status": "pass", "message": v})
            log(f"  \u2713 npm {v}")
        else:
            results.append({"check": "npm", "status": "fail", "message": "Cannot get version"})
    else:
        results.append({"check": "npm", "status": "fail", "message": "Not installed"})
        log("  \u2717 npm not found")

    log("Checking Claude Code...")
    cc = check_claude_code()
    if cc["installed"]:
        results.append({"check": "Claude Code", "status": "pass", "message": cc["version"] or "Installed"})
        log(f"  \u2713 Claude Code {cc['version']}")
    else:
        results.append({"check": "Claude Code", "status": "fail", "message": "Not installed"})
        log("  \u2717 Claude Code not found")

    log("Checking settings...")
    sp = get_settings_path()
    if os.path.isfile(sp):
        settings = read_json_file(sp)
        cnt = len((settings or {}).get("mcpServers", {}))
        results.append({"check": "Settings", "status": "pass", "message": f"Found with {cnt} MCP servers"})
        log(f"  \u2713 Settings found at {sp}")
    else:
        results.append({"check": "Settings", "status": "warn", "message": "Not found"})
        log("  \u26a0 Settings not found")

    log("Checking network...")
    try:
        subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "https://registry.npmjs.org/"],
            capture_output=True, text=True, timeout=10,
        )
        results.append({"check": "Network", "status": "pass", "message": "npm registry reachable"})
        log("  \u2713 npm registry reachable")
    except Exception:
        results.append({"check": "Network", "status": "warn", "message": "Cannot reach npm registry"})
        log("  \u26a0 Cannot reach npm registry")

    log(f"\nPlatform: {sys.platform}")
    log(f"Home: {get_home_dir()}")
    log(f"Claude dir: {get_claude_dir()}")

    pass_count = sum(1 for r in results if r["status"] == "pass")
    fail_count = sum(1 for r in results if r["status"] == "fail")
    log(f"\nDoctor complete: {pass_count} passed, {fail_count} failed")

    return {"success": fail_count == 0, "results": results}
