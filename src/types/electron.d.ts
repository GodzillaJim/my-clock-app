interface ElectronAPI {
  // System tray functions
  minimizeToTray: () => Promise<void>;
  showWindow: () => Promise<void>;
  updateTrayStatus: (status: string) => Promise<void>;
  sessionNotification: (notification: { title: string; body: string }) => Promise<void>;
  
  // Storage
  getUserDataPath: () => Promise<string>;
  
  // File storage operations
  storageRead: (filePath: string) => Promise<string | null>;
  storageWrite: (filePath: string, data: string) => Promise<void>;
  storageDelete: (filePath: string) => Promise<void>;
  getStoragePath: (key: string) => Promise<string>;

  // Event listeners for tray actions
  onTrayStartSession: (callback: () => void) => void;
  onTrayOpenSettings: (callback: () => void) => void;
  onTrayOpenHistory: (callback: () => void) => void;
  onGlobalShortcutStartSession: (callback: () => void) => void;
  
  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};