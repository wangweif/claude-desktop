import { useState, useEffect } from 'react'
import type { SystemStatus, PlatformInfo } from './types'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import SetupWizard from './pages/SetupWizard'

type Page = 'dashboard' | 'settings' | 'wizard'

function App() {
  const [page, setPage] = useState<Page>('wizard')
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const [statusData, platform] = await Promise.all([
          window.api.getStatus(),
          window.api.getPlatformInfo(),
        ])
        setStatus(statusData)
        setPlatformInfo(platform)

        // If everything is installed, go to dashboard
        if (statusData.node.installed && statusData.claudeCode.installed) {
          setPage('dashboard')
        }
      } catch (err) {
        console.error('Failed to get system status:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const refreshStatus = async () => {
    try {
      const newStatus = await window.api.getStatus()
      setStatus(newStatus)
    } catch (err) {
      console.error('Failed to refresh status:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0f0f1a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Detecting environment...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f0f1a]">
      {/* Title bar (macOS drag area) */}
      <div className="titlebar-drag flex items-center h-12 px-4 bg-[#1a1b2e] border-b border-[#334155] shrink-0">
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={() => setPage('dashboard')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              page === 'dashboard'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setPage('wizard')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              page === 'wizard'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Setup
          </button>
          <button
            onClick={() => setPage('settings')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              page === 'settings'
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Settings
          </button>
        </div>

        {/* Right side: version info */}
        <div className="titlebar-no-drag ml-auto text-xs text-slate-500">
          {platformInfo && `${platformInfo.platform} ${platformInfo.arch}`}
          {status?.claudeCode.version && ` | Claude ${status.claudeCode.version}`}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {page === 'dashboard' && (
          <Dashboard status={status} onRefresh={refreshStatus} onNavigate={(p) => setPage(p as Page)} />
        )}
        {page === 'settings' && (
          <Settings status={status} onRefresh={refreshStatus} />
        )}
        {page === 'wizard' && (
          <SetupWizard status={status} onComplete={() => { refreshStatus(); setPage('dashboard') }} />
        )}
      </div>
    </div>
  )
}

export default App
