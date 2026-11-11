const express = require('express');
const router = express.Router();
const userListController = require('../controllers/userlistcontroller');
const { auth, requireAdmin } = require('../middleware/auth');

// GET all users (admin only)
router.get('/', auth, requireAdmin, userListController.getAllUsers);

module.exports = router;

