import { useState, useEffect } from 'react'
import type { SystemStatus, InstallResult, InstallStep } from '../types'

interface Props {
  status: SystemStatus | null
  onComplete: () => void
}

type Step = 'check' | 'node' | 'claude' | 'settings' | 'wechat' | 'done'

const STEP_LABELS: Record<Step, string> = {
  check: 'Environment Detection',
  node: 'Install Node.js',
  claude: 'Install Claude Code',
  settings: 'Configure Settings',
  wechat: 'WeChat ACP Setup',
  done: 'Complete',
}

const STEPS: Step[] = ['check', 'node', 'claude', 'settings', 'wechat', 'done']

export default function SetupWizard({ status, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<Step>('check')
  const [stepStatuses, setStepStatuses] = useState<Record<Step, 'pending' | 'running' | 'done' | 'error' | 'skipped'>>(() => {
    const init: Record<string, 'pending' | 'running' | 'done' | 'skipped'> = {}
    STEPS.forEach((s) => { init[s] = 'pending' })
    return init as any
  })
  const [logs, setLogs] = useState<string[]>([])
  const [installResults, setInstallResults] = useState<Record<string, InstallStep[]>>({})
  const [wechatToken, setWechatToken] = useState('')
  const [skipWechat, setSkipWechat] = useState(false)

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`])
  }

  useEffect(() => {
    if (status && currentStep === 'check') {
      runCheck()
    }
  }, [status])

  const runCheck = () => {
    setCurrentStep('check')
    setStepStatuses((prev) => ({ ...prev, check: 'running' }))
    addLog('Checking system environment...')

    if (status?.node.installed) {
      addLog(`Node.js ${status.node.version} found`)
    } else {
      addLog('Node.js not found - will install')
    }

    if (status?.claudeCode.installed) {
      addLog(`Claude Code ${status.claudeCode.version} found`)
    } else {
      addLog('Claude Code not found - will install')
    }

    addLog('Environment check complete')
    setStepStatuses((prev) => ({ ...prev, check: 'done' }))

    // Determine next step
    if (!status?.node.installed) {
      setTimeout(() => runInstallNode(), 500)
    } else if (!status?.claudeCode.installed) {
      setTimeout(() => runInstallClaude(), 500)
    } else {
      setTimeout(() => runSettings(), 500)
    }
  }

  const runInstallNode = async () => {
    setCurrentStep('node')
    setStepStatuses((prev) => ({ ...prev, node: 'running' }))
    addLog('Installing Node.js...')

    try {
      const result = await window.api.installNode()
      if (result.success) {
        addLog(result.message || 'Node.js installed successfully')
        setStepStatuses((prev) => ({ ...prev, node: 'done' }))
      } else {
        addLog(`ERROR: ${result.message || 'Node.js installation failed'}`)
        setStepStatuses((prev) => ({ ...prev, node: 'error' }))
      }
    } catch (err: any) {
      addLog(`ERROR: ${err.message || 'Node.js installation failed'}`)
      setStepStatuses((prev) => ({ ...prev, node: 'error' }))
    }

    await window.api.refreshEnvironment()

    // Move to next step
    setTimeout(() => {
      if (!status?.claudeCode.installed) {
        runInstallClaude()
      } else {
        runSettings()
      }
    }, 1000)
  }

  const runInstallClaude = async () => {
    setCurrentStep('claude')
    setStepStatuses((prev) => ({ ...prev, claude: 'running' }))
    addLog('Installing Claude Code (this may take a while)...')

    try {
      const result = await window.api.installClaudeCode()
      if (result.success) {
        addLog(result.message || 'Claude Code installed successfully')
        setStepStatuses((prev) => ({ ...prev, claude: 'done' }))
      } else {
        addLog(`ERROR: ${result.message || 'Claude Code installation failed'}`)
        setStepStatuses((prev) => ({ ...prev, claude: 'error' }))
      }
    } catch (err: any) {
      addLog(`ERROR: ${err.message || 'Claude Code installation failed'}`)
      setStepStatuses((prev) => ({ ...prev, claude: 'error' }))
    }

    setTimeout(() => runSettings(), 1000)
  }

  const runSettings = async () => {
    setCurrentStep('settings')
    setStepStatuses((prev) => ({ ...prev, settings: 'running' }))
    addLog('Configuring Claude Code settings...')

    try {
      const { data: currentSettings } = await window.api.readSettings()
      if (currentSettings) {
        addLog('Settings already exist, preserving current configuration')
      } else {
        // Create default settings with GLM models
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
        const result = await window.api.writeSettings(defaultSettings)
        if (result.success) {
          addLog('Default settings created with GLM model configuration')
        } else {
          addLog('Warning: Could not create default settings')
        }
      }
      setStepStatuses((prev) => ({ ...prev, settings: 'done' }))
    } catch (err: any) {
      addLog(`Warning: ${err.message}`)
      setStepStatuses((prev) => ({ ...prev, settings: 'done' }))
    }

    setTimeout(() => {
      if (skipWechat) {
        finishWizard()
      } else {
        setCurrentStep('wechat')
        setStepStatuses((prev) => ({ ...prev, wechat: 'running' }))
      }
    }, 500)
  }

  const runInstallWechat = async () => {
    addLog('Installing WeChat ACP...')
    try {
      const result = await window.api.installWechatAcp({
        token: wechatToken || undefined,
      })
      if (result.steps) {
        setInstallResults((prev) => ({ ...prev, wechat: result.steps }))
      }
      result.steps?.forEach((step) => {
        addLog(`  ${step.name}: ${step.success ? 'OK' : 'FAIL'} - ${step.message}`)
      })
      if (result.success) {
        addLog(result.message)
        setStepStatuses((prev) => ({ ...prev, wechat: 'done' }))
      } else {
        addLog(`Warning: ${result.message}`)
        setStepStatuses((prev) => ({ ...prev, wechat: 'done' }))
      }
    } catch (err: any) {
      addLog(`Warning: WeChat ACP setup had issues: ${err.message}`)
      setStepStatuses((prev) => ({ ...prev, wechat: 'done' }))
    }

    setTimeout(() => finishWizard(), 500)
  }

  const finishWizard = () => {
    setCurrentStep('done')
    setStepStatuses((prev) => ({ ...prev, done: 'done' }))
    addLog('Setup complete! You can now use Claude Code.')
  }

  const getStepIcon = (step: Step) => {
    const status = stepStatuses[step]
    switch (status) {
      case 'done':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )
      case 'running':
        return (
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        )
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )
      case 'skipped':
        return (
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        )
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-[#334155]" />
        )
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-semibold text-slate-200 mb-1">Setup Wizard</h1>
      <p className="text-sm text-slate-400 mb-6">
        Automatically install and configure Node.js, Claude Code, and WeChat ACP
      </p>

      {/* Step Progress */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.filter((s) => s !== 'done').map((step, i) => (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              {getStepIcon(step)}
              <span className="text-xs text-slate-400 mt-1.5 max-w-[80px] text-center">
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < STEPS.length - 2 && (
              <div className={`w-12 h-0.5 mx-2 mt-[-16px] ${
                stepStatuses[step] === 'done' ? 'bg-green-500/30' : 'bg-[#334155]'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* WeChat ACP Configuration (shown when step is 'wechat') */}
      {currentStep === 'wechat' && (
        <div className="bg-[#1a1b2e] rounded-lg border border-[#334155] p-4 mb-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">WeChat ACP Configuration</h3>
          <p className="text-xs text-slate-400 mb-3">
            Configure WeChat ACP as an MCP server to enable WeChat integration with Claude Code.
          </p>
          <div className="mb-3">
            <label className="block text-xs text-slate-400 mb-1">WeChat Token (optional)</label>
            <input
              type="text"
              value={wechatToken}
              onChange={(e) => setWechatToken(e.target.value)}
              placeholder="Enter your WeChat ACP token"
              className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#334155] rounded-md text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={runInstallWechat}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors"
            >
              Install WeChat ACP
            </button>
            <button
              onClick={() => {
                setStepStatuses((prev) => ({ ...prev, wechat: 'skipped' }))
                addLog('WeChat ACP setup skipped')
                finishWizard()
              }}
              className="px-4 py-2 bg-[#252640] hover:bg-[#2d2e4a] text-slate-400 text-sm rounded-md border border-[#334155] transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Completion */}
      {currentStep === 'done' && (
        <div className="bg-[#1a1b2e] rounded-lg border border-green-500/20 p-6 mb-4 text-center">
          <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-slate-200 mb-1">Setup Complete</h2>
          <p className="text-sm text-slate-400 mb-4">
            Claude Code is ready to use. Open a terminal and run <code className="text-indigo-400">claude</code> to get started.
          </p>
          <button
            onClick={onComplete}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-md transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      )}

      {/* Log Output */}
      <div className="bg-[#0f0f1a] rounded-lg border border-[#334155] p-4 max-h-48 overflow-auto">
        <div className="terminal-output text-slate-400 text-xs">
          {logs.map((line, i) => (
            <div key={i} className={line.includes('ERROR') ? 'text-red-400' : line.includes('Warning') ? 'text-yellow-400' : ''}>
              {line}
            </div>
          ))}
          {logs.length === 0 && <div className="text-slate-600">Waiting...</div>}
        </div>
      </div>
    </div>
  )
}
