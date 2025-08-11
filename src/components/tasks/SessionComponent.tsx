import { Coffee, LunchDining, Work } from "@mui/icons-material";
import { IconButton, Tooltip } from "@mui/material";
import { SessionItem } from "@/features/timer/types";

type SessionComponentProps = {
  session: SessionItem;
  currentSessionId: string;
};
export const SessionComponent = ({
  session,
  currentSessionId,
}: SessionComponentProps) => {
  const getSessionColor = (session: SessionItem) => {
    const sessionIsRunning = session.id === currentSessionId;
    if (sessionIsRunning) {
      return "secondary.main";
    }

    if (session.remainingMinutes === 0) {
      return "success.main";
    }

    return "GrayText";
  };

  const getTooltipText = () => {
    if (session.remainingMinutes === 0) {
      return "Session completed";
    }

    if (session.id === currentSessionId) {
      return "Session is running";
    }

    return "Session in progress";
  };

  return (
    <Tooltip title={getTooltipText()}>
      <IconButton size="small">
        {session.type === "shortBreak" && (
          <Coffee sx={{ color: getSessionColor(session) }} />
        )}
        {session.type === "longBreak" && (
          <LunchDining sx={{ color: getSessionColor(session) }} />
        )}
        {session.type === "focus" && (
          <Work sx={{ color: getSessionColor(session) }} />
        )}
      </IconButton>
    </Tooltip>
  );
};
