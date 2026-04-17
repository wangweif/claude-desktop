import { contextBridge, ipcRenderer } from 'electron'

function subscribeToChannel(channel: string, callback: (...args: any[]) => void) {
  const listener = (_event: any, ...args: any[]) => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api = {
  // ── Platform ──
  getPlatformInfo: () => ipcRenderer.invoke('get-platform-info'),

  // ── Environment Detection ──
  checkNode: () => ipcRenderer.invoke('check-node'),
  checkClaudeCode: () => ipcRenderer.invoke('check-claude-code'),
  checkWechatAcp: () => ipcRenderer.invoke('check-wechat-acp'),
  checkMcpServers: () => ipcRenderer.invoke('check-mcp-servers'),
  getStatus: () => ipcRenderer.invoke('get-status'),

  // ── Environment Installation ──
  installNode: (opts?: { version?: string }) => ipcRenderer.invoke('install-node', opts),
  installClaudeCode: () => ipcRenderer.invoke('install-claude-code'),
  installEnv: (opts?: { nodeVersion?: string }) => ipcRenderer.invoke('install-env', opts),
  installWechatAcp: (opts?: { token?: string; appId?: string; appSecret?: string }) =>
    ipcRenderer.invoke('install-wechat-acp', opts),
  refreshEnvironment: () => ipcRenderer.invoke('refresh-environment'),

  // ── CLI Operations ──
  runCli: (args: string[], options?: {
    cwd?: string
    timeout?: number
  }) => ipcRenderer.invoke('run-cli', args, options),
  runShell: (command: string, args?: string[], options?: { cwd?: string }) =>
    ipcRenderer.invoke('run-shell', command, args, options),
  cancelCommand: (domain: string) => ipcRenderer.invoke('cancel-command', domain),

  // ── CLI Output Streams ──
  onCliStdout: (callback: (data: string) => void) =>
    subscribeToChannel('cli:stdout', callback),
  onCliStderr: (callback: (data: string) => void) =>
    subscribeToChannel('cli:stderr', callback),
  onShellStdout: (callback: (data: string) => void) =>
    subscribeToChannel('shell:stdout', callback),
  onShellStderr: (callback: (data: string) => void) =>
    subscribeToChannel('shell:stderr', callback),
  onDoctorOutput: (callback: (data: string) => void) =>
    subscribeToChannel('doctor:output', callback),

  // ── Config Management ──
  readConfig: (filePath?: string) => ipcRenderer.invoke('read-config', filePath),
  writeConfig: (data: object, filePath?: string) => ipcRenderer.invoke('write-config', data, filePath),
  readSettings: () => ipcRenderer.invoke('read-settings'),
  writeSettings: (settings: object) => ipcRenderer.invoke('write-settings', settings),

  // ── MCP Server Management ──
  installMcpServer: (name: string, config: {
    command: string
    args: string[]
    env?: Record<string, string>
  }) => ipcRenderer.invoke('install-mcp-server', name, config),
  uninstallMcpServer: (name: string) => ipcRenderer.invoke('uninstall-mcp-server', name),

  // ── Diagnostics ──
  runDoctor: () => ipcRenderer.invoke('run-doctor'),

  // ── Window ──
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
}

contextBridge.exposeInMainWorld('api', api)
