const db = require('../db');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { recordLog } = require('./logsController');
const { createNotifications } = require('../utils/notificationService');

let eventColumnsEnsured = false;
const ensureEventColumns = async () => {
  if (eventColumnsEnsured) return;
  try {
    await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS islocked BOOLEAN DEFAULT FALSE');
    await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS lockedat TIMESTAMP DEFAULT NULL');
    await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS lockedby INT DEFAULT NULL');
    await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS deadline TIMESTAMP DEFAULT NULL');
    await db.query('ALTER TABLE Events ADD COLUMN IF NOT EXISTS lastreminderdate DATE DEFAULT NULL');
    eventColumnsEnsured = true;
  } catch (e) {
    console.warn('ensureEventColumns warning:', e.message);
  }
};

const getAssignedUserIdsForEvent = async (eventid) => {
  try {
    const [rows] = await db.query(
      `SELECT DISTINCT userid FROM (
         SELECT h.userid
         FROM officeheadassignments oha
         JOIN headofoffice h ON oha.headid = h.headid
         JOIN offices o ON oha.officeid = o.officeid
         WHERE o.eventid = ? AND h.userid IS NOT NULL
         UNION
         SELECT rua.userid
         FROM requirementuserassignments rua
         JOIN offices o ON rua.officeid = o.officeid
         WHERE o.eventid = ? AND rua.userid IS NOT NULL
         UNION
         SELECT pa.userid
         FROM personnelassignments pa
         WHERE pa.eventid = ? AND pa.userid IS NOT NULL
       ) assigned_users`,
      [eventid, eventid, eventid]
    );
    return (rows || []).map(r => Number(r.userid)).filter(id => Number.isInteger(id) && id > 0);
  } catch (err) {
    console.warn('getAssignedUserIdsForEvent warning:', err.message);
    return [];
  }
};

const checkAndSendAutomatedDeadlineReminders = async (eventsList) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    for (const ev of (eventsList || [])) {
      if (!ev.deadline || String(ev.status || 'active').toLowerCase() === 'inactive') continue;
      // Never send overdue/countdown reminders if the accreditation is already 100% complied
      if (Number(ev.completionpercent || 0) >= 100) continue;
      const deadlineDate = new Date(ev.deadline);
      if (isNaN(deadlineDate.getTime())) continue;
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      // Send automated daily countdown reminder when 1 to 7 days remain, or if due today (0)
      if (diffDays >= 0 && diffDays <= 7) {
        const lastRem = ev.lastreminderdate ? new Date(ev.lastreminderdate).toISOString().slice(0, 10) : null;
        if (lastRem !== todayStr) {
          await db.query('UPDATE Events SET lastreminderdate = CURRENT_DATE WHERE eventid = ?', [ev.eventid]);
          const userIds = await getAssignedUserIdsForEvent(ev.eventid);
          if (userIds.length > 0) {
            const label = ev.eventcode || ev.eventname || 'Accreditation';
            const dayText = diffDays === 0 ? 'is due TODAY' : `has ${diffDays} day${diffDays === 1 ? '' : 's'} remaining until the submission deadline`;
            await createNotifications({
              userIds,
              adminid: null,
              title: `Deadline Countdown: ${label}`,
              message: `${label} ${dayText} (${deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). Please ensure all assigned compliance files are uploaded.`,
              type: diffDays <= 2 ? 'warning' : 'info',
              relatedtable: 'events_deadline',
              relatedid: Number(ev.eventid)
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('Automated deadline reminder check error:', e.message);
  }
};

const sanitizeFolderName = (s) =>
  String(s || '')
    .replace(/[^A-Za-z0-9.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();

// Copy event (migrated from frontend)
const copyEvent = async (req, res) => {
  try {
    const { sourceEventId, newEventName, newEventCode, newDescription } = req.body;
    if (!sourceEventId || !newEventName || !newEventCode) {
      return res.status(400).json({
        success: false,
        message: 'Source event ID, new event name, and new event code are required'
      });
    }

    // Get source event
    const [rows] = await db.query('SELECT * FROM Events WHERE eventid = ?', [sourceEventId]);
    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'Source event not found' });
    }
    const sourceEvent = rows[0];

    // Check if eventcode already exists
    const [existingCode] = await db.query('SELECT * FROM Events WHERE eventcode = ?', [newEventCode]);
    if (existingCode && existingCode.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Event Code "${newEventCode}" is already in use. Please enter a unique Event Code.`
      });
    }

    // Insert new event
    const [result] = await db.query(
      'INSERT INTO Events (eventname, eventcode, Description, createdat, updatedat) VALUES (?, ?, ?, NOW(), NOW())',
      [newEventName, newEventCode, newDescription || sourceEvent.Description || null]
    );

    // Skipping creation of any folder for the copied event (no filesystem side-effects)
    const sanitize = sanitizeFolderName;

    // --- BEGIN: Copy Areas, Criteria, Requirements ---
    const newEventId = result.insertId;

    // 1. Copy AREAS
    const [areas] = await db.query('SELECT * FROM areas WHERE eventid = ?', [sourceEventId]);
    const areaIdMap = {}; // oldAreaId -> newAreaId
    for (const area of areas) {
      const oldAreaId = area.areaid ?? area.areaid;
      const [areaResult] = await db.query(
        'INSERT INTO areas (areacode, areaname, eventid, Description, isactive, sortorder, createdat, updatedat) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [area.areacode ?? area.areacode, area.areaname ?? area.areaname, newEventId, area.Description ?? area.description, area.isactive ?? area.isactive ?? 1, area.sortorder ?? area.sortorder ?? 0]
      );
      const newAreaId = areaResult[0]?.areaid ?? areaResult[0]?.areaid ?? areaResult.insertId;
      if (oldAreaId) areaIdMap[oldAreaId] = newAreaId;
    }

    // 2. Copy CRITERIA (including no-area criteria) with parentcriteriaid remapping
    const [criteria] = await db.query('SELECT * FROM criteria WHERE eventid = ?', [sourceEventId]);
    const criteriaIdMap = {}; // oldCriteriaId -> newCriteriaId
    // First pass: insert all criteria without parentcriteriaid
    for (const crit of criteria) {
      const oldCritId = crit.criteriaid ?? crit.criteriaid;
      const origAreaId = crit.areaid ?? crit.areaid;
      const newAreaId = origAreaId && areaIdMap[origAreaId] ? areaIdMap[origAreaId] : null;
      try {
        const [critResult] = await db.query(
          'INSERT INTO criteria (criteriacode, eventid, areaid, parentcriteriaid, criterianame, Description, createdat, updatedat, isactive) VALUES (?, ?, ?, NULL, ?, ?, NOW(), NOW(), ?)',
          [crit.criteriacode ?? crit.criteriacode, newEventId, newAreaId, crit.criterianame ?? crit.criterianame, crit.Description ?? crit.description, crit.isactive ?? crit.isactive ?? 1]
        );
        const newCritId = critResult[0]?.criteriaid ?? critResult[0]?.criteriaid ?? critResult.insertId;
        if (oldCritId) criteriaIdMap[oldCritId] = newCritId;
      } catch (err) {
        console.error('Error inserting criteria:', err, crit);
        throw err;
      }
    }
    // Second pass: update parentcriteriaid for those that had it
    for (const crit of criteria) {
      const oldCritId = crit.criteriaid ?? crit.criteriaid;
      const oldParentId = crit.parentcriteriaid ?? crit.parentcriteriaid;
      if (oldParentId) {
        const newCritId = criteriaIdMap[oldCritId];
        const newParentId = criteriaIdMap[oldParentId] || null;
        if (newCritId && newParentId) {
          try {
            await db.query('UPDATE criteria SET parentcriteriaid = ? WHERE criteriaid = ?', [newParentId, newCritId]);
          } catch (err) {
            console.error('Error updating parentcriteriaid:', err, crit);
            throw err;
          }
        }
      }
    }

    // 3. Copy REQUIREMENTS with parentrequirementcode remapping
    const criteriaIds = Object.keys(criteriaIdMap).map(Number).filter(Boolean);
    if (criteriaIds.length > 0) {
      const [requirements] = await db.query(`SELECT * FROM requirements WHERE criteriaid IN (${criteriaIds.join(',')})`);
      for (const req of requirements) {
        const origCritId = req.criteriaid ?? req.criteriaid;
        const newCriteriaId = origCritId && criteriaIdMap[origCritId] ? criteriaIdMap[origCritId] : null;
        try {
          await db.query(
            'INSERT INTO requirements (requirementcode, Description, criteriaid, parentrequirementcode, createdat, updatedat) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [req.requirementcode ?? req.requirementcode, req.Description ?? req.description, newCriteriaId, req.parentrequirementcode ?? req.parentrequirementcode ?? null]
          );
        } catch (err) {
          console.error('Error inserting requirement:', err, req);
          throw err;
        }
      }
    }
    // --- END: Copy Areas, Criteria, Requirements ---

    res.json({
      success: true,
      message: 'Event copied successfully',
      data: {
        eventid: newEventId,
        eventname: newEventName,
        eventcode: newEventCode,
        Description: newDescription || sourceEvent.Description,
        FolderPath: sanitize(newEventCode || newEventName)
      }
    });
    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'EventCopied', {
          sourceEventId: sourceEvent.eventid,
          sourceEventName: sourceEvent.eventname,
          newEventId,
          newEventName,
          newEventCode
        });
      } catch (e) {}
    }
  } catch (error) {
    console.error('Error copying event:', error);
    res.status(500).json({ success: false, message: 'Error copying event' });
  }
};

// Get all events (with role-based scoping for Personnel and Auditors)
const getAllEvents = async (req, res) => {
  try {
    await ensureEventColumns();
    const userid = Number(req.user?.userid);
    let roleid = Number(req.user?.roleid);

    // If roleid not present on req.user, look up user's role from DB
    if (!roleid && userid) {
      const [[userRow]] = await db.query('SELECT roleid FROM users WHERE userid = ?', [userid]);
      if (userRow) roleid = Number(userRow.roleid);
    }

    const isAdmin = roleid === 1;

    const enrichEventsWithCompletion = async (eventList) => {
      if (!Array.isArray(eventList) || eventList.length === 0) return eventList;
      try {
        const [stats] = await db.query(`
          SELECT 
            o.eventid,
            COUNT(cso.csofficeid) AS totalstandards,
            SUM(CASE WHEN cso.status::text = '5' THEN 1 ELSE 0 END) AS compliedstandards,
            SUM(CASE WHEN cso.status::text = '4' THEN 1 ELSE 0 END) AS partialstandards,
            SUM(CASE WHEN cso.status::text = '3' THEN 1 ELSE 0 END) AS notcompliedstandards,
            ROUND(
              (((SUM(CASE WHEN cso.status::text = '5' THEN 1.0 ELSE 0.0 END) * 100.0) +
                (SUM(CASE WHEN cso.status::text = '4' THEN 1.0 ELSE 0.0 END) * 50.0)) /
               NULLIF(COUNT(cso.csofficeid), 0))::numeric,
              1
            ) AS completionpercent
          FROM offices o
          JOIN compliancestatusoffices cso ON o.officeid = cso.officeid
          WHERE o.eventid IS NOT NULL
          GROUP BY o.eventid
        `);
        const map = new Map();
        for (const s of stats) {
          const total = Number(s.totalstandards || 0);
          const complied = Number(s.compliedstandards || 0);
          const pct = Number(s.completionpercent || 0);
          const isAllComplied = total > 0 && complied === total;
          const finalPct = isAllComplied ? 100 : pct;
          map.set(Number(s.eventid), {
            completionpercent: finalPct,
            totalstandards: total,
            compliedstandards: complied,
            iscompleted: isAllComplied
          });
        }
        return eventList.map(ev => {
          const evData = map.get(Number(ev.eventid));
          const pct = evData ? evData.completionpercent : 0;
          const isDone = evData ? evData.iscompleted : false;
          return {
            ...ev,
            completionpercent: pct,
            completionPercent: pct,
            totalstandards: evData ? evData.totalstandards : 0,
            compliedstandards: evData ? evData.compliedstandards : 0,
            iscompleted: isDone,
            isCompleted: isDone
          };
        });
      } catch (err) {
        console.warn('Enrich events completion warning:', err.message);
        return eventList;
      }
    };

    // Admins see all events
    if (isAdmin || !userid) {
      const [events] = await db.query('SELECT * FROM Events ORDER BY createdat DESC');
      const enriched = await enrichEventsWithCompletion(events);
      checkAndSendAutomatedDeadlineReminders(enriched).catch(() => {});
      return res.json({
        success: true,
        data: enriched
      });
    }

    // Auditor: only see events where they have area assignments
    if (roleid === 4) {
      const [events] = await db.query(
        `SELECT DISTINCT e.*
         FROM Events e
         JOIN areas ar ON ar.eventid = e.eventid
         JOIN auditorareaassignments aaa ON aaa.areaid = ar.areaid
         WHERE aaa.auditoruserid = ?
         ORDER BY e.createdat DESC`,
        [userid]
      );
      const enriched = await enrichEventsWithCompletion(events);
      return res.json({
        success: true,
        data: enriched
      });
    }

    // Personnel / Office Head / Officer (roleid 2, 3, etc.):
    // Only see events where the user is managing an office/program or assigned requirements/areas under that specific accreditation
    const [events] = await db.query(
      `SELECT DISTINCT e.*
       FROM Events e
       WHERE e.eventid IN (
         -- 1. Direct office assignment via officeheadassignments (joined with headofoffice)
         SELECT o.eventid
         FROM officeheadassignments oha
         JOIN headofoffice h ON oha.headid = h.headid
         JOIN offices o ON oha.officeid = o.officeid
         WHERE h.userid = ? AND o.eventid IS NOT NULL

         UNION

         -- 2. Direct requirement assignments to user on an office under the event
         SELECT o.eventid
         FROM requirementuserassignments rua
         JOIN offices o ON rua.officeid = o.officeid
         WHERE rua.userid = ? AND o.eventid IS NOT NULL

         UNION

         -- 3. Direct requirement assignments linked to criteria under the event
         SELECT c.eventid
         FROM requirementuserassignments rua
         JOIN requirements r ON rua.requirementid = r.requirementid
         JOIN criteria c ON r.criteriaid = c.criteriaid
         WHERE rua.userid = ? AND c.eventid IS NOT NULL

         UNION

         -- 4. Direct requirement assignments linked to criteria -> area under the event
         SELECT a.eventid
         FROM requirementuserassignments rua
         JOIN requirements r ON rua.requirementid = r.requirementid
         JOIN criteria c ON r.criteriaid = c.criteriaid
         JOIN areas a ON c.areaid = a.areaid
         WHERE rua.userid = ? AND a.eventid IS NOT NULL

         UNION

         -- 5. Direct assignment via personnelassignments table
         SELECT pa.eventid
         FROM personnelassignments pa
         WHERE pa.userid = ? AND pa.eventid IS NOT NULL

         UNION

         -- 6. Assignment via personnelassignments linked to area
         SELECT ar.eventid
         FROM personnelassignments pa
         JOIN areas ar ON pa.areaid = ar.areaid
         WHERE pa.userid = ? AND ar.eventid IS NOT NULL

         UNION

         -- 7. Assignment via personnelassignments linked to criteria
         SELECT c.eventid
         FROM personnelassignments pa
         JOIN criteria c ON pa.criteriaid = c.criteriaid
         WHERE pa.userid = ? AND c.eventid IS NOT NULL

         UNION

         -- 8. Assignment via personnelassignments linked to requirements
         SELECT c.eventid
         FROM personnelassignments pa
         JOIN requirements r ON pa.requirementid = r.requirementid
         JOIN criteria c ON r.criteriaid = c.criteriaid
         WHERE pa.userid = ? AND c.eventid IS NOT NULL
       )
       ORDER BY e.createdat DESC`,
      [userid, userid, userid, userid, userid, userid, userid, userid]
    );

    const enriched = await enrichEventsWithCompletion(events);
    return res.json({
      success: true,
      data: enriched
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
    await ensureEventColumns();
    const { eventname, eventcode, Description, accreditationlevel, deadline, islocked } = req.body;

    // Validate required fields
    if (!eventname || !eventcode) {
      return res.status(400).json({
        success: false,
        message: 'Event name and code are required'
      });
    }

    const parsedDeadline = deadline && String(deadline).trim() ? new Date(deadline) : null;
    const validDeadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline.toISOString() : null;
    const lockedVal = Boolean(islocked);

    // Insert new event
    const [result] = await db.query(
      'INSERT INTO Events (eventname, eventcode, Description, createdat, updatedat, accreditationlevel, deadline, islocked, lockedat, lockedby) VALUES (?, ?, ?, NOW(), NOW(), ?, ?, ?, ?, ?)',
      [
        eventname,
        eventcode,
        Description || null,
        accreditationlevel || 'N/A',
        validDeadline,
        lockedVal,
        lockedVal ? new Date().toISOString() : null,
        lockedVal && req.user?.userid ? Number(req.user.userid) : null
      ]
    );

    // Create folder for the event inside uploads/events using eventcode (preferred for shorter, stable folder names)
    const sanitizedName = sanitizeFolderName(eventcode || eventname);
    const eventFolderPath = path.join(__dirname, '..', 'uploads', 'events', sanitizedName);
    
    // Ensure uploads/events directory exists
    const eventsBasePath = path.join(__dirname, '..', 'uploads', 'events');
    if (!fs.existsSync(eventsBasePath)) {
      fs.mkdirSync(eventsBasePath, { recursive: true });
    }
    
    // Create the event-specific folder
    if (!fs.existsSync(eventFolderPath)) {
      fs.mkdirSync(eventFolderPath, { recursive: true });
      console.log(`Created event folder: ${eventFolderPath}`);
    }

    res.json({
      success: true,
      message: 'Event added successfully',
      data: {
        eventid: result.insertId,
        eventname,
        eventcode,
        Description,
        accreditationlevel: accreditationlevel || 'N/A',
        deadline: validDeadline,
        islocked: lockedVal,
        FolderPath: sanitizedName
      }
    });
    if (req.user && req.user.userid) {
      try {
        recordLog(req.user.userid, 'EventAdded', { eventid: result.insertId, eventname, eventcode });
      } catch (e) {}
    }
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

      // 1. Clean up requirements under criteria linked to these events (or under areas of these events)
      try {
        const [targetCriteria] = await db.query(
          `SELECT criteriaid FROM criteria WHERE eventid IN (${placeholders}) OR areaid IN (SELECT areaid FROM areas WHERE eventid IN (${placeholders}))`,
          [...eventIds, ...eventIds]
        );
        if (targetCriteria && targetCriteria.length > 0) {
          const critIds = targetCriteria.map(c => c.criteriaid ?? c.criteriaid).filter(Boolean);
          if (critIds.length > 0) {
            const critPlaceholders = critIds.map(() => '?').join(',');
            await db.query(`DELETE FROM officeproofdocuments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
            await db.query(`DELETE FROM requirementuserassignments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
            await db.query(`DELETE FROM compliancestatusoffices WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IN (${critPlaceholders}))`, critIds);
            await db.query(`DELETE FROM requirements WHERE criteriaid IN (${critPlaceholders})`, critIds);
          }
        }
        // Cleanup any remaining orphaned requirements
        await db.query(`DELETE FROM officeproofdocuments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IS NULL OR criteriaid NOT IN (SELECT criteriaid FROM criteria))`);
        await db.query(`DELETE FROM requirementuserassignments WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IS NULL OR criteriaid NOT IN (SELECT criteriaid FROM criteria))`);
        await db.query(`DELETE FROM compliancestatusoffices WHERE requirementid IN (SELECT requirementid FROM requirements WHERE criteriaid IS NULL OR criteriaid NOT IN (SELECT criteriaid FROM criteria))`);
        await db.query(`DELETE FROM requirements WHERE criteriaid IS NULL OR criteriaid NOT IN (SELECT criteriaid FROM criteria)`);
      } catch (cascadeErr) {
        console.error('Error during cascading requirement cleanup in deleteEvents:', cascadeErr);
      }

      // Fetch names and codes for logging before deletion
      const [toDeleteRows] = await db.query(`SELECT eventid, eventname, eventcode FROM Events WHERE eventid IN (${placeholders})`, eventIds);
      const deletedNames = toDeleteRows.map(r => r.eventname);
      const deletedCodes = toDeleteRows.map(r => r.eventcode);

      const [result] = await db.query(
        `DELETE FROM Events WHERE eventid IN (${placeholders})`,
        eventIds
      );
    // Attempt to delete corresponding folders under uploads/events for each deleted event name
    const eventsBasePath = path.join(__dirname, '..', 'uploads', 'events');
    const deletedFolders = [];

    if (fs.existsSync(eventsBasePath)) {
      for (let i = 0; i < toDeleteRows.length; i++) {
        const evName = deletedNames[i];
        const evCode = deletedCodes[i];
        try {
          // prefer code for folder lookup, fallback to name
          const san = sanitizeFolderName(evCode || evName);
          let folderPath = path.join(eventsBasePath, san);

          if (!fs.existsSync(folderPath)) {
            try {
              const entries = fs.readdirSync(eventsBasePath, { withFileTypes: true });
              const matched = entries.find(entry => entry.isDirectory() && sanitizeFolderName(entry.name) === san);
              if (matched) {
                folderPath = path.join(eventsBasePath, matched.name);
              }
            } catch (err) {
              // ignore matching errors
            }
          }

          if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            try {
              // Node 14+ supports fs.rmSync with recursive; fallback to rmdirSync if needed
              if (fs.rmSync) {
                fs.rmSync(folderPath, { recursive: true, force: true });
              } else {
                fs.rmdirSync(folderPath, { recursive: true });
              }
              deletedFolders.push(folderPath);
              console.log('Deleted event folder:', folderPath);
            } catch (err) {
              console.warn('Failed to delete event folder:', folderPath, err.message || err);
            }
          }
        } catch (err) {
          console.warn('Error during folder deletion for event', evName, err && err.message ? err.message : err);
        }
      }
    }

    res.json({
      success: true,
      message: `${result.affectedRows} event(s) deleted successfully`,
      deletedCount: result.affectedRows,
      deletedFolders
    });
    if (req.user && req.user.userid) {
      try { recordLog(req.user.userid, 'EventDeleted', { eventIds, deletedNames }); } catch (e) {}
    }
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
    await ensureEventColumns();
    const { id } = req.params;
    const { eventname, eventcode, Description, status, accreditationlevel, deadline, islocked } = req.body;

    // Debug logging
    console.log('updateEvent called with:', { id, eventname, eventcode, Description, accreditationlevel, deadline, islocked });

    // Validate required fields
    if (!eventname || !eventcode) {
      return res.status(400).json({
        success: false,
        message: 'Event name and code are required'
      });
    }

    // Fetch existing event to determine if folder rename is needed (get both name and code)
    let existingEventName = null;
    let existingEventCode = null;
    let existingEventRow = null;
    try {
      const [existingRows] = await db.query('SELECT * FROM Events WHERE eventid = ?', [id]);
      if (existingRows && existingRows.length > 0) {
        existingEventRow = existingRows[0];
        existingEventName = existingRows[0].eventname;
        existingEventCode = existingRows[0].eventcode;
      }
    } catch (err) {
      console.warn('Could not fetch existing event name/code for folder rename check:', err.message || err);
    }

    const nextDeadline = deadline !== undefined
      ? (deadline && String(deadline).trim() ? new Date(deadline).toISOString() : null)
      : (existingEventRow?.deadline ?? null);
    const nextLocked = islocked !== undefined ? Boolean(islocked) : Boolean(existingEventRow?.islocked);
    const wasLocked = Boolean(existingEventRow?.islocked);
    const nextLockedAt = nextLocked ? (wasLocked ? existingEventRow?.lockedat : new Date().toISOString()) : null;
    const nextLockedBy = nextLocked ? (wasLocked ? existingEventRow?.lockedby : (req.user?.userid ? Number(req.user.userid) : null)) : null;

    // Update event, including status, accreditationlevel, deadline, and islocked
    const [result] = await db.query(
      'UPDATE Events SET eventname = ?, eventcode = ?, Description = ?, status = ?, accreditationlevel = ?, deadline = ?, islocked = ?, lockedat = ?, lockedby = ?, updatedat = NOW() WHERE eventid = ?',
      [eventname, eventcode, Description || null, status || 'active', accreditationlevel || 'N/A', nextDeadline, nextLocked, nextLockedAt, nextLockedBy, id]
    );

    if (result.affectedRows === 0) {
      console.log('No event found with id:', id);
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    console.log('Event updated successfully for id:', id);
    if (req.user && req.user.userid) {
      try {
        const changes = {};
        if (existingEventName && existingEventName !== eventname) changes.eventname = { from: existingEventName, to: eventname };
        if (existingEventCode && existingEventCode !== eventcode) changes.eventcode = { from: existingEventCode, to: eventcode };
        recordLog(req.user.userid, 'EventUpdated', { eventid: id, eventname, eventcode, changes });
      } catch (e) {}
    }
    // If the event name changed, attempt to rename its uploads folder to match new sanitized name
    try {
      // Prefer renaming folders when eventcode changed; fallback to eventname if code absent
      if ((existingEventCode && existingEventCode !== eventcode) || (!existingEventCode && existingEventName && existingEventName !== eventname)) {
        const eventsBasePath = path.join(__dirname, '..', 'uploads', 'events');
        const oldSan = sanitizeFolderName(existingEventCode || existingEventName);
        const newSan = sanitizeFolderName(eventcode || eventname);

        // Locate actual old folder: try exact, then match by sanitized entry names
        let oldFolderPath = path.join(eventsBasePath, oldSan);
        if (!fs.existsSync(oldFolderPath)) {
          try {
            const entries = fs.readdirSync(eventsBasePath, { withFileTypes: true });
            const matched = entries.find(entry => entry.isDirectory() && sanitizeFolderName(entry.name) === oldSan);
            if (matched) oldFolderPath = path.join(eventsBasePath, matched.name);
          } catch (err) {
            // ignore
          }
        }

        const newFolderPath = path.join(eventsBasePath, newSan);

        if (fs.existsSync(oldFolderPath) && fs.statSync(oldFolderPath).isDirectory()) {
          if (!fs.existsSync(newFolderPath)) {
            try {
              fs.renameSync(oldFolderPath, newFolderPath);
              console.log(`Renamed event folder: ${oldFolderPath} -> ${newFolderPath}`);
            } catch (err) {
              console.warn('Failed to rename event folder:', err.message || err);
            }
          } else {
            console.warn('Destination folder already exists, skipping rename:', newFolderPath);
          }
        }
      }
    } catch (err) {
      console.warn('Error while attempting to rename event folder:', err.message || err);
    }
    res.json({
      success: true,
      message: 'Event updated successfully',
      data: {
        eventid: parseInt(id),
        eventname,
        eventcode,
        Description,
        status,
        accreditationlevel: accreditationlevel || 'N/A',
        deadline: nextDeadline,
        islocked: nextLocked,
        lockedat: nextLockedAt,
        lockedby: nextLockedBy
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

// Toggle Audit Freeze / Lock on an event
const toggleEventLock = async (req, res) => {
  try {
    await ensureEventColumns();
    const { id } = req.params;
    const { islocked } = req.body;
    const actorId = req.user?.userid ? Number(req.user.userid) : null;

    const [rows] = await db.query('SELECT * FROM Events WHERE eventid = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const ev = rows[0];
    const nextLocked = islocked !== undefined ? Boolean(islocked) : !Boolean(ev.islocked);
    const lockedAt = nextLocked ? new Date().toISOString() : null;
    const lockedBy = nextLocked ? actorId : null;

    await db.query(
      'UPDATE Events SET islocked = ?, lockedat = ?, lockedby = ?, updatedat = NOW() WHERE eventid = ?',
      [nextLocked, lockedAt, lockedBy, id]
    );

    if (actorId) {
      try {
        recordLog(actorId, nextLocked ? 'EventLocked' : 'EventUnlocked', {
          eventid: Number(id),
          eventname: ev.eventname,
          eventcode: ev.eventcode,
          islocked: nextLocked
        });
      } catch (e) {}
    }

    // Notify assigned users about Audit Freeze status change
    try {
      const userIds = await getAssignedUserIdsForEvent(id);
      if (userIds.length > 0) {
        const label = ev.eventcode || ev.eventname || 'Accreditation';
        await createNotifications({
          userIds: userIds.filter(uid => uid !== actorId),
          adminid: actorId,
          title: nextLocked ? `Audit Freeze Active: ${label}` : `Audit Freeze Lifted: ${label}`,
          message: nextLocked
            ? `${label} has been placed under Audit Freeze for evaluation. Evidence uploads and removals are temporarily locked.`
            : `${label} is now unlocked. You may resume uploading and updating compliance documents.`,
          type: nextLocked ? 'warning' : 'info',
          relatedtable: 'events_lock',
          relatedid: Number(id)
        });
      }
    } catch (nErr) {
      console.warn('Notification error on toggleEventLock:', nErr.message);
    }

    return res.json({
      success: true,
      message: nextLocked ? 'Audit Freeze activated for this accreditation' : 'Audit Freeze lifted for this accreditation',
      data: {
        ...ev,
        islocked: nextLocked,
        lockedat: lockedAt,
        lockedby: lockedBy
      }
    });
  } catch (error) {
    console.error('Error toggling event lock:', error);
    return res.status(500).json({ success: false, message: 'Failed to update audit lock state' });
  }
};

// Update Event Deadline
const updateEventDeadline = async (req, res) => {
  try {
    await ensureEventColumns();
    const { id } = req.params;
    const { deadline } = req.body;
    const actorId = req.user?.userid ? Number(req.user.userid) : null;

    const [rows] = await db.query('SELECT * FROM Events WHERE eventid = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const ev = rows[0];
    const parsedDeadline = deadline && String(deadline).trim() ? new Date(deadline) : null;
    const validDeadline = parsedDeadline && !isNaN(parsedDeadline.getTime()) ? parsedDeadline.toISOString() : null;

    await db.query(
      'UPDATE Events SET deadline = ?, updatedat = NOW() WHERE eventid = ?',
      [validDeadline, id]
    );

    if (actorId) {
      try {
        recordLog(actorId, 'EventDeadlineUpdated', {
          eventid: Number(id),
          eventname: ev.eventname,
          eventcode: ev.eventcode,
          deadline: validDeadline
        });
      } catch (e) {}
    }

    if (validDeadline) {
      try {
        const userIds = await getAssignedUserIdsForEvent(id);
        if (userIds.length > 0) {
          const label = ev.eventcode || ev.eventname || 'Accreditation';
          const formatted = new Date(validDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          await createNotifications({
            userIds: userIds.filter(uid => uid !== actorId),
            adminid: actorId,
            title: `Target Deadline Set: ${label}`,
            message: `The submission deadline for ${label} has been set to ${formatted}.`,
            type: 'info',
            relatedtable: 'events_deadline',
            relatedid: Number(id)
          });
        }
      } catch (nErr) {
        console.warn('Notification error on updateEventDeadline:', nErr.message);
      }
    }

    return res.json({
      success: true,
      message: validDeadline ? 'Submission deadline updated' : 'Submission deadline cleared',
      data: {
        ...ev,
        deadline: validDeadline
      }
    });
  } catch (error) {
    console.error('Error updating event deadline:', error);
    return res.status(500).json({ success: false, message: 'Failed to update deadline' });
  }
};

// Trigger a manual countdown reminder notification for an event
const sendEventReminder = async (req, res) => {
  try {
    await ensureEventColumns();
    const { id } = req.params;
    const actorId = req.user?.userid ? Number(req.user.userid) : null;

    const [rows] = await db.query('SELECT * FROM Events WHERE eventid = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    const ev = rows[0];
    const userIds = await getAssignedUserIdsForEvent(id);
    if (userIds.length === 0) {
      return res.json({
        success: true,
        notifiedCount: 0,
        message: 'No personnel or office heads are currently assigned to this accreditation.'
      });
    }

    const label = ev.eventcode || ev.eventname || 'Accreditation';
    let deadlineNote = 'Please review your assigned compliance standards and upload any pending documents.';
    
    // Check if event has already reached 100% compliance
    let isFullyComplied = false;
    try {
      const [[compRow]] = await db.query(`
        SELECT 
          COUNT(cso.csofficeid) AS total,
          SUM(CASE WHEN cso.status::text = '5' THEN 1 ELSE 0 END) AS complied
        FROM offices o
        JOIN compliancestatusoffices cso ON o.officeid = cso.officeid
        WHERE o.eventid = ?
      `, [id]);
      if (compRow && Number(compRow.total) > 0 && Number(compRow.total) === Number(compRow.complied)) {
        isFullyComplied = true;
      }
    } catch (e) {}

    if (isFullyComplied) {
      deadlineNote = `${label} has reached 100% compliance! All required standards and evidence documents have been satisfied.`;
    } else if (ev.deadline) {
      const d = new Date(ev.deadline);
      if (!isNaN(d.getTime())) {
        const now = new Date();
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const deadlineMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const diffDays = Math.round((deadlineMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));
        const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (diffDays < 0) {
          deadlineNote = `The target deadline (${formatted}) has passed by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}. Immediate submission of remaining documents is required.`;
        } else if (diffDays === 0) {
          deadlineNote = `Submissions are due TODAY (${formatted}). Please finalize all pending files.`;
        } else {
          deadlineNote = `${diffDays} day${diffDays === 1 ? '' : 's'} remaining until the ${formatted} deadline. Please complete your assigned evidence uploads.`;
        }
      }
    }

    await createNotifications({
      userIds,
      adminid: actorId,
      title: `Compliance Reminder: ${label}`,
      message: deadlineNote,
      type: 'warning',
      relatedtable: 'events_reminder',
      relatedid: Number(id)
    });

    await db.query('UPDATE Events SET lastreminderdate = CURRENT_DATE WHERE eventid = ?', [id]);

    return res.json({
      success: true,
      notifiedCount: userIds.length,
      message: `Countdown reminder sent to ${userIds.length} assigned personnel.`
    });
  } catch (error) {
    console.error('Error sending event reminder:', error);
    return res.status(500).json({ success: false, message: 'Failed to send reminder' });
  }
};

// Get list of downloadable event folders (DB-driven — works with Supabase storage)
const getDownloadableFolders = async (req, res) => {
  try {
    // Return events that have at least one approved requirement file or office proof document
    const [rows] = await db.query(`
      SELECT DISTINCT e.eventid, e.eventname, e.eventcode
      FROM events e
      WHERE EXISTS (
        SELECT 1 FROM officeproofdocuments opd
        JOIN offices o ON o.officeid = opd.officeid
        WHERE o.eventid = e.eventid 
          AND opd.filepath IS NOT NULL 
          AND opd.filepath != ''
          AND (
            opd.requirementid IS NULL 
            OR LOWER(COALESCE(opd.reviewstatus, '')) = 'approved'
          )
      )
      ORDER BY e.eventname ASC
    `);

    const folders = [];
    rows.forEach(r => {
      if (r.eventid) folders.push(String(r.eventid));
      if (r.eventcode) {
        folders.push(r.eventcode);
        folders.push(sanitizeFolderName(r.eventcode));
      }
      if (r.eventname) {
        folders.push(r.eventname);
        folders.push(sanitizeFolderName(r.eventname));
      }
    });

    res.json({ success: true, folders, eventIds: rows.map(r => r.eventid) });
  } catch (error) {
    console.error('Error fetching downloadable folders:', error);
    res.status(500).json({ success: false, message: 'Error fetching downloadable folders' });
  }
};

// Download event folder as zip — streams files from DB records (Supabase URLs or local disk)
const downloadEventZip = async (req, res) => {
  try {
    const { eventname } = req.params;
    if (!eventname) {
      return res.status(400).json({ success: false, message: 'Event name is required' });
    }

    const sanitizedName = sanitizeFolderName(eventname);

    // Look up the event from DB by ID, eventcode, eventname, or sanitized name
    let event = null;
    if (!isNaN(Number(eventname)) && Number(eventname) > 0) {
      const [byId] = await db.query('SELECT eventid, eventname, eventcode FROM events WHERE eventid = ? LIMIT 1', [Number(eventname)]);
      if (byId && byId.length > 0) event = byId[0];
    }
    if (!event) {
      const [eventRows] = await db.query(
        `SELECT eventid, eventname, eventcode FROM events WHERE eventcode = ? OR eventname = ? LIMIT 1`,
        [eventname, eventname]
      );
      if (eventRows && eventRows.length > 0) event = eventRows[0];
    }
    if (!event) {
      const [allEvents] = await db.query('SELECT eventid, eventname, eventcode FROM events');
      event = allEvents.find(e => 
        sanitizeFolderName(e.eventcode || e.eventname) === sanitizedName ||
        sanitizeFolderName(e.eventname) === sanitizedName ||
        sanitizeFolderName(e.eventcode) === sanitizedName ||
        String(e.eventid) === String(eventname)
      );
    }

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Fetch all APPROVED uploaded evidence files and office proof documents for this event
    const [files] = await db.query(`
      SELECT
        opd.id,
        opd.filename,
        opd.displayname,
        opd.filepath,
        opd.requirementid,
        o.officename,
        r.requirementcode,
        r.Description AS RequirementDescription
      FROM officeproofdocuments opd
      JOIN offices o ON o.officeid = opd.officeid
      LEFT JOIN requirements r ON r.requirementid = opd.requirementid
      WHERE o.eventid = ?
        AND opd.filepath IS NOT NULL
        AND opd.filepath != ''
        AND (
          opd.requirementid IS NULL 
          OR LOWER(COALESCE(opd.reviewstatus, '')) = 'approved'
        )
      ORDER BY o.officename, opd.requirementid, opd.uploadedat
    `, [event.eventid]);

    if (!files.length) {
      return res.status(404).json({ success: false, message: 'No approved evidence files found for this event' });
    }

    const zipDisplayName = sanitizeFolderName(event.eventcode || event.eventname || sanitizedName);
    const zipFileName = `${zipDisplayName}.zip`;
    res.attachment(zipFileName);
    res.contentType('application/zip');

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error creating zip file' });
      }
    });

    archive.pipe(res);

    const axios = require('axios');

    // Safe folder/file name helper
    const safeName = (s) => String(s || 'Unknown').replace(/[/\\:*?"<>|]/g, '_').trim();

    // Accreditation folder = sanitized event code/name
    const accreditationFolder = safeName(zipDisplayName);

    for (const file of files) {
      // Office folder
      const officeFolder = safeName(file.officename || 'Office');
      // Evidence file name — prefer displayname, fallback to filename
      let rawFileName = file.displayname || file.filename || 'evidence';
      const ext = path.extname(file.filename || file.filepath || '') || '';
      if (ext && !rawFileName.toLowerCase().endsWith(ext.toLowerCase())) {
        rawFileName = `${rawFileName}${ext}`;
      }
      const evidenceFileName = safeName(rawFileName);
      // Zip path: accreditation / office / evidence_file
      const zipPath = `${accreditationFolder}/${officeFolder}/${evidenceFileName}`;

      const filepath = file.filepath;

      try {
        if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
          // Stored URLs may point at an old/public Supabase host (e.g. localhost:8000) that is
          // unreachable from inside the backend container. Rewrite storage URLs to the
          // internal Supabase URL so the file can actually be fetched.
          let fetchUrl = filepath;
          const storageMarker = '/storage/v1/object/public/';
          const markerIdx = filepath.indexOf(storageMarker);
          const internalBase = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
          if (markerIdx !== -1 && internalBase && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(filepath)) {
            fetchUrl = `${internalBase}${filepath.slice(markerIdx)}`;
          }
          // Fetch remote file buffer (handles 301/302 redirects automatically)
          const resp = await axios.get(fetchUrl, { 
            responseType: 'arraybuffer', 
            timeout: 30000 
          });
          archive.append(Buffer.from(resp.data), { name: zipPath });
        } else {
          // Local file path
          const absPath = path.join(__dirname, '..', filepath.replace(/^\//, ''));
          if (fs.existsSync(absPath)) {
            archive.file(absPath, { name: zipPath });
          } else {
            console.warn('Local file not found, skipping:', absPath);
          }
        }
      } catch (fileErr) {
        console.warn(`Skipping file ${file.filename}:`, fileErr.message || fileErr.code || String(fileErr));
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error downloading event zip:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error downloading event folder' });
    }
  }
};

// Get accreditation levels
const getAccreditationLevels = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM accreditationlevels ORDER BY id ASC');
    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Error fetching accreditation levels:', error);
    res.json({
      success: true,
      data: [
        { id: 1, levelname: 'Level I' },
        { id: 2, levelname: 'Level II' },
        { id: 3, levelname: 'Level III' },
        { id: 4, levelname: 'Level IV' },
        { id: 5, levelname: 'N/A' }
      ]
    });
  }
};

module.exports = {
  getAllEvents,
  addEvent,
  deleteEvents,
  updateEvent,
  toggleEventLock,
  updateEventDeadline,
  sendEventReminder,
  getDownloadableFolders,
  downloadEventZip,
  copyEvent,
  getAccreditationLevels
};
