interface StorageService<T> {
    load: () => T | null;
    save: (data: T) => void;
    clear: () => void;
  }
  
  export const createStorageService = <T>(key: string): StorageService<T> => ({
    load: () => {
      try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) as T : null;
      } catch (error) {
        console.error('Storage load failed:', error);
        return null;
      }
    },
    
    save: (data: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch (error) {
        console.error('Storage save failed:', error);
      }
    },
  
    clear: () => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Storage clear failed:', error);
      }
    }
  });