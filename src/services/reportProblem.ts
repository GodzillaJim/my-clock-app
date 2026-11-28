import { createLogger } from '@/services/logger';

const log = createLogger('reportProblem');

/** Used only outside Electron (a plain browser), where there is no log to attach. */
const NEW_ISSUE_URL = 'https://github.com/GodzillaJim/my-clock-app/issues/new?labels=bug';

/**
 * Opens a pre-filled GitHub issue and shows the log file to attach to it.
 * In Electron the main process builds the URL and reveals the log (ADR 0007).
 */
export function reportProblem(): void {
  const api = window.electronAPI;
  if (!api) {
    window.open(NEW_ISSUE_URL, '_blank', 'noopener');
    return;
  }
  api.reportProblem().catch((error) => log.error('Failed to open the problem report:', error));
}
