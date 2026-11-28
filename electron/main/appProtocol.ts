import path from 'node:path';

/** Origin the packaged renderer is served from. */
export const APP_ORIGIN = 'app://bundle';

/**
 * Resolve an `app://` request URL to a file inside `root`, or `null` when the
 * path (after URL-decoding) would escape `root`.
 */
export function resolveAppRequest(requestUrl: string, root: string): string | null {
  const { pathname } = new URL(requestUrl);
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed escape sequence
  }
  const filePath = path.resolve(root, '.' + decoded);
  const relative = path.relative(root, filePath);
  return relative === '' || relative.startsWith('..') || path.isAbsolute(relative)
    ? null
    : filePath;
}
