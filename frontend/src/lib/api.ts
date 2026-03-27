import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

// Production backend URL set at build time; falls back to localhost for dev
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// In Electron, API calls go to the full backend URL; in web, use relative proxy or production URL
let apiBaseURL = BACKEND_URL ? `${BACKEND_URL}/api/v1` : '/api/v1';

const isElectron = !!(window as any).electronAPI?.isElectron?.();
if (isElectron) {
  apiBaseURL = `${BACKEND_URL || 'http://localhost:3001'}/api/v1`;
  (window as any).electronAPI.getBackendUrl().then((url: string) => {
    api.defaults.baseURL = `${url}/api/v1`;
  });
}

const api = axios.create({
  baseURL: apiBaseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
          useAuthStore.getState().setTokens(data.data.accessToken, data.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(error.config);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = '/login';
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export { api };
