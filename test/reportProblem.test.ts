import { describe, expect, it } from 'vitest';
import { buildIssueUrl } from '../electron/main/reportProblem';

const context = { appVersion: '0.1.0', electronVersion: '45.0.0', osVersion: '10.0.26200' };

describe('buildIssueUrl', () => {
  it('opens a new bug issue with the versions filled in', () => {
    const url = new URL(buildIssueUrl('https://github.com/owner/repo/issues', context));
    expect(url.origin + url.pathname).toBe('https://github.com/owner/repo/issues/new');
    expect(url.searchParams.get('labels')).toBe('bug');
    const body = url.searchParams.get('body')!;
    expect(body).toContain('Focus Sessions 0.1.0 · Electron 45.0.0 · Windows 10.0.26200');
    expect(body).toContain('main.log');
  });

  it('tolerates a trailing slash', () => {
    expect(buildIssueUrl('https://github.com/owner/repo/issues/', context)).toMatch(
      /^https:\/\/github\.com\/owner\/repo\/issues\/new\?/,
    );
  });

  it('never includes file paths', () => {
    const body = new URL(buildIssueUrl('https://github.com/o/r/issues', context)).searchParams.get(
      'body',
    )!;
    expect(body).not.toMatch(/[A-Z]:\\|\/Users\/|AppData/);
  });
});
