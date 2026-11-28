import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSection } from '../DataSection';
import { FocusTimerProvider, useFocusTimerContext } from '@/features/timer/FocusTimerContext';

vi.mock('@/services/domain', () => ({
  services: {
    sessions: { add: vi.fn(() => Promise.resolve()) },
    plans: { save: vi.fn(() => Promise.resolve()) },
    stats: { recalculate: vi.fn(() => Promise.resolve()) },
  },
}));
vi.mock('@/services/persistenceService', () => ({
  persistenceService: { savePlanSnapshot: vi.fn(), clearPlanSnapshot: vi.fn() },
}));
vi.mock('@/services/notificationService', () => ({
  notificationService: { showNotification: vi.fn(), playTickSound: vi.fn(() => Promise.resolve()) },
}));

const backups = [
  { name: 'focus-sessions.manual.2026-03-10T09-00-00-000Z.db', createdAt: 3, sizeBytes: 2048 },
  {
    name: 'focus-sessions.pre-import.2026-03-09T09-00-00-000Z.db',
    createdAt: 2,
    sizeBytes: 3 * 1024 * 1024,
  },
  { name: 'focus-sessions.v1.2026-03-08T09-00-00-000Z.db', createdAt: 1, sizeBytes: 10 },
  { name: 'focus-sessions.pre-restore.2026-03-07T09-00-00-000Z.db', createdAt: 0, sizeBytes: 10 },
];

let data: Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  data = {
    export: vi.fn(),
    import: vi.fn(),
    backupNow: vi.fn(() => Promise.resolve(backups[0])),
    listBackups: vi.fn(() => Promise.resolve(backups)),
    restoreBackup: vi.fn(),
  };
  window.electronAPI = { data, onSystemSuspend: () => () => {} } as unknown as NonNullable<
    Window['electronAPI']
  >;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete window.electronAPI;
  vi.restoreAllMocks();
});

const renderSection = (children?: React.ReactNode) =>
  render(
    <FocusTimerProvider>
      <DataSection />
      {children}
    </FocusTimerProvider>,
  );

describe('DataSection', () => {
  it('lists backups with what made them and their size', async () => {
    renderSection();
    await screen.findByText(/Manual backup · 2 KB/);
    expect(screen.getByText(/Before an import · 3\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Before an app update · 1 KB/)).toBeInTheDocument();
    expect(screen.getByText(/Before a restore/)).toBeInTheDocument();
  });

  it('reports a finished export and stays quiet when it is cancelled', async () => {
    renderSection();
    data.export.mockResolvedValueOnce({ status: 'done', fileName: 'mine.json' });
    fireEvent.click(screen.getByRole('button', { name: 'Export data…' }));
    await screen.findByText('Exported to mine.json.');

    data.export.mockResolvedValueOnce({ status: 'cancelled' });
    fireEvent.click(screen.getByRole('button', { name: 'Export data…' }));
    await waitFor(() => expect(screen.queryByText('Exported to mine.json.')).toBeNull());
  });

  it('shows why an import failed, without the IPC wrapper text', async () => {
    renderSection();
    data.import.mockRejectedValueOnce(
      new Error(
        "Error invoking remote method 'data:import': Error: This is not a Focus Sessions export.",
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Import data…' }));
    await screen.findByText('This is not a Focus Sessions export.');
  });

  it('creates a backup on request', async () => {
    renderSection();
    fireEvent.click(screen.getByRole('button', { name: 'Back up now' }));
    await screen.findByText('Backup created.');
    expect(data.backupNow).toHaveBeenCalled();
  });

  it('blocks import and restore while a session runs', async () => {
    const Start = () => {
      const { startOrResume } = useFocusTimerContext();
      React.useEffect(
        () => startOrResume({ focusDuration: 25, shortBreakDuration: 5 }),
        [startOrResume],
      );
      return null;
    };
    renderSection(<Start />);
    await screen.findByText(/Manual backup/);
    expect(screen.getByRole('button', { name: 'Import data…' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Restore backup/ })[0]).toBeDisabled();
    expect(screen.getByText(/Stop the running session/)).toBeInTheDocument();
  });

  it('explains that the feature needs the desktop app', () => {
    delete window.electronAPI;
    renderSection();
    expect(screen.getByText(/available in the desktop app/)).toBeInTheDocument();
  });

  it('logs a failed backup listing instead of breaking', async () => {
    data.listBackups.mockRejectedValueOnce(new Error('disk'));
    renderSection();
    await act(async () => {});
    expect(await screen.findByText('No backups yet.')).toBeInTheDocument();
  });
});
