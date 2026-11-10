const db = require('../db');
const { recordLog } = require('./logsController');
const { createNotifications } = require('../utils/notificationService');
const fs = require('fs');
const path = require('path');

const isUnknownColumnError = (error) =>
  error?.code === 'ER_BAD_FIELD_ERROR' || error?.errno === 1054;

const executeWithFallbacks = async (attempts) => {
  let lastError;
  for (const attempt of attempts) {
    try {
      return await db.query(attempt.sql, attempt.params);
    } catch (error) {
      lastError = error;
      if (!isUnknownColumnError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
};

const resolveParentRequirement = async (parentValue) => {
  if (!parentValue) {
    return { parentCode: null, parentId: null };
  }

  const raw = String(parentValue).trim();
  if (!raw) {
    return { parentCode: null, parentId: null };
  }

  // Accept either parent code or parent requirement ID for compatibility.
  if (/^\d+$/.test(raw)) {
    const parentId = Number(raw);
    const [rows] = await db.query(
      'SELECT requirementid, requirementcode FROM requirements WHERE requirementid = ? LIMIT 1',
      [parentId]
    );
    if (rows.length === 0) {
      throw new Error('Selected parent requirement was not found');
    }
    return { parentCode: rows[0].requirementcode, parentId: rows[0].requirementid };
  }

  const [rows] = await db.query(
    'SELECT requirementid, requirementcode FROM requirements WHERE requirementcode = ? LIMIT 1',
    [raw]
  );
  if (rows.length === 0) {
    throw new Error('Selected parent requirement was not found');
  }

  return { parentCode: rows[0].requirementcode, parentId: rows[0].requirementid };
};

// Get all requirements
const getAllRequirements = async (req, res) => {
  try {
    const { eventid, officeid, officeId } = req.query;
    const targetOfficeId = officeid || officeId ? Number(officeid || officeId) : null;
    const roleid = Number(req.user?.roleid || 0);
    const userid = Number(req.user?.userid || 0);

    const csoStatusSubquery = targetOfficeId
      ? `(SELECT cso.status FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid AND cso.officeid = ${targetOfficeId} ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1)`
      : `(SELECT cso.status FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1)`;

    const csoCommentSubquery = targetOfficeId
      ? `(SELECT cso.comments FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid AND cso.officeid = ${targetOfficeId} ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1)`
      : `(SELECT cso.comments FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1)`;
    
    let query = `
      SELECT 
        r.*, 
        c.criterianame, 
        c.criteriacode,
        c.parentcriteriaid,
        pc.criterianame AS ParentCriteriaName,
        pc.criteriacode AS ParentCriteriaCode,
        COALESCE(c.areaid, pc.areaid) AS areaid,
        a.areacode,
        a.areaname,
        a.sortorder AS AreaSortOrder,
        COALESCE(c.eventid, pc.eventid, e.eventid) AS eventid,
        COALESCE(e.eventname, pe.eventname) AS eventname,
        COALESCE(e.eventcode, pe.eventcode) AS eventcode,
        ${csoStatusSubquery} AS compliancestatusid,
        ${csoStatusSubquery} AS "ComplianceStatusID",
        ${csoCommentSubquery} AS comment
      FROM requirements r
      LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
      LEFT JOIN criteria pc ON c.parentcriteriaid = pc.criteriaid
      LEFT JOIN areas a ON COALESCE(c.areaid, pc.areaid) = a.areaid
      LEFT JOIN Events e ON c.eventid = e.eventid
      LEFT JOIN Events pe ON pc.eventid = pe.eventid
    `;
    
    const params = [];
    const whereConditions = [];
    
    // Filter by event if eventid is provided
    if (eventid) {
      whereConditions.push(`(c.eventid = ? OR pc.eventid = ?)`);
      params.push(eventid, eventid);
    }

    if (roleid === 4) {
      whereConditions.push(`COALESCE(c.areaid, pc.areaid) IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)`);
      params.push(userid);
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ` + whereConditions.join(' AND ');
    }
    
    query += ` ORDER BY a.sortorder ASC, c.criteriacode ASC, r.requirementcode ASC`;
    
    const [requirements] = await db.query(query, params);
    const formatted = (requirements || []).map(r => {
      const sId = Number(r.ComplianceStatusID ?? r.compliancestatusid ?? 3);
      return {
        ...r,
        description: r.description ?? r.Description ?? '',
        Description: r.description ?? r.Description ?? '',
        compliancestatusid: sId,
        ComplianceStatusID: sId,
        ComplianceStatus: sId === 5 ? 'Complied' : (sId === 4 ? 'Partially Complied' : 'Not Complied'),
        comment: r.comment || '',
      };
    });
    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching requirements'
    });
  }
};

// Add new requirement
const addRequirement = async (req, res) => {
  try {
    let { requirementcode, criteriaid, parentrequirementcode, parentrequirementid } = req.body;
    const description = req.body.description ?? req.body.Description ?? null;

    // Validate required fields
    if (!description || !criteriaid) {
      return res.status(400).json({
        success: false,
        message: 'Description and sub area are required'
      });
    }

    criteriaid = Number(criteriaid);
    if (!Number.isInteger(criteriaid) || criteriaid <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sub area selected'
      });
    }

    const [criteria] = await db.query(
      `SELECT c.criteriacode, c.criterianame, c.eventid, e.eventname
       FROM criteria c
       LEFT JOIN Events e ON c.eventid = e.eventid
       WHERE c.criteriaid = ?
       LIMIT 1`,
      [criteriaid]
    );

    if (criteria.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sub area selected'
      });
    }

    const criteriaRow = criteria[0];
    const criteriacode = criteriaRow.criteriacode;
    const { parentCode, parentId } = await resolveParentRequirement(parentrequirementcode || parentrequirementid);

    // Server-side generation with retry-on-duplicate to reduce race conditions.
    const maxAttempts = 6;
    let inserted = null;

    // Use db directly as postgres manages connection pooling automatically
    const conn = db;
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let candidateCode = requirementcode && String(requirementcode).trim();

        if (parentCode) {
          // If no code provided or user provided a plain number, build from parent
          if (!candidateCode) {
            const [children] = await conn.query(
              'SELECT requirementcode FROM requirements WHERE criteriaid = ? AND requirementcode LIKE ? ORDER BY LENGTH(requirementcode) DESC, requirementcode DESC LIMIT 1',
              [criteriaid, `${parentCode}.%`]
            );
            if (children.length > 0) {
              const lastChild = children[0].requirementcode;
              const parts = lastChild.split('.');
              const lastNumber = parseInt(parts[parts.length - 1]) || 0;
              candidateCode = `${parentCode}.${lastNumber + 1}`;
            } else {
              candidateCode = `${parentCode}.1`;
            }
          } else if (!/\./.test(candidateCode)) {
            candidateCode = `${parentCode}.${candidateCode}`;
          }
        } else {
          // top-level under criteria
          if (!candidateCode) {
            // compute next under criteriacode
            const [siblings] = await conn.query(
              'SELECT requirementcode FROM requirements WHERE criteriaid = ? AND requirementcode LIKE ? ORDER BY LENGTH(requirementcode) DESC, requirementcode DESC LIMIT 1',
              [criteriaid, `${criteriacode}.%`]
            );
            if (siblings.length > 0) {
              const last = siblings[0].requirementcode;
              const parts = last.split('.');
              const lastNumber = parseInt(parts[parts.length - 1]) || 0;
              candidateCode = `${criteriacode}.${lastNumber + 1}`;
            } else {
              candidateCode = `${criteriacode}.1`;
            }
          } else if (!/\./.test(candidateCode)) {
            candidateCode = `${criteriacode}.${candidateCode}`;
          }
        }

        // Try insert
        try {
          // Try multiple INSERT variants to support older schemas that may
          // not have the parentrequirementid column. If the DB throws an
          // unknown-column error, fall back to the next variant.
          const insertAttempts = [
            {
              sql: 'INSERT INTO requirements (requirementcode, description, criteriaid, parentrequirementcode, parentrequirementid, createdat, updatedat) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
              params: [candidateCode, description, criteriaid, parentCode || null, parentId || null]
            },
            {
              sql: 'INSERT INTO requirements (requirementcode, description, criteriaid, parentrequirementcode, createdat, updatedat) VALUES (?, ?, ?, ?, NOW(), NOW())',
              params: [candidateCode, description, criteriaid, parentCode || null]
            },
            {
              sql: 'INSERT INTO requirements (requirementcode, description, criteriaid, createdat, updatedat) VALUES (?, ?, ?, NOW(), NOW())',
              params: [candidateCode, description, criteriaid]
            }
          ];

          let insertResult = null;
          for (const attemptSql of insertAttempts) {
            try {
              const [result] = await conn.query(attemptSql.sql, attemptSql.params);
              insertResult = result;
              break;
            } catch (err) {
              // If the DB doesn't have the column, try the next variant
              if (isUnknownColumnError(err)) {
                continue;
              }
              // If duplicate key, let outer loop handle retry
              if (err && err.code === 'ER_DUP_ENTRY') {
                throw err; // will be handled by outer catch and retry
              }
              throw err;
            }
          }

          if (!insertResult) {
            // All insert attempts failed due to missing columns; throw a descriptive error
            throw new Error('Failed to insert requirement: incompatible database schema (missing columns)');
          }

          inserted = {
            requirementid: insertResult.insertId,
            requirementcode: candidateCode,
            description,
            Description: description,
            criteriaid,
            parentrequirementcode: parentCode,
            parentrequirementid: parentId
          };
          break;
        } catch (err) {
          // If duplicate key, retry (recompute next code)
          if (err && err.code === 'ER_DUP_ENTRY') {
            // continue to retry
            if (attempt === maxAttempts - 1) {
              throw err;
            }
            // small loop to retry
            continue;
          }
          throw err;
        }
      }
    } finally {
      if (conn && typeof conn.release === 'function') conn.release();
    }

    if (!inserted) {
      return res.status(500).json({ success: false, message: 'Failed to add requirement after retries' });
    }

    res.json({
      success: true,
      message: 'Requirement added successfully',
      data: inserted
    });
    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'RequirementAdded', {
          requirementid: inserted.requirementid,
          requirementcode: inserted.requirementcode,
          criteriaid: inserted.criteriaid,
          criteriacode: criteriaRow.criteriacode || null,
          criterianame: criteriaRow.criterianame || null,
          eventid: criteriaRow.eventid || null,
          eventname: criteriaRow.eventname || null
        });
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error adding requirement:', error);
    if (error.sql) {
      console.error('SQL:', error.sql);
      console.error('SQL Params:', error.parameters || error.values || 'N/A');
    }

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Requirement code already exists'
      });
    }

    if (error.message === 'Selected parent requirement was not found') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error adding requirement',
      error: error.message,
      sql: error.sql || undefined,
      sqlParams: error.parameters || error.values || undefined
    });
  }
};

// Get requirements by event (through criteria)
const getRequirementsByEvent = async (req, res) => {
  try {
    const { eventid } = req.params;
    const roleid = Number(req.user?.roleid || 0);
    const userid = Number(req.user?.userid || 0);

    let auditorFilter = '';
    const params = [eventid];

    if (roleid === 4) {
      auditorFilter = ' AND c.areaid IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)';
      params.push(userid);
    }
    
    const [requirements] = await db.query(`
      SELECT 
        r.*, 
        c.criterianame, 
        c.criteriacode,
        e.eventname,
        e.eventcode,
        (SELECT cso.status FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1) AS compliancestatusid,
        (SELECT cso.status FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1) AS "ComplianceStatusID",
        (SELECT cso.comments FROM compliancestatusoffices cso WHERE cso.requirementid = r.requirementid ORDER BY cso.lastupdated DESC NULLS LAST LIMIT 1) AS comment
      FROM requirements r
      LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
      LEFT JOIN Events e ON c.eventid = e.eventid
      WHERE c.eventid = ? ${auditorFilter}
      ORDER BY r.requirementcode ASC
    `, params);
    
    const formatted = (requirements || []).map(r => {
      const sId = Number(r.ComplianceStatusID ?? r.compliancestatusid ?? 3);
      return {
        ...r,
        description: r.description ?? r.Description ?? '',
        Description: r.description ?? r.Description ?? '',
        compliancestatusid: sId,
        ComplianceStatusID: sId,
        ComplianceStatus: sId === 5 ? 'Complied' : (sId === 4 ? 'Partially Complied' : 'Not Complied'),
        comment: r.comment || '',
      };
    });

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching requirements'
    });
  }
};

// Get requirements by criteria
const getRequirementsByCriteria = async (req, res) => {
  try {
    const { criteriaid } = req.params;
    const roleid = Number(req.user?.roleid || 0);
    const userid = Number(req.user?.userid || 0);

    let auditorFilter = '';
    const params = [criteriaid];

    if (roleid === 4) {
      auditorFilter = ' AND c.areaid IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)';
      params.push(userid);
    }

    const [requirements] = await db.query(`
      SELECT 
        r.*, 
        c.criterianame, 
        c.criteriacode,
        c.eventid,
        e.eventname,
        e.eventcode
      FROM requirements r
      LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
      LEFT JOIN Events e ON c.eventid = e.eventid
      WHERE r.criteriaid = ? ${auditorFilter}
      ORDER BY r.requirementcode ASC
    `, params);

    const formatted = (requirements || []).map(r => ({
      ...r,
      description: r.description ?? r.Description ?? '',
      Description: r.description ?? r.Description ?? ''
    }));

    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching requirements by criteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching requirements by criteria'
    });
  }
};

// Get all events
const getAllEvents = async (req, res) => {
  try {
    const [events] = await db.query('SELECT * FROM Events ORDER BY createdat DESC');
    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching events'
    });
  }
};

// Add new event
const addEvent = async (req, res) => {
  try {
    const { eventname, eventcode, Description } = req.body;

    // Validate required fields
    if (!eventname || !eventcode) {
      return res.status(400).json({
        success: false,
        message: 'Event name and code are required'
      });
    }

    // Insert new event
    const [result] = await db.query(
      'INSERT INTO Events (eventname, eventcode, Description, createdat, updatedat) VALUES (?, ?, ?, NOW(), NOW())',
      [eventname, eventcode, Description || null]
    );

    res.json({
      success: true,
      message: 'Event added successfully',
      data: {
        eventid: result.insertId,
        eventname,
        eventcode,
        Description
      }
    });
  } catch (error) {
    console.error('Error adding event:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding event'
    });
  }
};

// Delete multiple events
const deleteEvents = async (req, res) => {
  try {
    const { eventIds } = req.body;

    if (!eventIds || !Array.isArray(eventIds) || eventIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Event IDs are required'
      });
    }

    // Delete events
    const placeholders = eventIds.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM Events WHERE eventid IN (${placeholders})`,
      eventIds
    );

    res.json({
      success: true,
      message: `${result.affectedRows} event(s) deleted successfully`,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting events:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting events'
    });
  }
};

// Update event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { eventname, eventcode, Description } = req.body;

    // Validate required fields
    if (!eventname || !eventcode) {
      return res.status(400).json({
        success: false,
        message: 'Event name and code are required'
      });
    }

    // Update event
    const [result] = await db.query(
      'UPDATE Events SET eventname = ?, eventcode = ?, Description = ?, updatedat = NOW() WHERE eventid = ?',
      [eventname, eventcode, Description || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: {
        eventid: parseInt(id),
        eventname,
        eventcode,
        Description
      }
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating event'
    });
  }
};

// Update requirement
const updateRequirement = async (req, res) => {
  try {
    const { id } = req.params;
    let { requirementcode, criteriaid, parentrequirementcode, parentrequirementid } = req.body;
    const description = req.body.description ?? req.body.Description ?? null;

    const [existingRows] = await db.query(
      `SELECT requirementid, requirementcode, description, criteriaid, parentrequirementcode, parentrequirementid
       FROM requirements
       WHERE requirementid = ?
       LIMIT 1`,
      [id]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found'
      });
    }

    const existing = existingRows[0];

    // Validate required fields
    if (!description || !criteriaid) {
      return res.status(400).json({
        success: false,
        message: 'Description and sub area are required'
      });
    }

    criteriaid = Number(criteriaid);
    if (!Number.isInteger(criteriaid) || criteriaid <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sub area selected'
      });
    }

    const [criteria] = await db.query(
      `SELECT c.criteriacode, c.criterianame, c.eventid, e.eventname
       FROM criteria c
       LEFT JOIN Events e ON c.eventid = e.eventid
       WHERE c.criteriaid = ?
       LIMIT 1`,
      [criteriaid]
    );

    if (criteria.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sub area selected'
      });
    }

    const criteriaRow = criteria[0];
    const criteriacode = criteriaRow.criteriacode;
    const { parentCode, parentId } = await resolveParentRequirement(parentrequirementcode || parentrequirementid);

    // Auto-generate requirementcode if parent is selected (same logic as add)
    if (parentCode) {
      if (!requirementcode || requirementcode.trim() === '') {
        // No code provided - auto-generate next number
        const [children] = await db.query(
          'SELECT requirementcode FROM requirements WHERE requirementcode LIKE ? AND requirementid <> ? ORDER BY LENGTH(requirementcode) DESC, requirementcode DESC LIMIT 1',
          [`${parentCode}.%`, id]
        );

        if (children.length > 0) {
          const lastChild = children[0].requirementcode;
          const parts = lastChild.split('.');
          const lastNumber = parseInt(parts[parts.length - 1]) || 0;
          requirementcode = `${parentCode}.${lastNumber + 1}`;
        } else {
          requirementcode = `${parentCode}.1`;
        }
      } else if (!/\./.test(requirementcode)) {
        // Code provided but it's just a number (no dot) - append to parent
        requirementcode = `${parentCode}.${requirementcode}`;
      }
      // If requirementcode already has dots, use it as-is
    } else {
      // No parent requirement - join with criteria code
      if (!requirementcode || requirementcode.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Requirement code is required'
        });
      }

      // If user enters just a number, join with criteria code
      if (!/\./.test(requirementcode)) {
        requirementcode = `${criteriacode}.${requirementcode}`;
      }
      // If requirementcode already has dots, use it as-is
    }

    const updateAttempts = [
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ?, parentrequirementcode = ?, updatedat = NOW() WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, parentCode, id]
      },
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ?, parentrequirementcode = ? WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, parentCode, id]
      },
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ?, parentrequirementid = ?, updatedat = NOW() WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, parentId, id]
      },
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ?, parentrequirementid = ? WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, parentId, id]
      },
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ?, updatedat = NOW() WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, id]
      },
      {
        sql: 'UPDATE requirements SET requirementcode = ?, description = ?, criteriaid = ? WHERE requirementid = ?',
        params: [requirementcode, description, criteriaid, id]
      }
    ];

    const [result] = await executeWithFallbacks(updateAttempts);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Requirement not found'
      });
    }

    res.json({
      success: true,
      message: 'Requirement updated successfully',
      data: {
        requirementid: parseInt(id),
        requirementcode,
        description,
        Description: description,
        criteriaid,
        parentrequirementcode: parentCode,
        parentrequirementid: parentId
      }
    });
    if (req.user && req.user.userid) {
      const changes = {};
      const addChange = (field, beforeValue, afterValue) => {
        const beforeNorm = beforeValue === undefined ? null : beforeValue;
        const afterNorm = afterValue === undefined ? null : afterValue;
        if (String(beforeNorm ?? '') !== String(afterNorm ?? '')) {
          changes[field] = { from: beforeNorm, to: afterNorm };
        }
      };

      addChange('requirementcode', existing.requirementcode, requirementcode);
      addChange('Description', existing.Description, Description);
      addChange('criteriaid', existing.criteriaid, criteriaid);
      addChange('parentrequirementcode', existing.parentrequirementcode, parentCode || null);
      addChange('parentrequirementid', existing.parentrequirementid, parentId || null);

      try {
        recordLog(req.user.userid, 'RequirementUpdated', {
          requirementid: Number(id),
          requirementcode,
          criteriaid,
          criteriacode: criteriaRow.criteriacode || null,
          criterianame: criteriaRow.criterianame || null,
          eventid: criteriaRow.eventid || null,
          eventname: criteriaRow.eventname || null,
          changes
        });
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error updating requirement:', error);

    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Requirement code already exists'
      });
    }

    if (error.message === 'Selected parent requirement was not found') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating requirement',
      error: error.message
    });
  }
};

// Delete requirements
const deleteRequirements = async (req, res) => {
  try {
    const { requirementIds } = req.body;

    if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid requirement IDs provided'
      });
    }

    // Before deleting requirements, remove any uploaded proof documents (files + DB rows)
    try {
      const placeholders = requirementIds.map(() => '?').join(',');
      const [files] = await db.query(
        `SELECT id, filepath FROM officeproofdocuments WHERE requirementid IN (${placeholders})`,
        requirementIds
      );
      if (files && files.length > 0) {
        for (const f of files) {
          try {
            const absPath = path.join(__dirname, '..', (f.filepath || '').replace(/^\//, ''));
            if (fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          } catch (fsErr) {
            console.warn('Failed to delete requirement proof file from disk during requirement removal:', fsErr);
          }
        }
        // remove DB records
        await db.query(`DELETE FROM officeproofdocuments WHERE requirementid IN (${placeholders})`, requirementIds);
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup officeproofdocuments before deleting requirements:', cleanupErr);
    }

    // Capture requirement details before deletion for verbose logging
    let deletedRequirements = [];
    try {
      const placeholders2 = requirementIds.map(() => '?').join(',');
      const [reqRows] = await db.query(
        `SELECT r.requirementid, r.requirementcode, r.Description, c.criteriacode, c.criterianame, e.eventname
         FROM requirements r
         LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
         LEFT JOIN Events e ON c.eventid = e.eventid
         WHERE r.requirementid IN (${placeholders2})`,
        requirementIds
      );
      deletedRequirements = reqRows.map(r => ({
        requirementcode: r.requirementcode,
        Description: r.Description,
        criteriacode: r.criteriacode,
        criterianame: r.criterianame,
        eventname: r.eventname,
      }));
    } catch (e) { console.warn('Could not fetch requirement details before deletion:', e.message); }

    // Delete requirements
    const placeholders = requirementIds.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM requirements WHERE requirementid IN (${placeholders})`,
      requirementIds
    );

    res.json({
      success: true,
      message: `Successfully deleted ${result.affectedRows} requirement(s)`,
      deletedCount: result.affectedRows
    });
    if (req.user && req.user.userid) {
      try { recordLog(req.user.userid, 'RequirementDeleted', { requirementIds, deletedRequirements, deletedCount: result.affectedRows }); } catch (e) {}
    }
  } catch (error) {
    console.error('Error deleting requirements:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting requirements'
    });
  }
};

// ========================
// REQUIREMENT USER ASSIGNMENTS
// ========================

// Assign users to a requirement (max 4 users per requirement)
const assignUsersToRequirement = async (req, res) => {
  try {
    const { requirementid, officeid, userIds, assignedby } = req.body;
    const actorUserId = req.user?.userid || Number(assignedby) || null;

    if (!requirementid || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({
        success: false,
        message: 'requirementid and userIds array are required'
      });
    }

    if (userIds.length > 4) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 4 users can be assigned to a requirement'
      });
    }

    // Check how many users are already assigned to this requirement in this office
    const existingQuery = 'SELECT COUNT(*) as count FROM requirementuserassignments WHERE requirementid = ? AND officeid = ?';
    const existingParams = [requirementid, officeid];

    const [existingCount] = await db.query(existingQuery, existingParams);

    // Calculate how many more can be added
    const currentCount = existingCount[0].count;
    const remainingSlots = 4 - currentCount;

    if (remainingSlots <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This requirement already has 4 users assigned in this office (maximum reached)'
      });
    }

    if (userIds.length > remainingSlots) {
      return res.status(400).json({
        success: false,
        message: `Only ${remainingSlots} more user(s) can be assigned to this requirement in this office`
      });
    }

    // Check which users are already assigned (unique constraint is on requirementid + officeid + userid)
    const checkQuery = `SELECT userid FROM requirementuserassignments WHERE requirementid = ? AND officeid = ? AND userid IN (${userIds.map(Number).join(',')})`;
    const checkParams = [requirementid, officeid];

    const [alreadyAssigned] = await db.query(checkQuery, checkParams);
    const alreadyAssignedIds = alreadyAssigned.map(a => Number(a.userid ?? a.userid));

    // Filter out already assigned users
    const newUserIds = userIds.filter(id => !alreadyAssignedIds.includes(id));

    if (newUserIds.length === 0) {
      return res.json({
        success: true,
        message: 'All selected users are already assigned to this requirement in this office',
        data: []
      });
    }

    // Insert new assignments
    const insertValuesSql = newUserIds.map(userid => `(${Number(requirementid)}, ${officeid ? Number(officeid) : 'NULL'}, ${Number(userid)}, ${assignedby ? Number(assignedby) : 'NULL'})`).join(',');

    await db.query(
      `INSERT INTO requirementuserassignments (requirementid, officeid, userid, assignedby) VALUES ${insertValuesSql}`
    );

    if (actorUserId) {
      try {
        const [[requirementRow]] = await db.query(
          `SELECT
             r.requirementcode,
             r.Description,
             o.officename,
             e.eventname
           FROM requirements r
           LEFT JOIN criteria c ON c.criteriaid = r.criteriaid
           LEFT JOIN events e ON e.eventid = c.eventid
           LEFT JOIN offices o ON o.officeid = ?
           WHERE r.requirementid = ?
           LIMIT 1`,
          [officeid || null, requirementid]
        );

        const requirementcode = requirementRow?.requirementcode || `Requirement #${requirementid}`;
        const officename = requirementRow?.officename || 'your office';
        const eventname = requirementRow?.eventname || 'an event';
        const message = `You were assigned to ${requirementcode} for office ${officename} in ${eventname}.`;

        await createNotifications({
          userIds: newUserIds,
          adminid: actorUserId,
          title: 'New Requirement Assignment',
          message,
          type: 'info',
          relatedtable: 'requirements_assignment',
          relatedid: Number(officeid),
          meta: {
            officeid: Number(officeid),
            requirementid: Number(requirementid),
            openSubmission: true,
          },
        });
      } catch (notifError) {
        console.error('Failed to create requirement assignment notifications:', notifError);
      }
    }

    res.json({
      success: true,
      message: `Successfully assigned ${newUserIds.length} user(s) to the requirement in this office`,
      data: { assignedUserIds: newUserIds }
    });
  } catch (error) {
    console.error('Error assigning users to requirement:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning users to requirement'
    });
  }
};

// Get users assigned to a requirement
const getAssignedUsers = async (req, res) => {
  try {
    const { requirementid } = req.params;
    const { officeid } = req.query;
    const numOfficeId = officeid ? Number(officeid) : null;
    const numReqId = Number(requirementid);

    // 1. Get requirement & criteria hierarchy info
    const [reqDetails] = await db.query(
      `SELECT r.requirementid, r.criteriaid, c.areaid, c.parentcriteriaid, c.eventid
       FROM requirements r
       LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
       WHERE r.requirementid = ?
       LIMIT 1`,
      [numReqId]
    );

    const rInfo = reqDetails?.[0] || null;
    const reqCritId = rInfo?.criteriaid ? Number(rInfo.criteriaid) : null;
    const reqParentCritId = rInfo?.parentcriteriaid ? Number(rInfo.parentcriteriaid) : null;
    const reqAreaId = rInfo?.areaid ? Number(rInfo.areaid) : null;
    const reqEventId = rInfo?.eventid ? Number(rInfo.eventid) : null;

    // 2. Fetch assigned personnel via personnelassignments (Area, Subarea, Standard)
    let paAssignments = [];
    if (rInfo) {
      const parentCritClause = reqParentCritId ? 'OR pa.criteriaid = ?' : '';
      const paQuery = `
        SELECT 
          pa.id AS assignmentid,
          ? AS requirementid,
          ${numOfficeId ? '?' : 'NULL'} AS officeid,
          pa.userid,
          pa.createdat AS assignedat,
          pa.assignedby,
          u.firstname,
          u.middleinitial,
          u.lastname,
          u.Email,
          u.profilepic
        FROM personnelassignments pa
        JOIN users u ON pa.userid = u.userid
        WHERE (pa.eventid = ? OR pa.eventid = 0 OR pa.eventid IS NULL)
          AND (
            pa.requirementid = ?
            OR pa.criteriaid = ?
            ${parentCritClause}
            OR pa.areaid = ?
          )
        GROUP BY pa.userid, pa.id, pa.createdat, pa.assignedby, u.firstname, u.middleinitial, u.lastname, u.Email, u.profilepic
      `;

      const paParams = [
        numReqId,
        ...(numOfficeId ? [numOfficeId] : []),
        reqEventId,
        numReqId,
        reqCritId,
        ...(reqParentCritId ? [reqParentCritId] : []),
        reqAreaId
      ];

      const [paRows] = await db.query(paQuery, paParams);
      paAssignments = paRows || [];
    }

    // 3. Fetch legacy assignments from requirementuserassignments
    const legacyQuery = `
      SELECT 
        rua.assignmentid,
        rua.requirementid,
        rua.officeid,
        rua.userid,
        rua.assignedat,
        rua.assignedby,
        u.firstname,
        u.middleinitial,
        u.lastname,
        u.Email,
        u.profilepic
      FROM requirementuserassignments rua
      JOIN users u ON rua.userid = u.userid
      WHERE rua.requirementid = ? ${numOfficeId ? 'AND rua.officeid = ?' : ''}
    `;
    const legacyParams = numOfficeId ? [numReqId, numOfficeId] : [numReqId];
    const [legacyAssignments] = await db.query(legacyQuery, legacyParams);

    const actorRole = Number(req.user?.roleid || 0);
    const actorId = Number(req.user?.userid || req.user?.id || 0);

    // 4. Fetch users who uploaded files in officeproofdocuments
    const uploaderQuery = `
      SELECT 
        NULL AS assignmentid,
        opd.requirementid,
        opd.officeid,
        opd.uploadedby AS userid,
        MIN(opd.uploadedat) AS assignedat,
        NULL AS assignedby,
        u.firstname,
        u.middleinitial,
        u.lastname,
        u.Email,
        u.profilepic
      FROM officeproofdocuments opd
      JOIN users u ON opd.uploadedby = u.userid
      WHERE opd.requirementid = ? ${numOfficeId ? 'AND opd.officeid = ?' : ''} ${actorRole === 4 ? "AND opd.reviewstatus = 'approved'" : ''}
      GROUP BY opd.requirementid, opd.officeid, opd.uploadedby, u.firstname, u.middleinitial, u.lastname, u.Email, u.profilepic
    `;
    const uploaderParams = numOfficeId ? [numReqId, numOfficeId] : [numReqId];
    const [uploaderAssignments] = await db.query(uploaderQuery, uploaderParams);

    // 5. Query exact file review status counts directly from officeproofdocuments (one single source of truth)
    const fileStatsQuery = `
      SELECT 
        opd.uploadedby AS userid,
        COUNT(opd.id) AS totalfiles,
        SUM(CASE WHEN opd.reviewstatus = 'approved' THEN 1 ELSE 0 END) AS approvedcount,
        SUM(CASE WHEN opd.reviewstatus = 'rejected' THEN 1 ELSE 0 END) AS rejectedcount,
        SUM(CASE WHEN opd.reviewstatus = 'pending' OR opd.reviewstatus IS NULL THEN 1 ELSE 0 END) AS pendingcount
      FROM officeproofdocuments opd
      WHERE opd.requirementid = ? ${numOfficeId ? 'AND opd.officeid = ?' : ''}
      GROUP BY opd.uploadedby
    `;
    const fileStatsParams = numOfficeId ? [numReqId, numOfficeId] : [numReqId];
    const [fileStatsRows] = await db.query(fileStatsQuery, fileStatsParams);

    const fileStatsMap = new Map();
    (fileStatsRows || []).forEach(row => {
      const uid = Number(row.userid);
      const tot = Number(row.totalfiles || 0);
      fileStatsMap.set(uid, {
        totalfiles: tot,
        approvedcount: tot > 0 ? Number(row.approvedcount || 0) : 0,
        rejectedcount: tot > 0 ? Number(row.rejectedcount || 0) : 0,
        pendingcount: tot > 0 ? Number(row.pendingcount || 0) : 0,
      });
    });

    // 6. Merge distinct users keyed by userid
    const userMap = new Map();
    [...(paAssignments || []), ...(legacyAssignments || []), ...(uploaderAssignments || [])].forEach(u => {
      const uid = Number(u.userid);
      if (!uid) return;
      if (!userMap.has(uid)) {
        const stats = fileStatsMap.get(uid) || { totalfiles: 0, approvedcount: 0, rejectedcount: 0, pendingcount: 0 };
        if (actorRole === 4) {
          userMap.set(uid, {
            ...u,
            totalfiles: stats.approvedcount,
            approvedcount: stats.approvedcount,
            rejectedcount: 0,
            pendingcount: 0,
            hasuploaded: stats.approvedcount > 0,
            hasrejected: false,
            isallapproved: false,
          });
        } else {
          userMap.set(uid, {
            ...u,
            totalfiles: stats.totalfiles,
            approvedcount: stats.approvedcount,
            rejectedcount: stats.rejectedcount,
            pendingcount: stats.pendingcount,
            hasuploaded: stats.totalfiles > 0,
            hasrejected: stats.rejectedcount > 0,
            isallapproved: stats.totalfiles > 0 && stats.approvedcount === stats.totalfiles,
          });
        }
      }
    });

    const merged = Array.from(userMap.values());

    let filtered = merged;
    if (actorRole !== 1 && actorRole !== 4) {
      // Personnel can only see their own assignment
      filtered = merged.filter(u => Number(u.userid) === actorId);
    }

    res.json({
      success: true,
      data: filtered,
      users: filtered
    });
  } catch (error) {
    console.error('Error fetching assigned users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching assigned users'
    });
  }
};

// Get all requirement assignments for the logged-in user
const getMyAssignments = async (req, res) => {
  try {
    const userid = Number(req.user?.userid);

    if (!Number.isInteger(userid) || userid <= 0) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized user context',
      });
    }

    const [rows] = await db.query(
      `SELECT
         rua.assignmentid,
         rua.requirementid,
         rua.officeid,
         rua.hasuploaded,
         rua.assignedat,
         r.requirementcode,
         r.Description,
         o.officename,
         e.eventname,
         e.eventid
       FROM requirementuserassignments rua
       LEFT JOIN requirements r ON r.requirementid = rua.requirementid
       LEFT JOIN criteria c ON c.criteriaid = r.criteriaid
       LEFT JOIN events e ON e.eventid = c.eventid
       LEFT JOIN offices o ON o.officeid = rua.officeid
       WHERE rua.userid = ?
       ORDER BY rua.assignedat DESC`,
      [userid]
    );

    let paRows = [];
    try {
      const [res] = await db.query(
        `SELECT 
           pa.id as assignmentid,
           r.requirementid,
           cso.officeid as officeid,
           false as hasuploaded,
           pa.createdat as assignedat,
           r.requirementcode,
           r.description as "Description",
           o.officename as officename,
           COALESCE(e.eventname, e2.eventname) as eventname,
           COALESCE(e.eventid, e2.eventid) as eventid
         FROM personnelassignments pa
         LEFT JOIN events e ON pa.eventid = e.eventid
         JOIN requirements r ON (
           pa.requirementid = r.requirementid
           OR (pa.criteriaid IS NOT NULL AND pa.requirementid IS NULL AND (r.criteriaid = pa.criteriaid OR r.criteriaid IN (SELECT criteriaid FROM criteria WHERE parentcriteriaid = pa.criteriaid)))
           OR (pa.areaid IS NOT NULL AND pa.criteriaid IS NULL AND pa.requirementid IS NULL AND r.criteriaid IN (
             SELECT criteriaid FROM criteria WHERE areaid = pa.areaid OR parentcriteriaid IN (SELECT criteriaid FROM criteria WHERE areaid = pa.areaid)
           ))
           OR (pa.eventid IS NOT NULL AND pa.areaid IS NULL AND pa.criteriaid IS NULL AND pa.requirementid IS NULL AND r.criteriaid IN (
             SELECT c.criteriaid FROM criteria c JOIN areas ar ON c.areaid = ar.areaid WHERE ar.eventid = pa.eventid
           ))
         )
         LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
         LEFT JOIN areas ar ON c.areaid = ar.areaid
         LEFT JOIN events e2 ON ar.eventid = e2.eventid
         LEFT JOIN compliancestatusoffices cso ON cso.requirementid = r.requirementid
         LEFT JOIN offices o ON o.officeid = cso.officeid
         WHERE pa.userid = ?`,
        [userid]
      );
      paRows = res || [];
    } catch (paErr) {
      console.warn('Could not fetch personnelassignments in getMyAssignments:', paErr.message);
    }

    const combinedRows = [...(rows || [])];
    const existingKeys = new Set(combinedRows.map(r => `${r.requirementid}-${r.officeid ?? 'null'}`));
    for (const pr of paRows) {
      const key = `${pr.requirementid}-${pr.officeid ?? 'null'}`;
      if (!existingKeys.has(key)) {
        combinedRows.push(pr);
        existingKeys.add(key);
      }
    }

    const officeIds = Array.from(
      new Set(combinedRows.map((row) => row.officeid).filter((id) => id !== null && id !== undefined && Number(id) > 0))
    );

    const requirementIds = Array.from(
      new Set(combinedRows.map((row) => Number(row.requirementid)).filter((id) => id && id > 0))
    );

    // Calculate file review status counts for this user per requirement
    const fileStatsByReq = {};
    try {
      const [fileStatsRows] = await db.query(
        `SELECT 
           opd.requirementid,
           SUM(CASE WHEN opd.id IS NOT NULL AND opd.reviewstatus = 'approved' THEN 1 ELSE 0 END) AS approvedcount,
           SUM(CASE WHEN opd.id IS NOT NULL AND opd.reviewstatus = 'rejected' THEN 1 ELSE 0 END) AS rejectedcount,
           SUM(CASE WHEN opd.id IS NOT NULL AND (opd.reviewstatus = 'pending' OR opd.reviewstatus IS NULL) THEN 1 ELSE 0 END) AS pendingcount,
           COUNT(opd.id) AS totalfiles
         FROM officeproofdocuments opd
         WHERE opd.uploadedby = ?
         GROUP BY opd.requirementid`,
        [userid]
      );
      (fileStatsRows || []).forEach((row) => {
        const rid = Number(row.requirementid);
        const tot = Number(row.totalfiles || 0);
        const app = tot > 0 ? Number(row.approvedcount || 0) : 0;
        const rej = tot > 0 ? Number(row.rejectedcount || 0) : 0;
        const pen = tot > 0 ? Number(row.pendingcount || 0) : 0;
        if (rid) {
          fileStatsByReq[rid] = {
            approvedcount: app,
            rejectedcount: rej,
            pendingcount: pen,
            totalfiles: tot,
          };
        }
      });
    } catch (fsErr) {
      console.warn('Could not fetch fileStatsByReq in getMyAssignments:', fsErr.message);
    }

    res.json({
      success: true,
      data: combinedRows,
      officeIds,
      requirementIds,
      fileStatsByReq,
    });
  } catch (error) {
    console.error('Error fetching my assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching my assignments',
    });
  }
};

// Remove user assignment from a requirement
const removeUserAssignment = async (req, res) => {
  try {
    const { assignmentid } = req.params;

    // Load the assignment to know requirementid and userid
    const [assignRows] = await db.query(
      'SELECT assignmentid, requirementid, officeid, userid FROM requirementuserassignments WHERE assignmentid = ? LIMIT 1',
      [assignmentid]
    );

    if (!assignRows || assignRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    const assign = assignRows[0];
    const requirementid = assign.requirementid;
    const userid = assign.userid;
    const officeid = assign.officeid;

    // Delete uploaded proof documents related to this user + requirement (if any)
    try {
      const [files] = await db.query(
        'SELECT id, filename, filepath FROM officeproofdocuments WHERE requirementid = ? AND uploadedby = ?',
        [requirementid, userid]
      );

      if (files && files.length > 0) {
        for (const f of files) {
          try {
            const absPath = path.join(__dirname, '..', (f.filepath || '').replace(/^\//, ''));
            if (fs.existsSync(absPath)) {
              fs.unlinkSync(absPath);
            }
          } catch (fsErr) {
            console.warn('Failed to delete uploaded file from disk for assignment removal:', fsErr);
          }
        }

        // Remove DB records for those files
        await db.query('DELETE FROM officeproofdocuments WHERE requirementid = ? AND uploadedby = ?', [requirementid, userid]);

        // Try to log the unsubmit action
        try {
          const actorUserId = Number(req.user?.userid || userid);
          if (Number.isInteger(actorUserId) && actorUserId > 0) {
            await recordLog(actorUserId, 'RequirementFileDeletedOnAssignmentRemove', {
              requirementid: Number(requirementid),
              assignmentid: Number(assignmentid),
              DeletedByUserID: Number(userid),
              officeid: officeid || null
            });
          }
        } catch (logErr) {
          console.error('Failed to record file deletion log during assignment removal:', logErr);
        }
      }
    } catch (fileErr) {
      console.error('Error while cleaning uploaded files for removed assignment:', fileErr);
    }

    // Finally delete the assignment row
    const [result] = await db.query('DELETE FROM requirementuserassignments WHERE assignmentid = ?', [assignmentid]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    res.json({ success: true, message: 'User assignment removed successfully' });
  } catch (error) {
    console.error('Error removing user assignment:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing user assignment'
    });
  }
};

// Get all requirements a user is assigned to (with count check - max 4)
const getUserAssignmentCount = async (req, res) => {
  try {
    const { userid } = req.params;

    const [result] = await db.query(
      'SELECT COUNT(*) as count FROM requirementuserassignments WHERE userid = ?',
      [userid]
    );

    res.json({
      success: true,
      data: {
        userid,
        assignmentCount: result[0].count,
        canAssignMore: result[0].count < 4,
        remainingSlots: Math.max(0, 4 - result[0].count)
      }
    });
  } catch (error) {
    console.error('Error getting user assignment count:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting user assignment count'
    });
  }
};

// Get available users for assignment (all approved users with roleid = 2)
const getAvailableUsersForAssignment = async (req, res) => {
  try {
    const { requirementid, officeid } = req.query;

      let users = [];
      // If officeid is provided, return both users with the 'Personnel' role and office heads for that office
      if (officeid) {
        // Only fetch office heads for the provided office
        const [headUsers] = await db.query(`
          SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.profilepic
          FROM headofoffice h
          INNER JOIN officeheadassignments oha ON oha.headid = h.headid
          INNER JOIN users u ON u.userid = h.userid
          WHERE oha.officeid = ? AND u.approvalstatus = 'approved'
          ORDER BY u.firstname, u.lastname
        `, [officeid]);

        users = headUsers || [];
      } else {
        // Get all approved users with roleid = 2 (legacy behavior)
        const [allUsers] = await db.query(`
          SELECT 
            u.userid,
            u.firstname,
            u.middleinitial,
            u.lastname,
            u.Email,
            u.profilepic
          FROM users u
          WHERE u.roleid = 2 AND u.approvalstatus = 'approved'
          ORDER BY u.firstname, u.lastname
        `);
        users = allUsers;
      }

    // If requirementid is provided, also check which users are already assigned to it
    if (requirementid) {
      let assignedQuery = 'SELECT userid FROM requirementuserassignments WHERE requirementid = ?';
      const assignedParams = [requirementid];
      
      if (officeid) {
        assignedQuery += ' AND officeid = ?';
        assignedParams.push(officeid);
      }
      
      const [alreadyAssigned] = await db.query(assignedQuery, assignedParams);
      const assignedUserIds = alreadyAssigned.map(a => a.userid);
      
      // Mark users that are already assigned to this requirement
      let usersWithStatus = users.map(user => ({
        ...user,
        isAssigned: assignedUserIds.includes(user.userid)
      }));

      // If there are no available (not-yet-assigned) users and an officeid is provided,
      // fall back to returning office heads for that office (they may not have the Personnel role).
      const available = usersWithStatus.filter(u => !u.isAssigned);
      if (available.length === 0 && officeid) {
        // Fetch office heads specifically
        const [fallbackHeads] = await db.query(`
          SELECT u.userid, u.firstname, u.middleinitial, u.lastname, u.Email, u.profilepic
          FROM headofoffice h
          INNER JOIN officeheadassignments oha ON oha.headid = h.headid
          INNER JOIN users u ON u.userid = h.userid
          WHERE oha.officeid = ? AND u.approvalstatus = 'approved'
          ORDER BY u.firstname, u.lastname
        `, [officeid]);

        // mark assignment status for heads (likely false since available was empty)
        usersWithStatus = (fallbackHeads || []).map(user => ({
          ...user,
          isAssigned: assignedUserIds.includes(user.userid)
        }));
      }

      return res.json({
        success: true,
        data: usersWithStatus
      });
    }

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available users'
    });
  }
};

// Update user's upload status for a requirement
const updateUserUploadStatus = async (req, res) => {
  try {
    const { assignmentid } = req.params;
    const { hasuploaded } = req.body;

    const [result] = await db.query(
      'UPDATE requirementuserassignments SET hasuploaded = ? WHERE assignmentid = ?',
      [hasuploaded ? true : false, assignmentid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found'
      });
    }

    res.json({
      success: true,
      message: `Upload status updated to ${hasuploaded ? 'uploaded' : 'not uploaded'}`
    });
  } catch (error) {
    console.error('Error updating upload status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating upload status'
    });
  }
};

// Mark user as uploaded by requirementid and userid
const markUserAsUploaded = async (req, res) => {
  try {
    const { requirementid, userid } = req.body;

    if (!requirementid || !userid) {
      return res.status(400).json({
        success: false,
        message: 'requirementid and userid are required'
      });
    }

    const [result] = await db.query(
      'UPDATE requirementuserassignments SET hasuploaded = TRUE WHERE requirementid = ? AND userid = ?',
      [requirementid, userid]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found for this user and requirement'
      });
    }

    res.json({
      success: true,
      message: 'User marked as uploaded successfully'
    });
  } catch (error) {
    console.error('Error marking user as uploaded:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking user as uploaded'
    });
  }
};

// Helper: Auto-assign office heads to one or many requirements for an office
const autoAssignHeadsToRequirementsForOffice = async (officeid, requirementIds = [], actorUserId = null) => {
  if (!officeid || !Array.isArray(requirementIds) || requirementIds.length === 0) return { success: true, assigned: 0 };

  // 1. Get head user IDs for the office
  const [headRows] = await db.query(
    `SELECT h.userid FROM officeheadassignments oha
     JOIN headofoffice h ON oha.headid = h.headid
     WHERE oha.officeid = ?`,
    [officeid]
  );

  const headUserIds = headRows.map(r => Number(r.userid)).filter(id => Number.isInteger(id) && id > 0);
  if (headUserIds.length === 0) return { success: true, assigned: 0 };

  // 2. Fetch ALL existing assignments for this office in a single query
  const [allAssignedRows] = await db.query(
    `SELECT requirementid, userid FROM requirementuserassignments WHERE officeid = ?`,
    [officeid]
  );

  const assignmentsByReq = new Map();
  for (const row of allAssignedRows) {
    const reqId = Number(row.requirementid);
    const uId = Number(row.userid);
    if (!assignmentsByReq.has(reqId)) {
      assignmentsByReq.set(reqId, new Set());
    }
    assignmentsByReq.get(reqId).add(uId);
  }

  // 3. Compute bulk insert tuples in-memory
  const insertTuples = [];
  for (const reqId of requirementIds) {
    const requirementid = Number(reqId);
    if (!Number.isInteger(requirementid) || requirementid <= 0) continue;

    const assignedSet = assignmentsByReq.get(requirementid) || new Set();
    const remainingSlots = Math.max(0, 4 - assignedSet.size);
    if (remainingSlots <= 0) continue;

    const toAssign = headUserIds.filter(id => !assignedSet.has(id)).slice(0, remainingSlots);
    for (const userid of toAssign) {
      insertTuples.push([requirementid, Number(officeid), Number(userid), actorUserId ? Number(actorUserId) : null]);
      assignedSet.add(userid);
    }
  }

  if (insertTuples.length === 0) {
    return { success: true, assigned: 0 };
  }

  // 4. Perform a single batch insert
  const insertValuesSql = insertTuples.map(([rId, oId, uId, aBy]) => `(${rId}, ${oId}, ${uId}, ${aBy ? Number(aBy) : 'NULL'})`).join(',');
  await db.query(`INSERT INTO requirementuserassignments (requirementid, officeid, userid, assignedby) VALUES ${insertValuesSql} ON CONFLICT DO NOTHING`);

  // 5. Send aggregated notification per office in the background
  try {
    const [[officeRow]] = await db.query('SELECT officename FROM offices WHERE officeid = ?', [officeid]);
    const officename = officeRow?.officename || 'your office';

    createNotifications({
      userIds: headUserIds,
      adminid: actorUserId,
      title: 'New Requirement Assignments',
      message: `You were assigned to requirements for office ${officename}.`,
      type: 'info',
      relatedtable: 'requirements_assignment',
      relatedid: Number(officeid),
      meta: {
        officeid: Number(officeid),
        openSubmission: true,
      },
    }).catch(e => console.warn('Background notification error:', e.message));
  } catch (notifErr) {
    console.warn('autoAssign: failed to notify assigned users', notifErr.message);
  }

  return { success: true, assigned: insertTuples.length };
};

module.exports = {
  getAllRequirements,
  getRequirementsByEvent,
  getRequirementsByCriteria,
  addRequirement,
  updateRequirement,
  deleteRequirements,
  getAllEvents,
  addEvent,
  deleteEvents,
  updateEvent,
  // User assignment functions
  assignUsersToRequirement,
  getAssignedUsers,
  getMyAssignments,
  removeUserAssignment,
  getUserAssignmentCount,
  getAvailableUsersForAssignment,
  updateUserUploadStatus,
  markUserAsUploaded,
  autoAssignHeadsToRequirementsForOffice
};
