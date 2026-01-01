import React from 'react';
import { Box } from '@mui/material';

interface CircularTimerRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  isRunning?: boolean;
  isBreak?: boolean;
  children?: React.ReactNode;
}

export const CircularTimerRing: React.FC<CircularTimerRingProps> = ({
  progress,
  size = 280,
  strokeWidth = 8,
  isRunning = false,
  isBreak = false,
  children,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Clean, non-neon colors
  const primaryColor = isBreak ? '#A78BFA' : '#60A5FA';

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          position: 'absolute',
          transform: 'rotate(-90deg)',
        }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={primaryColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{
            transition: 'stroke-dashoffset 0.3s ease-out',
          }}
        />
      </svg>

      {/* Subtle outer ring when running */}
      {isRunning && (
        <Box
          sx={{
            position: 'absolute',
            width: size + 16,
            height: size + 16,
            borderRadius: '50%',
            border: `1px solid ${primaryColor}`,
            opacity: 0.3,
            animation: 'pulse-ring 2s ease-in-out infinite',
          }}
        />
      )}

      {/* Content (timer display) */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
