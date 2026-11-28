import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
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
  Alert,
  Tabs,
  Tab,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Stack
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Timer,
  Notifications,
  Palette,
  Storage,
  Add,
  Remove
} from '@mui/icons-material';
import {
  AppSettings,
  DEFAULT_SETTINGS
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { notificationService } from '@/services/notificationService';
import { SOUND_OPTIONS } from '@/services/sounds';

interface FocusSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onOpenFeedbackManager?: () => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`settings-tabpanel-${index}`}
    aria-labelledby={`settings-tab-${index}`}
    {...other}
  >
    {value === index && (
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    )}
  </div>
);

export const FocusSettings: React.FC<FocusSettingsProps> = ({
  open,
  onClose,
  settings,
  onSettingsChange,
  onOpenFeedbackManager
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      console.log('Settings dialog opened, resetting local settings to:', settings);
      setLocalSettings(settings);
      setIsDirty(false);
      setIsSaving(false);
      setSaveError(null);
      setNotificationPermission(notificationService.getPermissionStatus());
    }
  }, [open, settings]);

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    console.log('Setting change:', key, 'to:', value);
    setLocalSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      console.log('New local settings:', newSettings);
      return newSettings;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks
    
    setIsSaving(true);
    setSaveError(null);
    
    try {
      console.log('Saving settings with presets:', localSettings.quickPresets);
      const appState = await focusStorage.getAppState();
      appState.settings = localSettings;
      console.log('App state before save:', appState);
      await focusStorage.saveAppState(appState);
      onSettingsChange(localSettings);
      setIsDirty(false);
      console.log('Settings saved successfully');
      
      // Show success state briefly before closing
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    setIsDirty(true);
  };

  const handlePresetAdd = (value: number) => {
    console.log('Adding preset:', value, 'Current presets:', localSettings.quickPresets);
    const newPresets = [...localSettings.quickPresets, value].sort((a, b) => a - b);
    console.log('New presets array:', newPresets);
    handleSettingChange('quickPresets', newPresets);
  };

  const handlePresetRemove = (value: number) => {
    const newPresets = localSettings.quickPresets.filter(preset => preset !== value);
    handleSettingChange('quickPresets', newPresets);
  };

  const handlePresetEdit = (oldValue: number, newValue: number) => {
    const newPresets = localSettings.quickPresets
      .map(preset => preset === oldValue ? newValue : preset)
      .sort((a, b) => a - b);
    handleSettingChange('quickPresets', newPresets);
  };

  const handleCancel = () => {
    setLocalSettings(settings);
    setIsDirty(false);
    onClose();
  };

  const requestNotificationPermission = async () => {
    const granted = await notificationService.requestPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
  };

  const renderTimerSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Session Duration
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ pb: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Focus Session Duration
              </Typography>
              <Box sx={{ px: 1, pt: 2, pb: 3 }}>
                <Slider
                  value={localSettings.focusDuration}
                  onChange={(_, value) => handleSettingChange('focusDuration', value as number)}
                  min={1}
                  max={240}
                  step={1}
                  marks={[
                    { value: 25, label: '25' },
                    { value: 60, label: '60' },
                    { value: 120, label: '120' },
                    { value: 240, label: '240' }
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}m`}
                  sx={{
                    '& .MuiSlider-markLabel': {
                      fontSize: '0.75rem',
                      transform: 'translateX(-50%)',
                      whiteSpace: 'nowrap'
                    },
                    '& .MuiSlider-mark': {
                      height: 8,
                      width: 2
                    }
                  }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <TextField
                  size="small"
                  type="number"
                  value={localSettings.focusDuration}
                  onChange={(e) => handleSettingChange('focusDuration', parseInt(e.target.value) || 25)}
                  inputProps={{ min: 1, max: 240 }}
                  sx={{ width: 100 }}
                  label="Minutes"
                />
                <Typography variant="caption" color="text.secondary">
                  1-240 minutes
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Short Break
              </Typography>
              <Slider
                value={localSettings.shortBreakDuration}
                onChange={(_, value) => handleSettingChange('shortBreakDuration', value as number)}
                min={1}
                max={30}
                step={1}
                marks={[
                  { value: 5, label: '5m' },
                  { value: 15, label: '15m' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}m`}
              />
              <TextField
                size="small"
                type="number"
                value={localSettings.shortBreakDuration}
                onChange={(e) => handleSettingChange('shortBreakDuration', parseInt(e.target.value) || 5)}
                inputProps={{ min: 1, max: 30 }}
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          How the timer behaves if the app is closed/crashes while running
        </Typography>
        <Select
          value={localSettings.resumeStrategy || 'elapsed'}
          onChange={(e) => handleSettingChange('resumeStrategy', e.target.value as 'elapsed' | 'pause')}
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Customize the quick duration buttons shown in the timer
        </Typography>
        
        <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
          {localSettings.quickPresets.map((preset, index) => (
            <Chip
              key={`preset-${preset}-${index}`}
              label={`${preset}m`}
              onDelete={() => handlePresetRemove(preset)}
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
            inputProps={{ min: 1, max: 240 }}
            sx={{ width: 120 }}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                const value = parseInt((e.target as HTMLInputElement).value);
                if (value >= 1 && value <= 240 && !localSettings.quickPresets.includes(value)) {
                  handlePresetAdd(value);
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
              const input = (e.currentTarget.parentElement?.querySelector('input[type="number"]') as HTMLInputElement);
              const value = parseInt(input?.value || '');
              if (value >= 1 && value <= 240 && !localSettings.quickPresets.includes(value)) {
                handlePresetAdd(value);
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
              checked={localSettings.showSessionStartTime}
              onChange={(e) => handleSettingChange('showSessionStartTime', e.target.checked)}
            />
          }
          label="Show session start time"
        />
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.showSessionEndTime}
              onChange={(e) => handleSettingChange('showSessionEndTime', e.target.checked)}
            />
          }
          label="Show expected end time"
        />
      </FormGroup>

      <FormControl sx={{ mt: 2, minWidth: 200 }}>
        <FormLabel>Time Format</FormLabel>
        <Select
          value={localSettings.timeFormat}
          onChange={(e) => handleSettingChange('timeFormat', e.target.value as '12h' | '24h')}
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
              checked={localSettings.autoStartBreaks}
              onChange={(e) => handleSettingChange('autoStartBreaks', e.target.checked)}
            />
          }
          label="Auto-start breaks after focus sessions"
        />
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.autoStartNextSession}
              onChange={(e) => handleSettingChange('autoStartNextSession', e.target.checked)}
            />
          }
          label="Auto-start next session after breaks"
        />
      </FormGroup>
    </Box>
  );

  const renderNotificationSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Notification Permissions
      </Typography>
      
      {notificationPermission !== 'granted' && (
        <Alert 
          severity={notificationPermission === 'denied' ? 'error' : 'warning'} 
          sx={{ mb: 2 }}
          action={
            notificationPermission !== 'denied' && (
              <Button color="inherit" size="small" onClick={requestNotificationPermission}>
                Enable
              </Button>
            )
          }
        >
          {notificationPermission === 'denied'
            ? 'Notifications are blocked. Please enable them in your browser settings.'
            : 'Click "Enable" to allow desktop notifications.'
          }
        </Alert>
      )}

      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.enableSystemNotifications}
              onChange={(e) => handleSettingChange('enableSystemNotifications', e.target.checked)}
              disabled={notificationPermission !== 'granted'}
            />
          }
          label="System notifications"
        />
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.enableVisualNotifications}
              onChange={(e) => handleSettingChange('enableVisualNotifications', e.target.checked)}
            />
          }
          label="In-app visual notifications"
        />
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.enableAudioNotifications}
              onChange={(e) => handleSettingChange('enableAudioNotifications', e.target.checked)}
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
          value={localSettings.notificationVolume}
          onChange={(_, value) => handleSettingChange('notificationVolume', value as number)}
          min={0}
          max={100}
          step={5}
          marks={[
            { value: 0, label: '0%' },
            { value: 50, label: '50%' },
            { value: 100, label: '100%' }
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          disabled={!localSettings.enableAudioNotifications}
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
              checked={localSettings.enableTickSound}
              onChange={(e) => handleSettingChange('enableTickSound', e.target.checked)}
              disabled={!localSettings.enableAudioNotifications}
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
          value={localSettings.sessionCompleteSound}
          onChange={(e) => {
            handleSettingChange('sessionCompleteSound', e.target.value);
            void notificationService.previewSound(e.target.value);
          }}
          size="small"
          disabled={!localSettings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          {SOUND_OPTIONS.sessionComplete.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Break Complete Sound
        </Typography>
        <Select
          value={localSettings.breakCompleteSound}
          onChange={(e) => {
            handleSettingChange('breakCompleteSound', e.target.value);
            void notificationService.previewSound(e.target.value);
          }}
          size="small"
          disabled={!localSettings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          {SOUND_OPTIONS.breakComplete.map((o) => (
            <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
          ))}
        </Select>
      </Box>
    </Box>
  );

  const renderAppearanceSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Visual Style
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Choose between two distinct UI themes
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card
            onClick={() => handleSettingChange('uiTheme', 'deepFocus')}
            sx={{
              cursor: 'pointer',
              border: localSettings.uiTheme === 'deepFocus' ? '2px solid' : '1px solid',
              borderColor: localSettings.uiTheme === 'deepFocus' ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: 1, background: 'linear-gradient(135deg, #60A5FA, #A78BFA)' }} />
                <Typography variant="subtitle1" fontWeight={600}>Deep Focus</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Clean dark theme. OLED-optimized for reduced eye strain.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card
            onClick={() => handleSettingChange('uiTheme', 'aerogel')}
            sx={{
              cursor: 'pointer',
              border: localSettings.uiTheme === 'aerogel' ? '2px solid' : '1px solid',
              borderColor: localSettings.uiTheme === 'aerogel' ? 'primary.main' : 'divider',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main' }
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: 1, background: 'linear-gradient(135deg, #6366F1, #EC4899)' }} />
                <Typography variant="subtitle1" fontWeight={600}>Aerogel</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Light, airy theme with glassmorphism and soft pastel tones.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {localSettings.uiTheme === 'aerogel' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Color Mode
          </Typography>
          <FormControl sx={{ minWidth: 200 }}>
            <Select
              value={localSettings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value as 'light' | 'dark' | 'system')}
              size="small"
            >
              <MenuItem value="system">System Default</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Aerogel supports both light and dark modes
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Layout
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Choose how the app interface is organized
      </Typography>
      <FormControl sx={{ minWidth: 300 }}>
        <Select
          value={localSettings.layout || 'zen'}
          onChange={(e) => handleSettingChange('layout', e.target.value as 'zen' | 'dashboard' | 'commandCenter')}
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
              checked={localSettings.minimizeToSystemTray}
              onChange={(e) => handleSettingChange('minimizeToSystemTray', e.target.checked)}
            />
          }
          label="Minimize to system tray"
        />
      </FormGroup>
    </Box>
  );

  const renderDataSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Daily History
      </Typography>
      
      <FormGroup>
        <FormControlLabel
          control={
            <Switch
              checked={localSettings.autoResetDaily}
              onChange={(e) => handleSettingChange('autoResetDaily', e.target.checked)}
            />
          }
          label="Automatically reset history at midnight"
        />
      </FormGroup>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Export Format
        </Typography>
        <Select
          value={localSettings.exportFormat}
          onChange={(e) => handleSettingChange('exportFormat', e.target.value as 'csv' | 'json')}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="csv">CSV</MenuItem>
          <MenuItem value="json">JSON</MenuItem>
        </Select>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        All session data is stored locally on your device. No data is sent to external servers.
      </Alert>
    </Box>
  );

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      PaperProps={{ sx: { height: '80vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Focus Sessions Settings
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, newValue) => setActiveTab(newValue)}
            aria-label="settings tabs"
          >
            <Tab icon={<Timer />} label="Timer" />
            <Tab icon={<Notifications />} label="Notifications" />
            <Tab icon={<Palette />} label="Appearance" />
            <Tab icon={<Storage />} label="Data" />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {renderTimerSettings()}
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          {renderNotificationSettings()}
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          {renderAppearanceSettings()}
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          {renderDataSettings()}
        </TabPanel>
      </DialogContent>
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleReset} color="warning">
          Reset to Defaults
        </Button>
        {onOpenFeedbackManager && (
          <Button onClick={onOpenFeedbackManager} variant="outlined">
            Manage Feedback
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {saveError && (
          <Alert severity="error" sx={{ mr: 2 }}>
            Failed to save: {saveError}
          </Alert>
        )}
        <Button onClick={handleCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!isDirty || isSaving}
        >
          {isSaving ? 'Saving...' : (!isDirty && !isSaving) ? 'Saved ✓' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};