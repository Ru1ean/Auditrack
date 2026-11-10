const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logsController');
const { auth, requireAdmin } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// GET /logs - fetch audit logs (admin only, rate limited to protect heavy queries)
router.get('/', auth, requireAdmin, rateLimit({ windowMs: 60 * 1000, max: 30 }), logsController.getLogs);

module.exports = router;

