@echo off
REM Build Claude Desktop for Windows
REM Produces dist\Claude Desktop\ (standalone, no Python required)

setlocal enabledelayedexpansion

echo === Claude Desktop Windows Build ===

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo ERROR: python not found. Install Python 3.10+ from python.org
    exit /b 1
)

REM Create virtual environment
if not exist ".venv-build" (
    echo Creating virtual environment...
    python -m venv .venv-build
)
call .venv-build\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install --upgrade pip
pip install pyinstaller>=6.0
pip install -r requirements.txt

REM Clean previous build
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

REM Run PyInstaller
echo Building with PyInstaller...
pyinstaller build.spec --clean --noconfirm

REM Check output
if exist "dist\Claude Desktop\Claude Desktop.exe" (
    echo.
    echo === Build Complete ===
    echo Output: dist\Claude Desktop\
    echo Launch: dist\Claude Desktop\Claude Desktop.exe
) else (
    echo.
    echo ERROR: Build output not found
    exit /b 1
)

call deactivate
echo Done.
