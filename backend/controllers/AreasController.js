const db = require('../db');
const { recordLog } = require('./logsController');

// Add a new area
exports.addArea = async (req, res) => {
    try {
        const { EventChildID, areacode, areaname, Description } = req.body;
        const description = req.body.description ?? Description ?? null;
        const eventid = req.body.eventid || EventChildID;

        if (!eventid || !areacode || !areaname) {
            return res.status(400).json({ success: false, message: 'Event, Area code, and Area name are required.' });
        }

        
        let result;
        try {
            // Preferred query for schemas with createdat/updatedat columns
            [result] = await db.query(
                `INSERT INTO areas (areacode, areaname, eventid, description, isactive, createdat, updatedat)
                 VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())`,
                [areacode, areaname, eventid, description]
            );
        } catch (insertErr) {
            // Fallback query for schemas without createdat/updatedat columns
            [result] = await db.query(
                `INSERT INTO areas (areacode, areaname, eventid, description, isactive)
                 VALUES (?, ?, ?, ?, TRUE)`,
                [areacode, areaname, eventid, description]
            );
        }

        const [areaRows] = await db.query(
            `SELECT areaid, areacode, areaname, eventid, description, sortorder, createdat, updatedat FROM areas WHERE areaid = ?`,
            [result.insertId]
        );
        const areaData = areaRows && areaRows[0] ? {
            ...areaRows[0],
            description: areaRows[0].description ?? description,
            Description: areaRows[0].description ?? description
        } : null;
        res.json({ success: true, data: areaData });
                if (req.user && req.user.userid) {
                    try { recordLog(req.user.userid, 'AreaAdded', { areaid: areaRows[0].areaid, areaname: areaRows[0].areaname, eventid: areaRows[0].eventid }); } catch (e) {}
                }
    } catch (error) {
        console.error('Error adding area:', error);
        if (error && (error.code === 'ER_DUP_ENTRY' || error.code === '23505' || String(error.code) === '23505')) {
            return res.status(409).json({ success: false, message: 'An area with this Area Code already exists for this event.' });
        }
        res.status(500).json({ success: false, message: 'Failed to add area', error: error.message });
    }
};

// Soft delete multiple areas
exports.deleteAreas = async (req, res) => {
    try {
        const { areaIds } = req.body;
        if (!Array.isArray(areaIds) || areaIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No area IDs provided' });
        }

        const placeholders = areaIds.map(() => '?').join(',');

        // Clean up requirements & criteria under these areas
        try {
          const [critRows] = await db.query(`SELECT criteriaid FROM criteria WHERE areaid IN (${placeholders})`, areaIds);
          if (critRows && critRows.length > 0) {
            const critIds = critRows.map(c => c.criteriaid ?? c.criteriaid).filter(Boolean);
            if (critIds.length > 0) {
              const critPlaceholders = critIds.map(() => '?').join(',');
              await db.query(`DELETE FROM officeproofdocuments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
              await db.query(`DELETE FROM requirementuserassignments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
              await db.query(`DELETE FROM compliancestatusoffices WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
              await db.query(`DELETE FROM requirements WHERE criteriaid IN (${critPlaceholders})`, critIds);
              await db.query(`DELETE FROM criteria WHERE criteriaid IN (${critPlaceholders})`, critIds);
            }
          }
        } catch (cascadeErr) {
          console.error('Error during cascading cleanup in deleteAreas:', cascadeErr);
        }

        const [result] = await db.query(
            `DELETE FROM areas WHERE areaid IN (${placeholders})`,
            areaIds
        );

                if (req.user && req.user.userid) {
                    try { recordLog(req.user.userid, 'AreaDeleted', { areaIds }); } catch (e) {}
                }
        return res.json({
            success: true,
            message: `Successfully deleted ${result.affectedRows} area(s)`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        console.error('Error deleting areas:', error);
        res.status(500).json({ success: false, message: 'Failed to delete areas', error: error.message });
    }
};
