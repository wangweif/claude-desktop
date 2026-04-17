import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge, Text, Stack, Group } from '@mantine/core'
import { IconRefresh, IconStethoscope, IconSettings } from '@tabler/icons-react'
import type { SystemStatus } from '../types'

interface Props {
  status: SystemStatus | null
  onRefresh: () => Promise<void>
  onReconfigure: () => void
}

export default function Dashboard({ status, onRefresh, onReconfigure }: Props) {
  const navigate = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const [doctorOutput, setDoctorOutput] = useState<string[]>([])
  const [showDoctor, setShowDoctor] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh()
    setRefreshing(false)
  }

  const handleDoctor = async () => {
    setShowDoctor(true)
    setDoctorOutput([])
    window.api.onDoctorOutput((data) => {
      setDoctorOutput((prev) => [...prev, data])
    })
    await window.api.runDoctor()
  }

  if (!status) return null

  const mcpCount = status.mcpServers.length

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <Text size="lg" fw={600} className="app-text-primary">系统状态</Text>
        <Text size="xs" className="app-text-secondary mt-1">
          {status.node.installed && status.claudeCode.installed
            ? '所有核心组件已安装就绪'
            : '部分组件需要安装'}
        </Text>
      </div>

      {/* Component Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        {/* Node.js */}
        <div className="rounded-lg app-bg-secondary px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Text size="sm" fw={500} className="app-text-primary">Node.js</Text>
            <Badge size="xs" variant="light" color={status.node.installed ? 'green' : 'red'}>
              {status.node.installed ? '正常' : '未安装'}
            </Badge>
          </div>
          {status.node.installed ? (
            <Text size="xs" className="app-text-muted">{status.node.version}</Text>
          ) : (
            <Button size="compact-xs" variant="subtle" color="brand" onClick={onReconfigure}>
              安装
            </Button>
          )}
          {status.node.nvm && (
            <Text size="xs" className="app-text-faint mt-1">由 nvm 管理</Text>
          )}
        </div>

        {/* Claude Code */}
        <div className="rounded-lg app-bg-secondary px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Text size="sm" fw={500} className="app-text-primary">Claude Code</Text>
            <Badge size="xs" variant="light" color={status.claudeCode.installed ? 'green' : 'red'}>
              {status.claudeCode.installed ? '正常' : '未安装'}
            </Badge>
          </div>
          {status.claudeCode.installed ? (
            <Text size="xs" className="app-text-muted">{status.claudeCode.version}</Text>
          ) : (
            <Button size="compact-xs" variant="subtle" color="brand" onClick={onReconfigure}>
              安装
            </Button>
          )}
        </div>

        {/* WeChat ACP */}
        <div className="rounded-lg app-bg-secondary px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Text size="sm" fw={500} className="app-text-primary">WeChat ACP</Text>
            <Badge size="xs" variant="light" color={status.wechatAcp.configured ? 'green' : 'yellow'}>
              {status.wechatAcp.configured ? '正常' : '未配置'}
            </Badge>
          </div>
          {status.wechatAcp.configured ? (
            <Text size="xs" className="app-text-muted">已配置为 MCP 服务器</Text>
          ) : (
            <Button size="compact-xs" variant="subtle" color="brand" onClick={() => navigate('/settings')}>
              去配置
            </Button>
          )}
        </div>
      </div>

      {/* MCP Servers */}
      <div className="rounded-lg app-bg-secondary mb-6">
        <div className="px-4 py-2.5 border-b app-border flex items-center justify-between">
          <Text size="sm" fw={500} className="app-text-primary">MCP 服务器 ({mcpCount})</Text>
          <Button size="compact-xs" variant="subtle" color="brand" onClick={() => navigate('/settings')}>
            管理
          </Button>
        </div>
        {mcpCount === 0 ? (
          <div className="px-4 py-6 text-center">
            <Text size="sm" className="app-text-muted">暂未配置 MCP 服务器</Text>
          </div>
        ) : (
          <div>
            {status.mcpServers.map((server) => (
              <div key={server.name} className="px-4 py-2.5 border-b app-border-light last:border-b-0 flex items-center justify-between">
                <div>
                  <Text size="sm" className="app-text-primary">{server.name}</Text>
                  <Text size="xs" className="app-text-faint ml-2">
                    {server.command} {server.args?.join(' ')}
                  </Text>
                </div>
                <Badge size="xs" variant="light" color="green">运行中</Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <Group gap="xs">
        <Button size="xs" variant="default" color="dark" leftSection={<IconRefresh size={14} />} onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? '刷新中...' : '刷新状态'}
        </Button>
        <Button size="xs" variant="default" color="dark" leftSection={<IconStethoscope size={14} />} onClick={handleDoctor}>
          运行诊断
        </Button>
        <Button size="xs" variant="default" color="dark" leftSection={<IconSettings size={14} />} onClick={() => navigate('/settings')}>
          设置
        </Button>
      </Group>

      {/* Doctor Output */}
      {showDoctor && (
        <div className="mt-4 rounded-lg app-bg-inset px-4 py-3 max-h-64 overflow-auto">
          <div className="terminal-output app-text-secondary">
            {doctorOutput.map((line, i) => <div key={i}>{line}</div>)}
            {doctorOutput.length === 0 && <div className="app-text-muted">正在运行诊断...</div>}
          </div>
        </div>
      )}

      {/* Paths Info */}
      <div className="mt-6">
        <Text size="xs" className="app-text-faint">Claude 目录: {status.claudeDir}</Text>
        <Text size="xs" className="app-text-faint">配置文件: {status.settingsPath}</Text>
      </div>
    </div>
  )
}
