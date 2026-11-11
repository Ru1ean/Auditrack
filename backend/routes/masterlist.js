const express = require('express');
const router = express.Router();
const rateLimit = require('../middleware/rateLimit');
const masterlistController = require('../controllers/masterlistController');
const auth = require('../middleware/auth');

router.get('/', auth, masterlistController.getAll);
router.get('/available/:eventid', auth, masterlistController.getAvailableForEvent);
router.post('/add', auth, masterlistController.addItem);
router.put('/:id', auth, masterlistController.updateItem);
router.post('/delete-multiple', auth, masterlistController.deleteMultiple);
router.delete('/delete-multiple', auth, masterlistController.deleteMultiple);
router.delete('/', auth, masterlistController.deleteMultiple);
router.delete('/:id', auth, masterlistController.deleteItem);

module.exports = router;
