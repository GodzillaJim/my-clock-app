import { useState, useEffect, useMemo } from 'react';
import { TaskType } from '../types';
import { v4 } from 'uuid';
import { createStorageService } from '@/services/storage';

const validateTaskIndex = (tasks: TaskType[], index: number): number => {
  if (tasks.length === 0) return -1;
  return Math.max(0, Math.min(index, tasks.length - 1));
};

export const useTasks = (storageKey = 'pomodoro-tasks') => {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const storage = useMemo(() => createStorageService<TaskType[]>(storageKey), [storageKey]);

  // Load initial tasks
  useEffect(() => {
    const savedTasks = storage.load();
    if (savedTasks) {
      setTasks(savedTasks);
      setCurrentTaskIndex(validateTaskIndex(savedTasks, 0));
    }
  }, [storage]);

  // Persist tasks on change
  useEffect(() => {
    storage.save(tasks);
    setCurrentTaskIndex(prev => validateTaskIndex(tasks, prev));
  }, [tasks, storage]);

  return {
    tasks,
    currentTaskIndex,
    setTasks,
    setCurrentTaskIndex: (index: number) => 
      setCurrentTaskIndex(validateTaskIndex(tasks, index)),
    addTask: (task: Omit<TaskType, 'id'>) => {
      const newTask = { ...task, id: v4() };
      setTasks(prev => [...prev, newTask]);
    },
    removeTask: (taskId: string) => {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };
};