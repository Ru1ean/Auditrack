import React, { useState, useEffect, useMemo } from "react";
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle2,
    GraduationCap,
    Building2,
    ShieldCheck,
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    Users,
    RefreshCw,
    X,
    LayoutGrid,
    LayoutList,
    FileText,
    Layers,
    Filter,
    CalendarClock,
} from "lucide-react";
import CustomDropdown from "../UI/CustomDropdown";
import SmartUserAvatar from "../UI/SmartUserAvatar";
import { getDeadlineInfo } from "../../utils/deadlineHelpers";

const sortOptions = [
    { value: "lowest_compliance", label: "Lowest Compliance" },
    { value: "highest_deficiencies", label: "Most Deficiencies" },
    { value: "name_asc", label: "Name (A-Z)" },
];

export default function DeficiencyTracker({
    offices = [],
    events = [],
    complianceData = [],
    requirements = [],
    criteria = [],
    areas = [],
    users = [],
    onInspectOffice,
    onRefresh,
    isAdmin = false,
}) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedEventFilter, setSelectedEventFilter] = useState("");
    const [mainViewMode, setMainViewMode] = useState("standards"); // 'standards' | 'offices'
    
    // Standards table filters
    const [standardStatusFilter, setStandardStatusFilter] = useState("all"); // 'all' | 'not_complied' | 'partial' | 'complied'
    
    // Offices card view filters
    const [activeTab, setActiveTab] = useState("deficiencies"); // 'deficiencies' | 'critical' | 'moderate' | 'academic' | 'non_academic'
    const [sortBy, setSortBy] = useState("lowest_compliance"); // 'lowest_compliance' | 'highest_deficiencies' | 'name_asc'
    const [officeCardViewMode, setOfficeCardViewMode] = useState("grid"); // 'grid' | 'table'

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPageStandards = 10;
    const itemsPerPageOffices = 6;

    // Automatically select the first available event
    useEffect(() => {
        if (events && events.length > 0) {
            const hasMatch = events.some((ev) => String(ev.eventid) === String(selectedEventFilter));
            if (!selectedEventFilter || !hasMatch) {
                setSelectedEventFilter(String(events[0].eventid));
            }
        }
    }, [events, selectedEventFilter]);

    // Build event lookup map
    const eventMap = useMemo(() => {
        const map = {};
        for (const ev of events) {
            if (ev?.eventid != null) {
                map[String(ev.eventid)] = ev;
            }
        }
        return map;
    }, [events]);

    // Build compliance stats by office fallback
    const complianceByOffice = useMemo(() => {
        const map = {};
        for (const row of complianceData) {
            const officeid = String(row?.officeid ?? "");
            if (!officeid) continue;
            if (!map[officeid]) {
                map[officeid] = { total: 0, compiled: 0, partial: 0, notCompiled: 0 };
            }
            map[officeid].total += 1;
            const st = Number(row?.Status);
            if (st === 5) map[officeid].compiled += 1;
            else if (st === 4) map[officeid].partial += 1;
            else map[officeid].notCompiled += 1;
        }
        return map;
    }, [complianceData]);

    // Process and enrich all offices
    const enrichedOffices = useMemo(() => {
        return offices.map((office) => {
            const officeid = String(office?.id ?? office?.officeid ?? "");
            const eventid = String(office?.eventid ?? office?.eventid ?? "");
            const eventObj = eventMap[eventid] || null;

            const isAcademic = (() => {
                const entitytypeid = Number(office?.entitytypeid ?? office?.EntityTypeID);
                if (entitytypeid === 1) return true;
                if (entitytypeid === 2) return false;

                const typeStr = String(
                    office?.category_name ||
                    office?.office_type_name ||
                    office?.typename ||
                    office?.office_type ||
                    office?.officeTypeName ||
                    ""
                ).trim().toLowerCase();

                if (/\bnon\b|non-?academic|not\s+academic|administrative|admin|support|staff|services/i.test(typeStr)) {
                    return false;
                }
                if (/\bacademic\b|program|course|curriculum|department|college|school|faculty/i.test(typeStr)) {
                    return true;
                }
                return false;
            })();

            const categoryName = isAcademic ? "Academic Program" : "Non-Academic Office";

            const eventname =
                eventObj?.eventname ||
                office?.eventname ||
                (eventid ? `Event #${eventid}` : "Unassigned Event");

            const eventcode = eventObj?.eventcode || office?.eventcode || "";

            const fallback = complianceByOffice[officeid] || { total: 0, compiled: 0, partial: 0, notCompiled: 0 };
            const totalrequirements = Number(office?.totalrequirements ?? fallback.total);
            const compliedcount = Number(office?.compliedcount ?? fallback.compiled);
            const partiallycompliedcount = Number(office?.partiallycompliedcount ?? fallback.partial);
            const notcompliedcount = Number(office?.notcompliedcount ?? fallback.notCompiled);

            let percent = 0;
            if (office?.compliancepercent !== undefined && office?.compliancepercent !== null) {
                percent = Math.min(100, Math.max(0, Number(office.compliancepercent)));
            } else if (totalrequirements > 0) {
                percent = Math.min(100, Math.max(0, ((compliedcount * 100) + (partiallycompliedcount * 50)) / totalrequirements));
            }

            const deficienciesCount = notcompliedcount + partiallycompliedcount;

            let severity = "critical";
            if (percent === 100 && totalrequirements > 0) {
                severity = "compliant";
            } else if (percent >= 80) {
                severity = "minor";
            } else if (percent >= 50) {
                severity = "moderate";
            } else {
                severity = "critical";
            }

            let headsList = [];
            if (Array.isArray(office.heads) && office.heads.length > 0) {
                headsList = office.heads;
            } else if (office.head_name && office.head_name !== "Unassigned") {
                const names = String(office.head_name).split(",").map((n) => n.trim()).filter(Boolean);
                headsList = names.map((name, idx) => ({
                    headid: idx + 1,
                    full_name: name,
                    Position: office.position || "",
                    profilepic: idx === 0 ? office.head_profile_pic : null,
                }));
            }

            return {
                ...office,
                officeid,
                officename: office?.officename || `Office #${officeid}`,
                departmentName: office?.department_name || null,
                isAcademic,
                categoryName,
                eventid,
                eventname,
                eventcode,
                totalrequirements,
                compliedcount,
                partiallycompliedcount,
                notcompliedcount,
                deficienciesCount,
                percent,
                severity,
                headsList,
            };
        });
    }, [offices, eventMap, complianceByOffice]);

    // Units belonging to the currently selected event
    const eventFilteredOffices = useMemo(() => {
        if (!selectedEventFilter) return enrichedOffices;
        return enrichedOffices.filter((unit) => String(unit.eventid) === String(selectedEventFilter));
    }, [enrichedOffices, selectedEventFilter]);

    // Requirements lookup map
    const requirementMap = useMemo(() => {
        const map = {};
        for (const req of requirements) {
            const reqId = String(req.requirementid ?? req.id ?? "");
            if (reqId) map[reqId] = req;
        }
        return map;
    }, [requirements]);

    // Offices lookup map
    const officeMap = useMemo(() => {
        const map = {};
        for (const off of enrichedOffices) {
            const offId = String(off.officeid ?? off.id ?? "");
            if (offId) map[offId] = off;
        }
        return map;
    }, [enrichedOffices]);

    // Criteria lookup map
    const criteriaMap = useMemo(() => {
        const map = {};
        for (const c of criteria) {
            const cid = String(c.criteriaid ?? c.id ?? "");
            if (cid) map[cid] = c;
        }
        return map;
    }, [criteria]);

    // Areas lookup map
    const areaMap = useMemo(() => {
        const map = {};
        for (const a of areas) {
            const aid = String(a.areaid ?? a.id ?? "");
            if (aid) map[aid] = a;
        }
        return map;
    }, [areas]);

    // Build Standard-by-Standard rows for the selected event (overall standards aggregated across all programs/offices under the event)
    const standardRows = useMemo(() => {
        if (!selectedEventFilter && events.length === 0) return [];

        // 1. Offices belonging to current event
        const eventOffices = eventFilteredOffices;
        const eventOfficeIdSet = new Set(eventOffices.map((o) => String(o.officeid)));

        // 2. Criteria belonging to this event
        const eventCriteriaIds = new Set();
        for (const c of criteria) {
            if (String(c.eventid) === String(selectedEventFilter)) {
                eventCriteriaIds.add(String(c.criteriaid ?? c.id ?? ""));
            }
        }

        // 3. Unique requirement IDs assigned to offices under this event
        const reqIdSet = new Set();

        for (const row of complianceData) {
            const officeid = String(row?.officeid ?? "");
            const reqId = String(row?.requirementid ?? "");
            if (reqId && eventOfficeIdSet.has(officeid)) {
                reqIdSet.add(reqId);
            }
        }

        if (reqIdSet.size === 0) return [];

        // Compliance lookup by requirement -> officeid -> row
        const complianceByReqAndOffice = {};
        for (const row of complianceData) {
            const reqId = String(row?.requirementid ?? "");
            const officeid = String(row?.officeid ?? "");
            if (!reqId || !officeid) continue;
            if (!complianceByReqAndOffice[reqId]) {
                complianceByReqAndOffice[reqId] = {};
            }
            complianceByReqAndOffice[reqId][officeid] = row;
        }

        const rows = [];

        for (const reqId of reqIdSet) {
            const req = requirementMap[reqId] || {};
            const critId = String(req.criteriaid ?? "");
            const crit = criteriaMap[critId] || {};
            const parentCrit = crit.parentcriteriaid ? (criteriaMap[String(crit.parentcriteriaid)] || {}) : {};
            const areaId = String(crit.areaid ?? parentCrit.areaid ?? req.areaid ?? "");
            const area = areaMap[areaId] || {};

            const reqCode = req.requirementcode || req.req_code || req.code || `REQ-${reqId}`;
            const reqDesc = req.description || req.Description || req.RequirementName || req.requirementname || `Standard #${reqId}`;
            const criteriaCode = crit.criteriacode || crit.criterianame || req.criteriacode || "";
            const areaCode = area.areaname || area.areacode || req.areaname || req.areacode || (areaId ? `Area ${areaId}` : "");

            // Build evaluated offices list for this requirement
            const officesList = [];
            for (const office of eventOffices) {
                const offId = String(office.officeid);
                const compRecord = complianceByReqAndOffice[reqId]?.[offId];
                if (compRecord) {
                    const statusNum = Number(compRecord.Status ?? 3);
                    officesList.push({
                        office,
                        statusNum,
                        comments: compRecord.comments || "",
                    });
                }
            }

            // Only evaluate offices that actually have this requirement assigned
            if (officesList.length === 0) continue;
            const evaluatedList = officesList;

            const totalUnits = evaluatedList.length;
            let compliedCount = 0;
            let partialCount = 0;
            let notCompliedCount = 0;

            for (const item of evaluatedList) {
                if (item.statusNum === 5) compliedCount += 1;
                else if (item.statusNum === 4) partialCount += 1;
                else notCompliedCount += 1;
            }

            let percent = 0;
            if (totalUnits > 0) {
                percent = Math.min(100, Math.max(0, Math.round(((compliedCount * 100) + (partialCount * 50)) / totalUnits)));
            }

            let statusKey = "not_complied";
            let statusLabel = "Not Complied";
            let statusBadgeClass = "bg-rose-50 text-rose-700 border-rose-200/80";

            if (totalUnits > 0 && compliedCount === totalUnits) {
                statusKey = "complied";
                statusLabel = "Fully Complied";
                statusBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200/80";
            } else if (compliedCount > 0 || partialCount > 0) {
                statusKey = "partial";
                statusLabel = "Partially Complied";
                statusBadgeClass = "bg-amber-50 text-amber-700 border-amber-200/80";
            }

            const hasAcademic = evaluatedList.some((item) => item.office?.isAcademic);
            const hasNonAcademic = evaluatedList.some((item) => !item.office?.isAcademic);
            const firstDeficientOffice = evaluatedList.find((item) => item.statusNum !== 5)?.office || evaluatedList[0]?.office || null;

            rows.push({
                id: `standard-${reqId}`,
                reqId,
                reqCode,
                reqDesc,
                criteriaCode,
                areaCode,
                totalUnits,
                compliedCount,
                partialCount,
                notCompliedCount,
                percent,
                statusKey,
                statusLabel,
                statusBadgeClass,
                officesList: evaluatedList,
                hasAcademic,
                hasNonAcademic,
                firstDeficientOffice,
            });
        }

        // Natural sort by standard code (e.g. A.1, A.2, A.10, B.1...)
        rows.sort((a, b) => a.reqCode.localeCompare(b.reqCode, undefined, { numeric: true, sensitivity: "base" }));

        return rows;
    }, [selectedEventFilter, events, eventFilteredOffices, criteria, requirements, complianceData, requirementMap, criteriaMap, areaMap]);

    // Filter standard rows based on search and status filter
    const filteredStandardRows = useMemo(() => {
        return standardRows.filter((row) => {
            // Status filter
            if (standardStatusFilter === "not_complied" && row.statusKey !== "not_complied") return false;
            if (standardStatusFilter === "partial" && row.statusKey !== "partial") return false;
            if (standardStatusFilter === "complied" && row.statusKey !== "complied") return false;

            // Search term
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchReqCode = row.reqCode.toLowerCase().includes(term);
                const matchReqDesc = row.reqDesc.toLowerCase().includes(term);
                const matchCriteria = row.criteriaCode.toLowerCase().includes(term);
                const matchArea = row.areaCode.toLowerCase().includes(term);
                const matchStatus = row.statusLabel.toLowerCase().includes(term);
                const matchOffices = row.officesList.some((o) => (o.office?.officename || "").toLowerCase().includes(term));

                if (
                    !matchReqCode &&
                    !matchReqDesc &&
                    !matchCriteria &&
                    !matchArea &&
                    !matchStatus &&
                    !matchOffices
                ) {
                    return false;
                }
            }

            return true;
        });
    }, [standardRows, standardStatusFilter, searchTerm]);

    // High-level KPI metrics for Standards view
    const standardKPIs = useMemo(() => {
        let total = standardRows.length;
        let notComplied = 0;
        let partial = 0;
        let complied = 0;

        for (const row of standardRows) {
            if (row.statusKey === "complied") complied += 1;
            else if (row.statusKey === "partial") partial += 1;
            else notComplied += 1;
        }

        return { total, notComplied, partial, complied };
    }, [standardRows]);

    // High-level KPI metrics for Offices view
    const kpis = useMemo(() => {
        let criticalCount = 0;
        let moderateCount = 0;
        let compliantCount = 0;
        let totalDeficientItems = 0;
        let academicDeficientCount = 0;
        let nonAcademicDeficientCount = 0;

        for (const unit of eventFilteredOffices) {
            if (unit.totalrequirements === 0) continue;
            if (unit.percent === 100) {
                compliantCount += 1;
            } else {
                if (unit.percent < 50) criticalCount += 1;
                else moderateCount += 1;

                totalDeficientItems += unit.deficienciesCount;

                if (unit.isAcademic) academicDeficientCount += 1;
                else nonAcademicDeficientCount += 1;
            }
        }

        const totalUnits = eventFilteredOffices.length;
        const deficientUnits = criticalCount + moderateCount;

        return {
            totalUnits,
            deficientUnits,
            criticalCount,
            moderateCount,
            compliantCount,
            totalDeficientItems,
            academicDeficientCount,
            nonAcademicDeficientCount,
        };
    }, [eventFilteredOffices]);

    // Filter and Sort offices for Office Card View
    const filteredAndSortedOffices = useMemo(() => {
        let result = eventFilteredOffices.filter((unit) => {
            if (activeTab === "deficiencies") {
                if (unit.totalrequirements === 0 || unit.percent === 100) return false;
            } else if (activeTab === "critical") {
                if (unit.totalrequirements === 0 || unit.percent >= 50) return false;
            } else if (activeTab === "moderate") {
                if (unit.totalrequirements === 0 || unit.percent < 50 || unit.percent >= 100) return false;
            } else if (activeTab === "academic") {
                if (!unit.isAcademic || unit.totalrequirements === 0 || unit.percent === 100) return false;
            } else if (activeTab === "non_academic") {
                if (unit.isAcademic || unit.totalrequirements === 0 || unit.percent === 100) return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const matchName = unit.officename.toLowerCase().includes(term);
                const matchEvent = unit.eventname.toLowerCase().includes(term) || unit.eventcode.toLowerCase().includes(term);
                const matchDept = unit.departmentName ? unit.departmentName.toLowerCase().includes(term) : false;
                const matchHead = unit.headsList.some((h) => (h.full_name || "").toLowerCase().includes(term));
                if (!matchName && !matchEvent && !matchDept && !matchHead) return false;
            }

            return true;
        });

        result.sort((a, b) => {
            if (sortBy === "lowest_compliance") {
                if (a.percent !== b.percent) return a.percent - b.percent;
                return b.deficienciesCount - a.deficienciesCount;
            }
            if (sortBy === "highest_deficiencies") {
                if (a.deficienciesCount !== b.deficienciesCount) return b.deficienciesCount - a.deficienciesCount;
                return a.percent - b.percent;
            }
            if (sortBy === "name_asc") {
                return a.officename.localeCompare(b.officename);
            }
            return 0;
        });

        return result;
    }, [eventFilteredOffices, activeTab, searchTerm, sortBy]);

    // Pagination calculations
    const activeItemsPerPage = mainViewMode === "standards" ? itemsPerPageStandards : itemsPerPageOffices;
    const activeTotalItems = mainViewMode === "standards" ? filteredStandardRows.length : filteredAndSortedOffices.length;
    const totalPages = Math.max(1, Math.ceil(activeTotalItems / activeItemsPerPage));

    const paginatedStandardRows = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPageStandards;
        return filteredStandardRows.slice(start, start + itemsPerPageStandards);
    }, [filteredStandardRows, currentPage]);

    const paginatedOffices = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPageOffices;
        return filteredAndSortedOffices.slice(start, start + itemsPerPageOffices);
    }, [filteredAndSortedOffices, currentPage]);

    const handleEventFilterChange = (val) => {
        setSelectedEventFilter(val);
        setCurrentPage(1);
    };

    const renderPersonnelAvatar = (head, size = "md") => {
        const name = head?.full_name || `${head?.firstname || ""} ${head?.lastname || ""}`.trim() || "Head";
        const dimClass = size === "sm" ? "h-6 w-6" : "h-7 w-7";
        const textClass = size === "sm" ? "text-[10px] font-bold" : "text-xs font-bold";

        return (
            <div key={head.headid || head.userid || name} className="group relative inline-block shrink-0">
                <SmartUserAvatar
                    user={head}
                    fullName={name}
                    size={dimClass}
                    textSize={textClass}
                    ring="border-2 border-white shadow-xs"
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                    <p className="font-semibold">{name}</p>
                    {head.Position && <p className="text-[10px] text-slate-300">{head.Position}</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all">
            {/* Top Header & Main Mode Toggle Switcher */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-100 pb-4">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900">
                            {mainViewMode === "standards" ? "Detailed Standards Compliance Tracker" : "Programs & Offices Compliance Tracker"}
                        </h2>
                        {standardKPIs.notComplied > 0 && mainViewMode === "standards" && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                                <AlertTriangle size={11} className="shrink-0" />
                                {standardKPIs.notComplied} {standardKPIs.notComplied === 1 ? "Deficient Standard" : "Deficient Standards"}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {mainViewMode === "standards"
                            ? "Standard-by-standard readiness across accreditation areas and assigned offices"
                            : "Unit-level compliance scores and deficiency breakdown across programs and offices"}
                    </p>
                </div>

                {/* Right Actions: View Mode Switcher + Accreditation Dropdown + Deadline Badge */}
                <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-center">
                    <div className="inline-flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200/80">
                        <button
                            type="button"
                            onClick={() => {
                                setMainViewMode("standards");
                                setCurrentPage(1);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                mainViewMode === "standards"
                                    ? "bg-white text-blue-600 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <FileText size={13} />
                            <span>Standards Matrix</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMainViewMode("offices");
                                setCurrentPage(1);
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                                mainViewMode === "offices"
                                    ? "bg-white text-blue-600 shadow-2xs"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            <Building2 size={13} />
                            <span>Programs &amp; Offices</span>
                        </button>
                    </div>

                    {events.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <CustomDropdown
                                value={selectedEventFilter || String(events[0]?.eventid || "")}
                                onChange={(val) => handleEventFilterChange(String(val))}
                                options={events.map((ev) => ({
                                    value: String(ev.eventid),
                                    label: ev.eventcode && ev.eventcode !== '-' ? ev.eventcode : ev.eventname,
                                    dot: "bg-blue-500",
                                }))}
                                minWidth="min-w-[155px]"
                                size="sm"
                            />
                            {(() => {
                                const selectedEv = events.find(ev => String(ev.eventid) === String(selectedEventFilter || events[0]?.eventid));
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
            </div>

            {/* Unified Toolbar: Section Badge + Search & Status/Sort Filter */}
            <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        {mainViewMode === "standards" ? "Standards List" : "Units & Programs"}
                    </span>
                    <span className="rounded-full bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {mainViewMode === "standards" ? `${filteredStandardRows.length} standard(s)` : `${filteredAndSortedOffices.length} unit(s)`}
                    </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
                    <div className="relative w-full sm:w-72 md:w-80">
                        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder={mainViewMode === "standards" ? "Search code, standard title, or office..." : "Search program, office, or personnel..."}
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-8 text-xs text-slate-800 placeholder-slate-400 transition focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none hover:border-slate-300 shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {mainViewMode === "standards" ? (
                        <CustomDropdown
                            value={standardStatusFilter}
                            onChange={(val) => {
                                setStandardStatusFilter(val);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "all", label: `All Statuses (${standardKPIs.total})`, dot: "bg-blue-500" },
                                { value: "not_complied", label: `Not Complied (${standardKPIs.notComplied})`, dot: "bg-rose-500" },
                                { value: "partial", label: `Partially Complied (${standardKPIs.partial})`, dot: "bg-amber-500" },
                                { value: "complied", label: `Fully Complied (${standardKPIs.complied})`, dot: "bg-emerald-500" },
                            ]}
                            minWidth="min-w-[160px]"
                            size="sm"
                        />
                    ) : (
                        <CustomDropdown
                            options={sortOptions}
                            value={sortBy}
                            onChange={(val) => setSortBy(val)}
                            minWidth="min-w-[160px]"
                            size="sm"
                        />
                    )}
                </div>
            </div>

            {/* VIEW MODE 1: STANDARD-BY-STANDARD MATRIX */}
            {mainViewMode === "standards" && (
                <div className="mt-4 space-y-4">
                    {/* Restrained KPI Filter Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setStandardStatusFilter("all");
                                setCurrentPage(1);
                            }}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                standardStatusFilter === "all"
                                    ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total Standards</span>
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-extrabold tracking-tight text-slate-900">{standardKPIs.total}</span>
                                <span className="text-[11px] text-slate-400">in event</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStandardStatusFilter("not_complied");
                                setCurrentPage(1);
                            }}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                standardStatusFilter === "not_complied"
                                    ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Not Complied</span>
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-extrabold tracking-tight text-rose-600">{standardKPIs.notComplied}</span>
                                <span className="text-[11px] text-slate-400">needs evidence</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStandardStatusFilter("partial");
                                setCurrentPage(1);
                            }}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                standardStatusFilter === "partial"
                                    ? "border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Partially Complied</span>
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-extrabold tracking-tight text-amber-600">{standardKPIs.partial}</span>
                                <span className="text-[11px] text-slate-400">in progress</span>
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setStandardStatusFilter("complied");
                                setCurrentPage(1);
                            }}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                standardStatusFilter === "complied"
                                    ? "border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Fully Complied</span>
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            </div>
                            <div className="mt-1 flex items-baseline gap-2">
                                <span className="text-2xl font-extrabold tracking-tight text-emerald-600">{standardKPIs.complied}</span>
                                <span className="text-[11px] text-slate-400">verified</span>
                            </div>
                        </button>
                    </div>

                    {/* Standard-by-Standard Data Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs text-slate-700">
                            <thead className="bg-slate-50/90 border-b border-slate-200 font-semibold uppercase tracking-wider text-[11px] text-slate-500">
                                <tr>
                                    <th className="px-4 py-3 w-28">Code</th>
                                    <th className="px-4 py-3">Standard Title &amp; Scope</th>
                                    <th className="px-4 py-3 w-56">Program / Office</th>
                                    <th className="px-4 py-3 w-44">Progress</th>
                                    <th className="px-4 py-3 w-40">Status</th>
                                    <th className="px-4 py-3 w-24 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {paginatedStandardRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                                            No standards found matching the current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedStandardRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Standard Code */}
                                            <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap align-middle">
                                                <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200/70">
                                                    {row.reqCode}
                                                </span>
                                            </td>

                                            {/* Standard Title & Scope */}
                                            <td className="px-4 py-3.5 min-w-[240px] align-middle">
                                                <p className="font-semibold text-slate-900 line-clamp-2 leading-snug" title={row.reqDesc}>
                                                    {row.reqDesc}
                                                </p>
                                                {(row.criteriaCode || row.areaCode) && (
                                                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                        {row.areaCode && <span className="font-medium text-slate-600">{row.areaCode}</span>}
                                                        {row.areaCode && row.criteriaCode && <span className="mx-1 text-slate-300">&bull;</span>}
                                                        {row.criteriaCode && <span>{row.criteriaCode}</span>}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Program / Office */}
                                            <td className="px-4 py-3.5 min-w-[180px] align-middle">
                                                {row.officesList.length === 1 ? (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-semibold text-slate-900 truncate max-w-[140px]" title={row.officesList[0].office?.officename}>
                                                            {row.officesList[0].office?.officename}
                                                        </span>
                                                        <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                                            row.officesList[0].office?.isAcademic
                                                                ? "bg-blue-50 text-blue-700 border-blue-200/60"
                                                                : "bg-slate-100 text-slate-600 border border-slate-200"
                                                        }`}>
                                                            {row.officesList[0].office?.isAcademic ? "Academic" : "Non-Academic"}
                                                        </span>
                                                    </div>
                                                ) : row.officesList.length > 1 ? (
                                                    <div>
                                                        <p className="font-semibold text-slate-900 text-xs">
                                                            {row.officesList.length} Units Evaluated
                                                        </p>
                                                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[200px]" title={row.officesList.map((o) => o.office?.officename).filter(Boolean).join(", ")}>
                                                            {row.officesList.slice(0, 2).map((o) => o.office?.officename).filter(Boolean).join(", ")}
                                                            {row.officesList.length > 2 && ` +${row.officesList.length - 2} more`}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">All Units</span>
                                                )}
                                            </td>

                                            {/* Progress */}
                                            <td className="px-4 py-3.5 min-w-[150px] align-middle">
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <span className="text-xs font-bold text-slate-800">
                                                        {row.percent}%
                                                    </span>
                                                    <span className="text-[11px] font-medium text-slate-500">
                                                        {row.compliedCount}/{row.totalUnits} met
                                                    </span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-300 ${
                                                            row.percent === 100
                                                                ? "bg-emerald-500"
                                                                : row.percent >= 50
                                                                ? "bg-amber-500"
                                                                : row.percent > 0
                                                                ? "bg-amber-400"
                                                                : "bg-rose-400"
                                                        }`}
                                                        style={{ width: `${Math.max(row.percent, row.percent === 0 ? 0 : 5)}%` }}
                                                    />
                                                </div>
                                            </td>

                                            {/* Compliance Status */}
                                            <td className="px-4 py-3.5 whitespace-nowrap align-middle">
                                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${row.statusBadgeClass}`}>
                                                    {row.statusKey === "complied" && <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />}
                                                    {row.statusKey === "partial" && <AlertCircle size={12} className="text-amber-600 shrink-0" />}
                                                    {row.statusKey === "not_complied" && <AlertTriangle size={12} className="text-rose-600 shrink-0" />}
                                                    <span>{row.statusLabel}</span>
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="px-4 py-3.5 whitespace-nowrap text-right align-middle">
                                                {row.firstDeficientOffice && onInspectOffice ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onInspectOffice(row.firstDeficientOffice)}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-200 transition cursor-pointer"
                                                    >
                                                        <Eye size={12} />
                                                        <span>Inspect</span>
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW MODE 2: PROGRAM & OFFICE CARDS VIEW */}
            {mainViewMode === "offices" && (
                <div className="mt-4 space-y-4">
                    {/* Restrained Stat Filter Cards - 5 Columns */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab("deficiencies")}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                activeTab === "deficiencies"
                                    ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">All Deficiencies</span>
                                <span className="h-2 w-2 rounded-full bg-blue-500" />
                            </div>
                            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{kpis.deficientUnits}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{kpis.totalDeficientItems} unmet items</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("critical")}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                activeTab === "critical"
                                    ? "border-rose-500 bg-rose-50/30 ring-2 ring-rose-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Critical (&lt;50%)</span>
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                            </div>
                            <p className="mt-1 text-2xl font-extrabold tracking-tight text-rose-600">{kpis.criticalCount}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Urgent action</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("moderate")}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                activeTab === "moderate"
                                    ? "border-amber-500 bg-amber-50/30 ring-2 ring-amber-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">In Progress (50-99%)</span>
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                            </div>
                            <p className="mt-1 text-2xl font-extrabold tracking-tight text-amber-600">{kpis.moderateCount}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Near completion</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("academic")}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                activeTab === "academic"
                                    ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Academic Programs</span>
                                <GraduationCap size={14} className="text-slate-400" />
                            </div>
                            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{kpis.academicDeficientCount}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Deficient programs</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab("non_academic")}
                            className={`text-left cursor-pointer rounded-xl border p-3.5 transition-all ${
                                activeTab === "non_academic"
                                    ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-500/15"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Non-Academic</span>
                                <Building2 size={14} className="text-slate-400" />
                            </div>
                            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{kpis.nonAcademicDeficientCount}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">Deficient offices</p>
                        </button>
                    </div>

                    {/* Office Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paginatedOffices.length === 0 ? (
                            <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                                No programs or offices found matching criteria.
                            </div>
                        ) : (
                            paginatedOffices.map((unit) => (
                                <div
                                    key={unit.officeid}
                                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-slate-300 hover:shadow-md flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 ${
                                                    unit.isAcademic
                                                        ? "bg-blue-100 text-blue-800"
                                                        : "bg-teal-100 text-teal-800"
                                                }`}>
                                                    {unit.categoryName}
                                                </span>
                                                <h3 className="font-bold text-slate-900 text-sm line-clamp-2" title={unit.officename}>
                                                    {unit.officename}
                                                </h3>
                                                {unit.departmentName && (
                                                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{unit.departmentName}</p>
                                                )}
                                            </div>
                                            <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-bold text-slate-800">
                                                {unit.totalrequirements === 0 ? 'N/A' : `${Math.round(unit.percent)}%`}
                                            </span>
                                        </div>

                                        {/* Compliance Bar */}
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 mt-2">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    unit.totalrequirements === 0
                                                        ? "bg-slate-300"
                                                        : unit.percent === 100
                                                        ? "bg-emerald-500"
                                                        : unit.percent >= 50
                                                        ? "bg-amber-500"
                                                        : "bg-rose-500"
                                                }`}
                                                style={{ width: `${unit.totalrequirements === 0 ? 0 : Math.max(unit.percent, 2)}%` }}
                                            />
                                        </div>

                                        {/* Status metrics chips */}
                                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-xs">
                                            <div className="rounded-lg bg-emerald-50 py-1.5 px-1 border border-emerald-100">
                                                <span className="block text-[10px] font-semibold text-emerald-700">Complied</span>
                                                <span className="font-bold text-emerald-900 text-xs">{unit.compliedcount}</span>
                                            </div>
                                            <div className="rounded-lg bg-amber-50 py-1.5 px-1 border border-amber-100">
                                                <span className="block text-[10px] font-semibold text-amber-700">Partial</span>
                                                <span className="font-bold text-amber-900 text-xs">{unit.partiallycompliedcount}</span>
                                            </div>
                                            <div className="rounded-lg bg-rose-50 py-1.5 px-1 border border-rose-100">
                                                <span className="block text-[10px] font-semibold text-rose-700">Not Met</span>
                                                <span className="font-bold text-rose-900 text-xs">{unit.notcompliedcount}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer: Personnel & Action */}
                                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Personnel:</span>
                                            {unit.headsList.length > 0 ? (
                                                <div className="flex items-center gap-1">
                                                    <div className="flex -space-x-1.5">
                                                        {unit.headsList.slice(0, 2).map((h) => renderPersonnelAvatar(h, "sm"))}
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-700 truncate max-w-[100px]">
                                                        {unit.headsList[0].full_name || "Assigned"}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-semibold text-rose-500">Unassigned</span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => onInspectOffice && onInspectOffice(unit)}
                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition shadow-2xs cursor-pointer"
                                        >
                                            <Eye size={12} /> Inspect
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Pagination Controls */}
            {activeTotalItems > activeItemsPerPage && (
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <div>
                        Showing {(currentPage - 1) * activeItemsPerPage + 1} to{" "}
                        {Math.min(currentPage * activeItemsPerPage, activeTotalItems)} of{" "}
                        {activeTotalItems} items
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-2xs cursor-pointer"
                        >
                            <ChevronLeft size={14} />
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((page) => {
                                return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                            })
                            .map((page, idx, arr) => {
                                const prevPage = arr[idx - 1];
                                const showEllipsis = prevPage && page - prevPage > 1;

                                return (
                                    <React.Fragment key={page}>
                                        {showEllipsis && <span className="px-1 text-slate-400">...</span>}
                                        <button
                                            onClick={() => setCurrentPage(page)}
                                            className={`min-w-[28px] rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                                                currentPage === page
                                                    ? "bg-blue-600 text-white shadow-2xs"
                                                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    </React.Fragment>
                                );
                            })}

                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition shadow-2xs cursor-pointer"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
