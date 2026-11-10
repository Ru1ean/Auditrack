import { useEffect, useState } from "react";
import { API_BASE_URL } from "../../utils/apiBase";
export default function AuditLogs() {

    const [logs, setLogs] = useState([]);
    const [loading, setloading] = useState(true);
    const [criteriaLookup, setCriteriaLookup] = useState({});
    const [eventLookup, setEventLookup] = useState({});
    const [userLookup, setUserLookup] = useState({});


    const statusColorMap = {
        Created: "bg-green-100 text-green-700 border-green-300",
        Updated: "bg-blue-100 text-blue-700 border-blue-300",
        Deleted: "bg-red-100 text-red-700 border-red-300",
        Viewed: "bg-amber-100 text-amber-700 border-amber-300",
        Login: "bg-purple-100 text-purple-700 border-purple-300",
        Logout: "bg-red-100 text-red-700 border-red-300",
        default: "bg-gray-100 text-gray-700 border-gray-300",
    };

    const verbToCrud = {
        POST: "Created",
        PUT: "Updated",
        PATCH: "Updated",
        DELETE: "Deleted",
        GET: "Viewed",
    };

    const entityAliases = {
        events: "Event",
        areas: "Area",
        criteria: "Sub Area",
        requirements: "Standard",
        offices: "Office",
        officeheads: "Office Personnel",
        users: "User",
        user: "User",
        notif: "Notification",
        notifications: "Notification",
        logs: "Audit Log",
        officedocuments: "Office Document",
        compliancestatusoffices: "Compliance Status",
        personnelassignments: "Personnel Assignment",
    };

    const toTitle = (value) => {
        return String(value || "")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/[._-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const singularize = (word) => {
        if (!word) return "";
        if (word.toLowerCase() === "criteria") return "criteria";
        if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
        if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
        return word;
    };

    const getEntityFromPath = (path) => {
        const cleaned = String(path || "").split("?")[0].replace(/^\/+|\/+$/g, "");
        const noApi = cleaned.replace(/^api\//i, "");
        const segments = noApi
            .split("/")
            .filter((seg) => seg && !/^\d+$/.test(seg) && !seg.startsWith(":"));

        const base = segments[0] || "record";
        if (entityAliases[base]) return entityAliases[base];
        return toTitle(singularize(base));
    };

    const tryParseJson = (value) => {
        if (!value || typeof value !== "string") return null;
        const trimmed = value.trim();
        if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return null;
        }
    };

    const summarizeDetails = (detailsValue) => {
        const parsed = typeof detailsValue === "object" ? detailsValue : tryParseJson(detailsValue);
        if (!parsed) return String(detailsValue || "").trim();

        const body = parsed.body || parsed;
        if (!body || typeof body !== "object") return "";

        const keys = ["eventname", "areaname", "criterianame", "requirementcode", "officename", "deletedCount"];
        for (const key of keys) {
            if (body[key] !== undefined && body[key] !== null && String(body[key]).trim()) {
                return String(body[key]).trim();
            }
        }

        const preview = Object.entries(body)
            .slice(0, 3)
            .map(([k, v]) => `${toTitle(k)}: ${typeof v === "object" ? "..." : String(v)}`)
            .join(" | ");
        return preview;
    };

    const toArrayPayload = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.events)) return payload.events;
        if (Array.isArray(payload?.logs)) return payload.logs;
        return [];
    };

    const formatCriteriaCodeName = (code, name) => {
        const c = String(code || "").trim().replace(/\.$/, "");
        const n = String(name || "").trim();
        if (c && n) return `${c}. ${n}`;
        return c || n || "";
    };

    const getCriteriaLabel = (details) => {
        if (!details || typeof details !== "object") return "";

        let code = details.criteriacode;
        let name = details.criterianame;

        if ((!code || !name) && details.criteriaid !== undefined && details.criteriaid !== null) {
            const fallback = criteriaLookup[String(details.criteriaid)];
            if (fallback) {
                code = code || fallback.criteriacode;
                name = name || fallback.criterianame;
            }
        }

        return formatCriteriaCodeName(code, name);
    };

    const getEventLabel = (details) => {
        if (!details || typeof details !== "object") return "";
        if (details.eventname) return String(details.eventname).trim();
        if (details.eventid !== undefined && details.eventid !== null) {
            return eventLookup[String(details.eventid)] || "";
        }
        return "";
    };

    const roleIdToName = (value) => {
        const normalized = String(value ?? "").trim().toLowerCase();
        if (!normalized) return "";
        if (normalized === "1" || normalized === "admin") return "Admin";
        if (normalized === "2" || normalized === "user") return "User";
        return toTitle(normalized);
    };

    const extractLegacyUserId = (text) => {
        const match = String(text || "").match(/user\s*#?\s*(\d+)/i);
        return match ? match[1] : "";
    };

    const getUserLabel = (details, fallbackText = "") => {
        const explicitName = String(details?.userName || details?.FullName || "").trim();
        if (explicitName) return explicitName;

        const idFromDetails = details?.userid ?? details?.userid ?? details?.targetUserId ?? details?.TargetUserID;
        const resolvedId = idFromDetails !== undefined && idFromDetails !== null
            ? String(idFromDetails)
            : extractLegacyUserId(fallbackText);

        if (resolvedId && userLookup[resolvedId]) return userLookup[resolvedId];
        return "User";
    };

    const buildUserFieldSummary = (details) => {
        if (!details || typeof details !== "object") return "";

        const changes = details.changes && typeof details.changes === "object" ? details.changes : null;
        if (changes) {
            const parts = Object.entries(changes)
                .map(([field, change]) => {
                    if (!change || typeof change !== "object") return "";
                    const fromRaw = change.from;
                    const toRaw = change.to;
                    const isRoleField = /role/i.test(field);
                    const fromVal = isRoleField ? roleIdToName(fromRaw) : String(fromRaw ?? "(empty)");
                    const toVal = isRoleField ? roleIdToName(toRaw) : String(toRaw ?? "(empty)");
                    const label = toTitle(field.replace(/_/g, " "));
                    return `Changed ${label}: ${fromVal || "(empty)"} -> ${toVal || "(empty)"}`;
                })
                .filter(Boolean);
            return parts.join(" | ");
        }

        const roleValue = details.rolename || details.rolename || details.roleid || details.roleid;
        if (roleValue !== undefined && roleValue !== null && String(roleValue).trim()) {
            return `Role to ${roleIdToName(roleValue)}`;
        }

        const approvalValue = details.approvalstatus || details.approvalstatus;
        if (approvalValue) return `Approval to ${toTitle(approvalValue)}`;

        return "";
    };

    const normalizeActionLabel = (rawAction) => {
        const action = String(rawAction || "").trim();
        const httpMatch = action.match(/^(GET|POST|PUT|PATCH|DELETE)\s+/i);
        if (httpMatch) return verbToCrud[httpMatch[1].toUpperCase()] || "Updated";

        if (/login/i.test(action)) return "Login";
        if (/logout/i.test(action)) return "Logout";
        if (/PersonnelAssigned|ASSIGN_PERSONNEL/i.test(action)) return "Created";
        if (/PersonnelScopeUpdated/i.test(action)) return "Updated";
        if (/PersonnelUnassigned/i.test(action)) return "Deleted";
        if (/ComplianceStatusUpdated/i.test(action)) return "Updated";
        if (/OfficeProofUploaded/i.test(action)) return "Created";
        if (/OfficeProofDeleted/i.test(action)) return "Deleted";
        if (/OfficeRequirementRemoved/i.test(action)) return "Deleted";
        if (/(added|created|registered|copied)$/i.test(action)) return "Created";
        if (/(updated|relocated)$/i.test(action)) return "Updated";
        if (/(deleted|canceled|cancelled|removed)$/i.test(action)) return "Deleted";

        return "Updated";
    };

    const buildReadableMessage = (log, actionLabel) => {
        const rawAction = String(log.Action || "").trim();
        const httpMatch = rawAction.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*)/i);
        const detailsSource = log.DetailsParsed || tryParseJson(log.Details) || null;
        const details = detailsSource && typeof detailsSource === "object"
            ? (detailsSource.body && typeof detailsSource.body === "object" ? detailsSource.body : detailsSource)
            : null;
        const detailsText = String(log.Details || "").trim();

        if (actionLabel === "Login") return "User logged in";
        if (actionLabel === "Logout") return "User logged out";

        const d = details || {};
        if (/PersonnelAssigned|ASSIGN_PERSONNEL/i.test(rawAction)) {
            const users = Array.isArray(d.assignedUserNames) && d.assignedUserNames.length > 0
                ? d.assignedUserNames.join(', ')
                : (d.count ? `${d.count} personnel` : 'personnel');
            const target = d.targetLabel || (d.targetType ? `${d.targetType} #${d.requirementid || d.criteriaid || d.areaid}` : 'target');
            const ev = d.eventname ? ` under "${d.eventname}"` : '';
            return `Assigned ${users} to ${target}${ev}`;
        }

        if (/PersonnelScopeUpdated/i.test(rawAction)) {
            const user = d.targetUserName || (d.targetUserId ? `User #${d.targetUserId}` : 'Personnel');
            const ev = d.eventname ? ` under "${d.eventname}"` : '';
            return `Updated accreditation scope for ${user}${ev}`;
        }

        if (/PersonnelUnassigned/i.test(rawAction)) {
            const user = d.targetUserName || (d.targetUserId ? `User #${d.targetUserId}` : 'Personnel');
            const target = d.targetLabel || 'assignment';
            const ev = d.eventname ? ` in "${d.eventname}"` : '';
            return `Unassigned ${user} from ${target}${ev}`;
        }

        if (/ComplianceStatusUpdated/i.test(rawAction)) {
            const code = d.requirementcode || 'Standard';
            const office = d.officename || 'Office';
            const stName = d.statusName || (d.newStatus === 5 ? 'Complied' : (d.newStatus === 4 ? 'Partially Complied' : 'Not Complied'));
            const commentStr = d.comments ? ` (Comment: "${d.comments.slice(0, 60)}${d.comments.length > 60 ? '...' : ''}")` : '';
            return `Updated Compliance Status of ${code} in ${office} to "${stName}"${commentStr}`;
        }

        if (/OfficeProofUploaded/i.test(rawAction)) {
            const fName = d.filename || d.FileName || 'document';
            const office = d.officename || 'Office';
            const ev = d.eventname ? ` under "${d.eventname}"` : '';
            return `Uploaded office proof document "${fName}" for ${office}${ev}`;
        }

        if (/OfficeProofDeleted/i.test(rawAction)) {
            const fName = d.filename || d.FileName || 'document';
            const office = d.officename || 'Office';
            return `Deleted office proof document "${fName}" from ${office}`;
        }

        if (/OfficeRequirementRemoved/i.test(rawAction)) {
            const code = d.requirementcode || 'Standard';
            const office = d.officename || 'Office';
            return `Removed standard ${code} from ${office}`;
        }

        if (/^User(RoleUpdated|ApprovalUpdated|Updated)$/i.test(rawAction)) {
            const userLabel = getUserLabel(details, `${detailsText} ${log.Message || ""}`);
            const userSummary = buildUserFieldSummary(details);

            if (userSummary) return `Updated ${userLabel} - ${userSummary}`;

            const roleMatch = detailsText.match(/role\s*(?:set to|changed to)?\s*:?\s*([A-Za-z0-9_]+)/i);
            if (roleMatch && roleMatch[1]) {
                return `Updated ${userLabel} - Role to ${roleIdToName(roleMatch[1])}`;
            }

            const approvalMatch = detailsText.match(/approval(?:[_\s-]*status)?\s*(?:set to|updated to)?\s*:?\s*([A-Za-z]+)/i);
            if (approvalMatch && approvalMatch[1]) {
                return `Updated ${userLabel} - Approval to ${toTitle(approvalMatch[1])}`;
            }

            const existingMessage = String(log.Message || "").trim();
            if (existingMessage) {
                return existingMessage.replace(/User\s*#?\s*\d+/gi, userLabel);
            }

            return `Updated ${userLabel}`;
        }

        if (/^CriteriaAdded$/i.test(rawAction)) {
            const criteriaLabel = getCriteriaLabel(details) || "Sub Area";
            const eventLabel = getEventLabel(details);
            return `Created Sub Area ${criteriaLabel}${eventLabel ? ` under ${eventLabel}` : ""}`;
        }

        if (/^RequirementAdded$/i.test(rawAction)) {
            const requirementLabel = details?.requirementcode || details?.requirementid || "Standard";
            const eventLabel = getEventLabel(details);
            const criteriaLabel = getCriteriaLabel(details);
            const underLabel = [eventLabel, criteriaLabel].filter(Boolean).join(" / ");
            return `Created Standard ${requirementLabel}${underLabel ? ` under ${underLabel}` : ""}`;
        }

        if (httpMatch) {
            const entity = getEntityFromPath(httpMatch[2]);
            const detail = summarizeDetails(log.DetailsSummary || log.DetailsParsed || log.Details);
            return `${actionLabel} ${entity}${detail ? ` - ${detail}` : ""}`;
        }

        const existingMessage = String(log.Message || "").trim();
        if (existingMessage && !/^(GET|POST|PUT|PATCH|DELETE)\s+\//i.test(existingMessage) && !/\/api\//i.test(existingMessage)) {
            return existingMessage;
        }

        const entityRaw = rawAction
            .replace(/(Added|Created|Updated|Deleted|Removed|Copied|Canceled|Cancelled)$/i, "")
            .trim();
        const entity = toTitle(entityRaw || "Record");
        const detail = summarizeDetails(log.DetailsSummary || log.DetailsParsed || log.Details);
        return `${actionLabel} ${entity}${detail ? ` - ${detail}` : ""}`;
    };

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const token = localStorage.getItem("token");
                const res = await fetch(`${API_BASE_URL}/api/logs`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                const data = await res.json();
                const logsArr = data.logs || [];
                const sorted = [...logsArr].sort(
                    (a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)
                );
                setLogs(sorted);
            } catch (err) {
                console.error("Failed to load audit logs:", err);
            } finally {
                setloading(false);
            }
        };
        fetchLogs();
    }, []);

    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [criteriaRes, eventsRes, usersRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/criteria`),
                    fetch(`${API_BASE_URL}/api/events`),
                    fetch(`${API_BASE_URL}/api/user`)
                ]);

                if (criteriaRes.ok) {
                    const criteriaPayload = await criteriaRes.json();
                    const criteriaArr = toArrayPayload(criteriaPayload);
                    const nextCriteriaLookup = {};
                    for (const item of criteriaArr) {
                        if (item?.criteriaid !== undefined && item?.criteriaid !== null) {
                            nextCriteriaLookup[String(item.criteriaid)] = {
                                criteriacode: item.criteriacode || "",
                                criterianame: item.criterianame || ""
                            };
                        }
                    }
                    setCriteriaLookup(nextCriteriaLookup);
                }

                if (eventsRes.ok) {
                    const eventsPayload = await eventsRes.json();
                    const eventsArr = toArrayPayload(eventsPayload);
                    const nextEventLookup = {};
                    for (const event of eventsArr) {
                        if (event?.eventid !== undefined && event?.eventid !== null) {
                            nextEventLookup[String(event.eventid)] = String(event.eventname || "").trim();
                        }
                    }
                    setEventLookup(nextEventLookup);
                }

                if (usersRes.ok) {
                    const usersPayload = await usersRes.json();
                    const usersArr = toArrayPayload(usersPayload?.users ? { data: usersPayload.users } : usersPayload);
                    const nextUserLookup = {};
                    for (const user of usersArr) {
                        if (user?.userid !== undefined && user?.userid !== null) {
                            const fullName = String(
                                user.FullName ||
                                `${user.firstname || ""}${user.middleinitial ? ` ${user.middleinitial}.` : ""} ${user.lastname || ""}`
                            ).replace(/\s+/g, " ").trim();
                            nextUserLookup[String(user.userid)] = fullName || user.Email || "User";
                        }
                    }
                    setUserLookup(nextUserLookup);
                }
            } catch (err) {
                console.error("Failed to load criteria/event lookup:", err);
            }
        };

        fetchLookups();
    }, []);
    const formatTimestamp = (timestamp) => {
        if (!timestamp) return { time: "", date: "" };
        const d = new Date(timestamp);
        const time = d.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
        const date = d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
        return { time, date };
    };


    return (
        <div className="px-6 pb-6 pt-2 w-full">
            <Header pageTitle="Audit Logs" />

            <div className="mt-4 bg-white rounded-md shadow-md border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                    <h2 className="text-xl font-semibold" style={{ color: "#121212" }}>
                        Activity History
                    </h2>
                </div>

                {loading ? (
                    <div className="px-4 py-6 text-sm text-gray-500">Loading logs...</div>
                ) : logs.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-gray-500">
                        No audit logs found.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {logs.map((log) => {
                            const normalizedAction = normalizeActionLabel(log.Action);
                            const color = statusColorMap[normalizedAction] || statusColorMap.default;
                            const readableMessage = buildReadableMessage(log, normalizedAction);
                            const { time, date } = formatTimestamp(log.Timestamp);

                            return (
                                <div
                                    key={log.logid}
                                    className="flex items-start justify-between px-4 py-3 text-sm hover:bg-gray-50 transition"
                                >
                                    {/* Left: status + message */}
                                    <div className="flex items-start gap-3">
                                        <span
                                            className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${color}`}
                                        >
                                            {normalizedAction}
                                        </span>
                                        <div className="leading-snug">
                                            <p className="text-gray-800">
                                                {readableMessage}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                By{" "}
                                                <span className="font-medium">
                                                    {log.displayname || (log.userid ? `User #${log.userid}` : 'System')}
                                                </span>
                                                {log.rolename ? ` — ${log.rolename}` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: time + date */}
                                    <div className="text-right text-xs text-gray-500 whitespace-nowrap">
                                        <div>{time}</div>
                                        <div>{date}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}



