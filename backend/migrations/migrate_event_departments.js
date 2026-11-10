const db = require('../db');

async function runMigration() {
  console.log('Starting migration for eventdepartments...');

  // 1. Create eventdepartments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS eventdepartments (
      id SERIAL PRIMARY KEY,
      eventid INTEGER NOT NULL REFERENCES events("eventid") ON DELETE CASCADE,
      departmentid INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
      accreditationlevel VARCHAR(50) NOT NULL DEFAULT 'Level I',
      createdat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_event_department UNIQUE (eventid, departmentid)
    );
  `);
  console.log('Created/verified eventdepartments table');

  // 2. Add eventdepartmentid column to offices table if not exists
  await db.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'offices' AND column_name = 'eventdepartmentid'
      ) THEN 
        ALTER TABLE offices ADD COLUMN eventdepartmentid INTEGER REFERENCES eventdepartments(id) ON DELETE SET NULL;
      END IF; 
    END $$;
  `);
  console.log('Created/verified eventdepartmentid column on offices');

  // 3. Backfill existing academic offices into eventdepartments
  const [academicOffices] = await db.query(`
    SELECT o."officeid", o."eventid", m.departmentid
    FROM offices o
    JOIN masterlist m ON o.masterlistid = m.id
    WHERE m.entitytypeid = 1 
      AND m.departmentid IS NOT NULL 
      AND o."eventid" IS NOT NULL
      AND o."eventid" IN (SELECT "eventid" FROM events)
      AND o.eventdepartmentid IS NULL;
  `);

  console.log(`Found ${academicOffices.length} academic office records to link to eventdepartments.`);

  for (const row of academicOffices) {
    const { officeid, eventid, departmentid } = row;
    if (!eventid || !departmentid) continue;

    // Check if event_department entry exists
    const [existing] = await db.query(
      `SELECT id FROM eventdepartments WHERE eventid = ? AND departmentid = ? LIMIT 1`,
      [eventid, departmentid]
    );

    let eventDeptId = existing[0]?.id;

    if (!eventDeptId) {
      const [inserted] = await db.query(
        `INSERT INTO eventdepartments (eventid, departmentid, accreditationlevel)
         VALUES (?, ?, 'Level I')
         ON CONFLICT (eventid, departmentid) DO UPDATE SET updatedat = CURRENT_TIMESTAMP
         RETURNING id`,
        [eventid, departmentid]
      );
      eventDeptId = inserted[0]?.id || inserted.insertId;
    }

    if (eventDeptId) {
      await db.query(
        `UPDATE offices SET eventdepartmentid = ? WHERE "officeid" = ?`,
        [eventDeptId, officeid]
      );
    }
  }

  console.log('Successfully backfilled academic offices into eventdepartments!');

  // Verify created records
  const [createdEventDepts] = await db.query(`
    SELECT ed.id, ed.eventid, ed.departmentid, ed.accreditationlevel, d.name AS dept_name, e."eventname"
    FROM eventdepartments ed
    JOIN departments d ON ed.departmentid = d.id
    JOIN events e ON ed.eventid = e."eventid";
  `);
  console.log('Current eventdepartments records:', createdEventDepts);

  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
