const db = require('../db');
const { recordLog } = require('./logsController');

const eventDepartmentsController = {
  // GET all departments participating in an event with their levels and program stats
  getByEvent: async (req, res) => {
    try {
      const { eventid } = req.params;
      if (!eventid) {
        return res.status(400).json({ success: false, message: 'Event ID is required' });
      }

      let query;
      let params;

      if (String(eventid).toLowerCase() === 'all') {
        query = `
          SELECT 
            d.id AS departmentid,
            d.name AS department_name,
            d.code AS department_code,
            NULL::integer AS id,
            NULL::integer AS eventid,
            NULL::timestamp AS createdat,
            NULL::timestamp AS updatedat,
            COUNT(DISTINCT o."officeid") AS program_count
          FROM departments d
          LEFT JOIN offices o ON o.masterlistid IN (SELECT id FROM masterlist WHERE departmentid = d.id)
          GROUP BY d.id, d.name, d.code
          ORDER BY d.id ASC
        `;
        params = [];
      } else {
        const numericEventId = Number(eventid);
        query = `
          SELECT 
            d.id AS departmentid,
            d.name AS department_name,
            d.code AS department_code,
            ed.id AS id,
            COALESCE(ed.eventid, ?) AS eventid,
            ed.createdat,
            ed.updatedat,
            COUNT(DISTINCT o."officeid") AS program_count
          FROM departments d
          LEFT JOIN eventdepartments ed ON ed.departmentid = d.id AND ed.eventid = ?
          LEFT JOIN offices o ON o."eventid" = ? AND o.masterlistid IN (SELECT id FROM masterlist WHERE departmentid = d.id)
          GROUP BY d.id, d.name, d.code, ed.id, ed.eventid, ed.createdat, ed.updatedat
          ORDER BY d.id ASC
        `;
        params = [numericEventId, numericEventId, numericEventId];
      }

      const [rows] = await db.query(query, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('Error fetching event departments:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch event departments', details: err.message });
    }
  },

  // Assign a department to an event
  assignDepartment: async (req, res) => {
    try {
      const { eventid, departmentid } = req.body;

      if (!eventid || !departmentid) {
        return res.status(400).json({ success: false, message: 'Event ID and Department ID are required.' });
      }

      const [existing] = await db.query(
        `SELECT id FROM eventdepartments WHERE eventid = ? AND departmentid = ? LIMIT 1`,
        [Number(eventid), Number(departmentid)]
      );

      let record;
      if (existing.length > 0) {
        const [updated] = await db.query(
          `UPDATE eventdepartments 
           SET updatedat = CURRENT_TIMESTAMP 
           WHERE id = ? 
           RETURNING *`,
          [existing[0].id]
        );
        record = updated[0];
      } else {
        const [inserted] = await db.query(
          `INSERT INTO eventdepartments (eventid, departmentid)
           VALUES (?, ?)
           RETURNING *`,
          [Number(eventid), Number(departmentid)]
        );
        record = inserted[0];
      }

      // Link any existing offices in this event that belong to this department
      if (record?.id) {
        await db.query(
          `UPDATE offices 
           SET eventdepartmentid = ? 
           WHERE "eventid" = ? 
             AND eventdepartmentid IS NULL 
             AND masterlistid IN (SELECT id FROM masterlist WHERE departmentid = ?)`,
          [record.id, Number(eventid), Number(departmentid)]
        );
      }

      // Fetch joined department name
      const [deptRows] = await db.query('SELECT name FROM departments WHERE id = ?', [Number(departmentid)]);
      const departmentName = deptRows[0]?.name || `Department #${departmentid}`;

      if (req.user?.userid) {
        try {
          await recordLog(req.user.userid, 'DepartmentAccredited', {
            eventid: eventid,
            department: departmentName,
            level: req.body.accreditationlevel || 'N/A',
          });
        } catch (logErr) {
          console.error('Failed to record log:', logErr);
        }
      }

      res.json({
        success: true,
        message: 'Department assigned to accreditation event successfully',
        data: {
          ...record,
          department_name: departmentName,
        },
      });
    } catch (err) {
      console.error('Error assigning department to event:', err);
      res.status(500).json({ success: false, message: 'Failed to assign department', details: err.message });
    }
  },

  // Update accreditation level for academic programs under an event department
  updateLevel: async (req, res) => {
    try {
      const { id } = req.params;
      const { accreditationlevel } = req.body;

      if (!accreditationlevel) {
        return res.status(400).json({ success: false, message: 'Accreditation level is required.' });
      }

      // Update academic programs under this event department
      await db.query(
        `UPDATE offices SET accreditationlevel = ? WHERE eventdepartmentid = ?`,
        [accreditationlevel, Number(id)]
      );

      res.json({
        success: true,
        message: 'Accreditation level updated for programs successfully',
        data: { id: Number(id), accreditationlevel },
      });
    } catch (err) {
      console.error('Error updating accreditation level:', err);
      res.status(500).json({ success: false, message: 'Failed to update accreditation level', details: err.message });
    }
  },

  // Remove a department from an event
  deleteDepartment: async (req, res) => {
    try {
      const { id } = req.params;

      // Nullify office foreign keys first
      await db.query(`UPDATE offices SET eventdepartmentid = NULL WHERE eventdepartmentid = ?`, [Number(id)]);

      const [deleted] = await db.query(`DELETE FROM eventdepartments WHERE id = ? RETURNING *`, [Number(id)]);

      if (deleted.length === 0) {
        return res.status(404).json({ success: false, message: 'Event department not found.' });
      }

      res.json({
        success: true,
        message: 'Department removed from event successfully',
      });
    } catch (err) {
      console.error('Error removing department from event:', err);
      res.status(500).json({ success: false, message: 'Failed to remove department', details: err.message });
    }
  },
};

module.exports = eventDepartmentsController;
