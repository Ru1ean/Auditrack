const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const OfficesController = require('../controllers/OfficesController');
const { saveOfficeProofDocument } = require('../utils/officeProof');
const db = require('../db');
const auth = require('../middleware/auth');
const { recordLog } = require('../controllers/logsController');

// Multer config for proof document uploads (matches requirements upload pattern)
const tempProofUploadDir = path.join(__dirname, '../uploads/tmp-proof-uploads');
if (!fs.existsSync(tempProofUploadDir)) {
    fs.mkdirSync(tempProofUploadDir, { recursive: true });
}
const upload = multer({
    dest: tempProofUploadDir,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed. Only images, PDFs, and Office documents are allowed.'));
        }
    }
});

// ...existing office routes...
// Require authentication so we can record uploader identity in filename
router.post('/:id/proof', auth, upload.single('file'), async (req, res) => {
  try {
    // Debug logging for upload
    console.log('--- Proof Upload Debug ---');
    console.log('Office ID:', req.params.id);
    console.log('File original name:', req.file && req.file.originalname);
    console.log('Temp upload path:', req.file && req.file.path);

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const officeid = req.params.id;
    // Get office name and event ID from database
    const [officeRows] = await db.query('SELECT officename, eventid FROM offices WHERE officeid = ?', [officeid]);
    if (officeRows.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Office not found' });
    }
    const officename = officeRows[0].officename;
    const eventid = officeRows[0].eventid;
    console.log('Office name from DB:', officename);
    console.log('Event ID from DB:', eventid);
    if (!eventid) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Office is not assigned to an event' });
    }
    // Get event code/name from database
    const [eventRows] = await db.query('SELECT eventname, eventcode FROM events WHERE eventid = ?', [eventid]);
    if (eventRows.length === 0) {
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const eventname = eventRows[0].eventname;
    const eventcode = eventRows[0].eventcode;
    console.log('Event name from DB:', eventname);
    // Sanitize event name and office name for folder and filename
    // Prefer event code for the folder name if present
    const safeEventName = (eventcode || eventname).replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 40);
    const safeOfficeName = officename.replace(/[^a-zA-Z0-9-]/g, '.').substring(0, 40);
    console.log('Sanitized event name:', safeEventName);
    console.log('Sanitized office name:', safeOfficeName);
    // Get file extension from original file
    const ext = path.extname(req.file.originalname);
    console.log('File extension:', ext);
    // Resolve uploader name from authenticated user (preferred) or fallback to UnknownUser
    let safeUserName = 'UnknownUser';
    try {
      const db = require('../db');
      const uploaderId = Number(req.user?.userid || 0);
      if (uploaderId && uploaderId > 0) {
        const [uRows] = await db.query('SELECT firstname, lastname, Email FROM users WHERE userid = ?', [uploaderId]);
        if (uRows && uRows.length > 0) {
          const u = uRows[0];
          const display = `${u.firstname || ''}${u.lastname ? ' ' + u.lastname : ''}`.trim() || u.Email || `user${uploaderId}`;
          safeUserName = String(display).replace(/[^a-zA-Z0-9-]/g, '.').substring(0, 40) || 'UnknownUser';
        }
      }
    } catch (e) {
      console.warn('Failed to resolve uploader name for proof file:', e);
    }
    // Use a filename pattern prefixed with event code: {event}.{office}.proof.{user}.{ext}
    const finalFileName = `${safeEventName}.${safeOfficeName}.proof.${safeUserName}${ext}`;
    console.log('Final file name:', finalFileName);
    const eventDir = path.join(__dirname, `../uploads/events/${safeEventName}`);
    console.log('Event directory:', eventDir);
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }
    const destPath = path.join(eventDir, finalFileName);
    console.log('Destination path:', destPath);
    // Delete old proof document if exists (both from database and filesystem)
    try {
      const [oldDocs] = await db.query(
        'SELECT filepath FROM officeproofdocuments WHERE officeid = ? AND requirementid IS NULL ORDER BY uploadedat DESC LIMIT 1',
        [officeid]
      );
      if (oldDocs.length > 0 && oldDocs[0].filepath) {
        const oldFilePath = path.join(__dirname, '..', oldDocs[0].filepath);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
        }
      }
      if (fs.existsSync(destPath)) {
        fs.unlinkSync(destPath);
      }
    } catch (oldFileError) {
      console.error('Error deleting old file:', oldFileError);
    }
    // Move file from temp to final location
    if (!fs.existsSync(req.file.path)) {
      return res.status(500).json({ success: false, message: 'Temp file not found' });
    }
    const { uploadToSupabaseBucket } = require('../utils/supabaseStorage');
    let filepath = `/uploads/events/${safeEventName}/${finalFileName}`;

    try {
      const supabaseRes = await uploadToSupabaseBucket(
        req.file.path, 
        `events/${safeEventName}/${safeOfficeName}/${finalFileName}`, 
        req.file.mimetype
      );
      if (supabaseRes && supabaseRes.publicUrl) {
        filepath = supabaseRes.publicUrl;
      }
    } catch (supabaseErr) {
      console.warn('Supabase cloud storage proof upload notice (falling back to local disk):', supabaseErr.message);
      try {
        fs.renameSync(req.file.path, destPath);
      } catch (renameError) {
        try {
          fs.copyFileSync(req.file.path, destPath);
          fs.unlinkSync(req.file.path);
        } catch (copyError) {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          return res.status(500).json({ success: false, message: 'Failed to save file', error: copyError.message });
        }
      }
    }

    if (fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    console.log('File path for DB/URL:', filepath);
    // Save to database
    await saveOfficeProofDocument(officeid, finalFileName, req.file.originalname, filepath);
    
    try {
      const { createNotifications, getAdminUserIds } = require('../utils/notificationService');
      const adminIds = await getAdminUserIds();
      
      // Get office heads
      const [headRows] = await db.query(
        `SELECT u.userid 
         FROM users u
         JOIN headofoffice h ON u.userid = h.userid
         JOIN officeheadassignments oha ON h.headid = oha.headid
         WHERE oha.officeid = ?`,
        [officeid]
      );
      const headUserIds = headRows.map(r => Number(r.userid));
      
      // Get auditors assigned to this office
      const [auditorRows] = await db.query(
        `SELECT aaa.auditoruserid as userid
         FROM auditorareaassignments aaa
         JOIN offices o ON o.officeid = ?
         JOIN criteria c ON c.eventid = o.eventid
         WHERE aaa.areaid = c.areaid`,
        [officeid]
      );
      const auditorUserIds = auditorRows.map(r => Number(r.userid));
      
      const allRecipientIds = [...new Set([...adminIds, ...headUserIds, ...auditorUserIds])];
      const uploaderId = Number(req.user?.userid || 0);

      await createNotifications({
        userIds: allRecipientIds.filter(id => id !== uploaderId),
        adminid: uploaderId,
        title: 'New Office Proof Uploaded',
        message: `Office proof document was uploaded for office "${officename}" under event "${eventname}".`,
        type: 'info',
        relatedtable: 'office_proof_upload',
        relatedid: Number(officeid),
        meta: {
          officeid: Number(officeid),
          openSubmission: true
        }
      });
    } catch (notifErr) {
      console.warn('Failed to notify about office proof upload:', notifErr.message);
    }

    try {
      const uploaderId = Number(req.user?.userid || req.user?.id || 0);
      if (uploaderId) {
        await recordLog(uploaderId, 'OfficeProofUploaded', {
          officeid: Number(officeid),
          officename,
          eventname,
          FileName: finalFileName,
          filename: finalFileName,
          originalname: req.file.originalname
        });
      }
    } catch (logErr) {
      console.warn('Failed to record log for office proof upload:', logErr.message);
    }

    console.log('--- Proof Upload Debug End ---');
    res.json({ 
      success: true, 
      filename: finalFileName, 
      url: filepath,
      originalname: req.file.originalname,
      officename: officename,
      eventname: eventname
    });
  } catch (err) {
    console.error('Upload error:', err);
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
    res.status(500).json({ success: false, message: 'Failed to upload document', error: err.message });
  }
    
});


// Get the latest proof document for an office (filter by requirementid IS NULL to only get proof documents, not requirement files)
router.get('/:id/proof', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM officeproofdocuments WHERE officeid = ? AND requirementid IS NULL ORDER BY uploadedat DESC LIMIT 1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: 'No proof document found' });
    }
    const doc = rows[0];
    // Use filepath from database (should be the event-based path)
    let fileUrl = doc.filepath;
    
    // Backwards compatibility: if filepath is old format or doesn't exist, try to construct it
    if (!fileUrl || fileUrl.includes('/uploads/documents/')) {
      // Try to construct from event if we can find it
      const [officeRows] = await db.query('SELECT eventid FROM offices WHERE officeid = ?', [req.params.id]);
      if (officeRows.length > 0 && officeRows[0].eventid) {
        const [eventRows] = await db.query('SELECT eventname FROM events WHERE eventid = ?', [officeRows[0].eventid]);
          if (eventRows.length > 0) {
            const safeEventName = (eventRows[0].eventcode || eventRows[0].eventname).replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 40);
          const safeOfficeName = doc.filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-]/g, '.');
          const ext = path.extname(doc.filename);
          fileUrl = `/uploads/events/${safeEventName}/offices/${safeOfficeName}/proof/${doc.filename}`;
        } else {
          fileUrl = fileUrl || `/uploads/documents/${doc.filename}`;
        }
      } else {
        fileUrl = fileUrl || `/uploads/documents/${doc.filename}`;
      }
    }
    
    res.json({
      success: true,
      filename: doc.filename,
      filepath: doc.filepath || null,
      url: fileUrl,
      uploadedat: doc.uploadedat
    });
  } catch (err) {
    console.error('Error fetching proof document:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch proof document', error: err.message });
  }
});

// Delete latest proof document for an office (admin Unsubmit)
router.delete('/:id/proof', auth, async (req, res) => {
  try {
    const officeid = req.params.id;
    // Find latest proof document (requirementid IS NULL)
    const [rows] = await db.query(
      'SELECT * FROM officeproofdocuments WHERE officeid = ? AND requirementid IS NULL ORDER BY uploadedat DESC LIMIT 1',
      [officeid]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No proof document found for this office' });
    }
    const doc = rows[0];
    // Delete file from Supabase Storage bucket and disk
    try {
      const { deleteFromSupabaseBucket } = require('../utils/supabaseStorage');
      await deleteFromSupabaseBucket(doc.filepath, 'proof-documents');

      const filepath = path.join(__dirname, '..', doc.filepath.replace(/^\//, ''));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    } catch (fsErr) {
      console.warn('Failed to delete proof file:', fsErr);
    }
    // Delete DB record by primary key id
    await db.query(
      'DELETE FROM officeproofdocuments WHERE id = ?',
      [doc.id]
    );

    try {
      const actorId = Number(req.user?.userid || req.user?.id || 0);
      if (actorId) {
        await recordLog(actorId, 'OfficeProofDeleted', {
          officeid: Number(officeid),
          FileName: doc.filename,
          filename: doc.filename
        });
      }
    } catch (logErr) {}

    res.json({ success: true, message: 'Proof document deleted' });
  } catch (err) {
    console.error('Error deleting proof document:', err);
    res.status(500).json({ success: false, message: 'Failed to delete proof document', error: err.message });
  }
});

module.exports = router;
