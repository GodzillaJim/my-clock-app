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
  CardContent
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Timer,
  Notifications,
  Palette,
  Storage
} from '@mui/icons-material';
import {
  AppSettings,
  DEFAULT_SETTINGS
} from '@/features/timer/types';
import { focusStorage } from '@/services/focusStorage';
import { notificationService } from '@/services/notificationService';

interface FocusSettingsProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
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
  onSettingsChange
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
    setIsDirty(false);
  }, [settings]);

  useEffect(() => {
    if (open) {
      setNotificationPermission(notificationService.getPermissionStatus());
    }
  }, [open]);

  const handleSettingChange = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    try {
      const appState = await focusStorage.getAppState();
      appState.settings = localSettings;
      await focusStorage.saveAppState(appState);
      onSettingsChange(localSettings);
      setIsDirty(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
    setIsDirty(true);
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
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Focus Session
              </Typography>
              <Slider
                value={localSettings.focusDuration}
                onChange={(_, value) => handleSettingChange('focusDuration', value as number)}
                min={1}
                max={120}
                step={1}
                marks={[
                  { value: 25, label: '25m' },
                  { value: 45, label: '45m' },
                  { value: 90, label: '90m' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}m`}
              />
              <TextField
                size="small"
                type="number"
                value={localSettings.focusDuration}
                onChange={(e) => handleSettingChange('focusDuration', parseInt(e.target.value) || 25)}
                inputProps={{ min: 1, max: 120 }}
                sx={{ mt: 1 }}
                fullWidth
                helperText="1-120 minutes"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
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

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Long Break
              </Typography>
              <Slider
                value={localSettings.longBreakDuration}
                onChange={(_, value) => handleSettingChange('longBreakDuration', value as number)}
                min={5}
                max={60}
                step={1}
                marks={[
                  { value: 15, label: '15m' },
                  { value: 30, label: '30m' }
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${value}m`}
              />
              <TextField
                size="small"
                type="number"
                value={localSettings.longBreakDuration}
                onChange={(e) => handleSettingChange('longBreakDuration', parseInt(e.target.value) || 15)}
                inputProps={{ min: 5, max: 60 }}
                sx={{ mt: 1 }}
                fullWidth
                helperText="5-60 minutes"
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Sessions before Long Break
        </Typography>
        <Slider
          value={localSettings.sessionsBeforeLongBreak}
          onChange={(_, value) => handleSettingChange('sessionsBeforeLongBreak', value as number)}
          min={2}
          max={8}
          step={1}
          marks={[
            { value: 2, label: '2' },
            { value: 4, label: '4' },
            { value: 6, label: '6' },
            { value: 8, label: '8' }
          ]}
          valueLabelDisplay="auto"
          sx={{ maxWidth: 400 }}
        />
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
          onChange={(e) => handleSettingChange('sessionCompleteSound', e.target.value)}
          size="small"
          disabled={!localSettings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="default">Default</MenuItem>
          <MenuItem value="complete">Achievement</MenuItem>
          <MenuItem value="chime">Chime</MenuItem>
        </Select>
      </Box>

      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Break Complete Sound
        </Typography>
        <Select
          value={localSettings.breakCompleteSound}
          onChange={(e) => handleSettingChange('breakCompleteSound', e.target.value)}
          size="small"
          disabled={!localSettings.enableAudioNotifications}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="default">Default</MenuItem>
          <MenuItem value="break">Gentle Bell</MenuItem>
          <MenuItem value="soft">Soft Chime</MenuItem>
        </Select>
      </Box>
    </Box>
  );

  const renderAppearanceSettings = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Theme
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
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!isDirty}
        >
          Save Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};