import { ThemeProvider } from "@mui/material/styles";
import React, { useState } from "react";
import { lightTheme } from "./light";
import { darkTheme } from "./dark";
import { CssBaseline } from "@mui/material";

type ThemeProviderProps = {
  children: React.ReactNode;
};

const ThemeContext = React.createContext({
  theme: "light",
  setTheme: (theme: string) => {},
});

export const useThemeContext = () => React.useContext(ThemeContext);

export const AppThemeProvider = ({ children }: ThemeProviderProps) => {
  const [theme, setTheme] = useState("light");
  const activeTheme = theme === "light" ? lightTheme : darkTheme;

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};
