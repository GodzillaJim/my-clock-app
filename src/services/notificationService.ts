import { SessionNotification, AppSettings } from '@/features/timer/types';

class NotificationService {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private settings: AppSettings | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
    }
  }

  setSettings(settings: AppSettings): void {
    this.settings = settings;
  }

  async showNotification(notification: SessionNotification): Promise<void> {
    if (!this.settings) return;

    const promises: Promise<void>[] = [];

    if (this.settings.enableSystemNotifications && 'Notification' in window) {
      promises.push(this.showSystemNotification(notification));
    }

    if (this.settings.enableAudioNotifications) {
      // Use explicit sound if provided, otherwise auto-select based on notification type
      const soundName = notification.sound || this.getSoundForType(notification.type);
      promises.push(this.playSound(soundName));
    }

    if (this.settings.enableVisualNotifications) {
      this.showVisualNotification(notification);
    }

    await Promise.all(promises);
  }

  private getSoundForType(type: SessionNotification['type']): string {
    switch (type) {
      case 'session_complete': return this.settings?.sessionCompleteSound || 'complete';
      case 'break_complete': return this.settings?.breakCompleteSound || 'break';
      default: return 'default';
    }
  }

  private async showSystemNotification(notification: SessionNotification): Promise<void> {
    try {
      // Use Electron API if available (in production)
      if (window.electronAPI && typeof window.electronAPI.sessionNotification === 'function') {
        await window.electronAPI.sessionNotification({
          title: notification.title,
          body: notification.body
        });
        return;
      }

      // Fallback to browser Notification API (in development or web)
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.body,
          icon: '/icon.png',
          badge: '/icon.png',
          silent: !this.settings?.enableAudioNotifications,
          requireInteraction: false,
          tag: notification.type
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/icon.png',
            badge: '/icon.png',
            silent: !this.settings?.enableAudioNotifications
          });
        }
      }
    } catch (error) {
      console.error('Failed to show system notification:', error);
    }
  }

  private showVisualNotification(notification: SessionNotification): void {
    const existingNotification = document.querySelector('.visual-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notificationEl = document.createElement('div');
    notificationEl.className = 'visual-notification';
    notificationEl.innerHTML = `
      <div class="visual-notification-content">
        <h3>${notification.title}</h3>
        <p>${notification.body}</p>
      </div>
    `;

    notificationEl.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border: 2px solid #2196f3;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 300px;
      animation: slideIn 0.3s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      .visual-notification-content h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: bold;
        color: #333;
      }
      .visual-notification-content p {
        margin: 0;
        font-size: 14px;
        color: #666;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notificationEl);

    setTimeout(() => {
      notificationEl.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        notificationEl.remove();
        style.remove();
      }, 300);
    }, 4000);
  }

  private async playSound(soundName: string): Promise<void> {
    if (!this.audioContext || !this.settings) return;

    try {
      // Resume AudioContext if it was suspended (happens when window loses focus)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      let audioBuffer = this.sounds.get(soundName);

      if (!audioBuffer) {
        audioBuffer = await this.loadSound(soundName);
        this.sounds.set(soundName, audioBuffer);
      }

      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      gainNode.gain.value = this.settings.notificationVolume / 100;

      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      source.start(0);
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  }

  private async loadSound(soundName: string): Promise<AudioBuffer> {
    const soundUrls: Record<string, string> = {
      'default': '/sounds/notification.wav',
      'complete': '/sounds/complete.wav',
      'break': '/sounds/break.wav',
      'tick': '/sounds/tick.wav'
    };

    const url = soundUrls[soundName] || soundUrls['default'];
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load sound: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return await this.audioContext!.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn(`Failed to load sound ${soundName}, using fallback:`, error);
      return this.createFallbackSound();
    }
  }

  private createFallbackSound(): AudioBuffer {
    const sampleRate = this.audioContext!.sampleRate;
    const duration = 0.2;
    const buffer = this.audioContext!.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 5) * 0.3;
    }

    return buffer;
  }

  async playTickSound(): Promise<void> {
    if (!this.settings?.enableTickSound) return;
    await this.playSound('tick');
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }

  getPermissionStatus(): NotificationPermission {
    return 'Notification' in window ? Notification.permission : 'denied';
  }
}

export const notificationService = new NotificationService();