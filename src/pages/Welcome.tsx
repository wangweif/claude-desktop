import { useState } from 'react'
import { Button, Checkbox, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconPinFilled } from '@tabler/icons-react'

interface WelcomeProps {
  onAccept: () => void
}

export default function Welcome({ onAccept }: WelcomeProps) {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Header: Logo + Title + Safety Badge */}
      <div className="flex items-center gap-2.5">
        <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <Title order={4} className="app-text-primary">Claude Installer</Title>
        <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-yellow-500/10">
          <IconAlertTriangle size={13} className="text-yellow-500" />
          <Text fw={600} size="xs" className="text-yellow-500">安全提醒</Text>
        </div>
      </div>

      {/* Card 1: About Claude Code */}
      <div className="w-full rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">关于 Claude Code</Text>
        </div>
        <Text size="xs" className="app-text-secondary mt-0.5">
          Claude Code 是 Anthropic 推出的 AI 编程助手，为了完成任务，它需要以下权限：
        </Text>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
          <li>读取和修改文件、执行系统命令、连接互联网</li>
          <li>访问您的 API 密钥（用于调用 AI 服务）</li>
          <li>支持 MCP 服务器扩展（文件系统、浏览器、GitHub 等）</li>
          <li><span className="app-text-warning font-medium">使用 AI 服务可能产生费用，具体取决于你选择的服务商和使用量。</span></li>
        </ul>
      </div>

      {/* Card 2: About Claude Installer */}
      <div className="w-full rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">关于 Claude Installer</Text>
        </div>
        <Text size="xs" className="app-text-secondary mt-0.5">
          Claude Installer 是 Claude Code 的安装配置工具，本工具会：
        </Text>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
          <li>自动安装必要组件（Node.js、Claude Code 命令行工具）</li>
          <li><span className="app-text-warning font-medium">保护现有配置（安装前自动备份，不会覆盖您的设置）</span></li>
          <li>本地数据存储（所有配置和数据默认只保存在此电脑上）</li>
          <li>可选安装 WeChat ACP 插件，实现 Claude Code 与微信的集成</li>
        </ul>
      </div>

      {/* Card 3: Environment */}
      <div className="w-full rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">环境说明</Text>
        </div>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
          <li>Claude Code 需要 Node.js 18+ 环境，如果未安装会自动安装。</li>
          <li>默认使用智谱 GLM API 代理，也可自行切换为 Anthropic 官方 API。</li>
          <li>支持配置 MCP 服务器来扩展 Claude Code 的能力。</li>
        </ul>
      </div>

      {/* Checkbox */}
      <Checkbox
        label="我已阅读并了解以上内容"
        checked={accepted}
        onChange={(e) => setAccepted(e.currentTarget.checked)}
        className="self-start"
        size="sm"
      />

      {/* Confirm Button */}
      <Button fullWidth disabled={!accepted} onClick={onAccept} size="sm">
        确认继续
      </Button>
    </div>
  )
}
