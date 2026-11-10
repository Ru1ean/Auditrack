const META_TAG = '[[meta:';
const META_END = ']]';

export function parseMetaFromMessage(message) {
	const raw = String(message || '');
	const start = raw.lastIndexOf(META_TAG);
	if (start === -1) return { text: raw.trim(), meta: null };

	const end = raw.indexOf(META_END, start);
	if (end === -1) return { text: raw.trim(), meta: null };

	try {
		const meta = JSON.parse(raw.slice(start + META_TAG.length, end));
		return { text: raw.slice(0, start).trim(), meta };
	} catch {
		return { text: raw.trim(), meta: null };
	}
}

export function getDisplayMessage(notification) {
	const msg = notification?.Message ?? notification?.message ?? notification?.Title ?? notification?.title ?? notification?.text ?? '';
	return parseMetaFromMessage(msg).text;
}

export function getNotificationMeta(notification) {
	const msg = notification?.Message ?? notification?.message ?? notification?.Title ?? notification?.title ?? notification?.text ?? '';
	const { meta } = parseMetaFromMessage(msg);
	const table = String(notification?.relatedtable || '').toLowerCase();
	const relatedid = notification?.relatedid != null ? Number(notification.relatedid) : null;

	const officeid =
		meta?.officeid ??
		(['office_personnel', 'requirements_assignment', 'requirement_file_upload', 'offices'].includes(table)
			? relatedid
			: null);

	return {
		...meta,
		officeid: officeid != null && !Number.isNaN(officeid) ? Number(officeid) : null,
		requirementid: meta?.requirementid != null ? Number(meta.requirementid) : null,
		viewUserId: meta?.viewUserId != null ? Number(meta.viewUserId) : null,
		openSubmission: Boolean(meta?.openSubmission) || table === 'requirement_file_upload',
	};
}

export function buildNotificationRedirect(notification) {
	const table = String(notification?.relatedtable || '').toLowerCase();
	const meta = getNotificationMeta(notification);

	if (table === 'users_role') return { path: '/home/profile' };

	const params = new URLSearchParams({
		fromNotif: '1',
		tab: 'categories',
	});

	if (meta.officeid) {
		params.set('officeid', String(meta.officeid));
	} else if (table === 'office_head' || table === 'office_personnel' || table === 'offices') {
		if (notification?.relatedid) params.set('officeid', String(notification.relatedid));
	}

	if (meta.requirementid) params.set('requirementid', String(meta.requirementid));
	if (meta.openSubmission) params.set('openSubmission', '1');
	if (meta.viewUserId) params.set('viewUserId', String(meta.viewUserId));

	// Auditor area assignment notifications
	if (table === 'auditor_assignments' || table === 'auditorareaassignments') {
		const areaid = meta.areaIds?.[0] || meta.areaid;
		if (areaid) params.set('areaid', String(areaid));
		if (meta.officeid) params.set('officeid', String(meta.officeid));
		if (meta.eventid) params.set('eventid', String(meta.eventid));
	}

	// Personnel accreditation assignment notifications
	if (table === 'personnelassignments' || table === 'personnel_assignment') {
		if (meta.eventid) {
			return { path: `/home/allc?eventid=${meta.eventid}` };
		}
		return { path: '/home/allc' };
	}

	return { path: `/home/acc-management?${params.toString()}` };
}
