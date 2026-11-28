/**
 * "Report a problem": a pre-filled GitHub issue. Built in the main process
 * from a fixed base URL, so the renderer never chooses an external URL.
 * Only versions go into the URL, never paths (they contain the user name).
 */
export interface ReportContext {
  appVersion: string;
  electronVersion: string;
  osVersion: string;
}

export function buildIssueUrl(issuesUrl: string, context: ReportContext): string {
  const body = [
    '**What happened?**',
    '',
    '',
    '**What did you expect to happen?**',
    '',
    '',
    '**Steps to reproduce**',
    '1. ',
    '',
    '---',
    `Focus Sessions ${context.appVersion} · Electron ${context.electronVersion} · Windows ${context.osVersion}`,
    '',
    'The app has opened its log folder: please drag `main.log` into this issue.',
  ].join('\n');
  const url = new URL(`${issuesUrl.replace(/\/+$/, '')}/new`);
  url.searchParams.set('labels', 'bug');
  url.searchParams.set('body', body);
  return url.toString();
}
