import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Badge,
} from '@mui/material';
import {
  Timer as TimerIcon,
  AccessAlarm,
  DateRange,
} from '@mui/icons-material';
import { ZenFocusTimer } from './ZenFocusTimer';
import { ZenCountdownTimer } from './ZenCountdownTimer';
import { ZenStopwatch } from './ZenStopwatch';
import { AppSettings } from '@/features/timer/types';

interface ToolSwitcherProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  settings: AppSettings;
  initialTool?: number;
  onToolChange?: (tool: number) => void;
}

export interface ToolRef {
  isRunning: () => boolean;
}

export const ToolSwitcher: React.FC<ToolSwitcherProps> = ({
  onOpenSettings,
  onOpenHistory,
  onOpenFeedback,
  settings,
  initialTool = 0,
  onToolChange,
}) => {
  const [currentTool, setCurrentTool] = useState(initialTool);
  const [runningTools, setRunningTools] = useState<boolean[]>([false, false, false]);

  React.useEffect(() => {
    setCurrentTool(initialTool);
  }, [initialTool]);

  const handleToolChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTool(newValue);
    onToolChange?.(newValue);
  };

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Minimal Floating Tab Switcher */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          backgroundColor: 'rgba(15, 15, 25, 0.8)',
          backdropFilter: 'blur(12px)',
          borderRadius: 3,
          border: '1px solid rgba(0, 240, 255, 0.1)',
          px: 1,
        }}
      >
        <Tabs
          value={currentTool}
          onChange={handleToolChange}
          sx={{
            minHeight: 48,
            '& .MuiTab-root': {
              minWidth: 80,
              minHeight: 48,
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.75rem',
            },
            '& .MuiTabs-indicator': {
              height: 2,
            },
          }}
        >
          <Tab
            icon={
              runningTools[0] ? (
                <Badge color="success" variant="dot">
                  <DateRange fontSize="small" />
                </Badge>
              ) : (
                <DateRange fontSize="small" />
              )
            }
            iconPosition="start"
            label="Focus"
          />
          <Tab
            icon={
              runningTools[1] ? (
                <Badge color="success" variant="dot">
                  <TimerIcon fontSize="small" />
                </Badge>
              ) : (
                <TimerIcon fontSize="small" />
              )
            }
            iconPosition="start"
            label="Timer"
          />
          <Tab
            icon={
              runningTools[2] ? (
                <Badge color="success" variant="dot">
                  <AccessAlarm fontSize="small" />
                </Badge>
              ) : (
                <AccessAlarm fontSize="small" />
              )
            }
            iconPosition="start"
            label="Stopwatch"
          />
        </Tabs>
      </Box>

      {/* Tool Content */}
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: currentTool === 0 ? 'block' : 'none' }}>
          <ZenFocusTimer
            onOpenSettings={onOpenSettings}
            onOpenHistory={onOpenHistory}
            settings={settings}
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [isRunning, prev[1], prev[2]]);
            }}
          />
        </Box>
        <Box sx={{ display: currentTool === 1 ? 'block' : 'none' }}>
          <ZenCountdownTimer
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [prev[0], isRunning, prev[2]]);
            }}
          />
        </Box>
        <Box sx={{ display: currentTool === 2 ? 'block' : 'none' }}>
          <ZenStopwatch
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [prev[0], prev[1], isRunning]);
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
