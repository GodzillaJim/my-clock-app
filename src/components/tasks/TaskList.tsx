import {
  Add,
  Check,
  Delete,
  DeleteOutline,
  DoneAllOutlined,
  Edit,
  HourglassTop,
  PlayArrow,
} from "@mui/icons-material";
import {
  Accordion,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid2,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  styled,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { useFormik } from "formik";
import { useEffect, useMemo, useState } from "react";
import { Draggable } from "react-drag-reorder";
import { v4 } from "uuid";
import { TaskListItem } from "./TaskListItem";
import { SessionItem, toSessionItem } from "../../features/timer/types";
import { useTimerContext } from "@/features/timer/context/TimerContext";
import { TaskType as ITask } from "../../features/timer/types";
// sx={{ maxHeight: 500, overflow: "auto" }}
const CustomList = styled(List)(({ theme }) => ({
  maxHeight: 500,
  overflow: "auto",
  "::-webkit-scrollbar": {
    width: "6px",
  },
  "::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.background.default,
    borderRadius: "3px",
  },
  "::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.grey[500],
    borderRadius: "3px",
    "&:hover": {
      backgroundColor: theme.palette.grey[600],
    },
  },
  scrollbarWidth: "thin",
  scrollbarColor: `${theme.palette.grey[500]} ${theme.palette.background.default}`,
}));

export type TaskType = {
  name: string;
  durationInMinutes: number;
  sessions: SessionItem[];
  id: string;
};

type TaskListProps = {
  tasks: TaskType[];
  setTasks: (tasks: TaskType[]) => void;
};

export const TaskList = () => {
  const { tasks, setTasks, addTask, removeTask, updateTask } = useTimerContext();

  const deleteTask = (taskId: string) => {
    removeTask(taskId);
  };

  const createNewTask = (taskName: string) => {
    const newTask: ITask = {
      title: taskName,
      durationInMinutes: 60,
      id: v4(),
      sessions: [],
      completed: false,
      createdAt: new Date(),
      completedAt: undefined,
      description: "",
    };

    addTask(newTask);
  };

  const formik = useFormik({
    initialValues: {
      newTask: "",
    },
    onSubmit: (values) => {
      createNewTask(values.newTask);
      formik.resetForm();
    },
  });

  const setTask = (newTask: ITask) => {
    const newTasks = [...tasks];
    const index = newTasks.findIndex((t) => t.id === newTask.id);
    if (index > -1) {
      newTasks[index] = newTask;
      setTasks(newTasks);
    } else {
      newTasks.push(newTask);
    }
  };

  const getFinishTime = () => {
    const totalMinutes = tasks
      .map((t) => t.durationInMinutes)
      .reduce((a, b) => a + b, 0);

    const remainingMinutesAcrossTasks = tasks
      .map((task) => {
        let remainingMinutes = 0;
        if (task?.sessions?.length) {
          task.sessions.forEach((session) => {
            const sessionItem = toSessionItem(session);
            remainingMinutes += sessionItem.remainingMinutes;
          });
        }

        return remainingMinutes;
      })
      .reduce((a, b) => a + b, 0);

    const remainingMinutes = totalMinutes - remainingMinutesAcrossTasks;

    return dayjs().add(remainingMinutes, "minute").format("hh:mm A");
  };

  const getTotalFocusedTime = () => {
    const totalMinutes = tasks
      .map((t) => t.durationInMinutes)
      .reduce((a, b) => a + b, 0);

    const remainingMinutesAcrossTasks = tasks
      .map((task) => {
        let remainingMinutes = 0;
        if (task?.sessions?.length) {
          task.sessions.forEach((session) => {
            const sessionItem = toSessionItem(session);
            remainingMinutes += sessionItem.remainingMinutes;
          });
        }

        return remainingMinutes;
      })
      .reduce((a, b) => a + b, 0);

    return totalMinutes - remainingMinutesAcrossTasks;
  };

  const taskList = useMemo(() => {
    console.log('TaskList: tasks', tasks);
    return (
      <CustomList>
        {tasks.map((task, index) => (
          <TaskListItem
            taskIndex={index}
            key={task.id}
            updateTask={updateTask}
            deleteTask={deleteTask}
            task={task}
          />
        ))}
      </CustomList>
    );
  }, [tasks]);

  return (
    <Grid2 m={2} width={"100%"}>
      <Card sx={{ width: "100%" }}>
        <CardContent>
          <form onSubmit={formik.handleSubmit} noValidate>
            <Grid2
              container
              gap={2}
              width={"100%"}
              alignContent={"center"}
              alignItems={"center"}
            >
              <Grid2>
                <TextField
                  name="newTask"
                  value={formik.values.newTask}
                  onChange={formik.handleChange}
                  label="New Task"
                  fullWidth
                  id="newTask"
                  error={
                    formik.touched.newTask && Boolean(formik.errors.newTask)
                  }
                  helperText={formik.touched.newTask && formik.errors.newTask}
                />
              </Grid2>
              <Grid2>
                <Button variant="contained" startIcon={<Add />} type="submit">
                  Add Task
                </Button>
              </Grid2>
            </Grid2>
          </form>
          <Divider sx={{ my: 2 }} />
          <Box display={"flex"} flexDirection={"column"}>
            <Box>
              <Typography variant="h6">Tasks</Typography>
            </Box>
            <Box display={"flex"} gap={3}>
              <List>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 45 }}>
                    <HourglassTop fontSize="large" />
                  </ListItemIcon>
                  <ListItemText
                    secondary={"Total estimated time"}
                    primary={
                      <Typography variant="h3">
                        {tasks
                          .map((t) => t.durationInMinutes)
                          .reduce((a, b) => a + b, 0)}{" "}
                        min
                      </Typography>
                    }
                  />
                </ListItem>
              </List>
              <List>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 45 }}>
                    <DoneAllOutlined fontSize="large" />
                  </ListItemIcon>
                  <Tooltip title="Estimated end time starting now" arrow>
                    <ListItemText
                      secondary={<Typography>Finish time</Typography>}
                      primary={
                        <Typography variant="h5">{getFinishTime()}</Typography>
                      }
                    />
                  </Tooltip>
                </ListItem>
              </List>
              <List>
                <ListItem>
                  <ListItemIcon sx={{ minWidth: 45 }}>
                    <DoneAllOutlined fontSize="large" />
                  </ListItemIcon>
                  <Tooltip title="Estimated end time starting now" arrow>
                    <ListItemText
                      secondary={<Typography>Time focused</Typography>}
                      primary={
                        <Typography variant="h5">
                          {getTotalFocusedTime()} min
                        </Typography>
                      }
                    />
                  </Tooltip>
                </ListItem>
              </List>
            </Box>
            <Divider />
            {taskList}
          </Box>
        </CardContent>
      </Card>
    </Grid2>
  );
};
