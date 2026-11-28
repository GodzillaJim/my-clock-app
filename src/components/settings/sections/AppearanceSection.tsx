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
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import type { SettingsSectionProps } from './types';

/** Theme, visual style and layout. */
export const AppearanceSection: React.FC<SettingsSectionProps> = ({ settings, onChange }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Visual Style
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Choose between two distinct UI themes
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            onClick={() => onChange('uiTheme', 'deepFocus')}
            sx={{
              cursor: 'pointer',
              border: settings.uiTheme === 'deepFocus' ? '2px solid' : '1px solid',
              borderColor: settings.uiTheme === 'deepFocus' ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #60A5FA, #A78BFA)',
                  }}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Deep Focus
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Clean dark theme. OLED-optimized for reduced eye strain.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            onClick={() => onChange('uiTheme', 'aerogel')}
            sx={{
              cursor: 'pointer',
              border: settings.uiTheme === 'aerogel' ? '2px solid' : '1px solid',
              borderColor: settings.uiTheme === 'aerogel' ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: 1,
                    background: 'linear-gradient(135deg, #6366F1, #EC4899)',
                  }}
                />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Aerogel
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Light, airy theme with glassmorphism and soft pastel tones.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {settings.uiTheme === 'aerogel' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Color Mode
          </Typography>
          <FormControl sx={{ minWidth: 200 }}>
            <Select
              value={settings.theme}
              onChange={(e) => onChange('theme', e.target.value as 'light' | 'dark' | 'system')}
              size="small"
            >
              <MenuItem value="system">System Default</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
            Aerogel supports both light and dark modes
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Layout
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        Choose how the app interface is organized
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
