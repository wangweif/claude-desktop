import { type ReactNode, useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Button, TextInput, Stack, Text, Group } from '@mantine/core'
import Welcome from './pages/Welcome'
import EnvCheck from './pages/EnvCheck'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import MainLayout from './components/MainLayout'
import type { SystemStatus } from './types'

type AppState = 'welcome' | 'env-check' | 'setup' | 'dashboard'

type SetupStep = 'api-config' | 'mcp' | 'wechat'

const SETUP_STEPS: { key: SetupStep; label: string }[] = [
  { key: 'api-config', label: 'API 配置' },
  { key: 'mcp', label: 'MCP 服务器' },
  { key: 'wechat', label: 'WeChat ACP' },
]

function App() {
  const [appState, setAppState] = useState<AppState>('welcome')
  const [setupStep, setSetupStep] = useState<SetupStep>('api-config')
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [settings, setSettings] = useState<any>(null)

  const refreshStatus = async () => {
    try {
      const newStatus = await window.api.getStatus()
      setStatus(newStatus)
    } catch (err) {
      console.error('Failed to refresh status:', err)
    }
  }

  const handleEnvReady = async (envStatus: SystemStatus) => {
    setStatus(envStatus)
    try {
      const { data } = await window.api.readSettings()
      setSettings(data || { env: {}, mcpServers: {} })
    } catch {
      setSettings({ env: {}, mcpServers: {} })
    }
    // If everything is configured, go straight to dashboard
    if (envStatus.node.installed && envStatus.claudeCode.installed) {
      setAppState('dashboard')
    } else {
      setAppState('setup')
      setSetupStep('api-config')
    }
  }

  const handleSetupComplete = () => {
    refreshStatus()
    setAppState('dashboard')
  }

  const handleReconfigure = () => {
    setAppState('setup')
    setSetupStep('api-config')
  }

  const currentStepIndex = SETUP_STEPS.findIndex((s) => s.key === setupStep)

  const renderFrame = (content: ReactNode, scrollable = true) => (
    <div className="h-screen flex flex-col app-bg-primary app-text-primary">
      <div className="h-10 flex-shrink-0 flex items-center justify-center gap-1.5" style={{ WebkitAppRegion: 'drag' } as any}>
        <svg className="w-6 h-6 select-none pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-xs app-text-faint select-none">Claude Installer</span>
      </div>
      <div className={`flex-1 flex items-center justify-center px-6 pb-6 ${scrollable ? 'overflow-y-auto' : 'overflow-hidden'}`}>{content}</div>
    </div>
  )

  // Welcome
  if (appState === 'welcome') {
    return renderFrame(
      <div className="w-full max-w-xl px-2 pb-6">
        <Welcome onAccept={() => setAppState('env-check')} />
      </div>,
      false
    )
  }

  // Environment check
  if (appState === 'env-check') {
    return renderFrame(
      <div className="w-full max-w-md px-2">
        <EnvCheck onReady={handleEnvReady} />
      </div>
    )
  }

  // Dashboard
  if (appState === 'dashboard') {
    return (
      <HashRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard status={status} onRefresh={refreshStatus} onReconfigure={handleReconfigure} />} />
            <Route path="/settings" element={<Settings status={status} onRefresh={refreshStatus} settings={settings} onSettingsChange={setSettings} />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    )
  }

  // Setup wizard (Qclaw-style step indicators)
  const setupView = (
    <div className="h-screen app-bg-primary app-text-primary flex flex-col">
      <div className="h-8 flex-shrink-0 flex items-center justify-center gap-1.5" style={{ WebkitAppRegion: 'drag' } as any}>
        <svg className="w-4 h-4 select-none pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="text-[10px] app-text-faint select-none">Claude Installer</span>
      </div>

      {/* Step indicators */}
      <div className="flex justify-center gap-6 pt-2 pb-4">
        {SETUP_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < currentStepIndex
                  ? 'bg-emerald-500 text-black'
                  : i === currentStepIndex
                  ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500'
                  : 'app-bg-tertiary app-text-muted'
              }`}
            >
              {i < currentStepIndex ? '✓' : i + 1}
            </div>
            <span
              className={`text-xs transition-colors ${
                i === currentStepIndex ? 'app-text-secondary' : 'app-text-muted'
              }`}
            >
              {s.label}
            </span>
            {i < SETUP_STEPS.length - 1 && <div className="w-8 h-px app-bg-tertiary ml-2" />}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex justify-center px-6 pb-6 overflow-y-auto">
        <div className="w-full max-w-lg pt-2">
          {setupStep === 'api-config' && (
            <ApiConfigStep
              settings={settings}
              onSettingsChange={setSettings}
              onNext={() => setSetupStep('mcp')}
              onSkip={handleSetupComplete}
            />
          )}
          {setupStep === 'mcp' && (
            <McpStep
              settings={settings}
              onSettingsChange={setSettings}
              onNext={() => setSetupStep('wechat')}
              onBack={() => setSetupStep('api-config')}
              onSkip={handleSetupComplete}
            />
          )}
          {setupStep === 'wechat' && (
            <WechatStep
              onBack={() => setSetupStep('mcp')}
              onComplete={handleSetupComplete}
              onSkip={handleSetupComplete}
            />
          )}
        </div>
      </div>
    </div>
  )

  return setupView
}

// ── Setup Step Components ──

function ApiConfigStep({
  settings,
  onSettingsChange,
  onNext,
  onSkip,
}: {
  settings: any
  onSettingsChange: (s: any) => void
  onNext: () => void
  onSkip: () => void
}) {
  const [saving, setSaving] = useState(false)

  const updateEnv = (key: string, value: string) => {
    onSettingsChange({ ...settings, env: { ...settings.env, [key]: value } })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.writeSettings(settings)
    } catch (err) {
      console.error('Failed to save:', err)
    }
    setSaving(false)
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <Text size="sm" fw={500} className="app-text-primary">API 配置</Text>
      <Text size="xs" className="app-text-secondary">
        配置 Claude Code 的 API 地址和模型。默认使用智谱 GLM API 代理，也可切换为 Anthropic 官方 API。
      </Text>

      <Stack gap="sm">
        <TextInput
          label="API 地址"
          value={settings?.env?.ANTHROPIC_BASE_URL || ''}
          onChange={(e: any) => updateEnv('ANTHROPIC_BASE_URL', e.currentTarget.value)}
          size="sm"
        />
        <TextInput
          label="API 令牌（可选）"
          type="password"
          value={settings?.env?.ANTHROPIC_AUTH_TOKEN || ''}
          onChange={(e: any) => updateEnv('ANTHROPIC_AUTH_TOKEN', e.currentTarget.value)}
          placeholder="留空则使用系统默认认证"
          size="sm"
        />
        <TextInput
          label="快速模型（Haiku 层级）"
          value={settings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL || ''}
          onChange={(e: any) => updateEnv('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.currentTarget.value)}
          size="sm"
        />
        <TextInput
          label="标准模型（Sonnet 层级）"
          value={settings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL || ''}
          onChange={(e: any) => updateEnv('ANTHROPIC_DEFAULT_SONNET_MODEL', e.currentTarget.value)}
          size="sm"
        />
        <TextInput
          label="强力模型（Opus 层级）"
          value={settings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL || ''}
          onChange={(e: any) => updateEnv('ANTHROPIC_DEFAULT_OPUS_MODEL', e.currentTarget.value)}
          size="sm"
        />
      </Stack>

      <Group>
        <Button size="sm" onClick={handleSave} loading={saving}>
          保存并继续
        </Button>
        <Button size="sm" variant="default" color="gray" onClick={onSkip}>
          跳过
        </Button>
      </Group>
    </div>
  )
}

function McpStep({
  settings,
  onSettingsChange,
  onNext,
  onBack,
  onSkip,
}: {
  settings: any
  onSettingsChange: (s: any) => void
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}) {
  const [serverName, setServerName] = useState('')
  const [serverCommand, setServerCommand] = useState('npx')
  const [serverArgs, setServerArgs] = useState('')

  const presets = [
    { name: 'sequential-thinking', desc: '复杂推理', args: '-y @modelcontextprotocol/server-sequential-thinking' },
    { name: 'playwright', desc: '浏览器自动化', args: '-y @playwright/mcp@latest' },
    { name: 'memory', desc: '知识图谱记忆', args: '-y @modelcontextprotocol/server-memory' },
    { name: 'filesystem', desc: '文件系统', args: '-y @modelcontextprotocol/server-filesystem /' },
  ]

  const addPreset = (p: typeof presets[0]) => {
    if (settings?.mcpServers?.[p.name]) return
    const updated = {
      ...settings,
      mcpServers: { ...settings.mcpServers, [p.name]: { command: 'npx', args: p.args.split(' ') } },
    }
    onSettingsChange(updated)
  }

  const addCustom = async () => {
    if (!serverName.trim()) return
    const updated = {
      ...settings,
      mcpServers: {
        ...settings.mcpServers,
        [serverName.trim()]: { command: serverCommand, args: serverArgs.split(/\s+/).filter(Boolean) },
      },
    }
    onSettingsChange(updated)
    setServerName('')
    setServerArgs('')
  }

  const handleSave = async () => {
    try {
      await window.api.writeSettings(settings)
    } catch (err) {
      console.error('Failed to save:', err)
    }
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <Text size="sm" fw={500} className="app-text-primary">MCP 服务器配置</Text>
      <Text size="xs" className="app-text-secondary">
        MCP 服务器可以扩展 Claude Code 的能力。你可以快速添加预设或自定义服务器。
      </Text>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.name}
            onClick={() => addPreset(p)}
            disabled={!!settings?.mcpServers?.[p.name]}
            className="px-3 py-1.5 rounded-lg text-xs transition-colors border app-border app-text-secondary hover:app-bg-tertiary disabled:opacity-40 disabled:cursor-default"
          >
            {p.name} ({p.desc})
          </button>
        ))}
      </div>

      {/* Custom server */}
      <Stack gap="xs">
        <Text size="xs" fw={500} className="app-text-muted">添加自定义服务器</Text>
        <Group grow>
          <TextInput size="xs" placeholder="名称" value={serverName} onChange={(e: any) => setServerName(e.currentTarget.value)} />
          <TextInput size="xs" placeholder="参数" value={serverArgs} onChange={(e: any) => setServerArgs(e.currentTarget.value)} />
        </Group>
        <Button size="xs" variant="light" onClick={addCustom} disabled={!serverName.trim()}>添加</Button>
      </Stack>

      <Group>
        <Button size="sm" onClick={handleSave}>保存并继续</Button>
        <Button size="sm" variant="default" color="gray" onClick={onBack}>返回</Button>
        <Button size="sm" variant="default" color="gray" onClick={onSkip}>跳过</Button>
      </Group>
    </div>
  )
}

function WechatStep({
  onBack,
  onComplete,
  onSkip,
}: {
  onBack: () => void
  onComplete: () => void
  onSkip: () => void
}) {
  const [token, setToken] = useState('')
  const [installing, setInstalling] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const handleInstall = async () => {
    setInstalling(true)
    setLogs([])
    try {
      const result = await window.api.installWechatAcp({ token: token || undefined })
      if (result.steps) {
        result.steps.forEach((step: any) => {
          setLogs((prev) => [...prev, `  ${step.name}: ${step.success ? 'OK' : 'FAIL'} - ${step.message}`])
        })
      }
      setLogs((prev) => [...prev, result.message || (result.success ? '安装成功' : '安装失败')])
    } catch (err: any) {
      setLogs((prev) => [...prev, `错误: ${err.message}`])
    }
    setInstalling(false)
    onComplete()
  }

  return (
    <div className="flex flex-col gap-4">
      <Text size="sm" fw={500} className="app-text-primary">WeChat ACP</Text>
      <Text size="xs" className="app-text-secondary">
        将 WeChat ACP 配置为 MCP 服务器，实现 Claude Code 与微信的集成。此步骤为可选。
      </Text>

      <Stack gap="sm">
        <TextInput
          label="WeChat 令牌（可选）"
          value={token}
          onChange={(e: any) => setToken(e.currentTarget.value)}
          placeholder="输入你的 WeChat ACP 令牌"
          size="sm"
        />
      </Stack>

      {logs.length > 0 && (
        <div className="w-full rounded-lg app-bg-inset px-3 py-2 max-h-24 overflow-y-auto">
          <div className="terminal-output app-text-muted">
            {logs.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}

      <Group>
        <Button size="sm" onClick={handleInstall} loading={installing}>安装 WeChat ACP</Button>
        <Button size="sm" variant="default" color="gray" onClick={onBack}>返回</Button>
        <Button size="sm" variant="default" color="gray" onClick={onSkip}>跳过</Button>
      </Group>
    </div>
  )
}

export default App
