import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  FormGroup,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import type { AppSettings } from '@/features/timer/types';
import type { SettingsSectionProps } from './types';

const THEMES: { value: AppSettings['theme']; label: string }[] = [
  { value: 'system', label: 'Match Windows' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Theme, layout and tray behaviour. */
export const AppearanceSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  return (
    <Box>
      <Typography variant="h6" id="theme-label" gutterBottom>
        Theme
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-labelledby="theme-label"
        value={settings.theme}
        onChange={(_, value: AppSettings['theme'] | null) => value && onChange('theme', value)}
      >
        {THEMES.map(({ value, label }) => (
          <ToggleButton key={value} value={value} sx={{ px: 2 }}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Layout
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        How the timer and your day are arranged
      </Typography>
      <FormControl sx={{ minWidth: 300 }}>
        <Select
          value={settings.layout || 'zen'}
          onChange={(e) =>
            onChange('layout', e.target.value as 'zen' | 'dashboard' | 'commandCenter')
          }
          size="small"
        >
          <MenuItem value="zen">Zen Minimal - Clean, centered timer</MenuItem>
          <MenuItem value="dashboard">Dashboard - Sidebar with stats panel</MenuItem>
          <MenuItem value="commandCenter">Command Center - All-in-one with timeline</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        System Integration
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.minimizeToSystemTray}
              onChange={(e) => onChange('minimizeToSystemTray', e.target.checked)}
            />
          }
          label="Minimize to system tray"
        />
      </FormGroup>
    </Box>
  );
};
