import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { Check } from 'lucide-react';
import StatusBadge from './StatusBadge';
import StatusSlider from './StatusSlider';
import SmartUserAvatar from './SmartUserAvatar';
import { API_BASE_URL } from '../../utils/apiBase';
import { useModal } from '../UI/ModalProvider';

function RequirementHeaderAndDescription({
    req,
    isAssignedToMe,
    isAuditor,
    hasRejected,
    isExpanded,
    onToggleExpand,
}) {
    const textRef = useRef(null);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const reqDesc = req.description || req.Description || '';

    useLayoutEffect(() => {
        const el = textRef.current;
        if (!el) return;

        const checkOverflow = () => {
            if (!isExpanded && textRef.current) {
                setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight + 2);
            }
        };

        checkOverflow();

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(checkOverflow);
            observer.observe(el);
            return () => observer.disconnect();
        }
    }, [reqDesc, isExpanded]);

    const showToggle = isOverflowing || isExpanded;

    return (
        <>
            <div className="flex items-center gap-2 flex-wrap">
                <h5 className="text-sm font-semibold text-slate-900">{req.requirementcode}</h5>
                {isAssignedToMe && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200/80 bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-800 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                        Active
                    </span>
                )}
                {!isAuditor && hasRejected && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Needs Revision
                    </span>
                )}
                {showToggle && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand();
                        }}
                        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer leading-none"
                        aria-expanded={isExpanded}
                    >
                        {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                )}
            </div>
            <p
                ref={textRef}
                className={`mt-1 text-xs leading-relaxed text-slate-600 ${isExpanded ? '' : 'line-clamp-2'}`}
            >
                {reqDesc}
            </p>
        </>
    );
}

export default function RequirementsTree({
    loading,
    requirements,
    searchTerm,
    statusFilter,
    submissionFilter = 'all',
    isAdmin,
    isOfficeHead,
    isAuditor: isAuditorProp,
    assignedUsersMap = {},
    personnelAssignments = [],
    expandedReqs,
    toggleExpandReq,
    isUserAssignedToRequirement,
    isUserAssignedToCurrentOffice = false,
    canUserUploadEvidence = null,
    editingCommentId,
    commentInput,
    savingComment,
    handleCommentInputChange,
    handleCommentSave,
    handleCommentClear,
    handleCommentCancel,
    handleCommentClick,
    handleStatusChange,
    currentUser,
    userUploadingReqId,
    handleUserReqFileUpload,
    hasUserUploadedForRequirement,
    handleViewUserFile,
    handleDownloadUserFile,
    handleUnsubmitUserFile,
    unsubmittingReqId,
    removingReqId,
    handleRemoveRequirement,
    handleUserAvatarClick,
    onViewSubmission,
    onViewMySubmission,
}) {
    const { showAlert } = useModal();
    const commentLabel = isAdmin ? 'Comment' : 'Private comment';
    const isAuditor = isAuditorProp !== undefined
        ? Boolean(isAuditorProp)
        : Boolean(
            currentUser?.roleid === 4 ||
            currentUser?.rolename?.toLowerCase()?.includes('auditor') ||
            currentUser?.isExternalAuditor ||
            (() => {
                try {
                    const u = JSON.parse(localStorage.getItem('user') || '{}');
                    return Number(u.roleid) === 4 || String(u.rolename || '').toLowerCase().includes('auditor') || Boolean(u.isExternalAuditor);
                } catch {
                    return false;
                }
            })()
        );
    const isPersonnel = !isAdmin && !isAuditor;
    const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);

    const [auditorAssignedAreaIds, setAuditorAssignedAreaIds] = useState(new Set());
    // Start with all areas collapsed by default
    const [expandedAreas, setExpandedAreas] = useState(new Set());
    const [collapsedCriteria, setCollapsedCriteria] = useState(new Set());

    // Build map of direct personnel assignments by area, criteria, and requirements
    const personnelMap = useMemo(() => {
        const map = { areas: {}, criteria: {}, requirements: {} };
        (personnelAssignments || []).forEach(pa => {
            const userObj = {
                userid: pa.userid,
                firstname: pa.firstname,
                lastname: pa.lastname,
                email: pa.email,
                profilepic: pa.profilepic,
                fullname: `${pa.firstname || ''} ${pa.lastname || ''}`.trim() || pa.email || `User #${pa.userid}`
            };

            if (pa.areaid && !pa.criteriaid && !pa.requirementid) {
                const aid = Number(pa.areaid);
                if (!map.areas[aid]) map.areas[aid] = [];
                if (!map.areas[aid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.areas[aid].push(userObj);
                }
            } else if (pa.criteriaid && !pa.requirementid) {
                const cid = Number(pa.criteriaid);
                if (!map.criteria[cid]) map.criteria[cid] = [];
                if (!map.criteria[cid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.criteria[cid].push(userObj);
                }
            } else if (pa.requirementid) {
                const rid = Number(pa.requirementid);
                if (!map.requirements[rid]) map.requirements[rid] = [];
                if (!map.requirements[rid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.requirements[rid].push(userObj);
                }
            }
        });
        return map;
    }, [personnelAssignments]);

    const toggleArea = (areaKey) => {
        setExpandedAreas((prev) => {
            const next = new Set(prev);
            if (next.has(areaKey)) next.delete(areaKey);
            else next.add(areaKey);
            return next;
        });
    };

    const toggleCriteria = (critId) => {
        setCollapsedCriteria((prev) => {
            const next = new Set(prev);
            if (next.has(critId)) next.delete(critId);
            else next.add(critId);
            return next;
        });
    };


    useEffect(() => {
        if (!currentUser || !isAuditor) return;
        const targetUserId = currentUser.userid ?? currentUser.id ?? currentUser.userid;
        if (!targetUserId) return;
        let mounted = true;
        const fetchAssignments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/areas/assignments/${targetUserId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (mounted && res.ok && data.success) {
                    const ids = new Set((data.assignments || []).map(a => Number(a.areaid ?? a.areaid)));
                    setAuditorAssignedAreaIds(ids);
                }
            } catch (e) { }
        };
        fetchAssignments();
        return () => { mounted = false; };
    }, [currentUser, isAuditor]);

    const effectiveRequirements = isAuditor
        ? (requirements || []).filter(req => auditorAssignedAreaIds.has(Number(req.areaid ?? req.areaid ?? req.areaid)))
        : (requirements || []);

    const totalCount = (requirements || []).length;
    const isAuditorFiltered = isAuditor && totalCount > 0;

    return (
        <div className="flex-1 overflow-y-auto bg-app px-4 py-4 sm:px-5">
            {loading ? (
                <div className="space-y-6 animate-pulse py-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="space-y-4">
                            {/* Skeleton Area Header */}
                            <div className="h-10 w-full rounded-xl bg-slate-200/80" />

                            {/* Skeleton Criteria Header */}
                            <div className="ml-4 h-9 w-[95%] rounded-xl bg-slate-200/50" />

                            {/* Skeleton Requirement Cards */}
                            <div className="ml-8 space-y-3">
                                {[1, 2].map((j) => (
                                    <div key={j} className="border border-slate-200/50 rounded-xl p-4 flex gap-4 bg-white/70">
                                        {/* Status bullet placeholder */}
                                        <div className="w-24 space-y-2.5 shrink-0">
                                            <div className="h-3 w-16 rounded bg-slate-200/80" />
                                            <div className="h-3 w-20 rounded bg-slate-200/50" />
                                            <div className="h-3 w-14 rounded bg-slate-200/50" />
                                        </div>

                                        {/* Details placeholder */}
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3.5 w-12 rounded bg-slate-200/80" />
                                            <div className="h-3 w-full rounded bg-slate-200/50" />
                                            <div className="h-3 w-4/5 rounded bg-slate-200/50" />

                                            {/* Comment input box placeholder */}
                                            <div className="h-8 w-full rounded-lg bg-slate-100/50 mt-3" />
                                        </div>

                                        {/* Action buttons placeholder */}
                                        <div className="w-16 flex flex-col items-end gap-2 shrink-0">
                                            <div className="h-3 w-10 rounded bg-slate-200/80" />
                                            <div className="h-7 w-12 rounded bg-slate-200/50 mt-1" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : effectiveRequirements.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                        <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                        {isAuditorFiltered ? 'No standards in your assigned area(s)' : 'No standards added yet'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        {isAuditorFiltered 
                            ? 'Standards exist in this office, but none match your assigned area(s).' 
                            : 'Standards will appear here once added to this office.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {(() => {
                        // Build areas with criteria nodes (includes parentcriteriaid provided by backend)
                        const groupedByArea = effectiveRequirements.reduce((areaGroups, req) => {
                            const areaKey = req.areacode || `Area_${req.areaid || 'NoArea'}`;
                            if (!areaGroups[areaKey]) {
                                areaGroups[areaKey] = {
                                    id: req.areaid ? Number(req.areaid) : null,
                                    areaid: req.areaid ? Number(req.areaid) : null,
                                    name: req.areaname || 'No Area',
                                    code: req.areacode || areaKey,
                                    criteriaMap: {},
                                };
                            } else if (!areaGroups[areaKey].id && req.areaid) {
                                areaGroups[areaKey].id = Number(req.areaid);
                                areaGroups[areaKey].areaid = Number(req.areaid);
                            }

                            const critId = req.criteriaid ?? `crit_${req.criteriacode || req.requirementid}`;
                            const map = areaGroups[areaKey].criteriaMap;

                            const directCode = req.criteriacode || req.CriteriaCode || '';
                            const directName = req.criterianame || req.CriteriaName || '';
                            const parentId = req.parentcriteriaid ? Number(req.parentcriteriaid) : null;
                            const parentCode = req.ParentCriteriaCode || req.parentcriteriacode || req.parentCriteriaCode || '';
                            const parentName = req.ParentCriteriaName || req.parentcriterianame || req.parentCriteriaName || '';

                            if (!map[critId]) {
                                map[critId] = {
                                    id: critId,
                                    areaId: req.areaid ? Number(req.areaid) : null,
                                    code: directCode,
                                    name: directName,
                                    parentId: parentId,
                                    requirements: [],
                                    children: [],
                                };
                            } else {
                                if (!map[critId].code && directCode) map[critId].code = directCode;
                                if (!map[critId].name && directName) map[critId].name = directName;
                                if (!map[critId].parentId && parentId) map[critId].parentId = parentId;
                            }

                            // If parent exists in row, ensure parent node exists in map with code and name
                            if (parentId) {
                                if (!map[parentId]) {
                                    map[parentId] = {
                                        id: parentId,
                                        areaId: req.areaid ? Number(req.areaid) : null,
                                        code: parentCode,
                                        name: parentName,
                                        parentId: null,
                                        requirements: [],
                                        children: [],
                                    };
                                } else {
                                    if (!map[parentId].code && parentCode) map[parentId].code = parentCode;
                                    if (!map[parentId].name && parentName) map[parentId].name = parentName;
                                }
                            }

                            map[critId].requirements.push(req);
                            return areaGroups;
                        }, {});

                        // Link children to parents within each area (avoiding duplicates)
                        Object.values(groupedByArea).forEach((area) => {
                            const map = area.criteriaMap;
                            Object.values(map).forEach((node) => {
                                if (node.parentId && map[node.parentId]) {
                                    if (!map[node.parentId].children.some((c) => String(c.id) === String(node.id))) {
                                        map[node.parentId].children.push(node);
                                    }
                                }
                            });
                        });

                        const matchesReq = (req) => {
                            const searchLower = searchTerm.toLowerCase();
                            const matchesSearch = !searchTerm || (
                                (req.requirementcode || '').toLowerCase().includes(searchLower) ||
                                (req.description || req.Description || '').toLowerCase().includes(searchLower) ||
                                (req.areacode || '').toLowerCase().includes(searchLower) ||
                                (req.areaname || '').toLowerCase().includes(searchLower) ||
                                (req.criteriacode || '').toLowerCase().includes(searchLower) ||
                                (req.criterianame || '').toLowerCase().includes(searchLower) ||
                                ((req.comments || '').toLowerCase().includes(searchLower))
                            );

                            if (!matchesSearch) return false;

                            if (statusFilter !== 'all') {
                                const statusid = Number(req.ComplianceStatusID);
                                if (statusFilter === 'complied' && statusid !== 5) return false;
                                if (statusFilter === 'partially' && statusid !== 4) return false;
                                if (statusFilter === 'not-complied' && (statusid === 5 || statusid === 4)) return false;
                            }

                            if (submissionFilter && submissionFilter !== 'all' && submissionFilter !== 'priority') {
                                const reqUsers = assignedUsersMap[req.requirementid] || [];
                                const targetUsers = isPersonnel
                                    ? reqUsers.filter((u) => Number(u.userid) === currentUid)
                                    : reqUsers;

                                const totalFiles = targetUsers.reduce((sum, u) => sum + Number(u.totalfiles || 0), 0);
                                const rejectedCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.rejectedcount || 0), 0) : 0;
                                const pendingCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.pendingcount || 0), 0) : 0;
                                const approvedCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.approvedcount || 0), 0) : 0;

                                if (submissionFilter === 'rejected') {
                                    return rejectedCount > 0;
                                } else if (submissionFilter === 'pending') {
                                    return pendingCount > 0;
                                } else if (submissionFilter === 'unsubmitted') {
                                    return totalFiles === 0;
                                } else if (submissionFilter === 'approved') {
                                    return approvedCount > 0;
                                }
                            }

                            return true;
                        };

                        // helper: check if node or any descendant has matching requirements
                        const nodeHasMatches = (node) => {
                            if ((node.requirements || []).some((r) => matchesReq(r))) return true;
                            return (node.children || []).some((child) => nodeHasMatches(child));
                        };

                        const countTotalMatchingReqs = (n) => {
                            let count = (n.requirements || []).filter((r) => matchesReq(r)).length;
                            (n.children || []).forEach((c) => {
                                count += countTotalMatchingReqs(c);
                            });
                            return count;
                        };

                        const renderNode = (node, depth = 0) => {
                            if (!nodeHasMatches(node)) return null;
                            const isCritExpanded = !collapsedCriteria.has(node.id) || (submissionFilter && submissionFilter !== 'all');
                            let matchingReqs = (node.requirements || []).filter((r) => matchesReq(r));
                            if (submissionFilter && submissionFilter !== 'all') {
                                matchingReqs = [...matchingReqs].sort((a, b) => {
                                    const getStats = (req) => {
                                        const reqUsers = assignedUsersMap[req.requirementid] || [];
                                        const targetUsers = isPersonnel
                                            ? reqUsers.filter((u) => Number(u.userid) === currentUid)
                                            : reqUsers;
                                        const totalFiles = targetUsers.reduce((sum, u) => sum + Number(u.totalfiles || 0), 0);
                                        const rejectedCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.rejectedcount || 0), 0) : 0;
                                        const pendingCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.pendingcount || 0), 0) : 0;
                                        const approvedCount = totalFiles > 0 ? targetUsers.reduce((sum, u) => sum + Number(u.approvedcount || 0), 0) : 0;
                                        return { totalFiles, rejectedCount, pendingCount, approvedCount };
                                    };

                                    const sa = getStats(a);
                                    const sb = getStats(b);

                                    if (submissionFilter === 'approved') {
                                        return sb.approvedCount - sa.approvedCount;
                                    } else if (submissionFilter === 'pending') {
                                        return sb.pendingCount - sa.pendingCount;
                                    } else if (submissionFilter === 'rejected') {
                                        return sb.rejectedCount - sa.rejectedCount;
                                    } else if (submissionFilter === 'unsubmitted') {
                                        return (sa.totalFiles === 0 ? 0 : 1) - (sb.totalFiles === 0 ? 0 : 1);
                                    } else if (submissionFilter === 'priority') {
                                        const getPriorityRank = (s) => {
                                            if (s.rejectedCount > 0) return 1; // Needs revision first
                                            if (s.totalFiles === 0) return 2;  // Needs submission next
                                            if (s.pendingCount > 0) return 3;  // Waiting review
                                            if (s.approvedCount > 0) return 4; // Complete / approved
                                            return 5;
                                        };
                                        return getPriorityRank(sa) - getPriorityRank(sb);
                                    }
                                    return 0;
                                });
                            }
                            const totalMatchingCount = countTotalMatchingReqs(node);

                            const trimmedCode = (node.code || '').trim();
                            const trimmedName = (node.name || '').trim();

                            let displayTitle = '';
                            let displaySubtitle = '';

                            if (trimmedCode && trimmedName) {
                                displayTitle = trimmedCode;
                                displaySubtitle = trimmedName;
                            } else if (trimmedCode) {
                                displayTitle = trimmedCode;
                            } else if (trimmedName) {
                                displayTitle = trimmedName;
                            } else {
                                displayTitle = (node.children || []).length > 0 ? 'Sub-area Group' : 'Sub-area';
                            }

                            // Personnel assigned to this Sub-Area
                            const nodeCritId = Number(node.id);
                            const directCritUsers = personnelMap.criteria[nodeCritId] || [];
                            const directCritUserIds = new Set(directCritUsers.map((u) => Number(u.userid)));

                            // Inherited from Area or parent criteria
                            const inheritedUsers = [];
                            const nodeAreaId = Number(node.areaId);
                            const areaDirectUsers = personnelMap.areas[nodeAreaId] || [];
                            areaDirectUsers.forEach((u) => {
                                if (!directCritUserIds.has(Number(u.userid)) && !inheritedUsers.some((x) => Number(x.userid) === Number(u.userid))) {
                                    inheritedUsers.push({ ...u, source: 'Area' });
                                }
                            });
                            if (node.parentId) {
                                const parentCritUsers = personnelMap.criteria[Number(node.parentId)] || [];
                                parentCritUsers.forEach((u) => {
                                    if (!directCritUserIds.has(Number(u.userid)) && !inheritedUsers.some((x) => Number(x.userid) === Number(u.userid))) {
                                        inheritedUsers.push({ ...u, source: 'Parent' });
                                    }
                                });
                            }

                            // Child assigned personnel (in child standards or descendant sub-areas)
                            const childCritUsersMap = new Map();
                            const collectDescendantPersonnel = (curr) => {
                                (curr.requirements || []).forEach((r) => {
                                    const fromMap = assignedUsersMap[r.requirementid] || [];
                                    const fromPa = personnelMap.requirements[Number(r.requirementid)] || [];
                                    [...fromMap, ...fromPa].forEach((u) => {
                                        const uid = Number(u.userid);
                                        if (!directCritUserIds.has(uid) && !inheritedUsers.some((x) => Number(x.userid) === uid)) {
                                            if (!childCritUsersMap.has(uid)) {
                                                childCritUsersMap.set(uid, {
                                                    userid: u.userid,
                                                    firstname: u.firstname,
                                                    lastname: u.lastname,
                                                    email: u.email,
                                                    profilepic: u.profilepic,
                                                    fullname: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email || `User #${u.userid}`,
                                                    source: 'Standards'
                                                });
                                            }
                                        }
                                    });
                                });
                                (curr.children || []).forEach((child) => {
                                    (personnelMap.criteria[Number(child.id)] || []).forEach((u) => {
                                        const uid = Number(u.userid);
                                        if (!directCritUserIds.has(uid) && !inheritedUsers.some((x) => Number(x.userid) === uid)) {
                                            if (!childCritUsersMap.has(uid)) {
                                                childCritUsersMap.set(uid, {
                                                    ...u,
                                                    source: 'Sub-areas'
                                                });
                                            }
                                        }
                                    });
                                    collectDescendantPersonnel(child);
                                });
                            };
                            collectDescendantPersonnel(node);
                            const childCritUsers = Array.from(childCritUsersMap.values());
                            const visibleDirectCritUsers = (isAdmin || isAuditor) ? directCritUsers : directCritUsers.filter((u) => Number(u.userid) === currentUid);
                            const visibleInheritedUsers = (isAdmin || isAuditor) ? inheritedUsers : inheritedUsers.filter((u) => Number(u.userid) === currentUid);
                            const visibleChildCritUsers = (isAdmin || isAuditor) ? childCritUsers : childCritUsers.filter((u) => Number(u.userid) === currentUid);

                            return (
                                <div key={`criteria-${node.id}`} className="overflow-hidden rounded-xl border border-slate-300/50 bg-slate-100/90 shadow-sm transition-all">
                                    <button
                                        type="button"
                                        onClick={() => toggleCriteria(node.id)}
                                        className={`w-full text-left border-b px-4 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:brightness-105 transition-all ${
                                            depth === 0 ? 'border-indigo-900/30 bg-gradient-to-r from-indigo-800 to-indigo-700' : 'border-indigo-800/40 bg-gradient-to-r from-indigo-700/95 to-indigo-600/95'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="text-xs font-semibold tracking-wide text-white">{displayTitle}</h4>
                                                <span className="rounded-full bg-white/15 px-1.5 py-0.2 text-[9px] font-bold text-white/90">
                                                    {totalMatchingCount}
                                                </span>
                                            </div>
                                            {displaySubtitle && (
                                                <p className="mt-0.5 text-xs leading-snug text-indigo-100/95 truncate">{displaySubtitle}</p>
                                            )}

                                            {/* Assigned Personnel Markings for Sub-Area */}
                                            {(visibleDirectCritUsers.length > 0 || visibleInheritedUsers.length > 0 || visibleChildCritUsers.length > 0) && (
                                                <div className="flex items-center gap-1.5 flex-wrap mt-2" onClick={(e) => e.stopPropagation()}>
                                                    {/* Directly Assigned */}
                                                    {visibleDirectCritUsers.slice(0, 4).map((person) => (
                                                        <div
                                                            key={`crit-direct-${person.userid}`}
                                                            className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-full pl-1 pr-2.5 py-0.5 border border-white/30 shadow-2xs transition"
                                                            title={`Directly assigned to Sub-area: ${person.fullname}`}
                                                        >
                                                            <SmartUserAvatar
                                                                user={person}
                                                                size="w-4 h-4"
                                                                textSize="text-[8px]"
                                                                className="ring-1 ring-white shrink-0"
                                                            />
                                                            <span className="text-[10px] font-medium leading-none truncate max-w-[130px]">
                                                                {person.fullname}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {visibleDirectCritUsers.length > 4 && (
                                                        <span
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white"
                                                            title={visibleDirectCritUsers.slice(4).map((p) => p.fullname).join(', ')}
                                                        >
                                                            +{visibleDirectCritUsers.length - 4}
                                                        </span>
                                                    )}

                                                    {/* Inherited from Area */}
                                                    {visibleInheritedUsers.slice(0, 4).map((person) => (
                                                        <div
                                                            key={`crit-inherited-${person.userid}`}
                                                            className="inline-flex items-center gap-1.5 bg-blue-500/50 hover:bg-blue-500/70 text-blue-100 rounded-full pl-1 pr-2 py-0.5 border border-blue-400/40 shadow-2xs transition"
                                                            title={`Inherited from ${person.source}: ${person.fullname}`}
                                                        >
                                                            <SmartUserAvatar
                                                                user={person}
                                                                size="w-4 h-4"
                                                                textSize="text-[8px]"
                                                                className="ring-1 ring-white/60 shrink-0"
                                                            />
                                                            <span className="text-[9px] font-medium leading-none truncate max-w-[130px]">
                                                                {person.fullname} <span className="text-blue-200/80 text-[8px]">({person.source})</span>
                                                            </span>
                                                        </div>
                                                    ))}

                                                    {/* Child Assigned in Standards */}
                                                    {visibleChildCritUsers.slice(0, 4).map((person) => (
                                                        <div
                                                            key={`crit-child-${person.userid}`}
                                                            className="inline-flex items-center gap-1.5 bg-amber-400/25 hover:bg-amber-400/35 text-amber-100 rounded-full pl-1 pr-2.5 py-0.5 border border-amber-300/40 shadow-2xs transition"
                                                            title={`Assigned to ${person.source.toLowerCase()}: ${person.fullname}`}
                                                        >
                                                            <SmartUserAvatar
                                                                user={person}
                                                                size="w-4 h-4"
                                                                textSize="text-[8px]"
                                                                className="ring-1 ring-amber-200 shrink-0"
                                                            />
                                                            <span className="text-[10px] font-medium leading-none truncate max-w-[140px]">
                                                                {person.fullname} <span className="text-amber-200/80 text-[9px]">({person.source})</span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {visibleChildCritUsers.length > 4 && (
                                                        <span
                                                            className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/25 text-amber-100 border border-amber-300/40"
                                                            title={visibleChildCritUsers.slice(4).map((p) => p.fullname).join(', ')}
                                                        >
                                                            +{visibleChildCritUsers.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 text-white/80">
                                            <span className="text-[10px] font-medium text-indigo-200 hidden sm:inline">
                                                {isCritExpanded ? 'Collapse' : 'Expand'}
                                            </span>
                                            <svg
                                                className={`h-3.5 w-3.5 text-white transition-transform duration-200 ${isCritExpanded ? 'rotate-180' : 'rotate-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2.5}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>

                                    {isCritExpanded && (
                                        <div className="divide-y divide-slate-300/40 animate-in fade-in duration-150">
                                            {matchingReqs.map((req) => {
                                            const isAssignedToMe = isUserAssignedToRequirement(req.requirementid);
                                            const isOfficePersonnel = currentUser?.roleid === 2;
                                            const hasUploadedFile = hasUserUploadedForRequirement(req.requirementid);
                                            const canUploadThisReq = canUserUploadEvidence ? canUserUploadEvidence(req) : false;
                                            const canOpenSubmission = !!((isAdmin && onViewSubmission) || (isOfficeHead && (onViewMySubmission || onViewSubmission)) || (isAuditor && onViewSubmission) || ((isAssignedToMe || canUploadThisReq) && (onViewMySubmission || onViewSubmission)));
                                            return (
                                                <div
                                                    key={req.requirementid}
                                                    className={`p-4 transition-colors ${(isAssignedToMe || canUploadThisReq) ? 'bg-cyan-100/50 ring-1 ring-inset ring-cyan-300/50' : 'hover:bg-slate-200/40'} ${canOpenSubmission ? 'cursor-pointer hover:shadow-sm' : ''}`}
                                                    onClick={() => {
                                                        if (!canOpenSubmission) return;
                                                        if (isAdmin || isAuditor) {
                                                            onViewSubmission?.(req);
                                                        } else if (isOfficeHead) {
                                                            if (canUploadThisReq || isAssignedToMe || isUserAssignedToCurrentOffice) {
                                                                onViewMySubmission?.(req);
                                                            } else {
                                                                onViewSubmission?.(req);
                                                            }
                                                        } else if (isAssignedToMe || canUploadThisReq) {
                                                            onViewMySubmission?.(req);
                                                        } else {
                                                            onViewSubmission?.(req);
                                                        }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (!canOpenSubmission) return;
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            if (isAdmin || isAuditor) {
                                                                onViewSubmission?.(req);
                                                            } else if (isOfficeHead) {
                                                                if (canUploadThisReq || isAssignedToMe || isUserAssignedToCurrentOffice) {
                                                                    onViewMySubmission?.(req);
                                                                } else {
                                                                    onViewSubmission?.(req);
                                                                }
                                                            } else if (isAssignedToMe || canUploadThisReq) {
                                                                onViewMySubmission?.(req);
                                                            } else {
                                                                onViewSubmission?.(req);
                                                            }
                                                        }
                                                    }}
                                                    role={canOpenSubmission ? 'button' : undefined}
                                                    tabIndex={canOpenSubmission ? 0 : undefined}
                                                >
                                                    {/* Reuse existing requirement rendering block by inlining the minimal structure */}
                                                    <div className="flex items-stretch gap-3">
                                                        <div className="min-w-[90px] flex flex-col">
                                                            {isAdmin ? (
                                                                (() => {
                                                                    const reqUsers = assignedUsersMap[req.requirementid] || [];
                                                                    const hasUploadedEvidence = reqUsers.some(u => u?.hasuploaded === 1 || u?.hasuploaded === true) ||
                                                                        Boolean(req.documentproof || req.ProofDocument || req.hasProof || req.has_proof || req.file_url);
                                                                    const currentStatusId = Number(req.ComplianceStatusID) || 3;

                                                                    return (
                                                                        <StatusSlider
                                                                            currentStatusId={currentStatusId}
                                                                            disabled={!hasUploadedEvidence}
                                                                            className="h-full"
                                                                            onChange={(newStatusId) => handleStatusChange(req.requirementid, newStatusId)}
                                                                            onDisabledClick={() => {
                                                                                showAlert('Cannot change compliance status: No proof document has been uploaded for this standard yet.');
                                                                            }}
                                                                        />
                                                                    );
                                                                })()
                                                            ) : (
                                                                <StatusBadge statusid={req.ComplianceStatusID} />
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <RequirementHeaderAndDescription
                                                                req={req}
                                                                isAssignedToMe={isAssignedToMe}
                                                                isAuditor={isAuditor}
                                                                hasRejected={Boolean(assignedUsersMap[req.requirementid]?.some((u) => u.hasrejected || Number(u.rejectedcount) > 0))}
                                                                isExpanded={expandedReqs.includes(req.requirementid)}
                                                                onToggleExpand={() => toggleExpandReq(req.requirementid)}
                                                            />

                                                            {/* Comments display / edit */}
                                                            {editingCommentId === req.requirementid && isAdmin ? (
                                                                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                                                                            {req.comments ? (
                                                                                <div className="mb-2 rounded-lg border border-slate-300/50 bg-slate-50 p-3 shadow-sm">
                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                        <div className="text-[12px] font-semibold text-gray-800 flex items-center gap-2">
                                                                                            <span>{commentLabel}</span>
                                                                                            {savingComment && (
                                                                                                <span className="text-[10px] font-medium text-indigo-600 animate-pulse flex items-center gap-1">
                                                                                                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                    </svg>
                                                                                                    Updating...
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleCommentClear?.(req);
                                                                                            }}
                                                                                            disabled={savingComment}
                                                                                            className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 flex items-center gap-1"
                                                                                        >
                                                                                            {savingComment ? (
                                                                                                <>
                                                                                                    <svg className="animate-spin h-3 w-3 text-rose-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                    </svg>
                                                                                                    <span>Clearing...</span>
                                                                                                </>
                                                                                            ) : (
                                                                                                'Clear'
                                                                                            )}
                                                                                        </button>
                                                                                    </div>
                                                                                    <div className="mt-1 text-[13px] text-gray-800 break-words">{req.comments}</div>
                                                                                </div>
                                                                            ) : null}

                                                                            <div className="rounded-full border border-slate-300/50 bg-slate-50 px-3 py-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                                                <input
                                                                                    type="text"
                                                                                    value={commentInput}
                                                                                    onChange={handleCommentInputChange}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter' && !savingComment) {
                                                                                            e.preventDefault();
                                                                                            handleCommentSave(req);
                                                                                        }
                                                                                        if (e.key === 'Escape' && !savingComment) {
                                                                                            e.preventDefault();
                                                                                            handleCommentCancel();
                                                                                        }
                                                                                    }}
                                                                                    className="flex-1 bg-transparent outline-none text-[12px] text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                                                                                    placeholder={savingComment ? "Saving comment..." : "Add private comment..."}
                                                                                    disabled={savingComment}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCommentSave(req);
                                                                                    }}
                                                                                    disabled={savingComment || !String(commentInput || '').trim()}
                                                                                    className="h-7 w-7 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                                                                                    aria-label="Send comment"
                                                                                    title={savingComment ? "Saving comment..." : "Send"}
                                                                                >
                                                                                    {savingComment ? (
                                                                                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                        </svg>
                                                                                    ) : (
                                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                                                            <path d="M3 12L21 3l-6 18-2.7-7.3L3 12Z" fill="currentColor" />
                                                                                        </svg>
                                                                                    )}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleCommentCancel();
                                                                                    }}
                                                                                    disabled={savingComment}
                                                                                    className="h-7 w-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                                                                                    aria-label="Cancel"
                                                                                    title="Cancel"
                                                                                >
                                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                                                        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="mt-2">
                                                                            {req.comments ? (
                                                                                <div
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        if (isAdmin) handleCommentClick(req);
                                                                                    }}
                                                                                    role={isAdmin ? 'button' : undefined}
                                                                                    tabIndex={isAdmin ? 0 : undefined}
                                                                                    className={`rounded-lg border border-slate-300/50 bg-slate-50 p-3 shadow-sm ${isAdmin ? 'cursor-pointer' : ''}`}
                                                                                >
                                                                                    <div>
                                                                                        <div className="flex items-center justify-between gap-2">
                                                                                            <div className="text-[12px] font-semibold text-gray-800">{commentLabel}</div>
                                                                                            {isAdmin ? (
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleCommentClear?.(req);
                                                                                                    }}
                                                                                                    disabled={savingComment}
                                                                                                    className="rounded-md px-2 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
                                                                                                >
                                                                                                    Clear
                                                                                                </button>
                                                                                            ) : null}
                                                                                        </div>
                                                                                        <div className="mt-1 text-[13px] text-gray-800 break-words">{req.comments}</div>
                                                                                    </div>
                                                                                </div>
                                                                            ) : (
                                                                                isAdmin ? (
                                                                                    <div
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            handleCommentClick(req);
                                                                                        }}
                                                                                        role="button"
                                                                                        tabIndex={0}
                                                                                        className="rounded-full border border-slate-300/50 bg-slate-50 px-3 py-2 flex items-center gap-2 cursor-pointer"
                                                                                    >
                                                                                        <span className="flex-1 text-[12px] text-gray-400">Add private comment...</span>
                                                                                        <span className="h-7 w-7 rounded-full flex items-center justify-center text-gray-400">
                                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                                                                <path d="M3 12L21 3l-6 18-2.7-7.3L3 12Z" fill="currentColor" />
                                                                                            </svg>
                                                                                        </span>
                                                                                    </div>
                                                                                ) : null
                                                                            )}
                                                                        </div>
                                                                    )}
                                                        </div>

                                                        <div className="flex flex-col items-end gap-1.5">
                                                            {(() => {
                                                                const reqUsers = assignedUsersMap[req.requirementid] || [];
                                                                const visibleReqUsers = (isAdmin || isAuditor)
                                                                    ? reqUsers
                                                                    : reqUsers.filter((u) => Number(u.userid) === currentUid);

                                                                if (!visibleReqUsers || visibleReqUsers.length === 0) return null;

                                                                if (isPersonnel) {
                                                                    return (
                                                                        <div className="flex flex-col items-end gap-1">
                                                                            {visibleReqUsers.map((user) => {
                                                                                const totalFiles = Number(user.totalfiles || 0);
                                                                                const approvedCount = totalFiles > 0 ? Number(user.approvedcount || 0) : 0;
                                                                                const rejectedCount = totalFiles > 0 ? Number(user.rejectedcount || 0) : 0;
                                                                                const pendingCount = totalFiles > 0 ? Number(user.pendingcount || 0) : 0;
                                                                                const hasUploaded = totalFiles > 0;
                                                                                const hasRejected = rejectedCount > 0;
                                                                                const isAllApproved = totalFiles > 0 && approvedCount === totalFiles && rejectedCount === 0 && pendingCount === 0;

                                                                                return (
                                                                                    <div
                                                                                        key={user.userid}
                                                                                        className="flex flex-col items-end cursor-pointer group/filepill"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (onViewMySubmission) {
                                                                                                onViewMySubmission(req);
                                                                                            } else if (handleUserAvatarClick) {
                                                                                                handleUserAvatarClick(e, user, req.requirementid);
                                                                                            }
                                                                                        }}
                                                                                        title="Click to view file submissions"
                                                                                    >
                                                                                        {/* Detailed File Status Pills in a column to save horizontal space */}
                                                                                        <div className="flex flex-col items-end gap-1">
                                                                                            {approvedCount > 0 && (
                                                                                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold border border-emerald-200/80 shadow-2xs transition group-hover/filepill:brightness-95 whitespace-nowrap">
                                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                                    {approvedCount} approved
                                                                                                </span>
                                                                                            )}
                                                                                            {pendingCount > 0 && (
                                                                                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 px-2 py-0.5 text-[10px] font-bold border border-amber-200/80 shadow-2xs transition group-hover/filepill:brightness-95 whitespace-nowrap">
                                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                                                    {pendingCount} pending
                                                                                                </span>
                                                                                            )}
                                                                                            {rejectedCount > 0 && (
                                                                                                <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 text-rose-700 px-2 py-0.5 text-[10px] font-bold border border-rose-200/80 shadow-2xs transition group-hover/filepill:brightness-95 whitespace-nowrap">
                                                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                                                                    {rejectedCount} rejected
                                                                                                </span>
                                                                                            )}
                                                                                            {totalFiles === 0 && (
                                                                                                <span className="inline-flex items-center rounded-md bg-slate-50 text-slate-400 px-2 py-0.5 text-[10px] font-medium border border-slate-200 transition group-hover/filepill:brightness-95 whitespace-nowrap">
                                                                                                    0 files
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div className="flex flex-col items-end gap-1">
                                                                        <div className="flex items-center space-x-1">
                                                                            {visibleReqUsers.slice(0, 4).map((user) => {
                                                                                const displayname = `${user.firstname || ''}${user.lastname ? ' ' + user.lastname : ''}`.trim() || user.Username || '';
                                                                                const hasuploaded = isAuditor
                                                                                    ? Number(user.approvedcount ?? user.totalfiles ?? 0) > 0
                                                                                    : (user.hasuploaded === 1 || user.hasuploaded === true);
                                                                                const hasrejected = !isAuditor && (user.hasrejected === true || Number(user.rejectedcount) > 0);
                                                                                const isallapproved = !isAuditor && user.isallapproved === true;
                                                                                return (
                                                                                    <div key={user.userid} className="relative">
                                                                                        <SmartUserAvatar
                                                                                            user={user}
                                                                                            size="h-7 w-7"
                                                                                            textSize="text-[10px]"
                                                                                            title={isAuditor ? displayname : `${displayname}${displayname ? ' • ' : ''}${hasrejected ? 'Needs Revision (Rejected files)' : isallapproved ? 'All Approved' : hasuploaded ? 'Uploaded' : 'Not uploaded'}`}
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleUserAvatarClick(e, user, req.requirementid);
                                                                                            }}
                                                                                            ring={isAuditor ? 'border-2 border-white ring-1 ring-slate-200/50' : `border-2 ring-1 ring-slate-200/50 ${hasrejected ? 'border-rose-500' : hasuploaded ? 'border-emerald-500' : 'border-white'}`}
                                                                                            className="cursor-pointer"
                                                                                        />
                                                                                        {!isAuditor && (
                                                                                            hasrejected ? (
                                                                                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-rose-500 leading-none text-white shadow-xs" title="Needs Revision">
                                                                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                                                                    </svg>
                                                                                                </span>
                                                                                            ) : hasuploaded ? (
                                                                                                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-emerald-500 leading-none text-white shadow-xs" title={isallapproved ? "All approved" : "Uploaded"}>
                                                                                                    <Check className="w-2.5 h-2.5" />
                                                                                                </span>
                                                                                            ) : null
                                                                                        )}
                                                                                    </div>
                                                                                );
                                                                            })}

                                                                            {visibleReqUsers.length > 4 && (
                                                                                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600">
                                                                                    +{visibleReqUsers.length - 4}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Requirement rows: no upload UI here (Evidence panel only). */}

                                                            {isAdmin && (
                                                                <>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRemoveRequirement(req.requirementid);
                                                                        }}
                                                                        disabled={removingReqId === req.requirementid}
                                                                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-medium text-rose-600 shadow-sm transition hover:bg-rose-100"
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Render children nodes */}
                                        {(node.children || []).map((child) => (
                                            <div key={`child-${child.id}`} className="pl-4">
                                                {renderNode(child, depth + 1)}
                                            </div>
                                        ))}
                                    </div>
                                    )}
                                </div>
                            );
                        };

                        const areasToRender = Object.entries(groupedByArea).filter(([, area]) => {
                            // If filters/search are active, ensure at least one matching node exists
                            if (!searchTerm && statusFilter === 'all') return true;
                            return Object.values(area.criteriaMap).some((node) => nodeHasMatches(node));
                        });

                        if (areasToRender.length === 0) {
                            return (
                                <div className="py-12 text-center">
                                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-300/60">
                                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-slate-700">No standards found</p>
                                    <p className="mt-1 text-xs text-slate-500">Try adjusting your search or filter.</p>
                                </div>
                            );
                        }

                        const allAreaKeys = areasToRender.map(([k]) => k);
                        const isAllExpanded = allAreaKeys.length > 0 && allAreaKeys.every((k) => expandedAreas.has(k));

                        return (
                            <div className="space-y-4">
                                {/* Global Expand / Collapse All Areas Action */}
                                {areasToRender.length > 1 && (
                                    <div className="flex items-center justify-between px-1 pb-1">
                                        <span className="text-xs font-semibold text-slate-500">
                                            Showing {areasToRender.length} Areas
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (isAllExpanded) {
                                                    setExpandedAreas(new Set());
                                                } else {
                                                    setExpandedAreas(new Set(allAreaKeys));
                                                }
                                            }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200/80 rounded-lg transition-colors cursor-pointer"
                                        >
                                            <svg
                                                className={`h-3.5 w-3.5 transition-transform duration-200 ${isAllExpanded ? 'rotate-180' : 'rotate-0'}`}
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                            <span>{isAllExpanded ? 'Collapse All Areas' : 'Expand All Areas'}</span>
                                        </button>
                                    </div>
                                )}

                                {areasToRender.map(([areaKey, area]) => {
                                    // Find root criteria nodes (no parent or parent not in same map)
                                    const allNodes = Object.values(area.criteriaMap || {});
                                    const roots = allNodes.filter((n) => !n.parentId || !area.criteriaMap[n.parentId]);
                                    const isExpanded = expandedAreas.has(areaKey) || (Boolean(searchTerm) || statusFilter !== 'all' || (submissionFilter && submissionFilter !== 'all'));
                                    const reqCount = Object.values(area.criteriaMap || {}).reduce(
                                        (acc, c) => acc + (c.requirements || []).length,
                                        0
                                    );

                                    // Personnel assigned to this Area
                                    const areaId = Number(area.id || area.areaid);
                                    const directAreaUsers = personnelMap.areas[areaId] || [];
                                    const directAreaUserIds = new Set(directAreaUsers.map((u) => Number(u.userid)));

                                    const childAreaUsersMap = new Map();
                                    allNodes.forEach((node) => {
                                        const critUsers = personnelMap.criteria[Number(node.id)] || [];
                                        critUsers.forEach((u) => {
                                            const uid = Number(u.userid);
                                            if (!directAreaUserIds.has(uid) && !childAreaUsersMap.has(uid)) {
                                                childAreaUsersMap.set(uid, {
                                                    ...u,
                                                    source: 'Sub-areas'
                                                });
                                            }
                                        });
                                        (node.requirements || []).forEach((r) => {
                                            const fromMap = assignedUsersMap[r.requirementid] || [];
                                            const fromPa = personnelMap.requirements[Number(r.requirementid)] || [];
                                            [...fromMap, ...fromPa].forEach((u) => {
                                                const uid = Number(u.userid);
                                                if (!directAreaUserIds.has(uid) && !childAreaUsersMap.has(uid)) {
                                                    childAreaUsersMap.set(uid, {
                                                        ...u,
                                                        fullname: `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email || `User #${u.userid}`,
                                                        source: 'Standards'
                                                    });
                                                }
                                            });
                                        });
                                    });
                                    const childAreaUsers = Array.from(childAreaUsersMap.values());
                                    const visibleDirectAreaUsers = (isAdmin || isAuditor) ? directAreaUsers : directAreaUsers.filter((u) => Number(u.userid) === currentUid);
                                    const visibleChildAreaUsers = (isAdmin || isAuditor) ? childAreaUsers : childAreaUsers.filter((u) => Number(u.userid) === currentUid);
                                    const isAreaAssignedToMe = directAreaUsers.some(
                                        (u) => Number(u.userid) === Number(currentUser?.userid ?? currentUser?.id)
                                    );

                                    return (
                                        <div key={areaKey} className="space-y-3">
                                            {/* Drop Expand Area Banner Button */}
                                            <button
                                                type="button"
                                                onClick={() => toggleArea(areaKey)}
                                                className="w-full text-left rounded-xl bg-gradient-to-r from-blue-600 via-blue-700 to-sky-700 px-4 py-3 shadow-md shadow-blue-500/15 hover:brightness-105 active:scale-[0.998] transition-all flex items-center justify-between gap-3 cursor-pointer group"
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h3 className="text-sm font-semibold tracking-wide text-white">{area.code}</h3>
                                                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white/90">
                                                            {reqCount} {reqCount === 1 ? 'item' : 'items'}
                                                        </span>
                                                        {isAreaAssignedToMe && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/80 px-2 py-0.5 text-[9px] font-bold text-white border border-emerald-400/40 shadow-2xs whitespace-nowrap">
                                                                <Check className="w-2.5 h-2.5" />
                                                                <span>Assigned to you</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="mt-0.5 text-xs leading-snug text-violet-100 truncate">{area.name}</p>

                                                    {/* Assigned Personnel Markings for Area */}
                                                    {(visibleDirectAreaUsers.length > 0 || visibleChildAreaUsers.length > 0) && (
                                                        <div className="flex items-center gap-1.5 flex-wrap mt-2" onClick={(e) => e.stopPropagation()}>
                                                            {/* Directly Assigned to Area */}
                                                            {visibleDirectAreaUsers.slice(0, 4).map((person) => (
                                                                <div
                                                                    key={`area-direct-${person.userid}`}
                                                                    className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white rounded-full pl-1 pr-2.5 py-0.5 border border-white/30 shadow-2xs transition"
                                                                    title={`Directly assigned to Area: ${person.fullname}`}
                                                                >
                                                                    <SmartUserAvatar
                                                                        user={person}
                                                                        size="w-4 h-4"
                                                                        textSize="text-[8px]"
                                                                        className="ring-1 ring-white shrink-0"
                                                                    />
                                                                    <span className="text-[10px] font-medium leading-none truncate max-w-[130px]">
                                                                        {person.fullname}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {visibleDirectAreaUsers.length > 4 && (
                                                                <span
                                                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/20 text-white"
                                                                    title={visibleDirectAreaUsers.slice(4).map((p) => p.fullname).join(', ')}
                                                                >
                                                                    +{visibleDirectAreaUsers.length - 4}
                                                                </span>
                                                            )}

                                                            {/* Child Assigned in Sub-areas or Standards */}
                                                            {visibleChildAreaUsers.slice(0, 4).map((person) => (
                                                                <div
                                                                    key={`area-child-${person.userid}`}
                                                                    className="inline-flex items-center gap-1.5 bg-amber-400/25 hover:bg-amber-400/35 text-amber-100 rounded-full pl-1 pr-2.5 py-0.5 border border-amber-300/40 shadow-2xs transition"
                                                                    title={`Assigned to ${person.source.toLowerCase()}: ${person.fullname}`}
                                                                >
                                                                    <SmartUserAvatar
                                                                        user={person}
                                                                        size="w-4 h-4"
                                                                        textSize="text-[8px]"
                                                                        className="ring-1 ring-amber-200 shrink-0"
                                                                    />
                                                                    <span className="text-[10px] font-medium leading-none truncate max-w-[140px]">
                                                                        {person.fullname} <span className="text-amber-200/80 text-[9px]">({person.source})</span>
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {visibleChildAreaUsers.length > 4 && (
                                                                <span
                                                                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/25 text-amber-100 border border-amber-300/40"
                                                                    title={visibleChildAreaUsers.slice(4).map((p) => p.fullname).join(', ')}
                                                                >
                                                                    +{visibleChildAreaUsers.length - 4}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] font-semibold text-violet-200 opacity-90 group-hover:opacity-100 transition-opacity">
                                                        {isExpanded ? 'Collapse' : 'Expand'}
                                                    </span>
                                                    <div className="h-7 w-7 rounded-lg bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
                                                        <svg
                                                            className={`h-4 w-4 text-white transition-transform duration-200 ease-in-out ${
                                                                isExpanded ? 'rotate-180' : 'rotate-0'
                                                            }`}
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                            stroke="currentColor"
                                                            strokeWidth={2.5}
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>
                                                </div>
                                            </button>

                                            {isExpanded && (
                                                <div className="space-y-3 pl-1 sm:pl-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                                    {roots.map((root) => (
                                                        <div key={`root-${root.id}`}>{renderNode(root)}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
