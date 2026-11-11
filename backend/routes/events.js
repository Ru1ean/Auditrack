const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/EventsController');
const { auth, restrictAuditor, restrictAuditorDownloads } = require('../middleware/auth');
const rateLimit = require('../middleware/rateLimit');

// Get all events
router.get('/', auth, eventsController.getAllEvents);

// Get accreditation levels
router.get('/accreditation-levels', auth, eventsController.getAccreditationLevels);

// Add new event
router.post('/add', auth, restrictAuditor, eventsController.addEvent);

// Delete multiple events
router.post('/delete', auth, restrictAuditor, eventsController.deleteEvents);

// Update event
router.put('/update/:id', auth, restrictAuditor, eventsController.updateEvent);

// Toggle Audit Freeze / Lock on event
router.patch('/:id/lock', auth, restrictAuditor, eventsController.toggleEventLock);

// Update Event Deadline
router.patch('/:id/deadline', auth, restrictAuditor, eventsController.updateEventDeadline);

// Send manual countdown reminder to assigned personnel
router.post('/:id/remind', auth, restrictAuditor, eventsController.sendEventReminder);

// Get downloadable folders
router.get('/downloadable-folders', auth, restrictAuditorDownloads, eventsController.getDownloadableFolders);

// Download event folder as zip (blocked for Auditors)
router.get('/download/:eventname', auth, restrictAuditorDownloads, eventsController.downloadEventZip);

// Copy event
router.post('/copy', auth, restrictAuditor, eventsController.copyEvent);

module.exports = router;
