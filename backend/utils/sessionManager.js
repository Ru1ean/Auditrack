const crypto = require('crypto');
const db = require('../db');

// In-memory cache of active session IDs per user: Map<number, { sessionId: string, syncedAt: number }>
const activeSessionCache = new Map();
const CACHE_TTL_MS = 2000;

let columnEnsured = false;

async function ensureSessionColumn() {
  if (columnEnsured) return;
  try {
    await db.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS activesessionid VARCHAR(128)');
    columnEnsured = true;
  } catch (err) {
    console.warn('[SessionManager] Could not ensure activesessionid column:', err.message || err);
  }
}

function generateSessionId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(24).toString('hex');
}

async function setActiveSession(userid, sessionId) {
  const uid = Number(userid);
  if (!uid || !sessionId) return;

  activeSessionCache.set(uid, {
    sessionId: String(sessionId),
    syncedAt: Date.now(),
  });

  try {
    await ensureSessionColumn();
    await db.query('UPDATE users SET activesessionid = ? WHERE userid = ?', [String(sessionId), uid]);
  } catch (err) {
    console.warn('[SessionManager] Failed to persist active session in DB:', err.message || err);
  }
}

async function getActiveSession(userid) {
  const uid = Number(userid);
  if (!uid) return null;

  const cached = activeSessionCache.get(uid);
  const now = Date.now();
  if (cached && now - cached.syncedAt < CACHE_TTL_MS) {
    return cached.sessionId;
  }

  try {
    await ensureSessionColumn();
    const [rows] = await db.query('SELECT activesessionid FROM users WHERE userid = ? LIMIT 1', [uid]);
    if (!rows || rows.length === 0) {
      activeSessionCache.delete(uid);
      return null;
    }
    const dbSessionId = rows[0].activesessionid || rows[0].ActiveSessionId || null;
    if (dbSessionId) {
      activeSessionCache.set(uid, {
        sessionId: String(dbSessionId),
        syncedAt: now,
      });
      return String(dbSessionId);
    }
    // If DB column is null/empty, clear cache
    activeSessionCache.delete(uid);
    return null;
  } catch (err) {
    // Fallback to in-memory cache if DB query fails transiently
    return cached ? cached.sessionId : null;
  }
}

async function isValidSession(userid, sessionId) {
  if (!userid || !sessionId) return false;
  const currentSessionId = await getActiveSession(userid);
  if (!currentSessionId) return false;
  return String(currentSessionId) === String(sessionId);
}

async function clearActiveSession(userid, sessionId = null) {
  const uid = Number(userid);
  if (!uid) return;

  const cached = activeSessionCache.get(uid);
  if (sessionId && cached && cached.sessionId && String(cached.sessionId) !== String(sessionId)) {
    // Another newer session is already active; do not clear it
    return;
  }

  activeSessionCache.delete(uid);

  try {
    await ensureSessionColumn();
    if (sessionId) {
      await db.query(
        'UPDATE users SET activesessionid = NULL WHERE userid = ? AND activesessionid = ?',
        [uid, String(sessionId)]
      );
    } else {
      await db.query('UPDATE users SET activesessionid = NULL WHERE userid = ?', [uid]);
    }
  } catch (err) {
    console.warn('[SessionManager] Failed to clear active session in DB:', err.message || err);
  }
}

module.exports = {
  ensureSessionColumn,
  generateSessionId,
  setActiveSession,
  getActiveSession,
  isValidSession,
  clearActiveSession,
};

