import {
  Accordion,
  AccordionSummary,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccessTime,
  Check,
  DeleteOutline,
  ExpandMore,
  Pause,
  PlayArrow,
  Replay,
  Replay10,
  SkipNext,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { v4 } from "uuid";
import { SessionComponent } from "./SessionComponent";
import { formatTime } from "@/utils/date";
import { TaskType, TimerState } from "@/features/timer/types";
import { useTimerContext } from "@/features/timer/context/TimerContext";
import { useFormik } from "formik";
import { number, object, string } from "yup";

type TaskListItemProps = {
  taskIndex: number;
  task: TaskType;
  setTask: (task: TaskType) => void;
  deleteTask: (id: string) => void;
};

export const TaskListItem = ({
  task,
  setTask,
  deleteTask,
}: TaskListItemProps) => {
  const [taskEdit, setTaskEdit] = useState(false);

  // Store a copy of the sessions in state so we can mutate 'remainingMinutes'
  // Track which session we're on
  const { sessions, currentSessionIndex, timer } = useTimerContext();

  const isRunning = timer.timerState === TimerState.RUNNING;

  const currentSession = sessions[currentSessionIndex] || {
    id: "",
    type: "focus",
    minutes: 0,
    sessionNumber: 0,
    remainingMinutes: 0,
  };

  const formik = useFormik<Partial<TaskType>>({
    initialValues: {
      title: task.title,
      durationInMinutes: task.durationInMinutes,
    },
    validationSchema: object().shape({
      title: string().required("Title is required"),
      durationInMinutes: number().required("Duration is required"),
    }),
    onSubmit: (values) => {
      setTask({
        ...task,
        title: values.title || "",
        durationInMinutes: values.durationInMinutes || 0,
      });
      setTaskEdit(false);
    },
  });

  return (
    <ListItem
      sx={{ my: 1 }}
      slots={{
        root: "div",
      }}
    >
      <Accordion elevation={0} disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
            }}
          >
            <ListItem
              slotProps={{
                root: "div",
              }}
              disableGutters
              disablePadding
              secondaryAction={
                <Typography
                  mr={0.5}
                >{`${task.durationInMinutes} min`}</Typography>
              }
            >
              <ListItemIcon>
                <Check />
              </ListItemIcon>
              <ListItemText primary={task.title} />
            </ListItem>
          </Box>
        </AccordionSummary>
        <Box
          display={"flex"}
          flexDirection={"column"}
          mx={3}
          p={2}
          sx={{ bgcolor: "background.default", borderRadius: "10px" }}
        >
          <Box display={"flex"} justifyContent={"space-between"} my={2}>
            <FormControlLabel
              label={"Edit task"}
              control={
                <Checkbox
                  checked={taskEdit}
                  onChange={() => setTaskEdit(!taskEdit)}
                  inputProps={{ "aria-label": "controlled" }}
                />
              }
            />
            <div>
              <ButtonGroup>
                {!isRunning && (
                  <IconButton size="small" onClick={timer.startTimer}>
                    <PlayArrow />
                  </IconButton>
                )}
                {isRunning && (
                  <IconButton size="small" onClick={timer.pauseTimer}>
                    <Pause />
                  </IconButton>
                )}
                <IconButton size="small" onClick={timer.resetTimer}>
                  <Replay />
                </IconButton>
                <IconButton
                  color="error"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTask(task.id);
                  }}
                >
                  <DeleteOutline />
                </IconButton>
              </ButtonGroup>
            </div>
          </Box>
          <Box>
            <Collapse in={taskEdit}>
              <Box display={"flex"} gap={3}>
                <TextField
                  name="title"
                  value={formik.values.title}
                  onChange={formik.handleChange}
                  size="small"
                  error={formik.touched.title && Boolean(formik.errors.title)}
                  helperText={formik.touched.title && formik.errors.title}
                />
                <TextField
                  type="number"
                  sx={{ height: 20, width: 60 }}
                  size="small"
                  name="durationInMinutes"
                  value={formik.values.durationInMinutes}
                  onChange={formik.handleChange}
                  slotProps={{
                    htmlInput: {
                      sx: { py: 1, px: 0.5, pl: 1.5 },
                    },
                  }}
                  error={
                    formik.touched.durationInMinutes &&
                    Boolean(formik.errors.durationInMinutes)
                  }
                  helperText={
                    formik.touched.durationInMinutes &&
                    formik.errors.durationInMinutes
                  }
                />
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => {
                    setTaskEdit(false);
                  }}
                >
                  Save
                </Button>
              </Box>
            </Collapse>

            <Collapse in={!taskEdit}>
              <Box
                width={"100%"}
                justifyContent={"space-between"}
                display={"flex"}
              >
                <div>
                  <ListItem
                    disableGutters
                    slot="div"
                    slotProps={{
                      root: "div",
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <AccessTime />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        currentSession.remainingMinutes
                          ? formatTime(currentSession.remainingMinutes * 60)
                          : "00:00:00"
                      }
                      secondary="Remaining minutes"
                    />
                  </ListItem>
                </div>
                <div>
                  <ButtonGroup>
                    <Tooltip title="Skip session">
                      <IconButton size="small" onClick={timer.skipSession}>
                        <SkipNext />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Restart session">
                      <IconButton size="small" onClick={timer.resetTimer}>
                        <Replay10 />
                      </IconButton>
                    </Tooltip>
                  </ButtonGroup>
                </div>
              </Box>
            </Collapse>
          </Box>
        </Box>
      </Accordion>
    </ListItem>
  );
};
