import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ORIGIN, resolveAppRequest } from '../electron/main/appProtocol';

const root = path.resolve('/srv/focus/dist');

describe('resolveAppRequest', () => {
  it('maps app:// paths to files inside the renderer root', () => {
    expect(resolveAppRequest(`${APP_ORIGIN}/index.html`, root)).toBe(path.join(root, 'index.html'));
    expect(resolveAppRequest(`${APP_ORIGIN}/assets/index-abc.js`, root)).toBe(
      path.join(root, 'assets', 'index-abc.js'),
    );
  });

  it('decodes percent-encoded names', () => {
    expect(resolveAppRequest(`${APP_ORIGIN}/assets/my%20file.css`, root)).toBe(
      path.join(root, 'assets', 'my file.css'),
    );
  });

  it.each([
    '/..%2F..%2Fpackage.json',
    '/%2e%2e%2f%2e%2e%2fsecret.txt',
    '/assets/..%2F..%2F..%2FWindows%2Fwin.ini',
    '/..%5C..%5Cpackage.json',
  ])('rejects traversal outside the root: %s', (p) => {
    expect(resolveAppRequest(`${APP_ORIGIN}${p}`, root)).toBeNull();
  });

  it('rejects the bare root and malformed escapes', () => {
    expect(resolveAppRequest(`${APP_ORIGIN}/`, root)).toBeNull();
    expect(resolveAppRequest(`${APP_ORIGIN}/%E0%A4%A`, root)).toBeNull();
  });
});
