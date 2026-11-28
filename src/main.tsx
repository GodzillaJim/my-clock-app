import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FocusTimerProvider, useFocusTimerContext } from './features/timer/FocusTimerContext';
import { captureGlobalErrors } from './services/logger';

import './index.css';

captureGlobalErrors();

/**
 * Sits inside the timer provider: a crash in the UI leaves the running session
 * untouched, saves its progress, and "Try again" brings the view back.
 */
function AppBoundary({ children }: { children: React.ReactNode }) {
  const { actions } = useFocusTimerContext();
  return <ErrorBoundary onError={actions.flushSnapshot}>{children}</ErrorBoundary>;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* Last resort, for errors in the timer provider itself: only a reload helps */}
    <ErrorBoundary allowRetry={false}>
      <FocusTimerProvider>
        <AppBoundary>
          <App />
        </AppBoundary>
      </FocusTimerProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

postMessage({ payload: 'removeLoading' }, '*');
