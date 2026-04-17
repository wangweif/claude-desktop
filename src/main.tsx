import React from 'react'
import ReactDOM from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { theme, cssVariablesResolver, shouldClearStoredColorScheme } from './theme'
import App from './App'
import './index.css'

try {
  const stored = localStorage.getItem('mantine-color-scheme-value')
  if (shouldClearStoredColorScheme(stored)) {
    localStorage.removeItem('mantine-color-scheme-value')
  }
} catch {}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark" cssVariablesResolver={cssVariablesResolver}>
      <ModalsProvider>
        <Notifications position="top-right" />
        <App />
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
)
