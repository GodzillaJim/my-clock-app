import React from 'react';
import { Box, useTheme } from '@mui/material';
import { motion } from '@/theme/tokens';

interface CircularTimerRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  isBreak?: boolean;
  children?: React.ReactNode;
}

/**
 * The session ring: a thin track with the elapsed share drawn over it in the
 * focus or break colour. No glow and no pulse; the progress itself is the motion.
 */
export const CircularTimerRing: React.FC<CircularTimerRingProps> = ({
  progress,
  size = 280,
  strokeWidth = 6,
  isBreak = false,
  children,
}) => {
  const { palette, tokens } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const color = isBreak ? palette.secondary.main : palette.primary.main;

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
        aria-hidden="true"
        style={{ position: 'absolute', transform: 'rotate(-90deg)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tokens.overlay.track}
          strokeWidth={Math.max(1, strokeWidth / 2)}
        />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              transition: `stroke-dashoffset ${motion.slow} linear, stroke ${motion.base} ${motion.easeOut}`,
            }}
          />
        )}
      </svg>

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
