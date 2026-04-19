"""Dark theme color constants matching the original Electron app."""

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QPen
from PySide6.QtWidgets import QProxyStyle, QStyle


class CheckboxStyle(QProxyStyle):
    """Draws a checkmark inside checked QCheckBox indicators."""

    def drawPrimitive(self, element, option, painter, widget=None):
        if element == QStyle.PrimitiveElement.PE_IndicatorCheckBox:
            super().drawPrimitive(element, option, painter, widget)
            if option.state & QStyle.StateFlag.State_On:
                painter.save()
                pen = QPen(QColor("#ffffff"), 2)
                pen.setCapStyle(Qt.PenCapStyle.RoundCap)
                pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
                painter.setPen(pen)
                r = option.rect.adjusted(4, 4, -4, -4)
                painter.drawLine(r.left(), r.center().y(), r.center().x() - 1, r.bottom())
                painter.drawLine(r.center().x() - 1, r.bottom(), r.right(), r.top())
                painter.restore()
        elif element == QStyle.PrimitiveElement.PE_IndicatorItemViewItemCheck:
            super().drawPrimitive(element, option, painter, widget)
            if option.state & QStyle.StateFlag.State_On:
                painter.save()
                pen = QPen(QColor("#ffffff"), 2)
                pen.setCapStyle(Qt.PenCapStyle.RoundCap)
                pen.setJoinStyle(Qt.PenJoinStyle.RoundJoin)
                painter.setPen(pen)
                r = option.rect.adjusted(4, 4, -4, -4)
                painter.drawLine(r.left(), r.center().y(), r.center().x() - 1, r.bottom())
                painter.drawLine(r.center().x() - 1, r.bottom(), r.right(), r.top())
                painter.restore()
        else:
            super().drawPrimitive(element, option, painter, widget)


# Background colors
BG_PRIMARY = "#0f0f11"
BG_SECONDARY = "#1c1c1f"
BG_TERTIARY = "#2a2a2e"
BG_INSET = "#0f0f11"
BG_INPUT = "#1c1c1f"

# Text colors
TEXT_PRIMARY = "#f4f4f5"
TEXT_SECONDARY = "#e4e4e7"
TEXT_TERTIARY = "#b0b0b8"
TEXT_MUTED = "#8a8a95"
TEXT_FAINT = "#626268"
TEXT_SUCCESS = "#34d399"
TEXT_WARNING = "#fbbf24"
TEXT_DANGER = "#f87171"
TEXT_INFO = "#22d3ee"

# Borders
BORDER = "#27272a"
BORDER_LIGHT = "#3f3f46"

# Brand / accent
BRAND = "#f97316"
BRAND_HOVER = "#fb923c"
BRAND_BG = "#3b1a04"

# Status colors
SUCCESS = "#20c997"
DANGER = "#ff6b6b"
WARNING = "#ffd43b"

# Widget styling constants
BORDER_RADIUS = 8
PADDING_SM = 8
PADDING_MD = 12
PADDING_LG = 16
PADDING_XL = 24

# Global stylesheet template
STYLESHEET = f"""
QWidget {{
    background-color: {BG_PRIMARY};
    color: {TEXT_PRIMARY};
    font-family: "AlibabaPuHuiTi", -apple-system, "Segoe UI", sans-serif;
    font-size: 13px;
}}

QMainWindow {{
    background-color: {BG_PRIMARY};
}}

/* Scrollbars */
QScrollBar:vertical {{
    background: transparent;
    width: 6px;
    border: none;
}}
QScrollBar::handle:vertical {{
    background: {BORDER_LIGHT};
    border-radius: 3px;
    min-height: 20px;
}}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {{
    height: 0;
}}

QScrollBar:horizontal {{
    background: transparent;
    height: 6px;
    border: none;
}}
QScrollBar::handle:horizontal {{
    background: {BORDER_LIGHT};
    border-radius: 3px;
    min-width: 20px;
}}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {{
    width: 0;
}}

/* Input fields */
QLineEdit, QTextEdit, QPlainTextEdit {{
    background-color: {BG_INPUT};
    color: {TEXT_PRIMARY};
    border: 1px solid {BORDER};
    border-radius: {BORDER_RADIUS}px;
    padding: 6px 10px;
    selection-background-color: {BRAND};
}}
QLineEdit:focus, QTextEdit:focus, QPlainTextEdit:focus {{
    border-color: {BRAND_HOVER};
}}

/* Push buttons */
QPushButton {{
    background-color: {BRAND};
    color: #fff;
    border: none;
    border-radius: {BORDER_RADIUS}px;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 500;
}}
QPushButton:hover {{
    background-color: {BRAND_HOVER};
}}
QPushButton:pressed {{
    background-color: #ea580c;
}}
QPushButton:disabled {{
    background-color: {BG_TERTIARY};
    color: {TEXT_MUTED};
}}

QPushButton[secondary="true"] {{
    background-color: {BG_TERTIARY};
    color: {TEXT_SECONDARY};
}}
QPushButton[secondary="true"]:hover {{
    background-color: {BORDER_LIGHT};
}}

QPushButton[danger="true"] {{
    background-color: {DANGER};
}}

QPushButton[flat="true"] {{
    background-color: transparent;
    color: {TEXT_MUTED};
    border: 1px solid {BORDER};
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12px;
}}
QPushButton[flat="true"]:hover {{
    background-color: {BG_TERTIARY};
    color: {TEXT_SECONDARY};
}}

/* Cards */
QFrame[card="true"] {{
    background-color: {BG_SECONDARY};
    border: 1px solid {BORDER};
    border-radius: {BORDER_RADIUS + 2}px;
}}

/* Progress bar */
QProgressBar {{
    background-color: {BG_TERTIARY};
    border: none;
    border-radius: 3px;
    height: 4px;
    text-align: center;
}}
QProgressBar::chunk {{
    background-color: {SUCCESS};
    border-radius: 3px;
}}

/* Tabs */
QTabWidget::pane {{
    border: none;
    background-color: transparent;
}}
QTabBar::tab {{
    background-color: transparent;
    color: {TEXT_MUTED};
    border: none;
    padding: 8px 14px;
    font-size: 13px;
    border-bottom: 2px solid transparent;
}}
QTabBar::tab:selected {{
    color: {TEXT_PRIMARY};
    border-bottom: 2px solid {BRAND};
}}
QTabBar::tab:hover:!selected {{
    color: {TEXT_SECONDARY};
}}

/* Checkbox */
QCheckBox {{
    color: {TEXT_SECONDARY};
    spacing: 6px;
}}
QCheckBox::indicator {{
    width: 16px;
    height: 16px;
    border: 1px solid {BORDER_LIGHT};
    border-radius: 4px;
    background-color: {BG_INPUT};
}}
QCheckBox::indicator:checked {{
    background-color: {BRAND};
    border-color: {BRAND};
}}
QCheckBox::indicator:checked:hover {{
    background-color: {BRAND_HOVER};
    border-color: {BRAND_HOVER};
}}

/* Label variants */
QLabel[heading="true"] {{
    font-size: 16px;
    font-weight: 600;
    color: {TEXT_PRIMARY};
}}
QLabel[subheading="true"] {{
    font-size: 14px;
    font-weight: 500;
    color: {TEXT_PRIMARY};
}}
QLabel[body="true"] {{
    color: {TEXT_SECONDARY};
    font-size: 12.5px;
}}
QLabel[muted="true"] {{
    color: {TEXT_MUTED};
    font-size: 12px;
}}
QLabel[faint="true"] {{
    color: {TEXT_FAINT};
    font-size: 11px;
}}
QLabel[success="true"] {{
    color: {TEXT_SUCCESS};
}}
QLabel[danger="true"] {{
    color: {TEXT_DANGER};
}}
QLabel[warning="true"] {{
    color: {TEXT_WARNING};
}}

/* Sidebar */
QFrame[sidebar="true"] {{
    background-color: {BG_PRIMARY};
    border-right: 1px solid {BORDER};
}}

/* Nav button */
QPushButton[nav="true"] {{
    background-color: transparent;
    color: {TEXT_MUTED};
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    text-align: left;
    font-size: 13px;
}}
QPushButton[nav="true"]:hover {{
    background-color: {BG_TERTIARY};
    color: {TEXT_SECONDARY};
}}
QPushButton[nav="active"] {{
    background-color: #7a3d15;
    color: {BRAND_HOVER};
}}

/* Title bar */
QFrame[titlebar="true"] {{
    background-color: {BG_PRIMARY};
    border-bottom: 1px solid {BORDER};
}}

/* Separator */
QFrame[separator="true"] {{
    background-color: {BORDER};
    max-height: 1px;
}}

/* Badge (used via QLabel with inline style) */

/* Switch / toggle */
QCheckBox[switch="true"] {{
    spacing: 8px;
}}
QCheckBox[switch="true"]::indicator {{
    width: 36px;
    height: 20px;
    border-radius: 10px;
    background-color: {BORDER_LIGHT};
    border: none;
}}
QCheckBox[switch="true"]::indicator:checked {{
    background-color: {BRAND};
}}

/* Group box (used for sections) */
QGroupBox {{
    border: 1px solid {BORDER};
    border-radius: {BORDER_RADIUS + 2}px;
    margin-top: 12px;
    padding: {PADDING_LG}px;
    padding-top: 28px;
    background-color: {BG_SECONDARY};
    font-weight: 500;
}}
QGroupBox::title {{
    subcontrol-origin: margin;
    subcontrol-position: top left;
    padding: 0 8px;
    color: {TEXT_SECONDARY};
}}
"""
