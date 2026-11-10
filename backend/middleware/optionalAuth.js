const jwt = require('jsonwebtoken');

/** Attaches req.user when a valid Bearer token is present; never rejects. */
module.exports = function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, 'MY_SECRET_KEY');
    req.user = decoded;
  } catch {
    // ignore invalid/expired token for optional auth
  }
  next();
};
