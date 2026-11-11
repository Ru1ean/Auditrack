import React from "react";

export const actionStyles = {
    Created: {
        badge: "bg-emerald-100/90 text-emerald-800 border-emerald-300/80",
        iconBg: "bg-emerald-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
        )
    },
    Updated: {
        badge: "bg-indigo-100/90 text-indigo-800 border-indigo-300/80",
        iconBg: "bg-indigo-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
        )
    },
    Deleted: {
        badge: "bg-rose-100/90 text-rose-800 border-rose-300/80",
        iconBg: "bg-rose-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
        )
    },
    Viewed: {
        badge: "bg-sky-100/90 text-sky-800 border-sky-300/80",
        iconBg: "bg-sky-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )
    },
    Login: {
        badge: "bg-blue-100/90 text-blue-800 border-blue-300/80",
        iconBg: "bg-blue-600 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
            </svg>
        )
    },
    Logout: {
        badge: "bg-amber-100/90 text-amber-800 border-amber-300/80",
        iconBg: "bg-amber-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
        )
    },
    default: {
        badge: "bg-slate-100 text-slate-800 border-slate-300",
        iconBg: "bg-slate-500 text-white",
        icon: (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )
    }
};

export const verbToCrud = {
    POST: "Created",
    PUT: "Updated",
    PATCH: "Updated",
    DELETE: "Deleted",
    GET: "Viewed",
};

export const toArrayPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.events)) return payload.events;
    if (Array.isArray(payload?.areas)) return payload.areas;
    if (Array.isArray(payload?.criteria)) return payload.criteria;
    if (Array.isArray(payload?.requirements)) return payload.requirements;
    if (Array.isArray(payload?.offices)) return payload.offices;
    if (Array.isArray(payload?.logs)) return payload.logs;
    return [];
};

export const toTitle = (value) => {
    return String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[._-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());
};

export const tryParseJson = (value) => {
    if (!value || typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        return null;
    }
};

export const roleIdToName = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) return "";
    if (normalized === "1" || normalized === "admin") return "Admin";
    if (normalized === "2" || normalized === "user") return "User";
    return toTitle(normalized);
};

export const stripEmojis = (str) => {
    return String(str || '')
        .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]|[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{200D}])/gu, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

export const normalizeActionLabel = (rawAction) => {
    const normalized = String(rawAction || "").trim();
    const action = normalized;
    const httpMatch = action.match(/^(GET|POST|PUT|PATCH|DELETE)\s+/i);
    if (httpMatch) return verbToCrud[httpMatch[1].toUpperCase()] || "Updated";

    if (/login/i.test(action)) return "Login";
    if (/logout/i.test(action)) return "Logout";
    if (/AuditorAssignedAreas/i.test(action)) return "Updated";
    if (/OfficeHeadUpdated/i.test(action)) return "Updated";
    if (/OfficeHeadAdded/i.test(action)) return "Created";
    if (/OfficeHeadDeleted/i.test(action)) return "Deleted";
    if (/PersonnelAssigned|ASSIGN_PERSONNEL/i.test(action)) return "Created";
    if (/PersonnelScopeUpdated/i.test(action)) return "Updated";
    if (/PersonnelUnassigned/i.test(action)) return "Deleted";
    if (/ComplianceStatusUpdated/i.test(action)) return "Updated";
    if (/OfficeProofUploaded/i.test(action)) return "Created";
    if (/OfficeProofDeleted/i.test(action)) return "Deleted";
    if (/OfficeRequirementRemoved/i.test(action)) return "Deleted";
    if (/CriteriaDeleted|Criteria deleted/i.test(action)) return "Deleted";
    if (/RequirementDeleted/i.test(action)) return "Deleted";
    if (/EventDeleted/i.test(action)) return "Deleted";
    if (/OfficeDeleted/i.test(action)) return "Deleted";
    if (/AreaDeleted/i.test(action)) return "Deleted";
    if (/RequirementUpdated|OfficeUpdated|EventUpdated|AccreditationLevelUpdated/i.test(action)) return "Updated";
    if (/(added|created|registered|copied)$/i.test(action)) return "Created";
    if (/(updated|relocated|assigned)$/i.test(action)) return "Updated";
    if (/(deleted|canceled|cancelled|removed)$/i.test(action)) return "Deleted";

    return "Updated";
};

export const resolveLogContext = (log, lookups = {}) => {
    const {
        officeLookup = {},
        requirementLookup = {},
        criteriaLookup = {},
        areaLookup = {},
        eventLookup = {},
        userLookup = {},
    } = lookups;

    const detailsSource = log?.DetailsParsed || log?.detailsParsed || tryParseJson(log?.Details || log?.details) || (typeof log?.Details === 'object' ? log.Details : null) || (typeof log?.details === 'object' ? log.details : null) || null;
    const d = detailsSource && typeof detailsSource === "object"
        ? (detailsSource.body && typeof detailsSource.body === "object" ? detailsSource.body : detailsSource)
        : {};

    // 1. Office / Program
    const officeid = d.officeid || d.officeId || d.office_id;
    const officeObj = officeid ? officeLookup[String(officeid)] : null;
    const officename = d.officename || d.officeName || d.OfficeCode || officeObj?.officename || officeObj?.OfficeCode || "";

    // 2. Requirement
    const reqId = d.requirementid || d.requirementId || d.requirement_id;
    const reqObj = reqId ? requirementLookup[String(reqId)] : null;
    const reqCode = d.requirementcode || d.requirementCode || reqObj?.requirementcode || (reqId ? `REQ-${reqId}` : "");
    const reqDesc = d.RequirementDescription || d.Description || d.description || reqObj?.Description || "";

    // 3. Criteria
    const critId = d.criteriaid || d.criteriaId || d.criteria_id || reqObj?.criteriaid;
    const critObj = critId ? criteriaLookup[String(critId)] : null;
    const critCode = d.criteriacode || d.criteriaCode || critObj?.criteriacode || "";
    const critName = d.criterianame || d.criteriaName || critObj?.criterianame || "";
    const critLabel = critCode && critName ? `${critCode}. ${critName}` : (critCode || critName);

    // 4. Area
    const areaid = d.areaid || d.areaId || d.area_id || critObj?.areaid;
    const areaObj = areaid ? areaLookup[String(areaid)] : null;
    const areaname = d.areaname || d.areaName || areaObj?.areaname || "";

    // 5. Accreditation Event
    const eventid = d.eventid || d.eventId || d.event_id || areaObj?.eventid || officeObj?.eventid;
    const eventObj = eventid ? eventLookup[String(eventid)] : null;
    const eventname = d.eventname || d.eventName || eventObj?.eventname || (typeof eventObj === 'string' ? eventObj : "");

    // 6. Evidence File
    const filename = d.DisplayName || d.displayname || d.FileName || d.fileName || d.filename || "";

    // 7. Target User
    const targetUserId = d.userid || d.userId || d.targetUserId || d.TargetUserID;
    const targetUserName = d.userName || d.FullName || (targetUserId ? userLookup[String(targetUserId)] : "");

    return {
        officename,
        reqCode,
        reqDesc,
        critLabel,
        areaname,
        eventname,
        filename,
        targetUserName,
        reqIds: d.requirementIds || d.RequirementIDs,
        rawDetails: d
    };
};

export const buildInDepthMessage = (log, actionLabel, ctx) => {
    const rawAction = String(log?.Action || log?.action || "").trim();
    const d = ctx?.rawDetails || {};

    if (actionLabel === "Login") return "User logged in to Compliance Portal";
    if (actionLabel === "Logout") return "User logged out of Compliance Portal";

    // External Auditor Assignment
    if (/AuditorAssignedAreas/i.test(rawAction)) {
        const audName = d.AuditorName || (d.AuditorUserID ? `Auditor #${d.AuditorUserID}` : 'External Auditor');
        const count = d.AssignedAreaCount ?? (Array.isArray(d.Areas) ? d.Areas.length : 0);
        const areaNames = Array.isArray(d.Areas)
            ? d.Areas.map(a => a.areacode ? (a.areaname ? `${a.areacode} (${a.areaname})` : a.areacode) : a.areaname).filter(Boolean).join(', ')
            : '';
        if (count === 0) return `Updated assignments for ${audName} (cleared assigned areas)`;
        return `Assigned External Auditor ${audName} to ${count} area(s)${areaNames ? `: ${areaNames}` : ''}`;
    }

    // Master List Actions
    if (/MasterListItemAdded|MasterListAdded/i.test(rawAction)) {
        const itemName = d.name || d.masterlistname || d.ItemName || (d.id ? `Item #${d.id}` : 'Item');
        return `Added Master List item "${itemName}"`;
    }
    if (/MasterListItemUpdated|MasterListUpdated/i.test(rawAction)) {
        const itemName = d.name || d.masterlistname || d.ItemName || (d.id ? `Item #${d.id}` : 'Item');
        return `Updated Master List item "${itemName}"`;
    }
    if (/MasterListItemDeleted|MasterListDeleted/i.test(rawAction)) {
        const itemName = d.name || d.masterlistname || d.ItemName || (d.id ? `Item #${d.id}` : 'Item');
        return `Deleted Master List item "${itemName}"`;
    }

    // Office Personnel
    if (/OfficeHeadUpdated/i.test(rawAction)) {
        const headName = d.HeadName || 'Office Personnel';
        const changes = d.changes || {};
        if (changes.Position) {
            return `Updated position of "${headName}" from "${changes.Position.from}" to "${changes.Position.to}"`;
        }
        const changedFields = Object.keys(changes);
        if (changedFields.length > 0) {
            return `Updated Office Personnel "${headName}" (changed: ${changedFields.join(', ')})`;
        }
        return `Updated Office Personnel "${headName}"`;
    }
    if (/OfficeHeadAdded/i.test(rawAction)) {
        const headName = d.HeadName || (Array.isArray(d.HeadNames) ? d.HeadNames.join(', ') : 'Office Personnel');
        const pos = d.Position ? ` as ${d.Position}` : '';
        return `Added Office Personnel "${headName}"${pos}`;
    }
    if (/OfficeHeadDeleted/i.test(rawAction)) {
        const headName = d.HeadName || (Array.isArray(d.HeadNames) ? d.HeadNames.join(', ') : 'Office Personnel');
        return `Removed Office Personnel "${headName}"`;
    }

    // Personnel Accreditation Assignments
    if (/PersonnelAssigned|ASSIGN_PERSONNEL/i.test(rawAction)) {
        const users = Array.isArray(d.assignedUserNames) && d.assignedUserNames.length > 0
            ? d.assignedUserNames.join(', ')
            : (d.count ? `${d.count} personnel` : 'personnel');
        const target = d.targetLabel || (d.targetType ? `${d.targetType} #${d.requirementid || d.criteriaid || d.areaid}` : 'target');
        const ev = d.eventname || ctx.eventname || '';
        return `Assigned ${users} to ${target}${ev ? ` under "${ev}"` : ''}`;
    }
    if (/PersonnelScopeUpdated/i.test(rawAction)) {
        const user = d.targetUserName || (d.targetUserId ? `User #${d.targetUserId}` : 'Personnel');
        const ev = d.eventname || ctx.eventname || '';
        const counts = [];
        if (d.areaCount) counts.push(`${d.areaCount} area${d.areaCount === 1 ? '' : 's'}`);
        if (d.criteriaCount) counts.push(`${d.criteriaCount} sub-area${d.criteriaCount === 1 ? '' : 's'}`);
        if (d.requirementCount) counts.push(`${d.requirementCount} standard${d.requirementCount === 1 ? '' : 's'}`);
        const scopeSummary = counts.length > 0 ? ` (${counts.join(', ')})` : '';
        return `Updated accreditation scope for ${user}${scopeSummary}${ev ? ` under "${ev}"` : ''}`;
    }
    if (/PersonnelUnassigned/i.test(rawAction)) {
        const user = d.targetUserName || (d.targetUserId ? `User #${d.targetUserId}` : 'Personnel');
        const target = d.targetLabel || 'assignment';
        const ev = d.eventname || ctx.eventname || '';
        return `Unassigned ${user} from ${target}${ev ? ` in "${ev}"` : ''}`;
    }

    // Compliance Status Updates
    if (/ComplianceStatusUpdated/i.test(rawAction)) {
        const code = d.requirementcode || ctx.reqCode || 'Standard';
        const office = d.officename || ctx.officename || 'Office';
        const stName = d.statusName || (d.newStatus === 5 ? 'Complied' : (d.newStatus === 4 ? 'Partially Complied' : 'Not Complied'));
        const commentStr = d.comments ? ` (Comment: "${d.comments.slice(0, 60)}${d.comments.length > 60 ? '...' : ''}")` : '';
        return `Updated Compliance Status of ${code} in ${office} to "${stName}"${commentStr}`;
    }

    // Office Proof Documents
    if (/OfficeProofUploaded/i.test(rawAction)) {
        const fName = d.filename || d.FileName || ctx.filename || 'document';
        const office = d.officename || ctx.officename || 'Office';
        const ev = d.eventname || ctx.eventname || '';
        return `Uploaded office proof document "${fName}" for ${office}${ev ? ` under "${ev}"` : ''}`;
    }
    if (/OfficeProofDeleted/i.test(rawAction)) {
        const fName = d.filename || d.FileName || ctx.filename || 'document';
        const office = d.officename || ctx.officename || (d.officeid ? `Office #${d.officeid}` : 'Office');
        return `Deleted office proof document "${fName}" from ${office}`;
    }
    if (/OfficeRequirementRemoved/i.test(rawAction)) {
        const code = d.requirementcode || ctx.reqCode || 'Standard';
        const office = d.officename || ctx.officename || 'Office';
        return `Removed standard ${code} from ${office}`;
    }

    // File Upload
    if (/RequirementFileUploaded|Upload/i.test(rawAction)) {
        let msg = `Uploaded standard file ${ctx.filename ? `"${ctx.filename}"` : 'document'}`;
        if (ctx.reqCode) msg += ` for Standard ${ctx.reqCode}`;
        if (ctx.officename) msg += ` in ${ctx.officename}`;
        if (ctx.eventname) msg += ` under "${ctx.eventname}"`;
        return msg;
    }

    // File Delete
    if (/RequirementFileDeleted|Unsubmit/i.test(rawAction)) {
        let msg = `Removed standard file ${ctx.filename ? `"${ctx.filename}"` : 'document'}`;
        if (ctx.reqCode) msg += ` from Standard ${ctx.reqCode}`;
        if (ctx.officename) msg += ` in ${ctx.officename}`;
        return msg;
    }

    // Requirement Added
    if (/RequirementAdded/i.test(rawAction) && actionLabel === "Created") {
        let msg = `Created Standard ${ctx.reqCode ? ctx.reqCode : ''}`;
        if (ctx.reqDesc) msg += ` ("${ctx.reqDesc}")`;
        if (ctx.critLabel) msg += ` under Sub Area ${ctx.critLabel}`;
        if (ctx.areaname) msg += ` in ${ctx.areaname}`;
        if (ctx.eventname) msg += ` — "${ctx.eventname}"`;
        return msg;
    }

    // Requirement Updated
    if (/RequirementUpdated/i.test(rawAction)) {
        const changes = d.changes || {};
        const code = d.requirementcode || ctx.reqCode || '';
        if (changes.requirementcode) {
            return `Updated Standard: code changed from "${changes.requirementcode.from}" to "${changes.requirementcode.to}"`;
        }
        if (changes.Description) {
            const prev = String(changes.Description.from || '').slice(0, 60);
            const next = String(changes.Description.to || '').slice(0, 60);
            return `Updated Standard ${code}: description changed from "${prev}" to "${next}"`;
        }
        const changedFields = Object.keys(changes);
        if (changedFields.length > 0) {
            return `Updated Standard ${code} (changed: ${changedFields.join(', ')})`;
        }
        return `Updated Standard ${code}${ctx.critLabel ? ` under Sub Area ${ctx.critLabel}` : ''}`;
    }

    // Requirement Deleted
    if (/RequirementDeleted/i.test(rawAction)) {
        const deleted = Array.isArray(d.deletedRequirements) ? d.deletedRequirements : [];
        if (deleted.length === 1) {
            const r = deleted[0];
            return `Deleted Standard ${r.requirementcode || ''}${r.Description ? ` ("${r.Description}")` : ''}${r.eventname ? ` from "${r.eventname}"` : ''}`;
        }
        if (deleted.length > 1) {
            return `Deleted ${deleted.length} Standards: ${deleted.map(r => r.requirementcode || 'Unknown').join(', ')}`;
        }
        return `Deleted ${(d.deletedCount || d.requirementIds?.length || 0)} Standard(s)`;
    }

    // Criteria Added
    if (/CriteriaAdded|Criteria/i.test(rawAction) && actionLabel === "Created") {
        let msg = `Created Sub Area ${ctx.critLabel ? `"${ctx.critLabel}"` : ''}`;
        if (ctx.areaname) msg += ` under ${ctx.areaname}`;
        if (ctx.eventname) msg += ` — "${ctx.eventname}"`;
        return msg;
    }

    // Criteria Deleted
    if (/CriteriaDeleted|Criteria deleted/i.test(rawAction)) {
        const deleted = Array.isArray(d.deletedCriteria) ? d.deletedCriteria : [];
        if (deleted.length === 1) {
            const c = deleted[0];
            const label = c.criteriacode && c.criterianame ? `${c.criteriacode}. ${c.criterianame}` : (c.criteriacode || c.criterianame || 'Unknown');
            return `Deleted Sub Area "${label}"${c.eventname ? ` from "${c.eventname}"` : ''}`;
        }
        if (deleted.length > 1) {
            return `Deleted ${deleted.length} Sub Areas: ${deleted.map(c => c.criteriacode || 'Unknown').join(', ')}`;
        }
        return `Deleted ${(d.deletedCount || d.criteriaIds?.length || 0)} Sub Area(s)`;
    }

    // Area Added
    if (/AreaAdded|Area/i.test(rawAction) && actionLabel === "Created") {
        let msg = `Created Area ${ctx.areaname ? `"${ctx.areaname}"` : ''}`;
        if (ctx.eventname) msg += ` under "${ctx.eventname}"`;
        return msg;
    }

    // Area Deleted
    if (/AreaDeleted/i.test(rawAction)) {
        const areaIds = d.areaIds || [];
        return `Deleted ${areaIds.length || 1} Area(s)${ctx.areaname ? `: "${ctx.areaname}"` : ''}`;
    }

    // Office / Program Created or Updated
    if (/OfficeAdded/i.test(rawAction)) {
        let msg = `Created Office/Program ${ctx.officename ? `"${ctx.officename}"` : ''}`;
        if (ctx.eventname) msg += ` under "${ctx.eventname}"`;
        if (Array.isArray(ctx.reqIds)) msg += ` (${ctx.reqIds.length} requirement${ctx.reqIds.length === 1 ? '' : 's'} assigned)`;
        return msg;
    }
    if (/OfficeUpdated/i.test(rawAction)) {
        const changes = d.changes || {};
        const name = d.officename || ctx.officename || '';
        if (changes.officename) {
            return `Updated Office: name changed from "${changes.officename.from}" to "${changes.officename.to}"`;
        }
        const changedFields = Object.keys(changes);
        const headChanges = d.headChanges || {};
        const headAdded = Array.isArray(headChanges.added) && headChanges.added.length > 0 ? ` Added personnel: ${headChanges.added.join(', ')}.` : '';
        const headRemoved = Array.isArray(headChanges.removed) && headChanges.removed.length > 0 ? ` Removed personnel: ${headChanges.removed.join(', ')}.` : '';
        if (changedFields.length > 0 || headAdded || headRemoved) {
            return `Updated Office "${name}" (changed: ${changedFields.join(', ') || 'personnel'}).${headAdded}${headRemoved}`;
        }
        return `Updated Office/Program ${name ? `"${name}"` : ''}${ctx.eventname ? ` under "${ctx.eventname}"` : ''}`;
    }
    if (/OfficeDeleted/i.test(rawAction)) {
        const name = d.officename || ctx.officename || '';
        return `Deleted Office/Program${name ? ` "${name}"` : ''}${d.eventname || ctx.eventname ? ` from "${d.eventname || ctx.eventname}"` : ''}`;
    }
    if (/Office/i.test(rawAction)) {
        let msg = `${actionLabel} Office/Program ${ctx.officename ? `"${ctx.officename}"` : ''}`;
        if (ctx.eventname) msg += ` under "${ctx.eventname}"`;
        if (Array.isArray(ctx.reqIds)) msg += ` (${ctx.reqIds.length} requirement${ctx.reqIds.length === 1 ? '' : 's'} assigned)`;
        return msg;
    }

    // Accreditation Event
    if (/EventAdded/i.test(rawAction)) {
        return `Created Accreditation Event ${ctx.eventname ? `"${ctx.eventname}"` : ''}${d.eventcode ? ` (${d.eventcode})` : ''}`;
    }
    if (/EventUpdated/i.test(rawAction)) {
        const changes = d.changes || {};
        if (changes.eventname) {
            return `Updated Accreditation Event: name changed from "${changes.eventname.from}" to "${changes.eventname.to}"`;
        }
        if (changes.eventcode) {
            return `Updated Accreditation Event "${d.eventname}": code changed from "${changes.eventcode.from}" to "${changes.eventcode.to}"`;
        }
        return `Updated Accreditation Event ${ctx.eventname ? `"${ctx.eventname}"` : ''}`;
    }
    if (/EventDeleted/i.test(rawAction)) {
        const names = Array.isArray(d.deletedNames) ? d.deletedNames.filter(Boolean) : [];
        if (names.length === 1) return `Deleted Accreditation Event "${names[0]}"`;
        if (names.length > 1) return `Deleted ${names.length} Accreditation Events: ${names.join(', ')}`;
        return `Deleted Accreditation Event ${ctx.eventname ? `"${ctx.eventname}"` : ''}`;
    }
    if (/EventCopied/i.test(rawAction)) {
        return `Copied Accreditation Event ${ctx.eventname ? `"${ctx.eventname}"` : ''}`;
    }

    // User Updates
    if (/UserRoleUpdated/i.test(rawAction)) {
        return `Updated role for user ${ctx.targetUserName ? `"${ctx.targetUserName}"` : ''}`;
    }
    if (/UserApprovalUpdated/i.test(rawAction)) {
        return `Updated approval status for user ${ctx.targetUserName ? `"${ctx.targetUserName}"` : ''}`;
    }
    if (/UserUpdated|User/i.test(rawAction)) {
        return `Updated User ${ctx.targetUserName ? `"${ctx.targetUserName}"` : ''}`;
    }

    // Fallback
    const existingMessage = String(log?.Message || log?.message || "").trim();
    if (existingMessage && 
        !/^(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(existingMessage) && 
        !/\/api\//i.test(existingMessage) &&
        !/^(action performed|activity recorded)$/i.test(existingMessage)
    ) {
        return existingMessage;
    }

    let fallback = `${actionLabel} Record`;
    if (ctx.officename) fallback += ` for ${ctx.officename}`;
    if (ctx.reqCode) fallback += ` (${ctx.reqCode})`;
    if (ctx.eventname) fallback += ` under "${ctx.eventname}"`;
    return fallback;
};

export const formatTimestamp = (timestamp) => {
    if (!timestamp) return { time: "", date: "" };
    const d = new Date(timestamp);
    const time = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const date = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    return { time, date };
};
