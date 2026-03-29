import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ToastProvider } from './components/ui/toast';
import './styles/celestix-tokens.css';
import './styles/celestix-global.css';
import './styles/globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Register service worker for PWA
if ('serviceWorker' in navigator && !(window as any).electronAPI) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {(window as any).electronAPI ? (
        <HashRouter>
          <App />
          <ToastProvider />
        </HashRouter>
      ) : (
        <BrowserRouter>
          <App />
          <ToastProvider />
        </BrowserRouter>
      )}
    </QueryClientProvider>
  </React.StrictMode>
);
