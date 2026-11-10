import { useEffect, useMemo, useState, useCallback } from "react";
import Pagination from "../components/Pagination/Pagination";
import CustomDropdown from "../components/UI/CustomDropdown";
import Header from "../components/Header/header";
import { AuditLogsSkeleton } from "../components/UI/Skeleton";
import { useLiveRefresh } from "../utils/liveSync";
import ServerOfflineState from "../components/UI/ServerOfflineState";
import { API_BASE_URL } from "../utils/apiBase";
import { Activity, Plus, FileEdit, ShieldAlert, X, FileText, Award } from "lucide-react";

import {
    actionStyles,
    normalizeActionLabel,
    resolveLogContext,
    buildInDepthMessage,
    roleIdToName,
    stripEmojis,
    formatTimestamp,
    tryParseJson,
    toTitle,
    toArrayPayload,
} from "../utils/auditLogHelpers";

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setloading] = useState(true);

    // Comprehensive Lookups
    const [eventLookup, setEventLookup] = useState({});
    const [areaLookup, setAreaLookup] = useState({});
    const [criteriaLookup, setCriteriaLookup] = useState({});
    const [requirementLookup, setRequirementLookup] = useState({});
    const [officeLookup, setOfficeLookup] = useState({});
    const [userLookup, setUserLookup] = useState({});

    const [searchTerm, setSearchTerm] = useState("");
    const [actionFilter, setActionFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedLogId, setExpandedLogId] = useState(null);
    const itemsPerPage = 30;

    const preparedLogs = useMemo(() => {
        const lookups = { eventLookup, areaLookup, criteriaLookup, requirementLookup, officeLookup, userLookup };
        return logs.map((log) => {
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
    }, [logs, eventLookup, areaLookup, criteriaLookup, requirementLookup, officeLookup, userLookup]);

    const filteredLogs = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return preparedLogs.filter((log) => {
            const matchesAction = actionFilter === "all" || log.normalizedAction === actionFilter;
            if (!matchesAction) return false;
            if (!q) return true;

            const c = log.context;
            const haystack = [
                log.readableMessage,
                log.normalizedAction,
                log.displayname,
                log.rolename,
                c.officename,
                c.reqCode,
                c.reqDesc,
                c.critLabel,
                c.areaname,
                c.eventname,
                c.filename,
                log.Details,
            ]
                .map((v) => String(v || "").toLowerCase())
                .join(" ");

            return haystack.includes(q);
        });
    }, [preparedLogs, searchTerm, actionFilter]);

    const [serverTotalPages, setServerTotalPages] = useState(1);
    const [serverTotalCount, setServerTotalCount] = useState(0);
    const [serverStats, setServerStats] = useState({
        total: 0,
        created: 0,
        updated: 0,
        deletedAndAuth: 0
    });

    const stats = useMemo(() => {
        if (serverStats.total > 0) {
            return serverStats;
        }
        let created = 0, updated = 0, deleted = 0, auth = 0;
        preparedLogs.forEach(l => {
            if (l.normalizedAction === 'Created') created++;
            else if (l.normalizedAction === 'Updated') updated++;
            else if (l.normalizedAction === 'Deleted') deleted++;
            else if (['Login', 'Logout'].includes(l.normalizedAction)) auth++;
        });
        return { total: serverTotalCount || preparedLogs.length, created, updated, deletedAndAuth: deleted + auth };
    }, [serverStats, preparedLogs, serverTotalCount]);

    const totalPages = serverTotalPages;
    const visibleLogs = filteredLogs;

    const clearControls = () => {
        setSearchTerm("");
        setActionFilter("all");
    };

    const [serverError, setServerError] = useState(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const fetchLogs = useCallback(async (isRetry = false) => {
        try {
            if (isRetry) setIsRetrying(true);
            else setloading(true);
            setServerError(null);

            const token = localStorage.getItem("token");
            const res = await fetch(`${API_BASE_URL}/api/logs?page=${currentPage}&limit=${itemsPerPage}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch logs`);
            const data = await res.json();
            const logsArr = data.logs || [];
            setLogs(logsArr);
            if (data.totalPages) setServerTotalPages(data.totalPages);
            if (data.total !== undefined) setServerTotalCount(data.total);
            if (data.stats) {
                setServerStats({
                    total: data.stats.total ?? data.total ?? 0,
                    created: data.stats.created ?? 0,
                    updated: data.stats.updated ?? 0,
                    deletedAndAuth: data.stats.deletedAndAuth ?? ((data.stats.deleted || 0) + (data.stats.auth || 0))
                });
            }
            setServerError(null);
        } catch (err) {
            console.error("Failed to load audit logs:", err);
            setLogs([]);
            if (!err.response || err.message?.toLowerCase().includes('failed to fetch') || err.message?.toLowerCase().includes('network error')) {
                setServerError('Server Offline');
            } else {
                setServerError(err.message || 'Failed to load activity logs.');
            }
        } finally {
            setloading(false);
            setIsRetrying(false);
        }
    }, [currentPage]);

    // Fetch Logs on Demand when currentPage changes
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    // Live syncing on mutations / window focus
    useLiveRefresh(fetchLogs, { deps: [currentPage] });

    // Fetch All Tree Lookups in Parallel
    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                const [eventsRes, areasRes, criteriaRes, reqsRes, officesRes, usersRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/events`, { headers }).catch(() => null),
                    fetch(`${API_BASE_URL}/api/areas`, { headers }).catch(() => null),
                    fetch(`${API_BASE_URL}/api/criteria`, { headers }).catch(() => null),
                    fetch(`${API_BASE_URL}/api/requirements`, { headers }).catch(() => null),
                    fetch(`${API_BASE_URL}/api/offices`, { headers }).catch(() => null),
                    fetch(`${API_BASE_URL}/api/user`, { headers }).catch(() => null)
                ]);

                // 1. Events
                if (eventsRes?.ok) {
                    const payload = await eventsRes.json();
                    const arr = toArrayPayload(payload);
                    const map = {};
                    for (const item of arr) {
                        if (item?.eventid != null) {
                            map[String(item.eventid)] = {
                                eventname: item.eventname || "",
                                eventcode: item.eventcode || "",
                                Year: item.Year || ""
                            };
                        }
                    }
                    setEventLookup(map);
                }

                // 2. Areas
                if (areasRes?.ok) {
                    const payload = await areasRes.json();
                    const arr = toArrayPayload(payload);
                    const map = {};
                    for (const item of arr) {
                        if (item?.areaid != null) {
                            map[String(item.areaid)] = {
                                areaname: item.areaname || "",
                                eventid: item.eventid || null
                            };
                        }
                    }
                    setAreaLookup(map);
                }

                // 3. Criteria
                if (criteriaRes?.ok) {
                    const payload = await criteriaRes.json();
                    const arr = toArrayPayload(payload);
                    const map = {};
                    for (const item of arr) {
                        if (item?.criteriaid != null) {
                            map[String(item.criteriaid)] = {
                                criteriacode: item.criteriacode || "",
                                criterianame: item.criterianame || "",
                                areaid: item.areaid || null
                            };
                        }
                    }
                    setCriteriaLookup(map);
                }

                // 4. Requirements
                if (reqsRes?.ok) {
                    const payload = await reqsRes.json();
                    const arr = toArrayPayload(payload);
                    const map = {};
                    for (const item of arr) {
                        if (item?.requirementid != null) {
                            map[String(item.requirementid)] = {
                                requirementcode: item.requirementcode || "",
                                Description: item.Description || "",
                                criteriaid: item.criteriaid || null
                            };
                        }
                    }
                    setRequirementLookup(map);
                }

                // 5. Offices
                if (officesRes?.ok) {
                    const payload = await officesRes.json();
                    const arr = toArrayPayload(payload);
                    const map = {};
                    for (const item of arr) {
                        if (item?.officeid != null) {
                            map[String(item.officeid)] = {
                                officename: item.officename || "",
                                OfficeCode: item.OfficeCode || "",
                                eventid: item.eventid || null
                            };
                        }
                    }
                    setOfficeLookup(map);
                }

                // 6. Users
                if (usersRes?.ok) {
                    const payload = await usersRes.json();
                    const arr = toArrayPayload(payload?.users ? { data: payload.users } : payload);
                    const map = {};
                    for (const u of arr) {
                        if (u?.userid != null) {
                            const name = String(
                                u.FullName ||
                                `${u.firstname || ""}${u.middleinitial ? ` ${u.middleinitial}.` : ""} ${u.lastname || ""}`
                            ).replace(/\s+/g, " ").trim();
                            map[String(u.userid)] = name || u.Email || "User";
                        }
                    }
                    setUserLookup(map);
                }
            } catch (err) {
                console.error("Failed to load audit lookups:", err);
            }
        };

        fetchLookups();
    }, []);

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, []);

    const formatTimestamp = (timestamp) => {
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

    return (
        <div className="w-full h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-2 pb-1.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Audit Logs &amp; Security Trails</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Chronological immutable record of accreditation data modifications, file operations, and user logins.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 px-4 sm:px-6 pt-1.5 pb-1 sm:pb-1.5 flex flex-col gap-2 overflow-hidden">
                {/* Stat Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
                    <div className="rounded-xl border border-slate-200/90 bg-white py-2 px-3 shadow-2xs flex items-center justify-between hover:border-slate-300 transition">
                        <div>
                            <p className="text-[11px] font-semibold text-slate-500">Total Activities</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.total}</p>
                        </div>
                        <div className="h-8.5 w-8.5 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                            <Activity className="w-4 h-4 text-slate-700" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/30 py-2 px-3 shadow-2xs flex items-center justify-between hover:border-emerald-300 transition">
                        <div>
                            <p className="text-[11px] font-semibold text-emerald-800">Created Records</p>
                            <p className="text-xl font-bold text-emerald-700 mt-0.5">{stats.created}</p>
                        </div>
                        <div className="h-8.5 w-8.5 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                            <Plus className="w-4 h-4 text-emerald-700" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/30 py-2 px-3 shadow-2xs flex items-center justify-between hover:border-indigo-300 transition">
                        <div>
                            <p className="text-[11px] font-semibold text-indigo-800">Updated Records</p>
                            <p className="text-xl font-bold text-indigo-700 mt-0.5">{stats.updated}</p>
                        </div>
                        <div className="h-8.5 w-8.5 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                            <FileEdit className="w-4 h-4 text-indigo-700" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-rose-200/70 bg-rose-50/30 py-2 px-3 shadow-2xs flex items-center justify-between hover:border-rose-300 transition">
                        <div>
                            <p className="text-[11px] font-semibold text-rose-800">Security & Deletions</p>
                            <p className="text-xl font-bold text-rose-700 mt-0.5">{stats.deletedAndAuth}</p>
                        </div>
                        <div className="h-8.5 w-8.5 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-sm shadow-2xs">
                            <ShieldAlert className="w-4 h-4 text-rose-700" />
                        </div>
                    </div>
                </div>

                {/* Main Card Container */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/90 flex flex-col overflow-hidden flex-1 min-h-0">
                    {/* Filter Toolbar */}
                    <div className="px-4 py-1.5 border-b border-slate-200/90 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Activity History</h2>
                            <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                                {filteredLogs.length} record(s)
                            </span>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap justify-start sm:justify-end">
                            {/* Search Input */}
                            <div className="relative w-full sm:w-64">
                                <svg
                                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Search activity, user, office..."
                                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs flex items-center justify-center"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Action Filter Dropdown */}
                            <CustomDropdown
                                value={actionFilter}
                                onChange={setActionFilter}
                                options={[
                                    { value: 'all', label: 'All Actions' },
                                    { value: 'Created', label: 'Created' },
                                    { value: 'Updated', label: 'Updated' },
                                    { value: 'Deleted', label: 'Deleted' },
                                    { value: 'Viewed', label: 'Viewed' },
                                    { value: 'Login', label: 'Login' },
                                    { value: 'Logout', label: 'Logout' },
                                ]}
                                minWidth="min-w-[130px]"
                                size="sm"
                            />

                            {/* Reset Controls Button */}
                            {(searchTerm || actionFilter !== "all") && (
                                <button
                                    onClick={clearControls}
                                    title="Clear All Filters"
                                    className="flex h-8 px-2.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex-1 min-h-0 overflow-y-auto app-list-scroll">
                            <AuditLogsSkeleton count={12} />
                        </div>
                    ) : serverError ? (
                        <ServerOfflineState
                            onRetry={() => fetchLogs(true)}
                            isRetrying={isRetrying}
                            title={serverError === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Logs'}
                            message={serverError === 'Server Offline'
                                ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.'
                                : serverError}
                        />
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex-1 w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-center bg-white/70 animate-fadeIn my-auto">
                            <div className="h-14 w-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3 text-xl">
                                <FileText className="w-7 h-7 text-slate-400" />
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">No Activity Logs Found</h3>
                            <p className="text-xs text-slate-500 max-w-sm mb-3">
                                {logs.length === 0 ? 'No activity logs have been recorded in the database yet.' : 'No logs match your search term or action filter.'}
                            </p>
                            {(searchTerm || actionFilter !== "all") && (
                                <button
                                    type="button"
                                    onClick={clearControls}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                >
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-0 [contain:content] app-list-scroll pb-10">
                            {visibleLogs.map((log) => {
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
                                        key={log.logid}
                                        className="group transition-colors hover:bg-slate-50/80"
                                    >
                                        <div
                                            className="flex items-center justify-between px-4 py-2 text-xs cursor-pointer gap-3"
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
                                                                {ctx.reqCode} {ctx.reqDesc ? `— ${ctx.reqDesc}` : ''}
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
                                                                                    <td className="px-3 py-1.5 font-semibold text-slate-700">{toTitle(field)}</td>
                                                                                    <td className="px-3 py-1.5 text-slate-500" colSpan={2}>{String(val)}</td>
                                                                                </tr>
                                                                            );
                                                                        }
                                                                        const from = val.from === null || val.from === undefined ? '(none)' : String(val.from);
                                                                        const to = val.to === null || val.to === undefined ? '(none)' : String(val.to);
                                                                        return (
                                                                            <tr key={field}>
                                                                                <td className="px-3 py-1.5 font-semibold text-slate-700">{toTitle(field)}</td>
                                                                                <td className="px-3 py-1.5 text-rose-700 bg-rose-50/50 font-mono text-[10px] max-w-[200px] truncate" title={from}>{from}</td>
                                                                                <td className="px-3 py-1.5 text-emerald-700 bg-emerald-50/50 font-mono text-[10px] max-w-[200px] truncate" title={to}>{to}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Deleted Items List */}
                                                {(() => {
                                                    const d = ctx.rawDetails || {};
                                                    const deleted =
                                                        (Array.isArray(d.deletedRequirements) && d.deletedRequirements.length > 0 && d.deletedRequirements) ||
                                                        (Array.isArray(d.deletedCriteria) && d.deletedCriteria.length > 0 && d.deletedCriteria) ||
                                                        (Array.isArray(d.deletedNames) && d.deletedNames.length > 0 && d.deletedNames.map(n => ({ name: n }))) ||
                                                        null;
                                                    if (!deleted) return null;
                                                    const isReq = Array.isArray(d.deletedRequirements) && d.deletedRequirements.length > 0;
                                                    const isCrit = Array.isArray(d.deletedCriteria) && d.deletedCriteria.length > 0;
                                                    return (
                                                        <div className="mt-3 rounded-xl border border-rose-200/80 bg-white overflow-hidden shadow-2xs">
                                                            <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                                                                Deleted Items ({deleted.length})
                                                            </div>
                                                            <div className="divide-y divide-slate-100">
                                                                {deleted.map((item, idx) => {
                                                                    if (isReq) {
                                                                        return (
                                                                            <div key={idx} className="px-3 py-1.5 flex items-start gap-2">
                                                                                <span className="font-mono font-bold text-rose-700 text-[10px] shrink-0 mt-0.5">{item.requirementcode || `#${idx + 1}`}</span>
                                                                                <span className="text-slate-700">{item.Description || '(no description)'}</span>
                                                                                {item.eventname && <span className="ml-auto text-slate-400 text-[10px] shrink-0">{item.eventname}</span>}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    if (isCrit) {
                                                                        return (
                                                                            <div key={idx} className="px-3 py-1.5 flex items-start gap-2">
                                                                                <span className="font-mono font-bold text-rose-700 text-[10px] shrink-0 mt-0.5">{item.criteriacode || `#${idx + 1}`}</span>
                                                                                <span className="text-slate-700">{item.criterianame || '(no name)'}</span>
                                                                                {item.eventname && <span className="ml-auto text-slate-400 text-[10px] shrink-0">{item.eventname}</span>}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <div key={idx} className="px-3 py-1.5 text-slate-700">
                                                                            {item.name || String(item)}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Fixed bottom pagination — same position as all other pages */}
            {!loading && filteredLogs.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    fixed={true}
                    showWhenSinglePage={false}
                />
            )}
        </div>
    );
}
