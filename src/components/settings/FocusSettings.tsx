import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Timer,
  Notifications,
  Palette,
  Storage,
} from '@mui/icons-material';
import { AppSettings, DEFAULT_SETTINGS } from '@/features/timer/types';
import { services } from '@/services/domain';
import { notificationService } from '@/services/notificationService';
import { reportProblem } from '@/services/reportProblem';
import { createLogger } from '@/services/logger';
import { TimerSection } from './sections/TimerSection';
import { NotificationSection } from './sections/NotificationSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { DataSection } from './sections/DataSection';

const log = createLogger('FocusSettings');

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
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const FocusSettings: React.FC<FocusSettingsProps> = ({
  open,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState(0);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalSettings(settings);
      setIsDirty(false);
      setIsSaving(false);
      setSaveError(null);
      setNotificationPermission(notificationService.getPermissionStatus());
    }
  }, [open, settings]);

  const handleSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (isSaving) return; // Prevent double-clicks

    setIsSaving(true);
    setSaveError(null);

    try {
      const appState = await services.settings.load();
      appState.settings = localSettings;
      await services.settings.save(appState);
      onSettingsChange(localSettings);
      setIsDirty(false);

      // Show success state briefly before closing
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      log.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsSaving(false);
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

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { height: '80vh' } } }}
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
          <TimerSection settings={localSettings} onChange={handleSettingChange} />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <NotificationSection
            settings={localSettings}
            onChange={handleSettingChange}
            permission={notificationPermission}
            onRequestPermission={requestNotificationPermission}
          />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <AppearanceSection settings={localSettings} onChange={handleSettingChange} />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <DataSection settings={localSettings} onChange={handleSettingChange} />
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleReset} color="warning">
          Reset to Defaults
        </Button>
        <Button onClick={reportProblem} variant="outlined">
          Report a problem
        </Button>
        <Box sx={{ flex: 1 }} />
        {saveError && (
          <Alert severity="error" sx={{ mr: 2 }}>
            Failed to save: {saveError}
          </Alert>
        )}
        <Button onClick={handleCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={!isDirty || isSaving}>
          {isSaving ? 'Saving...' : !isDirty && !isSaving ? 'Saved ✓' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
