import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { registerServiceWorker } from './registerServiceWorker';
import { requestPersistentStorage } from './utils/idbStorage';
import './index.css';

// Register PWA Service Worker for Offline First support
registerServiceWorker();

// Lock storage persistence to protect offline IndexedDB data on iOS Safari & mobile browsers
requestPersistentStorage();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
