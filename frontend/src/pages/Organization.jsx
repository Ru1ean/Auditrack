import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import Sortoffice from "../components/Organization/sortoffice";
import CustomDropdown from "../components/UI/CustomDropdown";
import EventsAddDelete from "../components/ALLC/eventsadddelete";
import EventTabs from "../components/Organization/EventTabs";
import OfficeAddDelete from "../components/Organization/officeadddelete";
import AddEventModal from "../components/Events/AddEventModal";
import api, { officesAPI, officeHeadsAPI, officetypesAPI, eventsAPI, usersAPI, masterlistAPI } from "../utils/api";
import OfficesP from "../components/OfficesP/OfficesP";
import AddOfficeModal from "../components/Organization/AddOfficeModal";
import EditOfficeModal from "../components/Organization/EditOfficeModal";
import ViewReqPasscuModal from "../components/ViewReqPasscuModal/ViewReqPasscuModal";
import ViewReqPASSCUModal from "../components/ViewReqPasscuModal/ViewReqPasscuModal";
import AddReqOffModal from "../components/AddReqOffModal/AddReqOffModal";
import { Building2, Plus, Search, LayoutGrid, List } from "lucide-react";
import { useModal } from "../components/UI/ModalProvider";
import { useLiveRefresh } from "../utils/liveSync";
import ViewModeToggle from "../components/UI/ViewModeToggle";
import { isAcademicEntity } from "../utils/entityHelpers";

const normalizeOfficeRecord = (office) => {
    if (!office) return null;
    return {
        ...office,
        id: office.id ?? office.officeid,
        officeid: office.officeid ?? office.id,
        officename: office.officename,
        eventid: office.eventid,
        accreditationlevel: office.accreditationlevel,
    };
};

export default function Organization({ selectedEventIdProp, onEventSelect }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [modalDeepLink, setModalDeepLink] = useState(null);
    const notifDeepLinkHandled = useRef(false);

    const [officeTypes, setOfficeTypes] = useState([]);
    const [heads, setHeads] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [programTypes, setProgramTypes] = useState([]);
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState('');
    const [selectedProgramTypeFilter, setSelectedProgramTypeFilter] = useState('');
    const [selectedOfficeTypeFilter, setSelectedOfficeTypeFilter] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewReqModalOpen, setIsViewReqModalOpen] = useState(false);
    const [isAddReqModalOpen, setIsAddReqModalOpen] = useState(false);

    const [selectedOffice, setSelectedOffice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedEventType, setSelectedEventType] = useState(() => {
        return selectedEventIdProp || localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id') || '';
    });

    useEffect(() => {
        if (selectedEventIdProp) {
            setSelectedEventType(selectedEventIdProp);
            localStorage.setItem('acc_selected_event_id', String(selectedEventIdProp));
            localStorage.setItem('selected_audit_event_id', String(selectedEventIdProp));
        }
    }, [selectedEventIdProp]);

    const handleEventTabChange = (eventid) => {
        setSelectedEventType(eventid);
        if (eventid) {
            localStorage.setItem('acc_selected_event_id', String(eventid));
            localStorage.setItem('selected_audit_event_id', String(eventid));
        }
        if (typeof onEventSelect === 'function') {
            onEventSelect(eventid);
        }
    };
    const [events, setEvents] = useState([]);
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const stored = localStorage.getItem('user');
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    const isAdmin = currentUser?.rolename === 'admin' || currentUser?.roleid === 1;
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    const officesPRef = useRef();
    const [sortStatus, setSortStatus] = useState('all');
    const [showActions, setShowActions] = useState(false);
    const actionsButtonRef = useRef(null);
    const actionsMenuRef = useRef(null);
    const [isAddEventOpen, setIsAddEventOpen] = useState(false);

    const headerRef = React.useRef(null);
    const controlsRef = React.useRef(null);
    const [contentHeight, setContentHeight] = useState(null);

    // compute content height = viewport height - header height to keep this component fixed
    const updateContentHeight = useCallback(() => {
        const headerH = headerRef.current ? headerRef.current.offsetHeight : 0;
        const controlsH = controlsRef.current ? controlsRef.current.offsetHeight : 0;
        // leave a small gap for padding/margins
        const gap = 16;
        const h = Math.max(200, window.innerHeight - headerH - controlsH - gap);
        setContentHeight(h);
    }, []);

    useEffect(() => {
        // Measure after paint to ensure refs are populated
        updateContentHeight();
        const rafId = requestAnimationFrame(() => updateContentHeight());

        window.addEventListener('resize', updateContentHeight);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updateContentHeight);
        };
    }, [updateContentHeight]);

    // Allow normal scrolling
    useEffect(() => {
        return () => {};
    }, []);

    // Fetch office types and events safely
    useEffect(() => {
        async function fetchOfficeTypes() {
            try {
                const res = await officetypesAPI.getAll();
                setOfficeTypes(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error("Failed to fetch office types:", err);
                setOfficeTypes([]); // fallback to empty array
            }
        }
        async function fetchEvents() {
            try {
                const res = await eventsAPI.getAllEvents();
                if (res.success && Array.isArray(res.data)) {
                    setEvents(res.data);
                    if (res.data.length > 0) {
                        setSelectedEventType((prev) => {
                            const saved = localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id');
                            const candidate = prev && prev !== 'all' ? prev : saved;
                            const found = res.data.find(e => String(e.eventid || e.id) === String(candidate));
                            const target = found || res.data[0];
                            const targetId = String(target.eventid || target.id);
                            localStorage.setItem('acc_selected_event_id', targetId);
                            localStorage.setItem('selected_audit_event_id', targetId);
                            return targetId;
                        });
                    }
                } else {
                    setEvents([]);
                }
            } catch (err) {
                setEvents([]);
            }
        }
        fetchOfficeTypes();
        fetchEvents();
    }, []);

    // Fetch current user on mount
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

    // Fetch office heads safely
    useEffect(() => {
        async function fetchHeads() {
            try {
                const res = await officeHeadsAPI.getAllHeads();
                setHeads(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error('Failed to fetch heads', err);
                setHeads([]);
            }
        }
        fetchHeads();
    }, []);

    // Fetch departments and program types for dropdowns
    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [depsRes, ptypesRes] = await Promise.all([
                    api.get('/api/departments').then(r => r.data).catch(() => ({ data: [] })),
                    api.get('/api/programtypes').then(r => r.data).catch(() => ({ data: [] })),
                ]);

                const deps = Array.isArray(depsRes) ? depsRes : (depsRes?.data || depsRes?.departments || []);
                const ptypes = Array.isArray(ptypesRes) ? ptypesRes : (ptypesRes?.data || ptypesRes?.programtypes || []);

                setDepartments(deps);
                setProgramTypes(ptypes);
            } catch (err) {
                console.error('Failed to load departments/program types:', err);
                setDepartments([]);
                setProgramTypes([]);
            }
        };

        fetchLookups();
    }, []);

    // Reset states on mount
    useEffect(() => {
        setDeleteMode(false);
        setSelectedCount(0);
        setSelectedIds([]);
    }, []);

    const handleSuccess = () => {
        if (officesPRef.current?.refresh) {
            officesPRef.current.refresh();
        }
        fetchAvailableMasterList(selectedEventType);
    };

    // Real-time live syncing on mutations or window focus
    const refreshOrgData = useCallback((meta = { silent: true }) => {
        if (officesPRef.current?.refresh) {
            officesPRef.current.refresh({ silent: true });
        }
        if (selectedEventType) {
            fetchAvailableMasterList(selectedEventType);
        }
    }, [selectedEventType]);

    useLiveRefresh(refreshOrgData, { deps: [selectedEventType] });

    const handleOfficeClick = (office) => {
        if (!deleteMode) {
            setSelectedOffice(normalizeOfficeRecord(office));
            setIsViewReqModalOpen(true);
        }
    };

    const openOfficeFromNotification = useCallback(async (officeid, deepLink = null) => {
        const targetId = String(officeid || '');
        if (!targetId) return false;

        if (officesPRef.current?.openOfficeById) {
            officesPRef.current.openOfficeById(targetId, { openModal: false });
        }

        try {
            const raw = await officesAPI.getById(targetId);
            const office = normalizeOfficeRecord(raw);
            if (!office?.id) return false;

            setSelectedOffice(office);
            setModalDeepLink(deepLink);
            setIsViewReqModalOpen(true);
            return true;
        } catch (err) {
            console.error('Failed to open office from notification:', err);
            return false;
        }
    }, []);

    useEffect(() => {
        if (searchParams.get('fromNotif') !== '1') {
            notifDeepLinkHandled.current = false;
            return;
        }
        if (notifDeepLinkHandled.current) return;

        let officeid = searchParams.get('officeid');
        const areaid = searchParams.get('areaid');

        const deepLink = {
            requirementid: searchParams.get('requirementid') || null,
            openSubmission: searchParams.get('openSubmission') === '1',
            viewUserId: searchParams.get('viewUserId') || null,
            areaid: areaid || null,
        };

        const run = async () => {
            if (!officeid && areaid) {
                // The notification meta should already include officeid from the backend.
                // Fallback: fetch all offices and pick the first one linked to this area.
                try {
                    const allOffices = await officesAPI.getAll();
                    const list = Array.isArray(allOffices?.data) ? allOffices.data : (Array.isArray(allOffices) ? allOffices : []);
                    if (list.length > 0) {
                        officeid = list[0].id || list[0].officeid;
                    }
                } catch (e) {
                    console.warn('Could not resolve office for areaid notification:', e);
                }
            }

            if (!officeid) return;

            const opened = await openOfficeFromNotification(officeid, deepLink);
            if (opened) {
                notifDeepLinkHandled.current = true;
                setSearchParams({}, { replace: true });
            }
        };

        const timer = setTimeout(run, 350);
        return () => clearTimeout(timer);
    }, [searchParams, openOfficeFromNotification, setSearchParams]);

    const handleCloseViewReqModal = () => {
        setIsViewReqModalOpen(false);
        // Refresh offices list to update compliance status
        if (officesPRef.current?.refresh) {
            officesPRef.current.refresh();
        }
    };

    const handleEditOffice = (office) => {
        setIsViewReqModalOpen(false);
        setSelectedOffice(office);
        setIsEditModalOpen(true);
    };

    const handleAddRequirements = (office) => {
        setIsViewReqModalOpen(false);
        setSelectedOffice(office);
        setIsAddReqModalOpen(true);
    };

    const handleRequirementsSaved = () => {
        setIsAddReqModalOpen(false);
        setIsViewReqModalOpen(true);
        // Refresh requirements in view modal
        if (officesPRef.current?.refresh) {
            officesPRef.current.refresh();
        }
    };

    // Delete a single office or program from actions menu
    const handleDeleteOffice = async (office) => {
        if (!office) return;
        const isAcademic = isAcademicEntity(office);
        const itemType = isAcademic ? 'Program' : 'Office';
        const ok = await showConfirm(`Delete ${itemType.toLowerCase()} "${office.officename || office.name || office.id}"? This cannot be undone.`);
        if (!ok) return;
        try {
            const res = await officesAPI.deleteOffice(office.id || office.officeid);
            setIsViewReqModalOpen(false);
            setSelectedOffice(null);
            if (officesPRef.current?.refresh) await officesPRef.current.refresh();
            await showAlert(res?.message || `${itemType} deleted successfully!`);
        } catch (err) {
            console.error(`Failed to delete ${itemType.toLowerCase()}`, err);
            await showAlert('Delete failed');
        }
    };

    const handleEditSave = async (updatedOffice) => {
        try {
            const { officesAPI } = await import('../utils/api');
            const response = await officesAPI.updateOffice(updatedOffice.id, updatedOffice);

            if (response?.success) {
                // Refresh the offices list and fetch the updated office to update header without re-opening modal
                if (officesPRef.current?.refresh) await officesPRef.current.refresh();

                // Fetch the updated office details and update selectedOffice so the view modal shows fresh data
                try {
                    const updated = await officesAPI.getById(updatedOffice.id);
                    if (updated && updated.officeid) {
                        const mapped = {
                            id: updated.officeid,
                            officename: updated.officename,
                            officetypeid: updated.officetypeid,
                            office_type_name: updated.typename || updated.office_type_name || '',
                            accreditationlevel: updated.accreditationlevel || updatedOffice.accreditationlevel || 'Candidate',
                            head_ids: updated.HeadIDs || [],
                            heads: updated.Heads || [],
                            head_name: updated.HeadName || (updated.Heads ? (updated.Heads.map(h=> h.full_name).join(', ')) : ''),
                            eventid: updated.eventid || updated.eventid,
                            eventname: updated.eventname || updated.eventname || '',
                            compliancepercent: updated.compliancepercent || 0,
                            overallstatus: updated.overallstatus || updated.overallstatus || 'Not Complied'
                        };
                        setSelectedOffice(mapped);
                    }
                } catch (fetchErr) {
                    console.warn('Failed to fetch updated office after save:', fetchErr);
                }

                setIsEditModalOpen(false);
                await showAlert('Office personnel updated successfully!', 'success');
                return { success: true };
            } else {
                await showAlert(response?.message || 'Failed to update office personnel', 'error');
                return { success: false, message: response?.message };
            }
        } catch (err) {
            console.error(err);
            await showAlert('Error updating office', 'error');
            return { success: false, message: err.message };
        }
    };

    const [selectedItems, setSelectedItems] = useState([]);

    // Delete selected offices or programs
    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;

        const hasAcademic = selectedItems.some(o => isAcademicEntity(o));
        const hasNonAcademic = selectedItems.some(o => !isAcademicEntity(o));

        let singularLabel = 'item';
        let pluralLabel = 'items';
        if (hasAcademic && !hasNonAcademic) {
            singularLabel = 'program';
            pluralLabel = 'programs';
        } else if (!hasAcademic && hasNonAcademic) {
            singularLabel = 'office';
            pluralLabel = 'offices';
        }

        const confirmMsg = selectedIds.length === 1
            ? `Delete 1 ${singularLabel}?`
            : `Delete ${selectedIds.length} ${pluralLabel}?`;

        const ok = await showConfirm(confirmMsg);
        if (!ok) return;

        try {
            await officesAPI.deleteMultipleOffices(selectedIds);

            setSelectedCount(0);
            setSelectedIds([]);
            setSelectedItems([]);
            setDeleteMode(false);

            // Refresh the list after deletion
            if (officesPRef.current?.refresh) {
                await officesPRef.current.refresh();
            }

            const successMsg = selectedIds.length === 1
                ? `Successfully deleted ${singularLabel}!`
                : `Successfully deleted ${selectedIds.length} ${pluralLabel}!`;

            await showAlert(successMsg);
        } catch (err) {
            console.error(err);
            await showAlert('Delete failed');
        }
    };

    const handleSelectionChange = useCallback((count, ids, items = []) => {
        setSelectedCount(count);
        setSelectedIds(ids);
        setSelectedItems(items);
    }, []);

    const isPaascu = selectedEventType && (selectedEventType === 'PAASCU' || selectedEventType === 'PASSCU');

    const { showAlert, showConfirm } = useModal();

    // Draggable categories (Master List) sidebar states
    const [masterListItems, setMasterListItems] = useState([]);
    const [masterListLoading, setMasterListLoading] = useState(false);
    const [categorySearchTerm, setCategorySearchTerm] = useState("");
    const [activeCategoryTab, setActiveCategoryTab] = useState("All");
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [showAddSidebar, setShowAddSidebar] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    useEffect(() => {
        if (!selectedEventType) {
            setShowAddSidebar(false);
        }
    }, [selectedEventType]);

    const fetchAvailableMasterList = useCallback(async (eventid) => {
        if (!eventid) {
            setMasterListItems([]);
            return;
        }
        setMasterListLoading(true);
        try {
            const res = await masterlistAPI.getAvailableForEvent(eventid);
            const items = Array.isArray(res) ? res : (res.data || []);
            setMasterListItems(items);
        } catch (err) {
            console.error("Failed to fetch available master list items:", err);
            setMasterListItems([]);
        } finally {
            setMasterListLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAvailableMasterList(selectedEventType);
    }, [selectedEventType, fetchAvailableMasterList]);

    const filteredMasterListItems = useMemo(() => {
        let items = masterListItems;

        if (activeCategoryTab === "Programs") {
            items = items.filter(item => isAcademicEntity(item));
        } else if (activeCategoryTab === "Offices") {
            items = items.filter(item => !isAcademicEntity(item));
        }

        const query = categorySearchTerm.trim().toLowerCase();
        if (!query) return items;

        return items.filter((item) => {
            const name = String(item.name || "").toLowerCase();
            const type = String(item.type || "").toLowerCase();
            const dept = String(item.department || "").toLowerCase();
            return name.includes(query) || type.includes(query) || dept.includes(query);
        });
    }, [masterListItems, categorySearchTerm, activeCategoryTab]);

    const handleInstantAddCategory = async (item) => {
        if (!selectedEventType) return;
        try {
            const isAcademic = isAcademicEntity(item);
            const matchedType = officeTypes.find(t => {
                const name = String(t.typename || t.name || '').toLowerCase();
                if (isAcademic) {
                    return name.includes('academic') && !name.includes('non');
                } else {
                    return name.includes('non');
                }
            });
            const typeId = matchedType ? (matchedType.officetypeid || matchedType.id) : (isAcademic ? 2 : 1);

            const payload = {
                masterlistid: parseInt(item.id),
                officename: item.name || "",
                officetypeid: parseInt(typeId),
                HeadIDs: [],
                eventid: parseInt(selectedEventType)
            };

            const res = await officesAPI.createOffice(payload);
            const success = res?.success === true || res?.data?.success === true || res?.office || res?.officeid || res?.id;

            if (success) {
                await showAlert(`Successfully added "${item.name}" to the accreditation!`);
                if (officesPRef.current?.refresh) {
                    officesPRef.current.refresh();
                }
                fetchAvailableMasterList(selectedEventType);
            } else {
                const errorMsg = res?.details || res?.error || res?.message || 'Failed to add category';
                await showAlert(`Error adding category: ${errorMsg}`);
            }
        } catch (err) {
            console.error("Failed to add category:", err);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || "Failed to add category.";
            await showAlert(`Database error: ${errorMsg}`);
        }
    };

    // Ensure selection is cleared in OfficesP when deleteMode is turned off
    useEffect(() => {
        if (!deleteMode && officesPRef.current && officesPRef.current.clearSelection) {
            officesPRef.current.clearSelection();
        }
    }, [deleteMode]);


    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <Building2 className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div ref={controlsRef}>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Programs &amp; Offices</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {deleteMode
                                    ? 'Select programs or offices to delete.'
                                    : 'Manage and monitor all academic programs, offices, and compliance assignments.'}
                            </p>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            {deleteMode && (
                                <button
                                    type="button"
                                    onClick={handleDeleteSelected}
                                    disabled={selectedCount === 0}
                                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all ${
                                        selectedCount === 0
                                            ? 'border-red-200 bg-red-50/50 text-red-400 cursor-not-allowed'
                                            : 'border-red-600 bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-500/20 cursor-pointer'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Selected ({selectedCount})
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (deleteMode) {
                                        setDeleteMode(false);
                                        setSelectedCount(0);
                                        setSelectedIds([]);
                                        return;
                                    }
                                    setDeleteMode(true);
                                    setSelectedCount(0);
                                    setSelectedIds([]);
                                }}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all cursor-pointer ${
                                    deleteMode
                                        ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={deleteMode ? "M6 18L18 6M6 6l12 12" : "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"} />
                                </svg>
                                {deleteMode ? 'Cancel' : 'Delete Mode'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!selectedEventType) {
                                        showAlert("Please select an Accreditation tab first (e.g. RQAT, PACUCOA 2026) to add categories.");
                                        return;
                                    }
                                    setShowAddSidebar(prev => !prev);
                                }}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold shadow-xs transition-all active:scale-95 focus:outline-none focus:ring-2 cursor-pointer ${
                                    showAddSidebar
                                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 focus:ring-slate-400'
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500/20'
                                }`}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                <span>{showAddSidebar ? 'Close Panel' : 'Add to Accreditation'}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Search, Filters & View Mode Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    <div className="relative w-full sm:w-72 md:w-80">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search offices..."
                            className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer flex items-center justify-center"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <CustomDropdown
                            value={selectedOfficeTypeFilter}
                            onChange={setSelectedOfficeTypeFilter}
                            options={[
                                { value: '', label: 'All Office Types' },
                                { value: 'academic', label: 'Academic' },
                                { value: 'non_academic', label: 'Non Academic' },
                            ]}
                            minWidth="min-w-[140px]"
                            size="sm"
                        />

                        <CustomDropdown
                            value={selectedDepartmentFilter}
                            onChange={setSelectedDepartmentFilter}
                            options={[
                                { value: '', label: 'All Departments' },
                                ...departments.map((d) => ({
                                    value: String(d.id ?? d.ID ?? d.DepartmentID),
                                    label: d.name ?? d.DepartmentName ?? d.Name,
                                })),
                            ]}
                            minWidth="min-w-[155px]"
                            size="sm"
                        />

                        <div className="relative inline-block">
                            <Sortoffice value={sortStatus} onChange={setSortStatus} />
                        </div>

                        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
                    </div>
                </div>
            </div>

            {/* Event Tabs */}
            <div className="px-4 sm:px-6 pt-2 pb-1 shrink-0 overflow-x-auto">
                <EventTabs selectedEventId={selectedEventType} onChange={handleEventTabChange} />
            </div>


            {/* Split layout: Left Available Categories (Drag Sources) + Right Grid/List */}
            <div 
                className="flex-1 min-h-0 px-4 pb-2 flex gap-4 overflow-hidden"
                style={{ marginTop: 0 }}
            >
                {/* Left Panel: Available Master List Categories (collapsible/persistent sidebar) */}
                {isAdmin && selectedEventType && showAddSidebar && (
                    <div className="w-72 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-4 shrink-0 h-full min-h-0">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2 shrink-0">
                            <h3 className="text-xs font-bold text-slate-800">
                                Available for {events.find(e => String(e.eventid) === String(selectedEventType))?.eventcode || 'Accreditation'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddSidebar(false)}
                                className="text-slate-400 hover:text-slate-600 transition"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Search Category */}
                        <div className="mb-2 shrink-0">
                            <input
                                type="text"
                                placeholder="Search available..."
                                value={categorySearchTerm}
                                onChange={(e) => setCategorySearchTerm(e.target.value)}
                                className="h-8 w-full rounded-md border border-slate-200 px-3 text-[10px] text-gray-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                disabled={masterListLoading}
                            />
                        </div>
                        
                        {/* Category Type Filter Tabs */}
                        <div className="flex border-b border-slate-200 mb-2 shrink-0">
                            {["All", "Programs", "Offices"].map((tab) => {
                                const isSelected = activeCategoryTab === tab;
                                return (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setActiveCategoryTab(tab)}
                                        className={`pb-1 px-2.5 text-[10px] font-semibold transition-all border-b-2 -mb-[1px] ${
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
                        
                        {/* Draggable Category List */}
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
                            {masterListLoading ? (
                                <div className="flex h-32 items-center justify-center text-center text-xs text-slate-400">
                                    Loading categories...
                                </div>
                            ) : filteredMasterListItems.length === 0 ? (
                                <div className="flex h-32 items-center justify-center text-center text-xs text-slate-400 p-4 border border-dashed border-slate-100 rounded-lg">
                                    No available categories found
                                </div>
                            ) : (
                                filteredMasterListItems.map((item) => (
                                    <div
                                        key={item.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData("text/plain", item.id);
                                            e.dataTransfer.effectAllowed = "move";
                                            setDraggedItem(item);
                                        }}
                                        onDragEnd={() => setDraggedItem(null)}
                                        onClick={() => handleInstantAddCategory(item)}
                                        className="flex flex-col gap-0.5 p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-lg text-[10px] cursor-grab select-none transition-all duration-150 group relative animate-fadeIn"
                                        title="Drag to right grid, or click to add instantly"
                                    >
                                        <div className="font-semibold text-slate-800 flex items-center justify-between">
                                            <span className="truncate pr-1">{item.name}</span>
                                            <span className="opacity-0 group-hover:opacity-100 text-blue-600 text-[9px] font-bold shrink-0 transition-opacity">
                                                + Add
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`px-1 rounded-[3px] text-[8px] font-semibold border ${
                                                item.entitytypeid === 1 || item.type === 'Academic Program'
                                                    ? 'bg-blue-50/50 text-blue-700 border-blue-100'
                                                    : 'bg-emerald-50/50 text-emerald-700 border-emerald-100'
                                            }`}>
                                                {item.type === 'Academic Program' ? 'Program' : 'Office'}
                                            </span>
                                            {item.department && (
                                                <span className="text-[9px] text-slate-400 truncate">
                                                    {item.department}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Right Panel: Grid / List of assigned categories */}
                <div
                    onDragOver={(e) => {
                        if (isAdmin && selectedEventType) {
                            e.preventDefault();
                            setIsDraggingOver(true);
                        }
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={async (e) => {
                        if (!isAdmin || !selectedEventType) return;
                        e.preventDefault();
                        setIsDraggingOver(false);
                        const categoryId = e.dataTransfer.getData("text/plain");
                        const item = draggedItem || masterListItems.find(i => String(i.id) === String(categoryId));
                        if (item) {
                            await handleInstantAddCategory(item);
                        }
                    }}
                    className={`flex-1 overflow-hidden transition-all duration-300 rounded-xl relative border-2 ${
                        isDraggingOver 
                            ? 'border-dashed border-blue-500 bg-blue-50/10 shadow-inner' 
                            : 'border-transparent'
                    }`}
                >
                    {isDraggingOver && (
                        <div className="absolute inset-0 z-[20] flex items-center justify-center bg-blue-500/10 pointer-events-none rounded-xl backdrop-blur-[1px]">
                            <div className="bg-white border-2 border-blue-500 shadow-xl px-6 py-4 rounded-xl flex flex-col items-center gap-2 max-w-sm text-center">
                                <svg className="h-8 w-8 text-blue-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <p className="text-sm font-bold text-slate-800">Drop here to assign to current accreditation</p>
                                <p className="text-[10px] text-slate-400">Instantly assigns category with 0 heads (heads can be assigned later)</p>
                            </div>
                        </div>
                    )}

                    <div className="relative z-10 w-full h-full flex flex-col min-h-0">
                        <OfficesP
                            ref={officesPRef}
                            searchTerm={searchTerm}
                            deleteMode={deleteMode}
                            onSelectionChange={handleSelectionChange}
                            onOfficeClick={handleOfficeClick}
                            eventType={selectedEventType}
                            events={events}
                            viewMode={viewMode}
                            sortStatus={sortStatus}
                            officeTypes={officeTypes}   
                            heads={heads}
                            departmentFilter={selectedDepartmentFilter}
                            programTypeFilter={selectedProgramTypeFilter}
                            officeTypeFilter={selectedOfficeTypeFilter}
                            onEditOffice={handleEditOffice}
                            onAddRequirements={handleAddRequirements}
                            onDeleteOffice={handleDeleteOffice}
                            hideHeader={viewMode === 'list'}
                        />
                    </div>
                </div>
            </div>

            {/* Add Modal */}
            {isModalOpen && (
                <AddOfficeModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={handleSuccess}
                    officeTypes={officeTypes}
                    events={events}
                />
            )}

            {/* Add Event Modal (from Standards actions) */}
            {isAddEventOpen && (
                <AddEventModal
                    isOpen={isAddEventOpen}
                    onClose={() => setIsAddEventOpen(false)}
                    onSuccess={(newEvent) => {
                        setIsAddEventOpen(false);
                        if (newEvent) setEvents(prev => [newEvent, ...(Array.isArray(prev) ? prev : [])]);
                    }}
                />
            )}

            {/* View Requirements Modal - Use PASSCU Modal for PAASCU, regular for others */}
            {isViewReqModalOpen && isPaascu && (
                <ViewReqPASSCUModal
                    isOpen={isViewReqModalOpen}
                    onClose={() => {
                        setModalDeepLink(null);
                        handleCloseViewReqModal();
                    }}
                    office={selectedOffice}
                    deepLink={modalDeepLink}
                    onDeepLinkHandled={() => setModalDeepLink(null)}
                    onEditOffice={handleEditOffice}
                    onAddRequirements={handleAddRequirements}
                    onDeleteOffice={handleDeleteOffice}
                />
            )}

            {isViewReqModalOpen && !isPaascu && (
                <ViewReqPasscuModal
                    isOpen={isViewReqModalOpen}
                    onClose={() => {
                        setModalDeepLink(null);
                        handleCloseViewReqModal();
                    }}
                    office={selectedOffice}
                    deepLink={modalDeepLink}
                    onDeepLinkHandled={() => setModalDeepLink(null)}
                    onEditOffice={handleEditOffice}
                    onAddRequirements={handleAddRequirements}
                    onDeleteOffice={handleDeleteOffice}
                />
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                (() => {
                    console.log('DEBUG: heads passed to EditOfficeModal:', heads);
                    return (
                        <EditOfficeModal
                            visible={isEditModalOpen}
                            onClose={() => {
                                setIsEditModalOpen(false);
                            }}
                            office={selectedOffice}
                            onSave={handleEditSave}
                            officeTypes={officeTypes}
                            heads={heads}
                            userRole={currentUser?.roleid}
                        />
                    );
                })()
            )}

            {/* Add Requirements Modal */}
            {isAddReqModalOpen && (
                <AddReqOffModal
                    isOpen={isAddReqModalOpen}
                    onClose={() => {
                        setIsAddReqModalOpen(false);
                    }}
                    office={selectedOffice}
                    onSave={handleRequirementsSaved}
                />
            )}
        </div>
    );
}
