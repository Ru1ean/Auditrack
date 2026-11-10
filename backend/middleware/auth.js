const jwt = require("jsonwebtoken");
const db = require("../db");

// Standard JWT Authentication Middleware
const auth = async function (req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, "MY_SECRET_KEY");
    req.user = decoded; // Contains userid and roleid if signed with roleid

    // Fallback: If roleid is missing from token payload, fetch from DB
    if (!req.user.roleid && req.user.userid) {
      const [[userRow]] = await db.query("SELECT roleid FROM users WHERE userid = ?", [req.user.userid]);
      if (userRow) {
        req.user.roleid = Number(userRow.roleid);
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Session expired or invalid token" });
  }
};

// Middleware to restrict Auditor (roleid === 4) from making structural changes (create, edit, delete)
const restrictAuditor = async function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let roleid = Number(req.user.roleid);
  if (!roleid && req.user.userid) {
    const [[userRow]] = await db.query("SELECT roleid FROM users WHERE userid = ?", [req.user.userid]);
    if (userRow) roleid = Number(userRow.roleid);
  }

  if (roleid === 4) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: External Auditors are not permitted to modify compliance structures or records.",
    });
  }

  next();
};

// Middleware to restrict Auditor (roleid === 4) from downloading files
const restrictAuditorDownloads = async function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let roleid = Number(req.user.roleid);
  if (!roleid && req.user.userid) {
    const [[userRow]] = await db.query("SELECT roleid FROM users WHERE userid = ?", [req.user.userid]);
    if (userRow) roleid = Number(userRow.roleid);
  }

  if (roleid === 4) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: File downloading is restricted for Auditors.",
    });
  }

  next();
};

// Middleware to require Admin (roleid === 1) access
const requireAdmin = async function (req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  let roleid = Number(req.user.roleid);
  if (!roleid && req.user.userid) {
    const [[userRow]] = await db.query("SELECT roleid FROM users WHERE userid = ?", [req.user.userid]);
    if (userRow) roleid = Number(userRow.roleid);
  }

  if (roleid !== 1) {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Administrator access required.",
    });
  }

  next();
};

module.exports = auth;
module.exports.auth = auth;
module.exports.restrictAuditor = restrictAuditor;
module.exports.restrictAuditorDownloads = restrictAuditorDownloads;
module.exports.requireAdmin = requireAdmin;
