import { APP_ORIGIN } from './appProtocol';

/** Web permissions the renderer may use; everything else is denied. */
const ALLOWED_PERMISSIONS = new Set(['notifications']);

export function isAllowedPermission(permission: string): boolean {
  return ALLOWED_PERMISSIONS.has(permission);
}

/**
 * The window may only ever show the app itself: the bundled renderer, or the
 * Vite dev server during `npm run dev`. External links open in the browser.
 */
export function isAllowedNavigation(url: string, devServerUrl?: string): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (sameSite(target, new URL(APP_ORIGIN))) return true;
  return !!devServerUrl && sameSite(target, new URL(devServerUrl));
}

// Node's URL reports a "null" origin for custom schemes such as app:, so
// compare protocol and host (which includes the port) instead.
function sameSite(a: URL, b: URL): boolean {
  return a.protocol === b.protocol && a.host === b.host;
}

/**
 * IPC is only accepted from the app's own top-level page. `frameUrl` is the
 * sender frame's URL; a missing frame (navigated away or destroyed) is refused.
 */
export function isTrustedSender(
  frameUrl: string | undefined,
  isMainFrame: boolean,
  devServerUrl?: string,
): boolean {
  return !!frameUrl && isMainFrame && isAllowedNavigation(frameUrl, devServerUrl);
}

/** Only https links are handed to the default browser. */
export function isExternalLink(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
