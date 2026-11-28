import React from 'react';
import {
  Box,
  Typography,
  Slider,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  TextField,
  Divider,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Button,
} from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import type { SettingsSectionProps } from './types';

/** Focus and break durations, quick presets, resume behaviour and time display. */
export const TimerSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  const addPreset = (value: number) =>
    onChange(
      'quickPresets',
      [...settings.quickPresets, value].sort((a, b) => a - b),
    );
  const removePreset = (value: number) =>
    onChange(
      'quickPresets',
      settings.quickPresets.filter((preset) => preset !== value),
    );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Session Duration
      </Typography>

      <Grid container spacing={3}>
        <Grid size={12}>
          <Card>
            <CardContent sx={{ pb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Focus Session Duration
              </Typography>
              <Box sx={{ px: 1, pt: 2, pb: 3 }}>
                <Slider
                  value={settings.focusDuration}
                  onChange={(_, value) => onChange('focusDuration', value as number)}
                  min={1}
                  max={240}
                  step={1}
                  marks={[
                    { value: 25, label: '25' },
                    { value: 60, label: '60' },
                    { value: 120, label: '120' },
                    { value: 240, label: '240' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}m`}
                  sx={{
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.75rem',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiSlider-mark': {
                      height: 8,
                      width: 2,
                    },
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <TextField
                  size="small"
                  type="number"
                  value={settings.focusDuration}
                  onChange={(e) => onChange('focusDuration', parseInt(e.target.value) || 25)}
                  slotProps={{ htmlInput: { min: 1, max: 240 } }}
                  sx={{ width: 100 }}
                  label="Minutes"
                />
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  1-240 minutes
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Short Break
              </Typography>
              <Slider
                value={settings.shortBreakDuration}
                onChange={(_, value) => onChange('shortBreakDuration', value as number)}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 5, label: '5m' },
                  { value: 15, label: '15m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}m`}
              />
              <TextField
                size="small"
                type="number"
                value={settings.shortBreakDuration}
                onChange={(e) => onChange('shortBreakDuration', parseInt(e.target.value) || 5)}
                slotProps={{ htmlInput: { min: 1, max: 30 } }}
                sx={{ mt: 1 }}
                fullWidth
                helperText="1-30 minutes"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Crash Recovery / Resume Strategy
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          How the timer behaves if the app is closed/crashes while running
        </Typography>
        <Select
          value={settings.resumeStrategy || 'elapsed'}
          onChange={(e) => onChange('resumeStrategy', e.target.value as 'elapsed' | 'pause')}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="elapsed">Account for downtime (Elapsed)</MenuItem>
          <MenuItem value="pause">Treat downtime as pause (Pause)</MenuItem>
        </Select>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Quick Presets
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Customize the quick duration buttons shown in the timer
        </Typography>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          {settings.quickPresets.map((preset, index) => (
            <Chip
              key={`preset-${preset}-${index}`}
              label={`${preset}m`}
              onDelete={() => removePreset(preset)}
              deleteIcon={<Remove />}
              variant="outlined"
              sx={{ mb: 1 }}
            />
          ))}
        </Stack>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            type="number"
            placeholder="Add preset"
            slotProps={{ htmlInput: { min: 1, max: 240 } }}
            sx={{ width: 120 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (value >= 1 && value <= 240 && !settings.quickPresets.includes(value)) {
                  addPreset(value);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={(e) => {
              const input = e.currentTarget.parentElement?.querySelector(
                'input[type="number"]',
              ) as HTMLInputElement;
              const value = parseInt(input?.value || '');
              if (value >= 1 && value <= 240 && !settings.quickPresets.includes(value)) {
                addPreset(value);
                input.value = '';
              }
            }}
          >
            Add
          </Button>
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Display Settings
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.showSessionStartTime}
              onChange={(e) => onChange('showSessionStartTime', e.target.checked)}
            />
          }
          label="Show session start time"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.showSessionEndTime}
              onChange={(e) => onChange('showSessionEndTime', e.target.checked)}
            />
          }
          label="Show expected end time"
        />
      </FormGroup>

      <FormControl sx={{ mt: 2, minWidth: 200 }}>
        <FormLabel>Time Format</FormLabel>
        <Select
          value={settings.timeFormat}
          onChange={(e) => onChange('timeFormat', e.target.value as '12h' | '24h')}
          size="small"
        >
          <MenuItem value="12h">12-hour (2:30 PM)</MenuItem>
          <MenuItem value="24h">24-hour (14:30)</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Behavior
      </Typography>

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={settings.autoStartBreaks}
              onChange={(e) => onChange('autoStartBreaks', e.target.checked)}
            />
          }
          label="Auto-start breaks after focus sessions"
        />
        <FormControlLabel
          control={
            <Switch
              checked={settings.autoStartNextSession}
              onChange={(e) => onChange('autoStartNextSession', e.target.checked)}
            />
          }
          label="Auto-start next session after breaks"
        />
      </FormGroup>
    </Box>
  );
};
