import React, { useEffect } from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import { Work, Coffee } from "@mui/icons-material";
import dayjs from "dayjs";
import { capitalize } from "lodash";

interface SimpleSession {
  type: "focus" | "break";
  duration: number;
  startTime: Date;
  endTime: Date;
}

interface SessionPlanProps {
  sessions: SimpleSession[];
  currentSessionIndex: number;
}

export const SessionPlan: React.FC<SessionPlanProps> = ({
  sessions,
  currentSessionIndex,
}) => {
  useEffect(() => {
    console.log("Sessions updated:", sessions);
  });
  if (sessions.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ mb: 1, color: "text.secondary" }}>
        Session {currentSessionIndex + 1} of {sessions.length}
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          justifyContent: "center",
          flexWrap: "wrap",
          mb: 2,
        }}
      >
        {sessions.map((session, index) => {
          const isCompleted = index < currentSessionIndex;
          const isActive = index === currentSessionIndex;
          const isFuture = index > currentSessionIndex;

          const tooltipTitle = `${capitalize(session.type)} - ${Math.floor(
            session.duration / 60
          )}min. ${
            session.startTime
              ? dayjs(session.startTime).format("h:mm A")
              : "N/A"
          } - ${
            session.endTime ? dayjs(session.endTime).format("h:mm A") : "N/A"
          }`;

          return (
            <Tooltip key={index} title={tooltipTitle}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isCompleted
                    ? "success.light"
                    : isActive
                    ? "primary.main"
                    : "grey.200",
                  border: "none",
                  borderColor: "primary.dark",
                  transition: "all 0.2s ease-in-out",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                }}
              >
                {session.type === "focus" ? (
                  <Work
                    sx={{
                      fontSize: 16,
                      color: isFuture ? "grey.600" : "white",
                    }}
                  />
                ) : (
                  <Coffee
                    sx={{
                      fontSize: 16,
                      color: isFuture ? "grey.600" : "white",
                    }}
                  />
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {sessions.length > currentSessionIndex + 1 && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Next:{" "}
          {sessions[currentSessionIndex + 1].type === "focus"
            ? "Focus Session"
            : "Break"}
        </Typography>
      )}
    </Box>
  );
};
