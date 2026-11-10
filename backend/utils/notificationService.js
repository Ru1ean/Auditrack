const db = require('../db');

const ALLOWED_TYPES = new Set(['info', 'success', 'warning', 'error', 'announcement']);
const META_TAG = '[[meta:';
const META_END = ']]';

const normalizeUserIds = (userIds = []) => {
  if (!Array.isArray(userIds)) return [];
  return [...new Set(userIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
};

const appendMeta = (message, meta) => {
  const text = String(message || '').trim();
  if (!meta || typeof meta !== 'object' || Object.keys(meta).length === 0) return text;
  return `${text}\n${META_TAG}${JSON.stringify(meta)}${META_END}`;
};

const parseMetaFromMessage = (message) => {
  const raw = String(message || '');
  const start = raw.lastIndexOf(META_TAG);
  if (start === -1) return { text: raw.trim(), meta: null };

  const end = raw.indexOf(META_END, start);
  if (end === -1) return { text: raw.trim(), meta: null };

  try {
    const meta = JSON.parse(raw.slice(start + META_TAG.length, end));
    return { text: raw.slice(0, start).trim(), meta };
  } catch {
    return { text: raw.trim(), meta: null };
  }
};

const createNotifications = async ({
  userIds = [],
  adminid,
  title,
  message,
  type = 'info',
  relatedtable = null,
  relatedid = null,
  meta = null,
}) => {
  const recipients = normalizeUserIds(userIds);
  let senderId = Number(adminid);
  try {
    if (Number.isInteger(senderId) && senderId > 0) {
      const [checkRows] = await db.query(`SELECT userid FROM users WHERE userid = ? LIMIT 1`, [senderId]);
      if (!checkRows || checkRows.length === 0) {
        senderId = null;
      }
    } else {
      senderId = null;
    }
    if (!senderId) {
      const [adminRows] = await db.query(`SELECT userid FROM users WHERE roleid = 1 ORDER BY userid ASC LIMIT 1`);
      senderId = adminRows?.[0]?.userid || null;
    }
  } catch (e) {
    senderId = null;
  }

  if (recipients.length === 0 || !title || !message) {
    return { inserted: 0, skipped: recipients.length };
  }

  const normalizedType = ALLOWED_TYPES.has(type) ? type : 'info';
  const finalMessage = appendMeta(message, meta);

  for (const userid of recipients) {
    try {
      await db.query(
        `INSERT INTO notifications
          (userid, adminid, Title, Message, Type, relatedtable, relatedid, isread, createdat)
         VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, NOW())`,
        [userid, senderId, String(title).trim(), finalMessage, normalizedType, relatedtable || null, relatedid || null]
      );
    } catch (err) {
      console.error(`Error inserting notification for user #${userid}:`, err.message);
    }
  }

  try {
    const { emitDataChange } = require('../socket');
    emitDataChange('notifications', {
      userIds: recipients,
      title: String(title).trim(),
      type: normalizedType,
    });
  } catch (socketErr) {
    // Non-fatal if socket not ready
  }

  return { inserted: recipients.length, skipped: 0 };
};

const getAdminUserIds = async () => {
  const [rows] = await db.query('SELECT userid FROM users WHERE roleid = 1');
  return rows.map((row) => Number(row.userid)).filter((id) => Number.isInteger(id) && id > 0);
};

module.exports = {
  createNotifications,
  appendMeta,
  parseMetaFromMessage,
  getAdminUserIds,
};
