interface ElectronAPI {
  // System tray functions
  minimizeToTray: () => Promise<void>;
  showWindow: () => Promise<void>;
  updateTrayStatus: (status: string) => Promise<void>;
  sessionNotification: (notification: { title: string; body: string }) => Promise<void>;
  
  // Storage
  getUserDataPath: () => Promise<string>;

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