import { describe, expect, it } from 'vitest';
import { PRODUCTION_CSP, developmentCsp, withCsp } from '../electron/main/csp';

const directive = (policy: string, name: string) =>
  policy
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe('Content Security Policy', () => {
  it('only allows bundled scripts in production', () => {
    expect(directive(PRODUCTION_CSP, 'default-src')).toBe("'self'");
    expect(directive(PRODUCTION_CSP, 'script-src')).toBe("'self'");
    expect(PRODUCTION_CSP).not.toContain('unsafe-eval');
    expect(directive(PRODUCTION_CSP, 'object-src')).toBe("'none'");
    expect(directive(PRODUCTION_CSP, 'connect-src')).toBe("'self'");
  });

  it('relaxes only what Vite needs in development', () => {
    const dev = developmentCsp('http://localhost:7777/');
    expect(directive(dev, 'script-src')).toBe("'self' 'unsafe-inline'");
    expect(directive(dev, 'connect-src')).toBe("'self' ws://localhost:7777");
    expect(dev).not.toContain('unsafe-eval');
  });

  it('adds the header without changing the response', async () => {
    const original = new Response('<html></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
    const response = withCsp(original, PRODUCTION_CSP);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/html');
    expect(response.headers.get('Content-Security-Policy')).toBe(PRODUCTION_CSP);
    expect(await response.text()).toBe('<html></html>');
  });
});
