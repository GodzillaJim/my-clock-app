import { Grid2 } from "@mui/material";
import { TaskList } from "../tasks/TaskList";
import { TimerDisplay } from "./TimerDisplay";
import { useTimerContext } from "../context/TimerContext";

export const TimerComponent = () => {
  return (
    <Grid2
      container
      flexDirection={"row"}
      sx={{ width: "100%" }}
      id="timer-component-root"
    >
      <Grid2 size={6}>
        <TaskList />
      </Grid2>
      <Grid2 size={6}>
        <TimerDisplay />
      </Grid2>
    </Grid2>
  );
};
