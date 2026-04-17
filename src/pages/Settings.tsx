import { useState, useEffect } from 'react'
import { Tabs, TextInput, Textarea, Button, ActionIcon, Group, Stack, Text, Switch } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconTrash, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import type { SystemStatus } from '../types'

interface Props {
  status: SystemStatus | null
  onRefresh: () => Promise<void>
  settings: any
  onSettingsChange: (s: any) => void
}

const MCP_PRESETS: Array<{
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
}> = [
  { name: 'sequential-thinking', description: '复杂推理的顺序思维', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'] },
  { name: 'playwright', description: '浏览器自动化和测试', command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
  { name: 'memory', description: '持久化知识图谱记忆', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  { name: 'context7', description: '库文档查询', command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
  { name: 'filesystem', description: '文件系统访问', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/'] },
  { name: 'github', description: 'GitHub API', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' } },
]

export default function Settings({ status, onRefresh, settings, onSettingsChange }: Props) {
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>('general')
  const [newServerName, setNewServerName] = useState('')
  const [newServerCommand, setNewServerCommand] = useState('npx')
  const [newServerArgs, setNewServerArgs] = useState('')
  const [newServerEnv, setNewServerEnv] = useState('')

  const saveSettings = async (newSettings: any) => {
    setSaving(true)
    try {
      const result = await window.api.writeSettings(newSettings)
      if (result.success) {
        onSettingsChange(newSettings)
        notifications.show({ title: '成功', message: '设置保存成功', color: 'green', icon: <IconCheck size={16} /> })
        await onRefresh()
      } else {
        notifications.show({ title: '失败', message: '保存设置失败', color: 'red', icon: <IconAlertCircle size={16} /> })
      }
    } catch {
      notifications.show({ title: '失败', message: '保存设置失败', color: 'red', icon: <IconAlertCircle size={16} /> })
    }
    setSaving(false)
  }

  const updateEnvVar = (key: string, value: string) => {
    onSettingsChange({ ...settings, env: { ...settings.env, [key]: value } })
  }

  const saveEnvChanges = () => saveSettings(settings)

  const addMcpServer = async () => {
    if (!newServerName.trim()) return
    const config: any = { command: newServerCommand.trim(), args: newServerArgs.trim().split(/\s+/).filter(Boolean) }
    const envLines = newServerEnv.trim().split('\n').filter(Boolean)
    if (envLines.length > 0) {
      config.env = {}
      envLines.forEach((line) => {
        const [key, ...rest] = line.split('=')
        if (key) config.env[key.trim()] = rest.join('=').trim()
      })
    }
    const updated = { ...settings, mcpServers: { ...settings.mcpServers, [newServerName.trim()]: config } }
    await saveSettings(updated)
    setNewServerName('')
    setNewServerArgs('')
    setNewServerEnv('')
  }

  const addPresetServer = async (preset: typeof MCP_PRESETS[0]) => {
    const updated = {
      ...settings,
      mcpServers: { ...settings.mcpServers, [preset.name]: { command: preset.command, args: preset.args, ...(preset.env ? { env: preset.env } : {}) } },
    }
    await saveSettings(updated)
  }

  const removeMcpServer = async (name: string) => {
    const updated = { ...settings, mcpServers: { ...settings.mcpServers } }
    delete updated.mcpServers[name]
    await saveSettings(updated)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    )
  }

  const mcpCount = Object.keys(settings.mcpServers || {}).length

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Text size="lg" fw={600} className="app-text-primary">设置</Text>
        <Text size="xs" className="app-text-secondary mt-1">配置 Claude Code、MCP 服务器和环境变量</Text>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="general">通用</Tabs.Tab>
          <Tabs.Tab value="mcp">MCP 服务器 ({mcpCount})</Tabs.Tab>
          <Tabs.Tab value="models">模型</Tabs.Tab>
          <Tabs.Tab value="env">环境变量</Tabs.Tab>
        </Tabs.List>

        {/* General Tab */}
        <Tabs.Panel value="general">
          <div className="rounded-lg app-bg-secondary p-5">
            <Text size="sm" fw={500} mb="md">API 配置</Text>
            <Stack gap="sm">
              <TextInput label="API 地址" value={settings.env?.ANTHROPIC_BASE_URL || ''} onChange={(e) => updateEnvVar('ANTHROPIC_BASE_URL', e.currentTarget.value)} size="sm" />
              <TextInput label="API 令牌" type="password" value={settings.env?.ANTHROPIC_AUTH_TOKEN || ''} onChange={(e) => updateEnvVar('ANTHROPIC_AUTH_TOKEN', e.currentTarget.value)} size="sm" />
              <TextInput label="API 超时时间 (毫秒)" value={settings.env?.API_TIMEOUT_MS || '30000000'} onChange={(e) => updateEnvVar('API_TIMEOUT_MS', e.currentTarget.value)} size="sm" />
              <Button size="sm" onClick={saveEnvChanges} loading={saving}>保存更改</Button>
            </Stack>
          </div>
        </Tabs.Panel>

        {/* MCP Servers Tab */}
        <Tabs.Panel value="mcp">
          <Stack gap="md">
            <div className="rounded-lg app-bg-secondary">
              <div className="px-4 py-2.5 border-b app-border">
                <Text size="sm" fw={500}>已配置的 MCP 服务器</Text>
              </div>
              {Object.keys(settings.mcpServers || {}).length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Text size="sm" className="app-text-muted">暂未配置 MCP 服务器</Text>
                </div>
              ) : (
                <div>
                  {Object.entries(settings.mcpServers || {}).map(([name, config]: [string, any]) => (
                    <div key={name} className="px-4 py-2.5 border-b app-border-light last:border-b-0 flex items-center justify-between">
                      <div>
                        <Text size="sm" fw={500}>{name}</Text>
                        <Text size="xs" className="app-text-faint">{config.command} {config.args?.join(' ')}</Text>
                      </div>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeMcpServer(name)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg app-bg-secondary p-5">
              <Text size="sm" fw={500} mb="md">添加自定义 MCP 服务器</Text>
              <Stack gap="sm">
                <Group grow>
                  <TextInput label="名称" value={newServerName} onChange={(e) => setNewServerName(e.currentTarget.value)} size="sm" />
                  <TextInput label="命令" value={newServerCommand} onChange={(e) => setNewServerCommand(e.currentTarget.value)} size="sm" />
                </Group>
                <TextInput label="参数（空格分隔）" value={newServerArgs} onChange={(e) => setNewServerArgs(e.currentTarget.value)} size="sm" />
                <Textarea label="环境变量（KEY=VALUE，每行一个）" value={newServerEnv} onChange={(e) => setNewServerEnv(e.currentTarget.value)} rows={2} size="sm" />
                <Button size="sm" onClick={addMcpServer} disabled={!newServerName.trim()} leftSection={<IconPlus size={14} />}>添加服务器</Button>
              </Stack>
            </div>

            <div className="rounded-lg app-bg-secondary p-5">
              <Text size="sm" fw={500} mb="md">快速添加预设</Text>
              <div className="flex flex-wrap gap-2">
                {MCP_PRESETS.filter((p) => !(settings.mcpServers?.[p.name])).map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => addPresetServer(preset)}
                    className="px-3 py-1.5 rounded-lg text-xs transition-colors border app-border app-text-secondary hover:app-bg-tertiary"
                  >
                    {preset.name} - {preset.description}
                  </button>
                ))}
              </div>
              {MCP_PRESETS.filter((p) => !(settings.mcpServers?.[p.name])).length === 0 && (
                <Text size="sm" className="app-text-muted" ta="center" py="xs">所有预设均已配置</Text>
              )}
            </div>
          </Stack>
        </Tabs.Panel>

        {/* Models Tab */}
        <Tabs.Panel value="models">
          <div className="rounded-lg app-bg-secondary p-5">
            <Text size="sm" fw={500} mb="xs">模型配置</Text>
            <Text size="xs" className="app-text-secondary mb-4">配置 Claude Code 在不同任务中使用的 AI 模型。</Text>
            <Stack gap="sm">
              <TextInput label="快速模型（Haiku 层级）" value={settings.env?.ANTHROPIC_DEFAULT_HAIKU_MODEL || ''} onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_HAIKU_MODEL', e.currentTarget.value)} size="sm" />
              <TextInput label="标准模型（Sonnet 层级）" value={settings.env?.ANTHROPIC_DEFAULT_SONNET_MODEL || ''} onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_SONNET_MODEL', e.currentTarget.value)} size="sm" />
              <TextInput label="强力模型（Opus 层级）" value={settings.env?.ANTHROPIC_DEFAULT_OPUS_MODEL || ''} onChange={(e) => updateEnvVar('ANTHROPIC_DEFAULT_OPUS_MODEL', e.currentTarget.value)} size="sm" />
              <Group>
                <Button size="sm" onClick={saveEnvChanges} loading={saving}>保存更改</Button>
                <Button size="sm" variant="default" color="dark" onClick={() => {
                  onSettingsChange({
                    ...settings,
                    env: { ...settings.env, ANTHROPIC_BASE_URL: 'https://open.bigmodel.cn/api/anthropic', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-4.5-air', ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5-turbo', ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1' },
                  })
                }}>GLM 默认值</Button>
              </Group>
            </Stack>
          </div>
        </Tabs.Panel>

        {/* Environment Tab */}
        <Tabs.Panel value="env">
          <Stack gap="md">
            <div className="rounded-lg app-bg-secondary p-5">
              <Text size="sm" fw={500} mb="md">环境变量</Text>
              <Stack gap="xs">
                {Object.entries(settings.env || {}).map(([key, value]) => (
                  <Group key={key} wrap="nowrap">
                    <Text size="xs" className="app-text-muted font-mono" w={240} style={{ flexShrink: 0 }} truncate>{key}</Text>
                    <TextInput
                      type={key.includes('TOKEN') || key.includes('KEY') || key.includes('SECRET') ? 'password' : 'text'}
                      value={value as string}
                      onChange={(e) => updateEnvVar(key, e.currentTarget.value)}
                      size="xs"
                      flex={1}
                    />
                  </Group>
                ))}
              </Stack>
              <Button size="sm" mt="md" onClick={saveEnvChanges} loading={saving}>保存更改</Button>
            </div>

            <div className="rounded-lg app-bg-secondary p-5">
              <Text size="sm" fw={500} mb="md">实验性功能</Text>
              <Switch
                label="Agent Teams（多智能体协作）"
                checked={settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1'}
                onChange={(e) => updateEnvVar('CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', e.currentTarget.checked ? '1' : '0')}
                size="sm"
              />
              <Button size="sm" mt="md" onClick={saveEnvChanges} loading={saving}>保存更改</Button>
            </div>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
