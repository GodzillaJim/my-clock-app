import { useEffect, useMemo } from "react";
import {
  Box,
  ButtonGroup,
  Card,
  CardContent,
  Collapse,
  Grid2,
  IconButton,
  ListItem,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import {
  ColorFormat,
  CountdownCircleTimer,
} from "react-countdown-circle-timer";
import { formatTime } from "@/utils/date";
import {
  Check,
  Pause,
  PlayArrow,
  Replay,
  Replay10,
  SkipNext,
} from "@mui/icons-material";
import { SessionComponent } from "../tasks/SessionComponent";
import { useTimerContext } from "@/features/timer/context/TimerContext";
import { TimerState } from "@/features/timer/types";

export const TimerDisplay = () => {
  const {
    getCurrentSession,
    timer,
    currentTaskIndex,
    tasks,
    sessions,
    currentSessionIndex,

  } = useTimerContext();
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;
  const warning = theme.palette.warning.main;
  const error = theme.palette.error.main;
  const pink = theme.palette.error.light;

  const currentSession = getCurrentSession();
  const remainingSeconds = 60 * currentSession?.remainingMinutes || 1;
  const isRunning = timer.timerState === TimerState.RUNNING;

  const countdown = useMemo(() => {
    return (
      <CountdownCircleTimer
        isPlaying={isRunning}
        duration={remainingSeconds}
        colors={[primary, secondary, warning, pink, error] as any}
        colorsTime={[7, 5, 2, 0]}
      >
        {({ remainingTime }) => (
          <Box>
            {remainingTime > 0 ? (
              <ListItem slots={{ root: "div" }} disableGutters disablePadding>
                <ListItemText
                  primary={formatTime(remainingTime)}
                  secondary="Time remaining"
                />
              </ListItem>
            ) : (
              ""
            )}
            <Collapse in={remainingTime === 0}>
              <Check color="primary" />
            </Collapse>
          </Box>
        )}
      </CountdownCircleTimer>
    );
  }, [currentSession?.remainingMinutes, isRunning]);

  const activeTask = tasks[currentTaskIndex];

  return (
    <div>
      <Grid2 container mt={1} mx={3} p={1} sx={{ width: "100%" }}>
        <Grid2 size={12}>
          <Card>
            <CardContent>
              <Grid2
                container
                direction={"column"}
                gap={2}
                textAlign={"center"}
                justifyContent={"center"}
                alignContent={"center"}
              >
                <Grid2>
                  <Box display={"flex"} flexDirection={"column"}>
                    <div>
                      <Typography variant="h4" component={"h4"}>
                        {activeTask?.title || "No task selected"}
                      </Typography>
                    </div>
                    <div>
                      <Typography variant="h6" component={"h6"}>
                        Focus period - {currentSessionIndex + 1} of{" "}
                        {sessions.length}
                      </Typography>
                    </div>
                  </Box>
                </Grid2>
                <Grid2 size={12}>
                  <Box
                    display={"flex"}
                    width={"100%"}
                    justifyContent={"center"}
                  >
                    {countdown}
                  </Box>
                </Grid2>
                <Grid2>
                  <Collapse in={!!currentSession?.id}>
                    <Box
                      width={"100%"}
                      justifyContent={"center"}
                      display={"flex"}
                      flexWrap={"wrap"}
                      gap={1}
                    >
                      {sessions.map((session) => (
                        <Box key={session.id}>
                          <SessionComponent
                            session={session}
                            currentSessionId={currentSession.id}
                          />
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </Grid2>
                <Grid2>
                  <Box display={"flex"} gap={2} justifyContent={"center"}>
                    <ButtonGroup>
                      <Tooltip
                        title={
                          isRunning
                            ? "Pause the current session"
                            : "Start the current session"
                        }
                      >
                        <IconButton
                          onClick={() => {
                            if (timer.timerState === TimerState.IDLE) {
                              timer.startTimer();
                              
                            } else if (isRunning) {
                              timer.pauseTimer();
                            } else if (timer.timerState === TimerState.PAUSED) {
                              timer.resumeTimer();
                            }
                          }}
                        >
                          {!isRunning && <PlayArrow />}
                          {isRunning && <Pause />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restart the current session">
                        <IconButton onClick={timer.resetTimer}>
                          <Replay10 />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Restart task">
                        <IconButton onClick={timer.resetTimer}>
                          <Replay />
                        </IconButton>
                      </Tooltip>
                      <Tooltip
                        title="Skip current session"
                        onClick={timer.skipSession}
                      >
                        <IconButton>
                          <SkipNext />
                        </IconButton>
                      </Tooltip>
                    </ButtonGroup>
                  </Box>
                </Grid2>
              </Grid2>
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
    </div>
  );
};
