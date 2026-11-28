import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { FocusTimerProvider } from './features/timer/FocusTimerContext';
import { captureGlobalErrors } from './services/logger';

import './index.css';

captureGlobalErrors();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <FocusTimerProvider>
      <App />
    </FocusTimerProvider>
  </React.StrictMode>,
);

postMessage({ payload: 'removeLoading' }, '*');
