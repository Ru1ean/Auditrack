const fs = require('fs');
const path = require('path');
const db = require('../db');
const { recordLog } = require('./logsController');

const TABLE_NAME = 'masterlist';
const ENTITY_TYPE_MAP = {
  1: 'Academic Program',
  2: 'Non-Academic Office',
};

const formatMasterListRow = (row) => ({
  id: row.id,
  name: row.entityname,
  type: ENTITY_TYPE_MAP[row.entitytypeid] || row.entity_type || `Type ${row.entitytypeid}`,
  entitytypeid: row.entitytypeid,
  department: row.department_name || null,
  departmentid: row.departmentid || null,
  status: 'Active',
  createdat: row.createdat ? (row.createdat instanceof Date ? row.createdat.toISOString() : String(row.createdat)) : null,
  updatedat: row.updatedat ? (row.updatedat instanceof Date ? row.updatedat.toISOString() : String(row.updatedat)) : null,
});

/**
 * Cascading deletion of offices in ACC / audit events linked to deleted master list item(s).
 * Cleans up attached proof documents, user uploads, requirement statuses, head assignments,
 * and the office records themselves.
 */
async function deleteLinkedOffices(masterListIds = [], itemNames = []) {
  const ids = Array.isArray(masterListIds)
    ? masterListIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
    : [];
  const names = Array.isArray(itemNames)
    ? itemNames.filter((n) => typeof n === 'string' && n.trim().length > 0)
    : [];

  if (ids.length === 0 && names.length === 0) return [];

  let query = 'SELECT officeid FROM offices WHERE ';
  const params = [];

  if (ids.length > 0 && names.length > 0) {
    const idPlaceholders = ids.map(() => '?').join(',');
    const namePlaceholders = names.map(() => '?').join(',');
    query += `masterlistid IN (${idPlaceholders}) OR (masterlistid IS NULL AND officename IN (${namePlaceholders}))`;
    params.push(...ids, ...names);
  } else if (ids.length > 0) {
    const idPlaceholders = ids.map(() => '?').join(',');
    query += `masterlistid IN (${idPlaceholders})`;
    params.push(...ids);
  } else {
    const namePlaceholders = names.map(() => '?').join(',');
    query += `officename IN (${namePlaceholders})`;
    params.push(...names);
  }

  const [officeRows] = await db.query(query, params);
  const officeIds = Array.isArray(officeRows)
    ? officeRows.map((r) => Number(r.officeid ?? r.officeid)).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  if (officeIds.length === 0) return [];

  const placeholders = officeIds.map(() => '?').join(',');

  try {
    // 1) Find requirement IDs associated with these offices
    const [reqRows] = await db.query(
      `SELECT requirementid FROM compliancestatusoffices WHERE officeid IN (${placeholders})`,
      officeIds
    );
    const requirementIds = Array.isArray(reqRows)
      ? reqRows.map((r) => Number(r.requirementid ?? r.requirementid)).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    if (requirementIds.length > 0) {
      const reqPlaceholders = requirementIds.map(() => '?').join(',');

      // Delete requirement proof documents strictly belonging to these offices (disk + Supabase + DB)
      try {
        const { deleteFromSupabaseBucket } = require('../utils/supabaseStorage');
        const [proofFiles] = await db.query(
          `SELECT id, filepath FROM officeproofdocuments WHERE officeid IN (${placeholders})`,
          officeIds
        );
        if (proofFiles && proofFiles.length > 0) {
          for (const f of proofFiles) {
            try {
              if (f.filepath && (f.filepath.startsWith('http://') || f.filepath.startsWith('https://'))) {
                await deleteFromSupabaseBucket(f.filepath, 'proof-documents');
              } else {
                const absPath = path.join(__dirname, '..', (f.filepath || '').replace(/^\//, ''));
                if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
              }
            } catch (fsErr) {
              console.warn('Failed to delete proof file:', fsErr);
            }
          }
          await db.query(`DELETE FROM officeproofdocuments WHERE officeid IN (${placeholders})`, officeIds);
        }
      } catch (e) {
        console.error('Error cleaning up proof documents during master list office delete:', e);
      }

      // Delete user requirement uploads from disk and DB scoped to these offices
      try {
        const [userFiles] = await db.query(
          `SELECT id, filepath FROM requirement_user_uploads WHERE requirementid IN (${reqPlaceholders}) AND officeid IN (${placeholders})`,
          [...requirementIds, ...officeIds]
        );
        if (userFiles && userFiles.length > 0) {
          for (const uf of userFiles) {
            try {
              const absPath = path.join(__dirname, '..', (uf.filepath || '').replace(/^\//, ''));
              if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
            } catch (fsErr) {
              console.warn('Failed to delete user upload from disk:', fsErr);
            }
          }
          await db.query(
            `DELETE FROM requirement_user_uploads WHERE requirementid IN (${reqPlaceholders}) AND officeid IN (${placeholders})`,
            [...requirementIds, ...officeIds]
          );
        }
      } catch (e) {
        console.error('Error cleaning up user uploads during master list office delete:', e);
      }

      // Remove requirement user assignments
      try {
        await db.query(
          `DELETE FROM requirementuserassignments WHERE officeid IN (${placeholders})`,
          officeIds
        );
      } catch (e) {
        console.error('Error cleaning up requirementuserassignments during master list office delete:', e);
      }
    }

    // 2) Delete office-level proof documents from disk and DB
    try {
      const [officeProofs] = await db.query(
        `SELECT id, filepath FROM officeproofdocuments WHERE officeid IN (${placeholders})`,
        officeIds
      );
      if (officeProofs && officeProofs.length > 0) {
        for (const f of officeProofs) {
          try {
            const absPath = path.join(__dirname, '..', (f.filepath || '').replace(/^\//, ''));
            if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
          } catch (fsErr) {}
        }
        await db.query(
          `DELETE FROM officeproofdocuments WHERE officeid IN (${placeholders})`,
          officeIds
        );
      }
    } catch (e) {
      console.error('Error cleaning up office-level proofs during master list office delete:', e);
    }

    // 3) Delete compliance records, head assignments, and overall office status
    await db.query(`DELETE FROM compliancestatusoffices WHERE officeid IN (${placeholders})`, officeIds);
    await db.query(`DELETE FROM officeheadassignments WHERE officeid IN (${placeholders})`, officeIds);
    await db.query(`DELETE FROM OverallOfficeStatus WHERE officeid IN (${placeholders})`, officeIds);

    // 4) Delete the office records from offices table
    await db.query(`DELETE FROM offices WHERE officeid IN (${placeholders})`, officeIds);

    return officeIds;
  } catch (err) {
    console.error('Error cascading deletion of linked offices:', err);
    throw err;
  }
}

exports.getAll = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        m.id,
        m.entityname,
        m.entitytypeid,
        m.departmentid,
        m.createdat,
        m.updatedat,
        d.name AS department_name,
        CASE m.entitytypeid
          WHEN 1 THEN 'Academic Program'
          WHEN 2 THEN 'Non-Academic Office'
          ELSE 'Unknown'
        END AS entity_type
      FROM ${TABLE_NAME} m
      LEFT JOIN departments d ON m.departmentid = d.id
      ORDER BY m.id ASC
      `
    );
    return res.json({ success: true, data: rows.map(formatMasterListRow) });
  } catch (error) {
    console.error('Error fetching master list items:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch master list items', error: error.message });
  }
};

exports.getAvailableForEvent = async (req, res) => {
  try {
    const { eventid } = req.params;
    const [rows] = await db.query(
      `
      SELECT
        m.id,
        m.entityname,
        m.entitytypeid,
        m.departmentid,
        m.createdat,
        m.updatedat,
        d.name AS department_name,
        CASE m.entitytypeid
          WHEN 1 THEN 'Academic Program'
          WHEN 2 THEN 'Non-Academic Office'
          ELSE 'Unknown'
        END AS entity_type
      FROM ${TABLE_NAME} m
      LEFT JOIN departments d ON m.departmentid = d.id
      WHERE m.id NOT IN (
        SELECT masterlistid FROM offices WHERE eventid = ? AND masterlistid IS NOT NULL
      )
      ORDER BY m.entityname ASC
      `,
      [eventid]
    );
    return res.json({ success: true, data: rows.map(formatMasterListRow) });
  } catch (error) {
    console.error('Error fetching available master list items:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch available items', error: error.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { name, entitytypeid, type, departmentid, department } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    let parsedTypeId = Number(entitytypeid) || 0;

    if (!parsedTypeId && typeof type === 'string') {
      if (type === 'Academic Program') parsedTypeId = 1;
      else if (type === 'Non-Academic Office') parsedTypeId = 2;
    }

    if (!trimmedName || !parsedTypeId || !ENTITY_TYPE_MAP[parsedTypeId]) {
      return res.status(400).json({ success: false, message: 'Name and valid entity type are required.' });
    }

    let parsedDepartmentId = null;
    if (departmentid) {
      parsedDepartmentId = Number(departmentid) || null;
    } else if (department && typeof department === 'string') {
      const [rows] = await db.query('SELECT id FROM departments WHERE name = ? LIMIT 1', [department.trim()]);
      parsedDepartmentId = rows[0]?.id || null;
    }

    if (parsedTypeId === 1 && !parsedDepartmentId) {
      return res.status(400).json({ success: false, message: 'Department is required for an academic program.' });
    }

    const [result] = await db.query(
      `INSERT INTO ${TABLE_NAME} (entityname, entitytypeid, departmentid) VALUES (?, ?, ?)`,
      [trimmedName, parsedTypeId, parsedDepartmentId]
    );

    const [rows] = await db.query(
      `
      SELECT
        m.id,
        m.entityname,
        m.entitytypeid,
        m.departmentid,
        m.createdat,
        m.updatedat,
        d.name AS department_name,
        CASE m.entitytypeid
          WHEN 1 THEN 'Academic Program'
          WHEN 2 THEN 'Non-Academic Office'
          ELSE 'Unknown'
        END AS entity_type
      FROM ${TABLE_NAME} m
      LEFT JOIN departments d ON m.departmentid = d.id
      WHERE m.id = ?
      `,
      [result.insertId]
    );

    const inserted = rows[0];
    if (!inserted) {
      return res.status(500).json({ success: false, message: 'Failed to retrieve added master list item.' });
    }

    const data = formatMasterListRow(inserted);
    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'MasterListItemAdded', { id: data.id, name: data.name });
      } catch (e) {
        console.error('Failed to record log for master list add:', e);
      }
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error adding master list item:', error);
    return res.status(500).json({ success: false, message: 'Failed to add master list item', error: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, entitytypeid, type, departmentid } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    let parsedTypeId = Number(entitytypeid) || 0;

    if (!parsedTypeId && typeof type === 'string') {
      if (type === 'Academic Program') parsedTypeId = 1;
      else if (type === 'Non-Academic Office') parsedTypeId = 2;
    }

    if (!trimmedName || !parsedTypeId || !ENTITY_TYPE_MAP[parsedTypeId]) {
      return res.status(400).json({ success: false, message: 'Name and valid entity type are required.' });
    }

    let parsedDepartmentId = departmentid ? Number(departmentid) || null : null;

    if (parsedTypeId === 1 && !parsedDepartmentId) {
      return res.status(400).json({ success: false, message: 'Department is required for an academic program.' });
    }

    await db.query(
      `UPDATE ${TABLE_NAME} SET entityname = ?, entitytypeid = ?, departmentid = ? WHERE id = ?`,
      [trimmedName, parsedTypeId, parsedDepartmentId, id]
    );

    // Keep linked offices names in sync if updated
    await db.query(
      `UPDATE offices SET officename = ? WHERE masterlistid = ?`,
      [trimmedName, id]
    );

    const [rows] = await db.query(
      `
      SELECT
        m.id,
        m.entityname,
        m.entitytypeid,
        m.departmentid,
        m.createdat,
        m.updatedat,
        d.name AS department_name,
        CASE m.entitytypeid
          WHEN 1 THEN 'Academic Program'
          WHEN 2 THEN 'Non-Academic Office'
          ELSE 'Unknown'
        END AS entity_type
      FROM ${TABLE_NAME} m
      LEFT JOIN departments d ON m.departmentid = d.id
      WHERE m.id = ?
      `,
      [id]
    );

    const updated = rows[0];
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Item not found after update.' });
    }

    const data = formatMasterListRow(updated);
    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'MasterListItemUpdated', { id: data.id, name: data.name });
      } catch (e) {
        console.error('Failed to record log for master list update:', e);
      }
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error updating master list item:', error);
    return res.status(500).json({ success: false, message: 'Failed to update master list item', error: error.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`SELECT entityname FROM ${TABLE_NAME} WHERE id = ?`, [id]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }
    const itemName = rows[0].entityname;

    // Cascade delete any linked offices in ACC / audit events
    const deletedOfficeIds = await deleteLinkedOffices([Number(id)], [itemName]);

    // Delete item from masterlist
    await db.query(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);

    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'MasterListItemDeleted', {
          id,
          name: itemName,
          deletedOfficesCount: deletedOfficeIds.length,
        });
      } catch (e) {
        console.error('Failed to record log for master list delete:', e);
      }
    }
    return res.json({
      success: true,
      message: `Item "${itemName}" and ${deletedOfficeIds.length} linked event office(s) deleted.`,
    });
  } catch (error) {
    console.error('Error deleting master list item:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete master list item', error: error.message });
  }
};

exports.deleteMultiple = async (req, res) => {
  try {
    const rawIds = req.body?.ids || req.body?.itemIds || req.body?.masterListIds || req.body?.data?.ids || [];
    const ids = Array.isArray(rawIds) ? rawIds.map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];
    if (ids.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid IDs provided' });
    }

    const placeholders = ids.map(() => '?').join(',');

    // Fetch entity names of items to be deleted
    const [itemRows] = await db.query(`SELECT id, entityname FROM ${TABLE_NAME} WHERE id IN (${placeholders})`, ids);
    const itemNames = (itemRows || []).map((r) => r.entityname).filter(Boolean);

    // Cascade delete any linked offices in ACC / audit events
    const deletedOfficeIds = await deleteLinkedOffices(ids, itemNames);

    // Delete items from masterlist
    await db.query(`DELETE FROM ${TABLE_NAME} WHERE id IN (${placeholders})`, ids);

    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'MasterListItemsDeleted', {
          ids,
          deletedOfficesCount: deletedOfficeIds.length,
        });
      } catch (e) {}
    }
    return res.json({
      success: true,
      message: `Successfully deleted ${ids.length} item(s) and ${deletedOfficeIds.length} linked event office(s).`,
    });
  } catch (error) {
    console.error('Error bulk deleting master list items:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete selected master list items', error: error.message });
  }
};


