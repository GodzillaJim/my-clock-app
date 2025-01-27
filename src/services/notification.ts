// src/services/notification.ts
type NotificationOptions = {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    silent?: boolean;
    requireInteraction?: boolean;
    data?: unknown;
  };
  
  export class NotificationService {
    private static isSupported(): boolean {
      return 'Notification' in window;
    }
  
    private static getDefaultOptions(type: 'focus' | 'break' | 'completion'): NotificationOptions {
      const baseOptions = {
        icon: '/logo-192.png',
        badge: '/badge-192.png',
        silent: false,
        requireInteraction: false,
      };
  
      switch (type) {
        case 'focus':
          return { ...baseOptions, tag: 'focus-session', silent: true };
        case 'break':
          return { ...baseOptions, tag: 'break-session', requireInteraction: true };
        case 'completion':
          return { ...baseOptions, tag: 'task-complete', silent: false };
        default:
          return baseOptions;
      }
    }
  
    async requestPermission(): Promise<NotificationPermission> {
      if (!NotificationService.isSupported()) {
        console.warn('Notifications not supported in this environment');
        return 'denied';
      }
  
      try {
        return await Notification.requestPermission();
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        return 'denied';
      }
    }
  
    show(title: string, options?: NotificationOptions & { type?: 'focus' | 'break' | 'completion' }) {
      if (!NotificationService.isSupported()) {
        console.warn('Notifications not supported - cannot show:', title);
        return;
      }
  
      if (Notification.permission !== 'granted') {
        console.warn('Notifications permission not granted');
        return;
      }
  
      try {
        const defaultOptions = options?.type 
          ? NotificationService.getDefaultOptions(options.type)
          : {};
        
        new Notification(title, {
          ...defaultOptions,
          ...options,
        });
      } catch (error) {
        console.error('Error showing notification:', error);
        throw new Error(`Notification failed: ${(error as Error).message}`);
      }
    }
  
    // For testing/dev environments
    static createMock() {
      return {
        requestPermission: async () => 'granted' as NotificationPermission,
        show: (title: string, options?: NotificationOptions) => {
          console.log('[Mock Notification]:', title, options);
        }
      };
    }
  }
  
  // Export singleton instance
  export const notificationService = new NotificationService();