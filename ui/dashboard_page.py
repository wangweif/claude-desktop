"""Dashboard page showing system status and diagnostics."""

from PySide6.QtCore import QThread, Signal, Qt
from PySide6.QtWidgets import (
    QFrame, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget,
)
from backend import cli
from .theme import (
    BG_SECONDARY, BORDER, BORDER_LIGHT, TEXT_MUTED, TEXT_SUCCESS,
    TEXT_DANGER, TEXT_SECONDARY, TEXT_FAINT, TEXT_WARNING, BRAND,
)


class DoctorWorker(QThread):
    output = Signal(str)
    finished = Signal()

    def run(self):
        cli.run_doctor(on_output=lambda msg: self.output.emit(msg))
        self.finished.emit()


class DashboardPage(QWidget):
    navigate_settings = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._status = None
        self._build_ui()

    def set_status(self, status: dict):
        self._status = status
        self._refresh_ui()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(16)

        header = QVBoxLayout()
        self._title = QLabel("系统状态")
        self._title.setStyleSheet("font-size: 16px; font-weight: 600;")
        header.addWidget(self._title)
        self._subtitle = QLabel("")
        self._subtitle.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px;")
        header.addWidget(self._subtitle)
        layout.addLayout(header)

        # Component cards row
        cards_layout = QHBoxLayout()
        cards_layout.setSpacing(12)

        self._node_card = self._make_status_card("Node.js")
        self._claude_card = self._make_status_card("Claude Code")
        self._wechat_card = self._make_status_card("WeChat ACP")
        cards_layout.addWidget(self._node_card)
        cards_layout.addWidget(self._claude_card)
        cards_layout.addWidget(self._wechat_card)
        layout.addLayout(cards_layout)

        # MCP servers section
        self._mcp_frame = QFrame()
        self._mcp_frame.setStyleSheet(f"background-color: {BG_SECONDARY}; border: 1px solid {BORDER}; border-radius: 10px;")
        mcp_layout = QVBoxLayout(self._mcp_frame)
        mcp_layout.setContentsMargins(16, 10, 16, 10)
        mcp_layout.setSpacing(4)

        mcp_header = QHBoxLayout()
        self._mcp_title = QLabel("MCP 服务器 (0)")
        self._mcp_title.setStyleSheet("font-weight: 500; font-size: 13px;")
        mcp_header.addWidget(self._mcp_title)
        mcp_header.addStretch()
        mcp_manage = QPushButton("管理")
        mcp_manage.setProperty("flat", True)
        mcp_manage.clicked.connect(self.navigate_settings.emit)
        mcp_header.addWidget(mcp_manage)
        mcp_layout.addLayout(mcp_header)

        self._mcp_empty = QLabel("暂未配置 MCP 服务器")
        self._mcp_empty.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 13px;")
        self._mcp_empty.setAlignment(Qt.AlignmentFlag.AlignCenter)
        mcp_layout.addWidget(self._mcp_empty)

        self._mcp_list = QVBoxLayout()
        self._mcp_list.setSpacing(0)
        mcp_layout.addLayout(self._mcp_list)

        layout.addWidget(self._mcp_frame)

        # Action buttons
        actions = QHBoxLayout()
        actions.setSpacing(8)
        self._refresh_btn = QPushButton("🔄 刷新状态")
        self._refresh_btn.setProperty("secondary", True)
        self._refresh_btn.clicked.connect(self._on_refresh)
        actions.addWidget(self._refresh_btn)

        self._doctor_btn = QPushButton("🩺 运行诊断")
        self._doctor_btn.setProperty("secondary", True)
        self._doctor_btn.clicked.connect(self._on_doctor)
        actions.addWidget(self._doctor_btn)

        settings_btn = QPushButton("⚙ 设置")
        settings_btn.setProperty("secondary", True)
        settings_btn.clicked.connect(self.navigate_settings.emit)
        actions.addWidget(settings_btn)

        actions.addStretch()
        layout.addLayout(actions)

        # Doctor output
        self._doctor_output = QLabel("")
        self._doctor_output.setStyleSheet(
            f"background-color: #0a0a0c; border-radius: 8px; color: {TEXT_SECONDARY}; "
            "font-family: 'SF Mono', monospace; font-size: 12px; padding: 12px;"
        )
        self._doctor_output.setWordWrap(True)
        self._doctor_output.setVisible(False)
        layout.addWidget(self._doctor_output)

        # Paths
        self._paths_label = QLabel("")
        self._paths_label.setStyleSheet(f"color: {TEXT_FAINT}; font-size: 11px;")
        layout.addWidget(self._paths_label)

        layout.addStretch()

    def _make_status_card(self, name: str) -> QFrame:
        card = QFrame()
        card.setStyleSheet(f"background-color: {BG_SECONDARY}; border-radius: 10px;")
        card.setMinimumWidth(180)
        card_layout = QVBoxLayout(card)
        card_layout.setContentsMargins(16, 12, 16, 12)
        card_layout.setSpacing(6)

        header = QHBoxLayout()
        title = QLabel(name)
        title.setStyleSheet("font-weight: 500; font-size: 13px;")
        header.addWidget(title)
        header.addStretch()
        badge = QLabel("")
        badge.setStyleSheet(f"font-size: 11px; padding: 2px 8px; border-radius: 4px;")
        badge.setObjectName("badge")
        header.addWidget(badge)
        card_layout.addLayout(header)

        detail = QLabel("")
        detail.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
        detail.setObjectName("detail")
        card_layout.addWidget(detail)

        install_btn = QPushButton("安装")
        install_btn.setProperty("flat", True)
        install_btn.setObjectName("install_btn")
        install_btn.setVisible(False)
        install_btn.clicked.connect(self.navigate_settings.emit)
        card_layout.addWidget(install_btn)

        card._title = title
        card._badge = badge
        card._detail = detail
        card._install_btn = install_btn
        return card

    def _refresh_ui(self):
        s = self._status
        if not s:
            return

        all_ok = s["node"]["installed"] and s["claudeCode"]["installed"]
        self._subtitle.setText("所有核心组件已安装就绪" if all_ok else "部分组件需要安装")

        # Node.js card
        self._set_card_status(
            self._node_card, s["node"]["installed"],
            s["node"].get("version", ""), s["node"]["installed"] and s["node"].get("nvm"),
        )

        # Claude Code card
        self._set_card_status(
            self._claude_card, s["claudeCode"]["installed"],
            s["claudeCode"].get("version", ""),
        )

        # WeChat ACP card
        wechat_ok = s["wechatAcp"]["configured"]
        self._wechat_card._badge.setText("正常" if wechat_ok else "未配置")
        self._wechat_card._badge.setStyleSheet(
            f"font-size: 11px; padding: 2px 8px; border-radius: 4px; color: {TEXT_SUCCESS}; background-color: rgba(52,211,153,0.1);"
            if wechat_ok else
            f"font-size: 11px; padding: 2px 8px; border-radius: 4px; color: {TEXT_WARNING}; background-color: rgba(251,191,36,0.1);"
        )
        if wechat_ok:
            self._wechat_card._detail.setText("已配置为 MCP 服务器")
            self._wechat_card._install_btn.setVisible(False)
        else:
            self._wechat_card._detail.setText("")
            self._wechat_card._install_btn.setVisible(True)

        # MCP servers
        mcp_servers = s.get("mcpServers", [])
        self._mcp_title.setText(f"MCP 服务器 ({len(mcp_servers)})")
        if not mcp_servers:
            self._mcp_empty.setVisible(True)
        else:
            self._mcp_empty.setVisible(False)
            # Clear old list
            while self._mcp_list.count():
                item = self._mcp_list.takeAt(0)
                if item.widget():
                    item.widget().deleteLater()
            for server in mcp_servers:
                row = QFrame()
                row.setStyleSheet(f"border-bottom: 1px solid {BORDER_LIGHT};")
                row_layout = QHBoxLayout(row)
                row_layout.setContentsMargins(16, 8, 16, 8)
                name = QLabel(server["name"])
                name.setStyleSheet("font-size: 13px;")
                cmd = QLabel(f"{server.get('command', '')} {' '.join(server.get('args', []))}")
                cmd.setStyleSheet(f"color: {TEXT_FAINT}; font-size: 11px; margin-left: 8px;")
                badge = QLabel("运行中")
                badge.setStyleSheet(f"color: {TEXT_SUCCESS}; font-size: 11px; padding: 2px 8px; border-radius: 4px; background-color: rgba(52,211,153,0.1);")
                row_layout.addWidget(name)
                row_layout.addWidget(cmd)
                row_layout.addStretch()
                row_layout.addWidget(badge)
                self._mcp_list.addWidget(row)

        # Paths
        self._paths_label.setText(
            f"Claude 目录: {s['claudeDir']}\n配置文件: {s['settingsPath']}"
        )

    def _set_card_status(self, card: QFrame, installed: bool, version: str = "", extra: bool = False):
        card._badge.setText("正常" if installed else "未安装")
        card._badge.setStyleSheet(
            f"font-size: 11px; padding: 2px 8px; border-radius: 4px; color: {TEXT_SUCCESS}; background-color: rgba(52,211,153,0.1);"
            if installed else
            f"font-size: 11px; padding: 2px 8px; border-radius: 4px; color: {TEXT_DANGER}; background-color: rgba(248,113,113,0.1);"
        )
        card._detail.setText(f"v{version}" if version else "")
        card._install_btn.setVisible(not installed)
        if extra:
            card._detail.setText(f"v{version} (nvm)")

    def _on_refresh(self):
        # This will be connected by the parent to refresh status
        self._refresh_btn.setText("刷新中...")
        self._refresh_btn.setEnabled(False)

    def enable_refresh(self):
        self._refresh_btn.setText("🔄 刷新状态")
        self._refresh_btn.setEnabled(True)

    def _on_doctor(self):
        self._doctor_output.setVisible(True)
        self._doctor_output.setText("正在运行诊断...")
        self._doctor_lines = []
        self._worker = DoctorWorker()
        self._worker.output.connect(self._on_doctor_output)
        self._worker.finished.connect(lambda: None)
        self._worker.start()

    def _on_doctor_output(self, line: str):
        self._doctor_lines.append(line)
        self._doctor_output.setText("\n".join(self._doctor_lines))
