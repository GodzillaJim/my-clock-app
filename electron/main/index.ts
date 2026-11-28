import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  Notification,
  protocol,
  net,
} from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { update } from './update';
import { APP_ORIGIN, resolveAppRequest } from './appProtocol';
import { getDatabase, closeDatabase } from './database/connection';
import { runMigrations, migrateLegacyData } from './database/migrations';
import { registerDatabaseHandlers } from './database/ipcHandlers';
import { createLogger, initLogging } from './logger';

const log = createLogger('main');

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
process.env.APP_ROOT = path.join(__dirname, '../..');

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName());

// Let automated tests run against a throwaway profile instead of the user's
// real database. Must happen before anything reads `userData` (including the
// single-instance lock below).
if (process.env.FOCUS_USER_DATA_DIR) {
  app.setPath('userData', process.env.FOCUS_USER_DATA_DIR);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

initLogging();

// The packaged renderer is served from `app://bundle/...`. Registering it as a
// standard, secure scheme gives the page a real origin, so module scripts,
// fetch and storage work with web security enabled. Must run before `ready`.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  // Initialize SQLite database before creating window
  try {
    const db = getDatabase();
    runMigrations(db);
    migrateLegacyData(db);
    registerDatabaseHandlers(db);
    log.info('SQLite database initialized');
  } catch (err) {
    log.error('Failed to initialize database:', err);
  }

  protocol.handle('app', (request) => {
    const filePath = resolveAppRequest(request.url, RENDERER_DIST);
    if (!filePath) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
  createWindow();
});

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const preload = path.join(__dirname, '../preload/index.cjs');

function getIconPath(iconName: string): string {
  if (app.isPackaged) {
    // In production, icons are in extraResources/icons
    return path.join(process.resourcesPath, 'icons', iconName);
  } else {
    // In development, icons are in the build folder
    return path.join(process.env.APP_ROOT!, 'build', iconName);
  }
}

// TODO(#65): show a distinct tray icon while a session is active
function createTrayIcon(_isActive: boolean = false): Electron.NativeImage {
  // Use .ico for Windows tray (better support), .png for others
  const iconName = process.platform === 'win32' ? 'hour_glass.ico' : 'hour_glass.png';
  const iconPath = getIconPath(iconName);
  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true);
  }
  return icon;
}

function createAppIcon(): Electron.NativeImage {
  const iconPath = getIconPath('hour_glass.png');
  return nativeImage.createFromPath(iconPath);
}

function updateTrayIcon(isActive: boolean = false) {
  if (tray) {
    // Use the proper tray icon instead of empty one
    const trayIcon = createTrayIcon(isActive);
    tray.setImage(trayIcon);
  }
}

function updateWindowTitle(status: string) {
  if (win) {
    win.setTitle(`Focus Sessions - ${status}`);
  }
}

function createTray() {
  // Create a proper tray icon
  const trayIcon = createTrayIcon(false);
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Focus Sessions',
      type: 'normal',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Show/Hide Window',
      type: 'normal',
      click: () => {
        if (win) {
          if (win.isVisible()) {
            win.hide();
          } else {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
          }
        }
      },
    },
    {
      label: 'Start Focus Session',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-start-session');
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Settings',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-open-settings');
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      },
    },
    {
      label: 'History',
      type: 'normal',
      click: () => {
        if (win) {
          win.webContents.send('tray-open-history');
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      type: 'normal',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Focus Sessions');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    }
  });
}

function setupGlobalShortcuts() {
  globalShortcut.register('CommandOrControl+Shift+Alt+T', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (win) {
      win.webContents.send('global-shortcut-start-session');
    }
  });
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
      nodeIntegration: false,
      contextIsolation: true,
      // Explicit: the ESM preload needs an unsandboxed renderer (sandboxing is #40)
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadURL(`${APP_ORIGIN}/index.html`);
  }

  // Show window when ready
  win.once('ready-to-show', () => {
    if (win) {
      win.show();

      if (process.platform === 'darwin') {
        win.setVisibleOnAllWorkspaces(true);
      }
    }
  });

  // Handle window close event for tray functionality
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      if (win) {
        win.hide();
      }
      return false;
    }
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Setup global shortcuts and tray
  setupGlobalShortcuts();
  createTray();

  // Auto update
  update(win);
}

// Protocol registration and window creation handled above

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  globalShortcut.unregisterAll();
  closeDatabase();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].show();
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

// IPC handlers for tray and session management
ipcMain.handle('minimize-to-tray', () => {
  if (win) {
    win.hide();
  }
});

ipcMain.handle('show-window', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});

ipcMain.handle('update-tray-status', (_, status: string) => {
  if (tray) {
    tray.setToolTip(`Focus Sessions - ${status}`);
    // Update icon based on status
    const isActive = status.toLowerCase().includes('running');
    updateTrayIcon(isActive);
  }

  // Also update window title
  updateWindowTitle(status);
});

ipcMain.handle('session-notification', (_, { title, body }: { title: string; body: string }) => {
  const notificationOptions: Electron.NotificationConstructorOptions = {
    title,
    body,
    icon: getIconPath('hour_glass.png'),
    urgency: 'critical',
  };

  // On Windows, use toastXml with scenario="alarm" to break through Focus Assist / fullscreen
  if (process.platform === 'win32') {
    const escapeXml = (s: string) =>
      s.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] || c,
      );
    notificationOptions.toastXml = `
      <toast scenario="alarm" activationType="protocol">
        <visual>
          <binding template="ToastGeneric">
            <text>${escapeXml(title)}</text>
            <text>${escapeXml(body)}</text>
          </binding>
        </visual>
        <audio src="ms-winsoundevent:Notification.Default"/>
      </toast>`;
  }

  const notification = new Notification(notificationOptions);
  notification.show();

  // Flash taskbar as additional visual cue when window is not focused
  if (win && !win.isFocused()) {
    win.flashFrame(true);
    setTimeout(() => {
      if (win) win.flashFrame(false);
    }, 5000);
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// File storage operations
ipcMain.handle('storage-read', async (_, filePath: string) => {
  const fs = require('fs/promises');
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return data;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null; // File not found is a normal condition
    }
    throw error;
  }
});

ipcMain.handle('storage-write', async (_, filePath: string, data: string) => {
  const fs = require('fs/promises');
  const path = require('path');

  // Ensure directory exists
  const dir = path.dirname(filePath);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    log.error('Failed to create storage directory:', error);
  }

  await fs.writeFile(filePath, data);
});

ipcMain.handle('storage-delete', async (_, filePath: string) => {
  const fs = require('fs/promises');
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      // It's not an error if the file doesn't exist
      throw error;
    }
  }
});

ipcMain.handle('get-storage-path', async (_, key: string) => {
  const path = require('path');
  const userDataPath = app.getPath('userData');
  const storageDir = path.join(userDataPath, 'data');
  return path.join(storageDir, `${key}.json`);
});
