const express = require('express');
const router = express.Router();
const db = require('../db');
const CriteriaController = require('../controllers/CriteriaController');
const { recordLog } = require('../controllers/logsController');
const { auth, restrictAuditor } = require('../middleware/auth');

// GET all criteria
router.get('/', auth, CriteriaController.getAllCriteria);

// GET criteria by event
router.get('/event/:eventid', auth, CriteriaController.getCriteriaByEvent);

// UPDATE criteria by ID
router.put('/:id', auth, restrictAuditor, async (req, res) => {
    try {
        const { id } = req.params;
        let { criteriacode, criterianame, areaid, parentcriteriaid, eventid } = req.body;
        const description = req.body.description ?? req.body.Description ?? null;

        const [existingRows] = await db.query(
            `SELECT c.criteriaid, c.criteriacode, c.criterianame, c.description, c.areaid, c.parentcriteriaid, c.eventid, e.eventname
             FROM criteria c
             LEFT JOIN Events e ON c.eventid = e.eventid
             WHERE c.criteriaid = ?
             LIMIT 1`,
            [id]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Criteria not found.'
            });
        }

        const existing = existingRows[0];

        // normalize criteriacode to uppercase and trim
        if (criteriacode !== undefined && criteriacode !== null) {
            criteriacode = String(criteriacode).trim().toUpperCase();
        }
        // Ensure areaid, parentcriteriaid, and description are normalized
        if (areaid === '' || areaid === 'null' || areaid === undefined) areaid = null;
        if (parentcriteriaid === '' || parentcriteriaid === 'null' || parentcriteriaid === undefined) parentcriteriaid = null;
        const safeDescription = description && String(description).trim() !== '' ? description : null;

        // Check duplicate code if modified and provided
        if (criteriacode && criteriacode !== String(existing.criteriacode).toUpperCase()) {
            const targetEventId = eventid || existing.eventid;
            const [dup] = await db.query(
                `SELECT criteriaid FROM criteria WHERE eventid = ? AND LOWER(criteriacode) = LOWER(?) AND criteriaid != ? LIMIT 1`,
                [targetEventId, criteriacode, id]
            );
            if (dup.length > 0) {
                return res.status(400).json({ success: false, message: 'A criteria with this code already exists for the selected event.' });
            }
        }

        await db.query(
            `UPDATE criteria
             SET eventid = COALESCE(?, eventid),
                 areaid = ?,
                 parentcriteriaid = ?,
                 criteriacode = COALESCE(?, criteriacode),
                 criterianame = COALESCE(?, criterianame),
                 description = ?
             WHERE criteriaid = ?`,
            [eventid || null, areaid, parentcriteriaid, criteriacode || null, criterianame || null, safeDescription, id]
        );

        const [updatedRows] = await db.query(
            `SELECT c.criteriaid, c.criteriacode, c.criterianame, c.description, c.areaid, c.parentcriteriaid, c.eventid, e.eventname
             FROM criteria c
             LEFT JOIN Events e ON c.eventid = e.eventid
             WHERE c.criteriaid = ?
             LIMIT 1`,
            [id]
        );

        if (req.user && req.user.userid) {
            try {
                recordLog(req.user.userid, 'CriteriaUpdated', {
                    criteriaid: id,
                    criteriacode: criteriacode || existing.criteriacode,
                    criterianame: criterianame || existing.criterianame,
                    eventid: eventid || existing.eventid,
                    eventname: existing.eventname
                });
            } catch (e) {}
        }

        const criteriaData = updatedRows && updatedRows[0] ? {
            ...updatedRows[0],
            description: updatedRows[0].description ?? safeDescription,
            Description: updatedRows[0].description ?? safeDescription
        } : null;

        res.json({
            success: true,
            message: 'Criteria updated successfully',
            data: criteriaData
        });
    } catch (error) {
        console.error('Error updating criteria:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating criteria: ' + (error && error.message ? error.message : String(error))
        });
    }
});

// DELETE criteria (bulk)
router.delete('/delete', auth, restrictAuditor, CriteriaController.deleteCriteria);

// GET criteria by area
router.get('/area/:areaid', auth, async (req, res) => {
    try {
        const { areaid } = req.params;
        
        const [criteria] = await db.query(`
            SELECT 
                criteriaid,
                criteriacode,
                criterianame,
                eventid,
                areaid,
                parentcriteriaid,
                Description,
                createdat,
                updatedat
            FROM criteria
            WHERE areaid = ? AND isactive = TRUE
            ORDER BY criteriacode ASC
        `, [areaid]);

        res.json({
            success: true,
            data: criteria
        });
    } catch (error) {
        console.error('Error fetching criteria:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch criteria',
            error: error.message
        });
    }
});

// POST add new criteria (areaid optional)
router.post('/add', auth, restrictAuditor, async (req, res) => {
    try {
        let { eventid, areaid, criteriacode, criterianame, parentcriteriaid } = req.body;
        const description = req.body.description ?? req.body.Description ?? null;
        if (criteriacode !== undefined && criteriacode !== null) {
            criteriacode = String(criteriacode).trim().toUpperCase();
        }
        if (parentcriteriaid === '' || parentcriteriaid === 'null' || parentcriteriaid === undefined) parentcriteriaid = null;
        if (!eventid || !criterianame || (parentcriteriaid == null && !criteriacode)) {
            return res.status(400).json({
                success: false,
                message: parentcriteriaid == null ? 'Event, Criteria Code, and Name are required.' : 'Event and Criteria Name are required.'
            });
        }
        const safeDescription = description && String(description).trim() !== '' ? description : null;
        if (criteriacode) {
            const [existingDup] = await db.query(
                `SELECT criteriaid FROM criteria WHERE eventid = ? AND LOWER(criteriacode) = LOWER(?) LIMIT 1`,
                [eventid, criteriacode]
            );
            if (existingDup.length > 0) {
                return res.status(400).json({ success: false, message: 'A criteria with this code already exists for the selected event.' });
            }
        }

        const [result] = await db.query(
            `INSERT INTO criteria (eventid, areaid, criteriacode, criterianame, description, parentcriteriaid)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [eventid, areaid || null, criteriacode || null, criterianame, safeDescription, parentcriteriaid]
        );

        let eventname = null;
        try {
            const [eventRows] = await db.query(
                'SELECT eventname FROM Events WHERE eventid = ? LIMIT 1',
                [eventid]
            );
            eventname = eventRows[0]?.eventname || null;
        } catch (e) {
            eventname = null;
        }

        res.json({
            success: true,
            message: 'Criteria added successfully',
            data: {
                criteriaid: result.insertId,
                eventid,
                areaid: areaid || null,
                criteriacode,
                criterianame,
                description: safeDescription,
                Description: safeDescription,
                parentcriteriaid: parentcriteriaid || null
            }
        });
        if (req.user && req.user.userid) {
            try {
                recordLog(req.user.userid, 'CriteriaAdded', {
                    criteriaid: result.insertId,
                    criteriacode,
                    criterianame,
                    eventid,
                    eventname: eventname
                });
            } catch (e) {}
        }
    } catch (error) {
        console.error('Error adding criteria:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding criteria',
            error: error.message
        });
    }
});

module.exports = router;
