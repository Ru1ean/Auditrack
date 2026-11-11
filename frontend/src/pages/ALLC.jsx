import CopyEventPopup from '../components/ALLC/CopyEventPopup';
import { useState, useEffect, useRef } from 'react';
import Pagination from '../components/Pagination/Pagination';
import axios from 'axios';
import SortEvents from '../components/ALLC/sortevents';
import { API_BASE_URL } from '../utils/apiBase';
import EventCard from '../components/ALLC/EventCard';
import EventPopup from '../components/ALLC/EventPopup';
import EditEventPopup from '../components/ALLC/EditEventPopup';
import { eventsAPI, usersAPI } from '../utils/api';
import { useModal } from "../components/UI/ModalProvider";
import { useToast } from '../components/UI/Toast';
import AddEventModal from '../components/Events/AddEventModal';
import AssignPersonnelScopeModal from '../components/OfficeHead/AssignPersonnelScopeModal';
import { StandardsSkeleton } from '../components/UI/Skeleton';
import ServerOfflineState from '../components/UI/ServerOfflineState';
import { useLiveRefresh } from '../utils/liveSync';
import ViewModeToggle from '../components/UI/ViewModeToggle';
import { getDeadlineInfo } from '../utils/deadlineHelpers';
import EventOptionsPopup from '../components/ALLC/eventsoptions';

function EventRowOptionsMenu({ event, onOpenStructure, onEdit, onCopy, onDelete, onAssignPersonnel }) {
    const [showOptions, setShowOptions] = useState(false);
    const dotBtnRef = useRef(null);

    return (
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
                ref={dotBtnRef}
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    setShowOptions(v => !v);
                }}
                aria-label="Options"
                title="Options"
            >
                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                </svg>
            </button>
            {showOptions && (
                <EventOptionsPopup
                    onOpenStructure={() => onOpenStructure?.(event)}
                    onEdit={() => onEdit?.(event)}
                    onCopy={() => onCopy?.(event)}
                    onDelete={() => onDelete?.(event)}
                    onAssignPersonnel={() => onAssignPersonnel?.(event)}
                    onClose={() => setShowOptions(false)}
                    anchorRef={dotBtnRef}
                />
            )}
        </div>
    );
}

function ALL() {
    const [sortStatus, setSortStatus] = useState('active');
    const [events, setEvents] = useState([]);
    const [copyPopup, setCopyPopup] = useState({ open: false, event: null });
    const [editPopup, setEditPopup] = useState({ open: false, event: null });
    const [assignScopeEvent, setAssignScopeEvent] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedEventIdsForDelete, setSelectedEventIdsForDelete] = useState(new Set());
    const [isAddEventOpen, setIsAddEventOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
    const { showAlert, showConfirm } = useModal();
    const { toast } = useToast() || {};

    const matchesSearch = (text, searchLower) => {
        return (text?.toLowerCase() || '').includes(searchLower);
    };

    const eventMatchesSearch = (event, searchLower) => {
        return matchesSearch(event.eventname, searchLower) ||
            matchesSearch(event.eventcode, searchLower) ||
            matchesSearch(event.Description, searchLower);
    };

    const [auditorAssignments, setAuditorAssignments] = useState({ areaIds: new Set(), eventIds: new Set(), rawList: [] });

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
    const isAdmin = (roleid === 1 || rolename === 'admin') && !isAuditor && !isPersonnel;

    useEffect(() => {
        if (!currentUser || !isAuditor) return;
        const fetchAuditorAssignments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/areas/assignments/${currentUser.userid}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    const list = data.assignments || [];
                    const areaIds = new Set(list.map(a => Number(a.areaid)));
                    const eventIds = new Set(list.map(a => Number(a.eventid)));
                    setAuditorAssignments({ areaIds, eventIds, rawList: list });
                }
            } catch (err) {
                console.error('Error fetching auditor assignments in ALL:', err);
            }
        };
        fetchAuditorAssignments();
    }, [currentUser, isAuditor]);

    const filteredEvents = events.filter(event => {
        const eventStatus = String(event.status || event.Status || '').toLowerCase().trim();
        if (sortStatus === 'active' && eventStatus === 'inactive') return false;
        if (sortStatus === 'inactive' && eventStatus !== 'inactive') return false;

        if (isAuditor) {
            const isEventAssigned = auditorAssignments.eventIds.has(Number(event.eventid));
            if (!isEventAssigned) return false;
        }

        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        return eventMatchesSearch(event, searchLower);
    });

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [expandedAreas, setExpandedAreas] = useState(new Set());
    const [expandedCriteria, setExpandedCriteria] = useState(new Set());
    const [expandedNoArea, setExpandedNoArea] = useState(new Set());
    const [areasData, setAreasData] = useState({});
    const [criteriaData, setCriteriaData] = useState({});
    const [requirementsData, setRequirementsData] = useState({});
    const [noAreaCriteriaData, setNoAreaCriteriaData] = useState({});
    const [criteriaOptionsData, setCriteriaOptionsData] = useState({});
    const [loadingAreas, setLoadingAreas] = useState(new Set());
    const [loadingCriteria, setLoadingCriteria] = useState(new Set());
    const [loadingRequirements, setLoadingRequirements] = useState(new Set());
    const [loadingNoAreaCriteria, setLoadingNoAreaCriteria] = useState(new Set());

    const abortControllersRef = useRef({});
    const itemsPerPage = 30;

    useEffect(() => {
        setCurrentPage(1);
    }, [sortStatus, searchTerm, viewMode]);

    useEffect(() => {
        fetchEvents();
    }, []);

    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const response = await usersAPI.getLoggedInUser();
                if (response?.success) setCurrentUser(response.user);
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };
        fetchCurrentUser();
    }, []);

    useEffect(() => {
        if (!isAdmin && deleteMode) {
            setDeleteMode(false);
            setSelectedEventIdsForDelete(new Set());
        }
    }, [isAdmin, deleteMode]);

    useEffect(() => {
        if (selectedEvent) {
            fetchAreasForEventSafe(selectedEvent.eventid);
        }
    }, [selectedEvent?.eventid]);

    const fetchCriteriaOptionsForEvent = async (eventid) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/criteria/event/${eventid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCriteriaOptionsData(prev => ({ ...prev, [eventid]: response.data.data || [] }));
        } catch (err) {
            console.error('Error fetching criteria options:', err);
            setCriteriaOptionsData(prev => ({ ...prev, [eventid]: [] }));
        }
    };

    const fetchNoAreaCriteriaForEvent = async (eventid) => {
        try {
            setLoadingNoAreaCriteria(prev => new Set([...prev, eventid]));
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/criteria/event/${eventid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const allCriteriaForEvent = Array.isArray(response.data?.data) ? response.data.data : [];
            const noAreaCriteria = allCriteriaForEvent.filter(
                crit => crit.areaid === null || crit.areaid === undefined
            );

            setNoAreaCriteriaData(prev => ({ ...prev, [eventid]: noAreaCriteria }));
        } catch (err) {
            console.error('Error fetching no-area criteria:', err);
            setNoAreaCriteriaData(prev => ({ ...prev, [eventid]: [] }));
        } finally {
            setLoadingNoAreaCriteria(prev => {
                const newSet = new Set(prev);
                newSet.delete(eventid);
                return newSet;
            });
        }
    };

    const [isRetrying, setIsRetrying] = useState(false);

    const fetchEvents = async (options = false) => {
        const isRetry = options === true;
        const isSilent = Boolean(options && typeof options === 'object' && options.silent);

        try {
            if (isRetry) setIsRetrying(true);
            else if (!isSilent) setLoading(true);
            
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/events`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEvents(response.data?.data || []);
            setError(null);
        } catch (err) {
            console.error('Error fetching events:', err);
            if (!isSilent) {
                if (err.response?.status === 429) {
                    setError('Rate limit exceeded (Max 30 requests/min). Please try again later.');
                } else if (!err.response || err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network error') || err.message?.toLowerCase().includes('failed to fetch')) {
                    setError('Server Offline');
                } else {
                    setError(err.response?.data?.message || 'Failed to load events');
                }
            }
        } finally {
            if (!isSilent) setLoading(false);
            if (isRetry) setIsRetrying(false);
        }
    };

    // Real-time live synchronization for events
    useLiveRefresh(fetchEvents);

    const fetchAreasForEventSafe = async (eventid) => {
        if (abortControllersRef.current[eventid]) {
            abortControllersRef.current[eventid].abort();
        }

        const controller = new AbortController();
        abortControllersRef.current[eventid] = controller;

        try {
            setLoadingAreas(prev => new Set([...prev, eventid]));
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/areas/event/${eventid}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal
            });

            if (!controller.signal.aborted) {
                setAreasData({ [eventid]: response.data.data || [] });
                setCriteriaData({});
                setRequirementsData({});
            }
        } catch (err) {
            if (err.name !== 'CanceledError') {
                console.error('Error fetching areas:', err);
            }
        } finally {
            setLoadingAreas(prev => {
                const newSet = new Set(prev);
                newSet.delete(eventid);
                return newSet;
            });
        }
    };

    const openEventModal = (event) => {
        if (copyPopup.open) return;
        setExpandedAreas(new Set());
        setExpandedCriteria(new Set());
        setExpandedNoArea(new Set());
        setSelectedEvent(event);
    };

    const openCopyModal = (originalEvent) => {
        if (!originalEvent) return;
        const baseCode = originalEvent.eventcode || 'EVENT';
        const baseName = originalEvent.eventname || 'Event';
        let defaultCode = `${baseCode}-COPY`;
        let defaultName = `${baseName} (Copy)`;
        let counter = 1;
        while (events.some(e => String(e.eventcode || '').trim().toUpperCase() === defaultCode.toUpperCase())) {
            defaultCode = `${baseCode}-COPY-${counter}`;
            defaultName = `${baseName} (Copy ${counter})`;
            counter++;
        }
        setCopyPopup({ open: true, event: originalEvent, defaultCode, defaultName });
    };

    const fetchCriteriaForArea = async (areaid, force = false) => {
        if (criteriaData[areaid] && !force) return;

        try {
            setLoadingCriteria(prev => new Set([...prev, areaid]));
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/criteria/area/${areaid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCriteriaData(prev => ({ ...prev, [areaid]: response.data.data || [] }));
        } catch (err) {
            console.error('Error fetching criteria:', err);
        } finally {
            setLoadingCriteria(prev => {
                const newSet = new Set(prev);
                newSet.delete(areaid);
                return newSet;
            });
        }
    };

    const fetchRequirementsForCriteria = async (criteriaid, force = false) => {
        if (requirementsData[criteriaid] && !force) return;

        try {
            setLoadingRequirements(prev => new Set([...prev, criteriaid]));
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/requirements/criteria/${criteriaid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const requirements = Array.isArray(response.data?.data) ? response.data.data : [];

            setRequirementsData(prev => ({ ...prev, [criteriaid]: requirements }));
        } catch (err) {
            console.error('Error fetching requirements:', err);
            setRequirementsData(prev => ({ ...prev, [criteriaid]: [] }));
        } finally {
            setLoadingRequirements(prev => {
                const newSet = new Set(prev);
                newSet.delete(criteriaid);
                return newSet;
            });
        }
    };

    const toggleArea = (areaid) => {
        const newSet = new Set(expandedAreas);
        if (newSet.has(areaid)) {
            newSet.delete(areaid);
        } else {
            newSet.add(areaid);
            if (!criteriaData[areaid]) {
                fetchCriteriaForArea(areaid);
            }
        }
        setExpandedAreas(newSet);
    };

    const toggleCriteria = (criteriaid) => {
        const newSet = new Set(expandedCriteria);
        if (newSet.has(criteriaid)) {
            newSet.delete(criteriaid);
        } else {
            newSet.add(criteriaid);
            if (!requirementsData[criteriaid]) {
                fetchRequirementsForCriteria(criteriaid);
            }
        }
        setExpandedCriteria(newSet);
    };

    const toggleNoAreaSection = (eventid) => {
        setExpandedNoArea(prev => {
            const next = new Set(prev);
            if (next.has(eventid)) {
                next.delete(eventid);
            } else {
                next.add(eventid);
                if (!noAreaCriteriaData[eventid]) {
                    fetchNoAreaCriteriaForEvent(eventid);
                }
            }
            return next;
        });
    };

    const addArea = async (eventid, data) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/api/areas/add`, {
                EventChildID: eventid,
                eventid: eventid,
                areacode: data.areacode,
                areaname: data.areaname,
                Description: data.Description || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchAreasForEventSafe(eventid);
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            throw new Error(apiMessage || 'Failed to add area.');
        }
    };

    const editArea = async (areaid, data) => {
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_BASE_URL}/api/areas/${areaid}`, {
                areacode: data.areacode,
                areaname: data.areaname,
                Description: data.Description || null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (selectedEvent?.eventid) {
                await fetchAreasForEventSafe(selectedEvent.eventid);
            }
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            throw new Error(apiMessage || 'Failed to edit area.');
        }
    };

    const editCriteria = async (criteriaid, data) => {
        const token = localStorage.getItem('token');
        try {
            await axios.put(`${API_BASE_URL}/api/criteria/${criteriaid}`, {
                criteriacode: data.criteriacode,
                criterianame: data.criterianame,
                Description: data.Description || null,
                areaid: data.areaid ?? null,
                parentcriteriaid: data.parentcriteriaid ?? null,
                eventid: data.eventid
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (selectedEvent?.eventid) {
                await fetchCriteriaOptionsForEvent(selectedEvent.eventid);
                if (data.areaid) {
                    await fetchCriteriaForArea(Number(data.areaid), true);
                } else {
                    await fetchNoAreaCriteriaForEvent(selectedEvent.eventid);
                }
            }
            if (toast) {
                toast({ title: 'Success', description: 'Sub area updated successfully.', variant: 'success' });
            }
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            if (toast) {
                toast({ title: 'Error', description: apiMessage || 'Failed to edit sub area.', variant: 'error' });
            }
            throw new Error(apiMessage || 'Failed to edit sub area.');
        }
    };

    const addNoAreaCriteria = async (eventid, data) => {
        return addCriteria(eventid, { ...data, areaid: null });
    };

    const addCriteria = async (eventid, data) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/api/criteria/add`, {
                eventid: eventid,
                areaid: data.areaid ?? null,
                criteriacode: data.criteriacode,
                criterianame: data.criterianame,
                description: data.description || data.Description,
                Description: data.description || data.Description,
                parentcriteriaid: data.parentcriteriaid ?? null
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            await fetchCriteriaOptionsForEvent(eventid);

            if (data.areaid) {
                await fetchCriteriaForArea(Number(data.areaid), true);
            } else {
                await fetchNoAreaCriteriaForEvent(eventid);
            }
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            throw new Error(apiMessage || 'Failed to add sub area.');
        }
    };

    const addRequirement = async (payload) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE_URL}/api/requirements/add`, {
                ...payload,
                description: payload.description || payload.Description,
                Description: payload.description || payload.Description
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchRequirementsForCriteria(payload.criteriaid, true);
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            throw new Error(apiMessage || 'Failed to add requirement.');
        }
    };

    const loadRequirementsByCriteria = async (criteriaid) => {
        const token = localStorage.getItem('token');
        try {
            const response = await axios.get(`${API_BASE_URL}/api/requirements/criteria/${criteriaid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const list = Array.isArray(response.data?.data) ? response.data.data : [];
            setRequirementsData(prev => ({ ...prev, [Number(criteriaid)]: list }));
            return list;
        } catch (err) {
            console.error('Error loading requirements by criteria:', err);
            setRequirementsData(prev => ({ ...prev, [Number(criteriaid)]: [] }));
            return [];
        }
    };

    const bulkDeleteHierarchy = async ({ eventid, areaIds = [], criteriaIds = [], requirementIds = [] }) => {
        const token = localStorage.getItem('token');

        const uniqueAreaIds = [...new Set((areaIds || []).map(Number).filter(Boolean))];
        const uniqueCriteriaIds = [...new Set((criteriaIds || []).map(Number).filter(Boolean))];
        const uniqueRequirementIds = [...new Set((requirementIds || []).map(Number).filter(Boolean))];

        let criteriaIdsToDelete = [...uniqueCriteriaIds];

        if (uniqueAreaIds.length > 0) {
            const criteriaResponse = await axios.get(`${API_BASE_URL}/api/criteria/event/${eventid}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const eventCriteria = Array.isArray(criteriaResponse.data?.data) ? criteriaResponse.data.data : [];
            const derivedCriteriaIds = eventCriteria
                .filter(crit => uniqueAreaIds.includes(Number(crit.areaid)))
                .map(crit => Number(crit.criteriaid));
            criteriaIdsToDelete = [...new Set([...criteriaIdsToDelete, ...derivedCriteriaIds])];
        }

        let requirementIdsToDelete = [...uniqueRequirementIds];
        if (criteriaIdsToDelete.length > 0) {
            const requirementsResponse = await axios.get(`${API_BASE_URL}/api/requirements/all`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const allRequirements = Array.isArray(requirementsResponse.data?.data) ? requirementsResponse.data.data : [];
            const derivedRequirementIds = allRequirements
                .filter(req => criteriaIdsToDelete.includes(Number(req.criteriaid)))
                .map(req => Number(req.requirementid));
            requirementIdsToDelete = [...new Set([...requirementIdsToDelete, ...derivedRequirementIds])];
        }

        try {
            if (requirementIdsToDelete.length > 0) {
                await axios.post(
                    `${API_BASE_URL}/api/requirements/delete`,
                    { requirementIds: requirementIdsToDelete },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            if (criteriaIdsToDelete.length > 0) {
                await axios.delete(`${API_BASE_URL}/api/criteria/delete`, {
                    data: { criteriaIds: criteriaIdsToDelete },
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            if (uniqueAreaIds.length > 0) {
                await axios.post(
                    `${API_BASE_URL}/api/areas/delete`,
                    { areaIds: uniqueAreaIds },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        } catch (err) {
            const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
            throw new Error(apiMessage || 'Failed to delete selected items.');
        }

        await fetchAreasForEventSafe(eventid);
        await fetchNoAreaCriteriaForEvent(eventid);
        await fetchCriteriaOptionsForEvent(eventid);
        setRequirementsData({});
        setNoAreaCriteriaData({});
        try {
            await Promise.all(Array.from(expandedAreas || []).map(id => fetchCriteriaForArea(id, true)));
        } catch (err) {
            console.error('Failed to refresh criteria after delete', err);
        }
        try {
            await Promise.all(Array.from(expandedCriteria || []).map(id => fetchRequirementsForCriteria(id, true)));
        } catch (err) {
            console.error('Failed to refresh requirements after delete', err);
        }
    };

    const closeModal = () => {
        setSelectedEvent(null);
        setExpandedAreas(new Set());
        setExpandedCriteria(new Set());
        setExpandedNoArea(new Set());
        setAreasData({});
        setCriteriaData({});
        setRequirementsData({});
        setNoAreaCriteriaData({});
        setCriteriaOptionsData({});
    };

    const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const visibleEvents = filteredEvents.slice(startIdx, startIdx + itemsPerPage);
    const activeCount = events.filter(e => String(e.status || e.Status || '').toLowerCase().trim() !== 'inactive').length;

    const handleDeleteEvent = async (targetEvent) => {
        const eventid = Number(targetEvent?.eventid);
        if (!eventid) return;

        setSelectedEvent(null);

        const confirmed = await showConfirm(`Delete accreditation "${targetEvent?.eventname || targetEvent?.eventcode || eventid}"? This cannot be undone.`);
        if (!confirmed) return;

        try {
            const resp = await eventsAPI.deleteEvents([eventid]);
            if (resp?.success) {
                toast?.({
                    title: 'Accreditation Deleted',
                    description: `Accreditation "${targetEvent?.eventname || targetEvent?.eventcode || eventid}" deleted successfully`,
                    variant: 'success',
                    duration: 3000,
                });
                await fetchEvents();
                if (selectedEvent?.eventid === eventid) {
                    setSelectedEvent(null);
                }
            } else {
                toast?.({
                    title: 'Delete Failed',
                    description: resp?.message || 'Failed to delete accreditation.',
                    variant: 'error',
                    duration: 3000,
                });
            }
        } catch (err) {
            console.error('Delete accreditation error', err);
            toast?.({
                title: 'Delete Error',
                description: err?.message || 'Error deleting accreditation.',
                variant: 'error',
                duration: 3000,
            });
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header & Metrics */}
            <div className="px-4 sm:px-6 pt-4 pb-3 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Accreditation & Quality Standards</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Manage accreditation frameworks, quality audit sub areas, and standard structures.
                            </p>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            {deleteMode && (
                                <button
                                    onClick={async () => {
                                        const ids = Array.from(selectedEventIdsForDelete).map(Number).filter(Boolean);
                                        if (ids.length === 0) return await showAlert('Select at least one standard to delete.');
                                        const confirmed = await showConfirm(`Delete ${ids.length} selected standard(s)? This cannot be undone.`);
                                        if (!confirmed) return;
                                        try {
                                            const { eventsAPI } = await import('../utils/api');
                                            const resp = await eventsAPI.deleteEvents(ids);
                                            if (resp && resp.success) {
                                                toast?.({
                                                    title: 'Standards Deleted',
                                                    description: resp.message || `${ids.length} standard(s) deleted successfully`,
                                                    variant: 'success',
                                                    duration: 3000,
                                                });
                                                await fetchEvents();
                                            } else {
                                                toast?.({
                                                    title: 'Delete Failed',
                                                    description: resp?.message || 'Failed to delete selected standards.',
                                                    variant: 'error',
                                                    duration: 3000,
                                                });
                                            }
                                        } catch (err) {
                                            console.error('Delete standards error', err);
                                            await showAlert(err?.message || 'Error deleting selected standards.');
                                        } finally {
                                            setDeleteMode(false);
                                            setSelectedEventIdsForDelete(new Set());
                                        }
                                    }}
                                    disabled={selectedEventIdsForDelete.size === 0}
                                    className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all ${
                                        selectedEventIdsForDelete.size === 0
                                            ? 'border-red-200 bg-red-50/50 text-red-400 cursor-not-allowed'
                                            : 'border-red-600 bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-500/20 cursor-pointer'
                                    }`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Selected ({selectedEventIdsForDelete.size})
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    if (deleteMode) {
                                        setDeleteMode(false);
                                        setSelectedEventIdsForDelete(new Set());
                                        return;
                                    }
                                    setDeleteMode(true);
                                    setSelectedEventIdsForDelete(new Set());
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
                                onClick={() => setIsAddEventOpen(true)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Add Accreditation
                            </button>
                        </div>
                    )}
                </div>

                {/* Toolbar: Search, Filter, View Mode */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative w-full">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            >
                                <circle cx="11" cy="11" r="7" />
                                <path d="m20 20-3.5-3.5" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search accreditations or codes..."
                                className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                value={searchTerm}
                                onChange={handleSearchChange}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                        <div className="relative inline-block">
                            <SortEvents value={sortStatus} onChange={setSortStatus} />
                        </div>

                        {/* View Switcher: Grid vs List */}
                        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
                    </div>
                </div>
            </div>

            {/* Events Grid / List / Skeleton / Offline / Empty View */}
            <div className={`flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-3 ${viewMode === 'list' ? 'pb-3' : 'pb-16'} overflow-hidden`}>
                {loading ? (
                    <StandardsSkeleton count={4} />
                ) : error ? (
                    <ServerOfflineState
                        onRetry={() => fetchEvents(true)}
                        isRetrying={isRetrying}
                        title={error === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Standards'}
                        message={error === 'Server Offline' 
                            ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                            : error}
                    />
                ) : filteredEvents.length === 0 ? (
                    <div className="flex-1 w-full min-h-[360px] flex flex-col items-center justify-center p-8 text-center bg-white border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto shadow-2xs">
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 border border-blue-100 text-blue-500 flex items-center justify-center mb-3.5 shadow-2xs">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-slate-800 mb-1">No Standards Found</h3>
                        <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">
                            {searchTerm ? 'No accreditations match your search query.' : 'No accreditations have been created yet.'}
                        </p>
                        {searchTerm ? (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                                Clear Search Filter
                            </button>
                        ) : isAdmin ? (
                            <button
                                type="button"
                                onClick={() => setIsAddEventOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition shadow-sm cursor-pointer"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                Add First Accreditation
                            </button>
                        ) : null}
                    </div>
                ) : viewMode === 'grid' ? (
                    /* Grid Layout (2x2 / responsive cards) */
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 overflow-y-auto pb-14">
                        {visibleEvents.map((event) => {
                            const eventAssignments = (auditorAssignments?.rawList || []).filter(a => Number(a.eventid) === Number(event.eventid));
                            return (
                                <EventCard
                                    key={event.eventid}
                                    event={event}
                                    assignedAreas={eventAssignments}
                                    isAdmin={isAdmin}
                                    showCheckbox={deleteMode}
                                    isChecked={selectedEventIdsForDelete.has(Number(event.eventid))}
                                    onToggleSelect={(ev, checked) => {
                                        setSelectedEventIdsForDelete(prev => {
                                            const next = new Set(prev);
                                            const id = Number(ev.eventid);
                                            if (checked) next.add(id);
                                            else next.delete(id);
                                            return next;
                                        });
                                    }}
                                    onClick={() => {
                                        if (deleteMode) {
                                            setSelectedEventIdsForDelete(prev => {
                                                const next = new Set(prev);
                                                const id = Number(event.eventid);
                                                if (next.has(id)) next.delete(id);
                                                else next.add(id);
                                                return next;
                                            });
                                            return;
                                        }
                                        openEventModal(event);
                                    }}
                                    onCopy={(originalEvent) => {
                                        openCopyModal(originalEvent);
                                    }}
                                    onEdit={(originalEvent) => {
                                        setEditPopup({ open: true, event: originalEvent });
                                    }}
                                    onAssignPersonnel={(originalEvent) => {
                                        setAssignScopeEvent(originalEvent);
                                    }}
                                    onDelete={handleDeleteEvent}
                                />
                            );
                        })}
                    </div>
                ) : (
                    /* Standard Card Rows List View (Matching MasterList, Events & OfficeHeads) */
                    <div className="flex-1 min-h-0 app-list-scroll overflow-x-auto pr-1">
                        <div className="flex flex-col min-w-[880px] pb-14">
                            {/* Sticky Header Row */}
                            <div className="grid grid-cols-12 items-center gap-3 px-5 py-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-semibold text-slate-700 sticky top-0 z-20 mb-2">
                                <div className="col-span-4 flex items-center gap-2">
                                    {deleteMode && <span>Select</span>}
                                    <span>Accreditation & Code</span>
                                </div>
                                <div className="col-span-1 flex items-center">Level</div>
                                <div className="col-span-1 flex items-center">Status</div>
                                <div className="col-span-3 flex items-center">Due</div>
                                {isAuditor ? (
                                    <div className="col-span-2 flex items-center">Assigned Areas</div>
                                ) : (
                                    <div className="col-span-2 flex items-center justify-start">Timestamps</div>
                                )}
                                <div className="col-span-1 flex items-center justify-end pr-1">Options</div>
                            </div>

                            {/* Separated Card Rows */}
                            <div className="space-y-2">
                                {visibleEvents.map((event) => {
                                    const eventAssignments = (auditorAssignments?.rawList || []).filter(a => Number(a.eventid) === Number(event.eventid));
                                    const isactive = String(event.status || event.Status || '').toLowerCase().trim() !== 'inactive';
                                    const isChecked = selectedEventIdsForDelete.has(Number(event.eventid));

                                    return (
                                        <div
                                            key={event.eventid}
                                            onClick={() => {
                                                if (deleteMode) {
                                                    setSelectedEventIdsForDelete(prev => {
                                                        const next = new Set(prev);
                                                        const id = Number(event.eventid);
                                                        if (next.has(id)) next.delete(id);
                                                        else next.add(id);
                                                        return next;
                                                    });
                                                    return;
                                                }
                                                openEventModal(event);
                                            }}
                                            className={`rounded-xl bg-white shadow-2xs transition-all duration-200 ${
                                                isChecked
                                                    ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                                                    : deleteMode
                                                        ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                                                        : 'border border-slate-200/90 app-card-hover cursor-pointer'
                                            }`}
                                        >
                                            <div className="grid grid-cols-12 items-center gap-3 px-5 py-3.5">
                                                {/* Accreditation Name & Code */}
                                                <div className="col-span-4 flex items-center gap-3 min-w-0">
                                                    {deleteMode && (
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                setSelectedEventIdsForDelete(prev => {
                                                                    const next = new Set(prev);
                                                                    const id = Number(event.eventid);
                                                                    if (e.target.checked) next.add(id);
                                                                    else next.delete(id);
                                                                    return next;
                                                                });
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            aria-label={`Select ${event.eventname}`}
                                                            className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                                                        />
                                                    )}
                                                    <div className="h-9 w-9 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                                        {event.eventcode ? event.eventcode.slice(0, 2).toUpperCase() : 'ST'}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-bold text-slate-900 truncate leading-snug hover:text-blue-600 transition-colors">
                                                            {event.eventname}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 truncate">
                                                            <span className="font-semibold text-blue-600">{event.eventcode || 'STANDARD'}</span>
                                                            {event.Description && (
                                                                <>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className="text-slate-400 truncate">{event.Description}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Level */}
                                                <div className="col-span-1 flex items-center">
                                                    {event.accreditationlevel && event.accreditationlevel.toUpperCase() !== 'N/A' ? (
                                                        <span className="inline-flex items-center rounded-lg bg-indigo-50 border border-indigo-200/60 px-2.5 py-1 text-xs font-bold text-indigo-700 shadow-2xs whitespace-nowrap">
                                                            {event.accreditationlevel}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </div>

                                                {/* Status */}
                                                <div className="col-span-1 flex items-center">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border whitespace-nowrap ${
                                                        isactive
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70'
                                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${isactive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {isactive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>

                                                {/* Due */}
                                                <div className="col-span-3 flex items-center min-w-0">
                                                    {(() => {
                                                        const dl = getDeadlineInfo(event.deadline, event);
                                                        return dl.hasDeadline ? (
                                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${dl.badgeClasses} max-w-full truncate`}>
                                                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dl.dotClasses}`} />
                                                                <span className="truncate">Due {dl.formattedDate} {dl.shortLabel ? `(${dl.shortLabel})` : ''}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">—</span>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Timestamps or Assigned Areas */}
                                                {isAuditor ? (
                                                    <div className="col-span-2 flex items-center">
                                                        {eventAssignments.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1 max-w-xs">
                                                                {eventAssignments.slice(0, 2).map(a => (
                                                                    <span key={a.id || a.areaid} className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                                                        {a.areacode || a.areaname}
                                                                    </span>
                                                                ))}
                                                                {eventAssignments.length > 2 && (
                                                                    <span className="text-[10px] text-slate-500 font-semibold self-center">
                                                                        +{eventAssignments.length - 2} more
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-400 text-xs">—</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="col-span-2 flex flex-col justify-center min-w-0">
                                                        <div className="text-xs font-semibold text-slate-700">
                                                            {new Date(event.createdat).toLocaleDateString()}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                            Updated: {new Date(event.updatedat || event.createdat).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Options */}
                                                <div className="col-span-1 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                                                    <EventRowOptionsMenu
                                                        event={event}
                                                        onOpenStructure={() => openEventModal(event)}
                                                        onEdit={isAdmin ? () => setEditPopup({ open: true, event }) : undefined}
                                                        onCopy={isAdmin ? () => openCopyModal(event) : undefined}
                                                        onDelete={isAdmin ? () => handleDeleteEvent(event) : undefined}
                                                        onAssignPersonnel={isAdmin ? () => setAssignScopeEvent(event) : undefined}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination Controls (Grid and List mode) */}
            {!loading && !error && filteredEvents.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    fixed={true}
                    showWhenSinglePage={true}
                />
            )}

            {/* Edit Event Popup */}
            <EditEventPopup
                open={editPopup.open}
                event={editPopup.event}
                onCancel={() => {
                    setEditPopup({ open: false, event: null });
                }}
                onConfirm={async (eventData) => {
                    const targetEventId = eventData?.eventid || editPopup.event?.eventid;
                    if (!targetEventId) return;
                    try {
                        await eventsAPI.updateEvent(targetEventId, {
                            eventname: eventData.eventname,
                            eventcode: eventData.eventcode,
                            description: eventData.description,
                            status: eventData.status,
                            accreditationlevel: eventData.accreditationlevel,
                            deadline: eventData.deadline ?? null
                        });
                        await fetchEvents();
                        setEditPopup({ open: false, event: null });
                        setSelectedEvent(prev => prev && (prev.eventid === targetEventId || prev.eventid === Number(targetEventId)) ? {
                            ...prev,
                            eventname: eventData.eventname,
                            eventcode: eventData.eventcode,
                            description: eventData.description,
                            status: eventData.status,
                            accreditationlevel: eventData.accreditationlevel,
                            deadline: eventData.deadline ?? null
                        } : prev);
                        await showAlert('Event updated successfully!', 'success');
                    } catch (err) {
                        await showAlert('Failed to update event: ' + (err?.response?.data?.message || err.message), 'error');
                    }
                }}
            />

            {/* Add Event Modal triggered from Actions menu */}
            {isAddEventOpen && (
                <AddEventModal
                    isOpen={isAddEventOpen}
                    onClose={() => setIsAddEventOpen(false)}
                    onSuccess={async (data) => {
                        setIsAddEventOpen(false);
                        try {
                            await fetchEvents();
                        } catch (err) {
                            console.error('Failed to refresh events after add', err);
                        }
                    }}
                />
            )}

            {/* Modal */}
            {!copyPopup.open && !editPopup.open && (
                <EventPopup
                    selectedEvent={selectedEvent}
                    isAdminProp={isAdmin}
                    areasData={areasData}
                    criteriaData={criteriaData}
                    requirementsData={requirementsData}
                    expandedAreas={expandedAreas}
                    expandedCriteria={expandedCriteria}
                    expandedNoArea={expandedNoArea}
                    noAreaCriteriaData={noAreaCriteriaData}
                    criteriaOptions={criteriaOptionsData[selectedEvent?.eventid] || []}
                    loadingAreas={loadingAreas}
                    loadingCriteria={loadingCriteria}
                    loadingRequirements={loadingRequirements}
                    loadingNoAreaCriteria={loadingNoAreaCriteria}
                    onClose={closeModal}
                    onToggleArea={toggleArea}
                    onToggleCriteria={toggleCriteria}
                    onToggleNoArea={() => toggleNoAreaSection(selectedEvent?.eventid)}
                    onAddArea={addArea}
                    onAddNoAreaCriteria={addNoAreaCriteria}
                    onAddCriteria={addCriteria}
                    onAddRequirement={addRequirement}
                    onLoadRequirementsByCriteria={loadRequirementsByCriteria}
                    onPrepareStructureData={() => {
                        if (selectedEvent?.eventid && !criteriaOptionsData[selectedEvent.eventid]) {
                            fetchCriteriaOptionsForEvent(selectedEvent.eventid);
                        }
                    }}
                    onEditArea={editArea}
                    onEditCriteria={editCriteria}
                    onBulkDelete={bulkDeleteHierarchy}
                    onEditEvent={(evt) => setEditPopup({ open: true, event: evt })}
                    onCopyEvent={(evt) => openCopyModal(evt)}
                    isAdmin={isAdmin}
                />
            )}
            {/* Copy Event Popup */}
            {copyPopup.open && (
                <CopyEventPopup
                    open={copyPopup.open}
                    defaultName={copyPopup.defaultName || (copyPopup.event?.eventname ? copyPopup.event.eventname + ' (Copy)' : '')}
                    defaultCode={copyPopup.defaultCode || (copyPopup.event?.eventcode ? copyPopup.event.eventcode + '-COPY' : '')}
                    defaultDescription={copyPopup.event?.Description || ''}
                    onCancel={() => setCopyPopup({ open: false, event: null })}
                    onConfirm={async ({ eventname, eventcode, description }) => {
                        try {
                            const token = localStorage.getItem('token');
                            await axios.post(`${API_BASE_URL}/api/events/copy`, {
                                sourceEventId: copyPopup.event.eventid,
                                newEventName: eventname,
                                newEventCode: eventcode,
                                newDescription: description
                            }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            setCopyPopup({ open: false, event: null });
                            await fetchEvents();
                            toast?.({
                                title: 'Event Copied',
                                description: `Successfully copied "${eventname}"`,
                                variant: 'success',
                                duration: 3000,
                            });
                        } catch (err) {
                            toast?.({
                                title: 'Copy Failed',
                                description: err?.response?.data?.message || err.message || 'Failed to copy event',
                                variant: 'error',
                                duration: 3000,
                            });
                        }
                    }}
                />
            )}
            {assignScopeEvent && (
                <AssignPersonnelScopeModal
                    isOpen={Boolean(assignScopeEvent)}
                    onClose={() => setAssignScopeEvent(null)}
                    event={assignScopeEvent}
                />
            )}
        </div>
    );
}

export default ALL;
