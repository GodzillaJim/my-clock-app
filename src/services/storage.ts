import { createLogger } from '@/services/logger';

const log = createLogger('storage');

interface StorageService<T> {
  load: () => Promise<T | null>;
  save: (data: T) => Promise<void>;
  clear: () => Promise<void>;
}

/**
 * JSON-in-localStorage store, used only when the SQLite bridge is unavailable
 * (running the renderer in a plain browser or in tests). In Electron all data
 * goes through `window.electronAPI.db`; the renderer has no file-system access.
 */
export const createStorageService = <T>(key: string): StorageService<T> => ({
  load: async () => {
    try {
      const data = localStorage.getItem(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      log.error('LocalStorage load failed:', error);
      return null;
    }
  },

  save: async (data: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      log.error('LocalStorage save failed:', error);
    }
  },

  clear: async () => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      log.error('LocalStorage clear failed:', error);
    }
  },
});
