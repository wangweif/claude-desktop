"""Welcome page with safety disclaimers."""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (
    QCheckBox, QHBoxLayout, QLabel, QPushButton, QVBoxLayout, QWidget,
)
from .theme import BG_SECONDARY, TEXT_DANGER, TEXT_WARNING, BRAND


class WelcomePage(QWidget):
    accepted = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._accepted = False
        self._build_ui()

    def _build_ui(self):
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(10)

        # Header
        header = QHBoxLayout()
        logo_label = QLabel()
        logo_label.setFixedSize(48, 48)
        logo_label.setStyleSheet(
            f"background-color: {BRAND}; border-radius: 12px;"
        )
        logo_label.setText("🖥")
        logo_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header.addWidget(logo_label)

        title = QLabel("Claude Installer")
        title.setStyleSheet("font-size: 16px; font-weight: 600;")
        header.addWidget(title)

        badge = QLabel("⚠ 安全提醒")
        badge.setStyleSheet(
            f"background-color: rgba(255,212,59,0.1); color: {TEXT_WARNING}; "
            "border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: 600;"
        )
        header.addWidget(badge)
        header.addStretch()
        root.addLayout(header)

        # Card 1: About Claude Code
        root.addWidget(self._make_card(
            "📌 关于 Claude Code",
            "Claude Code 是 Anthropic 推出的 AI 编程助手，为了完成任务，它需要以下权限：",
            [
                "读取和修改文件、执行系统命令、连接互联网",
                "访问您的 API 密钥（用于调用 AI 服务）",
                "支持 MCP 服务器扩展（文件系统、浏览器、GitHub 等）",
                "⚠ 使用 AI 服务可能产生费用，具体取决于你选择的服务商和使用量。",
            ],
        ))

        # Card 2: About Claude Installer
        root.addWidget(self._make_card(
            "📌 关于 Claude Installer",
            "Claude Installer 是 Claude Code 的安装配置工具，本工具会：",
            [
                "自动安装必要组件（Node.js、Claude Code 命令行工具）",
                "⚠ 保护现有配置（安装前自动备份，不会覆盖您的设置）",
                "本地数据存储（所有配置和数据默认只保存在此电脑上）",
                "可选安装 WeChat ACP 插件，实现 Claude Code 与微信的集成",
            ],
        ))

        # Card 3: Environment
        root.addWidget(self._make_card(
            "📌 环境说明",
            None,
            [
                "Claude Code 需要 Node.js 18+ 环境，如果未安装会自动安装。",
                "默认使用智谱 GLM API 代理，也可自行切换为 Anthropic 官方 API。",
                "支持配置 MCP 服务器来扩展 Claude Code 的能力。",
            ],
        ))

        # Checkbox
        self._checkbox = QCheckBox("我已阅读并了解以上内容")
        self._checkbox.stateChanged.connect(self._on_check_changed)
        root.addWidget(self._checkbox)

        # Button
        self._btn = QPushButton("确认继续")
        self._btn.setEnabled(False)
        self._btn.setFixedHeight(36)
        self._btn.clicked.connect(self.accepted.emit)
        root.addWidget(self._btn)

    def _on_check_changed(self, state):
        self._accepted = state == 2  # Qt.Checked
        self._btn.setEnabled(self._accepted)

    def _make_card(self, title: str, desc: str | None, items: list[str]) -> QWidget:
        card = QWidget()
        card.setStyleSheet(f"background-color: {BG_SECONDARY}; border-radius: 8px;")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(14, 10, 14, 10)
        layout.setSpacing(4)

        title_label = QLabel(title)
        title_label.setStyleSheet("font-weight: 600; font-size: 13px;")
        layout.addWidget(title_label)

        if desc:
            desc_label = QLabel(desc)
            desc_label.setStyleSheet(f"color: #e4e4e7; font-size: 12.5px;")
            desc_label.setWordWrap(True)
            layout.addWidget(desc_label)

        for item in items:
            lbl = QLabel(f"  • {item}")
            lbl.setWordWrap(True)
            if "⚠" in item:
                lbl.setStyleSheet(f"color: #e4e4e7; font-size: 12.5px;")
                warn_part = item.split("⚠")
                lbl.setText(f"  • {warn_part[0]}<span style='color:{TEXT_WARNING}; font-weight:500;'>⚠{warn_part[1]}</span>" if len(warn_part) == 2 else f"  • {item}")
            else:
                lbl.setStyleSheet(f"color: #e4e4e7; font-size: 12.5px;")
            layout.addWidget(lbl)

        return card
