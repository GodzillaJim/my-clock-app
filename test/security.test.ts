import { describe, expect, it } from 'vitest';
import {
  isAllowedNavigation,
  isAllowedPermission,
  isExternalLink,
  isTrustedSender,
} from '../electron/main/security';

describe('window security policy', () => {
  it('grants only the notification permission', () => {
    expect(isAllowedPermission('notifications')).toBe(true);
    for (const p of ['media', 'geolocation', 'clipboard-read', 'openExternal', 'fullscreen']) {
      expect(isAllowedPermission(p)).toBe(false);
    }
  });

  it('allows navigation only within the app', () => {
    expect(isAllowedNavigation('app://bundle/index.html')).toBe(true);
    expect(isAllowedNavigation('app://other/index.html')).toBe(false);
    expect(isAllowedNavigation('https://example.com/')).toBe(false);
    expect(isAllowedNavigation('file:///C:/Windows/win.ini')).toBe(false);
    expect(isAllowedNavigation('not a url')).toBe(false);
  });

  it('allows the dev server only when one is running', () => {
    expect(isAllowedNavigation('http://localhost:7777/', 'http://localhost:7777/')).toBe(true);
    expect(isAllowedNavigation('http://localhost:7777/')).toBe(false);
    expect(isAllowedNavigation('http://localhost:9999/', 'http://localhost:7777/')).toBe(false);
  });

  it('accepts IPC only from the app page itself', () => {
    expect(isTrustedSender('app://bundle/index.html', true)).toBe(true);
    // A subframe of the app page, another origin, or a vanished frame
    expect(isTrustedSender('app://bundle/index.html', false)).toBe(false);
    expect(isTrustedSender('https://example.com/', true)).toBe(false);
    expect(isTrustedSender('data:text/html,<p>hi</p>', true)).toBe(false);
    expect(isTrustedSender(undefined, true)).toBe(false);
    expect(isTrustedSender('http://localhost:7777/', true, 'http://localhost:7777/')).toBe(true);
  });

  it('opens only https links externally', () => {
    expect(isExternalLink('https://github.com/')).toBe(true);
    expect(isExternalLink('http://example.com/')).toBe(false);
    expect(isExternalLink('file:///C:/evil.exe')).toBe(false);
    expect(isExternalLink('ms-settings:privacy')).toBe(false);
    expect(isExternalLink('garbage')).toBe(false);
  });
});
