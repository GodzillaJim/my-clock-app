interface ElectronDbAPI {
  sessions: {
    save: (session: any) => Promise<void>;
    getByDate: (date: string) => Promise<any[]>;
    getHistory: (limit?: number) => Promise<any[]>;
    delete: (id: string) => Promise<void>;
    deleteByDate: (date: string) => Promise<void>;
    deleteAll: () => Promise<void>;
    saveAndUpdateHistory: (session: any, historyData: any) => Promise<void>;
  };
  plans: {
    save: (plan: any) => Promise<void>;
    get: (id: string) => Promise<any | null>;
    getByDate: (date: string) => Promise<any[]>;
    getByDateRange: (start: string, end: string) => Promise<any[]>;
    update: (id: string, updates: any) => Promise<any | null>;
    updateSegment: (segmentId: string, updates: any) => Promise<void>;
  };
  history: {
    save: (history: any) => Promise<void>;
    getByDate: (date: string) => Promise<any | null>;
    getByRange: (start: string, end: string) => Promise<any[]>;
    getAllDates: () => Promise<string[]>;
    deleteByDate: (date: string) => Promise<void>;
    deleteAll: () => Promise<void>;
    clearToday: (date: string) => Promise<void>;
    resetAll: () => Promise<void>;
  };
  challenges: {
    getAll: () => Promise<any[]>;
    getById: (id: string) => Promise<any | null>;
    save: (challenge: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
    markDay: (challengeId: string, date: string, status: string, note?: string) => Promise<void>;
  };
  feedback: {
    getAll: (filters?: any) => Promise<any[]>;
    save: (item: any) => Promise<void>;
    update: (id: string, updates: any) => Promise<void>;
    delete: (id: string) => Promise<void>;
    getStats: () => Promise<any>;
  };
  kv: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
  };
  snapshot: {
    save: (plan: any) => Promise<void>;
    load: () => Promise<{ plan: any; lastUpdated: number } | null>;
    clear: () => Promise<void>;
  };
}

interface ElectronAPI {
  // Logging: forwarded to the main-process log file
  log: (level: 'error' | 'warn' | 'info' | 'debug', scope: string, args: unknown[]) => void;

  // System tray functions
  minimizeToTray: () => Promise<void>;
  showWindow: () => Promise<void>;
  updateTrayStatus: (status: string) => Promise<void>;
  sessionNotification: (notification: { title: string; body: string }) => Promise<void>;

  // SQLite database API
  db: ElectronDbAPI;

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
