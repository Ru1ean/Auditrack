const db = require('../db');

// Fetch all compliance status offices
exports.getAllComplianceStatusOffices = async (req, res) => {
	try {
		const roleid = Number(req.user?.roleid || 0);
		const userid = Number(req.user?.userid || 0);

		const [results] = await db.query(`
			SELECT
				csofficeid,
				officeid,
				requirementid,
				status AS "Status",
				comments,
				documentproof,
				checkedby,
				lastupdated
			FROM compliancestatusoffices
		`);
		res.json(results);
	} catch (err) {
		console.error('Error fetching compliance status offices:', err);
		res.status(500).json({ error: 'Database error' });
	}
};
