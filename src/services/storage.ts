import { createLogger } from '@/services/logger';

const log = createLogger('storage');

interface StorageService<T> {
  load: () => Promise<T | null>;
  save: (data: T) => Promise<void>;
  clear: () => Promise<void>;
}

export const createStorageService = <T>(key: string): StorageService<T> => {
  const isElectron = !!window.electronAPI;

  return {
    load: async () => {
      if (!isElectron) {
        try {
          const data = localStorage.getItem(key);
          return data ? (JSON.parse(data) as T) : null;
        } catch (error) {
          log.error('LocalStorage load failed:', error);
          return null;
        }
      }

      try {
        const filePath = await window.electronAPI!.getStoragePath(key);
        const data = await window.electronAPI!.storageRead(filePath);
        return data ? (JSON.parse(data) as T) : null;
      } catch (error) {
        log.error('File storage load failed:', error);
        return null;
      }
    },

    save: async (data: T) => {
      if (!isElectron) {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          log.error('LocalStorage save failed:', error);
        }
        return;
      }

      try {
        const filePath = await window.electronAPI!.getStoragePath(key);
        await window.electronAPI!.storageWrite(filePath, JSON.stringify(data, null, 2));
      } catch (error) {
        log.error('File storage save failed:', error);
        throw error;
      }
    },

    clear: async () => {
      if (!isElectron) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          log.error('LocalStorage clear failed:', error);
        }
        return;
      }

      try {
        const filePath = await window.electronAPI!.getStoragePath(key);
        await window.electronAPI!.storageDelete(filePath);
      } catch (error) {
        log.error('File storage clear failed:', error);
      }
    },
  };
};
