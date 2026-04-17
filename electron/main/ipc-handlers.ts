import { ipcMain, BrowserWindow, shell } from 'electron'
import {
  checkNode,
  installNode,
  checkClaudeCode,
  installClaudeCode,
  installEnv,
  runCli,
  runShell,
  refreshEnvironment,
  readConfig,
  writeConfig,
  readSettings,
  writeSettings,
  getStatus,
  checkMcpServers,
  installMcpServer,
  uninstallMcpServer,
  installWechatAcp,
  checkWechatAcp,
  runDoctor,
} from './cli'

import { platform, arch, homedir } from 'os'

// Command domain cancellation support
const commandProcesses: Record<string, { kill: () => void } | null> = {}

export function registerIpcHandlers() {
  // ── Platform Info ──
  ipcMain.handle('get-platform-info', () => ({
    platform: platform(),
    arch: arch(),
    homedir: homedir(),
    appVersion: process.env.npm_package_version || '1.0.0',
  }))

  // ── Environment Detection ──
  ipcMain.handle('check-node', () => checkNode())
  ipcMain.handle('check-claude-code', () => checkClaudeCode())
  ipcMain.handle('check-wechat-acp', () => checkWechatAcp())
  ipcMain.handle('check-mcp-servers', () => checkMcpServers())
  ipcMain.handle('get-status', () => getStatus())

  // ── Environment Installation ──
  ipcMain.handle('install-node', async (_event, opts?: { version?: string }) => {
    return installNode(opts)
  })

  ipcMain.handle('install-claude-code', async () => {
    return installClaudeCode()
  })

  ipcMain.handle('install-env', async (_event, opts?: { nodeVersion?: string }) => {
    return installEnv(opts)
  })

  ipcMain.handle('install-wechat-acp', async (_event, opts?: { token?: string }) => {
    return installWechatAcp(opts)
  })

  ipcMain.handle('refresh-environment', () => refreshEnvironment())

  // ── CLI Operations ──
  ipcMain.handle('run-cli', async (_event, args: string[], options?: {
    cwd?: string
    onStdout?: (data: string) => void
    onStderr?: (data: string) => void
    timeout?: number
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    const domain = 'cli'

    commandProcesses[domain] = {
      kill: () => { /* handled by process group */ }
    }

    try {
      const result = await runCli(args, {
        ...options,
        onStdout: (data) => {
          win?.webContents.send('cli:stdout', data)
          options?.onStdout?.(data)
        },
        onStderr: (data) => {
          win?.webContents.send('cli:stderr', data)
          options?.onStderr?.(data)
        },
      })
      return { success: true, ...result }
    } finally {
      commandProcesses[domain] = null
    }
  })

  ipcMain.handle('run-shell', async (_event, command: string, args?: string[], options?: {
    cwd?: string
    onStdout?: (data: string) => void
    onStderr?: (data: string) => void
  }) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await runShell(command, args, {
      ...options,
      onStdout: (data) => {
        win?.webContents.send('shell:stdout', data)
        options?.onStdout?.(data)
      },
      onStderr: (data) => {
        win?.webContents.send('shell:stderr', data)
        options?.onStderr?.(data)
      },
    })
    return { success: true, ...result }
  })

  ipcMain.handle('cancel-command', (_event, domain: string) => {
    const proc = commandProcesses[domain]
    if (proc) {
      proc.kill()
      commandProcesses[domain] = null
      return { success: true }
    }
    return { success: false, message: 'No running command' }
  })

  // ── Config Management ──
  ipcMain.handle('read-config', async (_event, filePath?: string) => {
    return readConfig(filePath)
  })

  ipcMain.handle('write-config', async (_event, data: object, filePath?: string) => {
    return writeConfig(data, filePath)
  })

  ipcMain.handle('read-settings', () => readSettings())
  ipcMain.handle('write-settings', (_event, settings: object) => writeSettings(settings))

  // ── MCP Server Management ──
  ipcMain.handle('install-mcp-server', async (_event, name: string, config: {
    command: string
    args: string[]
    env?: Record<string, string>
  }) => {
    return installMcpServer(name, config)
  })

  ipcMain.handle('uninstall-mcp-server', async (_event, name: string) => {
    return uninstallMcpServer(name)
  })

  // ── Doctor / Diagnostics ──
  ipcMain.handle('run-doctor', async () => {
    const win = BrowserWindow.getFocusedWindow()
    return runDoctor((data) => {
      win?.webContents.send('doctor:output', data)
    })
  })

  // ── Window Controls ──
  ipcMain.handle('open-external', (_event, url: string) => {
    shell.openExternal(url)
  })
}
