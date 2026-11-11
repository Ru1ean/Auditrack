const express = require('express');
const router = express.Router();
const controller = require('../controllers/eventDepartmentsController');
const auth = require('../middleware/auth');

// All routes require authentication
router.get('/event/:eventid', auth, controller.getByEvent);
router.post('/', auth, controller.assignDepartment);
router.put('/:id/level', auth, controller.updateLevel);
router.delete('/:id', auth, controller.deleteDepartment);

module.exports = router;
