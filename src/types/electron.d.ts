import type { ElectronAPI } from '../../electron/ipc/contract';

// `window.electronAPI` is exposed by electron/preload; its shape is defined by
// the IPC contract. Absent when the renderer runs outside Electron (tests, browser).
declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
