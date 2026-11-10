import React, { useState, useEffect } from 'react';
import StatusBadge from './StatusBadge';
import { API_BASE_URL } from '../../utils/apiBase';
import SmartUserAvatar from './SmartUserAvatar';

export default function OfficeInfoBar({
    officeData,
    isAssignedInCurrentOffice,
    assignedRequirementCount,
    requirements = [],
    isAdmin = false,
    isAuditor = false,
    currentUser = null
}) {
    const [auditors, setAuditors] = useState([]);
    const [fetchedHeads, setFetchedHeads] = useState([]);

    const { complianceNum, compliance, statusid } = React.useMemo(() => {
        const totalOfficeReqs = Number(officeData?.totalrequirements ?? officeData?.totalrequirements ?? 0);
        const rawPct = officeData?.compliancepercent ?? officeData?.compliancepercent ?? officeData?.compliance_percentage ?? officeData?.compliancePercentage;

        // If no requirements exist at all (empty office)
        const hasReqs = (Array.isArray(requirements) && requirements.length > 0) || totalOfficeReqs > 0;
        if (!hasReqs) {
            return {
                complianceNum: 0,
                compliance: 'N/A',
                statusid: 0
            };
        }

        // If officeData provides the comprehensive compliance percent across all areas and total requirements exceed the loaded array
        if (rawPct !== undefined && rawPct !== null && !isNaN(Number(rawPct)) && totalOfficeReqs > 0 && Array.isArray(requirements) && totalOfficeReqs > requirements.length) {
            const score = Number(rawPct);
            const status =
                officeData?.overallstatus === 'Complied' ? 5 :
                officeData?.overallstatus === 'Partially Complied' ? 4 : 3;

            return {
                complianceNum: score,
                compliance: `${score.toFixed(1)}%`,
                statusid: status
            };
        }

        if (Array.isArray(requirements) && requirements.length > 0) {
            const total = totalOfficeReqs > requirements.length ? totalOfficeReqs : requirements.length;
            const complied = requirements.filter(r => {
                const s = Number(r.ComplianceStatusID ?? r.complianceStatusId ?? r.Status ?? r.status);
                return s === 5;
            }).length;
            const partial = requirements.filter(r => {
                const s = Number(r.ComplianceStatusID ?? r.complianceStatusId ?? r.Status ?? r.status);
                return s === 4;
            }).length;
            const notComplied = requirements.filter(r => {
                const s = Number(r.ComplianceStatusID ?? r.complianceStatusId ?? r.Status ?? r.status);
                return s === 3 || (![4, 5].includes(s));
            }).length;

            const score = total > 0 ? ((complied * 100 + partial * 50) / (total * 100)) * 100 : 0;
            
            let status = 3;
            if (total > 0 && complied === total) {
                status = 5;
            } else if (total > 0 && (notComplied === total || (complied === 0 && partial === 0))) {
                status = 3;
            } else if (total > 0) {
                status = 4;
            }

            return {
                complianceNum: score,
                compliance: `${score.toFixed(1)}%`,
                statusid: status
            };
        }

        const score = rawPct !== undefined && rawPct !== null && !isNaN(Number(rawPct)) ? Number(rawPct) : 0;
        const status =
            officeData?.overallstatus === 'Complied' ? 5 :
            officeData?.overallstatus === 'Partially Complied' ? 4 : 3;

        return {
            complianceNum: score,
            compliance: `${score.toFixed(1)}%`,
            statusid: status
        };
    }, [requirements, officeData]);

    useEffect(() => {
        const officeid = officeData?.officeid || officeData?.officeid || officeData?.id;
        if (!officeid) return;
        let mounted = true;

        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // Fetch auditors
        fetch(`${API_BASE_URL}/api/areas/auditors/office/${officeid}`, { headers })
            .then(res => res.json())
            .then(data => {
                if (mounted && data.success) {
                    const list = data.auditors || [];
                    const unique = Array.from(new Map(list.map(a => [a.userid ?? a.id, a])).values());
                    setAuditors(unique);
                }
            })
            .catch(() => {});

        // Fetch office heads if not directly present
        const existingHeads = officeData?.heads || officeData?.Heads;
        if (!Array.isArray(existingHeads) || existingHeads.length === 0) {
            fetch(`${API_BASE_URL}/api/officeheads/all`, { headers })
                .then(res => res.json())
                .then(data => {
                    if (!mounted) return;
                    const allHeads = Array.isArray(data) ? data : (data.data || []);
                    const matching = allHeads.filter(h => {
                        if (Number(h.officeid) === Number(officeid)) return true;
                        if (Array.isArray(h.assigned_offices)) {
                            return h.assigned_offices.some(o => Number(o.id || o.officeid || o.officeid) === Number(officeid));
                        }
                        return false;
                    });
                    if (matching.length > 0) {
                        setFetchedHeads(matching);
                    }
                })
                .catch(() => {});
        }

        return () => { mounted = false; };
    }, [officeData]);

    // Compliance color
    const complianceColor = statusid === 0
        ? 'text-slate-400'
        : complianceNum >= 80
        ? 'text-emerald-600'
        : complianceNum >= 50
            ? 'text-amber-600'
            : 'text-rose-600';

    // Compute heads
    const rawHeads = (Array.isArray(officeData?.heads) && officeData.heads.length > 0)
        ? officeData.heads
        : (Array.isArray(officeData?.Heads) && officeData.Heads.length > 0)
        ? officeData.Heads
        : (fetchedHeads.length > 0)
        ? fetchedHeads
        : [];

    let officeHeads = [...rawHeads];

    if (officeHeads.length === 0 && (officeData?.head_name || officeData?.HeadName)) {
        const name = officeData.head_name || officeData.HeadName;
        if (name && name !== 'Unassigned' && name !== 'Unknown Head') {
            officeHeads = [{
                headid: officeData.headid || officeData.headid || 1,
                full_name: name,
                firstname: name,
                profilepic: officeData.head_profile_pic || officeData.HeadProfilePic || null
            }];
        }
    }

    const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);
    const resolvedIsAdmin = Boolean(
        isAdmin ||
        ((currentUser?.roleid === 1 || currentUser?.rolename?.toLowerCase() === 'admin') &&
         !currentUser?.rolename?.toLowerCase()?.includes('auditor') &&
         currentUser?.roleid !== 4)
    );
    const resolvedIsAuditor = Boolean(
        isAuditor ||
        currentUser?.roleid === 4 ||
        currentUser?.rolename?.toLowerCase()?.includes('auditor') ||
        currentUser?.isExternalAuditor
    );

    // Compute visible heads (Personnel)
    let visibleHeads = [];
    if (resolvedIsAdmin) {
        visibleHeads = officeHeads;
    } else if (resolvedIsAuditor) {
        visibleHeads = [];
    } else {
        visibleHeads = officeHeads.filter(h => {
            const hId = Number(h.headid || h.userid || h.id);
            return hId === currentUid;
        });
    }

    // Compute visible auditors (External Auditor)
    let visibleAuditors = [];
    if (resolvedIsAdmin) {
        visibleAuditors = auditors;
    } else if (resolvedIsAuditor) {
        visibleAuditors = auditors.filter(a => {
            const aId = Number(a.userid ?? a.id);
            return aId === currentUid;
        });
    } else {
        visibleAuditors = [];
    }

    const showPersonnelSection = resolvedIsAdmin || (!resolvedIsAuditor && visibleHeads.length > 0);
    const showAuditorSection = resolvedIsAdmin || (resolvedIsAuditor && visibleAuditors.length > 0);

    return (
        <div className="border-b border-slate-200/70 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Left: Personnel + Auditor */}
                <div className="flex min-w-0 flex-wrap items-center gap-4">
                    {/* Personnel */}
                    {showPersonnelSection && (() => {
                        if (visibleHeads.length === 0) {
                            return (
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-400 shadow-xs">
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personnel</p>
                                        <p className="text-xs font-medium text-slate-500 italic">Unassigned</p>
                                    </div>
                                </div>
                            );
                        }

                        if (visibleHeads.length > 1) {
                            return (
                                <div className="flex items-center gap-2.5">
                                    <div className="flex -space-x-2">
                                        {visibleHeads.map((head) => (
                                            <SmartUserAvatar
                                                key={head.headid || head.userid || head.id || Math.random()}
                                                user={head}
                                                size="h-8 w-8"
                                                ring="border-2 border-white shadow-2xs"
                                            />
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personnel</p>
                                        <p className="text-xs font-semibold text-slate-700">
                                            {visibleHeads.map(h => h.firstname || h.full_name).filter(Boolean).join(', ') || `${visibleHeads.length} members`}
                                        </p>
                                    </div>
                                </div>
                            );
                        }

                        const primaryHead = visibleHeads[0];
                        const headDisplayName = primaryHead?.full_name || `${primaryHead?.firstname || ''} ${primaryHead?.lastname || ''}`.trim() || primaryHead?.firstname || 'Assigned';
                        return (
                            <div className="flex items-center gap-2.5">
                                <SmartUserAvatar
                                    user={primaryHead}
                                    size="h-8 w-8"
                                    ring="border border-white shadow-2xs"
                                />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Personnel</p>
                                    <p className="text-xs font-semibold text-slate-700">{headDisplayName}</p>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Divider */}
                    {showPersonnelSection && showAuditorSection && (
                        <span className="h-8 w-px bg-slate-200" />
                    )}

                    {/* External Auditor */}
                    {showAuditorSection && (
                        <div className="flex items-center gap-2.5">
                            {visibleAuditors.length > 0 ? (
                                <>
                                    <div className="flex -space-x-2">
                                        {visibleAuditors.map(aud => (
                                            <SmartUserAvatar
                                                key={aud.userid ?? aud.id}
                                                user={aud}
                                                size="h-8 w-8"
                                                ring="border border-white shadow-2xs"
                                            />
                                        ))}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600">External Auditor</p>
                                        <p className="text-xs font-semibold text-sky-800">
                                            {visibleAuditors.length === 1
                                                ? `${visibleAuditors[0].firstname || ''} ${visibleAuditors[0].lastname || ''}`.trim() || visibleAuditors[0].firstname || 'Auditor'
                                                : `${visibleAuditors.length} assigned`}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">External Auditor</p>
                                    <p className="text-xs font-medium text-slate-400 italic">None assigned</p>
                                </div>
                            )}
                        </div>
                    )}

                    {isAssignedInCurrentOffice && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 shadow-sm">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-500" />
                            Assigned here ({assignedRequirementCount})
                        </span>
                    )}
                </div>

                {/* Right: Compliance */}
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Compliance</p>
                        <p className={`text-2xl font-black tabular-nums tracking-tight ${complianceColor}`}>{compliance}</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <StatusBadge statusid={statusid} />
                </div>
            </div>
        </div>
    );
}
