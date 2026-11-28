import { SessionNotification, AppSettings } from '@/features/timer/types';
import { renderSound } from './sounds';
import { createLogger } from '@/services/logger';

const log = createLogger('notificationService');

class NotificationService {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, AudioBuffer> = new Map();
  private settings: AppSettings | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new AudioContext();
    } catch (error) {
      log.warn('Audio context not supported:', error);
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
      case 'session_complete':
        return this.settings?.sessionCompleteSound || 'complete';
      case 'break_complete':
        return this.settings?.breakCompleteSound || 'break';
      default:
        return 'default';
    }
  }

  private async showSystemNotification(notification: SessionNotification): Promise<void> {
    try {
      // Use Electron API if available (in production)
      if (window.electronAPI && typeof window.electronAPI.sessionNotification === 'function') {
        await window.electronAPI.sessionNotification({
          title: notification.title,
          body: notification.body,
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
          tag: notification.type,
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(notification.title, {
            body: notification.body,
            icon: '/icon.png',
            badge: '/icon.png',
            silent: !this.settings?.enableAudioNotifications,
          });
        }
      }
    } catch (error) {
      log.error('Failed to show system notification:', error);
    }
  }

  private showVisualNotification(notification: SessionNotification): void {
    document.querySelector('.visual-notification')?.remove();

    // Text goes in as textContent: notification text never becomes markup.
    // Colours come from the theme's --fs-* variables (see src/theme/tokens.ts).
    const notificationEl = document.createElement('div');
    notificationEl.className = 'visual-notification';
    notificationEl.setAttribute('role', 'status');
    const title = document.createElement('h3');
    title.textContent = notification.title;
    const body = document.createElement('p');
    body.textContent = notification.body;
    notificationEl.append(title, body);

    const style = document.createElement('style');
    style.textContent = `
      .visual-notification {
        position: fixed;
        top: 20px;
        right: 20px;
        max-width: 300px;
        padding: 16px;
        z-index: 10000;
        background: var(--fs-raised);
        border: 1px solid var(--fs-line-raised);
        border-radius: var(--fs-radius-md);
        box-shadow: var(--fs-shadow-toast);
        animation: fs-toast-in var(--fs-motion-slow) var(--fs-ease-out);
      }
      .visual-notification.leaving {
        animation: fs-toast-out var(--fs-motion-slow) ease-in forwards;
      }
      .visual-notification h3 {
        margin: 0 0 6px;
        font-size: 15px;
        font-weight: 600;
        color: var(--fs-text);
      }
      .visual-notification p {
        margin: 0;
        font-size: 14px;
        color: var(--fs-text-secondary);
      }
      @keyframes fs-toast-in {
        from { transform: translateX(24px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fs-toast-out {
        to { transform: translateX(24px); opacity: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .visual-notification, .visual-notification.leaving { animation: none; }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(notificationEl);

    setTimeout(() => {
      notificationEl.classList.add('leaving');
      setTimeout(() => {
        notificationEl.remove();
        style.remove();
      }, 300);
    }, 4000);
  }

  /** Play a sound regardless of notification settings, e.g. to preview a choice in Settings. */
  async previewSound(soundName: string): Promise<void> {
    await this.playSound(soundName);
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
        audioBuffer = this.createSoundBuffer(soundName);
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
      log.error('Failed to play sound:', error);
    }
  }

  private createSoundBuffer(soundName: string): AudioBuffer {
    const ctx = this.audioContext!;
    const samples = renderSound(soundName, ctx.sampleRate);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  async playTickSound(): Promise<void> {
    if (!this.settings?.enableTickSound) return;
    await this.playSound('tick');
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      log.warn('This browser does not support notifications');
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
