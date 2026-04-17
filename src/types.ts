// Type declarations for the preload bridge API
export interface PlatformInfo {
  platform: string
  arch: string
  homedir: string
  appVersion: string
}

export interface NodeCheckResult {
  installed: boolean
  version: string | null
  path: string | null
  nvm: boolean
  recommended: string
}

export interface ClaudeCodeCheckResult {
  installed: boolean
  version: string | null
  path: string | null
}

export interface WechatAcpCheckResult {
  installed: boolean
  configured: boolean
  version: string | null
}

export interface McpServerStatus {
  name: string
  configured: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export interface SystemStatus {
  node: NodeCheckResult
  claudeCode: ClaudeCodeCheckResult
  wechatAcp: WechatAcpCheckResult
  mcpServers: McpServerStatus[]
  settingsPath: string
  claudeDir: string
}

export interface InstallStep {
  name: string
  success: boolean
  message: string
}

export interface InstallResult {
  success: boolean
  message?: string
  steps?: InstallStep[]
}

export interface DoctorResult {
  check: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export interface Api {
  getPlatformInfo: () => Promise<PlatformInfo>
  checkNode: () => Promise<NodeCheckResult>
  checkClaudeCode: () => Promise<ClaudeCodeCheckResult>
  checkWechatAcp: () => Promise<WechatAcpCheckResult>
  checkMcpServers: () => Promise<McpServerStatus[]>
  getStatus: () => Promise<SystemStatus>
  installNode: (opts?: { version?: string }) => Promise<InstallResult>
  installClaudeCode: () => Promise<InstallResult>
  installEnv: (opts?: { nodeVersion?: string }) => Promise<{ success: boolean; steps: InstallStep[] }>
  installWechatAcp: (opts?: { token?: string; appId?: string; appSecret?: string }) => Promise<{ success: boolean; message: string; steps: InstallStep[] }>
  refreshEnvironment: () => Promise<void>
  runCli: (args: string[], options?: { cwd?: string; timeout?: number }) => Promise<{ success: boolean; code: number; stdout: string; stderr: string }>
  runShell: (command: string, args?: string[], options?: { cwd?: string }) => Promise<{ success: boolean; code: number; stdout: string; stderr: string }>
  cancelCommand: (domain: string) => Promise<{ success: boolean }>
  onCliStdout: (callback: (data: string) => void) => () => void
  onCliStderr: (callback: (data: string) => void) => () => void
  onShellStdout: (callback: (data: string) => void) => () => void
  onShellStderr: (callback: (data: string) => void) => () => void
  onDoctorOutput: (callback: (data: string) => void) => () => void
  readConfig: (filePath?: string) => Promise<{ data: any; path: string }>
  writeConfig: (data: object, filePath?: string) => Promise<{ success: boolean; path: string }>
  readSettings: () => Promise<{ data: any; path: string }>
  writeSettings: (settings: object) => Promise<{ success: boolean; path: string }>
  installMcpServer: (name: string, config: { command: string; args: string[]; env?: Record<string, string> }) => Promise<{ success: boolean; message: string }>
  uninstallMcpServer: (name: string) => Promise<{ success: boolean; message: string }>
  runDoctor: () => Promise<{ success: boolean; results: DoctorResult[] }>
  openExternal: (url: string) => Promise<void>
}

declare global {
  interface Window {
    api: Api
  }
}
