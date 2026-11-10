import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    complianceStatusOfficesAPI,
    usersAPI,
    officesAPI,
    officeHeadsAPI,
    eventsAPI,
    requirementsAPI,
    criteriaAPI,
} from "../utils/api";
import api from "../utils/api";
import { Link } from "react-router-dom";
import { isAcademicEntity } from "../utils/entityHelpers";
import UnifiedSetupWizard from "../components/UnifiedSetupWizard/UnifiedSetupWizard";
import { DashboardSkeleton } from "../components/UI/Skeleton";
import DeficiencyTracker from "../components/Home/DeficiencyTracker";
import ViewReqPasscuModal from "../components/ViewReqPasscuModal/ViewReqPasscuModal";
import CustomDropdown from "../components/UI/CustomDropdown";
import { useLiveRefresh } from "../utils/liveSync";
import { getDeadlineInfo } from "../utils/deadlineHelpers";
import { useToast } from "../components/UI/Toast";
import {
    Activity,
    Building2,
    CheckCircle2,
    AlertTriangle,
    Clock,
    FileCheck2,
    Plus,
    ShieldCheck,
    Users,
    ArrowUpRight,
    Sparkles,
    Calendar,
    Layers,
    ListChecks,
    Award,
    Lock,
    Unlock,
    BellRing,
    CalendarClock,
    BarChart3,
} from "lucide-react";
import {
    actionStyles,
    normalizeActionLabel,
    resolveLogContext,
    buildInDepthMessage,
    roleIdToName,
    stripEmojis,
    formatTimestamp,
} from "../utils/auditLogHelpers";

const unwrapArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload?.data?.areas)) return payload.data.areas;
    if (Array.isArray(payload?.data?.logs)) return payload.data.logs;
    if (Array.isArray(payload?.logs)) return payload.logs;
    if (Array.isArray(payload?.users)) return payload.users;
    if (Array.isArray(payload?.events)) return payload.events;
    if (Array.isArray(payload?.areas)) return payload.areas;
    return [];
};

export default function Home() {
    const [complianceData, setComplianceData] = useState([]);
    const [offices, setOffices] = useState([]);
    const [officeHeads, setOfficeHeads] = useState([]);
    const [events, setEvents] = useState([]);
    const [requirements, setRequirements] = useState([]);
    const [criteria, setCriteria] = useState([]);
    const [areas, setAreas] = useState([]);
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showWizard, setShowWizard] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [inspectOffice, setInspectOffice] = useState(null);
    const [isViewReqModalOpen, setIsViewReqModalOpen] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const [selectedAreaEventId, setSelectedAreaEventId] = useState("");
    const [busyEventAction, setBusyEventAction] = useState({});
    const { toast } = useToast();

    // Default to admin (show features) until we confirm otherwise
    const isAdmin = !!(currentUser && (currentUser.rolename === 'admin' || currentUser.roleid === 1));

    const handleUpdateEventDeadline = async (eventItem, newDeadlineValue) => {
        if (!isAdmin || !eventItem?.id) return;
        const key = `deadline-${eventItem.id}`;
        setBusyEventAction(prev => ({ ...prev, [key]: true }));
        try {
            const payloadDeadline = newDeadlineValue ? newDeadlineValue : null;
            const res = await eventsAPI.updateDeadline(eventItem.id, payloadDeadline);
            if (res?.success) {
                setEvents(prev => prev.map(ev =>
                    String(ev.eventid) === String(eventItem.id)
                        ? { ...ev, deadline: res.data?.deadline ?? payloadDeadline }
                        : ev
                ));
                toast?.({
                    title: payloadDeadline ? 'Submission Deadline Updated' : 'Deadline Cleared',
                    description: res.message,
                    variant: 'success'
                });
            }
        } catch (err) {
            toast?.({
                title: 'Deadline Update Failed',
                description: err?.response?.data?.message || 'Could not update deadline.',
                variant: 'error'
            });
        } finally {
            setBusyEventAction(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleSendCountdownReminder = async (eventItem) => {
        if (!isAdmin || !eventItem?.id) return;
        const key = `remind-${eventItem.id}`;
        if (busyEventAction[key]) return;
        setBusyEventAction(prev => ({ ...prev, [key]: true }));
        try {
            const res = await eventsAPI.sendReminder(eventItem.id);
            if (res?.success) {
                toast?.({
                    title: 'Countdown Reminder Dispatched',
                    description: res.message || `Sent reminder to ${res.recipientCount || 0} personnel.`,
                    variant: 'success'
                });
            }
        } catch (err) {
            toast?.({
                title: 'Reminder Failed',
                description: err?.response?.data?.message || 'Could not send countdown reminder.',
                variant: 'error'
            });
        } finally {
            setBusyEventAction(prev => ({ ...prev, [key]: false }));
        }
    };

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const response = await usersAPI.getLoggedInUser();
                if (response.success) setCurrentUser(response.user);
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };
        fetchCurrentUser();
    }, []);

    const fetchDashboardData = useCallback(async (options = {}) => {
        const isSilent = Boolean(options?.silent);
        if (!isSilent) {
            setLoading(true);
        }
        try {
            const [
                compliancePayload,
                officesPayload,
                officeHeadsPayload,
                eventsPayload,
                requirementsPayload,
                criteriaPayload,
                usersPayload,
                areasPayload,
                logsResponse,
            ] = await Promise.all([
                complianceStatusOfficesAPI.getAll().catch(() => []),
                officesAPI.getAll().catch(() => []),
                officeHeadsAPI.getAllHeads().catch(() => []),
                eventsAPI.getAllEvents().catch(() => ({ data: [] })),
                requirementsAPI.getAllRequirements().catch(() => ({ data: [] })),
                criteriaAPI.getAll().catch(() => ({ data: [] })),
                usersAPI.getAllUsers().catch(() => ({ users: [] })),
                api.get("/api/areas").catch(() => ({ data: [] })),
                api.get("/api/logs").catch(() => ({ data: { logs: [] } })),
            ]);

            const nextCompliance = unwrapArray(compliancePayload);
            const nextOffices = unwrapArray(officesPayload);
            const nextOfficeHeads = unwrapArray(officeHeadsPayload);
            const nextEvents = unwrapArray(eventsPayload);
            const nextRequirements = unwrapArray(requirementsPayload);
            const nextCriteria = unwrapArray(criteriaPayload);
            const nextUsers = unwrapArray(usersPayload);
            const nextAreas = unwrapArray(areasPayload);
            const nextLogs = unwrapArray(logsResponse?.data)
                .slice()
                .sort((a, b) => new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0));

            setComplianceData(nextCompliance);
            setOffices(nextOffices);
            setOfficeHeads(nextOfficeHeads);
            setEvents(nextEvents);
            setRequirements(nextRequirements);
            setCriteria(nextCriteria);
            setUsers(nextUsers);
            setAreas(nextAreas);
            setLogs(nextLogs);
            setError(null);
        } catch (err) {
            console.error("Failed to fetch dashboard data:", err);
            if (!isSilent) {
                setError("Failed to load dashboard data.");
            }
        } finally {
            if (!isSilent) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [fetchDashboardData]);

    // Live real-time syncing for dashboard metrics and logs
    useLiveRefresh(fetchDashboardData);

    const {
        officeMap,
        compiledOffices,
        notCompiledOffices,
        partialOffices,
        academicSummary,
        activeEventProgress,
        areaProgressList,
        complianceSummary,
        completionRate,
    } = useMemo(() => {
        const getOfficeId = (office) =>
            office?.officeid ?? office?.id ?? office?.officeid ?? null;
        const getOfficeEventId = (office) =>
            office?.eventid ?? office?.EventId ?? office?.eventid ?? null;
        const getOfficeName = (office) =>
            office?.officename ?? office?.officename ?? office?.OfficeCode ?? office?.office_code ?? null;
        const getEventId = (entity) =>
            entity?.eventid ?? entity?.EventId ?? entity?.eventid ?? entity?.eventid ?? null;
        const getCriteriaId = (criterion) =>
            criterion?.criteriaid ?? criterion?.CriteriaId ?? criterion?.criteriaid ?? criterion?.id ?? null;
        const getRequirementId = (requirement) =>
            requirement?.requirementid ?? requirement?.RequirementId ?? requirement?.requirementid ?? requirement?.id ?? null;
        const getRequirementCriteriaId = (requirement) =>
            requirement?.criteriaid ?? requirement?.CriteriaId ?? requirement?.criteriaid ?? null;
        const getComplianceOfficeId = (row) =>
            row?.officeid ?? row?.officeid ?? row?.officeid ?? null;
        const getComplianceRequirementId = (row) =>
            row?.requirementid ?? row?.requirementid ?? row?.requirementid ?? null;
        const getComplianceStatus = (row) =>
            row?.Status ?? row?.status ?? null;

        const byOffice = {};
        const byEvent = {};
        const officeNameMap = {};
        const eventNameMap = {};
        const officeByIdMap = new Map();

        for (const office of offices) {
            const officeid = getOfficeId(office);
            if (officeid !== undefined && officeid !== null) {
                const idStr = String(officeid);
                officeByIdMap.set(idStr, office);
                officeNameMap[idStr] = getOfficeName(office) || `Office ${officeid}`;
            }
        }

        for (const event of events) {
            if (event?.eventid !== undefined && event?.eventid !== null) {
                eventNameMap[String(event.eventid)] =
                    event.eventname || event.eventcode || `Event ${event.eventid}`;
            }
        }

        const criteriaCountByEvent = {};
        const criteriaEventById = {};
        for (const criterion of criteria) {
            const criteriaid = getCriteriaId(criterion);
            const eventid = getEventId(criterion);
            if (criteriaid !== undefined && criteriaid !== null && eventid !== undefined && eventid !== null) {
                criteriaEventById[String(criteriaid)] = String(eventid);
            }
            if (eventid !== undefined && eventid !== null) {
                const key = String(eventid);
                criteriaCountByEvent[key] = (criteriaCountByEvent[key] || 0) + 1;
            }
        }

        for (const item of complianceData) {
            const officeid = item?.officeid;
            const eventid = item?.eventid;
            const status = Number(item?.Status);

            if (officeid !== undefined && officeid !== null) {
                if (!byOffice[officeid]) byOffice[officeid] = [];
                byOffice[officeid].push(status);
                if (!officeNameMap[String(officeid)]) {
                    officeNameMap[String(officeid)] = item?.officename || `Office ${officeid}`;
                }
            }

            if (eventid !== undefined && eventid !== null) {
                if (!byEvent[eventid]) byEvent[eventid] = [];
                byEvent[eventid].push(status);
                if (!eventNameMap[String(eventid)]) {
                    eventNameMap[String(eventid)] = item?.eventname || `Event ${eventid}`;
                }
            }
        }

        // Helper to accurately classify any entity into: 'compiled' | 'partial' | 'notCompiled'
        const classifyOffice = (office, statuses = []) => {
            const statusStr = String(office?.overallstatus || office?.overallstatus || '').trim().toLowerCase();
            const percent = Number(office?.compliancepercent ?? office?.compliancepercent ?? -1);

            if (statusStr === 'complied' || statusStr === 'fully complied' || percent >= 100) {
                return 'compiled';
            }
            if (statusStr === 'partially complied' || statusStr === 'partial' || (percent > 0 && percent < 100)) {
                return 'partial';
            }
            if (statusStr === 'not complied' || percent === 0) {
                if (statuses.length > 0) {
                    const allCompiled = statuses.every((s) => s === 5);
                    const hasComplied = statuses.some((s) => s === 5);
                    const hasPartial = statuses.some((s) => s === 4);
                    if (allCompiled) return 'compiled';
                    if (hasComplied || hasPartial) return 'partial';
                }
                return 'notCompiled';
            }

            if (statuses.length > 0) {
                const allCompiled = statuses.every((s) => s === 5);
                const hasComplied = statuses.some((s) => s === 5);
                const hasPartial = statuses.some((s) => s === 4);
                if (allCompiled) return 'compiled';
                if (hasComplied || hasPartial) return 'partial';
                return 'notCompiled';
            }

            return 'notCompiled';
        };

        // Classify all monitored entities (combining Academic Programs and Non-Academic Offices)
        const allEvaluatedOffices = offices.length > 0
            ? offices
            : Object.keys(byOffice).map((id) => ({ officeid: id, id }));

        let done = 0;
        let partial = 0;
        let notDone = 0;
        let academicCount = 0;
        let nonAcademicCount = 0;
        let academicPartial = 0;
        let nonAcademicPartial = 0;
        let academicDone = 0;
        let nonAcademicDone = 0;
        let academicNotDone = 0;
        let nonAcademicNotDone = 0;

        for (const office of allEvaluatedOffices) {
            const officeIdStr = String(getOfficeId(office));
            const statuses = byOffice[officeIdStr] || [];
            const bucket = classifyOffice(office, statuses);
            const isAcademic = isAcademicEntity(office);

            if (isAcademic) academicCount++;
            else nonAcademicCount++;

            if (bucket === 'compiled') {
                done++;
                if (isAcademic) academicDone++;
                else nonAcademicDone++;
            } else if (bucket === 'partial') {
                partial++;
                if (isAcademic) academicPartial++;
                else nonAcademicPartial++;
            } else {
                notDone++;
                if (isAcademic) academicNotDone++;
                else nonAcademicNotDone++;
            }
        }

        const activeEvents = events.filter((event) => {
            const eventStatus = String(event?.status || event?.Status || 'active').toLowerCase().trim();
            return eventStatus !== 'inactive';
        });

        const activeEventProgressList = activeEvents.map((event) => {
            const eventid = String(getEventId(event) ?? '');

            const eventOffices = offices.filter(
                (office) => String(getOfficeEventId(office) ?? '') === eventid
            );

            const eventOfficeIds = eventOffices
                .map((office) => String(getOfficeId(office) ?? ''))
                .filter(Boolean);

            const eventCriteriaIds = criteria
                .filter((criterion) => String(getEventId(criterion) ?? '') === eventid)
                .map((criterion) => String(getCriteriaId(criterion) ?? ''))
                .filter(Boolean);

            const eventCriteriaSet = new Set(eventCriteriaIds);
            const eventRequirementIds = requirements
                .filter((requirement) => {
                    const directEventId = getEventId(requirement);
                    if (directEventId !== undefined && directEventId !== null) {
                        return String(directEventId) === eventid;
                    }

                    const requirementCriteriaId = getRequirementCriteriaId(requirement);
                    return requirementCriteriaId !== undefined && requirementCriteriaId !== null
                        ? eventCriteriaSet.has(String(requirementCriteriaId))
                        : false;
                })
                .map((requirement) => String(getRequirementId(requirement) ?? ''))
                .filter(Boolean);

            const eventOfficeSet = new Set(eventOfficeIds);
            const eventRequirementSet = new Set(eventRequirementIds);
            const rowsForEvent = complianceData.filter((row) => {
                const officeid = String(getComplianceOfficeId(row) ?? '');
                if (!eventOfficeSet.has(officeid)) return false;

                if (eventRequirementSet.size === 0) return true;

                const requirementid = String(getComplianceRequirementId(row) ?? '');
                return eventRequirementSet.has(requirementid);
            });

            let compiledOfficeCount = 0;
            let partialOfficeCount = 0;
            let notCompiledOfficeCount = 0;
            let eventAcademicCount = 0;
            let eventNonAcademicCount = 0;
            let eventAcademicPartial = 0;
            let eventNonAcademicPartial = 0;

            const officeStatusesMap = new Map();
            for (const officeid of eventOfficeIds) {
                officeStatusesMap.set(officeid, []);
            }

            for (const row of rowsForEvent) {
                const officeid = String(getComplianceOfficeId(row) ?? '');
                if (!officeStatusesMap.has(officeid)) continue;
                const status = Number(getComplianceStatus(row));
                officeStatusesMap.get(officeid).push(Number.isFinite(status) ? status : 3);
            }

            for (const office of eventOffices) {
                const officeid = String(getOfficeId(office));
                const statusesForOffice = officeStatusesMap.get(officeid) || [];
                const officeBucket = classifyOffice(office, statusesForOffice);
                const isAcademic = isAcademicEntity(office);

                if (isAcademic) eventAcademicCount += 1;
                else eventNonAcademicCount += 1;

                if (officeBucket === 'compiled') {
                    compiledOfficeCount += 1;
                } else if (officeBucket === 'partial') {
                    partialOfficeCount += 1;
                    if (isAcademic) eventAcademicPartial += 1;
                    else eventNonAcademicPartial += 1;
                } else {
                    notCompiledOfficeCount += 1;
                }
            }

            let compiledRequirements = 0;
            let partialRequirements = 0;
            let notCompiledRequirements = 0;

            for (const row of rowsForEvent) {
                const status = Number(getComplianceStatus(row));
                if (status === 5) compiledRequirements += 1;
                else if (status === 4) partialRequirements += 1;
                else notCompiledRequirements += 1;
            }

            const totalOfficesForEvent = eventOfficeIds.length;
            const totalRequirementRows = rowsForEvent.length;
            const rawEventScore = totalRequirementRows > 0
                ? ((compiledRequirements * 100) + (partialRequirements * 50)) / totalRequirementRows
                : 0;
            const completionPercent = rawEventScore === 0
                ? 0
                : rawEventScore < 1
                ? Number(rawEventScore.toFixed(1))
                : (rawEventScore % 1 === 0 ? Number(rawEventScore.toFixed(0)) : Number(rawEventScore.toFixed(1)));

            return {
                id: eventid,
                name: event?.eventname || eventNameMap[eventid] || `Event ${eventid}`,
                code: event?.eventcode || '-',
                islocked: Boolean(event?.islocked),
                deadline: event?.deadline || null,
                totalOffices: totalOfficesForEvent,
                totalEvents: 1,
                totalCriteria: criteriaCountByEvent[eventid] || 0,
                totalrequirements: rowsForEvent.length,
                completionPercent,
                officeStatus: {
                    compiled: compiledOfficeCount,
                    partial: partialOfficeCount,
                    notCompiled: notCompiledOfficeCount,
                    academicCount: eventAcademicCount,
                    nonAcademicCount: eventNonAcademicCount,
                    academicPartial: eventAcademicPartial,
                    nonAcademicPartial: eventNonAcademicPartial,
                },
                requirementStatus: {
                    compiled: compiledRequirements,
                    partial: partialRequirements,
                    notCompiled: notCompiledRequirements,
                },
            };
        });

        // Build Area-by-Area Compliance Readiness Breakdown across active events
        const activeEventIdSet = new Set(activeEvents.map(ev => String(getEventId(ev) ?? '')));
        const eventCodeLookup = {};
        for (const ev of events) {
            const eid = getEventId(ev);
            if (eid != null) {
                eventCodeLookup[String(eid)] = ev.eventcode || ev.eventname || `EV-${eid}`;
            }
        }

        // Deduplicate areas by areaid (in case of multiple auditor join rows)
        const uniqueAreasMap = new Map();
        for (const area of areas) {
            const aid = area?.areaid ?? area?.id;
            if (aid != null && !uniqueAreasMap.has(String(aid))) {
                uniqueAreasMap.set(String(aid), area);
            }
        }
        const uniqueAreas = Array.from(uniqueAreasMap.values());
        const eventsWithAreas = new Set(
            uniqueAreas.map(a => String(a?.eventid ?? a?.EventId ?? '')).filter(Boolean)
        );

        // Index criteria by ID so we can resolve parentcriteriaid chains and areaid
        const criteriaById = new Map();
        for (const crit of criteria) {
            const cid = getCriteriaId(crit);
            if (cid != null) {
                criteriaById.set(String(cid), crit);
            }
        }

        // Resolve each criterion to either its parent Area ID or, if its event has no areas / it has no areaid, its root Criterion bucket
        const criteriaAreaMap = new Map();
        const fallbackCriteriaBuckets = new Map();

        const resolveCriterionBucket = (crit) => {
            const cid = String(getCriteriaId(crit) ?? '');
            if (!cid) return null;
            if (criteriaAreaMap.has(cid)) return criteriaAreaMap.get(cid);

            let current = crit;
            let rootCrit = crit;
            const visited = new Set();
            while (current) {
                const curId = String(getCriteriaId(current) ?? '');
                if (visited.has(curId)) break;
                visited.add(curId);

                const directAid = current?.areaid ?? current?.AreaId ?? null;
                if (directAid != null && uniqueAreasMap.has(String(directAid))) {
                    criteriaAreaMap.set(cid, String(directAid));
                    return String(directAid);
                }

                const parentId = current?.parentcriteriaid ?? current?.ParentCriteriaID ?? current?.ParentCriteriaId ?? null;
                if (parentId != null && criteriaById.has(String(parentId))) {
                    rootCrit = criteriaById.get(String(parentId));
                    current = rootCrit;
                } else {
                    break;
                }
            }

            // If no Area record exists for this criterion, fall back to its root Criterion (Sub-Area) bucket
            const rootCid = String(getCriteriaId(rootCrit) ?? cid);
            const eid = String(getEventId(rootCrit) ?? getEventId(crit) ?? '');
            const bucketKey = `crit-${rootCid}`;
            if (!fallbackCriteriaBuckets.has(bucketKey)) {
                fallbackCriteriaBuckets.set(bucketKey, {
                    areaid: bucketKey,
                    areacode: rootCrit?.criteriacode || rootCrit?.CriteriaCode || '',
                    areaname: rootCrit?.criterianame || rootCrit?.CriteriaName || `Criterion ${rootCid}`,
                    eventid: eid,
                    isFallbackCriterion: true,
                });
            }
            criteriaAreaMap.set(cid, bucketKey);
            return bucketKey;
        };

        for (const crit of criteria) {
            resolveCriterionBucket(crit);
        }

        const reqAreaMap = new Map();
        const definedReqsPerArea = new Map();
        for (const req of requirements) {
            const rid = getRequirementId(req);
            if (rid == null) continue;
            const directAreaId = req?.areaid ?? req?.AreaId ?? null;
            const cid = getRequirementCriteriaId(req);
            const resolvedAreaId = (directAreaId != null && uniqueAreasMap.has(String(directAreaId)))
                ? String(directAreaId)
                : (cid != null ? criteriaAreaMap.get(String(cid)) : null);
            if (resolvedAreaId) {
                reqAreaMap.set(String(rid), resolvedAreaId);
                definedReqsPerArea.set(resolvedAreaId, (definedReqsPerArea.get(resolvedAreaId) || 0) + 1);
            }
        }

        const areaStatsMap = new Map();
        for (const row of complianceData) {
            const rid = getComplianceRequirementId(row);
            if (rid == null) continue;
            const aid = reqAreaMap.get(String(rid));
            if (!aid) continue;
            if (!areaStatsMap.has(aid)) {
                areaStatsMap.set(aid, { compiled: 0, partial: 0, notCompiled: 0, total: 0 });
            }
            const entry = areaStatsMap.get(aid);
            const status = Number(getComplianceStatus(row));
            entry.total += 1;
            if (status === 5) entry.compiled += 1;
            else if (status === 4) entry.partial += 1;
            else entry.notCompiled += 1;
        }

        const combinedTrackableAreas = [
            ...uniqueAreas,
            ...Array.from(fallbackCriteriaBuckets.values()).filter(bucket => {
                // Include fallback criterion buckets if the event has no formal areas OR if requirements are attached to this bucket
                return !eventsWithAreas.has(bucket.eventid) || (definedReqsPerArea.get(bucket.areaid) || 0) > 0;
            }),
        ];

        const computedAreaProgress = combinedTrackableAreas
            .filter(area => {
                const eid = String(area?.eventid ?? area?.EventId ?? '');
                return activeEventIdSet.size === 0 || activeEventIdSet.has(eid);
            })
            .map(area => {
                const aid = String(area?.areaid ?? area?.id ?? '');
                const eid = String(area?.eventid ?? area?.EventId ?? '');
                const stats = areaStatsMap.get(aid) || { compiled: 0, partial: 0, notCompiled: 0, total: 0 };
                const rawPct = stats.total > 0
                    ? ((stats.compiled * 100) + (stats.partial * 50)) / stats.total
                    : 0;
                const readinessPct = rawPct === 0
                    ? 0
                    : rawPct < 1
                    ? Number(rawPct.toFixed(1))
                    : (rawPct % 1 === 0 ? Number(rawPct.toFixed(0)) : Number(rawPct.toFixed(1)));
                return {
                    areaid: aid,
                    areacode: area?.areacode || '',
                    areaname: area?.areaname || `Area ${aid}`,
                    eventid: eid,
                    eventcode: eventCodeLookup[eid] || `EV-${eid}`,
                    definedReqs: definedReqsPerArea.get(aid) || 0,
                    totalEvaluated: stats.total,
                    compiled: stats.compiled,
                    partial: stats.partial,
                    notCompiled: stats.notCompiled,
                    readinessPct,
                };
            })
            .sort((a, b) => {
                if (a.eventid !== b.eventid) return a.eventid.localeCompare(b.eventid);
                return (a.areacode || a.areaname).localeCompare(b.areacode || b.areaname, undefined, { numeric: true });
            });

        const totalRecords = complianceData.length;
        const compiledRecords = complianceData.filter((item) => Number(item?.Status) === 5).length;
        const partialRecords = complianceData.filter((item) => Number(item?.Status) === 4).length;
        const notCompiledRecords = complianceData.filter((item) => Number(item?.Status) === 3).length;

        const rawCompletion = totalRecords > 0
            ? ((compiledRecords * 100) + (partialRecords * 50)) / totalRecords
            : 0;

        const completionRate = rawCompletion === 0
            ? 0
            : rawCompletion < 1
            ? Number(rawCompletion.toFixed(1))
            : (rawCompletion % 1 === 0 ? Number(rawCompletion.toFixed(0)) : Number(rawCompletion.toFixed(1)));

        return {
            officeMap: byOffice,
            compiledOffices: done,
            notCompiledOffices: notDone,
            partialOffices: partial,
            academicSummary: {
                totalAcademic: academicCount,
                totalNonAcademic: nonAcademicCount,
                academicPartial,
                nonAcademicPartial,
                academicDone,
                nonAcademicDone,
                academicNotDone,
                nonAcademicNotDone,
            },
            activeEventProgress: activeEventProgressList,
            areaProgressList: computedAreaProgress,
            complianceSummary: {
                totalRecords,
                compiledRecords,
                partialRecords,
                notCompiledRecords,
            },
            completionRate,
        };
    }, [complianceData, offices, events, criteria, requirements, areas]);

    useEffect(() => {
        if (activeEventProgress.length > 0) {
            const exists = activeEventProgress.some(ev => String(ev.id) === String(selectedAreaEventId));
            if (!selectedAreaEventId || !exists) {
                setSelectedAreaEventId(String(activeEventProgress[0].id));
            }
        }
    }, [activeEventProgress, selectedAreaEventId]);

    const officesCount = Math.max(offices.length, Object.keys(officeMap).length);

    // Context lookups identical to AuditLogs.jsx
    const lookups = useMemo(() => {
        const eventLookup = {};
        for (const item of events) {
            if (item?.eventid != null) {
                eventLookup[String(item.eventid)] = {
                    eventname: item.eventname || "",
                    eventcode: item.eventcode || "",
                    Year: item.Year || ""
                };
            }
        }

        const areaLookup = {};
        for (const item of areas) {
            if (item?.areaid != null) {
                areaLookup[String(item.areaid)] = {
                    areaname: item.areaname || "",
                    eventid: item.eventid || null
                };
            }
        }

        const criteriaLookup = {};
        for (const item of criteria) {
            if (item?.criteriaid != null) {
                criteriaLookup[String(item.criteriaid)] = {
                    criteriacode: item.criteriacode || "",
                    criterianame: item.criterianame || "",
                    areaid: item.areaid || null
                };
            }
        }

        const requirementLookup = {};
        for (const item of requirements) {
            if (item?.requirementid != null) {
                requirementLookup[String(item.requirementid)] = {
                    requirementcode: item.requirementcode || "",
                    Description: item.Description || "",
                    criteriaid: item.criteriaid || null
                };
            }
        }

        const officeLookup = {};
        for (const item of offices) {
            if (item?.officeid != null) {
                officeLookup[String(item.officeid)] = {
                    officename: item.officename || "",
                    OfficeCode: item.OfficeCode || "",
                    eventid: item.eventid || null
                };
            }
        }

        const userLookup = {};
        for (const u of users) {
            if (u?.userid != null) {
                const name = String(
                    u.FullName ||
                    `${u.firstname || ""}${u.middleinitial ? ` ${u.middleinitial}.` : ""} ${u.lastname || ""}`
                ).replace(/\s+/g, " ").trim();
                userLookup[String(u.userid)] = name || u.Email || "User";
            }
        }

        return { eventLookup, areaLookup, criteriaLookup, requirementLookup, officeLookup, userLookup };
    }, [events, areas, criteria, requirements, offices, users]);

    // Format recent logs with in-depth messages & lookups matching AuditLogs page
    const preparedRecentLogs = useMemo(() => {
        return logs.slice(0, 8).map((log) => {
            const rawAction = log?.Action || log?.action || '';
            const normalizedAction = normalizeActionLabel(rawAction);
            const ctx = resolveLogContext(log, lookups);
            const rawMessage = buildInDepthMessage(log, normalizedAction, ctx);
            return {
                ...log,
                Action: stripEmojis(rawAction),
                Timestamp: log?.Timestamp || log?.timestamp,
                normalizedAction,
                context: ctx,
                readableMessage: stripEmojis(rawMessage),
                displayname: stripEmojis(log?.displayname || log?.FullName),
            };
        });
    }, [logs, lookups]);

    const totalOfficeUnits = compiledOffices + partialOffices + notCompiledOffices || officesCount || 1;
    const compiledOfficePct = Math.round((compiledOffices / totalOfficeUnits) * 100);
    const partialOfficePct = Math.round((partialOffices / totalOfficeUnits) * 100);
    const notCompiledOfficePct = Math.max(0, 100 - compiledOfficePct - partialOfficePct);

    const donutStyle = useMemo(() => {
        const total = compiledOffices + partialOffices + notCompiledOffices;
        if (total === 0) {
            return { background: "conic-gradient(#e2e8f0 0deg 360deg)" };
        }

        const compiledDeg = (compiledOffices / total) * 360;
        const partialDeg = (partialOffices / total) * 360;
        const notCompiledDeg = 360 - compiledDeg - partialDeg;

        return {
            background: `conic-gradient(
                #10b981 0deg ${compiledDeg}deg,
                #f59e0b ${compiledDeg}deg ${compiledDeg + partialDeg}deg,
                #f43f5e ${compiledDeg + partialDeg}deg ${compiledDeg + partialDeg + notCompiledDeg}deg
            )`,
        };
    }, [compiledOffices, partialOffices, notCompiledOffices]);

    if (loading) return <DashboardSkeleton />;
    if (error) return (
        <div className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                <div>
                    <h3 className="font-semibold text-rose-900">Dashboard Unavailable</h3>
                    <p className="text-sm text-rose-700 mt-0.5">{error}</p>
                </div>
            </div>
            <button
                onClick={() => fetchDashboardData()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 transition"
            >
                Retry Loading
            </button>
        </div>
    );

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <Activity className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Compliance Dashboard</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Operational compliance overview, institutional tracking, and audit activity.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isAdmin && (
                            <button
                                onClick={() => setShowWizard(true)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                            >
                                <Plus size={14} className="shrink-0" />
                                <span>Quick Setup</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-4 pb-12">

            <UnifiedSetupWizard
                isOpen={showWizard}
                onClose={() => setShowWizard(false)}
                onSuccess={fetchDashboardData}
            />

            {/* ── Primary KPI Summary Bar (Hierarchy-First, Anti-Slop) ── */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {/* 1. Global Compliance Index */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Compliance</span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold tracking-tight text-slate-900">{completionRate}%</span>
                                <span className="text-xs font-medium text-slate-500">of total items</span>
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            <ShieldCheck size={20} />
                        </div>
                    </div>
                    <div className="mt-3.5">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${completionRate > 0 ? Math.max(completionRate, 2) : 0}%` }}
                            />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                            <span>{complianceSummary.compiledRecords} compliant{complianceSummary.partialRecords > 0 ? ` (${complianceSummary.partialRecords} partial)` : ''}</span>
                            <span>{complianceSummary.totalRecords} total</span>
                        </div>
                    </div>
                </div>

                {/* 2. Monitored Offices & Programs */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monitored Offices & Programs</span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold tracking-tight text-slate-900">{officesCount}</span>
                                <span className="text-xs font-medium text-slate-500">units</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                                {academicSummary?.totalAcademic || 0} Academic · {academicSummary?.totalNonAcademic || 0} Non-Academic
                            </p>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            <Building2 size={20} />
                        </div>
                    </div>
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                            {compiledOffices} Done
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60" title={`${academicSummary?.academicPartial || 0} Academic, ${academicSummary?.nonAcademicPartial || 0} Non-Academic`}>
                            {partialOffices} Partial
                        </span>
                        <span className="inline-flex items-center gap-1 font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                            {notCompiledOffices} Deficient
                        </span>
                    </div>
                </div>

                {/* 3. Active Standards & Events */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Standards</span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold tracking-tight text-slate-900">{events.length}</span>
                                <span className="text-xs font-medium text-slate-500">active events</span>
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            <Calendar size={20} />
                        </div>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                        <span>{criteria.length} defined sub areas</span>
                        <Link to="/home/events" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700">
                            View <ArrowUpRight size={12} />
                        </Link>
                    </div>
                </div>

                {/* 4. Personnel & Accounts */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between">
                        <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Staff & Users</span>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-3xl font-extrabold tracking-tight text-slate-900">{users.length}</span>
                                <span className="text-xs font-medium text-slate-500">accounts</span>
                            </div>
                        </div>
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="mt-3.5 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                        <span>{officeHeads.length} assigned office heads</span>
                        <Link to="/home/users" className="inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700">
                            Manage <ArrowUpRight size={12} />
                        </Link>
                    </div>
                </div>
            </div>



            {/* ── Active Audit Standards Progress & Governance Controls ── */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Active Audit Standards & Deadlines</h2>
                        <p className="text-xs text-slate-500">
                            Track accreditation readiness, manage submission deadlines, and send countdown reminders
                        </p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded border border-slate-200/60 self-start sm:self-auto">
                        {activeEventProgress.length} Active {activeEventProgress.length === 1 ? 'Standard' : 'Standards'}
                    </span>
                </div>

                {activeEventProgress.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
                        <Layers className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-medium text-slate-600">No active audit standards found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Create a compliance event in Settings to track progress.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeEventProgress.map((eventItem) => {
                            const isEventCompleted = Boolean(
                                eventItem.completionPercent >= 100 ||
                                eventItem.iscompleted === true ||
                                eventItem.isCompleted === true ||
                                (eventItem.officeStatus && eventItem.officeStatus.compiled > 0 && eventItem.officeStatus.notCompiled === 0 && eventItem.officeStatus.partial === 0)
                            );
                            const dlInfo = getDeadlineInfo(eventItem.deadline, isEventCompleted);
                            const deadlineBusy = Boolean(busyEventAction[`deadline-${eventItem.id}`]);
                            const remindBusy = Boolean(busyEventAction[`remind-${eventItem.id}`]);

                            return (
                                <div
                                    key={eventItem.id}
                                    className="rounded-xl border border-slate-200/90 bg-slate-50/50 hover:border-slate-300 hover:bg-white p-4 transition flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-2.5">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="rounded bg-blue-100/80 px-2 py-0.5 text-xs font-bold text-blue-700 font-mono">
                                                        {eventItem.code && eventItem.code !== '-' ? eventItem.code : `EV-${eventItem.id}`}
                                                    </span>
                                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dlInfo.badgeClasses}`}>
                                                        <CalendarClock className="w-2.5 h-2.5 shrink-0" />
                                                        {dlInfo.label}
                                                    </span>
                                                </div>
                                                <h3 className="truncate text-sm font-bold text-slate-900 mt-1.5">
                                                    {eventItem.name}
                                                </h3>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-800">
                                                {eventItem.completionPercent}%
                                            </span>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                            <div
                                                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                                style={{ width: `${eventItem.completionPercent > 0 ? Math.max(eventItem.completionPercent, 2) : 0}%` }}
                                            />
                                        </div>

                                        {/* Event Metric Chips */}
                                        <div className="mt-3.5 grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="rounded-lg border border-slate-200/70 bg-white py-2 px-1">
                                                <span className="block text-[11px] text-slate-400 truncate" title="Offices and Programs">Offices and Programs</span>
                                                <span className="font-bold text-slate-800 text-sm">{eventItem.totalOffices}</span>
                                                <span className="block text-[9px] text-slate-400 truncate">
                                                    {eventItem.officeStatus.academicCount || 0} Acad · {eventItem.officeStatus.nonAcademicCount || 0} Non
                                                </span>
                                            </div>
                                            <div className="rounded-lg border border-slate-200/70 bg-white py-2 px-1">
                                                <span className="block text-[11px] text-slate-400">Sub Areas</span>
                                                <span className="font-bold text-slate-800 text-sm">{eventItem.totalCriteria}</span>
                                                <span className="block text-[9px] text-slate-400">Categories</span>
                                            </div>
                                            <div className="rounded-lg border border-slate-200/70 bg-white py-2 px-1">
                                                <span className="block text-[11px] text-slate-400">Standards</span>
                                                <span className="font-bold text-slate-800 text-sm">{eventItem.totalrequirements}</span>
                                                <span className="block text-[9px] text-slate-400">Compliance Items</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Distribution Strip */}
                                    <div className="mt-3.5 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            <span>{eventItem.officeStatus.compiled} Done</span>
                                        </div>
                                        <div 
                                            className="flex items-center gap-1.5 cursor-help"
                                            title={`${eventItem.officeStatus.academicPartial || 0} Academic Program, ${eventItem.officeStatus.nonAcademicPartial || 0} Non-Academic Office`}
                                        >
                                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                                            <span>{eventItem.officeStatus.partial} Partial</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                                            <span>{eventItem.officeStatus.notCompiled} Deficient</span>
                                        </div>
                                    </div>

                                    {/* Admin Governance Controls: Target Deadline + Countdown Reminder */}
                                    {isAdmin && (
                                        <div className="mt-3 pt-3 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <label
                                                    htmlFor={`deadline-input-${eventItem.id}`}
                                                    className="text-[11px] font-semibold text-slate-500 whitespace-nowrap"
                                                >
                                                    Deadline:
                                                </label>
                                                <input
                                                    id={`deadline-input-${eventItem.id}`}
                                                    type="date"
                                                    disabled={deadlineBusy}
                                                    value={dlInfo.inputDateValue}
                                                    onChange={(e) => handleUpdateEventDeadline(eventItem, e.target.value)}
                                                    className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                                                />
                                            </div>

                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={remindBusy}
                                                    onClick={() => handleSendCountdownReminder(eventItem)}
                                                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                                    title="Send immediate countdown notification to all assigned personnel"
                                                >
                                                    <BellRing className="w-3 h-3 shrink-0" />
                                                    <span>{remindBusy ? 'Sending...' : 'Remind'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Executive Compliance Readiness & Area Progress Tracker ── */}
            <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column: Institutional Unit Readiness & Donut Distribution */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Executive Readiness</h2>
                                <p className="text-xs text-slate-500">Institutional unit compliance distribution</p>
                            </div>
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                                <BarChart3 size={18} />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 my-2">
                            <div
                                className="relative h-24 w-24 shrink-0 rounded-full flex items-center justify-center shadow-inner"
                                style={donutStyle}
                            >
                                <div className="h-16 w-16 rounded-full bg-white flex flex-col items-center justify-center shadow-2xs">
                                    <span className="text-sm font-extrabold text-slate-900">{compiledOfficePct}%</span>
                                    <span className="text-[9px] font-semibold uppercase text-slate-400">Ready</span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                        Complied Units
                                    </span>
                                    <span className="font-bold text-slate-900">{compiledOffices} ({compiledOfficePct}%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                                        In Progress
                                    </span>
                                    <span className="font-bold text-slate-900">{partialOffices} ({partialOfficePct}%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                                        Deficient Units
                                    </span>
                                    <span className="font-bold text-slate-900">{notCompiledOffices} ({notCompiledOfficePct}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Academic vs Non-Academic Readiness Comparison */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                        {(() => {
                            const acadTotal = academicSummary?.totalAcademic || 0;
                            const acadScore = acadTotal > 0
                                ? Math.round((((academicSummary?.academicDone || 0) * 100) + ((academicSummary?.academicPartial || 0) * 50)) / acadTotal)
                                : 0;
                            const nonAcadTotal = academicSummary?.totalNonAcademic || 0;
                            const nonAcadScore = nonAcadTotal > 0
                                ? Math.round((((academicSummary?.nonAcademicDone || 0) * 100) + ((academicSummary?.nonAcademicPartial || 0) * 50)) / nonAcadTotal)
                                : 0;

                            return (
                                <>
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-slate-700">Academic Programs ({acadTotal})</span>
                                            <span className="font-bold text-blue-700">{acadScore}% readiness</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                                style={{ width: `${acadScore > 0 ? Math.max(acadScore, 2) : 0}%` }}
                                            />
                                        </div>
                                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                                            <span>{academicSummary?.academicDone || 0} done · {academicSummary?.academicPartial || 0} partial</span>
                                            <span>{academicSummary?.academicNotDone || 0} deficient</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-semibold text-slate-700">Administrative Offices ({nonAcadTotal})</span>
                                            <span className="font-bold text-indigo-700">{nonAcadScore}% readiness</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div
                                                className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                                                style={{ width: `${nonAcadScore > 0 ? Math.max(nonAcadScore, 2) : 0}%` }}
                                            />
                                        </div>
                                        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                                            <span>{academicSummary?.nonAcademicDone || 0} done · {academicSummary?.nonAcademicPartial || 0} partial</span>
                                            <span>{academicSummary?.nonAcademicNotDone || 0} deficient</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* Right 2 Columns: Area-by-Area Compliance Progress Tracker */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Area-by-Area Compliance Tracker</h2>
                            <p className="text-xs text-slate-500">
                                Granular readiness across accreditation areas based on verified requirement statuses
                            </p>
                        </div>

                        {activeEventProgress.length > 0 && (
                            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                                <CustomDropdown
                                    value={selectedAreaEventId || String(activeEventProgress[0]?.id || "")}
                                    onChange={(val) => setSelectedAreaEventId(String(val))}
                                    options={activeEventProgress.map((ev) => ({
                                        value: String(ev.id),
                                        label: ev.code && ev.code !== '-' ? ev.code : ev.name,
                                        dot: "bg-blue-500",
                                    }))}
                                    minWidth="min-w-[160px]"
                                    size="sm"
                                />
                                {(() => {
                                    const selectedEv = activeEventProgress.find(ev => String(ev.id) === String(selectedAreaEventId || activeEventProgress[0]?.id));
                                    if (!selectedEv) return null;
                                    const isEvDone = Boolean(
                                        selectedEv.completionPercent >= 100 ||
                                        selectedEv.iscompleted === true ||
                                        selectedEv.isCompleted === true ||
                                        (selectedEv.officeStatus && selectedEv.officeStatus.compiled > 0 && selectedEv.officeStatus.notCompiled === 0 && selectedEv.officeStatus.partial === 0)
                                    );
                                    const dl = getDeadlineInfo(selectedEv.deadline, isEvDone);
                                    return (
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${dl.badgeClasses}`}>
                                            <CalendarClock className="w-3 h-3 shrink-0" />
                                            <span>{dl.label}</span>
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {(() => {
                        const targetEventId = selectedAreaEventId || String(activeEventProgress[0]?.id || "");
                        const filteredAreas = targetEventId
                            ? areaProgressList.filter(a => String(a.eventid) === String(targetEventId))
                            : areaProgressList;

                        if (filteredAreas.length === 0) {
                            return (
                                <div className="flex-1 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center">
                                    <ListChecks className="h-8 w-8 text-slate-300" />
                                    <p className="mt-2 text-sm font-medium text-slate-600">No accreditation areas found</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Areas added to active accreditation events will appear here with live compliance progress.
                                    </p>
                                </div>
                            );
                        }

                        return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                                {filteredAreas.map((area) => (
                                    <div
                                        key={area.areaid}
                                        className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 hover:bg-white hover:border-slate-300 transition flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between gap-2 mb-1.5">
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="rounded bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                                                            {area.eventcode}
                                                        </span>
                                                        {area.areacode && (
                                                            <span className="text-xs font-bold text-slate-800">
                                                                {area.areacode}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h3 className="text-xs font-bold text-slate-900 mt-1 line-clamp-1" title={area.areaname}>
                                                        {area.areaname}
                                                    </h3>
                                                </div>
                                                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                                                    area.readinessPct >= 80
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : area.readinessPct >= 40
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }`}>
                                                    {area.readinessPct}%
                                                </span>
                                            </div>

                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 mt-2">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${
                                                        area.readinessPct >= 80
                                                            ? 'bg-emerald-500'
                                                            : area.readinessPct >= 40
                                                            ? 'bg-amber-500'
                                                            : 'bg-blue-500'
                                                    }`}
                                                    style={{ width: `${area.readinessPct > 0 ? Math.max(area.readinessPct, 3) : 0}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                                            <span className="text-emerald-700 font-semibold">{area.compiled} Done</span>
                                            <span className="text-amber-700 font-semibold">{area.partial} Partial</span>
                                            <span className="text-rose-700 font-semibold">{area.notCompiled} Deficient</span>
                                            <span className="text-slate-400">{area.definedReqs} stds</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ── Comprehensive Compliance Deficiencies & Action Tracker ── */}
            <div className="mb-6">
                <DeficiencyTracker
                    offices={offices}
                    events={events}
                    complianceData={complianceData}
                    requirements={requirements}
                    criteria={criteria}
                    areas={areas}
                    users={users}
                    onInspectOffice={(office) => {
                        setInspectOffice(office);
                        setIsViewReqModalOpen(true);
                    }}
                    onRefresh={fetchDashboardData}
                    isAdmin={isAdmin}
                />
            </div>

            {/* ── In-place View/Edit Requirements Modal from Dashboard ── */}
            {isViewReqModalOpen && inspectOffice && (
                <ViewReqPasscuModal
                    isOpen={isViewReqModalOpen}
                    onClose={() => {
                        setIsViewReqModalOpen(false);
                        setInspectOffice(null);
                        fetchDashboardData();
                    }}
                    office={inspectOffice}
                />
            )}

            {/* ── Live Audit Activity Feed (Restrained, Scannable) ── */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3.5 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Recent Audit Activity</h2>
                        <p className="text-xs text-slate-500">Live feed of compliance updates, audits, and user actions</p>
                    </div>
                    <Link to="/home/audit-logs" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        View all activity <ArrowUpRight size={13} />
                    </Link>
                </div>

                <div className="divide-y divide-slate-100">
                    {preparedRecentLogs.length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400">No activity recorded yet.</p>
                    ) : (
                        preparedRecentLogs.map((log) => {
                            const action = log.normalizedAction;
                            const style = actionStyles[action] || actionStyles.default;
                            const readableMessage = log.readableMessage;
                            const { time, date } = formatTimestamp(log.Timestamp);
                            const isExpanded = expandedLogId === log.logid;
                            const userDisplayName = log.displayname || (log.userid ? `User #${log.userid}` : 'System');
                            const roleLabel = log.rolename ? roleIdToName(log.rolename) : '';
                            const ctx = log.context;

                            return (
                                <div
                                    key={log.logid || `${log.Action}-${log.Timestamp}`}
                                    className="group transition-colors hover:bg-slate-50/80 rounded-xl"
                                >
                                    <div
                                        className="flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer gap-3"
                                        onClick={() => setExpandedLogId(prev => prev === log.logid ? null : log.logid)}
                                    >
                                        {/* Left: Icon + Action Badge + Message */}
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center shadow-2xs ${style.iconBg}`}>
                                                {style.icon}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold ${style.badge}`}>
                                                        {action}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-900 truncate">
                                                        {readableMessage}
                                                    </p>
                                                </div>

                                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                                    <span>By <strong className="text-slate-700">{userDisplayName}</strong></span>
                                                    {roleLabel && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-semibold text-slate-600">{roleLabel}</span>
                                                        </>
                                                    )}
                                                    {ctx.eventname && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-blue-600 font-semibold truncate max-w-[180px] inline-flex items-center gap-1" title={ctx.eventname}>
                                                                <Award className="w-3 h-3 text-blue-500 shrink-0" />
                                                                <span>{ctx.eventname}</span>
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Timestamp & Details Toggle */}
                                        <div className="flex items-center gap-2.5 shrink-0">
                                            <div className="text-right text-[10px] text-slate-500 font-medium leading-tight">
                                                <div className="font-bold text-slate-700">{time}</div>
                                                <div className="text-slate-400 text-[9px] mt-0.5">{date}</div>
                                            </div>
                                            <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                                                <svg
                                                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-600' : ''}`}
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rich In-Depth Context Card (Tree Labeled Pills) */}
                                    {isExpanded && (
                                        <div className="px-5 py-4 bg-slate-50/90 border-t border-slate-100 text-xs text-slate-700 transition-all animate-in fade-in duration-150">
                                            <div className="mb-2 flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                <span>Detailed Activity Breakdown (Log ID #{log.logid})</span>
                                                <span>Action: {log.Action}</span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {ctx.eventname && (
                                                    <div className="rounded-xl border border-blue-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1">
                                                            Accreditation Event
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block">{ctx.eventname}</span>
                                                    </div>
                                                )}

                                                {ctx.areaname && (
                                                    <div className="rounded-xl border border-indigo-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1">
                                                            Area
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block">{ctx.areaname}</span>
                                                    </div>
                                                )}

                                                {ctx.critLabel && (
                                                    <div className="rounded-xl border border-cyan-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 flex items-center gap-1">
                                                            Sub Area
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block">{ctx.critLabel}</span>
                                                    </div>
                                                )}

                                                {(ctx.reqCode || ctx.reqDesc) && (
                                                    <div className="rounded-xl border border-sky-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 flex items-center gap-1">
                                                            Requirement
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block">
                                                            {ctx.reqCode}{ctx.reqDesc ? `: ${ctx.reqDesc}` : ''}
                                                        </span>
                                                    </div>
                                                )}

                                                {ctx.officename && (
                                                    <div className="rounded-xl border border-emerald-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                                                            Office / Program
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block">{ctx.officename}</span>
                                                    </div>
                                                )}

                                                {ctx.filename && (
                                                    <div className="rounded-xl border border-amber-200/80 bg-white p-3 shadow-2xs">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                                                            Standard File
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-900 mt-1 block truncate" title={ctx.filename}>
                                                            {ctx.filename}
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                                        Performed By
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-900 mt-1 block">
                                                        {userDisplayName} ({roleLabel || 'User'})
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Before / After Changes Diff Table */}
                                            {(() => {
                                                const d = ctx.rawDetails || {};
                                                const changes = d.changes || {};
                                                const entries = Object.entries(changes);
                                                if (entries.length === 0) return null;
                                                return (
                                                    <div className="mt-3 rounded-xl border border-orange-200/80 bg-white overflow-hidden shadow-2xs">
                                                        <div className="px-3 py-2 bg-orange-50 border-b border-orange-100 text-[10px] font-bold uppercase tracking-wider text-orange-700">
                                                            Field Changes
                                                        </div>
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase w-1/4">Field</th>
                                                                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-rose-500 uppercase w-[37.5%]">Before</th>
                                                                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-emerald-600 uppercase w-[37.5%]">After</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100">
                                                                {entries.map(([field, val]) => {
                                                                    if (typeof val !== 'object' || val === null) {
                                                                        return (
                                                                            <tr key={field}>
                                                                                <td className="px-3 py-1.5 font-medium text-slate-700">{field}</td>
                                                                                <td className="px-3 py-1.5 text-slate-400 italic" colSpan={2}>{String(val)}</td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <tr key={field}>
                                                                            <td className="px-3 py-1.5 font-medium text-slate-700">{field}</td>
                                                                            <td className="px-3 py-1.5 text-rose-600 font-mono text-[11px] bg-rose-50/30">{String(val.from ?? 'None')}</td>
                                                                            <td className="px-3 py-1.5 text-emerald-700 font-semibold font-mono text-[11px] bg-emerald-50/30">{String(val.to ?? 'None')}</td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
