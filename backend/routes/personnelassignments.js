const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, requireAdmin } = require('../middleware/auth');
const { recordLog } = require('../controllers/logsController');
const { createNotifications } = require('../utils/notificationService');

// Ensure personnelassignments table and unique index exist
const ensureAssignmentsTable = async () => {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS personnelassignments (
                id SERIAL PRIMARY KEY,
                userid INT NOT NULL,
                eventid INT NOT NULL,
                areaid INT DEFAULT NULL,
                criteriaid INT DEFAULT NULL,
                requirementid INT DEFAULT NULL,
                assignedby INT DEFAULT NULL,
                createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await db.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_personnel_assignment 
            ON personnelassignments (userid, eventid, COALESCE(areaid, 0), COALESCE(criteriaid, 0), COALESCE(requirementid, 0));
        `);
    } catch (e) {
        console.error('Error ensuring personnelassignments table:', e);
    }
};
ensureAssignmentsTable();

// GET all personnel assignments for a specific accreditation event
router.get('/event/:eventid', auth, async (req, res) => {
    try {
        const { eventid } = req.params;
        const [rows] = await db.query(`
            SELECT 
                pa.id,
                pa.userid,
                pa.eventid,
                pa.areaid,
                pa.criteriaid,
                pa.requirementid,
                pa.assignedby,
                pa.createdat,
                u.firstname,
                u.lastname,
                u.email,
                u.profilepic,
                COALESCE(ar.areacode, cr_ar.areacode, rq_ar.areacode) AS areacode,
                COALESCE(ar.areaname, cr_ar.areaname, rq_ar.areaname) AS areaname,
                COALESCE(cr.criteriacode, rq_cr.criteriacode) AS criteriacode,
                COALESCE(cr.criterianame, rq_cr.criterianame) AS criterianame,
                rq.requirementcode,
                rq.description AS requirementdescription
            FROM personnelassignments pa
            JOIN users u ON pa.userid = u.userid
            LEFT JOIN areas ar ON pa.areaid = ar.areaid
            LEFT JOIN criteria cr ON pa.criteriaid = cr.criteriaid
            LEFT JOIN areas cr_ar ON cr.areaid = cr_ar.areaid
            LEFT JOIN requirements rq ON pa.requirementid = rq.requirementid
            LEFT JOIN criteria rq_cr ON rq.criteriaid = rq_cr.criteriaid
            LEFT JOIN areas rq_ar ON rq_cr.areaid = rq_ar.areaid
            WHERE pa.eventid = ?
            ORDER BY pa.createdat ASC
        `, [eventid]);

        const actorRole = Number(req.user?.roleid || 0);
        const actorId = Number(req.user?.userid || req.user?.id || 0);
        let data = rows || [];
        if (actorRole !== 1) {
            if (actorRole === 4) {
                // Auditor cannot see personnel assignments
                data = [];
            } else {
                // Personnel can only see their own assignments
                data = data.filter(pa => Number(pa.userid) === actorId);
            }
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching event personnel assignments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: err.message });
    }
});

// GET all assignments for a specific personnel user
router.get('/user/:userid', auth, async (req, res) => {
    try {
        const { userid } = req.params;
        const actorRole = Number(req.user?.roleid || 0);
        const actorId = Number(req.user?.userid || req.user?.id || 0);

        // Non-admins can only view their own assignments
        if (actorRole !== 1 && actorId !== Number(userid)) {
            return res.json({ success: true, data: [] });
        }
        const eventid = req.query.eventid ? Number(req.query.eventid) : null;

        const params = [userid];
        let eventFilter = '';
        if (eventid) {
            eventFilter = 'AND pa.eventid = ?';
            params.push(eventid);
        }

        const [rows] = await db.query(`
            SELECT 
                pa.id,
                pa.userid,
                pa.eventid,
                pa.areaid,
                pa.criteriaid,
                pa.requirementid,
                pa.createdat,
                e.eventname,
                e.eventcode,
                COALESCE(ar.areacode, cr_ar.areacode, rq_ar.areacode) AS areacode,
                COALESCE(ar.areaname, cr_ar.areaname, rq_ar.areaname) AS areaname,
                COALESCE(cr.criteriacode, rq_cr.criteriacode) AS criteriacode,
                COALESCE(cr.criterianame, rq_cr.criterianame) AS criterianame,
                rq.requirementcode,
                rq.description AS requirementdescription
            FROM personnelassignments pa
            LEFT JOIN events e ON pa.eventid = e.eventid
            LEFT JOIN areas ar ON pa.areaid = ar.areaid
            LEFT JOIN criteria cr ON pa.criteriaid = cr.criteriaid
            LEFT JOIN areas cr_ar ON cr.areaid = cr_ar.areaid
            LEFT JOIN requirements rq ON pa.requirementid = rq.requirementid
            LEFT JOIN criteria rq_cr ON rq.criteriaid = rq_cr.criteriaid
            LEFT JOIN areas rq_ar ON rq_cr.areaid = rq_ar.areaid
            WHERE pa.userid = ? ${eventFilter}
            ORDER BY pa.createdat DESC
        `, params);

        res.json({ success: true, data: rows || [] });
    } catch (err) {
        console.error('Error fetching user personnel assignments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: err.message });
    }
});

// GET current logged-in personnel user's assigned scope and derived requirement IDs
router.get('/my-assignments', auth, async (req, res) => {
    try {
        const userid = req.user?.userid || req.user?.id;
        if (!userid) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const [directRows] = await db.query(`
            SELECT 
                pa.id,
                pa.userid,
                pa.eventid,
                pa.areaid,
                pa.criteriaid,
                pa.requirementid,
                pa.createdat,
                e.eventname,
                e.eventcode,
                COALESCE(ar.areacode, cr_ar.areacode, rq_ar.areacode) AS areacode,
                COALESCE(ar.areaname, cr_ar.areaname, rq_ar.areaname) AS areaname,
                COALESCE(cr.criteriacode, rq_cr.criteriacode) AS criteriacode,
                COALESCE(cr.criterianame, rq_cr.criterianame) AS criterianame,
                rq.requirementcode,
                rq.description AS requirementdescription
            FROM personnelassignments pa
            LEFT JOIN events e ON pa.eventid = e.eventid
            LEFT JOIN areas ar ON pa.areaid = ar.areaid
            LEFT JOIN criteria cr ON pa.criteriaid = cr.criteriaid
            LEFT JOIN areas cr_ar ON cr.areaid = cr_ar.areaid
            LEFT JOIN requirements rq ON pa.requirementid = rq.requirementid
            LEFT JOIN criteria rq_cr ON rq.criteriaid = rq_cr.criteriaid
            LEFT JOIN areas rq_ar ON rq_cr.areaid = rq_ar.areaid
            WHERE pa.userid = ?
        `, [userid]);

        const assignedAreaIds = new Set();
        const assignedCriteriaIds = new Set();
        const assignedRequirementIds = new Set();
        const assignedEventIds = new Set();

        (directRows || []).forEach(row => {
            if (row.eventid) assignedEventIds.add(Number(row.eventid));
            if (row.areaid) assignedAreaIds.add(Number(row.areaid));
            if (row.criteriaid) assignedCriteriaIds.add(Number(row.criteriaid));
            if (row.requirementid) assignedRequirementIds.add(Number(row.requirementid));
        });

        // 1. If assigned to an Area, resolve all sub-areas and requirements under that Area
        if (assignedAreaIds.size > 0) {
            const areaIdArr = Array.from(assignedAreaIds);
            const [areaReqs] = await db.query(`
                SELECT r.requirementid, c.criteriaid, c.areaid, c.eventid
                FROM requirements r
                JOIN criteria c ON r.criteriaid = c.criteriaid
                WHERE c.areaid IN (${areaIdArr.map(() => '?').join(',')})
            `, areaIdArr);

            (areaReqs || []).forEach(r => {
                assignedRequirementIds.add(Number(r.requirementid));
                assignedCriteriaIds.add(Number(r.criteriaid));
                if (r.eventid) assignedEventIds.add(Number(r.eventid));
            });
        }

        // 2. If assigned to a Criteria, resolve all requirements under that Criteria (and its sub-criteria)
        if (assignedCriteriaIds.size > 0) {
            const critIdArr = Array.from(assignedCriteriaIds);
            const [critReqs] = await db.query(`
                SELECT r.requirementid, c.criteriaid, c.eventid
                FROM requirements r
                JOIN criteria c ON r.criteriaid = c.criteriaid
                WHERE c.criteriaid IN (${critIdArr.map(() => '?').join(',')})
                   OR c.parentcriteriaid IN (${critIdArr.map(() => '?').join(',')})
            `, [...critIdArr, ...critIdArr]);

            (critReqs || []).forEach(r => {
                assignedRequirementIds.add(Number(r.requirementid));
                if (r.criteriaid) assignedCriteriaIds.add(Number(r.criteriaid));
                if (r.eventid) assignedEventIds.add(Number(r.eventid));
            });
        }

        const assignedOfficeIds = new Set();

        if (assignedRequirementIds.size > 0) {
            const reqIdArr = Array.from(assignedRequirementIds);
            const [csoRows] = await db.query(`
                SELECT DISTINCT officeid
                FROM compliancestatusoffices
                WHERE requirementid IN (${reqIdArr.map(() => '?').join(',')})
            `, reqIdArr);

            (csoRows || []).forEach(r => {
                if (r.officeid) assignedOfficeIds.add(Number(r.officeid));
            });
        }

        if (assignedEventIds.size > 0) {
            const eventIdArr = Array.from(assignedEventIds);
            const [eventOfficeRows] = await db.query(`
                SELECT DISTINCT officeid
                FROM offices
                WHERE eventid IN (${eventIdArr.map(() => '?').join(',')})
            `, eventIdArr);

            (eventOfficeRows || []).forEach(r => {
                if (r.officeid) assignedOfficeIds.add(Number(r.officeid));
            });
        }

        res.json({
            success: true,
            directAssignments: directRows || [],
            assignedAreaIds: Array.from(assignedAreaIds),
            assignedCriteriaIds: Array.from(assignedCriteriaIds),
            assignedRequirementIds: Array.from(assignedRequirementIds),
            assignedEventIds: Array.from(assignedEventIds),
            assignedOfficeIds: Array.from(assignedOfficeIds)
        });
    } catch (err) {
        console.error('Error fetching my personnel assignments:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments', error: err.message });
    }
});

// POST assign one or more personnel to a target Area, Sub-area, or Standard
router.post('/assign', auth, requireAdmin, async (req, res) => {
    try {
        const { eventid, userIds, areaid = null, criteriaid = null, requirementid = null } = req.body;
        const assignedby = req.user?.userid || req.user?.id || null;

        if (!eventid || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Event ID and at least one user ID are required.' });
        }

        if (!areaid && !criteriaid && !requirementid) {
            return res.status(400).json({ success: false, message: 'Must specify an area, sub-area, or standard to assign.' });
        }

        const validUserIds = [...new Set(userIds.map(Number).filter(id => id > 0))];
        const numEventId = Number(eventid);
        const targetAreaId = areaid ? Number(areaid) : null;
        const targetCriteriaId = criteriaid ? Number(criteriaid) : null;
        const targetReqId = requirementid ? Number(requirementid) : null;

        for (const uid of validUserIds) {
            await db.query(`
                INSERT INTO personnelassignments (userid, eventid, areaid, criteriaid, requirementid, assignedby)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT DO NOTHING
            `, [uid, numEventId, targetAreaId, targetCriteriaId, targetReqId, assignedby]);
        }

        // Fetch context info for audit logs and notifications
        let eventName = '';
        try {
            const [evRows] = await db.query('SELECT eventname, eventcode FROM events WHERE eventid = ?', [numEventId]);
            eventName = evRows[0]?.eventname || `Event #${numEventId}`;
        } catch (e) {}

        let targetType = 'Area';
        let targetLabel = '';
        let targetCode = '';
        let targetName = '';

        if (targetReqId) {
            targetType = 'Standard';
            try {
                const [rRows] = await db.query('SELECT requirementcode, description FROM requirements WHERE requirementid = ?', [targetReqId]);
                targetCode = rRows[0]?.requirementcode || `REQ-${targetReqId}`;
                targetName = rRows[0]?.description || '';
                targetLabel = `Standard ${targetCode}`;
            } catch (e) {
                targetLabel = `Standard #${targetReqId}`;
            }
        } else if (targetCriteriaId) {
            targetType = 'Sub-Area';
            try {
                const [cRows] = await db.query('SELECT criteriacode, criterianame FROM criteria WHERE criteriaid = ?', [targetCriteriaId]);
                targetCode = cRows[0]?.criteriacode || '';
                targetName = cRows[0]?.criterianame || '';
                targetLabel = targetCode && targetName ? `Sub-Area ${targetCode}. ${targetName}` : `Sub-Area ${targetCode || targetName || targetCriteriaId}`;
            } catch (e) {
                targetLabel = `Sub-Area #${targetCriteriaId}`;
            }
        } else if (targetAreaId) {
            targetType = 'Area';
            try {
                const [aRows] = await db.query('SELECT areacode, areaname FROM areas WHERE areaid = ?', [targetAreaId]);
                targetCode = aRows[0]?.areacode || '';
                targetName = aRows[0]?.areaname || '';
                targetLabel = targetCode && targetName ? `Area ${targetCode} (${targetName})` : `Area ${targetCode || targetName || targetAreaId}`;
            } catch (e) {
                targetLabel = `Area #${targetAreaId}`;
            }
        }

        // Fetch user names for audit log
        let userDisplayNames = [];
        try {
            const [uRows] = await db.query(
                `SELECT userid, firstname, lastname, email FROM users WHERE userid IN (${validUserIds.map(() => '?').join(',')})`,
                validUserIds
            );
            userDisplayNames = (uRows || []).map(u => `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email || `User #${u.userid}`);
        } catch (e) {}

        // Audit Log
        try {
            await recordLog(assignedby, 'PersonnelAssigned', {
                eventid: numEventId,
                eventname: eventName,
                areaid: targetAreaId,
                areaname: targetAreaId ? targetName : null,
                areacode: targetAreaId ? targetCode : null,
                criteriaid: targetCriteriaId,
                criterianame: targetCriteriaId ? targetName : null,
                criteriacode: targetCriteriaId ? targetCode : null,
                requirementid: targetReqId,
                requirementcode: targetReqId ? targetCode : null,
                targetType,
                targetLabel,
                assignedUserIds: validUserIds,
                assignedUserNames: userDisplayNames,
                count: validUserIds.length
            });
        } catch (lErr) {
            console.error('Failed to record log for assign personnel:', lErr);
        }

        // Send notifications to assigned personnel
        try {
            await createNotifications({
                userIds: validUserIds,
                adminid: assignedby,
                title: 'New Accreditation Assignment',
                message: `You have been assigned to ${targetLabel} for accreditation event "${eventName}".`,
                type: 'info',
                relatedtable: 'personnelassignments',
                relatedid: numEventId,
                meta: {
                    eventid: numEventId,
                    areaid: targetAreaId,
                    criteriaid: targetCriteriaId,
                    requirementid: targetReqId,
                    openEvent: true
                }
            });
        } catch (nErr) {
            console.error('Failed to notify assigned personnel:', nErr);
        }

        res.json({ success: true, message: 'Personnel assigned successfully.' });
    } catch (err) {
        console.error('Error assigning personnel:', err);
        res.status(500).json({ success: false, message: 'Failed to assign personnel', error: err.message });
    }
});

// POST sync scope for a specific personnel user across an event
router.post('/sync-scope', auth, requireAdmin, async (req, res) => {
    try {
        const { userid, eventid, areaIds = [], criteriaIds = [], requirementIds = [] } = req.body;
        const assignedby = req.user?.userid || req.user?.id || null;

        if (!userid || !eventid) {
            return res.status(400).json({ success: false, message: 'User ID and Event ID are required.' });
        }

        const numUserId = Number(userid);
        const numEventId = Number(eventid);

        // Remove existing assignments for this user and event
        await db.query(`
            DELETE FROM personnelassignments 
            WHERE userid = ? AND eventid = ?
        `, [numUserId, numEventId]);

        // Insert new area assignments
        const uniqueAreaIds = [...new Set((areaIds || []).map(Number).filter(id => id > 0))];
        for (const aid of uniqueAreaIds) {
            await db.query(`
                INSERT INTO personnelassignments (userid, eventid, areaid, criteriaid, requirementid, assignedby)
                VALUES (?, ?, ?, NULL, NULL, ?)
                ON CONFLICT DO NOTHING
            `, [numUserId, numEventId, aid, assignedby]);
        }

        // Insert new criteria assignments
        const uniqueCriteriaIds = [...new Set((criteriaIds || []).map(Number).filter(id => id > 0))];
        for (const cid of uniqueCriteriaIds) {
            await db.query(`
                INSERT INTO personnelassignments (userid, eventid, areaid, criteriaid, requirementid, assignedby)
                VALUES (?, ?, NULL, ?, NULL, ?)
                ON CONFLICT DO NOTHING
            `, [numUserId, numEventId, cid, assignedby]);
        }

        // Insert new requirement assignments
        const uniqueReqIds = [...new Set((requirementIds || []).map(Number).filter(id => id > 0))];
        for (const rid of uniqueReqIds) {
            await db.query(`
                INSERT INTO personnelassignments (userid, eventid, areaid, criteriaid, requirementid, assignedby)
                VALUES (?, ?, NULL, NULL, ?, ?)
                ON CONFLICT DO NOTHING
            `, [numUserId, numEventId, rid, assignedby]);
        }

        // Fetch user and event info
        let targetUserName = `User #${numUserId}`;
        let eventName = `Event #${numEventId}`;
        try {
            const [uRows] = await db.query('SELECT firstname, lastname, email FROM users WHERE userid = ?', [numUserId]);
            if (uRows.length > 0) {
                targetUserName = `${uRows[0].firstname || ''} ${uRows[0].lastname || ''}`.trim() || uRows[0].email || targetUserName;
            }
        } catch (e) {}

        try {
            const [eRows] = await db.query('SELECT eventname, eventcode FROM events WHERE eventid = ?', [numEventId]);
            if (eRows.length > 0) {
                eventName = eRows[0].eventname || eventName;
            }
        } catch (e) {}

        const totalAssigned = uniqueAreaIds.length + uniqueCriteriaIds.length + uniqueReqIds.length;

        // Audit Log
        try {
            await recordLog(assignedby, 'PersonnelScopeUpdated', {
                targetUserId: numUserId,
                targetUserName,
                eventid: numEventId,
                eventname: eventName,
                areaCount: uniqueAreaIds.length,
                criteriaCount: uniqueCriteriaIds.length,
                requirementCount: uniqueReqIds.length,
                totalAssigned,
                areaIds: uniqueAreaIds,
                criteriaIds: uniqueCriteriaIds,
                requirementIds: uniqueReqIds
            });
        } catch (lErr) {
            console.error('Failed to record log for sync scope:', lErr);
        }

        // Send notification to personnel
        try {
            await createNotifications({
                userIds: [numUserId],
                adminid: assignedby,
                title: 'Assignment Scope Updated',
                message: `Your assigned scope for accreditation "${eventName}" has been updated (${uniqueAreaIds.length} areas, ${uniqueCriteriaIds.length} sub-areas, ${uniqueReqIds.length} standards).`,
                type: 'info',
                relatedtable: 'personnelassignments',
                relatedid: numEventId,
                meta: {
                    eventid: numEventId,
                    openEvent: true
                }
            });
        } catch (nErr) {
            console.error('Failed to notify about sync scope:', nErr);
        }

        res.json({ success: true, message: 'Personnel scope updated successfully.' });
    } catch (err) {
        console.error('Error syncing personnel scope:', err);
        res.status(500).json({ success: false, message: 'Failed to sync personnel scope', error: err.message });
    }
});

// DELETE single assignment by ID
router.delete('/:id', auth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const assignedby = req.user?.userid || req.user?.id || null;

        const [existing] = await db.query('SELECT * FROM personnelassignments WHERE id = ?', [id]);
        if (existing.length > 0) {
            const row = existing[0];
            const numUserId = Number(row.userid);
            const numEventId = Number(row.eventid);

            let eventName = '';
            try {
                const [evRows] = await db.query('SELECT eventname FROM events WHERE eventid = ?', [numEventId]);
                eventName = evRows[0]?.eventname || `Event #${numEventId}`;
            } catch (e) {}

            let targetUserName = `User #${numUserId}`;
            try {
                const [uRows] = await db.query('SELECT firstname, lastname, email FROM users WHERE userid = ?', [numUserId]);
                if (uRows.length > 0) {
                    targetUserName = `${uRows[0].firstname || ''} ${uRows[0].lastname || ''}`.trim() || uRows[0].email || targetUserName;
                }
            } catch (e) {}

            let targetLabel = 'assignment';
            if (row.requirementid) targetLabel = `Standard #${row.requirementid}`;
            else if (row.criteriaid) targetLabel = `Sub-Area #${row.criteriaid}`;
            else if (row.areaid) targetLabel = `Area #${row.areaid}`;

            await db.query('DELETE FROM personnelassignments WHERE id = ?', [id]);

            try {
                await recordLog(assignedby, 'PersonnelUnassigned', {
                    targetUserId: numUserId,
                    targetUserName,
                    eventid: numEventId,
                    eventname: eventName,
                    areaid: row.areaid ? Number(row.areaid) : null,
                    criteriaid: row.criteriaid ? Number(row.criteriaid) : null,
                    requirementid: row.requirementid ? Number(row.requirementid) : null,
                    targetLabel
                });
            } catch (lErr) {}

            try {
                await createNotifications({
                    userIds: [numUserId],
                    adminid: assignedby,
                    title: 'Assignment Removed',
                    message: `You have been unassigned from ${targetLabel} in "${eventName}".`,
                    type: 'info',
                    relatedtable: 'personnelassignments',
                    relatedid: numEventId,
                    meta: { eventid: numEventId }
                });
            } catch (nErr) {}
        } else {
            await db.query('DELETE FROM personnelassignments WHERE id = ?', [id]);
        }

        res.json({ success: true, message: 'Assignment removed successfully.' });
    } catch (err) {
        console.error('Error removing assignment:', err);
        res.status(500).json({ success: false, message: 'Failed to remove assignment', error: err.message });
    }
});

// POST unassign specific personnel from an area, criteria, or standard
router.post('/unassign', auth, requireAdmin, async (req, res) => {
    try {
        const { eventid, userid, areaid = null, criteriaid = null, requirementid = null } = req.body;
        const assignedby = req.user?.userid || req.user?.id || null;

        if (!eventid || !userid) {
            return res.status(400).json({ success: false, message: 'Event ID and User ID are required.' });
        }

        const numUserId = Number(userid);
        const numEventId = Number(eventid);
        const targetAreaId = areaid ? Number(areaid) : null;
        const targetCriteriaId = criteriaid ? Number(criteriaid) : null;
        const targetReqId = requirementid ? Number(requirementid) : null;

        // Context info
        let eventName = '';
        try {
            const [evRows] = await db.query('SELECT eventname FROM events WHERE eventid = ?', [numEventId]);
            eventName = evRows[0]?.eventname || `Event #${numEventId}`;
        } catch (e) {}

        let targetUserName = `User #${numUserId}`;
        try {
            const [uRows] = await db.query('SELECT firstname, lastname, email FROM users WHERE userid = ?', [numUserId]);
            if (uRows.length > 0) {
                targetUserName = `${uRows[0].firstname || ''} ${uRows[0].lastname || ''}`.trim() || uRows[0].email || targetUserName;
            }
        } catch (e) {}

        let targetLabel = 'assignment';
        let targetName = '';
        let targetCode = '';
        if (targetReqId) {
            try {
                const [rRows] = await db.query('SELECT requirementcode, description FROM requirements WHERE requirementid = ?', [targetReqId]);
                targetCode = rRows[0]?.requirementcode || '';
                targetLabel = `Standard ${targetCode || targetReqId}`;
            } catch (e) {
                targetLabel = `Standard #${targetReqId}`;
            }
        } else if (targetCriteriaId) {
            try {
                const [cRows] = await db.query('SELECT criteriacode, criterianame FROM criteria WHERE criteriaid = ?', [targetCriteriaId]);
                targetCode = cRows[0]?.criteriacode || '';
                targetName = cRows[0]?.criterianame || '';
                targetLabel = targetCode && targetName ? `Sub-Area ${targetCode}. ${targetName}` : `Sub-Area ${targetCode || targetName || targetCriteriaId}`;
            } catch (e) {
                targetLabel = `Sub-Area #${targetCriteriaId}`;
            }
        } else if (targetAreaId) {
            try {
                const [aRows] = await db.query('SELECT areacode, areaname FROM areas WHERE areaid = ?', [targetAreaId]);
                targetCode = aRows[0]?.areacode || '';
                targetName = aRows[0]?.areaname || '';
                targetLabel = targetCode && targetName ? `Area ${targetCode} (${targetName})` : `Area ${targetCode || targetName || targetAreaId}`;
            } catch (e) {
                targetLabel = `Area #${targetAreaId}`;
            }
        }

        await db.query(`
            DELETE FROM personnelassignments
            WHERE eventid = ? AND userid = ?
              AND COALESCE(areaid, 0) = COALESCE(?, 0)
              AND COALESCE(criteriaid, 0) = COALESCE(?, 0)
              AND COALESCE(requirementid, 0) = COALESCE(?, 0)
        `, [numEventId, numUserId, targetAreaId, targetCriteriaId, targetReqId]);

        // Audit Log
        try {
            await recordLog(assignedby, 'PersonnelUnassigned', {
                targetUserId: numUserId,
                targetUserName,
                eventid: numEventId,
                eventname: eventName,
                areaid: targetAreaId,
                areaname: targetAreaId ? targetName : null,
                areacode: targetAreaId ? targetCode : null,
                criteriaid: targetCriteriaId,
                criterianame: targetCriteriaId ? targetName : null,
                criteriacode: targetCriteriaId ? targetCode : null,
                requirementid: targetReqId,
                requirementcode: targetReqId ? targetCode : null,
                targetLabel
            });
        } catch (lErr) {
            console.error('Failed to record log for unassign personnel:', lErr);
        }

        // Notification
        try {
            await createNotifications({
                userIds: [numUserId],
                adminid: assignedby,
                title: 'Assignment Removed',
                message: `You have been unassigned from ${targetLabel} in "${eventName}".`,
                type: 'info',
                relatedtable: 'personnelassignments',
                relatedid: numEventId,
                meta: {
                    eventid: numEventId
                }
            });
        } catch (nErr) {
            console.error('Failed to notify about unassign:', nErr);
        }

        res.json({ success: true, message: 'Personnel unassigned successfully.' });
    } catch (err) {
        console.error('Error unassigning personnel:', err);
        res.status(500).json({ success: false, message: 'Failed to unassign personnel', error: err.message });
    }
});

module.exports = router;
