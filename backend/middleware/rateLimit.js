// Simple in-memory rate limiter middleware
// Usage: const rateLimit = require('./rateLimit'); app.get('/path', rateLimit({ windowMs:60000, max:30 }), handler)
const store = new Map();

function makeKey(ip, route) {
  return `${ip}:${route}`;
}

module.exports = function rateLimit(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const max = options.max || 500; // default 500 requests per window for smooth UI operation

  return (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';
      const route = req.baseUrl + (req.path || '') || req.originalUrl || req.url;
      const key = makeKey(ip, route);
      const now = Date.now();

      let entry = store.get(key);
      if (!entry) {
        entry = { count: 1, start: now };
        store.set(key, entry);
      } else {
        if (now - entry.start > windowMs) {
          // reset window
          entry.count = 1;
          entry.start = now;
        } else {
          entry.count += 1;
        }
        store.set(key, entry);
      }

      const remaining = Math.max(0, max - entry.count);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(remaining));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((entry.start + windowMs - now) / 1000)));

      if (entry.count > max) {
        res.setHeader('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
        return res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
      }

      next();
    } catch (err) {
      // on error, fail open
      console.error('rateLimit middleware error', err);
      next();
    }
  };
};
