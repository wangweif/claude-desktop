"""Settings page with tabs for general, MCP, models, and environment vars."""

from PySide6.QtCore import Signal, Qt
from PySide6.QtWidgets import (
    QCheckBox, QFrame, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QScrollArea, QTabWidget, QTextBrowser, QTextEdit, QVBoxLayout, QWidget,
)
from backend import cli
from backend.app_metadata import get_latest_release_notes
from .theme import (
    BG_SECONDARY, BORDER, BORDER_LIGHT, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY,
    TEXT_FAINT, TEXT_SUCCESS, TEXT_DANGER,
)


MCP_PRESETS = [
    {"name": "sequential-thinking", "description": "复杂推理的顺序思维", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]},
    {"name": "playwright", "description": "浏览器自动化和测试", "command": "npx", "args": ["-y", "@playwright/mcp@latest"]},
    {"name": "memory", "description": "持久化知识图谱记忆", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"]},
    {"name": "context7", "description": "库文档查询", "command": "npx", "args": ["-y", "@upstash/context7-mcp"]},
    {"name": "filesystem", "description": "文件系统访问", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"]},
    {"name": "github", "description": "GitHub API", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"], "env": {"GITHUB_PERSONAL_ACCESS_TOKEN": ""}},
]


class SettingsPage(QWidget):
    settings_changed = Signal(dict)
    refresh_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._settings: dict = {}
        self._build_ui()

    def set_settings(self, settings: dict):
        self._settings = settings
        self._refresh_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        header = QVBoxLayout()
        title = QLabel("设置")
        title.setStyleSheet("font-size: 16px; font-weight: 600;")
        header.addWidget(title)
        subtitle = QLabel("配置 Claude Code、MCP 服务器和环境变量")
        subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        header.addWidget(subtitle)
        layout.addLayout(header)

        # Tabs
        self._tabs = QTabWidget()
        self._build_general_tab()
        self._build_mcp_tab()
        self._build_models_tab()
        self._build_env_tab()
        self._build_about_tab()
        layout.addWidget(self._tabs)

    def _make_section(self, title: str, parent_widget: QWidget) -> QVBoxLayout:
        frame = QFrame()
        frame.setStyleSheet(f"background-color: {BG_SECONDARY}; border-radius: 10px;")
        layout = QVBoxLayout(frame)
        layout.setContentsMargins(20, 16, 20, 16)
        layout.setSpacing(10)
        lbl = QLabel(title)
        lbl.setStyleSheet("font-weight: 500; font-size: 13px;")
        layout.addWidget(lbl)
        parent_widget.layout().addWidget(frame)
        return layout

    def _make_field_row(self, label_text: str, parent_layout: QVBoxLayout, password: bool = False) -> QLineEdit:
        lbl = QLabel(label_text)
        lbl.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        parent_layout.addWidget(lbl)
        field = QLineEdit()
        if password:
            field.setEchoMode(QLineEdit.EchoMode.Password)
        parent_layout.addWidget(field)
        return field

    # ── General Tab ──
    def _build_general_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(16)

        section = self._make_section("API 配置", tab)
        self._api_url = self._make_field_row("API 地址", section)
        self._api_token = self._make_field_row("API 令牌", section, password=True)
        self._api_timeout = self._make_field_row("API 超时时间 (毫秒)", section)

        save_btn = QPushButton("保存更改")
        save_btn.clicked.connect(self._save_general)
        section.addWidget(save_btn)

        self._tabs.addTab(tab, "通用")

    # ── MCP Tab ──
    def _build_mcp_tab(self):
        scroll_widget = QWidget()
        scroll = QVBoxLayout(scroll_widget)
        scroll.setContentsMargins(0, 12, 0, 0)
        scroll.setSpacing(16)

        # Existing servers
        section1 = QFrame()
        section1.setStyleSheet(f"background-color: {BG_SECONDARY}; border-radius: 10px;")
        s1_layout = QVBoxLayout(section1)
        s1_layout.setContentsMargins(16, 10, 16, 10)
        s1_layout.setSpacing(4)
        s1_title = QLabel("已配置的 MCP 服务器")
        s1_title.setStyleSheet("font-weight: 500; font-size: 13px;")
        s1_layout.addWidget(s1_title)
        self._mcp_empty = QLabel("暂未配置 MCP 服务器")
        self._mcp_empty.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 13px;")
        self._mcp_empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        s1_layout.addWidget(self._mcp_empty)
        self._mcp_servers_layout = QVBoxLayout()
        self._mcp_servers_layout.setSpacing(0)
        s1_layout.addLayout(self._mcp_servers_layout)
        scroll.addWidget(section1)

        # Add custom server
        section2 = self._make_section("添加自定义 MCP 服务器", scroll_widget)
        row = QHBoxLayout()
        self._new_name = QLineEdit()
        self._new_name.setPlaceholderText("名称")
        row.addWidget(self._new_name)
        self._new_cmd = QLineEdit()
        self._new_cmd.setPlaceholderText("命令")
        self._new_cmd.setText("npx")
        row.addWidget(self._new_cmd)
        section2.addLayout(row)
        self._new_args = QLineEdit()
        self._new_args.setPlaceholderText("参数（空格分隔）")
        section2.addWidget(self._new_args)
        self._new_env = QTextEdit()
        self._new_env.setPlaceholderText("环境变量（KEY=VALUE，每行一个）")
        self._new_env.setFixedHeight(60)
        section2.addWidget(self._new_env)

        add_btn = QPushButton("+ 添加服务器")
        add_btn.clicked.connect(self._add_custom_mcp)
        section2.addWidget(add_btn)

        # Presets
        section3 = self._make_section("快速添加预设", scroll_widget)
        self._presets_layout = QHBoxLayout()
        self._presets_layout.setSpacing(8)
        section3.addLayout(self._presets_layout)
        self._all_presets_label = QLabel("所有预设均已配置")
        self._all_presets_label.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 13px;")
        self._all_presets_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._all_presets_label.setVisible(False)
        section3.addWidget(self._all_presets_label)

        scroll.addStretch()

        scroll_area = QScrollArea()
        scroll_area.setWidget(scroll_widget)
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.Shape.NoFrame)
        self._tabs.addTab(scroll_area, "MCP 服务器")

    # ── Models Tab ──
    def _build_models_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(16)

        section = self._make_section("模型配置", tab)
        desc = QLabel("配置 Claude Code 在不同任务中使用的 AI 模型。")
        desc.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        section.addWidget(desc)

        self._model_haiku = self._make_field_row("快速模型（Haiku 层级）", section)
        self._model_sonnet = self._make_field_row("标准模型（Sonnet 层级）", section)
        self._model_opus = self._make_field_row("强力模型（Opus 层级）", section)

        btn_row = QHBoxLayout()
        save_btn = QPushButton("保存更改")
        save_btn.clicked.connect(self._save_models)
        btn_row.addWidget(save_btn)
        default_btn = QPushButton("GLM 默认值")
        default_btn.setProperty("secondary", True)
        default_btn.clicked.connect(self._set_glm_defaults)
        btn_row.addWidget(default_btn)
        btn_row.addStretch()
        section.addLayout(btn_row)

        layout.addStretch()
        self._tabs.addTab(tab, "模型")

    # ── Env Tab ──
    def _build_env_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(16)

        section1 = self._make_section("环境变量", tab)
        self._env_vars_layout = QVBoxLayout()
        self._env_vars_layout.setSpacing(4)
        section1.addLayout(self._env_vars_layout)
        save_env_btn = QPushButton("保存更改")
        save_env_btn.clicked.connect(self._save_env)
        section1.addWidget(save_env_btn)

        section2 = self._make_section("实验性功能", tab)
        self._agent_teams_check = QCheckBox("Agent Teams（多智能体协作）")
        section2.addWidget(self._agent_teams_check)
        save_feat_btn = QPushButton("保存更改")
        save_feat_btn.clicked.connect(self._save_features)
        section2.addWidget(save_feat_btn)

        layout.addStretch()
        self._tabs.addTab(tab, "环境变量")

    def _build_about_tab(self):
        tab = QWidget()
        layout = QVBoxLayout(tab)
        layout.setContentsMargins(0, 12, 0, 0)
        layout.setSpacing(16)

        hint = QLabel("版本与变更说明来自仓库根目录的 CHANGELOG.md；仅展示文件中**最上方**即最新一条版本。")
        hint.setWordWrap(True)
        hint.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
        layout.addWidget(hint)

        version, body = get_latest_release_notes()

        section_ver = self._make_section("本软件版本", tab)
        ver_lbl = QLabel(version if version else "—")
        ver_lbl.setStyleSheet(f"color: {TEXT_PRIMARY}; font-size: 15px; font-weight: 600; font-family: ui-monospace, monospace;")
        section_ver.addWidget(ver_lbl)

        section_notes = self._make_section("本版本变更记录", tab)
        browser = QTextBrowser()
        browser.setReadOnly(True)
        browser.setOpenExternalLinks(True)
        browser.setStyleSheet(
            f"QTextBrowser {{ background-color: {BG_SECONDARY}; border: 1px solid {BORDER}; "
            f"border-radius: 8px; padding: 12px; color: {TEXT_PRIMARY}; font-size: 13px; }}"
        )
        browser.setMinimumHeight(220)
        if body:
            browser.setMarkdown(body)
        else:
            browser.setPlainText(
                "未找到根目录下的 CHANGELOG.md，或文件中缺少可解析的版本标题（例如 ## [0.0.1] - 日期）。"
            )
        section_notes.addWidget(browser)

        layout.addStretch()
        self._tabs.addTab(tab, "关于")

    def _refresh_ui(self):
        env = self._settings.get("env", {})
        mcp = self._settings.get("mcpServers", {})

        # General
        self._api_url.setText(env.get("ANTHROPIC_BASE_URL", ""))
        self._api_token.setText(env.get("ANTHROPIC_AUTH_TOKEN", ""))
        self._api_timeout.setText(env.get("API_TIMEOUT_MS", "30000000"))

        # Models
        self._model_haiku.setText(env.get("ANTHROPIC_DEFAULT_HAIKU_MODEL", ""))
        self._model_sonnet.setText(env.get("ANTHROPIC_DEFAULT_SONNET_MODEL", ""))
        self._model_opus.setText(env.get("ANTHROPIC_DEFAULT_OPUS_MODEL", ""))

        # MCP tab count
        mcp_count = len(mcp)
        self._tabs.setTabText(1, f"MCP 服务器 ({mcp_count})")

        # MCP servers list
        while self._mcp_servers_layout.count():
            item = self._mcp_servers_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        if not mcp:
            self._mcp_empty.setVisible(True)
        else:
            self._mcp_empty.setVisible(False)
            for name, cfg in mcp.items():
                row = QFrame()
                row.setStyleSheet(f"border-bottom: 1px solid {BORDER_LIGHT};")
                row_layout = QHBoxLayout(row)
                row_layout.setContentsMargins(16, 8, 16, 8)
                n = QLabel(name)
                n.setStyleSheet("font-weight: 500; font-size: 13px;")
                n.setMinimumWidth(120)
                cmd_text = f"{cfg.get('command', '')} {' '.join(cfg.get('args', []))}"
                cmd = QLabel(cmd_text)
                cmd.setStyleSheet(f"color: {TEXT_FAINT}; font-size: 11px; margin-left: 8px;")
                cmd.setWordWrap(True)
                row_layout.addWidget(n)
                row_layout.addWidget(cmd, 1)
                del_btn = QPushButton("删除")
                del_btn.setProperty("danger", True)
                del_btn.setFixedHeight(28)
                del_btn.clicked.connect(lambda checked, n=name: self._remove_mcp(n))
                row_layout.addWidget(del_btn)
                self._mcp_servers_layout.addWidget(row)

        # Presets
        while self._presets_layout.count():
            item = self._presets_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        available = [p for p in MCP_PRESETS if p["name"] not in mcp]
        if available:
            self._all_presets_label.setVisible(False)
            for preset in available:
                btn = QPushButton(f"{preset['name']} - {preset['description']}")
                btn.setProperty("flat", True)
                btn.clicked.connect(lambda checked, p=preset: self._add_preset_mcp(p))
                self._presets_layout.addWidget(btn)
        else:
            self._all_presets_label.setVisible(True)

        # Env vars
        while self._env_vars_layout.count():
            item = self._env_vars_layout.takeAt(0)
            w = item.widget()
            if w:
                w.deleteLater()
            elif item.layout():
                while item.layout().count():
                    sub = item.layout().takeAt(0)
                    if sub.widget():
                        sub.widget().deleteLater()

        self._env_fields: dict[str, QLineEdit] = {}
        for key, value in env.items():
            row = QHBoxLayout()
            k = QLabel(key)
            k.setFixedWidth(240)
            k.setStyleSheet(f"color: {TEXT_MUTED}; font-family: monospace; font-size: 12px;")
            field = QLineEdit(str(value))
            if any(s in key.upper() for s in ("TOKEN", "KEY", "SECRET")):
                field.setEchoMode(QLineEdit.EchoMode.Password)
            row.addWidget(k)
            row.addWidget(field, 1)
            self._env_vars_layout.addLayout(row)
            self._env_fields[key] = field

        # Features
        self._agent_teams_check.setChecked(env.get("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS") == "1")

    def _get_current_env(self) -> dict:
        env = dict(self._settings.get("env", {}))
        env["ANTHROPIC_BASE_URL"] = self._api_url.text()
        env["ANTHROPIC_AUTH_TOKEN"] = self._api_token.text()
        env["API_TIMEOUT_MS"] = self._api_timeout.text()
        env["ANTHROPIC_DEFAULT_HAIKU_MODEL"] = self._model_haiku.text()
        env["ANTHROPIC_DEFAULT_SONNET_MODEL"] = self._model_sonnet.text()
        env["ANTHROPIC_DEFAULT_OPUS_MODEL"] = self._model_opus.text()
        # Also sync from env var fields
        for key, field in self._env_fields.items():
            env[key] = field.text()
        env["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"] = "1" if self._agent_teams_check.isChecked() else "0"
        return env

    def _save_settings(self, new_settings: dict) -> bool:
        result = cli.write_settings(new_settings)
        if result["success"]:
            self._settings = new_settings
            self.settings_changed.emit(new_settings)
            self.refresh_requested.emit()
            return True
        return False

    def _save_general(self):
        s = dict(self._settings)
        s["env"] = self._get_current_env()
        self._save_settings(s)

    def _save_models(self):
        self._save_general()

    def _save_env(self):
        s = dict(self._settings)
        s["env"] = self._get_current_env()
        self._save_settings(s)

    def _save_features(self):
        self._save_general()

    def _set_glm_defaults(self):
        defaults = {
            "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic",
            "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-air",
            "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5-turbo",
            "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.1",
        }
        self._api_url.setText(defaults["ANTHROPIC_BASE_URL"])
        self._model_haiku.setText(defaults["ANTHROPIC_DEFAULT_HAIKU_MODEL"])
        self._model_sonnet.setText(defaults["ANTHROPIC_DEFAULT_SONNET_MODEL"])
        self._model_opus.setText(defaults["ANTHROPIC_DEFAULT_OPUS_MODEL"])

    def _add_custom_mcp(self):
        name = self._new_name.text().strip()
        if not name:
            return
        args = self._new_args.text().strip().split()
        cfg: dict = {"command": self._new_cmd.text().strip() or "npx", "args": args}
        env_text = self._new_env.toPlainText().strip()
        if env_text:
            cfg["env"] = {}
            for line in env_text.split("\n"):
                if "=" in line:
                    k, _, v = line.partition("=")
                    cfg["env"][k.strip()] = v.strip()

        s = dict(self._settings)
        s.setdefault("mcpServers", {})[name] = cfg
        if self._save_settings(s):
            self._new_name.clear()
            self._new_args.clear()
            self._new_env.clear()

    def _add_preset_mcp(self, preset: dict):
        s = dict(self._settings)
        cfg: dict = {"command": preset["command"], "args": preset["args"]}
        if "env" in preset:
            cfg["env"] = preset["env"]
        s.setdefault("mcpServers", {})[preset["name"]] = cfg
        self._save_settings(s)

    def _remove_mcp(self, name: str):
        s = dict(self._settings)
        mcp = dict(s.get("mcpServers", {}))
        mcp.pop(name, None)
        s["mcpServers"] = mcp
        self._save_settings(s)
