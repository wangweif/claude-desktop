import { app, BrowserWindow, shell, Tray, Menu, nativeImage } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { registerIpcHandlers } from './ipc-handlers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isMac = process.platform === 'darwin'

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 650,
    show: false,
    title: 'Claude Desktop Installer',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: '#0f0f11',
    webPreferences: {
      preload: join(__dirname, 'preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    if (!isMac) {
      mainWindow = null
      return
    }
    // On macOS, hide to tray instead of quitting
    event.preventDefault()
    mainWindow?.hide()
  })

  // Load the app
  const isDev = !app.isPackaged
  if (isDev) {
    // Wait for Vite dev server to be ready before loading
    const tryLoad = async () => {
      for (let i = 0; i < 30; i++) {
        try {
          const { net } = await import('electron')
          const response = await net.fetch('http://localhost:5173/')
          if (response.ok) {
            mainWindow?.loadURL('http://localhost:5173')
            return
          }
        } catch { /* not ready yet */ }
        await new Promise(r => setTimeout(r, 500))
      }
      // Fallback: try loading anyway
      mainWindow?.loadURL('http://localhost:5173')
    }
    tryLoad()
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

function createTray() {
  const iconPath = join(__dirname, isMac ? '../../public/icon.icns' : '../../public/icon.ico')
  // Use a simple 16x16 icon if custom icon doesn't exist
  let icon: Electron.NativeImage
  try {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { tray = null; app.quit() } },
  ])
  tray.setToolTip('Claude Desktop Installer')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

app.whenReady().then(() => {
  if (isMac) {
    app.setAboutPanelOptions({
      applicationName: 'Claude Desktop Installer',
      applicationVersion: app.getVersion(),
    })
  }

  createWindow()
  createTray()
  registerIpcHandlers()
})

app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit()
  }
})

app.on('activate', () => {
  if (isMac && !mainWindow) {
    createWindow()
  } else if (mainWindow) {
    mainWindow.show()
  }
})
