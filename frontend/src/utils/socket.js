import { io } from 'socket.io-client';

const SOCKET_URL = 
  import.meta.env.VITE_SOCKET_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5000' 
    : '/');

export const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

if (typeof window !== 'undefined') {
  socket.on('connect', () => {
    console.log('[LiveSocket] Connected to live sync server. ID:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[LiveSocket] Disconnected from live sync server:', reason);
  });

  socket.on('connect_error', (error) => {
    console.warn('[LiveSocket] Connection error:', error.message);
  });
}

export default socket;
