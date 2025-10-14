import React, { useState, useRef, useImperativeHandle } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Settings,
  History,
  Feedback,
  Timer as TimerIcon,
  AccessAlarm,
  DateRange,
} from '@mui/icons-material';
import { FocusTimer } from './FocusTimer';
import { CountdownTimer } from './CountdownTimer';
import { Stopwatch } from './Stopwatch';
import { AppSettings } from '@/features/timer/types';

interface ToolSwitcherProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  settings: AppSettings;
  initialTool?: number;
  onToolChange?: (tool: number) => void;
}

// Create refs to track running state of each tool
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
  const focusTimerRef = useRef<ToolRef>(null);
  const countdownTimerRef = useRef<ToolRef>(null);
  const stopwatchRef = useRef<ToolRef>(null);

  // Update currentTool when initialTool changes (from keyboard shortcuts)
  React.useEffect(() => {
    setCurrentTool(initialTool);
  }, [initialTool]);

  const handleToolChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTool(newValue);
    onToolChange?.(newValue);
  };

  const renderActionButtons = () => (
    <Stack direction="row" spacing={1} justifyContent="center">
      <Tooltip title="Settings (Ctrl+S)">
        <IconButton onClick={onOpenSettings} size="small">
          <Settings fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Session History (Ctrl+H)">
        <IconButton onClick={onOpenHistory} size="small">
          <History fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Submit Feedback (Ctrl+F)">
        <IconButton onClick={onOpenFeedback} size="small">
          <Feedback fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 2, sm: 4 },
        borderRadius: 4,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Tool Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%' }}>
        <Tabs
          value={currentTool}
          onChange={handleToolChange}
          centered
          sx={{
            '& .MuiTab-root': {
              minWidth: 100,
              textTransform: 'none',
              fontWeight: 500,
            },
          }}
        >
          <Tab
            icon={
              runningTools[0] ? (
                <Badge color="success" variant="dot">
                  <DateRange />
                </Badge>
              ) : (
                <DateRange />
              )
            }
            iconPosition="start"
            label="Focus"
            sx={{ fontSize: '0.875rem' }}
          />
          <Tab
            icon={
              runningTools[1] ? (
                <Badge color="success" variant="dot">
                  <TimerIcon />
                </Badge>
              ) : (
                <TimerIcon />
              )
            }
            iconPosition="start"
            label="Timer"
            sx={{ fontSize: '0.875rem' }}
          />
          <Tab
            icon={
              runningTools[2] ? (
                <Badge color="success" variant="dot">
                  <AccessAlarm />
                </Badge>
              ) : (
                <AccessAlarm />
              )
            }
            iconPosition="start"
            label="Stopwatch"
            sx={{ fontSize: '0.875rem' }}
          />
        </Tabs>
      </Box>

      {/* Tool Content - Keep all mounted but hide inactive ones */}
      <Box sx={{ width: '100%', minHeight: 400, position: 'relative' }}>
        <Box sx={{ display: currentTool === 0 ? 'block' : 'none' }}>
          <FocusTimer
            onOpenSettings={onOpenSettings}
            onOpenHistory={onOpenHistory}
            onOpenFeedback={onOpenFeedback}
            settings={settings}
            hideActionButtons={true}
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [isRunning, prev[1], prev[2]]);
            }}
          />
        </Box>
        <Box sx={{ display: currentTool === 1 ? 'block' : 'none' }}>
          <CountdownTimer
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [prev[0], isRunning, prev[2]]);
            }}
          />
        </Box>
        <Box sx={{ display: currentTool === 2 ? 'block' : 'none' }}>
          <Stopwatch
            onRunningStateChange={(isRunning) => {
              setRunningTools((prev) => [prev[0], prev[1], isRunning]);
            }}
          />
        </Box>
      </Box>

      {/* Shared Action Buttons */}
      {renderActionButtons()}
    </Paper>
  );
};
