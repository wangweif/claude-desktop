"""Setup wizard with step indicators: API config, MCP servers, WeChat ACP."""

from PySide6.QtCore import Signal, QThread, Qt
from PySide6.QtWidgets import (
    QHBoxLayout, QLabel, QLineEdit, QPushButton, QVBoxLayout, QWidget,
)
from backend import cli
from .theme import (
    BG_INSET, TEXT_MUTED, TEXT_SECONDARY, TEXT_SUCCESS,
)


class WechatInstallWorker(QThread):
    result = Signal(dict)

    def __init__(self, token: str | None):
        super().__init__()
        self._token = token

    def run(self):
        r = cli.install_wechat_acp(self._token)
        self.result.emit(r)


SETUP_STEPS = [
    ("api-config", "API 配置"),
    ("mcp", "MCP 服务器"),
    ("wechat", "WeChat ACP"),
]

MCP_WIZARD_PRESETS = [
    {"name": "sequential-thinking", "desc": "复杂推理", "args": "-y @modelcontextprotocol/server-sequential-thinking"},
    {"name": "playwright", "desc": "浏览器自动化", "args": "-y @playwright/mcp@latest"},
    {"name": "memory", "desc": "知识图谱记忆", "args": "-y @modelcontextprotocol/server-memory"},
    {"name": "filesystem", "desc": "文件系统", "args": "-y @modelcontextprotocol/server-filesystem /"},
]


class SetupWizard(QWidget):
    setup_complete = Signal()

    def __init__(self, settings: dict, parent=None):
        super().__init__(parent)
        self._settings = settings
        self._step_index = 0
        self._build_ui()

    def _build_ui(self):
        self._main_layout = QVBoxLayout(self)
        self._main_layout.setContentsMargins(0, 0, 0, 0)
        self._main_layout.setSpacing(0)

        # Step indicators
        self._steps_bar = QWidget()
        steps_layout = QHBoxLayout(self._steps_bar)
        steps_layout.setContentsMargins(0, 12, 0, 16)
        steps_layout.setSpacing(24)
        steps_layout.addStretch()
        self._step_indicators = []
        for i, (key, label) in enumerate(SETUP_STEPS):
            container = QWidget()
            h = QHBoxLayout(container)
            h.setContentsMargins(0, 0, 0, 0)
            h.setSpacing(6)
            circle = QLabel(str(i + 1))
            circle.setFixedSize(24, 24)
            circle.setAlignment(Qt.AlignmentFlag.AlignCenter)
            circle.setStyleSheet(
                f"background-color: {BG_INSET}; color: {TEXT_MUTED}; "
                "border-radius: 12px; font-size: 12px; font-weight: 700;"
            )
            lbl = QLabel(label)
            lbl.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
            h.addWidget(circle)
            h.addWidget(lbl)
            steps_layout.addWidget(container)
            self._step_indicators.append((circle, lbl))

            if i < len(SETUP_STEPS) - 1:
                sep = QLabel("")
                sep.setFixedWidth(32)
                sep.setStyleSheet(f"border-bottom: 1px solid #27272a;")
                steps_layout.addWidget(sep)

        steps_layout.addStretch()
        self._main_layout.addWidget(self._steps_bar)

        # Content area
        self._content = QWidget()
        self._content_layout = QVBoxLayout(self._content)
        self._content_layout.setContentsMargins(24, 0, 24, 24)
        self._content_layout.setSpacing(12)
        self._main_layout.addWidget(self._content, 1)

        self._show_step(0)

    def _update_step_indicators(self):
        for i, (circle, lbl) in enumerate(self._step_indicators):
            if i < self._step_index:
                circle.setText("✓")
                circle.setStyleSheet(
                    f"background-color: {TEXT_SUCCESS}; color: #000; "
                    "border-radius: 12px; font-size: 12px; font-weight: 700;"
                )
                lbl.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
            elif i == self._step_index:
                circle.setText(str(i + 1))
                circle.setStyleSheet(
                    f"background-color: rgba(52,211,153,0.2); color: {TEXT_SUCCESS}; "
                    f"border: 2px solid {TEXT_SUCCESS}; border-radius: 12px; "
                    "font-size: 12px; font-weight: 700;"
                )
                lbl.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
            else:
                circle.setText(str(i + 1))
                circle.setStyleSheet(
                    f"background-color: {BG_INSET}; color: {TEXT_MUTED}; "
                    "border-radius: 12px; font-size: 12px; font-weight: 700;"
                )
                lbl.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")

    def _clear_content(self):
        while self._content_layout.count():
            item = self._content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
            elif item.layout():
                while item.layout().count():
                    sub = item.layout().takeAt(0)
                    if sub.widget():
                        sub.widget().deleteLater()

    def _show_step(self, index: int):
        self._step_index = index
        self._update_step_indicators()
        self._clear_content()

        key = SETUP_STEPS[index][0]
        if key == "api-config":
            self._show_api_config()
        elif key == "mcp":
            self._show_mcp_step()
        elif key == "wechat":
            self._show_wechat_step()

    def _show_api_config(self):
        layout = self._content_layout
        layout.addWidget(QLabel("API 配置"))
        desc = QLabel("配置 Claude Code 的 API 地址和模型。默认使用智谱 GLM API 代理，也可切换为 Anthropic 官方 API。")
        desc.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        env = self._settings.get("env", {})
        fields = [
            ("API 地址", "ANTHROPIC_BASE_URL", ""),
            ("API 令牌（可选）", "ANTHROPIC_AUTH_TOKEN", "留空则使用系统默认认证"),
            ("快速模型（Haiku 层级）", "ANTHROPIC_DEFAULT_HAIKU_MODEL", ""),
            ("标准模型（Sonnet 层级）", "ANTHROPIC_DEFAULT_SONNET_MODEL", ""),
            ("强力模型（Opus 层级）", "ANTHROPIC_DEFAULT_OPUS_MODEL", ""),
        ]
        self._api_fields: dict[str, QLineEdit] = {}
        for label_text, key, placeholder in fields:
            lbl = QLabel(label_text)
            lbl.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
            layout.addWidget(lbl)
            field = QLineEdit(env.get(key, ""))
            if placeholder:
                field.setPlaceholderText(placeholder)
            if "令牌" in label_text:
                field.setEchoMode(QLineEdit.EchoMode.Password)
            layout.addWidget(field)
            self._api_fields[key] = field

        btn_row = QHBoxLayout()
        save_btn = QPushButton("保存并继续")
        save_btn.clicked.connect(self._save_api_next)
        btn_row.addWidget(save_btn)
        skip_btn = QPushButton("跳过")
        skip_btn.setProperty("secondary", True)
        skip_btn.clicked.connect(self.setup_complete.emit)
        btn_row.addWidget(skip_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)
        layout.addStretch()

    def _save_api_next(self):
        env = dict(self._settings.get("env", {}))
        for key, field in self._api_fields.items():
            env[key] = field.text()
        self._settings["env"] = env
        cli.write_settings(self._settings)
        self._show_step(1)

    def _show_mcp_step(self):
        layout = self._content_layout
        layout.addWidget(QLabel("MCP 服务器配置"))
        desc = QLabel("MCP 服务器可以扩展 Claude Code 的能力。你可以快速添加预设或自定义服务器。")
        desc.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        # Presets
        presets_layout = QHBoxLayout()
        presets_layout.setSpacing(8)
        mcp = self._settings.get("mcpServers", {})
        for p in MCP_WIZARD_PRESETS:
            btn = QPushButton(f"{p['name']} ({p['desc']})")
            btn.setProperty("flat", True)
            if p["name"] in mcp:
                btn.setEnabled(False)
                btn.setStyleSheet("opacity: 0.4;")
            else:
                btn.clicked.connect(lambda checked, preset=p: self._add_wizard_preset(preset))
            presets_layout.addWidget(btn)
        layout.addLayout(presets_layout)

        # Custom server
        lbl = QLabel("添加自定义服务器")
        lbl.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
        layout.addWidget(lbl)
        row = QHBoxLayout()
        self._wiz_name = QLineEdit()
        self._wiz_name.setPlaceholderText("名称")
        row.addWidget(self._wiz_name)
        self._wiz_args = QLineEdit()
        self._wiz_args.setPlaceholderText("参数")
        row.addWidget(self._wiz_args)
        layout.addLayout(row)
        add_btn = QPushButton("添加")
        add_btn.setProperty("secondary", True)
        add_btn.clicked.connect(self._add_wizard_custom)
        layout.addWidget(add_btn)

        btn_row = QHBoxLayout()
        save_btn = QPushButton("保存并继续")
        save_btn.clicked.connect(self._save_mcp_next)
        btn_row.addWidget(save_btn)
        back_btn = QPushButton("返回")
        back_btn.setProperty("secondary", True)
        back_btn.clicked.connect(lambda: self._show_step(0))
        btn_row.addWidget(back_btn)
        skip_btn = QPushButton("跳过")
        skip_btn.setProperty("secondary", True)
        skip_btn.clicked.connect(self.setup_complete.emit)
        btn_row.addWidget(skip_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)
        layout.addStretch()

    def _add_wizard_preset(self, preset: dict):
        self._settings.setdefault("mcpServers", {})[preset["name"]] = {
            "command": "npx",
            "args": preset["args"].split(),
        }
        self._show_step(1)  # Refresh

    def _add_wizard_custom(self):
        name = self._wiz_name.text().strip()
        if not name:
            return
        self._settings.setdefault("mcpServers", {})[name] = {
            "command": "npx",
            "args": self._wiz_args.text().strip().split(),
        }
        self._wiz_name.clear()
        self._wiz_args.clear()
        self._show_step(1)

    def _save_mcp_next(self):
        cli.write_settings(self._settings)
        self._show_step(2)

    def _show_wechat_step(self):
        layout = self._content_layout
        layout.addWidget(QLabel("WeChat ACP"))
        desc = QLabel("将 WeChat ACP 配置为 MCP 服务器，实现 Claude Code 与微信的集成。此步骤为可选。")
        desc.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        lbl = QLabel("WeChat 令牌（可选）")
        lbl.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        layout.addWidget(lbl)
        self._wechat_token = QLineEdit()
        self._wechat_token.setPlaceholderText("输入你的 WeChat ACP 令牌")
        layout.addWidget(self._wechat_token)

        self._wechat_log = QLabel("")
        self._wechat_log.setStyleSheet(f"background-color: {BG_INSET}; color: {TEXT_MUTED}; font-family: monospace; font-size: 12px; padding: 8px; border-radius: 8px;")
        self._wechat_log.setWordWrap(True)
        self._wechat_log.setVisible(False)
        layout.addWidget(self._wechat_log)

        btn_row = QHBoxLayout()
        install_btn = QPushButton("安装 WeChat ACP")
        install_btn.clicked.connect(self._install_wechat)
        btn_row.addWidget(install_btn)
        back_btn = QPushButton("返回")
        back_btn.setProperty("secondary", True)
        back_btn.clicked.connect(lambda: self._show_step(1))
        btn_row.addWidget(back_btn)
        skip_btn = QPushButton("跳过")
        skip_btn.setProperty("secondary", True)
        skip_btn.clicked.connect(self.setup_complete.emit)
        btn_row.addWidget(skip_btn)
        btn_row.addStretch()
        layout.addLayout(btn_row)
        layout.addStretch()

    def _install_wechat(self):
        self._wechat_log.setVisible(True)
        self._wechat_log.setText("正在安装...")
        self._worker = WechatInstallWorker(self._wechat_token.text() or None)
        self._worker.result.connect(self._on_wechat_done)
        self._worker.start()

    def _on_wechat_done(self, result: dict):
        lines = []
        if result.get("steps"):
            for step in result["steps"]:
                lines.append(f"  {step['name']}: {'OK' if step['success'] else 'FAIL'} - {step['message']}")
        lines.append(result.get("message", "安装完成" if result["success"] else "安装失败"))
        self._wechat_log.setText("\n".join(lines))
        self.setup_complete.emit()
