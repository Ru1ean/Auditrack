const express = require('express');
const router = express.Router();
const controller = require('../controllers/ComplianceStatusOfficesController');
const auth = require('../middleware/auth');

// GET all compliance status offices
router.get('/', auth, controller.getAllComplianceStatusOffices);

module.exports = router;

