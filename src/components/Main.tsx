import { Grid2 } from "@mui/material";
import { TimerComponent } from "./timer/TimerComponent";
import { TimerContextProvider } from "./context/TimerContext";
import { TimerProvider } from "@/features/timer/context/TimerContext";

export const Main = () => {
  return (
    <TimerProvider>
      <TimerContextProvider>
        <Grid2
          container
          flexDirection={"column"}
          sx={{ width: "100%" }}
          id="timer-root"
        >
          <Grid2 sx={{ width: "100%" }}>
            <TimerComponent />
          </Grid2>
        </Grid2>
      </TimerContextProvider>
    </TimerProvider>
  );
};
