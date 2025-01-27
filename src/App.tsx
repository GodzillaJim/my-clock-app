import "./App.css";
import { Main } from "./components/Main";
import { AppThemeProvider } from "./styles/theme";

const App = () => {
  return (
    <AppThemeProvider>
      <Main />
    </AppThemeProvider>
  );
};

export default App;
