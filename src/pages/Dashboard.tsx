import { useState } from 'react'
import type { SystemStatus } from '../types'

interface Props {
  status: SystemStatus | null
  onRefresh: () => Promise<void>
  onNavigate: (page: string) => void
}

export default function Dashboard({ status, onRefresh, onNavigate }: Props) {
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

  const allInstalled = status.node.installed && status.claudeCode.installed
  const mcpCount = status.mcpServers.length

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Status Overview */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-200 mb-1">System Status</h1>
        <p className="text-sm text-slate-400">
          {allInstalled
            ? 'All core components are installed and ready'
            : 'Some components need installation'}
        </p>
      </div>

      {/* Component Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Node.js */}
        <div className="bg-[#1a1b2e] rounded-lg p-4 border border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Node.js</span>
            <span className={`status-badge ${status.node.installed ? 'status-pass' : 'status-fail'}`}>
              <span className={`status-dot ${status.node.installed ? 'pass' : 'fail'}`}></span>
              {status.node.installed ? 'OK' : 'Missing'}
            </span>
          </div>
          {status.node.installed ? (
            <p className="text-xs text-slate-400">{status.node.version}</p>
          ) : (
            <button
              onClick={() => onNavigate('wizard')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Install now
            </button>
          )}
          {status.node.nvm && (
            <p className="text-xs text-slate-500 mt-1">Managed by nvm</p>
          )}
        </div>

        {/* Claude Code */}
        <div className="bg-[#1a1b2e] rounded-lg p-4 border border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">Claude Code</span>
            <span className={`status-badge ${status.claudeCode.installed ? 'status-pass' : 'status-fail'}`}>
              <span className={`status-dot ${status.claudeCode.installed ? 'pass' : 'fail'}`}></span>
              {status.claudeCode.installed ? 'OK' : 'Missing'}
            </span>
          </div>
          {status.claudeCode.installed ? (
            <p className="text-xs text-slate-400">{status.claudeCode.version}</p>
          ) : (
            <button
              onClick={() => onNavigate('wizard')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Install now
            </button>
          )}
        </div>

        {/* WeChat ACP */}
        <div className="bg-[#1a1b2e] rounded-lg p-4 border border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-300">WeChat ACP</span>
            <span className={`status-badge ${status.wechatAcp.configured ? 'status-pass' : 'status-warn'}`}>
              <span className={`status-dot ${status.wechatAcp.configured ? 'pass' : 'warn'}`}></span>
              {status.wechatAcp.configured ? 'OK' : 'Not configured'}
            </span>
          </div>
          {status.wechatAcp.configured ? (
            <p className="text-xs text-slate-400">Configured as MCP server</p>
          ) : (
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Configure
            </button>
          )}
        </div>
      </div>

      {/* MCP Servers */}
      <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] mb-6">
        <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">
            MCP Servers ({mcpCount})
          </span>
          <button
            onClick={() => onNavigate('settings')}
            className="text-xs text-indigo-400 hover:text-indigo-300"
          >
            Manage
          </button>
        </div>
        {mcpCount === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-500">
            No MCP servers configured
          </div>
        ) : (
          <div className="divide-y divide-[#334155]">
            {status.mcpServers.map((server) => (
              <div key={server.name} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm text-slate-300">{server.name}</span>
                  <span className="text-xs text-slate-500 ml-2">
                    {server.command} {server.args?.join(' ')}
                  </span>
                </div>
                <span className="status-badge status-pass">
                  <span className="status-dot pass"></span>
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-[#252640] hover:bg-[#2d2e4a] text-slate-300 text-sm rounded-md border border-[#334155] transition-colors disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </button>
        <button
          onClick={handleDoctor}
          className="px-4 py-2 bg-[#252640] hover:bg-[#2d2e4a] text-slate-300 text-sm rounded-md border border-[#334155] transition-colors"
        >
          Run Diagnostics
        </button>
      </div>

      {/* Doctor Output */}
      {showDoctor && (
        <div className="mt-4 bg-[#0f0f1a] rounded-lg border border-[#334155] p-4 max-h-64 overflow-auto">
          <div className="terminal-output text-slate-300">
            {doctorOutput.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
            {doctorOutput.length === 0 && (
              <div className="text-slate-500">Running diagnostics...</div>
            )}
          </div>
        </div>
      )}

      {/* Paths Info */}
      <div className="mt-6 text-xs text-slate-500">
        <p>Claude directory: {status.claudeDir}</p>
        <p>Settings: {status.settingsPath}</p>
      </div>
    </div>
  )
}
