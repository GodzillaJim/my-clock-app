import { ipcRenderer, contextBridge } from 'electron';

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },

  // You can expose other APTs you need here.
  // ...
});

// --------- Expose Focus Sessions Electron API ---------
contextBridge.exposeInMainWorld('electronAPI', {
  // Logging: forwarded to the main-process log file
  log: (level: string, scope: string, args: unknown[]) =>
    ipcRenderer.send('log:write', level, scope, args),

  // System tray functions
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  updateTrayStatus: (status: string) => ipcRenderer.invoke('update-tray-status', status),
  sessionNotification: (notification: { title: string; body: string }) =>
    ipcRenderer.invoke('session-notification', notification),

  // Storage
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // File storage operations
  storageRead: (filePath: string) => ipcRenderer.invoke('storage-read', filePath),
  storageWrite: (filePath: string, data: string) =>
    ipcRenderer.invoke('storage-write', filePath, data),
  storageDelete: (filePath: string) => ipcRenderer.invoke('storage-delete', filePath),
  getStoragePath: (key: string) => ipcRenderer.invoke('get-storage-path', key),

  // Event listeners for tray actions
  onTrayStartSession: (callback: () => void) => {
    ipcRenderer.on('tray-start-session', callback);
  },
  onTrayOpenSettings: (callback: () => void) => {
    ipcRenderer.on('tray-open-settings', callback);
  },
  onTrayOpenHistory: (callback: () => void) => {
    ipcRenderer.on('tray-open-history', callback);
  },
  onGlobalShortcutStartSession: (callback: () => void) => {
    ipcRenderer.on('global-shortcut-start-session', callback);
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // SQLite database API
  db: {
    sessions: {
      save: (session: any) => ipcRenderer.invoke('db:sessions:save', session),
      getByDate: (date: string) => ipcRenderer.invoke('db:sessions:getByDate', date),
      getHistory: (limit?: number) => ipcRenderer.invoke('db:sessions:getHistory', limit),
      delete: (id: string) => ipcRenderer.invoke('db:sessions:delete', id),
      deleteByDate: (date: string) => ipcRenderer.invoke('db:sessions:deleteByDate', date),
      deleteAll: () => ipcRenderer.invoke('db:sessions:deleteAll'),
      saveAndUpdateHistory: (session: any, historyData: any) =>
        ipcRenderer.invoke('db:sessions:saveAndUpdateHistory', session, historyData),
    },
    plans: {
      save: (plan: any) => ipcRenderer.invoke('db:plans:save', plan),
      get: (id: string) => ipcRenderer.invoke('db:plans:get', id),
      getByDate: (date: string) => ipcRenderer.invoke('db:plans:getByDate', date),
      getByDateRange: (start: string, end: string) =>
        ipcRenderer.invoke('db:plans:getByDateRange', start, end),
      update: (id: string, updates: any) => ipcRenderer.invoke('db:plans:update', id, updates),
      updateSegment: (segmentId: string, updates: any) =>
        ipcRenderer.invoke('db:plans:updateSegment', segmentId, updates),
    },
    history: {
      save: (history: any) => ipcRenderer.invoke('db:history:save', history),
      getByDate: (date: string) => ipcRenderer.invoke('db:history:getByDate', date),
      getByRange: (start: string, end: string) =>
        ipcRenderer.invoke('db:history:getByRange', start, end),
      getAllDates: () => ipcRenderer.invoke('db:history:getAllDates'),
      deleteByDate: (date: string) => ipcRenderer.invoke('db:history:deleteByDate', date),
      deleteAll: () => ipcRenderer.invoke('db:history:deleteAll'),
      clearToday: (date: string) => ipcRenderer.invoke('db:history:clearToday', date),
      resetAll: () => ipcRenderer.invoke('db:history:resetAll'),
    },
    challenges: {
      getAll: () => ipcRenderer.invoke('db:challenges:getAll'),
      getById: (id: string) => ipcRenderer.invoke('db:challenges:getById', id),
      save: (challenge: any) => ipcRenderer.invoke('db:challenges:save', challenge),
      delete: (id: string) => ipcRenderer.invoke('db:challenges:delete', id),
      markDay: (challengeId: string, date: string, status: string, note?: string) =>
        ipcRenderer.invoke('db:challenges:markDay', challengeId, date, status, note),
    },
    feedback: {
      getAll: (filters?: any) => ipcRenderer.invoke('db:feedback:getAll', filters),
      save: (item: any) => ipcRenderer.invoke('db:feedback:save', item),
      update: (id: string, updates: any) => ipcRenderer.invoke('db:feedback:update', id, updates),
      delete: (id: string) => ipcRenderer.invoke('db:feedback:delete', id),
      getStats: () => ipcRenderer.invoke('db:feedback:getStats'),
    },
    kv: {
      get: (key: string) => ipcRenderer.invoke('db:kv:get', key),
      set: (key: string, value: any) => ipcRenderer.invoke('db:kv:set', key, value),
    },
    snapshot: {
      save: (plan: any) => ipcRenderer.invoke('db:snapshot:save', plan),
      load: () => ipcRenderer.invoke('db:snapshot:load'),
      clear: () => ipcRenderer.invoke('db:snapshot:clear'),
    },
  },
});

// --------- Preload scripts loading ---------
function domReady(condition: DocumentReadyState[] = ['complete', 'interactive']) {
  return new Promise((resolve) => {
    if (condition.includes(document.readyState)) {
      resolve(true);
    } else {
      document.addEventListener('readystatechange', () => {
        if (condition.includes(document.readyState)) {
          resolve(true);
        }
      });
    }
  });
}

const safeDOM = {
  append(parent: HTMLElement, child: HTMLElement) {
    if (!Array.from(parent.children).find((e) => e === child)) {
      return parent.appendChild(child);
    }
  },
  remove(parent: HTMLElement, child: HTMLElement) {
    if (Array.from(parent.children).find((e) => e === child)) {
      return parent.removeChild(child);
    }
  },
};

/**
 * https://tobiasahlin.com/spinkit
 * https://connoratherton.com/loaders
 * https://projects.lukehaas.me/css-loaders
 * https://matejkustec.github.io/SpinThatShit
 */
function useLoading() {
  const className = `loaders-css__square-spin`;
  const styleContent = `
@keyframes square-spin {
  25% { transform: perspective(100px) rotateX(180deg) rotateY(0); }
  50% { transform: perspective(100px) rotateX(180deg) rotateY(180deg); }
  75% { transform: perspective(100px) rotateX(0) rotateY(180deg); }
  100% { transform: perspective(100px) rotateX(0) rotateY(0); }
}
.${className} > div {
  animation-fill-mode: both;
  width: 50px;
  height: 50px;
  background: #fff;
  animation: square-spin 3s 0s cubic-bezier(0.09, 0.57, 0.49, 0.9) infinite;
}
.app-loading-wrap {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #282c34;
  z-index: 9;
}
    `;
  const oStyle = document.createElement('style');
  const oDiv = document.createElement('div');

  oStyle.id = 'app-loading-style';
  oStyle.innerHTML = styleContent;
  oDiv.className = 'app-loading-wrap';
  oDiv.innerHTML = `<div class="${className}"><div></div></div>`;

  return {
    appendLoading() {
      safeDOM.append(document.head, oStyle);
      safeDOM.append(document.body, oDiv);
    },
    removeLoading() {
      safeDOM.remove(document.head, oStyle);
      safeDOM.remove(document.body, oDiv);
    },
  };
}

// ----------------------------------------------------------------------

const { appendLoading, removeLoading } = useLoading();
domReady().then(appendLoading);

window.onmessage = (ev) => {
  if (ev.data.payload === 'removeLoading') removeLoading();
};

setTimeout(removeLoading, 4999);
