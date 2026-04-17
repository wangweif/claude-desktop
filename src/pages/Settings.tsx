import { useState, useEffect } from 'react'
import type { SystemStatus } from '../types'

interface Props {
  status: SystemStatus | null
  onRefresh: () => Promise<void>
}

// Common MCP server presets
const MCP_PRESETS: Array<{
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
}> = [
  {
    name: 'sequential-thinking',
    description: 'Sequential thinking for complex reasoning',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
  {
    name: 'playwright',
    description: 'Browser automation and testing',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
  },
  {
    name: 'memory',
    description: 'Persistent knowledge graph memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
  {
    name: 'context7',
    description: 'Library documentation lookup',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
  },
  {
    name: 'chrome-devtools',
    description: 'Chrome DevTools Protocol MCP',
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp'],
  },
  {
    name: 'filesystem',
    description: 'File system access with configurable paths',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
  },
  {
    name: 'github',
    description: 'GitHub API integration',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
  },
  {
    name: 'tavily',
    description: 'Web search via Tavily API',
    command: 'npx',
    args: ['-y', 'tavily-mcp'],
    env: { TAVILY_API_KEY: '' },
  },
]

export default function Settings({ status, onRefresh }: Props) {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'general' | 'mcp' | 'models' | 'env'>('general')

  // MCP server form
  const [newServerName, setNewServerName] = useState('')
  const [newServerCommand, setNewServerCommand] = useState('npx')
  const [newServerArgs, setNewServerArgs] = useState('')
  const [newServerEnv, setNewServerEnv] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await window.api.readSettings()
      setSettings(data || { env: {}, mcpServers: {} })
    } catch (err) {
      console.error('Failed to load settings:', err)
    }
    setLoading(false)
  }

  const saveSettings = async (newSettings: any) => {
    setSaving(true)
    setMessage(null)
    try {
      const result = await window.api.writeSettings(newSettings)
      if (result.success) {
        setSettings(newSettings)
        setMessage({ type: 'success', text: 'Settings saved successfully' })
        await onRefresh()
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    }
    setSaving(false)
    setTimeout(() => setMessage(null), 3000)
  }

  const addMcpServer = async () => {
    if (!newServerName.trim()) return

    const config: any = {
      command: newServerCommand.trim(),
      args: newServerArgs.trim().split(/\s+/).filter(Boolean),
    }

    // Parse env variables (KEY=VALUE format, one per line)
    const envLines = newServerEnv.trim().split('\n').filter(Boolean)
    if (envLines.length > 0) {
      config.env = {}
      envLines.forEach((line) => {
        const [key, ...rest] = line.split('=')
        if (key) {
          config.env[key.trim()] = rest.join('=').trim()
        }
      })
    }

    const updatedSettings = {
      ...settings,
      mcpServers: {
        ...settings.mcpServers,
        [newServerName.trim()]: config,
      },
    }

    await saveSettings(updatedSettings)
    setNewServerName('')
    setNewServerArgs('')
    setNewServerEnv('')
  }

  const addPresetServer = async (preset: typeof MCP_PRESETS[0]) => {
    const updatedSettings = {
      ...settings,
      mcpServers: {
        ...settings.mcpServers,
        [preset.name]: {
          command: preset.command,
          args: preset.args,
          ...(preset.env ? { env: preset.env } : {}),
        },
      },
    }
    await saveSettings(updatedSettings)
  }

  const removeMcpServer = async (name: string) => {
    const updatedSettings = {
      ...settings,
      mcpServers: { ...settings.mcpServers },
    }
    delete updatedSettings.mcpServers[name]
    await saveSettings(updatedSettings)
  }

  const updateEnvVar = (key: string, value: string) => {
    const updatedSettings = {
      ...settings,
      env: { ...settings.env, [key]: value },
    }
    setSettings(updatedSettings)
  }

  const saveEnvChanges = () => {
    saveSettings(settings)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-200 mb-1">Settings</h1>
          <p className="text-sm text-slate-400">Configure Claude Code, MCP servers, and environment</p>
        </div>
        {message && (
          <span className={`text-sm px-3 py-1 rounded-full ${
            message.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {message.text}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#334155]">
        {[
          { id: 'general' as const, label: 'General' },
          { id: 'mcp' as const, label: `MCP Servers (${Object.keys(settings?.mcpServers || {}).length})` },
          { id: 'models' as const, label: 'Models' },
          { id: 'env' as const, label: 'Environment' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">API Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Base URL</label>
                <input
                  type="text"
                  value={settings?.env?.ANTHROPIC_BASE_URL || ''}
                  onChange={(e) => updateEnvVar('ANTHROPIC_BASE_URL', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  placeholder="https://api.anthropic.com"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Token</label>
                <input
                  type="password"
                  value={settings?.env?.ANTHROPIC_AUTH_TOKEN || ''}
                  onChange={(e) => updateEnvVar('ANTHROPIC_AUTH_TOKEN', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  placeholder="Enter your API token"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">API Timeout (ms)</label>
                <input
                  type="text"
                  value={settings?.env?.API_TIMEOUT_MS || '30000000'}
                  onChange={(e) => updateEnvVar('API_TIMEOUT_MS', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <button
              onClick={saveEnvChanges}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* MCP Servers Tab */}
      {activeTab === 'mcp' && (
        <div className="space-y-4">
          {/* Currently configured servers */}
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155]">
            <div className="px-4 py-3 border-b border-[#334155]">
              <h3 className="text-sm font-medium text-slate-300">Configured MCP Servers</h3>
            </div>
            {Object.keys(settings?.mcpServers || {}).length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                No MCP servers configured. Add one below or use a preset.
              </div>
            ) : (
              <div className="divide-y divide-[#334155]">
                {Object.entries(settings?.mcpServers || {}).map(([name, config]: [string, any]) => (
                  <div key={name} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-300">{name}</span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {config.command} {config.args?.join(' ')}
                        </p>
                        {config.env && Object.keys(config.env).length > 0 && (
                          <p className="text-xs text-slate-600 mt-0.5">
                            Env: {Object.keys(config.env).join(', ')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeMcpServer(name)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Custom Server */}
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Add Custom MCP Server</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="my-server"
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Command</label>
                <input
                  type="text"
                  value={newServerCommand}
                  onChange={(e) => setNewServerCommand(e.target.value)}
                  placeholder="npx"
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Arguments (space-separated)</label>
              <input
                type="text"
                value={newServerArgs}
                onChange={(e) => setNewServerArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-memory"
                className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Environment Variables (KEY=VALUE, one per line)</label>
              <textarea
                value={newServerEnv}
                onChange={(e) => setNewServerEnv(e.target.value)}
                placeholder={"API_KEY=your-key\nOTHER=value"}
                rows={2}
                className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
            <button
              onClick={addMcpServer}
              disabled={!newServerName.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              Add Server
            </button>
          </div>

          {/* Presets */}
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Quick Add Presets</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MCP_PRESETS.filter((p) => !(settings?.mcpServers?.[p.name])).map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => addPresetServer(preset)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#0f0f1a] hover:bg-[#151627] border border-[#334155] rounded-md text-left transition-colors"
                >
                  <span className="text-sm text-slate-300">{preset.name}</span>
                  <span className="text-xs text-slate-500 truncate">{preset.description}</span>
                </button>
              ))}
            </div>
            {MCP_PRESETS.filter((p) => !(settings?.mcpServers?.[p.name])).length === 0 && (
              <p className="text-sm text-slate-500 text-center py-2">All presets are already configured</p>
            )}
          </div>
        </div>
      )}

      {/* Models Tab */}
      {activeTab === 'models' && (
        <div className="space-y-4">
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Model Configuration</h3>
            <p className="text-xs text-slate-400 mb-4">
              Configure which AI models Claude Code uses for different tasks. These map to the model tiers used by Claude Code internally.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Fast Model (Haiku tier)</label>
                <input
                  type="text"
                  value={settings?.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL || ''}
                  onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  placeholder="claude-3-5-haiku-20241022"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Standard Model (Sonnet tier)</label>
                <input
                  type="text"
                  value={settings?.env?.ANTHROPIC_DEFAULT_SONNET_MODEL || ''}
                  onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_SONNET_MODEL', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  placeholder="claude-sonnet-4-20250514"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Powerful Model (Opus tier)</label>
                <input
                  type="text"
                  value={settings?.env?.ANTHROPIC_DEFAULT_OPUS_MODEL || ''}
                  onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_OPUS_MODEL', e.target.value)}
                  className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  placeholder="claude-opus-4-20250514"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={saveEnvChanges}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => {
                  const glmDefaults = {
                    ...settings,
                    env: {
                      ...settings.env,
                      ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic',
                      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air',
                      ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5-turbo',
                      ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1',
                    },
                  }
                  setSettings(glmDefaults)
                }}
                className="px-4 py-2 bg-[#252640] hover:bg-[#2d2e4a] text-slate-400 text-sm rounded-md border border-[#334155] transition-colors"
              >
                Use GLM Defaults
              </button>
              <button
                onClick={() => {
                  const claudeDefaults = {
                    ...settings,
                    env: {
                      ...settings.env,
                      ANHROPIC_BASE_URL: 'https://api.anthropic.com',
                      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-3-5-haiku-20241022',
                      ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-4-20250514',
                      ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-20250514',
                    },
                  }
                  setSettings(claudeDefaults)
                }}
                className="px-4 py-2 bg-[#252640] hover:bg-[#2d2e4a] text-slate-400 text-sm rounded-md border border-[#334155] transition-colors"
              >
                Use Claude Defaults
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Environment Tab */}
      {activeTab === 'env' && (
        <div className="space-y-4">
          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Environment Variables</h3>
            <p className="text-xs text-slate-400 mb-4">
              These environment variables are set when Claude Code runs.
            </p>
            <div className="space-y-2">
              {Object.entries(settings?.env || {}).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-slate-400 w-64 shrink-0 font-mono">{key}</label>
                  <input
                    type={key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET') ? 'password' : 'text'}
                    value={value as string}
                    onChange={(e) => updateEnvVar(key, e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveEnvChanges}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Experimental Features</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings?.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'}
                  onChange={(e) => updateEnvVar('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', e.target.checked ? '1' : '0')}
                  className="w-4 h-4 rounded border-[#334155] bg-[#0f0f1a] text-indigo-500 focus:ring-indigo-500"
                />
                <span className="text-sm text-slate-300">Agent Teams (multi-agent collaboration)</span>
              </label>
            </div>
            <button
              onClick={saveEnvChanges}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
