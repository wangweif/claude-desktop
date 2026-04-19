"""Main application window managing page navigation and app state."""

from PySide6.QtCore import Qt, QTimer
from PySide6.QtWidgets import (
    QApplication, QHBoxLayout, QLabel, QPushButton, QStackedWidget,
    QVBoxLayout, QWidget,
)
from backend import cli
from .theme import STYLESHEET, BG_PRIMARY, BORDER, BRAND, BRAND_HOVER, BRAND_BG, TEXT_SECONDARY, TEXT_MUTED
from .welcome_page import WelcomePage
from .env_check_page import EnvCheckPage
from .dashboard_page import DashboardPage
from .settings_page import SettingsPage
from .chat_page import ChatPage
from .setup_wizard import SetupWizard


class MainLayout(QWidget):
    """Sidebar + content layout for the dashboard/settings view."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self):
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Sidebar
        sidebar = QWidget()
        sidebar.setFixedWidth(160)
        sidebar.setStyleSheet(f"border-right: 1px solid {BORDER};")
        sidebar_layout = QVBoxLayout(sidebar)
        sidebar_layout.setContentsMargins(8, 12, 8, 12)
        sidebar_layout.setSpacing(4)

        self._nav_buttons: list[tuple[QPushButton, str]] = []
        nav_items = [
            ("🏠 面板", "dashboard"),
            ("💬 对话", "chat"),
            ("⚙ 设置", "settings"),
        ]
        for label, key in nav_items:
            btn = QPushButton(label)
            btn.setProperty("nav", True)
            btn.clicked.connect(lambda checked, k=key: self.parent().navigate(k) if self.parent() else None)
            sidebar_layout.addWidget(btn)
            self._nav_buttons.append((btn, key))

        sidebar_layout.addStretch()

        layout.addWidget(sidebar)
        self._content = QWidget()
        self._content_layout = QVBoxLayout(self._content)
        self._content_layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._content, 1)

    def set_active_nav(self, key: str):
        for btn, k in self._nav_buttons:
            if k == key:
                btn.setProperty("nav", "active")
                btn.style().unpolish(btn)
                btn.style().polish(btn)
            else:
                btn.setProperty("nav", True)
                btn.style().unpolish(btn)
                btn.style().polish(btn)

    def get_content_layout(self) -> QVBoxLayout:
        return self._content_layout

    def replace_content(self, widget: QWidget):
        old = self._content_layout.takeAt(0)
        if old and old.widget():
            old.widget().deleteLater()
        self._content_layout.addWidget(widget)


class AppWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Claude Desktop")
        self.resize(1100, 750)
        self.setMinimumSize(900, 650)
        self.setStyleSheet(STYLESHEET)

        self._status = None
        self._settings = None
        self._current_page = "welcome"

        self._build_ui()
        self._show_welcome()

    def _build_ui(self):
        self._root_layout = QVBoxLayout(self)
        self._root_layout.setContentsMargins(0, 0, 0, 0)
        self._root_layout.setSpacing(0)

    def _clear(self):
        while self._root_layout.count():
            item = self._root_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
            elif item.layout():
                while item.layout().count():
                    sub = item.layout().takeAt(0)
                    if sub.widget():
                        sub.widget().deleteLater()

    def _make_titlebar(self) -> QWidget:
        bar = QWidget()
        bar.setFixedHeight(32)
        bar.setStyleSheet(f"border-bottom: 1px solid {BORDER};")
        layout = QHBoxLayout(bar)
        layout.setContentsMargins(0, 0, 0, 0)
        logo = QLabel("🖥")
        logo.setStyleSheet("font-size: 14px;")
        layout.addWidget(logo)
        title = QLabel("Claude Desktop")
        title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px; font-weight: 500;")
        layout.addWidget(title)
        layout.addStretch()
        return bar

    def _show_welcome(self):
        self._clear()
        self._current_page = "welcome"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        layout.addWidget(self._make_titlebar())

        center = QWidget()
        center_layout = QVBoxLayout(center)
        center_layout.setAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter)

        page = WelcomePage()
        page.accepted.connect(self._show_env_check)
        center_layout.addWidget(page)

        layout.addWidget(center, 1)
        self._root_layout.addLayout(layout)

    def _show_env_check(self):
        self._clear()
        self._current_page = "env-check"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        layout.addWidget(self._make_titlebar())

        center = QWidget()
        center_layout = QVBoxLayout(center)
        center_layout.setAlignment(Qt.AlignmentFlag.AlignHCenter | Qt.AlignmentFlag.AlignVCenter)

        page = EnvCheckPage()
        page.env_ready.connect(self._on_env_ready)
        center_layout.addWidget(page)

        layout.addWidget(center, 1)
        self._root_layout.addLayout(layout)

        page.start_check()

    def _on_env_ready(self, status: dict):
        self._status = status
        result = cli.read_settings()
        self._settings = result["data"] or {"env": {}, "mcpServers": {}}

        if status["node"]["installed"] and status["claudeCode"]["installed"]:
            self._show_dashboard()
        else:
            self._show_setup_wizard()

    def _show_setup_wizard(self):
        self._clear()
        self._current_page = "setup"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        bar = self._make_titlebar()
        bar.setFixedHeight(28)
        layout.addWidget(bar)

        wizard = SetupWizard(self._settings)
        wizard.setup_complete.connect(self._on_setup_complete)
        layout.addWidget(wizard, 1)
        self._root_layout.addLayout(layout)

    def _on_setup_complete(self):
        self._refresh_status()
        QTimer.singleShot(500, self._show_dashboard)

    def _show_dashboard(self):
        self._clear()
        self._current_page = "dashboard"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Titlebar
        bar = QWidget()
        bar.setFixedHeight(32)
        bar.setStyleSheet(f"border-bottom: 1px solid {BORDER};")
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(0, 0, 0, 0)
        logo = QLabel("🖥")
        logo.setStyleSheet("font-size: 14px;")
        bar_layout.addWidget(logo)
        title = QLabel("Claude Desktop")
        title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px; font-weight: 500;")
        bar_layout.addWidget(title)
        bar_layout.addStretch()
        layout.addWidget(bar)

        main = MainLayout(self)
        self._main_layout = main
        layout.addWidget(main, 1)
        self._root_layout.addLayout(layout)

        self._dashboard = DashboardPage()
        self._dashboard.navigate_settings.connect(lambda: self.navigate("settings"))
        self._dashboard._refresh_btn.clicked.connect(self._refresh_status)
        self._main_layout.replace_content(self._dashboard)

        if self._status:
            self._dashboard.set_status(self._status)

        self._main_layout.set_active_nav("dashboard")

    def _show_chat(self):
        self._clear()
        self._current_page = "chat"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # Titlebar
        bar = QWidget()
        bar.setFixedHeight(32)
        bar.setStyleSheet(f"border-bottom: 1px solid {BORDER};")
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(0, 0, 0, 0)
        logo = QLabel("🖥")
        logo.setStyleSheet("font-size: 14px;")
        bar_layout.addWidget(logo)
        title = QLabel("Claude Desktop")
        title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px; font-weight: 500;")
        bar_layout.addWidget(title)
        bar_layout.addStretch()
        layout.addWidget(bar)

        main = MainLayout(self)
        self._main_layout = main
        layout.addWidget(main, 1)
        self._root_layout.addLayout(layout)

        self._chat_page = ChatPage()
        self._main_layout.replace_content(self._chat_page)
        self._main_layout.set_active_nav("chat")

    def _show_settings(self):
        self._clear()
        self._current_page = "settings"

        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        bar = QWidget()
        bar.setFixedHeight(32)
        bar.setStyleSheet(f"border-bottom: 1px solid {BORDER};")
        bar_layout = QHBoxLayout(bar)
        bar_layout.setContentsMargins(0, 0, 0, 0)
        logo = QLabel("🖥")
        logo.setStyleSheet("font-size: 14px;")
        bar_layout.addWidget(logo)
        title = QLabel("Claude Desktop")
        title.setStyleSheet(f"color: {TEXT_SECONDARY}; font-size: 12px; font-weight: 500;")
        bar_layout.addWidget(title)
        bar_layout.addStretch()
        layout.addWidget(bar)

        main = MainLayout(self)
        self._main_layout = main
        layout.addWidget(main, 1)
        self._root_layout.addLayout(layout)

        self._settings_page = SettingsPage()
        self._settings_page.settings_changed.connect(self._on_settings_changed)
        self._settings_page.refresh_requested.connect(self._refresh_status)
        self._main_layout.replace_content(self._settings_page)

        if self._settings:
            self._settings_page.set_settings(self._settings)

        self._main_layout.set_active_nav("settings")

    def navigate(self, page: str):
        if page == self._current_page:
            return
        if page == "dashboard":
            self._show_dashboard()
        elif page == "chat":
            self._show_chat()
        elif page == "settings":
            self._show_settings()

    def _refresh_status(self):
        try:
            self._status = cli.get_status()
            result = cli.read_settings()
            if result["data"]:
                self._settings = result["data"]

            if self._current_page == "dashboard" and hasattr(self, "_dashboard"):
                self._dashboard.set_status(self._status)
                self._dashboard.enable_refresh()
            elif self._current_page == "settings" and hasattr(self, "_settings_page"):
                self._settings_page.set_settings(self._settings)
        except Exception:
            pass

    def _on_settings_changed(self, new_settings: dict):
        self._settings = new_settings
