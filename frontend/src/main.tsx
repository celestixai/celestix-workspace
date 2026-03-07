import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { ToastProvider } from './components/ui/toast';
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
