#!/usr/bin/env bash
# Build Claude Desktop for macOS
# Produces dist/Claude Desktop.app (standalone, no Python required)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="Claude Desktop"
VENV_DIR=".venv-build"
DIST_DIR="dist"
BUILD_DIR="build"

echo "=== Claude Desktop macOS Build ==="

# Check Python version
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.10+ from python.org"
    exit 1
fi

PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(python3 -c "import sys; print(sys.version_info.major)")
PY_MINOR=$(python3 -c "import sys; print(sys.version_info.minor)")
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 10 ]); then
    echo "ERROR: Python 3.10+ required, found $PY_VER"
    exit 1
fi
echo "Python $PY_VER detected"

# Create virtual environment
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi
source "$VENV_DIR/bin/activate"

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install pyinstaller>=6.0
pip install -r requirements.txt

# Clean previous build
rm -rf "$BUILD_DIR" "$DIST_DIR"

# Run PyInstaller
echo "Building with PyInstaller..."
pyinstaller build.spec --clean --noconfirm

# Move output to standard macOS .app location if needed
if [ -d "$DIST_DIR/$APP_NAME" ]; then
    echo ""
    echo "=== Build Complete ==="
    echo "Output: $DIST_DIR/$APP_NAME/"
    echo "Launch: open \"$DIST_DIR/$APP_NAME/$APP_NAME\""
else
    echo ""
    echo "ERROR: Build output not found at $DIST_DIR/$APP_NAME"
    exit 1
fi

# Optional: create DMG
echo ""
read -rp "Create DMG installer? [y/N] " CREATE_DMG
if [[ "$CREATE_DMG" =~ ^[Yy]$ ]]; then
    DMG_NAME="Claude-Desktop-macOS.dmg"
    STAGING="dist/dmg-staging"
    rm -rf "$STAGING"
    mkdir -p "$STAGING"
    cp -R "$DIST_DIR/$APP_NAME" "$STAGING/$APP_NAME"
    hdiutil create -volname "$APP_NAME" \
        -srcfolder "$STAGING" \
        -ov -format UDZO \
        "$DIST_DIR/$DMG_NAME"
    rm -rf "$STAGING"
    echo "DMG created: $DIST_DIR/$DMG_NAME"
fi

deactivate
echo "Done."
