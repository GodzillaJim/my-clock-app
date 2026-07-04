import React, { useState } from 'react';
import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { StatsPanel } from './StatsPanel';
import { ZenFocusTimer } from '../timer/ZenFocusTimer';
import { ZenCountdownTimer } from '../timer/ZenCountdownTimer';
import { ZenStopwatch } from '../timer/ZenStopwatch';
import { ChallengesView } from '../challenges';
import { AppSettings, SessionPlan } from '@/features/timer/types';

interface DashboardLayoutProps {
  settings: AppSettings;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenFeedback: () => void;
  initialTool?: number;
  onToolChange?: (tool: number) => void;
  resumePlan?: SessionPlan | null;
  onResumeConsumed?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  settings,
  onOpenSettings,
  onOpenHistory,
  onOpenFeedback,
  initialTool = 0,
  onToolChange,
  resumePlan,
  onResumeConsumed,
}) => {
  const [currentTool, setCurrentTool] = useState(initialTool);

  const handleToolChange = (tool: number) => {
    setCurrentTool(tool);
    onToolChange?.(tool);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      {/* Left Sidebar */}
      <Sidebar
        currentTool={currentTool}
        onToolChange={handleToolChange}
        onOpenSettings={onOpenSettings}
        onOpenHistory={onOpenHistory}
        onOpenFeedback={onOpenFeedback}
      />

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {/* Timer Content - No full height, centered vertically */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
          }}
        >
          {currentTool === 0 && (
            <Box sx={{ width: '100%', maxWidth: 500 }}>
              <ZenFocusTimer
                onOpenSettings={onOpenSettings}
                onOpenHistory={onOpenHistory}
                settings={settings}
                hideTopControls
                resumePlan={resumePlan}
                onResumeConsumed={onResumeConsumed}
              />
            </Box>
          )}
          {currentTool === 1 && (
            <Box sx={{ width: '100%', maxWidth: 500 }}>
              <ZenCountdownTimer />
            </Box>
          )}
          {currentTool === 2 && (
            <Box sx={{ width: '100%', maxWidth: 500 }}>
              <ZenStopwatch />
            </Box>
          )}
          {currentTool === 3 && (
            <Box sx={{ width: '100%', maxWidth: 600 }}>
              <ChallengesView />
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Stats Panel */}
      <StatsPanel />
    </Box>
  );
};
