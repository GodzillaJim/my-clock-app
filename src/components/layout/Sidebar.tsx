import React from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Timer as TimerIcon,
  AccessAlarm,
  DateRange,
  Settings,
  History,
  Feedback,
  EmojiEvents,
} from '@mui/icons-material';

interface SidebarProps {
  currentTool: number;
  onToolChange: (tool: number) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTool,
  onToolChange,
  onOpenSettings,
  onOpenHistory,
  onOpenFeedback,
}) => {
  const tools = [
    { icon: <DateRange />, label: 'Focus', index: 0 },
    { icon: <TimerIcon />, label: 'Timer', index: 1 },
    { icon: <AccessAlarm />, label: 'Stopwatch', index: 2 },
    { icon: <EmojiEvents />, label: 'Challenges', index: 3 },
  ];

  const actions = [
    { icon: <History />, label: 'History', onClick: onOpenHistory },
    { icon: <Settings />, label: 'Settings', onClick: onOpenSettings },
    { icon: <Feedback />, label: 'Feedback', onClick: onOpenFeedback },
  ];

  return (
    <Box
      sx={{
        width: 64,
        minHeight: '100vh',
        backgroundColor: 'rgba(18, 18, 22, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 2,
        gap: 1,
      }}
    >
      {/* Tool Navigation */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {tools.map((tool) => (
          <Tooltip key={tool.index} title={tool.label} placement="right">
            <IconButton
              onClick={() => onToolChange(tool.index)}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                color: currentTool === tool.index ? 'primary.main' : 'text.secondary',
                backgroundColor: currentTool === tool.index ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: currentTool === tool.index ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              {tool.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ width: 32, my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {actions.map((action, index) => (
          <Tooltip key={index} title={action.label} placement="right">
            <IconButton
              onClick={action.onClick}
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                color: 'text.secondary',
                transition: 'all 0.2s ease',
                '&:hover': {
                  color: 'primary.main',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                },
              }}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};
