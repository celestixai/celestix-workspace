import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

let socket: Socket | null = null;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
let backendUrl = BACKEND_URL || '/';

const isElectron = !!(window as any).electronAPI?.isElectron?.();
if (isElectron) {
  backendUrl = BACKEND_URL || 'http://localhost:3001';
  (window as any).electronAPI.getBackendUrl().then((url: string) => {
    backendUrl = url;
  });
}

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(backendUrl, {
    auth: { token: useAuthStore.getState().token },
    transports: ['websocket', 'polling'],
    autoConnect: false,
  });

  return socket;
}

export function connectSocket() {
  const s = getSocket();
  s.auth = { token: useAuthStore.getState().token };
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
