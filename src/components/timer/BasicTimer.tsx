import { Box, Button, Card, CardContent, IconButton, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { Pause, PlayArrow, RestartAlt } from "@mui/icons-material";

export const BasicTimer = () => {
    const [isActive, setIsActive] = useState(false);
    const [timeInput, setTimeInput] = useState("");
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const handleStartTimer = () => {
        const minutes = parseInt(timeInput);
        if (!isNaN(minutes) && minutes > 0) {
          setTimeRemaining(minutes * 60);
          setIsActive(true);
          setIsPaused(false);
        }
      };
    
      const handlePauseResume = () => {
        setIsPaused(!isPaused);
      };
    
      const handleReset = () => {
        setIsActive(false);
        setIsPaused(false);
        setTimeRemaining(0);
        setTimeInput('');
      };
    
      const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignContent: "center",
        minHeight: "100vh",
        bgColor: "background.default",
      }}
    >
      <Card sx={{ maxWidth: 400, width: "100%", m: 2 }}>
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Focus Timer
          </Typography>
          {!isActive ? (
            <Box sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Enter Minutes"
                type="number"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                InputProps={{
                  inputProps: { min: 1 }
                }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={handleStartTimer}
                disabled={!timeInput || parseInt(timeInput) <= 0}
                sx={{ mt: 2 }}
              >
                Start Timer
              </Button>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              gap: 2,
              width: '100%'
            }}>
              <Typography variant="h1" sx={{ 
                fontFamily: 'monospace',
                fontSize: '4rem'
              }}>
                {formatTime(timeRemaining)}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <IconButton 
                  size="large"
                  onClick={handlePauseResume}
                  color="primary"
                >
                  {isPaused ? <PlayArrow /> : <Pause />}
                </IconButton>

                <IconButton 
                  size="large"
                  onClick={handleReset}
                  color="error"
                >
                  <RestartAlt />
                </IconButton>
              </Box>

              <Typography variant="subtitle1" color="text.secondary">
                {isPaused ? 'Timer Paused' : 'Timer Running'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
      Timer
    </Box>
  );
};
