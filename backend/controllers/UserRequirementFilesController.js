// Controller for deleting a user's uploaded requirement file
const path = require('path');
const fs = require('fs');
const db = require('../db');

// DELETE /api/requirements/:requirementid/file/:userid
exports.deleteUserRequirementFile = async (req, res) => {
  const { requirementid, userid } = req.params;
  try {
    // Find the file path in DB
    const [rows] = await db.query(
      'SELECT filepath FROM requirement_user_uploads WHERE requirementid = ? AND userid = ? ORDER BY uploadedat DESC LIMIT 1',
      [requirementid, userid]
    );
    if (!rows.length || !rows[0].filepath) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }
    const filepath = path.join(__dirname, '..', rows[0].filepath);
    // Delete file from disk
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    // Remove DB record (optional: you may want to keep a log)
    await db.query(
      'DELETE FROM requirement_user_uploads WHERE requirementid = ? AND userid = ?',
      [requirementid, userid]
    );
    // Optionally, update hasuploaded status in assignment table
    await db.query(
      'UPDATE requirement_assignments SET hasuploaded = 0 WHERE requirementid = ? AND userid = ?',
      [requirementid, userid]
    );
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) {
    console.error('Delete user requirement file error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};
