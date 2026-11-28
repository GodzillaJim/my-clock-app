import React from 'react';
import {
  Box,
  Typography,
  Slider,
  FormGroup,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Divider,
  Alert,
  Button,
} from '@mui/material';
import { notificationService } from '@/services/notificationService';
import { SOUND_OPTIONS } from '@/services/sounds';
import type { SettingsSectionProps } from './types';

interface NotificationSectionProps extends SettingsSectionProps {
  permission: NotificationPermission;
  onRequestPermission: () => void;
}

/** Sounds, visual and system notifications, and the notification permission. */
export const NotificationSection: React.FC<NotificationSectionProps> = ({
  settings,
  onChange,
  permission,
  onRequestPermission,
}) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Permissions
      </Typography>

      {permission !== 'granted' && (
        <Alert
          severity={permission === 'denied' ? 'error' : 'warning'}
          sx={{ mb: 2 }}
          action={
            permission !== 'denied' && (
              <Button color="inherit" size="small" onClick={onRequestPermission}>
                Enable
              </Button>
            )
          }
        >
          {permission === 'denied'
            ? 'Notifications are blocked. Please enable them in your browser settings.'
            : 'Click "Enable" to allow desktop notifications.'}
        </Alert>
      )}

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableSystemNotifications}
              onChange={(e) => onChange('enableSystemNotifications', e.target.checked)}
              disabled={permission !== 'granted'}
            />
          }
          label="System notifications"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableVisualNotifications}
              onChange={(e) => onChange('enableVisualNotifications', e.target.checked)}
            />
          }
          label="In-app visual notifications"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableAudioNotifications}
              onChange={(e) => onChange('enableAudioNotifications', e.target.checked)}
            />
          }
          label="Audio notifications"
        />
      </FormGroup>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Notification Volume
        </Typography>
        <Slider
          value={settings.notificationVolume}
          onChange={(_, value) => onChange('notificationVolume', value as number)}
          min={0}
          max={100}
          step={5}
          marks={[
            { value: 0, label: '0%' },
            { value: 50, label: '50%' },
            { value: 100, label: '100%' },
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          disabled={!settings.enableAudioNotifications}
          sx={{ maxWidth: 400 }}
        />
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Sound Settings
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.enableTickSound}
              onChange={(e) => onChange('enableTickSound', e.target.checked)}
              disabled={!settings.enableAudioNotifications}
            />
          }
          label="Tick sound during last 10 seconds"
        />
      </FormGroup>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Session Complete Sound
        </Typography>
        <Select
          value={settings.sessionCompleteSound}
          onChange={(e) => {
            onChange('sessionCompleteSound', e.target.value);
            void notificationService.previewSound(e.target.value);
          }}
          size="small"
          disabled={!settings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          {SOUND_OPTIONS.sessionComplete.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Break Complete Sound
        </Typography>
        <Select
          value={settings.breakCompleteSound}
          onChange={(e) => {
            onChange('breakCompleteSound', e.target.value);
            void notificationService.previewSound(e.target.value);
          }}
          size="small"
          disabled={!settings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          {SOUND_OPTIONS.breakComplete.map((o) => (
            <MenuItem key={o.value} value={o.value}>
              {o.label}
            </MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );
};
