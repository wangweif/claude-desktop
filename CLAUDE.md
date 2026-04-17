# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start Vite dev server (port 5173) with Electron hot-reload
npm run build:app    # TypeScript check + Vite build (renderer only)
npm run build        # Full build: app + electron-builder packaging
npm run build:mac    # Build macOS DMG (x64 + arm64)
npm run build:win    # Build Windows NSIS installer (x64)
npm run typecheck    # tsc --noEmit (no file output, type validation only)
npm run lint         # ESLint for .ts/.tsx files
```

## Architecture

Electron app (Vite + React + TypeScript) that serves as an installer/configurator for Claude Code, targeting Chinese users via the GLM/Zhipu AI API proxy.

### Process Boundary (contextIsolation: true, nodeIntegration: false)

The app enforces strict Electron security. Communication between renderer and main process uses a typed bridge:

1. **Renderer** (`src/`) — React SPA. Calls `window.api.*` methods declared in `src/types.ts` (`Api` interface).
2. **Preload** (`electron/preload/index.ts`) — `contextBridge.exposeInMainWorld('api', ...)` wraps `ipcRenderer.invoke/on` calls.
3. **IPC Handlers** (`electron/main/ipc-handlers.ts`) — `ipcMain.handle(...)` for each API method. Streams real-time output (CLI stdout/stderr, doctor) back to renderer via `webContents.send`.
4. **CLI Module** (`electron/main/cli.ts`) — Core business logic: Node.js detection/install, Claude Code npm install, `~/.claude/settings.json` management, MCP server config, WeChat ACP integration, diagnostics.

When adding a new API endpoint: define it in `src/types.ts` `Api` interface → expose in preload → handle in `ipc-handlers.ts` → implement in `cli.ts`.

### Renderer Structure

- `src/App.tsx` — Top-level page routing (dashboard / wizard / settings), fetches system status on mount
- `src/pages/` — Three pages: `Dashboard` (status overview + diagnostics), `SetupWizard` (step-by-step installer), `Settings` (MCP servers, model config, env vars with tab navigation)
- `src/index.css` — Tailwind base + dark theme CSS variables + titlebar drag/terminal styles

Path alias: `@/` maps to `src/` (configured in both `tsconfig.json` and `vite.config.ts`).

### Key Paths

- Claude config directory: `~/.claude/`
- Settings file: `~/.claude/settings.json` (contains `env`, `mcpServers`, `enabledPlugins`)
- Default API proxy: `https://open.bigmodel.cn/api/anthropic` (Zhipu/GLM endpoint)
- Default models: `glm-4.5-air` (haiku tier), `glm-5-turbo` (sonnet tier), `glm-5.1` (opus tier)

### Platform Handling

The codebase targets macOS (primary) and Windows. Platform checks use `process.platform` (`isMac`, `isWin` flags in `cli.ts`). macOS gets hidden titlebar (`hiddenInset`) and tray persistence on window close. Windows uses NSIS installer with custom install directory support.

### Styling

Tailwind CSS 3 with dark theme. Background: `#0f0f1a` (primary), `#1a1b2e` (cards), `#252640` (elevated). Accent: indigo-500/600. All inline via Tailwind classes — no separate CSS component files beyond `index.css`.
