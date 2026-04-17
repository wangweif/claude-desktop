/**
 * CLI wrapper module - handles Node.js detection/installation,
 * Claude Code CLI management, MCP server configuration, and WeChat ACP integration.
 *
 * Adapted from Qclaw's cli.ts for Claude Code.
 */

import { execSync, exec, spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { homedir, platform, arch, tmpdir } from 'os'
import { createRequire } from 'module'
import { promisify } from 'util'

const execAsync = promisify(exec)
const isMac = platform() === 'darwin'
const isWin = platform() === 'win32'
const require = createRequire(import.meta.url)

// ── Default Settings Template ──
const DEFAULT_SETTINGS = {
  env: {
    ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
    API_TIMEOUT_MS: '30000000',
    CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5-turbo',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1',
  },
  enabledPlugins: {},
  mcpServers: {},
}

// ── Utility Functions ──

function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || homedir()
}

function getClaudeDir(): string {
  return join(getHomeDir(), '.claude')
}

function getSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json')
}

function which(cmd: string): string | null {
  try {
    const result = execSync(
      isWin ? `where ${cmd} 2>nul` : `which ${cmd} 2>/dev/null`,
      { encoding: 'utf-8' }
    ).trim()
    return result || null
  } catch {
    return null
  }
}

function getShellPath(): string {
  if (isWin) return 'powershell.exe'
  return process.env.SHELL || '/bin/zsh'
}

function fileExists(path: string): boolean {
  return existsSync(path)
}

function readJsonFile(path: string): any {
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function writeJsonFile(path: string, data: any): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
}

async function downloadFile(url: string, dest: string): Promise<void> {
  const { default: https } = await import('https')
  const { default: http } = await import('http')
  const fs = await import('fs')

  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`))
        return
      }
      const file = fs.createWriteStream(dest)
      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', reject)
    }).on('error', reject)
  })
}

// ── Node.js Detection ──

export interface NodeCheckResult {
  installed: boolean
  version: string | null
  path: string | null
  nvm: boolean
  recommended: string
}

export async function checkNode(): Promise<NodeCheckResult> {
  const recommended = '22.x LTS'

  // Check nvm
  let nvm = false
  if (!isWin) {
    try {
      const nvmDir = execSync('echo $NVM_DIR', { encoding: 'utf-8', shell: getShellPath() }).trim()
      if (nvmDir && existsSync(nvmDir)) {
        nvm = true
      }
    } catch { /* nvm not found */ }
  }

  // Check Node in PATH
  const nodePath = which('node')
  if (!nodePath) {
    return { installed: false, version: null, path: null, nvm, recommended }
  }

  try {
    const version = execSync('node --version', { encoding: 'utf-8' }).trim()
    return { installed: true, version, path: nodePath, nvm, recommended }
  } catch {
    return { installed: false, version: null, path: nodePath, nvm, recommended }
  }
}

// ── Node.js Installation ──

export async function installNode(opts?: { version?: string }): Promise<{
  success: boolean
  message: string
}> {
  const version = opts?.version || '22'

  // Strategy 1: nvm (macOS/Linux)
  if (!isWin) {
    const nvmPath = which('nvm')
    if (nvmPath || fileExists(join(getHomeDir(), '.nvm/nvm.sh'))) {
      try {
        execSync(`source ~/.nvm/nvm.sh && nvm install ${version} && nvm use ${version} && nvm alias default ${version}`, {
          shell: '/bin/bash',
          encoding: 'utf-8',
          timeout: 300000,
        })
        return { success: true, message: `Node.js ${version} installed via nvm` }
      } catch (err: any) {
        return { success: false, message: `nvm install failed: ${err.message}` }
      }
    }
  }

  // Strategy 2: Download installer
  try {
    const nodeVersion = version.includes('.') ? version : `${version}.0.0`
    const url = isMac
      ? `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}.pkg`
      : `https://nodejs.org/dist/v${nodeVersion}/node-v${nodeVersion}-x64.msi`

    const ext = isMac ? '.pkg' : '.msi'
    const installerPath = join(tmpdir(), `node-installer${ext}`)

    // Download
    await downloadFile(url, installerPath)

    // Install
    if (isMac) {
      // Use osascript to get admin privileges for .pkg install
      execSync(`osascript -e 'do shell script "installer -pkg \\"${installerPath}\\" -target /" with administrator privileges'`, {
        encoding: 'utf-8',
        timeout: 300000,
      })
    } else {
      // Windows: silent install via msiexec
      execSync(`msiexec /i "${installerPath}" /qn /norestart`, {
        encoding: 'utf-8',
        timeout: 300000,
      })
      // Refresh PATH
      execSync(
        'powershell -Command "[System.Environment]::SetEnvironmentVariable(\'PATH\', [System.Environment]::GetEnvironmentVariable(\'PATH\', \'Machine\') + \';\' + [System.Environment]::GetEnvironmentVariable(\'PATH\', \'User\'), \'Process\')"',
        { encoding: 'utf-8' }
      )
    }

    // Cleanup
    try {
      const fs = await import('fs')
      fs.unlinkSync(installerPath)
    } catch { /* ignore cleanup errors */ }

    return { success: true, message: `Node.js ${version} installed successfully` }
  } catch (err: any) {
    return { success: false, message: `Node.js installation failed: ${err.message}` }
  }
}

// ── Claude Code Detection ──

export interface ClaudeCodeCheckResult {
  installed: boolean
  version: string | null
  path: string | null
}

export async function checkClaudeCode(): Promise<ClaudeCodeCheckResult> {
  const claudePath = which('claude')
  if (!claudePath) {
    return { installed: false, version: null, path: null }
  }

  try {
    const version = execSync('claude --version', { encoding: 'utf-8' }).trim()
    return { installed: true, version, path: claudePath }
  } catch {
    return { installed: false, version: null, path: claudePath }
  }
}

// ── Claude Code Installation ──

export async function installClaudeCode(): Promise<{
  success: boolean
  message: string
}> {
  // Try npm mirror first for China users, then fallback to npmjs.org
  const npmMirrors = [
    'https://registry.npmmirror.com',
    'https://registry.npmjs.org',
  ]

  for (const registry of npmMirrors) {
    try {
      const npmCmd = isWin ? 'npm.cmd' : 'npm'
      const result = execSync(
        `${npmCmd} install -g @anthropic-ai/claude-code --registry=${registry}`,
        {
          encoding: 'utf-8',
          timeout: 600000,
          env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' },
        }
      )
      return { success: true, message: `Claude Code installed: ${result.trim()}` }
    } catch (err: any) {
      // Try next mirror
      if (registry === npmMirrors[npmMirrors.length - 1]) {
        return { success: false, message: `Claude Code installation failed: ${err.message}` }
      }
    }
  }

  return { success: false, message: 'Claude Code installation failed' }
}

// ── Combined Environment Installation ──

export async function installEnv(opts?: { nodeVersion?: string }): Promise<{
  success: boolean
  steps: Array<{ name: string; success: boolean; message: string }>
}> {
  const steps: Array<{ name: string; success: boolean; message: string }> = []

  // Step 1: Check and install Node.js
  const nodeCheck = await checkNode()
  if (!nodeCheck.installed) {
    const nodeResult = await installNode({ version: opts?.nodeVersion })
    steps.push({ name: 'Node.js', ...nodeResult })
  } else {
    steps.push({ name: 'Node.js', success: true, message: `Already installed: ${nodeCheck.version}` })
  }

  // Step 2: Install Claude Code
  const claudeCheck = await checkClaudeCode()
  if (!claudeCheck.installed) {
    const claudeResult = await installClaudeCode()
    steps.push({ name: 'Claude Code', ...claudeResult })
  } else {
    steps.push({ name: 'Claude Code', success: true, message: `Already installed: ${claudeCheck.version}` })
  }

  // Step 3: Create default settings
  const settingsPath = getSettingsPath()
  if (!fileExists(settingsPath)) {
    writeJsonFile(settingsPath, DEFAULT_SETTINGS)
    steps.push({ name: 'Settings', success: true, message: 'Default settings created' })
  } else {
    steps.push({ name: 'Settings', success: true, message: 'Settings already exist' })
  }

  // Step 4: Refresh environment
  refreshEnvironment()

  return {
    success: steps.every(s => s.success),
    steps,
  }
}

// ── Environment Refresh ──

export function refreshEnvironment(): void {
  if (isWin) {
    try {
      execSync(
        'powershell -Command "$env:Path = [System.Environment]::GetEnvironmentVariable(\'Path\', \'Machine\') + \';\' + [System.Environment]::GetEnvironmentVariable(\'Path\', \'User\'); $env:Path"',
        { encoding: 'utf-8' }
      )
    } catch { /* ignore */ }
  } else {
    try {
      execSync('hash -r 2>/dev/null || true', { shell: getShellPath(), encoding: 'utf-8' })
    } catch { /* ignore */ }
  }
}

// ── CLI Execution ──

export interface CliResult {
  code: number
  stdout: string
  stderr: string
}

export async function runCli(
  args: string[],
  options?: {
    cwd?: string
    onStdout?: (data: string) => void
    onStderr?: (data: string) => void
    timeout?: number
  }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const claudeCmd = isWin ? 'claude.cmd' : 'claude'
    const shell = isWin ? 'cmd.exe' : getShellPath()
    const shellArgs = isWin ? ['/c', claudeCmd, ...args] : ['-c', `${claudeCmd} ${args.join(' ')}`]

    const proc = spawn(shell, shellArgs, {
      cwd: options?.cwd,
      env: {
        ...process.env,
        HOME: getHomeDir(),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      options?.onStdout?.(text)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      options?.onStderr?.(text)
    })

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Command timed out'))
    }, options?.timeout || 300000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code || 0, stdout, stderr })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

export async function runShell(
  command: string,
  args?: string[],
  options?: {
    cwd?: string
    onStdout?: (data: string) => void
    onStderr?: (data: string) => void
    timeout?: number
  }
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const shell = isWin ? 'cmd.exe' : getShellPath()
    const fullCmd = args ? `${command} ${args.join(' ')}` : command
    const shellArgs = isWin ? ['/c', fullCmd] : ['-c', fullCmd]

    const proc = spawn(shell, shellArgs, {
      cwd: options?.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      stdout += text
      options?.onStdout?.(text)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      stderr += text
      options?.onStderr?.(text)
    })

    const timer = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Command timed out'))
    }, options?.timeout || 120000)

    proc.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code || 0, stdout, stderr })
    })

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

// ── Config Management ──

export function readConfig(filePath?: string): { data: any | null; path: string } {
  const path = filePath || getSettingsPath()
  return { data: readJsonFile(path), path }
}

export function writeConfig(data: object, filePath?: string): { success: boolean; path: string; error?: string } {
  const path = filePath || getSettingsPath()
  try {
    writeJsonFile(path, data)
    return { success: true, path }
  } catch (err: any) {
    return { success: false, path, error: err.message }
  }
}

export function readSettings(): { data: any | null; path: string } {
  return readConfig(getSettingsPath())
}

export function writeSettings(settings: object): { success: boolean; path: string } {
  return writeConfig(settings, getSettingsPath())
}

// ── MCP Server Management ──

export interface McpServerStatus {
  name: string
  configured: boolean
  command?: string
  args?: string[]
  env?: Record<string, string>
}

export async function checkMcpServers(): Promise<McpServerStatus[]> {
  const settings = readJsonFile(getSettingsPath())
  const servers = settings?.mcpServers || {}

  return Object.entries(servers).map(([name, config]: [string, any]) => ({
    name,
    configured: true,
    command: config.command,
    args: config.args,
    env: config.env,
  }))
}

export async function installMcpServer(
  name: string,
  config: { command: string; args: string[]; env?: Record<string, string> }
): Promise<{ success: boolean; message: string }> {
  try {
    const settingsPath = getSettingsPath()
    const settings = readJsonFile(settingsPath) || { env: {}, mcpServers: {} }

    if (!settings.mcpServers) {
      settings.mcpServers = {}
    }

    settings.mcpServers[name] = config
    writeJsonFile(settingsPath, settings)

    return { success: true, message: `MCP server "${name}" configured` }
  } catch (err: any) {
    return { success: false, message: `Failed to configure MCP server: ${err.message}` }
  }
}

export async function uninstallMcpServer(name: string): Promise<{ success: boolean; message: string }> {
  try {
    const settingsPath = getSettingsPath()
    const settings = readJsonFile(settingsPath)

    if (!settings?.mcpServers?.[name]) {
      return { success: false, message: `MCP server "${name}" not found` }
    }

    delete settings.mcpServers[name]
    writeJsonFile(settingsPath, settings)

    return { success: true, message: `MCP server "${name}" removed` }
  } catch (err: any) {
    return { success: false, message: `Failed to remove MCP server: ${err.message}` }
  }
}

// ── WeChat ACP Integration ──

export async function checkWechatAcp(): Promise<{
  installed: boolean
  configured: boolean
  version: string | null
}> {
  const settings = readJsonFile(getSettingsPath())
  const servers = settings?.mcpServers || {}
  const wechatConfigured = 'wechat-acp' in servers

  // Check if wechat-acp npm package is available
  let version: string | null = null
  try {
    const npmCmd = isWin ? 'npm.cmd' : 'npm'
    version = execSync(
      `${npmCmd} list -g wechat-acp 2>/dev/null | grep wechat-acp | awk '{print $2}'`,
      { encoding: 'utf-8', shell: getShellPath() }
    ).trim() || null
  } catch { /* not installed globally */ }

  return {
    installed: version !== null,
    configured: wechatConfigured,
    version,
  }
}

export async function installWechatAcp(opts?: {
  token?: string
  appId?: string
  appSecret?: string
}): Promise<{
  success: boolean
  message: string
  steps: Array<{ name: string; success: boolean; message: string }>
}> {
  const steps: Array<{ name: string; success: boolean; message: string }> = []

  // Step 1: Install wechat-acp npm package
  try {
    const npmCmd = isWin ? 'npm.cmd' : 'npm'
    execSync(
      `${npmCmd} install -g wechat-acp --registry=https://registry.npmmirror.com || ${npmCmd} install -g wechat-acp`,
      { encoding: 'utf-8', timeout: 300000 }
    )
    steps.push({ name: 'wechat-acp package', success: true, message: 'Installed globally' })
  } catch (err: any) {
    steps.push({ name: 'wechat-acp package', success: false, message: err.message })
    // Continue anyway - it might be an npx-based MCP server
  }

  // Step 2: Configure as MCP server in settings.json
  try {
    const settingsPath = getSettingsPath()
    const settings = readJsonFile(settingsPath) || { env: {}, mcpServers: {} }

    if (!settings.mcpServers) {
      settings.mcpServers = {}
    }

    // Configure WeChat ACP as MCP server
    const wechatAcpConfig: any = {
      command: 'npx',
      args: ['-y', 'wechat-acp'],
    }

    // Add environment variables if provided
    if (opts?.token) {
      wechatAcpConfig.env = { WECHAT_ACP_TOKEN: opts.token }
    }
    if (opts?.appId || opts?.appSecret) {
      wechatAcpConfig.env = {
        ...wechatAcpConfig.env,
        WECHAT_APP_ID: opts?.appId || '',
        WECHAT_APP_SECRET: opts?.appSecret || '',
      }
    }

    settings.mcpServers['wechat-acp'] = wechatAcpConfig
    writeJsonFile(settingsPath, settings)

    steps.push({ name: 'MCP configuration', success: true, message: 'WeChat ACP added to settings.json' })
  } catch (err: any) {
    steps.push({ name: 'MCP configuration', success: false, message: err.message })
  }

  return {
    success: steps.every(s => s.success),
    message: steps.every(s => s.success) ? 'WeChat ACP installed and configured' : 'WeChat ACP setup completed with errors',
    steps,
  }
}

// ── Status Overview ──

export async function getStatus(): Promise<{
  node: NodeCheckResult
  claudeCode: ClaudeCodeCheckResult
  wechatAcp: Awaited<ReturnType<typeof checkWechatAcp>>
  mcpServers: McpServerStatus[]
  settingsPath: string
  claudeDir: string
}> {
  const [node, claudeCode, wechatAcp, mcpServers] = await Promise.all([
    checkNode(),
    checkClaudeCode(),
    checkWechatAcp(),
    checkMcpServers(),
  ])

  return {
    node,
    claudeCode,
    wechatAcp,
    mcpServers,
    settingsPath: getSettingsPath(),
    claudeDir: getClaudeDir(),
  }
}

// ── Doctor / Diagnostics ──

export async function runDoctor(
  onOutput?: (data: string) => void
): Promise<{
  success: boolean
  results: Array<{ check: string; status: 'pass' | 'warn' | 'fail'; message: string }>
}> {
  const results: Array<{ check: string; status: 'pass' | 'warn' | 'fail'; message: string }> = []

  const log = (msg: string) => onOutput?.(msg)

  // Check 1: Node.js
  log('Checking Node.js...')
  const nodeCheck = await checkNode()
  if (nodeCheck.installed) {
    results.push({ check: 'Node.js', status: 'pass', message: `v${nodeCheck.version}` })
    log(`  ✓ Node.js ${nodeCheck.version} found at ${nodeCheck.path}`)
  } else {
    results.push({ check: 'Node.js', status: 'fail', message: 'Not installed' })
    log('  ✗ Node.js not found')
  }

  // Check 2: npm
  log('Checking npm...')
  const npmPath = which('npm')
  if (npmPath) {
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim()
      results.push({ check: 'npm', status: 'pass', message: `v${npmVersion}` })
      log(`  ✓ npm ${npmVersion}`)
    } catch {
      results.push({ check: 'npm', status: 'fail', message: 'Cannot get version' })
      log('  ✗ npm found but cannot get version')
    }
  } else {
    results.push({ check: 'npm', status: 'fail', message: 'Not installed' })
    log('  ✗ npm not found')
  }

  // Check 3: Claude Code
  log('Checking Claude Code...')
  const claudeCheck = await checkClaudeCode()
  if (claudeCheck.installed) {
    results.push({ check: 'Claude Code', status: 'pass', message: claudeCheck.version || 'Installed' })
    log(`  ✓ Claude Code ${claudeCheck.version}`)
  } else {
    results.push({ check: 'Claude Code', status: 'fail', message: 'Not installed' })
    log('  ✗ Claude Code not found')
  }

  // Check 4: Settings
  log('Checking settings...')
  const settingsPath = getSettingsPath()
  if (fileExists(settingsPath)) {
    const settings = readJsonFile(settingsPath)
    const serverCount = Object.keys(settings?.mcpServers || {}).length
    results.push({ check: 'Settings', status: 'pass', message: `Found with ${serverCount} MCP servers` })
    log(`  ✓ Settings found at ${settingsPath}`)
    log(`    ${serverCount} MCP servers configured`)
  } else {
    results.push({ check: 'Settings', status: 'warn', message: 'Not found (will be created on install)' })
    log('  ⚠ Settings not found (will be created on first install)')
  }

  // Check 5: Network connectivity
  log('Checking network...')
  try {
    execSync('curl -s -o /dev/null -w "%{http_code}" https://registry.npmjs.org/ | head -1', {
      encoding: 'utf-8',
      timeout: 10000,
    })
    results.push({ check: 'Network', status: 'pass', message: 'npm registry reachable' })
    log('  ✓ npm registry reachable')
  } catch {
    results.push({ check: 'Network', status: 'warn', message: 'Cannot reach npm registry' })
    log('  ⚠ Cannot reach npm registry (mirror will be tried)')
  }

  // Check 6: Platform info
  log(`Platform: ${platform()} ${arch()}`)
  log(`Home: ${getHomeDir()}`)
  log(`Claude dir: ${getClaudeDir()}`)

  const passCount = results.filter(r => r.status === 'pass').length
  const failCount = results.filter(r => r.status === 'fail').length

  log(`\nDoctor complete: ${passCount} passed, ${failCount} failed`)

  return {
    success: failCount === 0,
    results,
  }
}
