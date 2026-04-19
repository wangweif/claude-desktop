#!/usr/bin/env python3
"""Claude Desktop Installer - Python + PySide6 rewrite."""

import sys


def main():
    app = sys.modules.get("__main__")
    if app is None:
        from PySide6.QtWidgets import QApplication
    else:
        from PySide6.QtWidgets import QApplication

    qt_app = QApplication(sys.argv)
    qt_app.setStyle("Fusion")

    from ui.theme import CheckboxStyle
    qt_app.setStyle(CheckboxStyle("Fusion"))

    from ui.app_window import AppWindow
    window = AppWindow()
    window.show()

    sys.exit(qt_app.exec())


if __name__ == "__main__":
    main()
