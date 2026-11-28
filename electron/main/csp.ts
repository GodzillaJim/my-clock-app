/**
 * Content Security Policy for the renderer.
 *
 * Scripts only come from the app bundle, with no inline scripts and no
 * `eval`. Inline styles stay allowed because Emotion (MUI) injects `<style>`
 * tags at runtime. Nothing is loaded from the network.
 */
const BASE_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'media-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
};

function serialize(directives: Record<string, string[]>): string {
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

/** Policy for the packaged app, served from `app://bundle`. */
export const PRODUCTION_CSP = serialize(BASE_DIRECTIVES);

/**
 * Policy for `npm run dev`: the Vite React plugin injects an inline
 * fast-refresh preamble, and HMR talks to the dev server over a WebSocket.
 */
export function developmentCsp(devServerUrl: string): string {
  const origin = new URL(devServerUrl);
  const ws = `ws://${origin.host}`;
  return serialize({
    ...BASE_DIRECTIVES,
    'script-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'", ws],
  });
}

/** Returns a copy of `response` that carries the given policy. */
export function withCsp(response: Response, policy: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', policy);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
