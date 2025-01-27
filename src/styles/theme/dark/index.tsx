import { createTheme } from "@mui/material/styles";
import { commonProperties } from "../common";

export const darkTheme = createTheme({
    ...commonProperties,
    palette: {
      mode: 'dark',
      primary: {
        main: '#60a5fa', // Lighter blue for dark mode
        light: '#93c5fd',
        dark: '#2563eb',
        contrastText: '#000000',
      },
      secondary: {
        main: '#a78bfa', // Lighter purple for dark mode
        light: '#c4b5fd',
        dark: '#7c3aed',
        contrastText: '#000000',
      },
      error: {
        main: '#ef4444',
        light: '#f87171',
        dark: '#dc2626',
      },
      warning: {
        main: '#fbbf24',
        light: '#fcd34d',
        dark: '#f59e0b',
      },
      success: {
        main: '#22c55e',
        light: '#4ade80',
        dark: '#16a34a',
      },
      info: {
        main: '#38bdf8',
        light: '#7dd3fc',
        dark: '#0ea5e9',
      },
      background: {
        default: '#0f172a',
        paper: '#1e293b',
      },
      text: {
        primary: '#f8fafc',
        secondary: '#cbd5e1',
      },
      divider: '#334155',
    },
  });