import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, ChevronDown, ChevronRight, Check, Search, Info, Loader2, Award, FileText, UserCheck } from 'lucide-react';
import { eventsAPI, areasAPI, criteriaAPI, requirementsAPI, personnelAssignmentsAPI, usersAPI } from '../../utils/api';
import { useToast } from '../UI/Toast';
import CustomSelect from '../UI/CustomSelect';

export default function AssignPersonnelScopeModal({
    isOpen,
    onClose,
    personnel: initialPersonnel = null,
    event: initialEvent = null,
    onSuccess
}) {
    const { toast } = useToast();
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [personnelList, setPersonnelList] = useState([]);
    const [selectedPersonnel, setSelectedPersonnel] = useState(initialPersonnel);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [loadingPersonnel, setLoadingPersonnel] = useState(false);
    const [loadingTree, setLoadingTree] = useState(false);
    const [saving, setSaving] = useState(false);

    // Tree data for the selected event
    const [areas, setAreas] = useState([]);
    const [criteriaData, setCriteriaData] = useState({}); // areaid -> root criteria[] (with .children tree)
    const [allCriteriaData, setAllCriteriaData] = useState({}); // areaid -> all criteria[] (flat list for counts)
    const [requirementsData, setRequirementsData] = useState({}); // criteriaid -> req[]

    // Selection sets
    const [selectedAreaIds, setSelectedAreaIds] = useState(new Set());
    const [selectedCriteriaIds, setSelectedCriteriaIds] = useState(new Set());
    const [selectedRequirementIds, setSelectedRequirementIds] = useState(new Set());

    // Expansion sets
    const [expandedAreas, setExpandedAreas] = useState(new Set());
    const [expandedCriteria, setExpandedCriteria] = useState(new Set());

    // Search filter
    const [searchTerm, setSearchTerm] = useState('');

    // Keep selectedPersonnel updated if initialPersonnel changes
    useEffect(() => {
        if (initialPersonnel) {
            setSelectedPersonnel(initialPersonnel);
        }
    }, [initialPersonnel]);

    // Keep selectedEventId updated if initialEvent changes
    useEffect(() => {
        if (initialEvent?.eventid) {
            setSelectedEventId(String(initialEvent.eventid));
        }
    }, [initialEvent]);

    const personnelName = useMemo(() => {
        if (!selectedPersonnel) return '';
        const name = `${selectedPersonnel.firstname || ''} ${selectedPersonnel.lastname || ''}`.trim();
        return name || selectedPersonnel.email || selectedPersonnel.Email || 'Personnel';
    }, [selectedPersonnel]);

    // 1. Load active events and personnel on modal open
    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;

        if (initialEvent?.eventid) {
            setSelectedEventId(String(initialEvent.eventid));
        } else {
            const loadEvents = async () => {
                setLoadingEvents(true);
                try {
                    const res = await eventsAPI.getAll();
                    const list = Array.isArray(res) ? res : (res?.data || res?.events || []);
                    const active = list.filter(e => {
                        const st = String(e.status || e.Status || '').toLowerCase();
                        return st !== 'inactive' && st !== '0';
                    });

                    if (mounted) {
                        setEvents(active);
                        if (active.length > 0 && !selectedEventId) {
                            setSelectedEventId(String(active[0].eventid));
                        }
                    }
                } catch (err) {
                    console.error('Error loading events:', err);
                    toast?.({ title: 'Error', description: 'Failed to load accreditation events.', variant: 'error' });
                } finally {
                    if (mounted) setLoadingEvents(false);
                }
            };
            loadEvents();
        }

        // Fetch personnel list if not provided
        if (!initialPersonnel) {
            const loadPersonnel = async () => {
                setLoadingPersonnel(true);
                try {
                    const res = await usersAPI.getAllUsers();
                    const allUsers = Array.isArray(res) ? res : (res?.data || res?.users || []);
                    const filtered = allUsers.filter(u => {
                        const role = String(u.rolename || '').toLowerCase();
                        const rid = Number(u.roleid);
                        return rid === 2 || rid === 3 || role.includes('personnel') || role.includes('office') || role.includes('head') || role === 'user';
                    });
                    if (mounted) {
                        setPersonnelList(filtered);
                        if (filtered.length > 0 && !selectedPersonnel) {
                            setSelectedPersonnel(filtered[0]);
                        }
                    }
                } catch (err) {
                    console.error('Error loading personnel list:', err);
                } finally {
                    if (mounted) setLoadingPersonnel(false);
                }
            };
            loadPersonnel();
        }

        return () => { mounted = false; };
    }, [isOpen, initialPersonnel, initialEvent, toast]);

    // 2. Load hierarchy and current assignments when selectedEventId or selectedPersonnel changes
    useEffect(() => {
        if (!isOpen || !selectedEventId || !selectedPersonnel) return;
        let mounted = true;

        const loadEventHierarchyAndAssignments = async () => {
            setLoadingTree(true);
            try {
                const targetUserId = Number(selectedPersonnel.userid || selectedPersonnel.id);
                const evId = Number(selectedEventId);

                // Fetch areas for event
                const areasRes = await areasAPI.getByEvent(evId).catch(() => ({ data: [] }));
                const eventAreas = Array.isArray(areasRes.data) ? areasRes.data : (Array.isArray(areasRes) ? areasRes : []);

                // Fetch criteria for event
                const critRes = await criteriaAPI.getByEvent(evId).catch(() => ({ data: [] }));
                const eventCriteria = Array.isArray(critRes.data) ? critRes.data : (Array.isArray(critRes) ? critRes : []);

                // Fetch all requirements for event
                const reqsRes = await requirementsAPI.getAllRequirements({ eventid: evId }).catch(() => ({ data: [] }));
                const eventReqs = Array.isArray(reqsRes.data) ? reqsRes.data : (Array.isArray(reqsRes) ? reqsRes : []);

                // Map all criteria by criteriaid and initialize children
                const critById = new Map();
                for (const c of eventCriteria) {
                    critById.set(Number(c.criteriaid), {
                        ...c,
                        criteriaid: Number(c.criteriaid),
                        parentcriteriaid: c.parentcriteriaid ? Number(c.parentcriteriaid) : null,
                        areaid: c.areaid ? Number(c.areaid) : null,
                        children: []
                    });
                }

                // Inherit areaid for child criteria if areaid was missing on child
                critById.forEach(c => {
                    if (!c.areaid && c.parentcriteriaid) {
                        let curr = critById.get(c.parentcriteriaid);
                        while (curr && !curr.areaid && curr.parentcriteriaid) {
                            curr = critById.get(curr.parentcriteriaid);
                        }
                        if (curr && curr.areaid) {
                            c.areaid = curr.areaid;
                        }
                    }
                });

                // Attach children to parents
                critById.forEach(c => {
                    if (c.parentcriteriaid && critById.has(c.parentcriteriaid)) {
                        critById.get(c.parentcriteriaid).children.push(c);
                    }
                });

                // Sort helper for criteria
                const sortCriteriaList = (list) => {
                    return list.slice().sort((a, b) => {
                        const codeA = (a.criteriacode || '').toString().trim();
                        const codeB = (b.criteriacode || '').toString().trim();
                        if (codeA && codeB) return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
                        if (codeA) return -1;
                        if (codeB) return 1;
                        const nameA = (a.criterianame || '').toString().trim();
                        const nameB = (b.criterianame || '').toString().trim();
                        return nameA.localeCompare(nameB);
                    });
                };

                // Sort children of each node
                critById.forEach(c => {
                    if (c.children.length > 0) {
                        c.children = sortCriteriaList(c.children);
                    }
                });

                // Group root criteria and all criteria by area
                const treeMap = {};
                const flatMap = {};
                for (const a of eventAreas) {
                    const aid = Number(a.areaid);
                    treeMap[aid] = [];
                    flatMap[aid] = [];
                }

                critById.forEach(c => {
                    const aid = Number(c.areaid || 0);
                    if (!flatMap[aid]) flatMap[aid] = [];
                    flatMap[aid].push(c);

                    // If criterion has no parent or parent is not found, it is a root criterion
                    if (!c.parentcriteriaid || !critById.has(c.parentcriteriaid)) {
                        if (!treeMap[aid]) treeMap[aid] = [];
                        treeMap[aid].push(c);
                    }
                });

                // Sort roots for each area
                Object.keys(treeMap).forEach(aid => {
                    treeMap[aid] = sortCriteriaList(treeMap[aid]);
                });

                // Organize requirements by criteria
                const reqMap = {};
                for (const r of eventReqs) {
                    const cid = Number(r.criteriaid || 0);
                    if (!reqMap[cid]) reqMap[cid] = [];
                    reqMap[cid].push(r);
                }

                // Fetch user's current assignments for this event
                const assignRes = await personnelAssignmentsAPI.getByUser(targetUserId, evId).catch(() => ({ data: [] }));
                const existingAssignments = Array.isArray(assignRes.data) ? assignRes.data : [];

                const curAreas = new Set();
                const curCriteria = new Set();
                const curReqs = new Set();

                for (const a of existingAssignments) {
                    if (a.areaid && !a.criteriaid && !a.requirementid) {
                        curAreas.add(Number(a.areaid));
                    } else if (a.criteriaid && !a.requirementid) {
                        curCriteria.add(Number(a.criteriaid));
                    } else if (a.requirementid) {
                        curReqs.add(Number(a.requirementid));
                    }
                }

                if (mounted) {
                    setAreas(eventAreas);
                    setCriteriaData(treeMap);
                    setAllCriteriaData(flatMap);
                    setRequirementsData(reqMap);
                    setSelectedAreaIds(curAreas);
                    setSelectedCriteriaIds(curCriteria);
                    setSelectedRequirementIds(curReqs);
                }
            } catch (err) {
                console.error('Error loading hierarchy for scope modal:', err);
                toast?.({ title: 'Error', description: 'Failed to load accreditation scope.', variant: 'error' });
            } finally {
                if (mounted) setLoadingTree(false);
            }
        };

        loadEventHierarchyAndAssignments();
        return () => { mounted = false; };
    }, [isOpen, selectedEventId, selectedPersonnel, toast]);

    const toggleArea = (areaid) => {
        const id = Number(areaid);
        setSelectedAreaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCriteria = (criteriaid) => {
        const id = Number(criteriaid);
        setSelectedCriteriaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleRequirement = (requirementid) => {
        const id = Number(requirementid);
        setSelectedRequirementIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleAreaExpand = (areaid) => {
        setExpandedAreas(prev => {
            const next = new Set(prev);
            if (next.has(areaid)) next.delete(areaid);
            else next.add(areaid);
            return next;
        });
    };

    const toggleCriteriaExpand = (criteriaid) => {
        setExpandedCriteria(prev => {
            const next = new Set(prev);
            if (next.has(criteriaid)) next.delete(criteriaid);
            else next.add(criteriaid);
            return next;
        });
    };

    const handleSave = async () => {
        if (!selectedPersonnel || !selectedEventId) return;
        setSaving(true);
        try {
            const targetUserId = Number(selectedPersonnel.userid || selectedPersonnel.id);
            const evId = Number(selectedEventId);

            await personnelAssignmentsAPI.syncScope({
                userid: targetUserId,
                eventid: evId,
                areaIds: Array.from(selectedAreaIds),
                criteriaIds: Array.from(selectedCriteriaIds),
                requirementIds: Array.from(selectedRequirementIds)
            });

            toast?.({
                title: 'Success',
                description: `Assigned scope updated successfully for ${personnelName}.`,
                variant: 'success'
            });

            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving personnel scope:', err);
            toast?.({ title: 'Error', description: err?.message || 'Failed to update scope.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const eventOptions = events.map(e => ({
        value: String(e.eventid),
        label: e.eventname || e.eventcode || `Accreditation #${e.eventid}`
    }));

    const personnelOptions = personnelList.map(p => {
        const name = `${p.firstname || ''} ${p.lastname || ''}`.trim() || p.email || `User #${p.userid || p.id}`;
        const role = p.rolename ? ` (${p.rolename})` : '';
        return {
            value: String(p.userid || p.id),
            label: `${name}${role}`
        };
    });

    const activeEventObj = initialEvent || events.find(e => String(e.eventid) === String(selectedEventId));

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 leading-tight">
                                {initialEvent ? `Assign Personnel — ${initialEvent.eventcode || initialEvent.eventname}` : 'Assign Scope & Responsibilities'}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {initialEvent 
                                    ? `Configure Areas, Sub-areas, and Standards assigned to personnel.`
                                    : <>Personnel: <span className="font-semibold text-slate-800">{personnelName}</span></>}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Event Selector / Personnel Selector & Info */}
                <div className="px-6 py-3 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {initialEvent ? (
                        <div className="w-full sm:w-72">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Select Personnel to Assign
                            </label>
                            {loadingPersonnel ? (
                                <div className="text-xs text-slate-400 py-2">Loading personnel...</div>
                            ) : (
                                <CustomSelect
                                    options={personnelOptions}
                                    value={String(selectedPersonnel?.userid || selectedPersonnel?.id || '')}
                                    onChange={(val) => {
                                        const found = personnelList.find(p => String(p.userid || p.id) === String(val));
                                        if (found) setSelectedPersonnel(found);
                                    }}
                                    placeholder="Select Personnel..."
                                    disabled={loadingPersonnel || saving}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="w-full sm:w-72">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Accreditation Event
                            </label>
                            <CustomSelect
                                options={eventOptions}
                                value={selectedEventId}
                                onChange={(val) => setSelectedEventId(val)}
                                placeholder="Select Accreditation..."
                                disabled={loadingEvents || saving}
                            />
                        </div>
                    )}
                    <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 flex-1">
                        <p className="font-semibold text-slate-700">Hierarchy & Highlights:</p>
                        <p>Checking an <strong>Area</strong> covers all sub-areas and standards. Checking a <strong>Sub Area</strong> covers all its standards.</p>
                        <p className="text-amber-800 text-[10px] font-medium mt-0.5">
                            Parents are highlighted in <span className="bg-amber-100 border border-amber-300 px-1 rounded font-semibold text-amber-900">Amber</span> when individual sub-areas or standards under them are assigned.
                        </p>
                    </div>
                </div>


                {/* Search */}
                <div className="px-6 pt-3 pb-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter areas, sub areas, or standards..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                        />
                    </div>
                </div>

                {/* Tree View */}
                <div className="flex-1 overflow-y-auto px-6 py-2 space-y-3">
                    {loadingTree ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            <span className="text-xs">Loading accreditation structure...</span>
                        </div>
                    ) : areas.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-xs">
                            No areas found for this accreditation event.
                        </div>
                    ) : (
                        (() => {
                            // Subtree stats helper for criteria node
                            const getSubTreeStats = (node) => {
                                let assignedChildCrits = 0;
                                let assignedChildReqs = 0;

                                const directReqs = requirementsData[Number(node.criteriaid)] || [];
                                directReqs.forEach(r => {
                                    if (selectedRequirementIds.has(Number(r.requirementid))) {
                                        assignedChildReqs++;
                                    }
                                });

                                (node.children || []).forEach(child => {
                                    if (selectedCriteriaIds.has(Number(child.criteriaid))) {
                                        assignedChildCrits++;
                                    }
                                    const childStats = getSubTreeStats(child);
                                    assignedChildCrits += childStats.assignedChildCrits;
                                    assignedChildReqs += childStats.assignedChildReqs;
                                });

                                return { assignedChildCrits, assignedChildReqs };
                            };

                            // Search matching helper
                            const nodeMatchesSearch = (node, searchStr) => {
                                if (!searchStr) return true;
                                const lower = searchStr.toLowerCase();
                                const code = (node.criteriacode || '').toLowerCase();
                                const name = (node.criterianame || '').toLowerCase();
                                if (code.includes(lower) || name.includes(lower)) return true;

                                const reqs = requirementsData[Number(node.criteriaid)] || [];
                                if (reqs.some(r => 
                                    (r.requirementcode || '').toLowerCase().includes(lower) ||
                                    (r.description || r.Description || '').toLowerCase().includes(lower)
                                )) {
                                    return true;
                                }

                                return (node.children || []).some(child => nodeMatchesSearch(child, searchStr));
                            };

                            // Recursive criteria renderer
                            const renderCriteriaNode = (crit, depth = 0, isParentCovered = false, isParentAreaChecked = false) => {
                                const critId = Number(crit.criteriaid);
                                const isCritDirectlyChecked = selectedCriteriaIds.has(critId);
                                const isCovered = isParentAreaChecked || isParentCovered;
                                const isCritChecked = isCovered || isCritDirectlyChecked;
                                const effectiveCoveredForDescendants = isCovered || isCritDirectlyChecked;

                                const critReqs = requirementsData[critId] || [];
                                const hasChildren = Boolean(crit.children && crit.children.length > 0);
                                const isChildSubArea = depth > 0;

                                const searchLower = searchTerm.trim().toLowerCase();
                                if (searchLower && !nodeMatchesSearch(crit, searchLower)) {
                                    return null;
                                }

                                const stats = getSubTreeStats(crit);
                                const hasPartialAssignment = !isCritChecked && (stats.assignedChildCrits > 0 || stats.assignedChildReqs > 0);

                                const hasSearchMatchingDescendant = searchLower && (
                                    critReqs.some(r => 
                                        (r.requirementcode || '').toLowerCase().includes(searchLower) ||
                                        (r.description || r.Description || '').toLowerCase().includes(searchLower)
                                    ) ||
                                    (crit.children || []).some(child => nodeMatchesSearch(child, searchLower))
                                );

                                const isCritExpanded = expandedCriteria.has(critId) || Boolean(hasSearchMatchingDescendant);
                                const critCode = String(crit.criteriacode || '').trim().replace(/\.$/, '');

                                const partialParts = [];
                                if (stats.assignedChildCrits > 0) {
                                    partialParts.push(`${stats.assignedChildCrits} child sub area${stats.assignedChildCrits > 1 ? 's' : ''}`);
                                }
                                if (stats.assignedChildReqs > 0) {
                                    partialParts.push(`${stats.assignedChildReqs} standard${stats.assignedChildReqs > 1 ? 's' : ''}`);
                                }
                                const partialText = partialParts.join(', ');

                                return (
                                    <div
                                        key={crit.criteriaid}
                                        className={`border rounded-xl transition overflow-hidden shadow-2xs ${
                                            isParentAreaChecked
                                                ? 'border-indigo-200/70 bg-indigo-50/20'
                                                : isParentCovered
                                                ? 'border-indigo-200/80 bg-indigo-50/25'
                                                : isCritDirectlyChecked
                                                ? 'border-blue-300 bg-blue-50/60 ring-1 ring-blue-200/50'
                                                : hasPartialAssignment
                                                ? 'border-amber-300 bg-amber-50/70 ring-1 ring-amber-200/60'
                                                : isChildSubArea
                                                ? 'border-slate-200 bg-white/95 hover:border-slate-300'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        {/* Header Bar */}
                                        <div className={`p-2.5 flex items-center justify-between gap-3 transition ${
                                            isParentAreaChecked || isParentCovered
                                                ? 'bg-indigo-50/40 border-b border-indigo-100/60'
                                                : isCritDirectlyChecked
                                                ? 'bg-blue-50/80 border-b border-blue-200/60'
                                                : hasPartialAssignment
                                                ? 'bg-amber-50/90 border-b border-amber-200/70'
                                                : isChildSubArea
                                                ? 'bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100/60'
                                                : 'bg-slate-50/70 border-b border-slate-100 hover:bg-slate-100/50'
                                        }`}>
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                {(hasChildren || critReqs.length > 0) ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCriteriaExpand(critId)}
                                                        className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                                                            hasPartialAssignment && !isCritExpanded
                                                                ? 'bg-amber-200/70 text-amber-900 hover:bg-amber-300/80'
                                                                : isCritDirectlyChecked
                                                                ? 'text-blue-600 hover:bg-blue-100/60'
                                                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                                                        }`}
                                                        title={isCritExpanded ? 'Collapse' : 'Expand'}
                                                    >
                                                        {isCritExpanded ? (
                                                            <ChevronDown className={`w-3.5 h-3.5 ${hasPartialAssignment ? 'text-amber-800' : isCritDirectlyChecked ? 'text-blue-600' : 'text-slate-600'}`} />
                                                        ) : (
                                                            <ChevronRight className={`w-3.5 h-3.5 ${hasPartialAssignment ? 'text-amber-800' : isCritDirectlyChecked ? 'text-blue-600' : 'text-slate-500'}`} />
                                                        )}
                                                    </button>
                                                ) : (
                                                    <div className="w-5.5 h-5.5 shrink-0" />
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {isChildSubArea && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300 shrink-0">
                                                                Child Sub Area
                                                            </span>
                                                        )}
                                                        <span className={`text-xs ${isChildSubArea ? 'font-semibold text-slate-800' : 'font-bold text-slate-900'}`}>
                                                            {critCode ? `${critCode}. ` : ''}{crit.criterianame}
                                                        </span>

                                                        {/* Badges */}
                                                        {isParentAreaChecked ? (
                                                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium">
                                                                Covered by Area
                                                            </span>
                                                        ) : isParentCovered ? (
                                                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded font-medium">
                                                                Covered by Parent Sub Area
                                                            </span>
                                                        ) : isCritDirectlyChecked ? (
                                                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-100/80 border border-blue-200 px-1.5 py-0.5 rounded font-bold">
                                                                <Check className="w-2.5 h-2.5" />
                                                                <span>{isChildSubArea ? 'Handles child sub area' : 'Handles sub area'}</span>
                                                            </span>
                                                        ) : hasPartialAssignment ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                <span>{partialText} assigned</span>
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                        {hasChildren && (
                                                            <span>{crit.children.length} child sub area{crit.children.length > 1 ? 's' : ''}</span>
                                                        )}
                                                        {hasChildren && critReqs.length > 0 && <span>·</span>}
                                                        {critReqs.length > 0 && (
                                                            <span>{critReqs.length} standard{critReqs.length > 1 ? 's' : ''}</span>
                                                        )}
                                                        {!hasChildren && critReqs.length === 0 && (
                                                            <span className="italic text-slate-400">No standards configured</span>
                                                        )}
                                                        {hasPartialAssignment && (
                                                            <span className="text-amber-800 font-semibold">
                                                                • Contains assigned items below
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                                                <span className="text-[10px] font-medium text-slate-600">
                                                    {isChildSubArea ? 'Assign Child Sub Area' : 'Assign Sub Area'}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={isCritChecked}
                                                    disabled={isCovered}
                                                    onChange={() => toggleCriteria(crit.criteriaid)}
                                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20 cursor-pointer disabled:opacity-50"
                                                />
                                            </label>
                                        </div>

                                        {/* Expanded Content: Child Sub Areas & Standards */}
                                        {isCritExpanded && (
                                            <div className="p-3 bg-white space-y-3">
                                                {/* Child Sub Areas */}
                                                {hasChildren && (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
                                                            <Layers className="w-3 h-3 text-indigo-500" />
                                                            <span>Child Sub Areas</span>
                                                        </div>
                                                        <div className="relative ml-2 pl-3.5 border-l-2 border-indigo-200 space-y-2.5">
                                                            {crit.children.map(child => renderCriteriaNode(child, depth + 1, effectiveCoveredForDescendants, isParentAreaChecked))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Direct Standards */}
                                                {critReqs.length > 0 && (
                                                    <div className="space-y-1.5 pt-1">
                                                        {hasChildren && (
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-0.5">
                                                                <FileText className="w-3 h-3 text-slate-400" />
                                                                <span>Direct Standards</span>
                                                            </div>
                                                        )}
                                                        <div className={`${hasChildren ? 'ml-2 pl-3.5 border-l-2 border-slate-200' : ''} space-y-1.5`}>
                                                            {critReqs.map((req) => {
                                                                const reqId = Number(req.requirementid);
                                                                const isReqDirectlyChecked = selectedRequirementIds.has(reqId);
                                                                const isReqChecked = isCritChecked || isReqDirectlyChecked;
                                                                const isReqDisabled = isCritChecked;

                                                                return (
                                                                    <div
                                                                        key={req.requirementid}
                                                                        className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition ${
                                                                            isReqDirectlyChecked && !isCritChecked
                                                                                ? 'bg-blue-50/80 border-blue-200 ring-1 ring-blue-100'
                                                                                : isReqChecked
                                                                                ? 'bg-indigo-50/40 border-indigo-100/70 text-slate-600'
                                                                                : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-50/90'
                                                                        }`}
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <p className="text-[11px] font-bold text-slate-800">
                                                                                    {req.requirementcode}
                                                                                </p>
                                                                                {isReqDirectlyChecked && !isCritChecked && (
                                                                                    <span className="text-[9px] font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 py-0.2 rounded">
                                                                                        Assigned standard
                                                                                    </span>
                                                                                )}
                                                                                {isCritChecked && (
                                                                                    <span className="text-[9px] text-slate-400 italic">
                                                                                        Inherited from parent
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                                                {req.description || req.Description}
                                                                            </p>
                                                                        </div>
                                                                        <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isReqChecked}
                                                                                disabled={isReqDisabled}
                                                                                onChange={() => toggleRequirement(req.requirementid)}
                                                                                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer disabled:opacity-50"
                                                                            />
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {!hasChildren && critReqs.length === 0 && (
                                                    <p className="text-xs text-slate-400 italic py-1">No child sub-areas or standards in this sub-area.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            return areas.map((area) => {
                                const areaId = Number(area.areaid);
                                const isAreaChecked = selectedAreaIds.has(areaId);
                                const rootCriteriaList = criteriaData[areaId] || [];
                                const allCriteriaInArea = allCriteriaData[areaId] || [];
                                const isExpanded = expandedAreas.has(areaId);

                                // Calculate assigned items count for this area
                                let assignedCriteriaCountInArea = 0;
                                let assignedRequirementCountInArea = 0;

                                allCriteriaInArea.forEach((crit) => {
                                    const cId = Number(crit.criteriaid);
                                    if (selectedCriteriaIds.has(cId)) {
                                        assignedCriteriaCountInArea++;
                                    }
                                    const critReqs = requirementsData[cId] || [];
                                    critReqs.forEach((r) => {
                                        if (selectedRequirementIds.has(Number(r.requirementid))) {
                                            assignedRequirementCountInArea++;
                                        }
                                    });
                                });

                                const hasPartialAssignmentInArea = !isAreaChecked && (assignedCriteriaCountInArea > 0 || assignedRequirementCountInArea > 0);

                                // Filter logic
                                const searchLower = searchTerm.trim().toLowerCase();
                                const areaMatchesSelf = !searchLower || 
                                    (area.areacode || '').toLowerCase().includes(searchLower) || 
                                    (area.areaname || '').toLowerCase().includes(searchLower);

                                const hasMatchingCriteriaOrReq = !searchLower || rootCriteriaList.some((root) => nodeMatchesSearch(root, searchLower));

                                if (!areaMatchesSelf && !hasMatchingCriteriaOrReq) {
                                    return null;
                                }

                                const effectiveAreaExpanded = isExpanded || (Boolean(searchLower) && hasMatchingCriteriaOrReq);
                                const childCriteriaCount = allCriteriaInArea.length - rootCriteriaList.length;

                                return (
                                    <div
                                        key={area.areaid}
                                        className={`border rounded-xl overflow-hidden transition shadow-2xs ${
                                            isAreaChecked
                                                ? 'border-indigo-300 ring-1 ring-indigo-200/60'
                                                : hasPartialAssignmentInArea
                                                ? 'border-amber-300 ring-1 ring-amber-300/50'
                                                : 'border-slate-200'
                                        }`}
                                    >
                                        {/* Area Item Bar */}
                                        <div className={`p-3 flex items-center justify-between gap-3 transition ${
                                            isAreaChecked
                                                ? 'bg-indigo-50 border-b border-indigo-200/60'
                                                : hasPartialAssignmentInArea
                                                ? 'bg-amber-50/90 border-b border-amber-200/70 hover:bg-amber-100/50'
                                                : 'bg-slate-50/80 hover:bg-slate-100/60'
                                        }`}>
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAreaExpand(areaId)}
                                                    className={`p-1 rounded transition cursor-pointer flex items-center justify-center ${
                                                        hasPartialAssignmentInArea && !effectiveAreaExpanded
                                                            ? 'bg-amber-200/70 text-amber-900 hover:bg-amber-300/80'
                                                            : isAreaChecked
                                                            ? 'text-indigo-600 hover:bg-indigo-100/60'
                                                            : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                                                    }`}
                                                    title={effectiveAreaExpanded ? 'Collapse' : 'Expand'}
                                                >
                                                    {effectiveAreaExpanded ? (
                                                        <ChevronDown className={`w-4 h-4 ${hasPartialAssignmentInArea ? 'text-amber-800' : isAreaChecked ? 'text-indigo-600' : 'text-slate-600'}`} />
                                                    ) : (
                                                        <ChevronRight className={`w-4 h-4 ${hasPartialAssignmentInArea ? 'text-amber-800' : isAreaChecked ? 'text-indigo-600' : 'text-slate-500'}`} />
                                                    )}
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-bold text-slate-900">
                                                            {area.areacode ? `${area.areacode}: ` : ''}{area.areaname || 'Area'}
                                                        </span>
                                                        {isAreaChecked ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-2xs">
                                                                <Check className="w-3 h-3" />
                                                                <span>Handles entire area</span>
                                                            </span>
                                                        ) : hasPartialAssignmentInArea ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                <span>
                                                                    Partial: {[
                                                                        assignedCriteriaCountInArea > 0 ? `${assignedCriteriaCountInArea} sub area${assignedCriteriaCountInArea > 1 ? 's' : ''}` : null,
                                                                        assignedRequirementCountInArea > 0 ? `${assignedRequirementCountInArea} standard${assignedRequirementCountInArea > 1 ? 's' : ''}` : null
                                                                    ].filter(Boolean).join(', ')} assigned
                                                                </span>
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                        <span>
                                                            {rootCriteriaList.length} sub area{rootCriteriaList.length !== 1 ? 's' : ''}
                                                            {childCriteriaCount > 0 ? ` (${childCriteriaCount} child sub area${childCriteriaCount > 1 ? 's' : ''})` : ''} configured
                                                        </span>
                                                        {hasPartialAssignmentInArea && (
                                                            <span className="text-amber-800 font-semibold">
                                                                • Contains assigned items below
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                                                <span className="text-[11px] font-semibold text-slate-600">Assign Area</span>
                                                <input
                                                    type="checkbox"
                                                    checked={isAreaChecked}
                                                    onChange={() => toggleArea(area.areaid)}
                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
                                                />
                                            </label>
                                        </div>

                                        {/* Criteria / Sub-areas (if expanded) */}
                                        {effectiveAreaExpanded && (
                                            <div className={`p-3 space-y-2.5 border-t pl-7 ${hasPartialAssignmentInArea ? 'bg-amber-50/25 border-amber-100' : 'bg-white border-slate-100'}`}>
                                                {rootCriteriaList.length === 0 ? (
                                                    <p className="text-xs text-slate-400 italic">No sub areas in this area.</p>
                                                ) : (
                                                    rootCriteriaList.map((crit) => renderCriteriaNode(crit, 0, false, isAreaChecked))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 flex items-center gap-3">
                        <span><strong>{selectedAreaIds.size}</strong> Areas</span>
                        <span>·</span>
                        <span><strong>{selectedCriteriaIds.size}</strong> Sub Areas</span>
                        <span>·</span>
                        <span><strong>{selectedRequirementIds.size}</strong> Standards</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !selectedEventId}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{saving ? 'Saving...' : 'Save Scope'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
