import React from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';
import { motion } from '@/theme/tokens';

/** Class for secondary controls that recede while a timer runs untouched. */
export const REVEAL = 'fs-reveal';

/**
 * Styles for a timer view's root: while `running`, elements with the REVEAL
 * class fade out until the pointer or keyboard focus is inside the view. They
 * keep their place in the layout and in the tab order.
 */
export function revealStyles(running: boolean): SxProps<Theme> {
  return {
    [`& .${REVEAL}`]: { transition: `opacity ${motion.base} ${motion.easeOut}` },
    ...(running && {
      [`& .${REVEAL}`]: { opacity: 0, transition: `opacity ${motion.slow} ${motion.easeOut}` },
      [`&:hover .${REVEAL}, &:focus-within .${REVEAL}`]: { opacity: 1 },
    }),
  };
}

/**
 * The row under the ring: the primary action stays centred, and the quieter
 * secondary actions sit to its right, so it never shifts as they fade.
 */
export const ControlRow: React.FC<{ primary: React.ReactNode; secondary?: React.ReactNode }> = ({
  primary,
  secondary,
}) => (
  <Box
    sx={{
      mt: 5,
      minHeight: 56,
      width: '100%',
      maxWidth: 420,
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      columnGap: 1.5,
      alignItems: 'center',
    }}
  >
    <Box sx={{ gridColumn: 2 }}>{primary}</Box>
    {secondary && (
      <Box className={REVEAL} sx={{ gridColumn: 3, display: 'flex', gap: 0.5 }}>
        {secondary}
      </Box>
    )}
  </Box>
);
