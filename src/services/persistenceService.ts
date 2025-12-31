import { ActiveSessionSnapshot, SNAPSHOT_KEY } from '@/types/Persistence';

export const persistenceService = {
  saveSnapshot: (snapshot: ActiveSessionSnapshot, key: string = SNAPSHOT_KEY): void => {
    try {
      localStorage.setItem(key, JSON.stringify(snapshot));
    } catch (error) {
      console.error('Failed to save session snapshot:', error);
    }
  },

  loadSnapshot: (key: string = SNAPSHOT_KEY): ActiveSessionSnapshot | null => {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as ActiveSessionSnapshot;
    } catch (error) {
      console.error('Failed to load session snapshot:', error);
      return null;
    }
  },

  clearSnapshot: (key: string = SNAPSHOT_KEY): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear session snapshot:', error);
    }
  }
};
