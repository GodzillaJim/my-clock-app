import { ThemeOptions } from "@mui/material";

export const commonProperties: Partial<ThemeOptions>  = {
    typography: {
      fontFamily: '"Karla", serif, "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
        fontFamily: '"Playfair Display", serif'
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
        fontFamily: '"Montserrat", sans-serif',
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
      },
      body1: {
        fontSize: '1rem',
        lineHeight: 1.5,
      },
      button: {
        textTransform: 'none', // Prevents automatic uppercase transformation
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 16px',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
    },
  };

