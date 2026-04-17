import { useEffect, useState } from 'react'
import { Button, Progress, Text, Stack } from '@mantine/core'
import { IconCheck, IconX, IconLoader2 } from '@tabler/icons-react'
import type { SystemStatus } from '../types'

interface EnvCheckProps {
  onReady: (status: SystemStatus) => void
}

type CheckItem = {
  key: string
  label: string
  status: 'pending' | 'checking' | 'done' | 'error'
  detail?: string
}

export default function EnvCheck({ onReady }: EnvCheckProps) {
  const [items, setItems] = useState<CheckItem[]>([
    { key: 'node', label: 'Node.js 环境', status: 'pending' },
    { key: 'claude', label: 'Claude Code', status: 'pending' },
    { key: 'config', label: '基础配置', status: 'pending' },
  ])
  const [logs, setLogs] = useState<string[]>([])
  const [installing, setInstalling] = useState(false)

  const updateItem = (key: string, update: Partial<CheckItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...update } : item)))
  }

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])

  useEffect(() => {
    runCheck()
  }, [])

  const runCheck = async () => {
    let status: SystemStatus | null = null

    try {
      updateItem('node', { status: 'checking' })
      addLog('正在检测 Node.js...')
      status = await window.api.getStatus()

      if (status.node.installed) {
        updateItem('node', { status: 'done', detail: `v${status.node.version}` })
        addLog(`Node.js ${status.node.version} 已安装${status.node.nvm ? ' (nvm)' : ''}`)
      } else {
        updateItem('node', { status: 'error', detail: '未安装' })
        addLog('Node.js 未找到，需要安装')
      }
    } catch (err: any) {
      updateItem('node', { status: 'error', detail: err.message })
      addLog(`检测 Node.js 失败: ${err.message}`)
      return
    }

    try {
      updateItem('claude', { status: 'checking' })
      addLog('正在检测 Claude Code...')

      if (status.claudeCode.installed) {
        updateItem('claude', { status: 'done', detail: `v${status.claudeCode.version}` })
        addLog(`Claude Code ${status.claudeCode.version} 已安装`)
      } else {
        updateItem('claude', { status: 'error', detail: '未安装' })
        addLog('Claude Code 未找到，需要安装')
      }
    } catch (err: any) {
      updateItem('claude', { status: 'error', detail: err.message })
      addLog(`检测 Claude Code 失败: ${err.message}`)
    }

    // Auto-install missing components
    if (!status.node.installed || !status.claudeCode.installed) {
      setInstalling(true)
      if (!status.node.installed) {
        updateItem('node', { status: 'checking', detail: '正在安装...' })
        addLog('正在安装 Node.js...')
        try {
          const result = await window.api.installNode()
          if (result.success) {
            updateItem('node', { status: 'done', detail: '安装成功' })
            addLog('Node.js 安装成功')
          } else {
            updateItem('node', { status: 'error', detail: result.message || '安装失败' })
            addLog(`Node.js 安装失败: ${result.message}`)
          }
        } catch (err: any) {
          updateItem('node', { status: 'error', detail: err.message })
          addLog(`Node.js 安装失败: ${err.message}`)
        }
      }

      if (!status.claudeCode.installed) {
        updateItem('claude', { status: 'checking', detail: '正在安装...' })
        addLog('正在安装 Claude Code（可能需要一些时间）...')
        try {
          const result = await window.api.installClaudeCode()
          if (result.success) {
            updateItem('claude', { status: 'done', detail: '安装成功' })
            addLog('Claude Code 安装成功')
          } else {
            updateItem('claude', { status: 'error', detail: result.message || '安装失败' })
            addLog(`Claude Code 安装失败: ${result.message}`)
          }
        } catch (err: any) {
          updateItem('claude', { status: 'error', detail: err.message })
          addLog(`Claude Code 安装失败: ${err.message}`)
        }
      }

      await window.api.refreshEnvironment()
      setInstalling(false)
    }

    // Check config
    try {
      updateItem('config', { status: 'checking' })
      addLog('正在检查配置...')
      const { data: currentSettings } = await window.api.readSettings()
      if (currentSettings) {
        updateItem('config', { status: 'done', detail: '已存在' })
        addLog('配置已存在')
      } else {
        const defaultSettings = {
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
        await window.api.writeSettings(defaultSettings)
        updateItem('config', { status: 'done', detail: '已创建默认配置' })
        addLog('已创建默认 GLM 配置')
      }
    } catch (err: any) {
      updateItem('config', { status: 'done', detail: '跳过' })
      addLog(`配置检查: ${err.message}`)
    }

    // Refresh and proceed
    try {
      const finalStatus = await window.api.getStatus()
      onReady(finalStatus)
    } catch {
      onReady(status!)
    }
  }

  const doneCount = items.filter((i) => i.status === 'done').length
  const progress = (doneCount / items.length) * 100

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'done':
        return <IconCheck size={16} className="app-text-success" />
      case 'error':
        return <IconX size={16} className="app-text-danger" />
      case 'checking':
        return <IconLoader2 size={16} className="app-text-muted animate-spin" />
      default:
        return <div className="w-4 h-4 rounded-full border border-[var(--app-border)]" />
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Text size="sm" fw={500} className="app-text-primary">环境检测</Text>
      <Progress value={progress} size="xs" color="green" />

      <Stack gap="xs">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 px-1">
            {getStatusIcon(item.status)}
            <Text size="sm" className="app-text-primary flex-1">{item.label}</Text>
            <Text size="xs" className="app-text-muted">{item.detail}</Text>
          </div>
        ))}
      </Stack>

      {installing && (
        <Text size="xs" className="app-text-muted text-center">正在安装缺失组件，请稍候...</Text>
      )}

      {/* Log output */}
      <div className="w-full rounded-lg app-bg-inset px-3 py-2 max-h-32 overflow-y-auto">
        <div className="terminal-output app-text-muted">
          {logs.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
