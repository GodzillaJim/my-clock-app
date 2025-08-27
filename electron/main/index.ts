import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { update } from './update'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function createTrayIcon(isActive: boolean = false): Electron.NativeImage {
  // Use text/emoji based approach - most reliable across themes
  return createTextBasedTrayIcon(isActive)
}

function createTextBasedTrayIcon(isActive: boolean): Electron.NativeImage {
  const size = 16
  
  // Try different approaches based on platform
  if (process.platform === 'darwin') {
    // macOS - use simple black symbol that becomes template
    const symbol = isActive ? '⏱' : '⏰'
    return createEmojiIcon(symbol, size, 'black', true)
  } else {
    // Windows/Linux - use high contrast approach
    const symbol = isActive ? 'F' : 'T'  // F for Focus active, T for Timer idle
    return createTextIcon(symbol, size, isActive ? '#FF6B00' : '#666666')
  }
}

function createEmojiIcon(emoji: string, size: number, color: string, template: boolean): Electron.NativeImage {
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <text x="8" y="12" font-family="system-ui" font-size="12" 
            text-anchor="middle" fill="${color}">${emoji}</text>
    </svg>
  `
  
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  if (template) image.setTemplateImage(true)
  return image
}

function createTextIcon(letter: string, size: number, color: string): Electron.NativeImage {
  // Create a simple high-contrast icon
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background circle for contrast -->
      <circle cx="8" cy="8" r="7" fill="white" stroke="#ccc" stroke-width="0.5"/>
      <!-- Letter -->
      <text x="8" y="11" font-family="Arial, sans-serif" font-size="10" font-weight="bold"
            text-anchor="middle" fill="${color}">${letter}</text>
    </svg>
  `
  
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
}

function createAppIcon(): Electron.NativeImage {
  // Use the same reliable icon system as tray, but larger for window
  const size = 32
  
  if (process.platform === 'darwin') {
    // macOS - use timer emoji, larger version
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <text x="16" y="24" font-family="system-ui" font-size="20" 
              text-anchor="middle" fill="black">⏰</text>
      </svg>
    `
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
    // Don't set as template for window icon, we want it to stay visible
    return image
  } else {
    // Windows/Linux - use high contrast design like tray
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <!-- Background circle for contrast -->
        <circle cx="16" cy="16" r="15" fill="white" stroke="#ddd" stroke-width="1"/>
        <!-- Letter T for Timer -->
        <text x="16" y="22" font-family="Arial, sans-serif" font-size="18" font-weight="bold"
              text-anchor="middle" fill="#2196F3">T</text>
      </svg>
    `
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  }
}

function updateTrayIcon(isActive: boolean = false) {
  if (tray) {
    const newIcon = createTrayIcon(isActive)
    tray.setImage(newIcon)
  }
}

function updateWindowTitle(status: string) {
  if (win) {
    win.setTitle(`Focus Sessions - ${status}`)
  }
}

function createTray() {
  // Create a simple tray icon programmatically since we don't have icon files
  const trayIcon = createTrayIcon()
  tray = new Tray(trayIcon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Focus Sessions',
      type: 'normal',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      type: 'normal',
      click: () => {
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'Start Focus Session',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-start-session')
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-open-settings')
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
      }
    },
    {
      label: 'History',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-open-history')
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  
  tray.setToolTip('Focus Sessions')
  tray.setContextMenu(contextMenu)
  
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide()
      } else {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    }
  })
}

function setupGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+Alt+T', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
  
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (win) {
      win.webContents.send('global-shortcut-start-session')
    }
  })
}

async function createWindow() {
  win = new BrowserWindow({
    title: 'Focus Sessions - Ready to Focus',
    width: 1000,
    height: 800,
    minWidth: 600,
    minHeight: 500,
    icon: createAppIcon(),
    show: false,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Show window when ready
  win.once('ready-to-show', () => {
    if (win) {
      win.show()
      
      if (process.platform === 'darwin') {
        win.setVisibleOnAllWorkspaces(true)
      }
    }
  })

  // Handle window close event for tray functionality
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      if (win) {
        win.hide()
      }
      return false
    }
  })

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Setup tray and global shortcuts
  createTray()
  setupGlobalShortcuts()

  // Auto update
  update(win)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].show()
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// IPC handlers for tray and session management
ipcMain.handle('minimize-to-tray', () => {
  if (win) {
    win.hide()
  }
})

ipcMain.handle('show-window', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
})

ipcMain.handle('update-tray-status', (_, status: string) => {
  if (tray) {
    tray.setToolTip(`Focus Sessions - ${status}`)
    // Update icon based on status
    const isActive = status.toLowerCase().includes('running')
    updateTrayIcon(isActive)
  }
  
  // Also update window title
  updateWindowTitle(status)
})

ipcMain.handle('session-notification', (_, { title, body }: { title: string, body: string }) => {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    // For native notifications, we can enhance the tray experience
    if (tray) {
      tray.displayBalloon({
        title,
        content: body,
        icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico')
      })
    }
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
