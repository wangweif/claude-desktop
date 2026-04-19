# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for Claude Desktop (PySide6)."""

import sys
from pathlib import Path

from PySide6 import __version__ as PYSIDE_VERSION

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('CHANGELOG.md', '.'),
    ],
    hiddenimports=[
        'ui',
        'ui.theme',
        'ui.app_window',
        'ui.welcome_page',
        'ui.env_check_page',
        'ui.dashboard_page',
        'ui.settings_page',
        'ui.setup_wizard',
        'ui.chat_page',
        'backend',
        'backend.cli',
        'backend.app_metadata',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'scipy',
        'PIL',
        'pytest',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Claude Desktop',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Claude Desktop',
)

# Collect PySide6 dynamic libraries and data files
import PySide6
pyside6_dir = Path(PySide6.__file__).parent
site_packages = pyside6_dir.parent
