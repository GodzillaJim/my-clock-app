import fs from 'fs/promises';
import path from 'path';

interface StorageService<T> {
  load: () => Promise<T | null>;
  save: (data: T) => Promise<void>;
  clear: () => Promise<void>;
}

const getStorageFilePath = async (key: string): Promise<string> => {
  if (window.electronAPI) {
    const userDataPath = await window.electronAPI.getUserDataPath();
    const storageDir = path.join(userDataPath, 'data');
    try {
      await fs.mkdir(storageDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
    return path.join(storageDir, `${key}.json`);
  }
  
  // Fallback for non-Electron environments (e.g., web browser, testing)
  // This will use localStorage.
  console.warn('Electron API not available. Falling back to localStorage.');
  return key; // Use the key directly for localStorage
};

export const createStorageService = <T>(key: string): StorageService<T> => {
  let filePathPromise = getStorageFilePath(key);

  const isElectron = !!window.electronAPI;

  return {
    load: async () => {
      if (!isElectron) {
        try {
          const data = localStorage.getItem(key);
          return data ? JSON.parse(data) as T : null;
        } catch (error) {
          console.error('LocalStorage load failed:', error);
          return null;
        }
      }

      try {
        const filePath = await filePathPromise;
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
      } catch (error) {
                const errorAsAny = error as any;
        if (errorAsAny.code === 'ENOENT') {
          return null; // File not found is a normal condition
        }
        console.error('File storage load failed:', error);
        return null;
      }
    },
    
    save: async (data: T) => {
      if (!isElectron) {
        try {
          localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
          console.error('LocalStorage save failed:', error);
        }
        return;
      }

      try {
        const filePath = await filePathPromise;
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      } catch (error) {
        console.error('File storage save failed:', error);
      }
    },
  
    clear: async () => {
      if (!isElectron) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          console.error('LocalStorage clear failed:', error);
        }
        return;
      }
      
      try {
        const filePath = await filePathPromise;
        await fs.unlink(filePath);
      } catch (error) {
                const errorAsAny = error as any;
        if (errorAsAny.code !== 'ENOENT') { // It's not an error if the file doesn't exist
          console.error('File storage clear failed:', error);
        }
      }
    }
  };
};