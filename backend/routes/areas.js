const express = require('express');
const router = express.Router();
const db = require('../db');
const { recordLog } = require('../controllers/logsController');
const AreasController = require('../controllers/AreasController');
const { auth, restrictAuditor } = require('../middleware/auth');

// Helper to ensure auditorareaassignments table exists
const ensureAssignmentsTable = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS auditorareaassignments (
                id SERIAL PRIMARY KEY,
                auditoruserid INT NOT NULL,
                areaid INT NOT NULL,
                assignedby INT DEFAULT NULL,
                createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_auditor_area UNIQUE (auditoruserid, areaid)
            )
        `);
    } catch (e) {
        console.error('Error creating auditorareaassignments table:', e);
    }
};
ensureAssignmentsTable();

// GET assigned areas for an auditor user
router.get('/assignments/:userid', auth, async (req, res) => {
    try {
        await ensureAssignmentsTable();
        const { userid } = req.params;
        const [rows] = await db.query(
            `SELECT a.id, a.auditoruserid, a.areaid, a.createdat, ar.areacode, ar.areaname, ar.eventid, e.eventname
             FROM auditorareaassignments a
             JOIN areas ar ON a.areaid = ar.areaid
             LEFT JOIN Events e ON ar.eventid = e.eventid
             WHERE a.auditoruserid = ?`,
            [userid]
        );
        const formatted = (rows || []).map(r => ({
            id: r.id,
            auditoruserid: r.auditoruserid,
            areaid: r.areaid ?? r.areaid ?? r.areaid,
            areaid: r.areaid ?? r.areaid ?? r.areaid,
            areacode: r.areacode ?? r.areacode ?? '',
            areaname: r.areaname ?? r.areaname ?? '',
            eventid: r.eventid ?? r.eventid,
            eventname: r.eventname ?? r.eventname ?? '',
            createdat: r.createdat,
        }));
        res.json({ success: true, assignments: formatted });
    } catch (err) {
        console.error('Error fetching auditor assignments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: err.message });
    }
});

// GET auditors assigned to an office (via area assignments)
router.get('/auditors/office/:officeid', auth, async (req, res) => {
    try {
        await ensureAssignmentsTable();
        const { officeid } = req.params;
        const [rows] = await db.query(
            `SELECT u.userid, u.firstname, u.lastname, u.Email, u.profilepic,
                    string_agg(DISTINCT ar.areacode, ', ') AS areacode,
                    string_agg(DISTINCT ar.areaname, ', ') AS areaname
             FROM auditorareaassignments aaa
             JOIN users u ON aaa.auditoruserid = u.userid
             JOIN areas ar ON aaa.areaid = ar.areaid
             JOIN criteria c ON ar.areaid = c.areaid
             JOIN requirements r ON c.criteriaid = r.criteriaid
             JOIN compliancestatusoffices cso ON r.requirementid = cso.requirementid
             WHERE cso.officeid = ?
             GROUP BY u.userid, u.firstname, u.lastname, u.Email, u.profilepic`,
            [officeid]
        );
        const auditorMap = new Map();
        (rows || []).forEach(r => {
            const uid = r.userid ?? r.userid ?? r.id;
            if (uid && !auditorMap.has(uid)) {
                auditorMap.set(uid, {
                    userid: uid,
                    firstname: r.firstname ?? r.firstname ?? '',
                    lastname: r.lastname ?? r.lastname ?? '',
                    Email: r.Email ?? r.email ?? '',
                    profilepic: r.profilepic ?? r.profilepic ?? null,
                    areacode: r.areacode ?? r.areacode ?? '',
                    areaname: r.areaname ?? r.areaname ?? '',
                });
            }
        });
        const actorRole = Number(req.user?.roleid || 0);
        const actorId = Number(req.user?.userid || req.user?.id || 0);
        let auditorsList = Array.from(auditorMap.values());
        if (actorRole !== 1) {
            if (actorRole === 4) {
                // Auditor only sees themselves if assigned
                auditorsList = auditorsList.filter(a => Number(a.userid) === actorId);
            } else {
                // Personnel cannot see auditors
                auditorsList = [];
            }
        }
        res.json({ success: true, auditors: auditorsList });
    } catch (err) {
        console.error('Error fetching office auditors:', err);
        res.status(500).json({ success: false, auditors: [] });
    }
});

// POST assign auditor to areas (accepts areaIds array)
router.post('/assign', auth, restrictAuditor, async (req, res) => {
    try {
        await ensureAssignmentsTable();
        const { userid, areaIds } = req.body || {};
        if (!userid || !Array.isArray(areaIds)) {
            return res.status(400).json({ success: false, message: 'userid and areaIds array are required' });
        }

        // Delete existing area assignments for this auditor
        await db.query('DELETE FROM auditorareaassignments WHERE auditoruserid = ?', [userid]);

        // Insert new area assignments & reassign any area from other auditors
        if (areaIds.length > 0) {
            for (const areaid of areaIds) {
                await db.query(
                    'DELETE FROM auditorareaassignments WHERE areaid = ? AND auditoruserid != ?',
                    [areaid, userid]
                );
                await db.query(
                    'INSERT IGNORE INTO auditorareaassignments (auditoruserid, areaid, assignedby) VALUES (?, ?, ?)',
                    [userid, areaid, req.user?.userid || null]
                );
            }
        }

        // Fetch updated assigned area names for response/logging
        const [assignedAreas] = await db.query(
            `SELECT ar.areaid, ar.areacode, ar.areaname 
             FROM auditorareaassignments a 
             JOIN areas ar ON a.areaid = ar.areaid 
             WHERE a.auditoruserid = ?`,
            [userid]
        );

        if (req.user?.userid) {
            try {
                const [auditorUserRows] = await db.query(
                    'SELECT firstname, lastname, Email FROM users WHERE userid = ?',
                    [userid]
                );
                const auditorRow = auditorUserRows?.[0];
                const auditorName = auditorRow 
                    ? `${auditorRow.firstname || ''} ${auditorRow.lastname || ''}`.trim() || auditorRow.Email
                    : `Auditor #${userid}`;

                recordLog(req.user.userid, 'AuditorAssignedAreas', {
                    AuditorUserID: Number(userid),
                    AuditorName: auditorName,
                    AssignedAreaCount: areaIds.length,
                    Areas: assignedAreas
                });
            } catch (e) {
                console.error('Failed to record AuditorAssignedAreas log:', e);
            }
        }

        try {
            const { createNotifications } = require('../utils/notificationService');
            const targetAuditorId = Number(userid);

            if (assignedAreas.length > 0) {
                const areaNames = assignedAreas
                    .map(a => a.areacode ? (a.areaname ? `${a.areacode} (${a.areaname})` : a.areacode) : a.areaname)
                    .filter(Boolean)
                    .join(', ');

                let firstOfficeId = null;
                try {
                    const areaIdList = assignedAreas.map(a => Number(a.areaid)).filter(Boolean);
                    if (areaIdList.length > 0) {
                        const [officeMatch] = await db.query(
                            `SELECT DISTINCT o.officeid 
                             FROM offices o
                             JOIN compliancestatusoffices cso ON o.officeid = cso.officeid
                             JOIN requirements r ON cso.requirementid = r.requirementid
                             JOIN criteria c ON r.criteriaid = c.criteriaid
                             WHERE c.areaid IN (?)
                             LIMIT 1`,
                            [areaIdList]
                        );
                        if (officeMatch && officeMatch.length > 0) {
                            firstOfficeId = officeMatch[0].officeid;
                        }
                    }
                } catch (e) {
                    console.warn('Could not resolve first office for auditor assignment notification:', e.message);
                }

                await createNotifications({
                    userIds: [targetAuditorId],
                    adminid: req.user?.userid || null,
                    title: 'Auditor Area Assignment',
                    message: `You have been assigned as the external auditor for: ${areaNames}.`,
                    type: 'info',
                    relatedtable: 'auditor_assignments',
                    relatedid: targetAuditorId,
                    meta: {
                        userid: targetAuditorId,
                        assignedCount: assignedAreas.length,
                        areaIds: assignedAreas.map(a => Number(a.areaid)),
                        officeid: firstOfficeId,
                        openSubmission: false
                    }
                });
            } else {
                await createNotifications({
                    userIds: [targetAuditorId],
                    adminid: req.user?.userid || null,
                    title: 'Auditor Assignments Updated',
                    message: 'Your assigned areas have been updated (no active areas currently assigned).',
                    type: 'info',
                    relatedtable: 'auditor_assignments',
                    relatedid: targetAuditorId,
                    meta: {
                        userid: targetAuditorId,
                        assignedCount: 0,
                        areaIds: [],
                        openSubmission: false
                    }
                });
            }
        } catch (notifErr) {
            console.error('Failed to notify auditor about area assignments:', notifErr);
        }

        res.json({
            success: true,
            message: 'Auditor areas assigned successfully',
            assignedAreas
        });
    } catch (err) {
        console.error('Error assigning auditor areas:', err);
        res.status(500).json({ success: false, message: 'Failed to assign auditor areas', error: err.message });
    }
});

// POST add area
router.post('/add', auth, restrictAuditor, AreasController.addArea);

// DELETE multiple areas
router.post('/delete', auth, restrictAuditor, AreasController.deleteAreas);

// UPDATE area
router.put('/:areaid', auth, restrictAuditor, async (req, res) => {
    try {
        const { areaid } = req.params;
        const { areacode, areaname } = req.body;
        const description = req.body.description ?? req.body.Description ?? null;

        if (!areacode || !areaname) {
            return res.status(400).json({
                success: false,
                message: 'Area code and area name are required.'
            });
        }

        let result;
        try {
            // Preferred query for schemas with updatedat column
            [result] = await db.query(
                `UPDATE areas
                 SET areacode = ?, areaname = ?, description = ?, updatedat = NOW()
                 WHERE areaid = ? AND isactive = TRUE`,
                [areacode, areaname, description, areaid]
            );
        } catch (updateErr) {
            // Fallback for schemas without updatedat column
            [result] = await db.query(
                `UPDATE areas
                 SET areacode = ?, areaname = ?, description = ?
                 WHERE areaid = ? AND isactive = TRUE`,
                [areacode, areaname, description, areaid]
            );
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Area not found or inactive.'
            });
        }

        const [rows] = await db.query(
            `SELECT areaid, areacode, areaname, eventid, description, sortorder, createdat, updatedat
             FROM areas
             WHERE areaid = ?`,
            [areaid]
        );

        const areaRow = rows && rows[0] ? {
            ...rows[0],
            description: rows[0].description ?? description,
            Description: rows[0].description ?? description
        } : null;

        if (req.user && req.user.userid) {
            try { recordLog(req.user.userid, 'AreaUpdated', { areaid: areaid, areaname }); } catch (e) {}
        }
        return res.json({ success: true, data: areaRow });
    } catch (error) {
        console.error('Error updating area:', error);
        if (error && error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                success: false,
                message: 'Area code already exists.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to update area',
            error: error.message
        });
    }
});

// GET all areas
router.get('/', auth, async (req, res) => {
    try {
        const roleid = Number(req.user?.roleid || 0);
        const userid = Number(req.user?.userid || 0);

        let auditorFilter = '';
        const params = [];

        if (roleid === 4) {
            auditorFilter = ' AND ar.areaid IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)';
            params.push(userid);
        }

        const [areas] = await db.query(`
            SELECT 
                ar.areaid,
                ar.areacode,
                ar.areaname,
                ar.eventid,
                ar.Description,
                ar.sortorder,
                ar.createdat,
                ar.updatedat,
                aaa.auditoruserid AS AuditorUserID,
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS AuditorName
            FROM areas ar
            LEFT JOIN auditorareaassignments aaa ON ar.areaid = aaa.areaid
            LEFT JOIN users u ON aaa.auditoruserid = u.userid
            WHERE ar.isactive = TRUE ${auditorFilter}
            ORDER BY ar.sortorder ASC, ar.areacode ASC
        `, params);
        const formatted = (areas || []).map(a => ({
            ...a,
            description: a.description ?? a.Description ?? '',
            Description: a.description ?? a.Description ?? ''
        }));
        res.json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error('Error fetching areas:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch areas',
            error: error.message
        });
    }
});

// GET areas by event ID
router.get('/event/:eventid', auth, async (req, res) => {
    try {
        const { eventid } = req.params;
        const roleid = Number(req.user?.roleid || 0);
        const userid = Number(req.user?.userid || 0);

        let auditorFilter = '';
        const params = [eventid];

        if (roleid === 4) {
            auditorFilter = ' AND ar.areaid IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)';
            params.push(userid);
        }

        const [areas] = await db.query(`
            SELECT 
                ar.areaid,
                ar.areacode,
                ar.areaname,
                ar.eventid,
                ar.description,
                ar.sortorder,
                ar.createdat,
                ar.updatedat,
                aaa.auditoruserid AS AuditorUserID,
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS AuditorName
            FROM areas ar
            LEFT JOIN auditorareaassignments aaa ON ar.areaid = aaa.areaid
            LEFT JOIN users u ON aaa.auditoruserid = u.userid
            WHERE ar.eventid = ? AND ar.isactive = TRUE ${auditorFilter}
            ORDER BY ar.sortorder ASC, ar.areacode ASC
        `, params);

        const formatted = (areas || []).map(a => ({
            ...a,
            description: a.description ?? a.Description ?? '',
            Description: a.description ?? a.Description ?? ''
        }));

        res.json({
            success: true,
            data: formatted
        });
    } catch (error) {
        console.error('Error fetching areas for event:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch areas for event',
            error: error.message
        });
    }
});

// GET area by ID
router.get('/:areaid', auth, async (req, res) => {
    try {
        const { areaid } = req.params;
        const roleid = Number(req.user?.roleid || 0);
        const userid = Number(req.user?.userid || 0);

        if (roleid === 4) {
            const [check] = await db.query(
                'SELECT 1 FROM auditorareaassignments WHERE areaid = ? AND auditoruserid = ? LIMIT 1',
                [areaid, userid]
            );
            if (!check || check.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: You are not assigned to this area.'
                });
            }
        }

        const [areas] = await db.query(`
            SELECT 
                areaid,
                areacode,
                areaname,
                eventid,
                Description,
                sortorder,
                createdat,
                updatedat
            FROM areas
            WHERE areaid = ? AND isactive = TRUE
        `, [areaid]);

        if (areas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Area not found'
            });
        }

        res.json({
            success: true,
            data: areas[0]
        });
    } catch (error) {
        console.error('Error fetching area:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch area',
            error: error.message
        });
    }
});

module.exports = router;
