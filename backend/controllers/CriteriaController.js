const db = require('../db');
const { recordLog } = require('./logsController');

// Delete criteria
const deleteCriteria = async (req, res) => {
  try {
    const { criteriaIds } = req.body;

    if (!criteriaIds || !Array.isArray(criteriaIds) || criteriaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid criteria IDs provided'
      });
    }

    // Clean up requirements under these criteria
    try {
      const placeholders = criteriaIds.map(() => '?').join(',');
      await db.query(`DELETE FROM officeproofdocuments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${placeholders}))`, criteriaIds);
      await db.query(`DELETE FROM requirementuserassignments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${placeholders}))`, criteriaIds);
      await db.query(`DELETE FROM compliancestatusoffices WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${placeholders}))`, criteriaIds);
      await db.query(`DELETE FROM requirements WHERE criteriaid IN (${placeholders})`, criteriaIds);
    } catch (cascadeErr) {
      console.error('Error during cascading requirement cleanup in deleteCriteria:', cascadeErr);
    }

    // Delete criteria
    const placeholders = criteriaIds.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM criteria WHERE criteriaid IN (${placeholders})`,
      criteriaIds
    );

    if (req.user && req.user.userid) {
        // Capture criteria details before deletion for verbose logging
        let deletedCriteria = [];
        try {
          const phol = criteriaIds.map(() => '?').join(',');
          const [critRows] = await db.query(
            `SELECT c.criteriaid, c.criteriacode, c.criterianame, a.areaname, e.eventname
             FROM criteria c
             LEFT JOIN areas a ON c.areaid = a.areaid
             LEFT JOIN Events e ON c.eventid = e.eventid
             WHERE c.criteriaid IN (${phol})`,
            criteriaIds
          );
          deletedCriteria = critRows.map(c => ({
            criteriacode: c.criteriacode,
            criterianame: c.criterianame,
            areaname: c.areaname,
            eventname: c.eventname,
          }));
        } catch (e) { console.warn('Could not fetch criteria details before deletion:', e.message); }
        try { recordLog(req.user.userid, 'CriteriaDeleted', { criteriaIds, deletedCriteria, deletedCount: criteriaIds.length }); } catch (e) {}
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.affectedRows} criteria(s)` ,
      deletedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting criteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting criteria'
    });
  }
};

// Get all criteria
const getAllCriteria = async (req, res) => {
  try {
    const roleid = Number(req.user?.roleid || 0);
    const userid = Number(req.user?.userid || 0);

    let auditorFilter = '';
    const params = [];

    if (roleid === 4) {
      auditorFilter = ' WHERE c.areaid IN (SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?)';
      params.push(userid);
    }

    const [criteria] = await db.query(`
      SELECT c.*, e.eventname, e.eventcode, a.areaid, a.areacode, a.areaname, parent.criteriacode AS ParentCriteriaCode
      FROM criteria c
      LEFT JOIN Events e ON c.eventid = e.eventid
      LEFT JOIN areas a ON c.areaid = a.areaid
      LEFT JOIN criteria parent ON c.parentcriteriaid = parent.criteriaid
      ${auditorFilter}
      ORDER BY c.criteriacode ASC
    `, params);
    const formatted = (criteria || []).map(c => ({
      ...c,
      description: c.description ?? c.Description ?? '',
      Description: c.description ?? c.Description ?? ''
    }));
    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching criteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching criteria'
    });
  }
};

// Get criteria by event
const getCriteriaByEvent = async (req, res) => {
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

    const [criteria] = await db.query(`
      SELECT c.*, e.eventname, e.eventcode, a.areaid, a.areacode, a.areaname, parent.criteriacode AS ParentCriteriaCode
      FROM criteria c
      LEFT JOIN Events e ON c.eventid = e.eventid
      LEFT JOIN areas a ON c.areaid = a.areaid
      LEFT JOIN criteria parent ON c.parentcriteriaid = parent.criteriaid
      WHERE c.eventid = ? ${auditorFilter}
      ORDER BY c.criteriacode ASC
    `, params);
    const formatted = (criteria || []).map(c => ({
      ...c,
      description: c.description ?? c.Description ?? '',
      Description: c.description ?? c.Description ?? ''
    }));
    res.json({
      success: true,
      data: formatted
    });
  } catch (error) {
    console.error('Error fetching criteria:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching criteria'
    });
  }
};

module.exports = {
  getAllCriteria,
  getCriteriaByEvent,
  deleteCriteria
};