const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/departments
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM departments ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Failed to fetch departments:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch departments' });
  }
});

module.exports = router;

