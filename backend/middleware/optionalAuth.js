const jwt = require('jsonwebtoken');
const { isValidSession } = require('../utils/sessionManager');

/** Attaches req.user when a valid Bearer token is present; never rejects. */
module.exports = async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, 'MY_SECRET_KEY');
    const valid = await isValidSession(decoded.userid, decoded.sessionId);
    if (valid) {
      req.user = decoded;
    }
  } catch {
    // ignore invalid/expired token for optional auth
  }
  next();
};
