import { createTheme } from "@mui/material/styles";
import { commonProperties } from "../common";

export const lightTheme = createTheme({
    ...commonProperties,
    palette: {
      mode: 'light',
      primary: {
        main: '#2563eb', // Blue
        light: '#60a5fa',
        dark: '#1e40af',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#7c3aed', // Purple
        light: '#a78bfa',
        dark: '#5b21b6',
        contrastText: '#ffffff',
      },
      error: {
        main: '#dc2626',
        light: '#ef4444',
        dark: '#991b1b',
      },
      warning: {
        main: '#f59e0b',
        light: '#fbbf24',
        dark: '#b45309',
      },
      success: {
        main: '#16a34a',
        light: '#22c55e',
        dark: '#15803d',
      },
      info: {
        main: '#0ea5e9',
        light: '#38bdf8',
        dark: '#0369a1',
      },
      background: {
        default: '#f8fafc',
        paper: '#ffffff',
      },
      text: {
        primary: '#0f172a',
        secondary: '#475569',
      },
      divider: '#e2e8f0',
    },
  });
  