import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { captureGlobalErrors } from './services/logger';

import './index.css';

captureGlobalErrors();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

postMessage({ payload: 'removeLoading' }, '*');
