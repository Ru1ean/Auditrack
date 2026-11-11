const db = require("../db");
const ExcelJS = require("exceljs");
const { recordLog } = require('./logsController');
const { createNotifications } = require('../utils/notificationService');
const { autoAssignHeadsToRequirementsForOffice } = require('./RequirementsController');
const fs = require('fs');
const path = require('path');
const MAX_HEADS_PER_OFFICE = 4;

const normalizeComplianceStatus = (statusid, statusname) => {
  const id = Number(statusid);
  if (id === 5) return 'Compiled';
  if (id === 4) return 'Partially Compiled';
  if (id === 3) return 'Not Compiled';

  const normalized = String(statusname || '').trim().toLowerCase();
  if (normalized.includes('partial')) return 'Partially Compiled';
  if (normalized.includes('not')) return 'Not Compiled';
  if (normalized.includes('comp')) return 'Compiled';
  return 'Not Compiled';
};

const normalizeHeadIds = (headIds, headid) => {
  const source = Array.isArray(headIds) ? headIds : (headid != null ? [headid] : []);
  return [...new Set(source.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
};

const formatUserName = (row) => {
  if (!row) return 'Unknown';
  const first = String(row.firstname || '').trim();
  const middle = String(row.middleinitial || '').trim();
  const last = String(row.lastname || '').trim();
  return `${first}${middle ? ` ${middle}.` : ''} ${last}`.replace(/\s+/g, ' ').trim() || 'Unknown';
};

const getNamesByHeadIds = async (headIds = []) => {
  if (!Array.isArray(headIds) || headIds.length === 0) return [];
  const placeholders = headIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT h.headid, u.firstname, u.middleinitial, u.lastname
     FROM headofoffice h
     LEFT JOIN users u ON h.userid = u.userid
     WHERE h.headid IN (${placeholders})`,
    headIds
  );
  const map = new Map(rows.map((row) => [Number(row.headid), formatUserName(row)]));
  return headIds.map((id) => map.get(Number(id)) || `Head #${id}`);
};

const getHeadAssignmentDetailsByHeadIds = async (headIds = []) => {
  if (!Array.isArray(headIds) || headIds.length === 0) return [];
  const placeholders = headIds.map(() => '?').join(',');
  const [rows] = await db.query(
    `SELECT h.headid, h.userid, u.firstname, u.middleinitial, u.lastname
     FROM headofoffice h
     LEFT JOIN users u ON h.userid = u.userid
     WHERE h.headid IN (${placeholders})`,
    headIds
  );

  const byHeadId = new Map(
    rows.map((row) => [Number(row.headid), {
      headid: Number(row.headid),
      userid: Number(row.userid),
      fullName: formatUserName(row),
    }])
  );

  return headIds
    .map((headid) => byHeadId.get(Number(headid)))
    .filter((row) => row && Number.isInteger(row.userid));
};

const getOfficeTypeName = async (officetypeid) => {
  if (!officetypeid) return 'Unassigned';
  const [rows] = await db.query('SELECT typename FROM officetypes WHERE officetypeid = ? LIMIT 1', [officetypeid]);
  return rows[0]?.typename || 'Unknown Type';
};

const getEventName = async (eventid) => {
  if (!eventid) return 'No event';
  const [rows] = await db.query('SELECT eventname FROM events WHERE eventid = ? LIMIT 1', [eventid]);
  return rows[0]?.eventname || `Event #${eventid}`;
};

const getOfficeSnapshot = async (officeid) => {
  const [officeRows] = await db.query(
    `SELECT o.officeid, o.officename, o.officetypeid, o.eventid,
            ot.typename AS OfficeTypeName,
            e.eventname
     FROM offices o
     LEFT JOIN officetypes ot ON o.officetypeid = ot.officetypeid
     LEFT JOIN events e ON o.eventid = e.eventid
     WHERE o.officeid = ?
     LIMIT 1`,
    [officeid]
  );

  if (officeRows.length === 0) return null;

  const [headRows] = await db.query(
    `SELECT DISTINCT
       COALESCE(h.headid, u.userid) AS headid,
       u.firstname,
       u.middleinitial,
       u.lastname
     FROM (
       SELECT officeid, h.userid
       FROM officeheadassignments oha
       INNER JOIN headofoffice h ON oha.headid = h.headid
       WHERE oha.officeid = ?

       UNION

       SELECT officeid, userid
       FROM requirementuserassignments
       WHERE officeid = ? AND userid IS NOT NULL

       UNION

       SELECT cso.officeid, pa.userid
       FROM personnelassignments pa
       JOIN requirements r ON (
         (pa.requirementid IS NOT NULL AND r.requirementid = pa.requirementid)
         OR (pa.criteriaid IS NOT NULL AND r.criteriaid = pa.criteriaid)
         OR (pa.areaid IS NOT NULL AND r.criteriaid IN (SELECT criteriaid FROM criteria WHERE areaid = pa.areaid))
       )
       JOIN compliancestatusoffices cso ON r.requirementid = cso.requirementid
       WHERE cso.officeid = ? AND pa.userid IS NOT NULL
     ) assigned
     INNER JOIN users u ON assigned.userid = u.userid
     LEFT JOIN headofoffice h ON u.userid = h.userid
     ORDER BY u.lastname ASC, u.firstname ASC`,
    [officeid, officeid, officeid]
  );

  return {
    ...officeRows[0],
    HeadIDs: headRows.map((row) => Number(row.headid)),
    HeadNames: headRows.map((row) => formatUserName(row)),
  };
};

let officeEventColumnsEnsured = false;

const OfficesController = {
  // ================================
  // GET ALL OFFICES (WITH JOINED DATA - SUPPORTS MULTIPLE HEADS)
  // ================================
  getAll: async (req, res) => {
    try {
      if (!officeEventColumnsEnsured) {
        try {
          await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS islocked BOOLEAN DEFAULT FALSE');
          await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS deadline TIMESTAMP DEFAULT NULL');
          officeEventColumnsEnsured = true;
        } catch (e) {}
      }
      const roleid = Number(req.user?.roleid || 0);
      const userid = Number(req.user?.userid || 0);
      const isAuditor = roleid === 4;

      // If auditor, check if they have any area assignments
      if (isAuditor) {
        const [assignments] = await db.query(
          'SELECT areaid FROM auditorareaassignments WHERE auditoruserid = ?',
          [userid]
        );
        if (!assignments || assignments.length === 0) {
          return res.json({ success: true, data: [] });
        }
      }

      const officeWhere = isAuditor
        ? `WHERE o.officeid IN (
            SELECT DISTINCT cso.officeid
            FROM compliancestatusoffices cso
            JOIN requirements r ON cso.requirementid = r.requirementid
            JOIN criteria c ON r.criteriaid = c.criteriaid
            JOIN auditorareaassignments aaa ON c.areaid = aaa.areaid
            WHERE aaa.auditoruserid = ${Number(userid)}
          )`
        : '';

      const [[officeRows], [headRows], auditorRows] = await Promise.all([
        // 1. Get all offices with basic info
        db.query(`
          SELECT 
            o.officeid,
            COALESCE(m.entityname, o.officename) AS officename,
            o.masterlistid,
            o.officetypeid,
            o.eventid,
            o.eventdepartmentid,
            COALESCE(o.accreditationlevel, 'None') AS accreditationlevel,
            COALESCE(m.entitytypeid, CASE WHEN ot.typename ILIKE '%non%' THEN 2 WHEN ot.typename ILIKE '%academic%' THEN 1 ELSE NULL END) AS entitytypeid,
            m.departmentid,
            COALESCE(o.createdat, m.createdat) AS createdat,
            COALESCE(o.updatedat, m.updatedat, o.createdat, m.createdat) AS updatedat,
            COALESCE(d.name, NULL) AS department_name,
            CASE 
              WHEN m.entitytypeid = 1 THEN 'Academic Program'
              WHEN m.entitytypeid = 2 THEN 'Non-Academic Office'
              WHEN ot.typename ILIKE '%non%' THEN 'Non-Academic Office'
              WHEN ot.typename ILIKE '%academic%' THEN 'Academic Program'
              ELSE 'Unknown'
            END AS category_name,
            e.eventname,
            e.eventcode,
            e.islocked AS event_islocked,
            e.deadline AS event_deadline,
            ot.typename,
            os.overallstatus,
            os.compliancepercent,
            os.totalrequirements,
            os.compliedcount,
            os.partiallycompliedcount,
            os.notcompliedcount
          FROM offices o
          LEFT JOIN masterlist m ON o.masterlistid = m.id
          LEFT JOIN departments d ON m.departmentid = d.id
          LEFT JOIN eventdepartments ed ON o.eventdepartmentid = ed.id
          LEFT JOIN Events e ON o.eventid = e.eventid
          LEFT JOIN officetypes ot ON o.officetypeid = ot.officetypeid
          LEFT JOIN (
            SELECT
              cso.officeid,
              COUNT(*) AS totalrequirements,
              SUM(CASE WHEN cso.Status::text = '5' THEN 1 ELSE 0 END) AS compliedcount,
              SUM(CASE WHEN cso.Status::text = '4' THEN 1 ELSE 0 END) AS partiallycompliedcount,
              SUM(CASE WHEN cso.Status::text = '3' THEN 1 ELSE 0 END) AS notcompliedcount,
              CASE
                WHEN COUNT(*) = 0 THEN 0
                ELSE ROUND(
                  (((SUM(CASE WHEN cso.Status::text = '5' THEN 1.0 ELSE 0.0 END) * 100.0) +
                  (SUM(CASE WHEN cso.Status::text = '4' THEN 1.0 ELSE 0.0 END) * 50.0)) /
                  NULLIF(COUNT(*), 0))::numeric,
                  2
                )
              END AS compliancepercent,
              CASE
                WHEN COUNT(*) = 0 THEN 'No Standards'
                WHEN SUM(CASE WHEN cso.Status::text = '5' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Complied'
                WHEN SUM(CASE WHEN cso.Status::text = '3' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Not Complied'
                ELSE 'Partially Complied'
              END AS overallstatus
            FROM compliancestatusoffices cso
            GROUP BY cso.officeid
          ) os ON o.officeid = os.officeid
          ${officeWhere}
        `),
        // 2. Get all heads/personnel assigned to offices
        db.query(`
          SELECT DISTINCT
            assigned.officeid,
            COALESCE(h.headid, u.userid) AS headid,
            u.userid,
            COALESCE(h.Position, 'Personnel') AS Position,
            u.firstname,
            u.middleinitial,
            u.lastname,
            u.profilepic
          FROM (
            SELECT officeid, h.userid
            FROM officeheadassignments oha
            INNER JOIN headofoffice h ON oha.headid = h.headid
            WHERE oha.officeid IS NOT NULL

            UNION

            SELECT officeid, userid
            FROM requirementuserassignments
            WHERE officeid IS NOT NULL AND userid IS NOT NULL

            UNION

            SELECT cso.officeid, pa.userid
            FROM personnelassignments pa
            JOIN requirements r ON (
              (pa.requirementid IS NOT NULL AND r.requirementid = pa.requirementid)
              OR (pa.criteriaid IS NOT NULL AND r.criteriaid = pa.criteriaid)
              OR (pa.areaid IS NOT NULL AND r.criteriaid IN (SELECT criteriaid FROM criteria WHERE areaid = pa.areaid))
            )
            JOIN compliancestatusoffices cso ON r.requirementid = cso.requirementid
            WHERE pa.userid IS NOT NULL
          ) assigned
          INNER JOIN users u ON assigned.userid = u.userid
          LEFT JOIN headofoffice h ON u.userid = h.userid
        `),
        // 3. Get all auditors assigned to offices
        db.query(`
          SELECT DISTINCT 
            cso.officeid,
            u.userid,
            u.firstname,
            u.middleinitial,
            u.lastname,
            u.profilepic,
            ar.areacode,
            ar.areaname
          FROM auditorareaassignments aaa
          JOIN users u ON aaa.auditoruserid = u.userid
          JOIN areas ar ON aaa.areaid = ar.areaid
          JOIN criteria c ON ar.areaid = c.areaid
          JOIN requirements r ON c.criteriaid = r.criteriaid
          JOIN compliancestatusoffices cso ON r.requirementid = cso.requirementid
        `).then(([auds]) => auds).catch(() => [])
      ]);

      // Group heads by officeid
      const headsByOffice = {};
      const seenUsersByOffice = {};
      headRows.forEach(head => {
        if (!headsByOffice[head.officeid]) {
          headsByOffice[head.officeid] = [];
          seenUsersByOffice[head.officeid] = new Set();
        }

        const uniquePersonKey = head.userid != null ? `user-${head.userid}` : `head-${head.headid}`;
        if (seenUsersByOffice[head.officeid].has(uniquePersonKey)) {
          return;
        }

        seenUsersByOffice[head.officeid].add(uniquePersonKey);
        headsByOffice[head.officeid].push({
          headid: head.headid,
          userid: head.userid,
          firstname: head.firstname,
          middleinitial: head.middleinitial,
          lastname: head.lastname,
          Position: head.Position,
          profilepic: head.profilepic,
          full_name: head.firstname ? `${head.firstname} ${head.middleinitial ? head.middleinitial + '.' : ''} ${head.lastname}`.trim() : 'Unknown'
        });
      });

      const auditorsByOffice = {};
      const seenAuditorsByOffice = {};
      auditorRows.forEach(aud => {
        if (!auditorsByOffice[aud.officeid]) {
          auditorsByOffice[aud.officeid] = [];
          seenAuditorsByOffice[aud.officeid] = new Set();
        }
        if (seenAuditorsByOffice[aud.officeid].has(aud.userid)) return;
        seenAuditorsByOffice[aud.officeid].add(aud.userid);
        auditorsByOffice[aud.officeid].push({
          userid: aud.userid,
          firstname: aud.firstname,
          middleinitial: aud.middleinitial,
          lastname: aud.lastname,
          profilepic: aud.profilepic,
          full_name: aud.firstname ? `${aud.firstname} ${aud.middleinitial ? aud.middleinitial + '.' : ''} ${aud.lastname}`.trim() : 'Auditor'
        });
      });

      const formatted = officeRows.map(r => {
        const officeHeads = headsByOffice[r.officeid] || [];
        const officeAuditors = auditorsByOffice[r.officeid] || [];
        // For backward compatibility, also include primary head info
        const primaryHead = officeHeads[0] || null;
        
        return {
          id: r.officeid,
          officename: r.officename,
          officename: r.officename,
          masterlistid: r.masterlistid || null,
          createdat: r.createdat || null,
          updatedat: r.updatedat || null,
          officetypeid: r.officetypeid,
          office_type_name: r.typename || "Unknown Type",
          departmentid: r.departmentid || null,
          department_name: r.department_name || null,
          eventdepartmentid: r.eventdepartmentid || null,
          accreditationlevel: r.accreditationlevel || 'None',
          entitytypeid: r.entitytypeid || null,
          category_name: r.category_name || null,
          headid: primaryHead?.headid || null,
          head_ids: officeHeads.map(h => h.headid), // Array of head IDs
          heads: officeHeads, // Full head objects
          head_name: officeHeads.length > 0 
            ? officeHeads.map(h => h.full_name).join(', ')
            : "Unassigned",
          head_profile_pic: primaryHead?.profilepic || null,
          auditors: officeAuditors,
          auditor_name: officeAuditors.length > 0
            ? officeAuditors.map(a => a.full_name).join(', ')
            : null,
          eventid: r.eventid,
          eventname: r.eventname || null,
          eventcode: r.eventcode || r.eventname || null,
          event_islocked: Boolean(r.event_islocked),
          event_deadline: r.event_deadline || null,
          overallstatus: (Number(r.totalrequirements || 0) === 0 ? 'No Standards' : (r.overallstatus || 'Not Complied')),
          compliancepercent: r.compliancepercent || 0,
          totalrequirements: r.totalrequirements || 0,
          compliedcount: r.compliedcount || 0,
          partiallycompliedcount: r.partiallycompliedcount || 0,
          notcompliedcount: r.notcompliedcount || 0
        };

      });

      res.json({ success: true, data: formatted });
    } catch (err) {
      console.error("Error fetching offices:", err);
      console.error("Error details:", err.message);
      res.status(500).json({ error: "Database error", details: err.message });
    }
  },

  // ================================
  // GET OFFICE BY ID
  // ================================
  getById: async (req, res) => {
    const id = req.params.id;
    const roleid = Number(req.user?.roleid || 0);
    const userid = Number(req.user?.userid || 0);
    const isAuditor = roleid === 4;

    try {
      if (isAuditor) {
        const [accessCheck] = await db.query(`
          SELECT 1
          FROM compliancestatusoffices cso
          JOIN requirements r ON cso.requirementid = r.requirementid
          JOIN criteria c ON r.criteriaid = c.criteriaid
          JOIN auditorareaassignments aaa ON c.areaid = aaa.areaid
          WHERE cso.officeid = ? AND aaa.auditoruserid = ?
          LIMIT 1
        `, [id, userid]);

        if (!accessCheck || accessCheck.length === 0) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not assigned to any areas for this office or program."
          });
        }
      }


      const [rows] = await db.query(`
        SELECT 
          o.officeid,
          COALESCE(m.entityname, o.officename) AS officename,
          o.masterlistid,
          o.officetypeid,
          o.eventid,
          COALESCE(o.accreditationlevel, 'None') AS accreditationlevel,
          COALESCE(m.entitytypeid, CASE WHEN t.typename ILIKE '%non%' THEN 2 WHEN t.typename ILIKE '%academic%' THEN 1 ELSE NULL END) AS entitytypeid,
          m.departmentid,
          COALESCE(o.createdat, m.createdat) AS createdat,
          COALESCE(o.updatedat, m.updatedat, o.createdat, m.createdat) AS updatedat,
          COALESCE(d.name, NULL) AS department_name,
          CASE 
            WHEN m.entitytypeid = 1 THEN 'Academic Program'
            WHEN m.entitytypeid = 2 THEN 'Non-Academic Office'
            WHEN t.typename ILIKE '%non%' THEN 'Non-Academic Office'
            WHEN t.typename ILIKE '%academic%' THEN 'Academic Program'
            ELSE 'Unknown'
          END AS category_name,
          t.typename,
          os.overallstatus,
          os.compliancepercent,
          os.totalrequirements,
          e.eventname,
          e.eventcode,
          e.islocked AS event_islocked,
          e.deadline AS event_deadline
        FROM offices o
        LEFT JOIN masterlist m ON o.masterlistid = m.id
        LEFT JOIN departments d ON m.departmentid = d.id
        LEFT JOIN officetypes t ON o.officetypeid = t.officetypeid
        LEFT JOIN (
          SELECT
            cso.officeid,
            COUNT(*) AS totalrequirements,
            SUM(CASE WHEN cso.Status::text = '5' THEN 1 ELSE 0 END) AS compliedcount,
            SUM(CASE WHEN cso.Status::text = '4' THEN 1 ELSE 0 END) AS partiallycompliedcount,
            SUM(CASE WHEN cso.Status::text = '3' THEN 1 ELSE 0 END) AS notcompliedcount,
            CASE
              WHEN COUNT(*) = 0 THEN 0
              ELSE ROUND(
                (((SUM(CASE WHEN cso.Status::text = '5' THEN 1.0 ELSE 0.0 END) * 100.0) +
                (SUM(CASE WHEN cso.Status::text = '4' THEN 1.0 ELSE 0.0 END) * 50.0)) /
                NULLIF(COUNT(*), 0))::numeric,
                2
              )
            END AS compliancepercent,
            CASE
              WHEN COUNT(*) = 0 THEN 'No Standards'
              WHEN SUM(CASE WHEN cso.Status::text = '5' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Complied'
              WHEN SUM(CASE WHEN cso.Status::text = '3' THEN 1 ELSE 0 END) = COUNT(*) THEN 'Not Complied'
              ELSE 'Partially Complied'
            END AS overallstatus
          FROM compliancestatusoffices cso
          GROUP BY cso.officeid
        ) os ON o.officeid = os.officeid
        LEFT JOIN Events e ON o.eventid = e.eventid
        WHERE o.officeid = ?
      `, [id]);

      if (rows.length === 0) {
        return res.status(404).json({ message: "Office not found" });
      }

      const r = rows[0];
      const [headRows] = await db.query(`
        SELECT DISTINCT
          COALESCE(h.headid, u.userid) AS headid,
          u.userid,
          COALESCE(h.Position, 'Personnel') AS Position,
          u.firstname,
          u.middleinitial,
          u.lastname,
          u.profilepic
        FROM (
          SELECT officeid, h.userid
          FROM officeheadassignments oha
          INNER JOIN headofoffice h ON oha.headid = h.headid
          WHERE oha.officeid = ?

          UNION

          SELECT officeid, userid
          FROM requirementuserassignments
          WHERE officeid = ? AND userid IS NOT NULL

          UNION

          SELECT cso.officeid, pa.userid
          FROM personnelassignments pa
          JOIN requirements r ON (
            (pa.requirementid IS NOT NULL AND r.requirementid = pa.requirementid)
            OR (pa.criteriaid IS NOT NULL AND r.criteriaid = pa.criteriaid)
            OR (pa.areaid IS NOT NULL AND r.criteriaid IN (SELECT criteriaid FROM criteria WHERE areaid = pa.areaid))
          )
          JOIN compliancestatusoffices cso ON r.requirementid = cso.requirementid
          WHERE cso.officeid = ? AND pa.userid IS NOT NULL
        ) assigned
        INNER JOIN users u ON assigned.userid = u.userid
        LEFT JOIN headofoffice h ON u.userid = h.userid
      `, [id, id, id]);

      const seenUsers = new Set();
      const officeHeads = headRows.filter((head) => {
        const uniquePersonKey = head.userid != null ? `user-${head.userid}` : `head-${head.headid}`;
        if (seenUsers.has(uniquePersonKey)) {
          return false;
        }
        seenUsers.add(uniquePersonKey);
        return true;
      }).map((head) => ({
        headid: head.headid,
        userid: head.userid,
        Position: head.Position,
        firstname: head.firstname,
        middleinitial: head.middleinitial,
        lastname: head.lastname,
        profilepic: head.profilepic,
        full_name: head.firstname ? `${head.firstname} ${head.middleinitial ? `${head.middleinitial}.` : ''} ${head.lastname}`.trim() : 'Unknown'
      }));
      const primaryHead = officeHeads[0] || null;

      res.json({
        officeid: r.officeid,
        officename: r.officename,
        masterlistid: r.masterlistid || null,
        createdat: r.createdat || null,
        updatedat: r.updatedat || null,
        officetypeid: r.officetypeid,
        typename: r.typename || "Unknown Type",
        DepartmentID: r.departmentid || null,
        DepartmentName: r.department_name || null,
        entitytypeid: r.entitytypeid || null,
        category_name: r.category_name || null,
        headid: primaryHead?.headid || null,
        HeadIDs: officeHeads.map((head) => head.headid),
        Heads: officeHeads,
        HeadName: officeHeads.length > 0 ? officeHeads.map((head) => head.full_name).join(', ') : "Unknown Head",
        accreditationlevel: r.accreditationlevel || 'None',
        eventid: r.eventid,
        eventname: r.eventname || null,
        eventcode: r.eventcode || null,
        event_islocked: Boolean(r.event_islocked),
        event_deadline: r.event_deadline || null,
        overallstatus: (Number(r.totalrequirements || 0) === 0 ? 'No Standards' : (r.overallstatus || 'Not Complied')),
        compliancepercent: r.compliancepercent || 0,
        totalrequirements: r.totalrequirements || 0
      });

    } catch (err) {
      console.error("Error fetching office:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  // ================================
  // CREATE NEW OFFICE (SUPPORTS MULTIPLE HEADS & MASTER LIST LINK)
  // ================================
  create: async (req, res) => {
    const { masterlistid, officename, officetypeid, headid, HeadIDs, eventid } = req.body;

    // Support both single headid (legacy) and HeadIDs array (new)
    const headIdArray = normalizeHeadIds(HeadIDs, headid);

    if (headIdArray.length > MAX_HEADS_PER_OFFICE) {
      return res.status(400).json({
        success: false,
        message: `You can assign a maximum of ${MAX_HEADS_PER_OFFICE} heads per office`
      });
    }

    let nameToSave = officename;
    let typeIdToSave = officetypeid;
    let eventDeptId = req.body.eventdepartmentid ? Number(req.body.eventdepartmentid) : null;

    if (masterlistid) {
      const [mlRows] = await db.query('SELECT entitytypeid, entityname, departmentid FROM masterlist WHERE id = ?', [masterlistid]);
      if (mlRows.length > 0) {
        nameToSave = mlRows[0].entityname;
        if (!typeIdToSave) {
          const isAcademic = mlRows[0].entitytypeid === 1;
          const [typeRows] = await db.query(
            'SELECT officetypeid FROM officetypes WHERE LOWER(typename) LIKE ? LIMIT 1',
            [isAcademic ? '%academic%' : '%non%']
          );
          typeIdToSave = typeRows[0]?.officetypeid || (isAcademic ? 2 : 1);
        }

        // Link academic program to eventdepartments
        if (mlRows[0].entitytypeid === 1 && mlRows[0].departmentid && eventid) {
          if (!eventDeptId) {
            const [existingEd] = await db.query(
              'SELECT id FROM eventdepartments WHERE eventid = ? AND departmentid = ? LIMIT 1',
              [eventid, mlRows[0].departmentid]
            );
            if (existingEd.length > 0) {
              eventDeptId = existingEd[0].id;
            } else {
              const [newEd] = await db.query(
                'INSERT INTO eventdepartments (eventid, departmentid) VALUES (?, ?) RETURNING id',
                [eventid, mlRows[0].departmentid]
              );
              eventDeptId = newEd[0]?.id || newEd.insertId;
            }
          }
        }
      }
    }

    console.log('Received create office request:', { masterlistid, officename: nameToSave, officetypeid: typeIdToSave, headIdArray, eventid, eventDeptId });

    try {
      const [result] = await db.query(
        `INSERT INTO offices (officename, masterlistid, officetypeid, eventid, eventdepartmentid, accreditationlevel)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          nameToSave || '',
          masterlistid ? Number(masterlistid) : null,
          typeIdToSave || null,
          eventid || null,
          eventDeptId || null,
          req.body.accreditationlevel || 'None'
        ]
      );


      const newOfficeId = result.insertId;
      console.log('Office created successfully:', newOfficeId);

      if (headIdArray.length > 0) {
        for (const hid of headIdArray) {
          await db.query(
            `INSERT INTO officeheadassignments (headid, officeid) VALUES (?, ?) ON CONFLICT DO NOTHING`,
            [hid, newOfficeId]
          );
        }
        console.log('Assigned heads to office:', headIdArray);
      }

      await updateOverallOfficeStatus(newOfficeId);

      res.json({
        success: true,
        message: 'Office created successfully',
        data: {
          officeid: newOfficeId,
          officename: nameToSave,
          masterlistid: masterlistid ? Number(masterlistid) : null,
          officetypeid,
          HeadIDs: headIdArray,
          eventid
        }
      });
      // Audit log
      try {
        const actorId = req.user && req.user.userid;
        if (actorId) {
          const [officeTypeName, eventname, headNames] = await Promise.all([
            getOfficeTypeName(officetypeid),
            getEventName(eventid),
            getNamesByHeadIds(headIdArray),
          ]);

          await recordLog(actorId, 'OfficeAdded', {
            officename: nameToSave,
            OfficeType: officeTypeName,
            eventname: eventname,
            HeadNames: headNames,
            HeadCount: headNames.length
          });

          if (headIdArray.length > 0) {
            const assignedHeadDetails = await getHeadAssignmentDetailsByHeadIds(headIdArray);
            if (assignedHeadDetails.length > 0) {
              await createNotifications({
                userIds: assignedHeadDetails.map((item) => item.userid),
                adminid: actorId,
                title: 'Assigned As Office Personnel',
                message: `You were assigned to office ${nameToSave} under event ${eventname}.`,
                type: 'info',
                relatedtable: 'office_personnel',
                relatedid: Number(newOfficeId),
                meta: { officeid: Number(newOfficeId) },
              });
            }
            try {
              const [reqRows] = await db.query('SELECT requirementid FROM compliancestatusoffices WHERE officeid = ?', [newOfficeId]);
              const reqIds = reqRows.map(r => Number(r.requirementid)).filter(id => Number.isInteger(id) && id > 0);
              if (reqIds.length > 0) {
                await autoAssignHeadsToRequirementsForOffice(newOfficeId, reqIds, actorId);
              }
            } catch (e) {
              console.error('Auto-assign heads on office create failed:', e);
            }
          }
        }
      } catch (e) {
        console.error('Failed to record office creation log:', e);
      }
    } catch (err) {
      console.error("Error creating office:", err);
      res.status(500).json({ 
        success: false, 
        error: "Database error", 
        details: err.message 
      });
    }
  },

  // ================================
  // UPDATE OFFICE (SUPPORTS MULTIPLE HEADS & MASTER LIST LINK)
  // ================================
  update: async (req, res) => {
    const id = req.params.id;
    const { masterlistid, officename, officetypeid, headid, HeadIDs, eventid } = req.body;

    const headIdArray = normalizeHeadIds(HeadIDs, headid);

    if (headIdArray.length > MAX_HEADS_PER_OFFICE) {
      return res.status(400).json({
        success: false,
        message: `You can assign a maximum of ${MAX_HEADS_PER_OFFICE} heads per office`
      });
    }

    try {
      const previousOffice = await getOfficeSnapshot(id);
      if (!previousOffice) {
        return res.status(404).json({ success: false, message: "Office not found" });
      }

      let nameToSave = officename;
      if (!nameToSave && masterlistid) {
        const [mlRows] = await db.query('SELECT entityname FROM masterlist WHERE id = ?', [masterlistid]);
        if (mlRows.length > 0) {
          nameToSave = mlRows[0].entityname;
        }
      }

      if (nameToSave && masterlistid) {
        await db.query('UPDATE masterlist SET entityname = ? WHERE id = ?', [nameToSave, masterlistid]);
      }

      const hasLevel = req.body.accreditationlevel !== undefined;
      const [result] = await db.query(
        `UPDATE offices 
         SET officename = ?, masterlistid = ?, officetypeid = ?, eventid = ?${hasLevel ? ', accreditationlevel = ?' : ''}
         WHERE officeid = ?`,
        hasLevel
          ? [
              nameToSave || previousOffice.officename || '',
              masterlistid ? Number(masterlistid) : null,
              officetypeid,
              eventid,
              req.body.accreditationlevel,
              id
            ]
          : [
              nameToSave || previousOffice.officename || '',
              masterlistid ? Number(masterlistid) : null,
              officetypeid,
              eventid,
              id
            ]
      );


      // Remove all existing assignments for this office
      await db.query(
        `DELETE FROM officeheadassignments WHERE officeid = ?`,
        [id]
      );

      // Assign all new heads to this office
      if (headIdArray.length > 0) {
        for (const hid of headIdArray) {
          await db.query(
            `INSERT INTO officeheadassignments (headid, officeid) VALUES (?, ?) ON CONFLICT DO NOTHING`,
            [hid, id]
          );
        }
        console.log('Updated heads for office', id, ':', headIdArray);
      }

      // Audit log: record who updated the office (if authenticated)
      try {
        const actorId = req.user && req.user.userid;
        if (actorId) {
          const [officeTypeName, eventname, currentHeadNames] = await Promise.all([
            getOfficeTypeName(officetypeid),
            getEventName(eventid),
            getNamesByHeadIds(headIdArray),
          ]);

          const previousHeadIdSet = new Set((previousOffice.HeadIDs || []).map((value) => Number(value)));
          const currentHeadIdSet = new Set((headIdArray || []).map((value) => Number(value)));

          const addedHeadIds = [...currentHeadIdSet].filter((headid) => !previousHeadIdSet.has(headid));
          const removedHeadIds = [...previousHeadIdSet].filter((headid) => !currentHeadIdSet.has(headid));
          const [addedHeadNames, removedHeadNames] = await Promise.all([
            getNamesByHeadIds(addedHeadIds),
            getNamesByHeadIds(removedHeadIds),
          ]);

          // If some heads were removed from this office, cleanup any requirement assignments
          // that referred to those users within this office.
          if (removedHeadIds.length > 0) {
            try {
              const placeholders = removedHeadIds.map(() => '?').join(',');
              const [headRows] = await db.query(
                `SELECT headid, userid FROM headofoffice WHERE headid IN (${placeholders})`,
                removedHeadIds
              );

              const userIds = headRows.map(r => r.userid).filter(id => Number.isInteger(Number(id)));
              if (userIds.length > 0) {
                const userPlaceholders = userIds.map(() => '?').join(',');
                // Delete any requirementuserassignments scoped to this office for those users
                await db.query(
                  `DELETE FROM requirementuserassignments WHERE userid IN (${userPlaceholders}) AND officeid = ?`,
                  [...userIds, id]
                );
              }
            } catch (cleanupErr) {
              console.error('Failed to cleanup requirementuserassignments for removed office heads:', cleanupErr);
            }
          }

          const changes = {};
          if ((previousOffice.officename || '') !== (officename || '')) {
            changes.officename = { from: previousOffice.officename || '', to: officename || '' };
          }
          if ((previousOffice.OfficeTypeName || 'Unassigned') !== (officeTypeName || 'Unassigned')) {
            changes.OfficeType = { from: previousOffice.OfficeTypeName || 'Unassigned', to: officeTypeName || 'Unassigned' };
          }
          if ((previousOffice.eventname || 'No event') !== (eventname || 'No event')) {
            changes.eventname = { from: previousOffice.eventname || 'No event', to: eventname || 'No event' };
          }

          await recordLog(actorId, 'OfficeUpdated', {
            officename,
            OfficeType: officeTypeName,
            eventname: eventname,
            HeadNames: currentHeadNames,
            changes,
            headChanges: {
              added: addedHeadNames,
              removed: removedHeadNames,
            }
          });

          if (addedHeadIds.length > 0) {
            const addedHeadDetails = await getHeadAssignmentDetailsByHeadIds(addedHeadIds);
            if (addedHeadDetails.length > 0) {
              await createNotifications({
                userIds: addedHeadDetails.map((item) => item.userid),
                adminid: actorId,
                title: 'Assigned As Office Personnel',
                message: `You were assigned to office ${officename} under event ${eventname}.`,
                type: 'info',
                relatedtable: 'office_personnel',
                relatedid: Number(id),
                meta: { officeid: Number(id) },
              });
            }
            // Auto-assign newly added heads to existing requirements for this office
            try {
              const [reqRows] = await db.query('SELECT requirementid FROM compliancestatusoffices WHERE officeid = ?', [id]);
              const reqIds = reqRows.map(r => Number(r.requirementid)).filter(id2 => Number.isInteger(id2) && id2 > 0);
              if (reqIds.length > 0) {
                await autoAssignHeadsToRequirementsForOffice(id, reqIds, actorId);
              }
            } catch (e) {
              console.error('Auto-assign heads on office update failed:', e);
            }
          }
        }
      } catch (e) {
        console.error('Failed to record office update log:', e);
      }

      res.json({ success: true, message: "Office updated successfully" });
    } catch (err) {
      console.error("Error updating office:", err);
      res.status(500).json({ success: false, error: "Database error" });
    }
  },

  // ================================
  // UPDATE PROGRAM ACCREDITATION LEVEL
  // ================================
  updateLevel: async (req, res) => {
    try {
      const { id } = req.params;
      const { accreditationlevel } = req.body;
      if (!accreditationlevel) {
        return res.status(400).json({ success: false, message: 'accreditationlevel is required' });
      }
      await db.query(
        `UPDATE offices 
         SET accreditationlevel = ?, updatedat = CURRENT_TIMESTAMP 
         WHERE officeid = ?`,
        [accreditationlevel, Number(id)]
      );
      res.json({ success: true, message: 'Program accreditation level updated successfully', newLevel: accreditationlevel });
    } catch (err) {
      console.error('Error updating program level:', err);
      res.status(500).json({ success: false, message: 'Failed to update program accreditation level' });
    }
  },

  // ================================
  // DELETE OFFICE
  // ================================
  delete: async (req, res) => {
    const id = req.params.id;

    try {
      const officeToDelete = await getOfficeSnapshot(id);
      if (!officeToDelete) {
        return res.status(404).json({ message: "Office not found" });
      }

      // Before deleting requirements, cleanup uploaded files related to this office
      try {
        // 1) Find requirement IDs linked to this office
        const [reqRows] = await db.query('SELECT requirementid FROM compliancestatusoffices WHERE officeid = ?', [id]);
        console.log('Office delete: found requirement IDs for office', id, reqRows.map(r => r.requirementid));
        const requirementIds = Array.isArray(reqRows) ? reqRows.map(r => Number(r.requirementid)).filter(n => Number.isInteger(n)) : [];

        if (requirementIds.length > 0) {
          const placeholders = requirementIds.map(() => '?').join(',');

          // Delete any user-uploaded requirement files scoped to this office (disk + DB)
          try {
            const [userFiles] = await db.query(
              `SELECT id, filepath FROM requirement_user_uploads WHERE requirementid IN (${placeholders}) AND officeid = ?`,
              [...requirementIds, id]
            );
            console.log('Office delete: found requirement_user_uploads count:', (userFiles || []).length);
            if (userFiles && userFiles.length > 0) {
              for (const uf of userFiles) {
                try {
                  const absPath = path.join(__dirname, '..', (uf.filepath || '').replace(/^\//, ''));
                  const exists = fs.existsSync(absPath);
                  if (exists) {
                    fs.unlinkSync(absPath);
                  }
                } catch (fsErr) {
                  console.warn('Failed to delete user requirement upload during office deletion:', fsErr);
                }
              }
              await db.query(
                `DELETE FROM requirement_user_uploads WHERE requirementid IN (${placeholders}) AND officeid = ?`,
                [...requirementIds, id]
              );
            }
          } catch (e) {
            console.error('Error cleaning up requirement_user_uploads during office delete:', e);
          }

          // Remove any requirementuserassignments for these requirements scoped to this office
          try {
            await db.query(
              `DELETE FROM requirementuserassignments WHERE requirementid IN (${placeholders}) AND officeid = ?`,
              [...requirementIds, id]
            );
          } catch (e) {
            console.error('Error cleaning up requirementuserassignments during office delete:', e);
          }
        }

        // 2) Remove any proof documents (both requirement and office-level) strictly for THIS office (disk + Supabase + DB)
        try {
          const { deleteFromSupabaseBucket } = require('../utils/supabaseStorage');
          const [proofFiles] = await db.query('SELECT id, filepath FROM officeproofdocuments WHERE officeid = ?', [id]);
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
                console.warn('Failed to delete office proof file during office deletion:', fsErr);
              }
            }
            await db.query('DELETE FROM officeproofdocuments WHERE officeid = ?', [id]);
          }
        } catch (e) {
          console.error('Error cleaning up office proof documents during office delete:', e);
        }
      } catch (e) {
        console.error('Error during uploaded files cleanup before deleting office:', e);
      }

      // Then delete all requirements associated with this office
      await db.query("DELETE FROM compliancestatusoffices WHERE officeid = ?", [id]);

      // Remove office-head assignments for this office
      await db.query("DELETE FROM officeheadassignments WHERE officeid = ?", [id]);

      // Then delete the office
      const [result] = await db.query("DELETE FROM offices WHERE officeid = ?", [id]);

      // Audit log: record who deleted the office (if authenticated)
      try {
        const actorId = req.user && req.user.userid;
        if (actorId) {
          await recordLog(actorId, 'OfficeDeleted', {
            officename: officeToDelete.officename,
            OfficeType: officeToDelete.OfficeTypeName || 'Unknown Type',
            eventname: officeToDelete.eventname || 'No event',
            HeadNames: officeToDelete.HeadNames || [],
          });
        }
      } catch (e) {
        console.error('Failed to record office deletion log:', e);
      }

      const isAcademic = officeToDelete.officetypeid === 2 || 
        (/academic/i.test(officeToDelete.OfficeTypeName || '') && !/non/i.test(officeToDelete.OfficeTypeName || ''));
      const entityLabel = isAcademic ? "Program" : "Office";

      res.json({ message: `${entityLabel} deleted successfully`, entityType: entityLabel.toLowerCase() });
    } catch (err) {
      console.error("Error deleting office:", err);
      res.status(500).json({ error: "Database error" });
    }
  },

  deleteMultiple: async (req, res) => {
    try {
      const rawIds = req.body?.ids || req.body?.officeIds || req.body?.data?.ids || [];
      const ids = Array.isArray(rawIds) ? rawIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : [];
      if (ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid office IDs provided' });
      }

      const placeholders = ids.map(() => '?').join(',');

      try {
        const { deleteFromSupabaseBucket } = require('../utils/supabaseStorage');
        const [proofFiles] = await db.query(
          `SELECT id, filepath FROM officeproofdocuments WHERE officeid IN (${placeholders})`,
          ids
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
            } catch (delErr) {
              console.warn('Failed to delete office proof file during bulk office deletion:', delErr);
            }
          }
        }

        await db.query(`DELETE FROM requirement_user_uploads WHERE requirementid IN (SELECT requirementid FROM compliancestatusoffices WHERE officeid IN (${placeholders}))`, ids);
        await db.query(`DELETE FROM officeproofdocuments WHERE officeid IN (${placeholders})`, ids);
        await db.query(`DELETE FROM requirementuserassignments WHERE officeid IN (${placeholders})`, ids);
        await db.query(`DELETE FROM compliancestatusoffices WHERE officeid IN (${placeholders})`, ids);
        await db.query(`DELETE FROM officeheadassignments WHERE officeid IN (${placeholders})`, ids);
        await db.query(`DELETE FROM OverallOfficeStatus WHERE officeid IN (${placeholders})`, ids);
      } catch (e) {
        console.warn('Cleanup child records warning during bulk office delete:', e.message);
      }

      const [result] = await db.query(`DELETE FROM offices WHERE officeid IN (${placeholders})`, ids);

      return res.json({
        success: true,
        message: `Successfully deleted ${result.affectedRows || ids.length} item(s)`,
        deletedCount: result.affectedRows || ids.length
      });
    } catch (err) {
      console.error('Error bulk deleting offices:', err);
      return res.status(500).json({ success: false, message: 'Failed to delete selected offices', error: err.message });
    }
  },

  // ================================
  // GET OFFICE REQUIREMENTS
  // ================================
  getOfficeRequirements: async (req, res) => {
    try {
        const { id } = req.params;
        const roleid = Number(req.user?.roleid || 0);
        const userid = Number(req.user?.userid || 0);

        const query = `
        SELECT 
          r.requirementid,
          r.requirementcode,
          r.Description,
          r.criteriaid,
          c.parentcriteriaid,
          c.criterianame,
          c.criteriacode,
          pc.criterianame AS ParentCriteriaName,
          pc.criteriacode AS ParentCriteriaCode,
          c.areaid,
          c.eventid,
          a.areacode,
          a.areaname,
          cso.status as "ComplianceStatusID",
          cst.statusname as "ComplianceStatus",
          cso.comments
        FROM compliancestatusoffices cso
        INNER JOIN requirements r ON cso.requirementid = r.requirementid
        LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
        LEFT JOIN criteria pc ON c.parentcriteriaid = pc.criteriaid
        LEFT JOIN areas a ON c.areaid = a.areaid
        LEFT JOIN compliancestatustypes cst ON cso.Status = cst.statusid
        WHERE cso.officeid = ?
        ORDER BY a.sortorder ASC, COALESCE(pc.criteriacode, c.criteriacode) ASC, c.criteriacode ASC, r.requirementcode ASC
      `;

        const [results] = await db.query(query, [id]);

        if (req.user && (req.user.roleid === 4 || Number(req.user.roleid) === 4)) {
            (results || []).forEach(r => {
                r.comments = '';
                r.Comments = '';
            });
        }

        res.json({
            success: true,
            data: results
        });

    } catch (err) {
        console.error('Error fetching office requirements:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch office requirements',
            details: err.message 
        });
    }
  },

  // ================================
  // EXPORT OFFICE REQUIREMENTS (EXCEL TABLE FORMAT)
  // ================================
  exportOfficeExcel: async (req, res) => {
    const officeid = Number(req.params.id);

    if (!Number.isInteger(officeid) || officeid <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid office id' });
    }

    try {
      const [officeRows] = await db.query(
        `SELECT o.officeid, o.officename
         FROM offices o
         WHERE o.officeid = ?
         LIMIT 1`,
        [officeid]
      );

      if (!officeRows.length) {
        return res.status(404).json({ success: false, message: 'Office not found' });
      }

      const officename = officeRows[0].officename || `Office ${officeid}`;

      const [requirementsRows] = await db.query(
        `SELECT
          r.requirementid,
          r.requirementcode,
          r.Description AS "Description",
          c.criteriaid,
          c.parentcriteriaid,
          c.criteriacode,
          c.criterianame,
          pc.criteriacode AS "ParentCriteriaCode",
          pc.criterianame AS "ParentCriteriaName",
          COALESCE(a.areaid, pa.areaid) AS areaid,
          COALESCE(a.areacode, pa.areacode) AS areacode,
          COALESCE(a.areaname, pa.areaname) AS areaname,
          cso.status AS "ComplianceStatusID",
          cst.statusname AS "ComplianceStatusName",
          cso.comments AS "Comments"
        FROM compliancestatusoffices cso
        INNER JOIN requirements r ON cso.requirementid = r.requirementid
        LEFT JOIN criteria c ON r.criteriaid = c.criteriaid
        LEFT JOIN criteria pc ON c.parentcriteriaid = pc.criteriaid
        LEFT JOIN areas a ON c.areaid = a.areaid
        LEFT JOIN areas pa ON pc.areaid = pa.areaid
        LEFT JOIN compliancestatustypes cst ON cso.Status = cst.statusid
        WHERE cso.officeid = ?
        ORDER BY
          COALESCE(a.areacode, pa.areacode, 'ZZZ') ASC,
          COALESCE(a.areaname, pa.areaname, 'ZZZ') ASC,
          COALESCE(COALESCE(pc.criteriacode, c.criteriacode), 'ZZZ') ASC,
          COALESCE(c.criteriacode, 'ZZZ') ASC,
          COALESCE(r.requirementcode, 'ZZZ') ASC,
          r.requirementid ASC`,
        [officeid]
      );

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Compliance Audit';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Office Export');
      // Increase column widths to avoid truncation of long criteria/requirement titles.
      // Do not set any row heights here so the client can auto-size rows as needed.
      sheet.columns = [
        { key: 'status', width: 20 },
        { key: 'requirement', width: 140 },
        { key: 'comments', width: 64 },
      ];

      const thinBorder = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };

      // Enable wrapText on headers so long titles can flow onto multiple lines
      // while keeping row heights uncontrolled (no explicit height set).
      const areaHeaderStyle = {
        font: { bold: true, size: 13 },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      };

      const criteriaHeaderStyle = {
        font: { bold: true, size: 12 },
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      };

      let rowIndex = 1;

      // Header: OFFICE NAME (merged and bordered)
      sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
      const officeCell = sheet.getCell(`A${rowIndex}`);
      officeCell.value = String(officename).toUpperCase();
      officeCell.font = { bold: true, size: 14 };
      officeCell.alignment = { horizontal: 'center', vertical: 'middle' };
      officeCell.border = thinBorder;
      sheet.getCell(`B${rowIndex}`).border = thinBorder;
      sheet.getCell(`C${rowIndex}`).border = thinBorder;
      rowIndex += 1;

      if (!requirementsRows.length) {
        sheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
        const emptyCell = sheet.getCell(`A${rowIndex}`);
        emptyCell.value = 'No requirements assigned to this office.';
        emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
        emptyCell.border = thinBorder;
        sheet.getCell(`B${rowIndex}`).border = thinBorder;
      } else {
        const areasMap = new Map();

        // Build criteria nodes with parent relationships per area
        requirementsRows.forEach((row) => {
          const areacode = row.areacode || 'N/A';
          const areaname = row.areaname || 'No Area';
          const areaKey = `${areacode}__${areaname}`;

          if (!areasMap.has(areaKey)) {
            areasMap.set(areaKey, {
              areacode,
              areaname,
              criteriaMap: new Map(),
            });
          }

          const areaEntry = areasMap.get(areaKey);

          const critId = row.criteriaid != null ? Number(row.criteriaid) : `req_${row.requirementid}`;
          const parentId = row.parentcriteriaid != null ? Number(row.parentcriteriaid) : null;

          if (!areaEntry.criteriaMap.has(critId)) {
            areaEntry.criteriaMap.set(critId, {
              id: critId,
              code: row.criteriacode || '',
              name: row.criterianame || '',
              parentId: parentId,
              children: [],
              requirements: [],
            });
          }

          // If parent exists in this row but parent node not yet created, synthesize parent node placeholder
          if (parentId && !areaEntry.criteriaMap.has(parentId)) {
            areaEntry.criteriaMap.set(parentId, {
              id: parentId,
              code: row.ParentCriteriaCode || row.parentcriteriacode || '',
              name: row.ParentCriteriaName || row.parentcriterianame || '',
              parentId: null,
              children: [],
              requirements: [],
            });
          }

          areaEntry.criteriaMap.get(critId).requirements.push({
            status: normalizeComplianceStatus(
              row.ComplianceStatusID ?? row.compliancestatusid,
              row.ComplianceStatusName ?? row.compliancestatusname
            ),
            requirementcode: row.requirementcode || 'N/A',
            description: row.Description ?? row.description ?? '',
            comments: row.Comments ?? row.comments ?? ''
          });
        });

        // Link children to their parents per area
        for (const area of areasMap.values()) {
          for (const node of area.criteriaMap.values()) {
            if (node.parentId && area.criteriaMap.has(node.parentId)) {
              area.criteriaMap.get(node.parentId).children.push(node);
            }
          }
        }

        // Write areas and nested criteria -> child criteria -> requirements
        for (const area of areasMap.values()) {
          // Area title row merged across three columns
          sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
          const areaTitleCell = sheet.getCell(`A${rowIndex}`);
          areaTitleCell.value = `${area.areacode} - ${area.areaname}`;
          areaTitleCell.font = areaHeaderStyle.font;
          areaTitleCell.alignment = areaHeaderStyle.alignment;
          areaTitleCell.border = thinBorder;
          sheet.getCell(`B${rowIndex}`).border = thinBorder;
          sheet.getCell(`C${rowIndex}`).border = thinBorder;
          rowIndex += 1;

          // Determine root criteria (those without parent or whose parent is not in the same map)
          const allNodes = Array.from(area.criteriaMap.values());
          const roots = allNodes.filter(n => !n.parentId || !area.criteriaMap.has(n.parentId));

          // Sort roots by code then name
          roots.sort((a, b) => (String(a.code || a.name)).localeCompare(String(b.code || b.name)));

          for (const root of roots) {
            // Criteria header (root)
            sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
            const criteriaLabel = root.code ? `${String(root.code).trim().replace(/\.+$/, '').toUpperCase()}. ${root.name}` : root.name || 'No Criteria';
            const criteriaCell = sheet.getCell(`A${rowIndex}`);
            criteriaCell.value = criteriaLabel;
            criteriaCell.font = criteriaHeaderStyle.font;
            criteriaCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
            criteriaCell.border = thinBorder;
            sheet.getCell(`B${rowIndex}`).border = thinBorder;
            sheet.getCell(`C${rowIndex}`).border = thinBorder;
            rowIndex += 1;

            // Write requirements directly under root (if any)
            for (const req of root.requirements) {
              sheet.getCell(`A${rowIndex}`).value = req.status;
              sheet.getCell(`B${rowIndex}`).value = `${req.requirementcode} - ${req.description}`;
              sheet.getCell(`C${rowIndex}`).value = req.comments || '';
              sheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
              sheet.getCell(`B${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
              sheet.getCell(`C${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
              sheet.getCell(`A${rowIndex}`).border = thinBorder;
              sheet.getCell(`B${rowIndex}`).border = thinBorder;
              sheet.getCell(`C${rowIndex}`).border = thinBorder;
              rowIndex += 1;
            }

            // For each child criteria under this root
            const children = (root.children || []).slice().sort((a,b) => (String(a.code || a.name)).localeCompare(String(b.code || b.name)));
            for (const child of children) {
              // Child header merged
              sheet.mergeCells(`A${rowIndex}:C${rowIndex}`);
              const childLabel = child.code ? `${String(child.code).trim().replace(/\.+$/, '').toUpperCase()}. ${child.name}` : child.name || 'No Criteria';
              const childCell = sheet.getCell(`A${rowIndex}`);
              childCell.value = childLabel;
              childCell.font = { bold: true, size: 11 };
              childCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
              childCell.border = thinBorder;
              sheet.getCell(`B${rowIndex}`).border = thinBorder;
              sheet.getCell(`C${rowIndex}`).border = thinBorder;
              rowIndex += 1;

              for (const req of child.requirements) {
                sheet.getCell(`A${rowIndex}`).value = req.status;
                sheet.getCell(`B${rowIndex}`).value = `${req.requirementcode} - ${req.description}`;
                sheet.getCell(`C${rowIndex}`).value = req.comments || '';
                sheet.getCell(`A${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
                sheet.getCell(`B${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                sheet.getCell(`C${rowIndex}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
                sheet.getCell(`A${rowIndex}`).border = thinBorder;
                sheet.getCell(`B${rowIndex}`).border = thinBorder;
                sheet.getCell(`C${rowIndex}`).border = thinBorder;
                rowIndex += 1;
              }
            }
          }
        }
      }

      const safeName = String(officename)
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, '_')
        .trim();

      const filename = `${safeName || `office_${officeid}`}_export.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const outputBuffer = Buffer.from(buffer);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', outputBuffer.length);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

      return res.status(200).send(outputBuffer);
    } catch (err) {
      console.error('Error exporting office excel:', err);
      return res.status(500).json({ success: false, message: 'Failed to export office excel', details: err.message });
    }
  },

  // ================================
  // ADD REQUIREMENTS TO OFFICE
  // ================================
  addOfficeRequirements: async (req, res) => {
    const officeid = req.params.id;
    const { requirementIds } = req.body;

    if (!Array.isArray(requirementIds) || requirementIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "requirementIds must be a non-empty array" 
      });
    }

    const normalizedRequirementIds = [...new Set(
      requirementIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (normalizedRequirementIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid requirement IDs were provided"
      });
    }

    try {
      // Check if office exists
      const [office] = await db.query("SELECT officeid FROM offices WHERE officeid = ?", [officeid]);
      if (office.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Office not found" 
        });
      }

      // Detect already-assigned requirements for this office so we can report duplicate skips.
      const [existingRows] = await db.query(
        `SELECT requirementid FROM compliancestatusoffices WHERE officeid = ? AND requirementid IN (${normalizedRequirementIds.join(',')})`,
        [officeid]
      );

      const existingSet = new Set(existingRows.map((row) => Number(row.requirementid ?? row.requirementid)));
      const newRequirementIds = normalizedRequirementIds.filter((id) => !existingSet.has(id));
      const duplicateCount = normalizedRequirementIds.length - newRequirementIds.length;

      if (newRequirementIds.length > 0) {
        const valuesSql = newRequirementIds.map((reqId) => `(${Number(officeid)}, ${Number(reqId)}, 3)`).join(',');
        await db.query(
          `INSERT INTO compliancestatusoffices (officeid, requirementid, Status) VALUES ${valuesSql}`
        );

        // Auto-assign current office heads to the newly-added requirements
        try {
          const actorId = req.user && req.user.userid;
          await autoAssignHeadsToRequirementsForOffice(officeid, newRequirementIds, actorId);
        } catch (e) {
          console.error('Auto-assign heads on addOfficeRequirements failed:', e);
        }
      }

      // Update the overall office status
      await updateOverallOfficeStatus(officeid);

      const addedCount = newRequirementIds.length;
      const message = `${duplicateCount} duplicate(s) already assigned, ${addedCount} new requirement(s) added.`;

      res.json({ 
        success: true, 
        message,
        requestedCount: normalizedRequirementIds.length,
        addedCount,
        duplicateCount,
        data: {
          requestedCount: normalizedRequirementIds.length,
          addedCount,
          duplicateCount
        }
      });
    } catch (err) {
      console.error("Error adding office requirements:", err);
      res.status(500).json({ 
        success: false, 
        error: "Database error", 
        details: err.message 
      });
    }
  },

  // ================================
  // REMOVE REQUIREMENT FROM OFFICE
  // ================================
  removeOfficeRequirement: async (req, res) => {
    const { id: officeid, requirementid } = req.params;

    try {
      const [result] = await db.query(
        "DELETE FROM compliancestatusoffices WHERE officeid = ? AND requirementid = ?",
        [officeid, requirementid]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Requirement not found for this office" 
        });
      }

      // Update the overall office status after removal
      await updateOverallOfficeStatus(officeid);

      // Remove any user assignments for this requirement in this office
      try {
        await db.execute('DELETE FROM requirementuserassignments WHERE requirementid = ? AND officeid = ?', [requirementid, officeid]);
      } catch (cleanupErr) {
        console.error('Failed to cleanup requirementuserassignments after removing office requirement:', cleanupErr);
      }

      // Also remove any uploaded proof documents (disk + DB) related to this requirement for the office
      try {
        const [files] = await db.query(
          'SELECT id, filepath FROM officeproofdocuments WHERE requirementid = ? AND officeid = ?',
          [requirementid, officeid]
        );

        if (files && files.length > 0) {
          const { deleteFromSupabaseBucket } = require('../utils/supabaseStorage');
          for (const f of files) {
            try {
              if (f.filepath && (f.filepath.startsWith('http://') || f.filepath.startsWith('https://'))) {
                await deleteFromSupabaseBucket(f.filepath, 'proof-documents');
              } else {
                const absPath = path.join(__dirname, '..', (f.filepath || '').replace(/^\//, ''));
                if (fs.existsSync(absPath)) {
                  fs.unlinkSync(absPath);
                }
              }
            } catch (fsErr) {
              console.warn('Failed to delete requirement proof file during removeOfficeRequirement:', fsErr);
            }
          }

          await db.query('DELETE FROM officeproofdocuments WHERE requirementid = ? AND officeid = ?', [requirementid, officeid]);
        }
      } catch (docErr) {
        console.error('Failed to cleanup officeproofdocuments after removing office requirement:', docErr);
      }

      const actorId = req.user?.userid || req.user?.id;
      try {
        const [ctx] = await db.query(
          `SELECT o.officename, r.requirementcode FROM offices o, requirements r WHERE o.officeid = ? AND r.requirementid = ?`,
          [officeid, requirementid]
        );
        if (actorId) {
          await recordLog(actorId, 'OfficeRequirementRemoved', {
            officeid: Number(officeid),
            officename: ctx[0]?.officename || null,
            requirementid: Number(requirementid),
            requirementcode: ctx[0]?.requirementcode || null
          });
        }
      } catch (logErr) {}

      res.json({ 
        success: true, 
        message: "Requirement removed successfully" 
      });
    } catch (err) {
      console.error("Error removing office requirement:", err);
      res.status(500).json({ 
        success: false, 
        error: "Database error", 
        details: err.message 
      });
    }
  },

  // ================================
  // UPDATE REQUIREMENT STATUS
  // ================================
  updateRequirementStatus: async (req, res) => {
    const { id: officeid, requirementid } = req.params;
    const { statusid, comments } = req.body;
    const nextStatusId = Number(statusid);

    if (!nextStatusId || ![3, 4, 5].includes(nextStatusId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 3 (Not Complied), 4 (Partially Complied), or 5 (Complied)"
      });
    }

    try {
      const hasCommentPayload = Object.prototype.hasOwnProperty.call(req.body, 'comments');
      if (hasCommentPayload) {
        let userRoleId = Number(req.user?.roleid || 0);
        if (!userRoleId && req.user?.userid) {
          const [[userRow]] = await db.query("SELECT roleid FROM users WHERE userid = ?", [req.user.userid]);
          if (userRow) userRoleId = Number(userRow.roleid);
        }
        if (userRoleId !== 1) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: Only Administrators are permitted to add or edit comments on standards."
          });
        }
      }

      // Check existing status and evidence in parallel
      const [[existingStatusRows], [userUploads], [proofDocs]] = await Promise.all([
        db.query(
          `SELECT status AS "Status" FROM compliancestatusoffices WHERE officeid = ? AND requirementid = ?`,
          [officeid, requirementid]
        ),
        nextStatusId !== 3
          ? db.query(
              `SELECT COUNT(*) as cnt FROM requirementuserassignments 
               WHERE officeid = ? AND requirementid = ? AND hasuploaded = TRUE`,
              [officeid, requirementid]
            )
          : Promise.resolve([[{ cnt: 1 }]]),
        nextStatusId !== 3
          ? db.query(
              `SELECT COUNT(*) as cnt FROM officeproofdocuments 
               WHERE (officeid = ? AND (requirementid = ? OR requirementid IS NULL))
                  OR (requirementid = ? AND officeid IS NULL)`,
              [officeid, requirementid, requirementid]
            )
          : Promise.resolve([[{ cnt: 1 }]])
      ]);

      const rawCurrentStatus = existingStatusRows[0]?.Status ?? existingStatusRows[0]?.status;
      const currentStatus = rawCurrentStatus != null ? Number(rawCurrentStatus) : 3;

      // If compliance status is actually being elevated to Partially Complied (4) or Complied (5), ensure evidence exists
      if (nextStatusId !== 3 && nextStatusId !== currentStatus) {
        const hasEvidence = (Number(userUploads[0]?.cnt) > 0) || (Number(proofDocs[0]?.cnt) > 0);
        if (!hasEvidence) {
          return res.status(400).json({
            success: false,
            message: "Cannot set compliance status to Partially Complied or Complied: No evidence or proof document has been uploaded for this requirement yet."
          });
        }
      }

      const updateSql = hasCommentPayload
        ? `UPDATE compliancestatusoffices
           SET Status = ?, comments = ?, lastupdated = CURRENT_TIMESTAMP
           WHERE officeid = ? AND requirementid = ?`
        : `UPDATE compliancestatusoffices
           SET Status = ?, lastupdated = CURRENT_TIMESTAMP
           WHERE officeid = ? AND requirementid = ?`;
      const updateParams = hasCommentPayload
        ? [nextStatusId, comments || null, officeid, requirementid]
        : [nextStatusId, officeid, requirementid];
      const [updateResult] = await db.query(updateSql, updateParams);

      if (!updateResult?.affectedRows) {
        await db.query(
          `INSERT INTO compliancestatusoffices (officeid, requirementid, Status, comments)
           VALUES (?, ?, ?, ?)`,
          [officeid, requirementid, nextStatusId, hasCommentPayload ? (comments || null) : null]
        );
      }

      // Update the overall office status
      await updateOverallOfficeStatus(officeid);

      const actorId = req.user?.userid || req.user?.id;
      const statusName = nextStatusId === 5 ? 'Complied' : (nextStatusId === 4 ? 'Partially Complied' : 'Not Complied');

      res.json({
        success: true,
        message: "Compliance status and comment updated successfully"
      });

      // Run audit log, notifications, and socket broadcast asynchronously without blocking response
      (async () => {
        try {
          const [[contextRows], [assignedUsers], [headUsers]] = await Promise.all([
            db.query(`
              SELECT r.requirementcode, r.description, o.officename, e.eventname
              FROM requirements r
              JOIN offices o ON o.officeid = ?
              LEFT JOIN events e ON e.eventid = o.eventid
              WHERE r.requirementid = ?
            `, [officeid, requirementid]),
            db.query(
              `SELECT userid FROM requirementuserassignments WHERE officeid = ? AND requirementid = ?`,
              [officeid, requirementid]
            ),
            db.query(
              `SELECT u.userid FROM users u
               JOIN headofoffice h ON u.userid = h.userid
               JOIN officeheadassignments oha ON h.headid = oha.headid
               WHERE oha.officeid = ?`,
              [officeid]
            )
          ]);

          const reqCode = contextRows[0]?.requirementcode || `REQ-${requirementid}`;
          const officeName = contextRows[0]?.officename || `Office #${officeid}`;
          const eventName = contextRows[0]?.eventname || null;

          if (actorId) {
            await recordLog(actorId, 'ComplianceStatusUpdated', {
              officeid: Number(officeid),
              officename: officeName,
              eventname: eventName,
              requirementid: Number(requirementid),
              requirementcode: reqCode,
              previousStatus: currentStatus ? Number(currentStatus) : null,
              newStatus: nextStatusId,
              statusName,
              comments: hasCommentPayload ? comments : undefined
            });
          }

          const recipientIds = [...new Set([
            ...(assignedUsers || []).map(u => Number(u.userid)),
            ...(headUsers || []).map(u => Number(u.userid))
          ])].filter(id => id !== actorId && id > 0);

          if (recipientIds.length > 0) {
            const commentNote = hasCommentPayload && comments ? ` Comment: "${comments.slice(0, 80)}${comments.length > 80 ? '...' : ''}"` : '';
            await createNotifications({
              userIds: recipientIds,
              adminid: actorId,
              title: 'Compliance Status Updated',
              message: `Compliance status for standard "${reqCode}" in "${officeName}" was updated to "${statusName}".${commentNote}`,
              type: nextStatusId === 5 ? 'success' : (nextStatusId === 4 ? 'info' : 'warning'),
              relatedtable: 'compliancestatusoffices',
              relatedid: Number(officeid),
              meta: {
                officeid: Number(officeid),
                requirementid: Number(requirementid),
                openSubmission: true
              }
            });
          }
        } catch (logOrNotifErr) {
          console.warn('Notice: Error in logging or notifying for status update:', logOrNotifErr.message);
        }

        try {
          const { emitDataChange } = require('../socket');
          emitDataChange('compliance', {
            action: 'status_updated',
            officeid: Number(officeid),
            requirementid: Number(requirementid),
            statusid: nextStatusId,
            statusName,
            comments: hasCommentPayload ? comments : undefined
          });
          emitDataChange('requirements', {
            action: 'status_updated',
            officeid: Number(officeid),
            requirementid: Number(requirementid),
            statusid: nextStatusId,
            statusName,
            comments: hasCommentPayload ? comments : undefined
          });
        } catch (sErr) {}
      })();
    } catch (err) {
      console.error("Error updating requirement status:", err);
      res.status(500).json({
        success: false,
        error: "Database error",
        details: err.message
      });
    }
  }
};

// ================================
// HELPER FUNCTION: UPDATE OVERALL OFFICE STATUS
// ================================
async function updateOverallOfficeStatus(officeid) {
  try {
    // Get counts for each status
    const [counts] = await db.query(`
      SELECT 
        COUNT(*) as totalrequirements,
        SUM(CASE WHEN Status::text = '5' THEN 1 ELSE 0 END) as compliedcount,
        SUM(CASE WHEN Status::text = '4' THEN 1 ELSE 0 END) as partiallycompliedcount,
        SUM(CASE WHEN Status::text = '3' THEN 1 ELSE 0 END) as notcompliedcount
      FROM compliancestatusoffices
      WHERE officeid = ?
    `, [officeid]);

    const total = Number(counts[0]?.totalrequirements || 0);
    const complied = Number(counts[0]?.compliedcount || 0);
    const partially = Number(counts[0]?.partiallycompliedcount || 0);
    const notComplied = Number(counts[0]?.notcompliedcount || 0);

    // Calculate percentage: Complied = 100%, Partially = 50%, Not Complied = 0%
    let compliancepercent = 0;
    if (total > 0) {
      const weightedScore = (complied * 100) + (partially * 50);
      const maxScore = total * 100;
      compliancepercent = (weightedScore / maxScore) * 100;
    }

    // Determine overall status based on requirement composition (same rule as dashboard cards)
    let overallstatus = 'Not Complied';
    if (total > 0 && complied === total) {
      overallstatus = 'Complied';
    } else if (total > 0 && notComplied === total) {
      overallstatus = 'Not Complied';
    } else if (total > 0) {
      overallstatus = 'Partially Complied';
    }

    // Insert or update the overall status in PostgreSQL
    await db.query(
      `INSERT INTO OverallOfficeStatus 
        (officeid, compliedcount, partiallycompliedcount, notcompliedcount, totalrequirements, compliancepercent, overallstatus)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (officeid) DO UPDATE SET
        compliedcount = EXCLUDED.compliedcount,
        partiallycompliedcount = EXCLUDED.partiallycompliedcount,
        notcompliedcount = EXCLUDED.notcompliedcount,
        totalrequirements = EXCLUDED.totalrequirements,
        compliancepercent = EXCLUDED.compliancepercent,
        overallstatus = EXCLUDED.overallstatus,
        lastupdated = CURRENT_TIMESTAMP`,
      [officeid, complied, partially, notComplied, total, compliancepercent.toFixed(2), overallstatus]
    );

  } catch (err) {
    console.error('Error updating overall office status:', err);
    throw err;
  }
}

module.exports = OfficesController;
