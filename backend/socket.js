const { Server } = require('socket.io');

let io = null;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:8081',
];

/**
 * Initialize Socket.io with the HTTP server
 * @param {import('http').Server} server 
 * @returns {Server}
 */
function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman) or matching allowedOrigins
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
          callback(null, true);
        } else {
          callback(null, true); // Permissive in dev/local network to avoid blocked live updates
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

/**
 * Get active Socket.io instance
 * @returns {Server|null}
 */
function getIO() {
  return io;
}

/**
 * Emit a global data update event to all connected clients
 * @param {string} entityType - e.g. 'events', 'compliance', 'documents', 'logs', 'all'
 * @param {any} [payload] - Optional details/data associated with the change
 */
function emitDataChange(entityType = 'all', payload = null) {
  if (!io) return;
  try {
    io.emit('data_updated', {
      entityType,
      payload,
      timestamp: Date.now(),
    });
    console.log(`[Socket.io] Broadcasted data_updated (${entityType})`);
  } catch (err) {
    console.error('[Socket.io] Broadcast error:', err);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitDataChange,
};
