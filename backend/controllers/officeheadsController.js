const db = require('../db');
const multer = require('multer');
const path = require('path');
const { recordLog } = require('./logsController');
const { createNotifications } = require('../utils/notificationService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/profile-pics/') // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

exports.uploadProfilePic = upload.single('profilepic');

// Add a new office head - now requires userid since names come from users table
exports.addHead = async (req, res) => {
  try {
    const { userid, position, contactinfo } = req.body;
    
    // Validate required fields
    if (!userid || !position) {
      return res.status(400).json({
        success: false,
        message: 'User ID and position are required'
      });
    }

    // Check if user exists
    const [userCheck] = await db.execute('SELECT userid, firstname, lastname FROM users WHERE userid = ?', [userid]);
    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent duplicate office-head records for the same user
    const [existingHead] = await db.execute('SELECT headid FROM headofoffice WHERE userid = ? LIMIT 1', [userid]);
    if (existingHead.length > 0) {
      return res.status(409).json({
        success: false,
        message: `${userCheck[0].firstname} ${userCheck[0].lastname} is already an office head`
      });
    }

    // Create the SQL query to insert the new office head
    const query = `
      INSERT INTO headofoffice (
        userid,
        Position,
        contactinfo
      ) VALUES (?, ?, ?)
    `;

    const values = [
      userid,
      position.trim(),
      contactinfo ? contactinfo.trim() : null
    ];

    // Execute the query
    const [result] = await db.execute(query, values);

    // Attempt to set the user's role to Personnel (but do not downgrade Admin)
    try {
      const [roleRows] = await db.execute('SELECT roleid FROM roles WHERE rolename = ? LIMIT 1', ['Personnel']);
      const personnelRoleId = roleRows && roleRows.length > 0 ? roleRows[0].roleid : 3;
      await db.execute('UPDATE users SET roleid = ? WHERE userid = ? AND roleid != 1', [personnelRoleId, userid]);
    } catch (roleErr) {
      console.error('Failed to set Personnel role for user:', roleErr);
    }

    // Return success response with joined user data
    res.status(201).json({
      success: true,
      message: 'Office head added successfully',
      data: {
        headid: result.insertId,
        userid: userid,
        firstname: userCheck[0].firstname,
        lastname: userCheck[0].lastname,
        Position: position.trim(),
        contactinfo: contactinfo ? contactinfo.trim() : null,
        officeid: null,
        OfficeIDs: []
      }
    });

    try {
      const actorId = req.user && req.user.userid;
      if (actorId) {
        const fullName = `${userCheck[0].firstname} ${userCheck[0].lastname}`.trim();
        await recordLog(actorId, 'OfficeHeadAdded', {
          HeadName: fullName,
          Position: position.trim(),
        });

        await createNotifications({
          userIds: [Number(userid)],
          adminid: actorId,
          title: 'Added As Personnel',
          message: `You were added as office personnel with position ${position.trim()}.`,
          type: 'info',
          relatedtable: 'office_head',
          relatedid: Number(result.insertId),
        });
      }
    } catch (logErr) {
      console.error('Failed to record office head add log:', logErr);
    }

  } catch (error) {
    console.error('Error adding office head:', error);
    
    // Handle specific database errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'This user is already an office head'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error while adding office head',
      error: error.message
    });
  }
};

// Add multiple office heads at once from selected users
exports.addMultipleHeads = async (req, res) => {
  try {
    const { userIds, position } = req.body;
    
    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one user must be selected'
      });
    }

    if (!position) {
      return res.status(400).json({
        success: false,
        message: 'Position is required'
      });
    }

    const addedHeads = [];
    const errors = [];

    for (const userid of userIds) {
      try {
        // Check if user exists
        const [userCheck] = await db.execute('SELECT userid, firstname, lastname, Email FROM users WHERE userid = ?', [userid]);
        if (userCheck.length === 0) {
          errors.push({ userid, error: 'User not found' });
          continue;
        }

        // Check if user is already an office head
        const [existingHead] = await db.execute('SELECT headid FROM headofoffice WHERE userid = ?', [userid]);
        if (existingHead.length > 0) {
          errors.push({ userid, error: `${userCheck[0].firstname} ${userCheck[0].lastname} is already an office head` });
          continue;
        }

        // Insert new office head
        const query = `
          INSERT INTO headofoffice (userid, Position, contactinfo)
          VALUES (?, ?, ?)
        `;
        const values = [userid, position.trim(), userCheck[0].Email || null];
        const [result] = await db.execute(query, values);

        // Attempt to set the user's role to Personnel (but do not downgrade Admin)
        try {
          const [roleRows] = await db.execute('SELECT roleid FROM roles WHERE rolename = ? LIMIT 1', ['Personnel']);
          const personnelRoleId = roleRows && roleRows.length > 0 ? roleRows[0].roleid : 3;
          await db.execute('UPDATE users SET roleid = ? WHERE userid = ? AND roleid != 1', [personnelRoleId, userid]);
        } catch (roleErr) {
          console.error(`Failed to set Personnel role for user ${userid}:`, roleErr);
        }

        addedHeads.push({
          headid: result.insertId,
          userid: userid,
          firstname: userCheck[0].firstname,
          lastname: userCheck[0].lastname,
          Position: position.trim()
        });
      } catch (err) {
        errors.push({ userid, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      message: `Successfully added ${addedHeads.length} office head(s)`,
      data: addedHeads,
      errors: errors.length > 0 ? errors : undefined
    });

    try {
      const actorId = req.user && req.user.userid;
      if (actorId && addedHeads.length > 0) {
        await recordLog(actorId, 'OfficeHeadAdded', {
          HeadNames: addedHeads.map((head) => `${head.firstname} ${head.lastname}`.trim()),
          Position: position.trim(),
          AddedCount: addedHeads.length,
        });

        await createNotifications({
          userIds: addedHeads.map((head) => Number(head.userid)),
          adminid: actorId,
          title: 'Added As Personnel',
          message: `You were added as office personnel with position ${position.trim()}.`,
          type: 'info',
          relatedtable: 'office_head',
          relatedid: null,
        });
      }
    } catch (logErr) {
      console.error('Failed to record multiple office heads add log:', logErr);
    }

  } catch (error) {
    console.error('Error adding multiple office heads:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding office heads',
      error: error.message
    });
  }
};

// Get all office heads with user information from users table
exports.getAllHeads = async (req, res) => {
  try {
    // Auto-sync approved Personnel (roleid 3) into headofoffice if missing
    try {
      await db.execute(`
        INSERT INTO headofoffice (userid, Position)
        SELECT u.userid, 'Personnel'
        FROM users u
        WHERE u.roleid = 3 
          AND (u.approvalstatus = 'approved' OR u.approvalstatus IS NULL)
          AND NOT EXISTS (SELECT 1 FROM headofoffice h WHERE h.userid = u.userid)
      `);
    } catch (syncErr) {
      console.warn('Auto-sync headofoffice warning:', syncErr.message);
    }

    const query = `
      SELECT 
        h.headid,
        h.userid,
        u.firstname,
        u.middleinitial,
        u.lastname,
        u.Email,
        h.Position,
        h.contactinfo,
        u.profilepic,
        MIN(oha.officeid) AS officeid,
        string_agg(DISTINCT oha.officeid::text, ',' ORDER BY oha.officeid::text) AS OfficeIDs
      FROM headofoffice h
      LEFT JOIN users u ON h.userid = u.userid
      LEFT JOIN officeheadassignments oha ON oha.headid = h.headid
      GROUP BY h.headid, h.userid, u.firstname, u.middleinitial, u.lastname, u.Email, h.Position, h.contactinfo, u.profilepic
      ORDER BY u.lastname, u.firstname
    `;

    const [rows] = await db.execute(query);
    const normalizedRows = rows.map((row) => ({
      ...row,
      officeid: row.officeid || null,
      OfficeIDs: row.OfficeIDs ? String(row.OfficeIDs).split(',').map((id) => Number(id)).filter((id) => Number.isInteger(id)) : []
    }));
    console.log('DEBUG: getAllHeads DB rows count:', rows.length);

    res.status(200).json({
      success: true,
      data: normalizedRows
    });

  } catch (error) {
    console.error('Error fetching office heads:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching office heads',
      error: error.message
    });
  }
};

// Get office head by ID
exports.getHeadById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        h.headid,
        h.userid,
        u.firstname,
        u.middleinitial,
        u.lastname,
        u.Email,
        h.Position,
        h.contactinfo,
        u.profilepic,
        MIN(oha.officeid) AS officeid,
        string_agg(DISTINCT oha.officeid::text, ',' ORDER BY oha.officeid::text) AS OfficeIDs
      FROM headofoffice h
      LEFT JOIN users u ON h.userid = u.userid
      LEFT JOIN officeheadassignments oha ON oha.headid = h.headid
      WHERE h.headid = ?
      GROUP BY h.headid, h.userid, u.firstname, u.middleinitial, u.lastname, u.Email, h.Position, h.contactinfo, u.profilepic
    `;

    const [rows] = await db.execute(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Office head not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        ...rows[0],
        officeid: rows[0].officeid || null,
        OfficeIDs: rows[0].OfficeIDs ? String(rows[0].OfficeIDs).split(',').map((officeid) => Number(officeid)).filter((officeid) => Number.isInteger(officeid)) : []
      }
    });

  } catch (error) {
    console.error('Error fetching office head:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching office head'
    });
  }
};

// Update office head + linked user profile fields
exports.updateHead = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, middleinitial, lastname, Position, contactinfo } = req.body;

    const [rows] = await db.execute(
      `SELECT h.headid, h.userid, h.Position, h.contactinfo,
              u.firstname, u.middleinitial, u.lastname, u.profilepic
       FROM headofoffice h
       LEFT JOIN users u ON h.userid = u.userid
       WHERE h.headid = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Office head not found'
      });
    }

    const current = rows[0];

    const trimmedFirst = typeof firstname === 'string' ? firstname.trim() : '';
    const trimmedLast = typeof lastname === 'string' ? lastname.trim() : '';
    const trimmedPosition = typeof Position === 'string' ? Position.trim() : '';

    const nextFirstName = trimmedFirst || (current.firstname || '').trim();
    const nextLastName = trimmedLast || (current.lastname || '').trim();
    const nextMiddleInitialRaw = middleinitial !== undefined
      ? String(middleinitial || '').trim()
      : String(current.middleinitial || '').trim();
    const nextMiddleInitial = nextMiddleInitialRaw ? nextMiddleInitialRaw.charAt(0) : null;
    const nextPosition = trimmedPosition || (current.Position || '').trim();
    const nextContactInfoRaw = contactinfo !== undefined
      ? String(contactinfo ?? '').trim()
      : String(current.contactinfo ?? '').trim();
    const nextContactInfo = nextContactInfoRaw || null;
    const nextProfilePic = req.file ? req.file.filename : current.profilepic;

    if (req.file) {
      try {
        const { uploadToSupabaseBucket } = require('../utils/supabaseStorage');
        await uploadToSupabaseBucket(req.file.path, req.file.filename, req.file.mimetype, 'profile-pics');
      } catch (sbErr) {
        console.warn('Failed to upload head profile pic to Supabase:', sbErr.message);
      }
    }

    // Delete old profile picture if it was replaced
    if (current.profilepic && current.profilepic !== nextProfilePic) {
      try {
        const { deleteProfilePicFile } = require('../utils/supabaseStorage');
        await deleteProfilePicFile(current.profilepic);
      } catch (delErr) {
        console.warn('Old head profile pic delete warning:', delErr.message);
      }
    }

    if (!nextFirstName || !nextLastName || !nextPosition) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and position are required'
      });
    }

    if (current.userid) {
      await db.execute(
        `UPDATE users
         SET firstname = ?, middleinitial = ?, lastname = ?, profilepic = ?
         WHERE userid = ?`,
        [nextFirstName, nextMiddleInitial, nextLastName, nextProfilePic, current.userid]
      );
    }

    await db.execute(
      `UPDATE headofoffice
       SET Position = ?, contactinfo = ?
       WHERE headid = ?`,
      [nextPosition, nextContactInfo, id]
    );

    res.status(200).json({
      success: true,
      message: 'Office personnel updated successfully',
      data: {
        headid: Number(id),
        userid: current.userid,
        firstname: nextFirstName,
        middleinitial: nextMiddleInitial,
        lastname: nextLastName,
        Position: nextPosition,
        contactinfo: nextContactInfo,
        profilepic: nextProfilePic,
      }
    });

    try {
      const actorId = req.user && req.user.userid;
      if (actorId) {
        const previousFullName = `${current.firstname || ''} ${current.lastname || ''}`.replace(/\s+/g, ' ').trim();
        const nextFullName = `${nextFirstName} ${nextLastName}`.replace(/\s+/g, ' ').trim();
        const changes = {};

        if ((current.firstname || '') !== nextFirstName || (current.lastname || '') !== nextLastName || (current.middleinitial || '') !== (nextMiddleInitial || '')) {
          changes.Name = { from: previousFullName || 'Unknown', to: nextFullName || 'Unknown' };
        }
        if ((current.Position || '') !== nextPosition) {
          changes.Position = { from: current.Position || 'N/A', to: nextPosition };
        }
        if ((current.contactinfo || '') !== (nextContactInfo || '')) {
          changes.contactinfo = { from: current.contactinfo || 'N/A', to: nextContactInfo || 'N/A' };
        }
        if (req.file) {
          changes.profilepic = 'Updated';
        }

        await recordLog(actorId, 'OfficeHeadUpdated', {
          HeadName: nextFullName || `Head #${id}`,
          changes,
        });
      }

      // Notify the personnel if their position was changed
      if ((current.Position || '') !== nextPosition && current.userid) {
        await createNotifications({
          userIds: [Number(current.userid)],
          adminid: actorId || null,
          title: 'Position Updated',
          message: `Your position has been updated from "${current.Position || 'N/A'}" to "${nextPosition}".`,
          type: 'info',
          relatedtable: 'office_head',
          relatedid: Number(id),
          meta: {
            headid: Number(id),
            previousPosition: current.Position || null,
            newPosition: nextPosition,
          },
        });
      }
    } catch (logErr) {
      console.error('Failed to record office head update log or notification:', logErr);
    }
  } catch (error) {
    console.error('Error updating office head:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating office head',
      error: error.message
    });
  }
};

// Delete office heads
exports.deleteHeads = async (req, res) => {
  try {
    console.log('Delete request received');
    console.log('Request body:', req.body);
    console.log('Request query:', req.query);
    
    // Handle both body data and query parameters
    let headIds = req.body?.headIds || req.query?.ids;
    
    // If query parameter, convert to array if it's a single value
    if (typeof headIds === 'string') {
      headIds = [headIds];
    }
    
    console.log('Processed headIds:', headIds);

    // Validate input
    if (!headIds || !Array.isArray(headIds) || headIds.length === 0) {
      console.log('Validation failed: Invalid headIds');
      return res.status(400).json({
        success: false,
        message: 'Head IDs array is required'
      });
    }

    // Validate all IDs are numbers
    const validIds = headIds.filter(id => Number.isInteger(Number(id)));
    if (validIds.length !== headIds.length) {
      console.log('Validation failed: Invalid ID format');
      return res.status(400).json({
        success: false,
        message: 'All head IDs must be valid integers'
      });
    }

    // Collect names and user IDs before deletion for readable audit logs and cascading cleanup
    const placeholders = validIds.map(() => '?').join(',');
    const [headsToDelete] = await db.execute(
      `SELECT h.headid, h.userid, u.firstname, u.lastname, u.Email, u.profilepic, u.roleid
       FROM headofoffice h
       LEFT JOIN users u ON h.userid = u.userid
       WHERE h.headid IN (${placeholders})`,
      validIds
    );

    if (!headsToDelete || headsToDelete.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No office heads found with the provided IDs'
      });
    }

    const userIds = headsToDelete.map(r => r.userid).filter(id => Number.isInteger(Number(id)) && id > 0);

    // 1. Remove office head assignments
    try {
      await db.execute(`DELETE FROM officeheadassignments WHERE headid IN (${placeholders})`, validIds);
    } catch (e) {
      console.warn('Cleanup officeheadassignments warning:', e.message);
    }

    // 2. Remove requirement user assignments
    if (userIds.length > 0) {
      const userPlaceholders = userIds.map(() => '?').join(',');
      try {
        await db.execute(`DELETE FROM requirementuserassignments WHERE userid IN (${userPlaceholders})`, userIds);
      } catch (e) {
        console.warn('Cleanup requirementuserassignments warning:', e.message);
      }

      // 3. Remove notifications
      try {
        await db.execute(`DELETE FROM notifications WHERE userid IN (${userPlaceholders})`, userIds);
      } catch (e) {
        console.warn('Cleanup notifications warning:', e.message);
      }
    }

    // 4. Delete from headofoffice
    const [result] = await db.execute(`DELETE FROM headofoffice WHERE headid IN (${placeholders})`, validIds);

    // 5. Delete corresponding non-admin user accounts from users table so they don't resurrect
    if (userIds.length > 0) {
      try {
        const { deleteProfilePicFile } = require('../utils/supabaseStorage');
        for (const h of headsToDelete) {
          if (Number(h.roleid) !== 1 && h.profilepic) {
            await deleteProfilePicFile(h.profilepic).catch(() => {});
          }
        }
      } catch (picErr) {
        console.warn('Cleanup head profile pics warning:', picErr.message);
      }

      const userPlaceholders = userIds.map(() => '?').join(',');
      try {
        await db.execute(`DELETE FROM users WHERE userid IN (${userPlaceholders}) AND roleid != 1`, userIds);
      } catch (e) {
        console.warn('Cleanup users table warning:', e.message);
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${result.affectedRows || headsToDelete.length} office personnel`,
      deletedCount: result.affectedRows || headsToDelete.length
    });

    try {
      const actorId = req.user && req.user.userid;
      if (actorId && result.affectedRows > 0) {
        await recordLog(actorId, 'OfficeHeadDeleted', {
          HeadNames: headsToDelete.map((row) => `${row.firstname || ''} ${row.lastname || ''}`.replace(/\s+/g, ' ').trim() || `Head #${row.headid}`),
          DeletedCount: result.affectedRows,
        });
      }
    } catch (logErr) {
      console.error('Failed to record office heads delete log:', logErr);
    }

  } catch (error) {
    console.error('Error deleting office heads:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting office heads'
    });
  }
};


