import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { Backup, FileDownload, FileUpload, Restore } from '@mui/icons-material';
import type { BackupInfo } from '../../../../electron/ipc/contract';
import { useFocusTimerContext } from '@/features/timer/FocusTimerContext';
import { createLogger } from '@/services/logger';

const log = createLogger('DataSection');

/** "manual", "pre-import", "v1" (before an upgrade), ... from a backup file name. */
const backupKind = (name: string) => {
  const label = name.split('.')[1] ?? '';
  if (label === 'manual') return 'Manual backup';
  if (label === 'pre-import') return 'Before an import';
  if (label === 'pre-restore') return 'Before a restore';
  if (/^v\d+$/.test(label)) return 'Before an app update';
  return 'Backup';
};

const sizeText = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

type Status = { severity: 'success' | 'error' | 'info'; text: string } | null;

/**
 * Export, import, back up and restore all data. Dialogs and confirmations are
 * shown by the main process; replacing data reloads the app afterwards.
 */
export const DataSection: React.FC = () => {
  const data = window.electronAPI?.data;
  const { hasSession } = useFocusTimerContext();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const refresh = useCallback(async () => {
    if (!data) return;
    try {
      setBackups(await data.listBackups());
    } catch (error) {
      log.error('Failed to list backups:', error);
    }
  }, [data]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (action: () => Promise<Status | 'reload'>) => {
    setBusy(true);
    setStatus(null);
    try {
      const outcome = await action();
      if (outcome === 'reload') {
        window.location.reload();
        return;
      }
      setStatus(outcome);
      await refresh();
    } catch (error) {
      log.error('Data action failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setStatus({
        severity: 'error',
        text: message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''),
      });
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return <Alert severity="info">Export and backups are available in the desktop app.</Alert>;
  }

  const replaceBlocked = hasSession;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Export and import
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Move your sessions, history, challenges and settings to another computer, or keep a copy.
      </Typography>
      <Stack direction="row" spacing={1.5} sx={{ mb: 4 }}>
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await data.export();
              return result.status === 'done'
                ? { severity: 'success', text: `Exported to ${result.fileName}.` }
                : null;
            })
          }
        >
          Export data…
        </Button>
        <Button
          variant="outlined"
          startIcon={<FileUpload />}
          disabled={busy || replaceBlocked}
          onClick={() =>
            run(async () => ((await data.import()).status === 'done' ? 'reload' : null))
          }
        >
          Import data…
        </Button>
      </Stack>

      <Typography variant="h6" gutterBottom>
        Backups
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        A backup is also made automatically before every app update, import and restore.
      </Typography>
      <Button
        variant="outlined"
        startIcon={<Backup />}
        disabled={busy}
        onClick={() =>
          run(async () => {
            await data.backupNow();
            return { severity: 'success', text: 'Backup created.' };
          })
        }
      >
        Back up now
      </Button>

      {status && (
        <Alert severity={status.severity} sx={{ mt: 2 }}>
          {status.text}
        </Alert>
      )}
      {replaceBlocked && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Stop the running session to import data or restore a backup.
        </Alert>
      )}

      {backups.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
          No backups yet.
        </Typography>
      ) : (
        <List dense sx={{ mt: 1 }} aria-label="Backups">
          {backups.map((backup) => (
            <ListItem
              key={backup.name}
              disableGutters
              secondaryAction={
                <Button
                  size="small"
                  startIcon={<Restore />}
                  disabled={busy || replaceBlocked}
                  aria-label={`Restore backup from ${new Date(backup.createdAt).toLocaleString()}`}
                  onClick={() =>
                    run(async () =>
                      (await data.restoreBackup(backup.name)).status === 'done' ? 'reload' : null,
                    )
                  }
                >
                  Restore
                </Button>
              }
            >
              <ListItemText
                primary={new Date(backup.createdAt).toLocaleString()}
                secondary={`${backupKind(backup.name)} · ${sizeText(backup.sizeBytes)}`}
              />
            </ListItem>
          ))}
        </List>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        All data is stored on this computer. Nothing is sent to a server.
      </Alert>
    </Box>
  );
};
