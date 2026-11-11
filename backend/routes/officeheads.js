const express = require('express');
const router = express.Router();
const officeHeadsController = require('../controllers/officeheadsController');
const { auth, requireAdmin } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Debug: log available controller functions
console.log('officeHeadsController functions:', Object.keys(officeHeadsController));

router.use(express.json());

// Office heads routes - add-multiple BEFORE the :id route to avoid conflicts
router.post('/add-multiple', auth, requireAdmin, officeHeadsController.addMultipleHeads);
router.post('/add', auth, requireAdmin, officeHeadsController.uploadProfilePic, officeHeadsController.addHead);
router.put('/:id', auth, requireAdmin, officeHeadsController.uploadProfilePic, officeHeadsController.updateHead);
// Apply rate limit to list endpoint to protect from excessive paging requests
router.get('/all', auth, rateLimit({ windowMs: 60 * 1000, max: 30 }), officeHeadsController.getAllHeads);
router.get('/:id', auth, officeHeadsController.getHeadById);
router.delete('/delete', auth, requireAdmin, officeHeadsController.deleteHeads);
// Alternative route for delete with query parameters
router.delete('/delete-by-ids', auth, requireAdmin, officeHeadsController.deleteHeads);

module.exports = router;

