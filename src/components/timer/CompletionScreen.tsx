import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface CompletionScreenProps {
  onClose: () => void;
}

export const CompletionScreen: React.FC<CompletionScreenProps> = ({ onClose }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        textAlign: 'center',
        p: 3,
      }}
    >
      <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
      <Typography variant="h4" gutterBottom>
        All Sessions Complete!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Great job! You've successfully completed your focus session.
      </Typography>
      <Button variant="contained" onClick={onClose}>
        Start New Session
      </Button>
    </Box>
  );
};
