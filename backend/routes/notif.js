
const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/notifController');
const auth = require('../middleware/auth');

// GET notifications for a user
router.get('/user/:userid', auth, NotificationController.getUserNotifications);

// GET notification counts
router.get('/user/:userid/counts', auth, NotificationController.getNotificationCounts);

// POST create new notification (admin only)
router.post('/create', auth, NotificationController.createNotification);

// PUT mark notification as read
router.put('/:notificationid/read', auth, NotificationController.markAsRead);

// PUT mark all notifications as read for a user
router.put('/user/:userid/read-all', auth, NotificationController.markAllAsRead);

// DELETE notification
router.delete('/:notificationid', auth, NotificationController.deleteNotification);

module.exports = router;
