// Simple in-memory rate limiter for login attempts
// Keyed by email + IP. Not suitable for multi-instance deployments.
const store = new Map();

const MAX_ATTEMPTS = 5; // attempts allowed before a penalty
const PENALTY_INCREMENT_MIN = 1; // 1 minute penalty per block

function makeKey(email, ip) {
  const e = String(email || '').toLowerCase();
  const i = String(ip || '');
  return `${e}:${i}`;
}

function getEntry(key) {
  const v = store.get(key);
  if (!v) return null;
  // cleanup expired block
  if (v.blockedUntil && Date.now() > v.blockedUntil) {
    // keep penaltyMinutes (it grows), but reset attempts
    v.blockedUntil = null;
    v.attempts = 0;
    store.set(key, v);
  }
  return store.get(key) || null;
}

function getRemainingMs(email, ip) {
  const key = makeKey(email, ip);
  const entry = store.get(key);
  if (!entry || !entry.blockedUntil) return 0;
  const rem = entry.blockedUntil - Date.now();
  return rem > 0 ? rem : 0;
}

function recordFailure(email, ip) {
  const key = makeKey(email, ip);
  const now = Date.now();
  let entry = store.get(key);
  if (!entry) {
    entry = { attempts: 0, penaltyMinutes: PENALTY_INCREMENT_MIN, blockedUntil: null };
  }

  // if currently blocked, extend nothing — just return remaining
  if (entry.blockedUntil && now < entry.blockedUntil) {
    store.set(key, entry);
    return { blocked: true, remainingMs: entry.blockedUntil - now };
  }

  entry.attempts = (entry.attempts || 0) + 1;

  if (entry.attempts >= MAX_ATTEMPTS) {
    // apply block
    const blockMs = entry.penaltyMinutes * 60 * 1000;
    entry.blockedUntil = now + blockMs;
    // increase penalty for next time
    entry.penaltyMinutes = entry.penaltyMinutes + PENALTY_INCREMENT_MIN;
    entry.attempts = 0; // reset attempts after block
    store.set(key, entry);
    return { blocked: true, remainingMs: blockMs };
  }

  store.set(key, entry);
  return { blocked: false, attempts: entry.attempts };
}

function reset(email, ip) {
  const key = makeKey(email, ip);
  store.delete(key);
}

module.exports = {
  getRemainingMs,
  recordFailure,
  reset,
  // exported for tests/inspection
  _store: store
};
