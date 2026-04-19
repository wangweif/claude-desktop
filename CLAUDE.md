# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pip install -r requirements.txt   # Install dependencies
python main.py                    # Run the app
```

## Architecture

Python + PySide6 desktop application that serves as an installer/configurator for Claude Code, targeting Chinese users via the GLM/Zhipu AI API proxy.

### Structure

- `main.py` — Entry point
- `backend/cli.py` — Core business logic: Node.js detection/install, Claude Code npm install, `~/.claude/settings.json` management, MCP server config, WeChat ACP integration, diagnostics
- `ui/theme.py` — Dark theme color constants and global QSS stylesheet
- `ui/welcome_page.py` — Welcome page with safety disclaimers
- `ui/env_check_page.py` — Environment check with auto-install (runs in QThread)
- `ui/dashboard_page.py` — System status overview with diagnostics
- `ui/settings_page.py` — Tabbed settings (General, MCP Servers, Models, Environment Vars)
- `ui/setup_wizard.py` — Step-by-step setup wizard (API Config, MCP, WeChat ACP)
- `ui/app_window.py` — Main window managing page navigation and app state

### Key Paths

- Claude config directory: `~/.claude/`
- Settings file: `~/.claude/settings.json` (contains `env`, `mcpServers`, `enabledPlugins`)
- Default API proxy: `https://open.bigmodel.cn/api/anthropic` (Zhipu/GLM endpoint)
- Default models: `glm-4.5-air` (haiku tier), `glm-5-turbo` (sonnet tier), `glm-5.1` (opus tier)

### Styling

Dark theme via QSS stylesheet in `ui/theme.py`. Background: `#0f0f11` (primary), `#1c1c1f` (cards). Accent: indigo-500/600 (`#6366f1`).

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
