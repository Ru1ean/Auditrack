const db = require('../db');

/**
 * Automatically create notification records for target user IDs or system users.
 */
async function notifyUsers({ userIds, adminid = null, title, message, type = 'info', relatedtable = null, relatedid = null }) {
    if (!title || !message) return;
    const safeType = ['info', 'success', 'warning', 'error', 'announcement'].includes(type) ? type : 'info';
    
    let targetIds = Array.isArray(userIds) ? userIds.map(Number).filter(id => Number.isInteger(id) && id > 0) : [];
    
    // If targetIds is empty, default to notifying admin users
    if (targetIds.length === 0) {
        try {
            const [admins] = await db.query(`SELECT userid FROM users WHERE roleid = 1 OR LOWER(rolename) = 'admin'`);
            targetIds = admins.map(a => a.userid);
        } catch (e) {
            console.error('Failed to resolve default admin notification recipients:', e.message);
        }
    }
    
    const uniqueIds = [...new Set(targetIds)];
    for (const uid of uniqueIds) {
        try {
            await db.query(`
                INSERT INTO notifications (userid, adminid, Title, Message, Type, relatedtable, relatedid, isread, createdat)
                VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())
            `, [uid, adminid || null, String(title).slice(0, 255), String(message).slice(0, 1000), safeType, relatedtable || null, relatedid || null]);
        } catch (err) {
            console.error(`Failed to insert notification for user #${uid}:`, err.message);
        }
    }
}

module.exports = { notifyUsers };
