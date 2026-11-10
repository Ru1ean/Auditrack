import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Calendar, Plus, UserPlus, Lock, Unlock, BellRing, CalendarClock } from 'lucide-react';
import AreaSection from './AreaSection';
import CriteriaSection from './CriteriaSection';
import RequirementsSection from './RequirementsSection';
import AddAreaPop from './addareapop';
import EditAreaModal from '../EditArea/EditArea';
import EditCriteriaModal from '../Criteria/EditCriteriaModal';
import EditRequirementsModal from '../Requirement/EditRequirementsModal';
import AssignPersonnelModal from './AssignPersonnelModal';
import AssignPersonnelScopeModal from '../OfficeHead/AssignPersonnelScopeModal';
import { usersAPI, officesAPI, personnelAssignmentsAPI, eventsAPI } from '../../utils/api';
import { getDeadlineInfo } from '../../utils/deadlineHelpers';
import { useModal } from "../UI/ModalProvider";
import { useToast } from "../UI/Toast";

import { formatDateTime } from '../../utils/formatDateTime';
import { API_BASE_URL } from '../../utils/apiBase';

export default function EventPopup({
    selectedEvent,
    areasData,
    criteriaData,
    requirementsData,
    noAreaCriteriaData,
    criteriaOptions,
    expandedAreas,
    expandedCriteria,
    expandedNoArea,
    loadingAreas,
    loadingCriteria,
    loadingRequirements,
    loadingNoAreaCriteria,
    onClose,
    onToggleArea,
    onToggleCriteria,
    onToggleNoArea,
    onAddArea,
    onAddNoAreaCriteria,
    onAddCriteria,
    onAddRequirement,
    onLoadRequirementsByCriteria,
    onPrepareStructureData,
    onEditArea,
    onEditCriteria,
    onBulkDelete,
    onEditEvent,
    onCopyEvent,
    isAdmin: isAdminProp
}) {
    const { showConfirm, showAlert } = useModal();
    const { toast } = useToast();

    const [isActionOpen, setIsActionOpen] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAreaIds, setSelectedAreaIds] = useState(new Set());
    const [selectedCriteriaIds, setSelectedCriteriaIds] = useState(new Set());
    const [sendingReminder, setSendingReminder] = useState(false);

    const deadlineInfo = useMemo(() => getDeadlineInfo(selectedEvent?.deadline, selectedEvent), [selectedEvent]);

    const handleSendManualReminder = async () => {
        if (!selectedEvent?.eventid || sendingReminder) return;
        setSendingReminder(true);
        try {
            const res = await eventsAPI.sendReminder(selectedEvent.eventid);
            if (res?.success) {
                toast({
                    title: 'Countdown Reminder Sent',
                    description: res.message || `Notified ${res.recipientCount || 0} assigned personnel.`,
                    variant: 'success'
                });
            }
        } catch (err) {
            toast({
                title: 'Reminder Failed',
                description: err?.response?.data?.message || 'Could not send deadline reminder.',
                variant: 'error'
            });
        } finally {
            setSendingReminder(false);
        }
    };
    const [selectedRequirementIds, setSelectedRequirementIds] = useState(new Set());
    const [isEditAreaOpen, setIsEditAreaOpen] = useState(false);
    const [editAreaData, setEditAreaData] = useState(null);
    const [isEditCriteriaOpen, setIsEditCriteriaOpen] = useState(false);
    const [editCriteriaData, setEditCriteriaData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isEditRequirementOpen, setIsEditRequirementOpen] = useState(false);
    const [editRequirementData, setEditRequirementData] = useState(null);
    const [offices, setOffices] = useState([]);
    const [loadingOffices, setLoadingOffices] = useState(false);
    const [officeSearch, setOfficeSearch] = useState('');
    const [activeOfficeTab, setActiveOfficeTab] = useState("All");

    // Personnel assignments state
    const [personnelAssignments, setPersonnelAssignments] = useState([]);
    const [myAssignedScope, setMyAssignedScope] = useState({ areaIds: new Set(), criteriaIds: new Set(), requirementIds: new Set() });
    const [assignModal, setAssignModal] = useState({ open: false, targetType: null, target: null });
    const [isAssignScopeModalOpen, setIsAssignScopeModalOpen] = useState(false);

    const fetchPersonnelAssignments = useCallback(async () => {
        if (!selectedEvent?.eventid) return;
        try {
            const res = await personnelAssignmentsAPI.getByEvent(selectedEvent.eventid);
            if (res?.success) setPersonnelAssignments(res.data || []);
        } catch (err) {
            console.warn('Failed to load personnel assignments:', err);
        }
    }, [selectedEvent?.eventid]);

    const fetchMyAssignments = useCallback(async () => {
        try {
            const res = await personnelAssignmentsAPI.getMyAssignments();
            if (res?.success) {
                setMyAssignedScope({
                    areaIds: new Set(res.assignedAreaIds || []),
                    criteriaIds: new Set(res.assignedCriteriaIds || []),
                    requirementIds: new Set(res.assignedRequirementIds || [])
                });
            }
        } catch (err) {}
    }, []);

    useEffect(() => {
        fetchPersonnelAssignments();
        fetchMyAssignments();
    }, [fetchPersonnelAssignments, fetchMyAssignments]);

    const currentUid = Number(currentUser?.userid ?? currentUser?.id ?? 0);
    const { assignedCounts, assignedPersonnelMap } = useMemo(() => {
        const counts = { areas: {}, criteria: {}, requirements: {} };
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
                counts.areas[aid] = (counts.areas[aid] || 0) + 1;
                if (!map.areas[aid]) map.areas[aid] = [];
                if (!map.areas[aid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.areas[aid].push(userObj);
                }
            } else if (pa.criteriaid && !pa.requirementid) {
                const cid = Number(pa.criteriaid);
                counts.criteria[cid] = (counts.criteria[cid] || 0) + 1;
                if (!map.criteria[cid]) map.criteria[cid] = [];
                if (!map.criteria[cid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.criteria[cid].push(userObj);
                }
            } else if (pa.requirementid) {
                const rid = Number(pa.requirementid);
                counts.requirements[rid] = (counts.requirements[rid] || 0) + 1;
                if (!map.requirements[rid]) map.requirements[rid] = [];
                if (!map.requirements[rid].some(u => Number(u.userid) === Number(pa.userid))) {
                    map.requirements[rid].push(userObj);
                }
            }
        });

        return { assignedCounts: counts, assignedPersonnelMap: map };
    }, [personnelAssignments]);

    // Helper to find all personnel assigned to children of an area
    const getChildPersonnelForArea = useCallback((areaid, criteriaList = []) => {
        const directUsers = assignedPersonnelMap.areas[Number(areaid)] || [];
        const directUserIds = new Set(directUsers.map(u => Number(u.userid)));
        const childUsersMap = new Map();

        (criteriaList || []).forEach(crit => {
            const critId = Number(crit.criteriaid);
            const critUsers = assignedPersonnelMap.criteria[critId] || [];
            critUsers.forEach(u => {
                if (!directUserIds.has(Number(u.userid)) && !childUsersMap.has(Number(u.userid))) {
                    childUsersMap.set(Number(u.userid), u);
                }
            });

            const reqs = requirementsData[critId] || [];
            reqs.forEach(r => {
                const reqUsers = assignedPersonnelMap.requirements[Number(r.requirementid)] || [];
                reqUsers.forEach(u => {
                    if (!directUserIds.has(Number(u.userid)) && !childUsersMap.has(Number(u.userid))) {
                        childUsersMap.set(Number(u.userid), u);
                    }
                });
            });
        });

        return Array.from(childUsersMap.values());
    }, [assignedPersonnelMap, requirementsData]);

    // Helper to find all personnel assigned to child standards of a criteria
    const getChildPersonnelForCriteria = useCallback((criteriaid) => {
        const directUsers = assignedPersonnelMap.criteria[Number(criteriaid)] || [];
        const directUserIds = new Set(directUsers.map(u => Number(u.userid)));
        const childUsersMap = new Map();

        const reqs = requirementsData[Number(criteriaid)] || [];
        reqs.forEach(r => {
            const reqUsers = assignedPersonnelMap.requirements[Number(r.requirementid)] || [];
            reqUsers.forEach(u => {
                if (!directUserIds.has(Number(u.userid)) && !childUsersMap.has(Number(u.userid))) {
                    childUsersMap.set(Number(u.userid), u);
                }
            });
        });

        return Array.from(childUsersMap.values());
    }, [assignedPersonnelMap, requirementsData]);

    const formatDateString = (dateStr) => {
        if (!dateStr) return "N/A";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "N/A";
            return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });
        } catch {
            return "N/A";
        }
    };

    const filteredOffices = useMemo(() => {
        let list = offices || [];
        
        // Filter by tab
        if (activeOfficeTab === "Programs") {
            list = list.filter(o => o.entitytypeid === 1 || String(o.category_name || o.typename || "").toLowerCase().includes("academic program") || String(o.category_name || o.typename || "").toLowerCase().includes("program"));
        } else if (activeOfficeTab === "Offices") {
            list = list.filter(o => o.entitytypeid === 2 || String(o.category_name || o.typename || "").toLowerCase().includes("non-academic") || String(o.category_name || o.typename || "").toLowerCase().includes("office"));
        }

        // Filter by search query
        const query = officeSearch.trim().toLowerCase();
        if (!query) return list;

        return list.filter(o => {
            const name = String(o.officename || o.officename || "").toLowerCase();
            const dept = String(o.department_name || "").toLowerCase();
            return name.includes(query) || dept.includes(query);
        });
    }, [offices, officeSearch, activeOfficeTab]);

    const [selectedOfficeIdsLocal, setSelectedOfficeIdsLocal] = useState(new Set());
    const [assignedAreaIds, setAssignedAreaIds] = useState(new Set());

    const roleid = Number(currentUser?.roleid);
    const rolename = String(currentUser?.rolename || '').toLowerCase();

    const isAuditor = roleid === 4 || 
                      rolename.includes('auditor') || 
                      Boolean(currentUser?.isExternalAuditor);

    const isPersonnel = roleid === 2 || 
                        roleid === 3 || 
                        rolename.includes('office') || 
                        rolename === 'user' || 
                        rolename === 'personnel' || 
                        rolename === 'head';

    const isAdmin = !isAuditor && !isPersonnel && (
        isAdminProp !== undefined 
            ? Boolean(isAdminProp) 
            : (roleid === 1 || rolename === 'admin')
    );

    const canEdit = isAdmin;

    useEffect(() => {
        let mounted = true;
        const fetchCurrentUser = async () => {
            try {
                const res = await usersAPI.getLoggedInUser();
                if (mounted && res) setCurrentUser(res.user || res);
            } catch (err) {
                // ignore
            }
        };
        fetchCurrentUser();
        return () => { mounted = false; };
    }, []);

    useEffect(() => {
        if (!currentUser || !isAuditor) return;
        let mounted = true;
        const fetchAssignments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/areas/assignments/${currentUser.userid}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (mounted && res.ok && data.success) {
                    const ids = new Set((data.assignments || []).map(a => Number(a.areaid)));
                    setAssignedAreaIds(ids);
                }
            } catch (e) {}
        };
        fetchAssignments();
        return () => { mounted = false; };
    }, [currentUser, isAuditor]);

    // load offices for the selected event
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!selectedEvent) return;
            try {
                setLoadingOffices(true);
                const all = await officesAPI.getAll();
                if (!mounted) return;
                const forEvent = (all || []).filter(o => Number(o.eventid) === Number(selectedEvent.eventid) || Number(o.eventid) === Number(selectedEvent.eventid));
                setOffices(forEvent);
            } catch (err) {
                console.error('Failed to load offices', err);
                if (mounted) setOffices([]);
            } finally {
                if (mounted) setLoadingOffices(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [selectedEvent]);

    if (!selectedEvent) return null;

    const normalizedSearch = searchTerm.trim().toLowerCase();
    const hasSearch = normalizedSearch.length > 0;

    const matchesSearch = (...values) => {
        if (!hasSearch) return true;
        return values.some(value => String(value || '').toLowerCase().includes(normalizedSearch));
    };

    const getFilteredRequirementsForCriteria = (criteriaid) => {
        const requirements = requirementsData[criteriaid] || [];
        if (!hasSearch) return requirements;
        return requirements.filter(req =>
            matchesSearch(req.requirementcode, req.Description)
        );
    };

    const getFilteredCriteria = (criteriaList = []) => {
        if (!hasSearch) return criteriaList;
        return criteriaList.filter(crit => {
            const matchingRequirements = getFilteredRequirementsForCriteria(crit.criteriaid);
            return (
                matchesSearch(crit.criteriacode, crit.criterianame, crit.Description) ||
                matchingRequirements.length > 0
            );
        });
    };

    const allAreasForEvent = (areasData[selectedEvent.eventid] || []).slice().sort((a, b) => {
        const aCode = String(a.areacode || a.areaname || '').trim();
        const bCode = String(b.areacode || b.areaname || '').trim();
        return aCode.localeCompare(bCode, undefined, { numeric: true, sensitivity: 'base' });
    });
    const visibleAreas = allAreasForEvent.filter(area => {
        // Scoping for Auditors: only show assigned area(s)
        if (isAuditor) {
            const isAssigned = assignedAreaIds.has(Number(area.areaid));
            if (!isAssigned) return false;
        }

        if (!hasSearch) return true;
        const matchingCriteria = getFilteredCriteria(criteriaData[area.areaid] || []);
        return (
            matchesSearch(area.areacode, area.areaname, area.Description) ||
            matchingCriteria.length > 0
        );
    });

    const noAreaCriteriaAll = noAreaCriteriaData[selectedEvent.eventid] || [];
    const visibleNoAreaCriteria = isAuditor ? [] : getFilteredCriteria(noAreaCriteriaAll);
    const hasAnyVisibleResults = visibleAreas.length > 0 || visibleNoAreaCriteria.length > 0;

    const resetSelection = () => {
        setSelectedAreaIds(new Set());
        setSelectedCriteriaIds(new Set());
        setSelectedRequirementIds(new Set());
    };

    const enterDeleteMode = () => {
        setDeleteMode(true);
        setDeleteError('');
        setIsActionMenuOpen(false);
        setIsActionOpen(false);
        resetSelection();
    };

    const exitDeleteMode = () => {
        setDeleteMode(false);
        setDeleteError('');
        resetSelection();
    };

    const toggleRequirementSelect = (requirement, checked) => {
        const reqId = Number(requirement.requirementid);
        setSelectedRequirementIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(reqId);
            else next.delete(reqId);
            return next;
        });
    };

    const toggleCriteriaSelect = (criteria, checked) => {
        const criteriaid = Number(criteria.criteriaid);
        const requirementIds = (requirementsData[criteriaid] || []).map(req => Number(req.requirementid));

        setSelectedCriteriaIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(criteriaid);
            else next.delete(criteriaid);
            return next;
        });

        setSelectedRequirementIds(prev => {
            const next = new Set(prev);
            requirementIds.forEach(reqId => {
                if (checked) next.add(reqId);
                else next.delete(reqId);
            });
            return next;
        });
    };

    const toggleAreaSelect = (area, checked) => {
        const areaid = Number(area.areaid);
        const criteria = criteriaData[areaid] || [];
        const criteriaIds = criteria.map(crit => Number(crit.criteriaid));
        const requirementIds = criteria.flatMap(crit =>
            (requirementsData[Number(crit.criteriaid)] || []).map(req => Number(req.requirementid))
        );

        setSelectedAreaIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(areaid);
            else next.delete(areaid);
            return next;
        });

        setSelectedCriteriaIds(prev => {
            const next = new Set(prev);
            criteriaIds.forEach(criteriaid => {
                if (checked) next.add(criteriaid);
                else next.delete(criteriaid);
            });
            return next;
        });

        setSelectedRequirementIds(prev => {
            const next = new Set(prev);
            requirementIds.forEach(reqId => {
                if (checked) next.add(reqId);
                else next.delete(reqId);
            });
            return next;
        });
    };

    const toggleOfficeSelect = (office, checked) => {
        const id = Number(office.id || office.officeid || office.officeid || office.officeid);
        setSelectedOfficeIdsLocal(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const deleteCount = selectedAreaIds.size + selectedCriteriaIds.size + selectedRequirementIds.size;

    const handleBulkDelete = async () => {
        if (deleteCount === 0 || deleting) return;
        const confirmed = await showConfirm('Delete selected items? This action cannot be undone.');
        if (!confirmed) return;

        const countAreas = selectedAreaIds.size;
        const countCriteria = selectedCriteriaIds.size;
        const countRequirements = selectedRequirementIds.size;

        try {
            setDeleting(true);
            setDeleteError('');
            await onBulkDelete?.({
                eventid: selectedEvent.eventid,
                areaIds: Array.from(selectedAreaIds),
                criteriaIds: Array.from(selectedCriteriaIds),
                requirementIds: Array.from(selectedRequirementIds)
            });
            const parts = [];
            if (countAreas > 0) parts.push(`${countAreas} area${countAreas > 1 ? 's' : ''}`);
            if (countCriteria > 0) parts.push(`${countCriteria} sub area${countCriteria > 1 ? 's' : ''}`);
            if (countRequirements > 0) parts.push(`${countRequirements} standard${countRequirements > 1 ? 's' : ''}`);
            const desc = parts.length > 0 ? `${parts.join(', ')} deleted successfully.` : 'Items deleted successfully.';
            toast?.({ title: 'Success', description: desc, variant: 'success' });
            exitDeleteMode();
        } catch (err) {
            const errorMsg = err?.message || 'Failed to delete selected items.';
            setDeleteError(errorMsg);
            toast?.({ title: 'Error', description: errorMsg, variant: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const handleSingleDelete = async ({ areaIds = [], criteriaIds = [], requirementIds = [] }) => {
        if (deleting) return;
        const confirmed = await showConfirm('Delete this item? This action cannot be undone.');
        if (!confirmed) return;
        try {
            setDeleting(true);
            setDeleteError('');
            await onBulkDelete?.({
                eventid: selectedEvent.eventid,
                areaIds,
                criteriaIds,
                requirementIds
            });
            if (areaIds.length > 0) {
                toast?.({ title: 'Success', description: 'Area deleted successfully.', variant: 'success' });
            } else if (criteriaIds.length > 0) {
                toast?.({ title: 'Success', description: 'Sub area deleted successfully.', variant: 'success' });
            } else if (requirementIds.length > 0) {
                toast?.({ title: 'Success', description: 'Standard deleted successfully.', variant: 'success' });
            }
        } catch (err) {
            const errorMsg = err?.message || 'Failed to delete item.';
            await showAlert(errorMsg);
            toast?.({ title: 'Error', description: errorMsg, variant: 'error' });
        } finally {
            setDeleting(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-black/50 backdrop-blur-xs z-[60] flex flex-col">
            <div className="bg-white w-full h-full overflow-hidden shadow-2xl flex flex-col">
                <div className="relative border-b border-slate-200/80 bg-white px-5 py-4 shadow-sm shrink-0">
                    {/* Accent bar */}
                    <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

                    <div className="flex items-center justify-between gap-4">
                        {/* Left: icon + name + meta */}
                        <div className="flex min-w-0 items-center gap-3.5">
                            {/* Icon */}
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 shadow-sm">
                                <Calendar className="h-5 w-5" />
                            </div>

                            {/* Name + meta */}
                            <div className="min-w-0">
                                <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 leading-snug">
                                    {selectedEvent.eventcode || selectedEvent.eventname}
                                </h2>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                    {selectedEvent.eventname && selectedEvent.eventname !== selectedEvent.eventcode && (
                                        <span className="text-xs font-medium text-slate-500 truncate max-w-xs md:max-w-md">
                                            {selectedEvent.eventname}
                                        </span>
                                    )}
                                    {selectedEvent.eventname && selectedEvent.eventname !== selectedEvent.eventcode && (
                                        <span className="text-slate-300">·</span>
                                    )}
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200/80">
                                        Created: {formatDateTime(selectedEvent.createdat)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200/80">
                                        Updated: {formatDateTime(selectedEvent.updatedat || selectedEvent.createdat)}
                                    </span>
                                    {selectedEvent.accreditationlevel && selectedEvent.accreditationlevel.toUpperCase() !== 'N/A' && (
                                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80">
                                            {selectedEvent.accreditationlevel}
                                        </span>
                                    )}
                                    {deadlineInfo.hasDeadline && (
                                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${deadlineInfo.badgeClasses}`}>
                                            <CalendarClock className="h-3 w-3 shrink-0" />
                                            {deadlineInfo.label}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right: actions + close */}
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {isAdmin && (
                                <button
                                    type="button"
                                    disabled={sendingReminder}
                                    onClick={handleSendManualReminder}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 shadow-2xs transition-all hover:bg-blue-100 active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="Send countdown reminder notification to all assigned personnel"
                                >
                                    <BellRing className="w-3.5 h-3.5 shrink-0" />
                                    <span>{sendingReminder ? 'Sending...' : 'Send Reminder'}</span>
                                </button>
                            )}
                            {/* Primary Assign Personnel Button */}
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setIsAssignScopeModalOpen(true)}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-indigo-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                    title="Assign Personnel"
                                    aria-label="Assign Personnel"
                                >
                                    <UserPlus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                                    <span>Assign Personnel</span>
                                </button>
                            )}
                            {isAdmin && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onPrepareStructureData?.();
                                        setIsActionOpen(true);
                                    }}
                                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                                    title="Manage Accreditation"
                                    aria-label="Manage Accreditation"
                                >
                                    <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                                    <span>Manage Accreditation</span>
                                </button>
                            )}
                            {isAdmin && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsActionMenuOpen(prev => !prev)}
                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95 cursor-pointer ${isActionMenuOpen ? 'bg-slate-100 text-slate-900 border-slate-300' : ''}`}
                                        title="More actions"
                                        aria-label="More actions"
                                    >
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle cx="12" cy="5" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="12" cy="19" r="2" />
                                        </svg>
                                    </button>
                                    {isActionMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsActionMenuOpen(false)} />
                                            <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsAssignScopeModalOpen(true);
                                                        setIsActionMenuOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition whitespace-nowrap cursor-pointer"
                                                >
                                                    <UserPlus className="h-4 w-4 text-indigo-600 shrink-0" />
                                                    <span>Assign Personnel</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onEditEvent?.(selectedEvent);
                                                        setIsActionMenuOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    <span>Edit Accreditation</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onCopyEvent?.(selectedEvent);
                                                        setIsActionMenuOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition whitespace-nowrap cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Copy Accreditation</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onPrepareStructureData?.();
                                                        setIsActionOpen(true);
                                                        setIsActionMenuOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition whitespace-nowrap cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                                                    </svg>
                                                    <span>Manage Structure</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        enterDeleteMode();
                                                        setIsActionMenuOpen(false);
                                                    }}
                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap cursor-pointer"
                                                >
                                                    <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                                    </svg>
                                                    <span>Delete Items</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95 cursor-pointer"
                                aria-label="Close"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {deleteMode && (
                    <div className="flex items-center justify-between px-8 py-3 bg-red-50 border-b border-red-200">
                        <p className="text-sm text-red-700">
                            Delete mode active. Select areas, criteria, or requirements then click delete.
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={exitDeleteMode}
                                className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={deleteCount === 0 || deleting}
                                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {deleting ? 'Deleting...' : `Delete (${deleteCount})`}
                            </button>
                        </div>
                    </div>
                )}
                {deleteMode && deleteError && (
                    <div className="px-8 py-2 bg-red-100 border-b border-red-200 text-sm text-red-700">
                        {deleteError}
                    </div>
                )}

                {/* Hierarchy + Offices sidebar inside modal */}
                <div className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
                    <div className="flex gap-6 h-full min-h-[300px]">
                        {/* Left Side: Programs and Offices Panel */}
                        <div className="w-1/3 border-r border-slate-200 pr-4 overflow-y-auto flex flex-col h-full min-h-0">
                            <div className="py-2 flex-1 flex flex-col min-h-0">
                                <div className="sticky top-0 z-10 bg-white pt-2 pb-3 shrink-0 flex flex-col gap-2">
                                    <h4 className="text-sm font-bold text-slate-800">Programs and Offices</h4>
                                    <input
                                        type="text"
                                        value={officeSearch}
                                        onChange={(e) => setOfficeSearch(e.target.value)}
                                        placeholder="Search programs and offices..."
                                        className="h-9 w-full rounded-md border border-slate-200 px-3 text-xs text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-100/50 focus:bg-white transition-all shadow-sm"
                                    />
                                    
                                    {/* Programs & Offices Filtering Tabs */}
                                    <div className="flex border-b border-slate-200 mt-1">
                                        {["All", "Programs", "Offices"].map((tab) => {
                                            const isSelected = activeOfficeTab === tab;
                                            return (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    onClick={() => setActiveOfficeTab(tab)}
                                                    className={`pb-1.5 px-3 text-[11px] font-semibold transition-all border-b-2 -mb-[1.5px] ${
                                                        isSelected 
                                                            ? 'border-blue-600 text-blue-600' 
                                                            : 'border-transparent text-slate-500 hover:text-slate-800'
                                                    }`}
                                                >
                                                    {tab}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pr-1 pt-1 min-h-0">
                                    {loadingOffices ? (
                                        <div className="text-xs text-slate-400 text-center py-4">Loading programs and offices...</div>
                                    ) : filteredOffices.length === 0 ? (
                                        <div className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-100 rounded-lg">
                                            {officeSearch ? "No matching records found" : "No programs or offices assigned"}
                                        </div>
                                    ) : (
                                        filteredOffices.map((office) => {
                                            const isAcademic = office.entitytypeid === 1 || String(office.category_name || office.typename || "").toLowerCase().includes("academic program") || String(office.category_name || office.typename || "").toLowerCase().includes("program");
                                            return (
                                                <div
                                                    key={office.id || office.officeid || office.officeid}
                                                    className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col gap-2.5 animate-fadeIn"
                                                >
                                                    {/* Header with Icon, Name, and Actions */}
                                                    <div className="flex items-start justify-between gap-2.5">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            {/* Icon */}
                                                            {isAcademic ? (
                                                                <div className="h-9 w-9 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100">
                                                                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A57.778 57.778 0 0012 13.5" />
                                                                    </svg>
                                                                </div>
                                                            ) : (
                                                                <div className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                                                                    <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 16.5h1.5m3 0H15M9 21v-3a1 1 0 011-1h4a1 1 0 011 1v3" />
                                                                    </svg>
                                                                </div>
                                                            )}
                                                            
                                                            {/* Name and Subtitle */}
                                                            <div className="min-w-0">
                                                                <h5 className="text-xs font-bold text-slate-800 truncate leading-snug">
                                                                    {office.officename || office.officename}
                                                                </h5>
                                                                <p className="text-[10px] text-slate-500 truncate mt-0.5 leading-normal">
                                                                    {office.department_name || 'Institution-wide'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Static visual 3-dot dropdown for matching look (Admin only) */}
                                                        {canEdit && (
                                                            <div className="shrink-0">
                                                                <button
                                                                    type="button"
                                                                    className="h-7 w-7 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-2xs flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
                                                                    aria-label="Office options"
                                                                >
                                                                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                                        <circle cx="12" cy="5" r="2" />
                                                                        <circle cx="12" cy="12" r="2" />
                                                                        <circle cx="12" cy="19" r="2" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Timestamps Grid */}
                                                    <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 text-[9px] text-slate-400 font-semibold tracking-wider">
                                                        <div>
                                                            <p className="uppercase text-slate-400 font-bold mb-0.5">Created</p>
                                                            <p className="text-slate-655 font-bold">{formatDateString(office.createdat)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="uppercase text-slate-400 font-bold mb-0.5">Updated</p>
                                                            <p className="text-slate-655 font-bold">{formatDateString(office.updatedat)}</p>
                                                        </div>
                                                    </div>

                                                    {/* Bottom Badges Row */}
                                                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-50">
                                                        <div className="flex items-center gap-1">
                                                            <span className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold border ${
                                                                isAcademic
                                                                    ? 'bg-blue-50 text-blue-700 border-blue-150'
                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-150'
                                                            }`}>
                                                                {isAcademic ? 'Academic Program' : 'Non-Academic Office'}
                                                            </span>
                                                            {isAcademic && office.accreditationlevel && office.accreditationlevel !== 'None' && (
                                                                <span className="px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    {office.accreditationlevel}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {office.department_name || 'Institution-wide'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Areas & Hierarchy Tree */}
                        <div className="w-2/3 flex-1 pl-2 overflow-y-auto min-w-0">
                            <div className="sticky top-0 z-10 bg-white pt-3 pb-2">
                                <h4 className="text-sm font-semibold text-slate-700 mb-2">Areas</h4>
                                <input
                                    type="text"
                                    className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm text-slate-700 shadow-sm focus:outline-none"
                                    placeholder="Search areas, sub areas, or standards..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="mt-2 pt-2">
                                {loadingAreas.has(selectedEvent.eventid) ? (
                                    <div className="text-center text-gray-500">Loading areas...</div>
                                ) : allAreasForEvent.length === 0 ? (
                                    <div className="text-center text-gray-500">No areas found for this accreditation</div>
                                ) : hasSearch && !hasAnyVisibleResults ? (
                                    <div className="text-center text-gray-500">No matching results</div>
                                ) : (
                                    <div className="space-y-3">
                                        {visibleAreas.map((area) => {
                                            const areaId = Number(area.areaid);
                                            const areaCriteria = getFilteredCriteria(criteriaData[area.areaid] || []);
                                            const areaAssignedUsers = assignedPersonnelMap.areas[areaId] || [];
                                            const areaChildUsers = getChildPersonnelForArea(areaId, criteriaData[area.areaid] || []);
                                            const visibleAreaAssignedUsers = (isAdmin || isAuditor)
                                                ? areaAssignedUsers
                                                : areaAssignedUsers.filter((u) => Number(u.userid) === currentUid);
                                            const visibleAreaChildUsers = (isAdmin || isAuditor)
                                                ? areaChildUsers
                                                : areaChildUsers.filter((u) => Number(u.userid) === currentUid);

                                            return (
                                                <AreaSection
                                                    key={area.areaid}
                                                    area={area}
                                                    isExpanded={expandedAreas.has(area.areaid)}
                                                    onToggle={() => onToggleArea(area.areaid)}
                                                    loading={loadingCriteria.has(area.areaid)}
                                                    showCheckbox={deleteMode}
                                                    isChecked={selectedAreaIds.has(areaId)}
                                                    onToggleSelect={(checked) => toggleAreaSelect(area, checked)}
                                                    onMenuClick={!canEdit ? undefined : (item) => { setEditAreaData(item); setIsEditAreaOpen(true); }}
                                                    onDeleteClick={!canEdit ? undefined : (item) => handleSingleDelete({ areaIds: [Number(item.areaid)] })}
                                                    onAssignClick={!canEdit ? undefined : (item) => setAssignModal({ open: true, targetType: 'area', target: item })}
                                                    assignedPersonnelCount={assignedCounts.areas[areaId] || 0}
                                                    assignedPersonnel={visibleAreaAssignedUsers}
                                                    childPersonnel={visibleAreaChildUsers}
                                                    isAssigned={assignedAreaIds.has(areaId) || myAssignedScope.areaIds.has(areaId)}
                                                    isAuditor={isAuditor}
                                                >
                                                    {loadingCriteria.has(area.areaid) ? (
                                                        <p className="text-xs text-gray-500 ml-4 mt-2">Loading sub areas...</p>
                                                    ) : areaCriteria.length === 0 ? (
                                                        <p className="text-xs text-gray-500 ml-4 mt-2">
                                                            {hasSearch ? 'No matching sub areas' : 'No sub areas'}
                                                        </p>
                                                    ) : (
                                                        <div className="relative mt-3 ml-6 pl-5">
                                                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 rounded-full" />
                                                            <div className="space-y-2">
                                                                {(() => {
                                                                    // Build a tree of criteria by parentcriteriaid
                                                                    const list = areaCriteria || [];
                                                                    const map = new Map();
                                                                    const roots = [];
                                                                    for (const c of list) {
                                                                        const id = String(c.criteriaid);
                                                                        map.set(id, { ...c, children: [] });
                                                                    }
                                                                    for (const c of list) {
                                                                        const parentId = c.parentcriteriaid ?? c.parentcriteriaid;
                                                                        const id = String(c.criteriaid);
                                                                        if (parentId === null || parentId === undefined || String(parentId) === '' ) {
                                                                            roots.push(map.get(id));
                                                                        } else {
                                                                            const p = map.get(String(parentId));
                                                                            if (p) p.children.push(map.get(id));
                                                                            else roots.push(map.get(id));
                                                                        }
                                                                    }

                                                                    const renderNode = (node, depth = 0) => {
                                                                        const critId = Number(node.criteriaid);
                                                                        const critAssignedUsers = assignedPersonnelMap.criteria[critId] || [];
                                                                        const critDirectIds = new Set(critAssignedUsers.map(u => Number(u.userid)));
                                                                        const inheritedFromArea = (areaAssignedUsers || []).filter(u => !critDirectIds.has(Number(u.userid)));
                                                                        const critChildUsers = getChildPersonnelForCriteria(critId).filter(
                                                                            u => !critDirectIds.has(Number(u.userid)) && !inheritedFromArea.some(a => Number(a.userid) === Number(u.userid))
                                                                        );

                                                                        const inheritedForReqs = [
                                                                            ...critAssignedUsers.map(u => ({ ...u, source: 'Sub-area' })),
                                                                            ...inheritedFromArea.map(u => ({ ...u, source: 'Area' }))
                                                                        ];

                                                                        const visibleCritAssignedUsers = (isAdmin || isAuditor)
                                                                            ? critAssignedUsers
                                                                            : critAssignedUsers.filter((u) => Number(u.userid) === currentUid);
                                                                        const visibleInheritedFromArea = (isAdmin || isAuditor)
                                                                            ? inheritedFromArea
                                                                            : inheritedFromArea.filter((u) => Number(u.userid) === currentUid);
                                                                        const visibleCritChildUsers = (isAdmin || isAuditor)
                                                                            ? critChildUsers
                                                                            : critChildUsers.filter((u) => Number(u.userid) === currentUid);
                                                                        const visibleInheritedForReqs = (isAdmin || isAuditor)
                                                                            ? inheritedForReqs
                                                                            : inheritedForReqs.filter((u) => Number(u.userid) === currentUid);

                                                                        return (
                                                                            <CriteriaSection
                                                                                key={node.criteriaid}
                                                                                criteria={node}
                                                                                isExpanded={expandedCriteria.has(node.criteriaid)}
                                                                                onToggle={() => onToggleCriteria(node.criteriaid)}
                                                                                loading={loadingRequirements.has(node.criteriaid)}
                                                                                showCheckbox={deleteMode}
                                                                                isChecked={selectedCriteriaIds.has(critId)}
                                                                                onToggleSelect={(checked) => toggleCriteriaSelect(node, checked)}
                                                                                onMenuClick={!canEdit ? undefined : (c) => { setEditCriteriaData(c); setIsEditCriteriaOpen(true); }}
                                                                                onDeleteClick={!canEdit ? undefined : (c) => handleSingleDelete({ criteriaIds: [Number(c.criteriaid)] })}
                                                                                onAssignClick={!canEdit ? undefined : (c) => setAssignModal({ open: true, targetType: 'criteria', target: c })}
                                                                                assignedPersonnelCount={assignedCounts.criteria[critId] || 0}
                                                                                assignedPersonnel={visibleCritAssignedUsers}
                                                                                inheritedPersonnel={visibleInheritedFromArea}
                                                                                childPersonnel={visibleCritChildUsers}
                                                                                isAssigned={myAssignedScope.criteriaIds.has(critId) || myAssignedScope.areaIds.has(areaId)}
                                                                            >
                                                                                <div className="ml-6 space-y-2">
                                                                                    {node.children && node.children.map(child => renderNode(child, depth + 1))}
                                                                                    <RequirementsSection
                                                                                        requirements={getFilteredRequirementsForCriteria(node.criteriaid)}
                                                                                        isLoading={loadingRequirements.has(node.criteriaid)}
                                                                                        showCheckbox={deleteMode}
                                                                                        selectedRequirementIds={selectedRequirementIds}
                                                                                        onToggleRequirement={toggleRequirementSelect}
                                                                                        onMenuClick={!canEdit ? undefined : (req) => { setEditRequirementData(req); setIsEditRequirementOpen(true); }}
                                                                                        onDeleteClick={!canEdit ? undefined : (req) => handleSingleDelete({ requirementIds: [Number(req.requirementid)] })}
                                                                                        onAssignClick={!canEdit ? undefined : (req) => setAssignModal({ open: true, targetType: 'requirement', target: req })}
                                                                                        assignedPersonnelCounts={assignedCounts.requirements}
                                                                                        assignedPersonnelMap={(isAdmin || isAuditor) ? assignedPersonnelMap.requirements : Object.fromEntries(Object.entries(assignedPersonnelMap.requirements || {}).map(([k, v]) => [k, (v || []).filter(u => Number(u.userid) === currentUid)]))}
                                                                                        inheritedPersonnel={visibleInheritedForReqs}
                                                                                        myAssignedReqIds={myAssignedScope.requirementIds}
                                                                                    />
                                                                                </div>
                                                                            </CriteriaSection>
                                                                        );
                                                                    };

                                                                    return roots.map(r => renderNode(r));
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </AreaSection>
                                            );
                                        })}

                                        <div className="mt-6">
                                            <div
                                                className="bg-slate-700 hover:bg-slate-800 text-white p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition"
                                                onClick={onToggleNoArea}
                                            >
                                                <div>
                                                    <h3 className="font-semibold flex items-center gap-2">
                                                        {expandedNoArea.has(selectedEvent.eventid) ? (
                                                            <ChevronDown className="h-4 w-4 shrink-0 text-white" />
                                                        ) : (
                                                            <ChevronRight className="h-4 w-4 shrink-0 text-white" />
                                                        )}
                                                        <span>No Area Assigned</span>
                                                    </h3>
                                                    <p className="text-xs text-slate-200 mt-1">Sub areas without area assignment</p>
                                                </div>
                                                <span className="text-xs px-2 py-1 rounded bg-slate-500 text-slate-100">
                                                    {visibleNoAreaCriteria.length} sub areas
                                                </span>
                                            </div>

                                            {expandedNoArea.has(selectedEvent.eventid) && loadingNoAreaCriteria.has(selectedEvent.eventid) ? (
                                                <p className="text-xs text-gray-500 ml-4 mt-2">Loading sub areas without area...</p>
                                            ) : expandedNoArea.has(selectedEvent.eventid) && visibleNoAreaCriteria.length === 0 ? (
                                                <p className="text-xs text-gray-500 ml-4 mt-2">
                                                    {hasSearch ? 'No matching sub areas without area' : 'No sub areas without area'}
                                                </p>
                                            ) : expandedNoArea.has(selectedEvent.eventid) ? (
                                                <div className="relative mt-3 ml-6 pl-5">
                                                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-blue-300 rounded-full" />
                                                    <div className="space-y-2">
                                                        {(() => {
                                                            const list = visibleNoAreaCriteria || [];
                                                            const map = new Map();
                                                            const roots = [];
                                                            for (const c of list) {
                                                                const id = String(c.criteriaid);
                                                                map.set(id, { ...c, children: [] });
                                                            }
                                                            for (const c of list) {
                                                                const parentId = c.parentcriteriaid ?? c.parentcriteriaid;
                                                                const id = String(c.criteriaid);
                                                                if (parentId === null || parentId === undefined || String(parentId) === '' ) {
                                                                    roots.push(map.get(id));
                                                                } else {
                                                                    const p = map.get(String(parentId));
                                                                    if (p) p.children.push(map.get(id));
                                                                    else roots.push(map.get(id));
                                                                }
                                                            }
                                                            const renderNode = (node) => {
                                                                const critId = Number(node.criteriaid);
                                                                const critAssignedUsers = assignedPersonnelMap.criteria[critId] || [];
                                                                const critChildUsers = getChildPersonnelForCriteria(critId);
                                                                const visibleCritAssignedUsers = (isAdmin || isAuditor)
                                                                    ? critAssignedUsers
                                                                    : critAssignedUsers.filter((u) => Number(u.userid) === currentUid);
                                                                const visibleCritChildUsers = (isAdmin || isAuditor)
                                                                    ? critChildUsers
                                                                    : critChildUsers.filter((u) => Number(u.userid) === currentUid);

                                                                return (
                                                                    <CriteriaSection
                                                                        key={node.criteriaid}
                                                                        criteria={node}
                                                                        isExpanded={expandedCriteria.has(node.criteriaid)}
                                                                        onToggle={() => onToggleCriteria(node.criteriaid)}
                                                                        loading={loadingRequirements.has(node.criteriaid)}
                                                                        showCheckbox={deleteMode}
                                                                        isChecked={selectedCriteriaIds.has(critId)}
                                                                        onToggleSelect={(checked) => toggleCriteriaSelect(node, checked)}
                                                                        onMenuClick={!canEdit ? undefined : (c) => { setEditCriteriaData(c); setIsEditCriteriaOpen(true); }}
                                                                        onDeleteClick={!canEdit ? undefined : (c) => handleSingleDelete({ criteriaIds: [Number(c.criteriaid)] })}
                                                                        onAssignClick={!canEdit ? undefined : (c) => setAssignModal({ open: true, targetType: 'criteria', target: c })}
                                                                        assignedPersonnelCount={assignedCounts.criteria[critId] || 0}
                                                                        assignedPersonnel={visibleCritAssignedUsers}
                                                                        inheritedPersonnel={[]}
                                                                        childPersonnel={visibleCritChildUsers}
                                                                        isAssigned={myAssignedScope.criteriaIds.has(critId)}
                                                                    >
                                                                        <div className="ml-6 space-y-2">
                                                                            {node.children && node.children.map(child => renderNode(child))}
                                                                            <RequirementsSection
                                                                                requirements={getFilteredRequirementsForCriteria(node.criteriaid)}
                                                                                isLoading={loadingRequirements.has(node.criteriaid)}
                                                                                showCheckbox={deleteMode}
                                                                                selectedRequirementIds={selectedRequirementIds}
                                                                                onToggleRequirement={toggleRequirementSelect}
                                                                                onMenuClick={!canEdit ? undefined : (req) => { setEditRequirementData(req); setIsEditRequirementOpen(true); }}
                                                                                onDeleteClick={!canEdit ? undefined : (req) => handleSingleDelete({ requirementIds: [Number(req.requirementid)] })}
                                                                                onAssignClick={!canEdit ? undefined : (req) => setAssignModal({ open: true, targetType: 'requirement', target: req })}
                                                                                assignedPersonnelCounts={assignedCounts.requirements}
                                                                                assignedPersonnelMap={(isAdmin || isAuditor) ? assignedPersonnelMap.requirements : Object.fromEntries(Object.entries(assignedPersonnelMap.requirements || {}).map(([k, v]) => [k, (v || []).filter(u => Number(u.userid) === currentUid)]))}
                                                                                inheritedPersonnel={visibleCritAssignedUsers.map(u => ({ ...u, source: 'Sub-area' }))}
                                                                                myAssignedReqIds={myAssignedScope.requirementIds}
                                                                            />
                                                                        </div>
                                                                    </CriteriaSection>
                                                                );
                                                            };

                                                            return roots.map(r => renderNode(r));
                                                        })()}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <AddAreaPop
                isOpen={isActionOpen}
                onClose={() => setIsActionOpen(false)}
                event={selectedEvent}
                areas={areasData[selectedEvent.eventid] || []}
                criteriaOptions={criteriaOptions}
                onAddArea={onAddArea}
                onAddNoAreaCriteria={onAddNoAreaCriteria}
                onAddCriteria={onAddCriteria}
                onAddRequirement={onAddRequirement}
                onLoadRequirementsByCriteria={onLoadRequirementsByCriteria}
                onEditArea={onEditArea}
            />

            {isEditAreaOpen && (
                <EditAreaModal
                    visible={isEditAreaOpen}
                    onClose={() => setIsEditAreaOpen(false)}
                    area={editAreaData}
                    userRole={currentUser?.roleid}
                    onSave={async (updated) => {
                        try {
                            if (onEditArea) await onEditArea(updated.areaid, updated);
                        } catch (err) {
                            console.error('Edit area save error', err);
                        } finally {
                            setIsEditAreaOpen(false);
                        }
                    }}
                />
            )}

            {isEditCriteriaOpen && editCriteriaData && (
                <EditCriteriaModal
                    visible={isEditCriteriaOpen}
                    onClose={() => setIsEditCriteriaOpen(false)}
                    event={editCriteriaData}
                    userRole={currentUser?.roleid}
                    onSave={async (updated) => {
                        try {
                            if (typeof onEditCriteria === 'function') {
                                await onEditCriteria(updated.criteriaid || editCriteriaData.criteriaid, updated);
                                await showAlert('Sub area updated successfully!');
                            }
                        } catch (err) {
                            console.error('Failed to save edited criteria', err);
                            await showAlert(err?.message || 'Failed to save sub area');
                        } finally {
                            setIsEditCriteriaOpen(false);
                        }
                    }}
                />
            )}
            {isEditRequirementOpen && editRequirementData && (
                <EditRequirementsModal
                    visible={isEditRequirementOpen}
                    onClose={() => setIsEditRequirementOpen(false)}
                    requirement={editRequirementData}
                    userRole={currentUser?.roleid}
                    onSave={async (updated) => {
                        try {
                            const { requirementsAPI } = await import('../../utils/api');
                            const response = await requirementsAPI.updateRequirement(updated.requirementid, updated);
                            if (response && response.success) {
                                const criteriaid = updated.criteriaid || editRequirementData.criteriaid;
                                if (typeof onLoadRequirementsByCriteria === 'function' && criteriaid) {
                                    await onLoadRequirementsByCriteria(Number(criteriaid));
                                }
                                await showAlert('Standard updated successfully!');
                            } else {
                                await showAlert(response?.message || 'Failed to save requirement');
                            }
                        } catch (err) {
                            console.error('Failed saving requirement', err);
                            await showAlert(err?.message || 'An error occurred while saving requirement');
                        } finally {
                            setIsEditRequirementOpen(false);
                        }
                    }}
                />
            )}
            {assignModal.open && assignModal.target && (
                <AssignPersonnelModal
                    isOpen={assignModal.open}
                    onClose={() => setAssignModal({ open: false, targetType: null, target: null })}
                    eventid={selectedEvent?.eventid}
                    eventname={selectedEvent?.eventname}
                    targetType={assignModal.targetType}
                    target={assignModal.target}
                    existingAssignments={personnelAssignments}
                    onSuccess={fetchPersonnelAssignments}
                />
            )}
            {isAssignScopeModalOpen && (
                <AssignPersonnelScopeModal
                    isOpen={isAssignScopeModalOpen}
                    onClose={() => setIsAssignScopeModalOpen(false)}
                    event={selectedEvent}
                    onSuccess={() => {
                        fetchPersonnelAssignments();
                        fetchMyAssignments();
                    }}
                />
            )}
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
