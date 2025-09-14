import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, globalShortcut, Notification } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import url from 'node:url'
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

// Register custom protocol for file loading before app is ready
app.whenReady().then(() => {
  const { protocol } = require('electron')
  protocol.registerFileProtocol('app', (request: Electron.ProtocolRequest, callback: (response: Electron.ProtocolResponse) => void) => {
    const url = request.url.substr(6)
    callback({ path: path.normalize(`${RENDERER_DIST}/${url}`) })
  })
  createWindow()
})

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function createTrayIcon(isActive: boolean = false): Electron.NativeImage {
  const iconPath = path.join(process.env.VITE_PUBLIC, '..', 'build', 'hour_glass.png');
  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

function createAppIcon(): Electron.NativeImage {
  const iconPath = path.join(process.env.VITE_PUBLIC, '..', 'build', 'hour_glass.png');
  return nativeImage.createFromPath(iconPath);
}

function createSimpleTrayIcon(): Electron.NativeImage {
  // Create the absolute simplest possible icon
  return nativeImage.createEmpty().resize({ width: 16, height: 16 })
}

function updateTrayIcon(isActive: boolean = false) {
  if (tray) {
    // Use the proper tray icon instead of empty one
    const trayIcon = createTrayIcon(isActive)
    tray.setImage(trayIcon)
  }
}

function updateWindowTitle(status: string) {
  if (win) {
    win.setTitle(`Focus Sessions - ${status}`)
  }
}

function createTray() {
  // Create a proper tray icon
  const trayIcon = createTrayIcon(false)
  tray = new Tray(trayIcon)
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Focus Sessions',
      type: 'normal',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Show/Hide Window',
      type: 'normal',
      click: () => {
        if (win) {
          if (win.isVisible()) {
            win.hide()
          } else {
            if (win.isMinimized()) win.restore()
            win.show()
            win.focus()
          }
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
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,

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
    // Try custom app protocol for Electron
    win.loadURL('app://./index.html')
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

  // Setup global shortcuts and tray
  setupGlobalShortcuts()
  createTray()

  // Auto update
  update(win)
}

// Protocol registration and window creation handled above

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
  const notification = new Notification({
    title,
    body,
    icon: path.join(process.env.VITE_PUBLIC, '..', 'build', 'icon.png')
  });
  notification.show();
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
