import { ipcRenderer, contextBridge } from 'electron';
import type {
  ElectronAPI,
  EventChannel,
  InvokeArgs,
  InvokeChannel,
  InvokeResult,
  KvValues,
} from '../ipc/contract';

// Only named, purpose-built functions from the IPC contract are exposed; the
// renderer never gets raw ipcRenderer access.

/** Typed `ipcRenderer.invoke` for a contract channel. */
const invoke =
  <C extends InvokeChannel>(channel: C) =>
  (...args: InvokeArgs<C>) =>
    ipcRenderer.invoke(channel, ...args) as Promise<InvokeResult<C>>;

/** Listeners receive no IPC event object and return an unsubscribe function. */
const subscribe = (channel: EventChannel) => (callback: () => void) => {
  const listener = () => callback();
  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

const api: ElectronAPI = {
  // Logging: forwarded to the main-process log file
  log: (level, scope, args) => ipcRenderer.send('log:write', level, scope, args),

  // Window and tray
  minimizeToTray: invoke('minimize-to-tray'),
  showWindow: invoke('show-window'),
  updateTrayStatus: invoke('update-tray-status'),
  sessionNotification: invoke('session-notification'),
  reportProblem: invoke('app:reportProblem'),

  // Tray and global-shortcut events
  onTrayStartSession: subscribe('tray-start-session'),
  onTrayOpenSettings: subscribe('tray-open-settings'),
  onTrayOpenHistory: subscribe('tray-open-history'),
  onGlobalShortcutStartSession: subscribe('global-shortcut-start-session'),

  // SQLite database
  db: {
    sessions: {
      save: invoke('db:sessions:save'),
      getByDate: invoke('db:sessions:getByDate'),
      getHistory: invoke('db:sessions:getHistory'),
      delete: invoke('db:sessions:delete'),
    },
    plans: {
      save: invoke('db:plans:save'),
      get: invoke('db:plans:get'),
      getByDate: invoke('db:plans:getByDate'),
      getByDateRange: invoke('db:plans:getByDateRange'),
      update: invoke('db:plans:update'),
    },
    history: {
      save: invoke('db:history:save'),
      getByDate: invoke('db:history:getByDate'),
      getByRange: invoke('db:history:getByRange'),
      getAllDates: invoke('db:history:getAllDates'),
      clearToday: invoke('db:history:clearToday'),
      resetAll: invoke('db:history:resetAll'),
    },
    challenges: {
      getAll: invoke('db:challenges:getAll'),
      getById: invoke('db:challenges:getById'),
      save: invoke('db:challenges:save'),
      delete: invoke('db:challenges:delete'),
    },
    kv: {
      // The channel carries a union of keys; the key decides the value's type
      get: <K extends keyof KvValues>(key: K) =>
        ipcRenderer.invoke('db:kv:get', key) as Promise<KvValues[K] | null>,
      set: <K extends keyof KvValues>(key: K, value: KvValues[K]) =>
        ipcRenderer.invoke('db:kv:set', key, value) as Promise<void>,
    },
    snapshot: {
      save: invoke('db:snapshot:save'),
      load: invoke('db:snapshot:load'),
      clear: invoke('db:snapshot:clear'),
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);
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
