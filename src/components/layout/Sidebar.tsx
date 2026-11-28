import React from 'react';
import { Box, IconButton, Tooltip, Divider } from '@mui/material';
import {
  Timer as TimerIcon,
  AccessAlarm,
  DateRange,
  Settings,
  History,
  BugReportOutlined,
  EmojiEvents,
} from '@mui/icons-material';

interface SidebarProps {
  currentTool: number;
  onToolChange: (tool: number) => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onReportProblem: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTool,
  onToolChange,
  onOpenSettings,
  onOpenHistory,
  onReportProblem,
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
    { icon: <BugReportOutlined />, label: 'Report a problem', onClick: onReportProblem },
  ];

  return (
    <Box
      sx={{
        width: 64,
        minHeight: '100vh',
        backgroundColor: (t) => t.tokens.surface.panel,
        backdropFilter: 'blur(12px)',
        borderRight: (t) => `1px solid ${t.tokens.line.default}`,
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
                backgroundColor: (t) =>
                  currentTool === tool.index ? t.tokens.overlay.hover : 'transparent',
                border: (t) =>
                  currentTool === tool.index
                    ? `1px solid ${t.tokens.line.strong}`
                    : '1px solid transparent',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: (t) => t.tokens.overlay.hover,
                  borderColor: (t) => t.tokens.line.hover,
                },
              }}
            >
              {tool.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ width: 32, my: 2, borderColor: (t) => t.tokens.line.default }} />

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
                  backgroundColor: (t) => t.tokens.overlay.hover,
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
