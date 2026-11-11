import { io } from 'socket.io-client';

const SOCKET_URL = 
  import.meta.env.VITE_SOCKET_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5200' 
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

export function getCurrentSessionInfo() {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;

  let userid = null;
  let sessionId = localStorage.getItem('sessionId') || null;

  try {
    const payloadPart = token.split('.')[1];
    if (payloadPart) {
      const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(window.atob(base64));
      if (decoded?.userid) userid = Number(decoded.userid);
      if (decoded?.sessionId) sessionId = String(decoded.sessionId);
    }
  } catch {}

  if (!userid) {
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed?.userid) userid = Number(parsed.userid);
      }
    } catch {}
  }

  return userid ? { userid, sessionId } : null;
}

export function forceLogoutReplacedSession(message) {
  if (typeof window === 'undefined') return;
  const finalMsg =
    message ||
    'Your session has ended because your account was signed in on another device or browser.';
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('sessionId');
    localStorage.removeItem('name');
    sessionStorage.setItem('sessionReplacedMessage', finalMsg);
  } catch {}

  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

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

  socket.on('session_replaced', (data) => {
    const current = getCurrentSessionInfo();
    if (!current || !current.userid) return;
    if (Number(data?.userid) === Number(current.userid)) {
      if (!current.sessionId || String(data?.sessionId) !== String(current.sessionId)) {
        forceLogoutReplacedSession(data?.message);
      }
    }
  });
}

export default socket;
