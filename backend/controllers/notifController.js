
const db = require('../db');

class NotificationController {
    // GET all notifications for a user
    static async getUserNotifications(req, res) {
        try {
            const { userid } = req.params;
            const { filter } = req.query; // 'all', 'read', 'unread'
            
            let whereClause = 'WHERE n.userid = ?';
            const queryParams = [userid];
            
            if (filter === 'read') {
                whereClause += ' AND n.isread = TRUE';
            } else if (filter === 'unread') {
                whereClause += ' AND n.isread = FALSE';
            }
            
            const [notifications] = await db.query(`
                SELECT 
                    n.notificationid,
                    n.Title AS "Title",
                    n.Message AS "Message",
                    n.Type AS "Type",
                    n.relatedtable,
                    n.relatedid,
                    n.isread,
                    n.createdat,
                    n.readat,
                    u.firstname as "AdminFirstName",
                    u.lastname as "AdminLastName"
                FROM notifications n
                LEFT JOIN users u ON n.adminid = u.userid
                ${whereClause}
                ORDER BY n.createdat DESC
            `, queryParams);
            
            res.json({
                success: true,
                data: notifications
            });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch notifications',
                error: error.message
            });
        }
    }
    
    // POST create new notification (admin only)
    static async createNotification(req, res) {
        try {
            const { userIds, adminid, title, message, type = 'info', relatedtable, relatedid } = req.body;
            const senderId = Number(adminid || req.user?.userid);
            const safeType = ['info', 'success', 'warning', 'error', 'announcement'].includes(type) ? type : 'info';
            const normalizedUserIds = [...new Set((Array.isArray(userIds) ? userIds : []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
            
            if (normalizedUserIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'User IDs are required'
                });
            }
            
            if (!senderId || !title || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Admin ID, title, and message are required'
                });
            }
            
            // Insert notifications for each user
            const insertPromises = normalizedUserIds.map(userid => {
                return db.query(`
                    INSERT INTO notifications 
                    (userid, adminid, Title, Message, Type, relatedtable, relatedid, createdat)
                    VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                `, [userid, senderId, title, message, safeType, relatedtable || null, relatedid || null]);
            });
            
            await Promise.all(insertPromises);
            
            res.json({
                success: true,
                message: `Notification sent to ${normalizedUserIds.length} users`
            });
        } catch (error) {
            console.error('Error creating notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to create notification',
                error: error.message
            });
        }
    }
    
    // PUT mark notification as read
    static async markAsRead(req, res) {
        try {
            const { notificationid } = req.params;
            
            await db.query(`
                UPDATE notifications 
                SET isread = TRUE, readat = NOW() 
                WHERE notificationid = ?
            `, [notificationid]);
            
            res.json({
                success: true,
                message: 'Notification marked as read'
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark notification as read',
                error: error.message
            });
        }
    }
    
    // PUT mark all notifications as read for a user
    static async markAllAsRead(req, res) {
        try {
            const { userid } = req.params;
            
            await db.query(`
                UPDATE notifications 
                SET isread = TRUE, readat = NOW() 
                WHERE userid = ? AND isread = FALSE
            `, [userid]);
            
            res.json({
                success: true,
                message: 'All notifications marked as read'
            });
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to mark all notifications as read',
                error: error.message
            });
        }
    }
    
    // GET notification counts
    static async getNotificationCounts(req, res) {
        try {
            const { userid } = req.params;
            
            const [counts] = await db.query(`
                SELECT 
                    COUNT(*) as total,
                    COALESCE(SUM(CASE WHEN isread = FALSE THEN 1 ELSE 0 END), 0) as unread,
                    COALESCE(SUM(CASE WHEN isread = TRUE THEN 1 ELSE 0 END), 0) as "read"
                FROM notifications 
                WHERE userid = ?
            `, [userid]);
            
            const c = counts && counts[0] ? counts[0] : { total: 0, unread: 0, read: 0 };
            const unreadNum = Number(c.unread || 0);
            const totalNum = Number(c.total || 0);
            const readNum = Number(c.read || 0);
            res.json({
                success: true,
                unread: unreadNum,
                total: totalNum,
                read: readNum,
                data: {
                    total: totalNum,
                    unread: unreadNum,
                    read: readNum
                }
            });
        } catch (error) {
            console.error('Error fetching notification counts:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch notification counts',
                error: error.message
            });
        }
    }
    
    // DELETE notification
    static async deleteNotification(req, res) {
        try {
            const { notificationid } = req.params;
            
            await db.query(`
                DELETE FROM notifications 
                WHERE notificationid = ?
            `, [notificationid]);
            
            res.json({
                success: true,
                message: 'Notification deleted'
            });
        } catch (error) {
            console.error('Error deleting notification:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete notification',
                error: error.message
            });
        }
    }
}

module.exports = NotificationController;
