"""Environment check page with auto-install."""

from datetime import datetime
from PySide6.QtCore import QThread, Signal, Qt
from PySide6.QtWidgets import (
    QHBoxLayout, QLabel, QProgressBar, QVBoxLayout, QWidget,
)
from backend import cli
from .theme import BG_INSET, TEXT_MUTED, TEXT_SUCCESS, TEXT_DANGER


class CheckItem:
    def __init__(self, key: str, label: str):
        self.key = key
        self.label = label
        self.status = "pending"  # pending | checking | done | error
        self.detail = ""


class EnvCheckWorker(QThread):
    status_ready = Signal(dict)
    log_message = Signal(str)
    item_updated = Signal(str, str, str)  # key, status, detail

    def run(self):
        items = {
            "node": CheckItem("node", "Node.js 环境"),
            "claude": CheckItem("claude", "Claude Code"),
            "config": CheckItem("config", "基础配置"),
        }

        def update(key, status, detail=""):
            self.item_updated.emit(key, status, detail)

        def log(msg):
            self.log_message.emit(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

        # Check Node.js
        update("node", "checking")
        log("正在检测 Node.js...")
        try:
            status = cli.get_status()
            nc = status["node"]
            if nc["installed"]:
                update("node", "done", f"v{nc['version']}")
                log(f"Node.js {nc['version']} 已安装")
            else:
                update("node", "error", "未安装")
                log("Node.js 未找到，需要安装")
        except Exception as e:
            update("node", "error", str(e))
            log(f"检测 Node.js 失败: {e}")
            return

        # Check Claude Code
        update("claude", "checking")
        log("正在检测 Claude Code...")
        cc = status["claudeCode"]
        if cc["installed"]:
            update("claude", "done", f"v{cc['version']}")
            log(f"Claude Code {cc['version']} 已安装")
        else:
            update("claude", "error", "未安装")
            log("Claude Code 未找到，需要安装")

        # Auto-install missing components
        if not nc["installed"]:
            update("node", "checking", "正在安装...")
            log("正在安装 Node.js...")
            r = cli.install_node()
            if r["success"]:
                update("node", "done", "安装成功")
                log("Node.js 安装成功")
            else:
                update("node", "error", r["message"])
                log(f"Node.js 安装失败: {r['message']}")

        if not cc["installed"]:
            update("claude", "checking", "正在安装...")
            log("正在安装 Claude Code（可能需要一些时间）...")
            r = cli.install_claude_code()
            if r["success"]:
                update("claude", "done", "安装成功")
                log("Claude Code 安装成功")
            else:
                update("claude", "error", r["message"])
                log(f"Claude Code 安装失败: {r['message']}")

        cli.refresh_environment()

        # Check config
        update("config", "checking")
        log("正在检查配置...")
        try:
            result = cli.read_settings()
            if result["data"]:
                update("config", "done", "已存在")
                log("配置已存在")
            else:
                cli.write_settings(cli.DEFAULT_SETTINGS)
                update("config", "done", "已创建默认配置")
                log("已创建默认 GLM 配置")
        except Exception as e:
            update("config", "done", "跳过")
            log(f"配置检查: {e}")

        # Final status
        try:
            final = cli.get_status()
            self.status_ready.emit(final)
        except Exception:
            self.status_ready.emit(status)


class EnvCheckPage(QWidget):
    env_ready = Signal(dict)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._items = {
            "node": CheckItem("node", "Node.js 环境"),
            "claude": CheckItem("claude", "Claude Code"),
            "config": CheckItem("config", "基础配置"),
        }
        self._logs: list[str] = []
        self._item_widgets: dict[str, tuple[QLabel, QLabel]] = {}
        self._build_ui()

    def start_check(self):
        self._worker = EnvCheckWorker()
        self._worker.item_updated.connect(self._on_item_updated)
        self._worker.log_message.connect(self._on_log)
        self._worker.status_ready.connect(self._on_ready)
        self._worker.start()

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(12)

        layout.addWidget(QLabel("环境检测"))

        self._progress = QProgressBar()
        self._progress.setRange(0, 100)
        self._progress.setTextVisible(False)
        self._progress.setFixedHeight(4)
        layout.addWidget(self._progress)

        for key, item in self._items.items():
            row = QHBoxLayout()
            icon = QLabel("○")
            icon.setFixedWidth(20)
            icon.setAlignment(Qt.AlignmentFlag.AlignCenter)
            label = QLabel(item.label)
            label.setStyleSheet("color: #f4f4f5; font-size: 13px;")
            detail = QLabel("")
            detail.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
            row.addWidget(icon)
            row.addWidget(label)
            row.addStretch()
            row.addWidget(detail)
            layout.addLayout(row)
            self._item_widgets[key] = (icon, detail)

        self._install_label = QLabel("正在安装缺失组件，请稍候...")
        self._install_label.setStyleSheet(f"color: {TEXT_MUTED}; font-size: 12px;")
        self._install_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self._install_label.setVisible(False)
        layout.addWidget(self._install_label)

        # Log output
        self._log_label = QLabel("")
        self._log_label.setStyleSheet(f"background-color: {BG_INSET}; border-radius: 8px; color: {TEXT_MUTED}; font-family: 'SF Mono', monospace; font-size: 12px; padding: 8px;")
        self._log_label.setWordWrap(True)
        self._log_label.setVisible(False)
        layout.addWidget(self._log_label)

        layout.addStretch()

    def _on_item_updated(self, key, status, detail):
        icon, detail_label = self._item_widgets[key]
        if status == "done":
            icon.setText("✓")
            icon.setStyleSheet(f"color: {TEXT_SUCCESS};")
        elif status == "error":
            icon.setText("✗")
            icon.setStyleSheet(f"color: {TEXT_DANGER};")
        elif status == "checking":
            icon.setText("⟳")
            icon.setStyleSheet(f"color: {TEXT_MUTED};")
        detail_label.setText(detail)

        # Update progress
        done = sum(1 for k, item in self._items.items() if self._item_widgets[k][0].text() == "✓")
        self._progress.setValue(int(done / len(self._items) * 100))

        if status == "checking" and detail:
            self._install_label.setVisible(True)

    def _on_log(self, msg):
        self._logs.append(msg)
        self._log_label.setVisible(True)
        self._log_label.setText("\n".join(self._logs[-20:]))

    def _on_ready(self, status):
        self._install_label.setVisible(False)
        self._progress.setValue(100)
        self.env_ready.emit(status)
