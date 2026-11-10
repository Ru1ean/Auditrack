import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from 'react-dom';
import { officesAPI, requirementsAPI, usersAPI, eventDepartmentsAPI } from "../../utils/api";
import { useModal } from "../UI/ModalProvider";
import userIcon from "../../assets/images/user.svg";
import SmartUserAvatar from "../UI/SmartUserAvatar";
import Pagination from "../Pagination/Pagination";
import { API_BASE_URL } from '../../utils/apiBase';
import { formatDateTime } from '../../utils/formatDateTime';
import { OfficeCardSkeleton } from "../UI/Skeleton";
import { useLiveRefresh } from "../../utils/liveSync";
import ServerOfflineState from "../UI/ServerOfflineState";
import { GraduationCap, Building2, ChevronDown, Award, Layers } from "lucide-react";
import { isAcademicEntity } from "../../utils/entityHelpers";

const renderOfficeIcon = (office, deleteMode = false) => {
    const isAcademic = isAcademicEntity(office);

    const transformStyle = {
        transform: deleteMode ? 'translateX(1.75rem)' : 'translateX(0)',
        transition: 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    };

    if (isAcademic) {
        return (
            <div
                style={transformStyle}
                className="h-9 w-9 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100"
            >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A57.778 57.778 0 0012 13.5" />
                </svg>
            </div>
        );
    }
    return (
        <div
            style={transformStyle}
            className="h-9 w-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100"
        >
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 16.5h1.5m3 0H15M9 21v-3a1 1 0 011-1h4a1 1 0 011 1v3" />
            </svg>
        </div>
    );
};

const OfficesP = forwardRef(
    ({ searchTerm, deleteMode, onSelectionChange, onOfficeClick, onEditOffice, onAddRequirements, onDeleteOffice, eventType, officeTypes, heads, events = [], viewMode = 'grid', sortStatus, highlightOfficeId = null, hideHeader = false, departmentFilter = '', programTypeFilter = '', officeTypeFilter = '' }, ref) => {
        const [offices, setOffices] = useState([]);
        const [selectedIds, setSelectedIds] = useState([]);
        const [loading, setLoading] = useState(true);
        const [openMenuOfficeId, setOpenMenuOfficeId] = useState(null);
        const [openMenuAnchorRect, setOpenMenuAnchorRect] = useState(null);
        const [activeHighlightOfficeId, setActiveHighlightOfficeId] = useState(null);
        const [myAssignedOfficeCounts, setMyAssignedOfficeCounts] = useState({});
        const [currentUser, setCurrentUser] = useState(() => {
            try {
                const stored = localStorage.getItem('user');
                return stored ? JSON.parse(stored) : null;
            } catch {
                return null;
            }
        });
        const { showAlert, showConfirm } = useModal();

        const roleid = Number(currentUser?.roleid);
        const rolename = String(currentUser?.rolename || currentUser?.rolename || '').toLowerCase();
        const isAuditor = roleid === 4 || rolename.includes('auditor') || Boolean(currentUser?.isExternalAuditor);
        const isPersonnel = (roleid === 2 || roleid === 3 || rolename.includes('personnel') || rolename.includes('office') || rolename === 'user' || rolename === 'head') && !rolename.includes('auditor') && roleid !== 4 && roleid !== 1 && rolename !== 'admin';
        const isAdmin = (roleid === 1 || rolename === 'admin') && !isPersonnel;

        const [serverError, setServerError] = useState(null);
        const [isRetrying, setIsRetrying] = useState(false);

        // Fetch offices from backend
        const fetchOffices = async (options = false) => {
            const isRetry = options === true;
            const isSilent = Boolean(options && typeof options === 'object' && options.silent) || (offices && offices.length > 0 && !isRetry);
            try {
                if (isRetry) setIsRetrying(true);
                else if (!isSilent) setLoading(true);
                setServerError(null);
                const [res, myAssignmentsRes] = await Promise.all([
                    officesAPI.getAll(),
                    requirementsAPI.getMyAssignments().catch(() => null),
                ]);

                const officesData = Array.isArray(res) ? res : (res && res.data) || [];
                const assignmentRows = Array.isArray(myAssignmentsRes?.data) ? myAssignmentsRes.data : [];
                const officeIdsFromRes = Array.isArray(myAssignmentsRes?.officeIds) ? myAssignmentsRes.officeIds : [];
                const countsByOffice = assignmentRows.reduce((acc, row) => {
                    const officeid = String(row?.officeid ?? '');
                    if (!officeid) return acc;
                    acc[officeid] = (acc[officeid] || 0) + 1;
                    return acc;
                }, {});
                officeIdsFromRes.forEach((id) => {
                    const oid = String(id ?? '');
                    if (oid && !countsByOffice[oid]) {
                        countsByOffice[oid] = 1;
                    }
                });

                setOffices(officesData);
                setMyAssignedOfficeCounts(countsByOffice);
                if (!isSilent) {
                    setSelectedIds([]);
                }
                setServerError(null);
            } catch (err) {
                console.error("Failed to load offices:", err);
                if (!isSilent) {
                    setOffices([]);
                    setMyAssignedOfficeCounts({});
                    if (!err.response || err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network error') || err.message?.toLowerCase().includes('failed to fetch')) {
                        setServerError('Server Offline');
                    } else {
                        setServerError(err.response?.data?.message || 'Failed to load offices.');
                    }
                }
            } finally {
                if (!isSilent) setLoading(false);
                if (isRetry) setIsRetrying(false);
            }
        };

        const [eventDepartments, setEventDepartments] = useState([]);
        const [loadingProgramLevel, setLoadingProgramLevel] = useState(null);

        const fetchEventDepartments = useCallback(async () => {
            if (!eventType || eventType === 'all') {
                setEventDepartments([]);
                return;
            }
            try {
                const res = await eventDepartmentsAPI.getByEvent(eventType);
                setEventDepartments(Array.isArray(res?.data) ? res.data : []);
            } catch (err) {
                console.error("Failed to load event departments:", err);
                setEventDepartments([]);
            }
        }, [eventType]);

        useEffect(() => {
            fetchEventDepartments();
        }, [fetchEventDepartments]);

        const handleUpdateProgramLevel = async (officeid, newLevel) => {
            try {
                setLoadingProgramLevel(officeid);
                await officesAPI.updateLevel(officeid, newLevel);
                await fetchOffices({ silent: true });
                if (showAlert) {
                    showAlert(`Updated accreditation level to ${newLevel}`, 'success');
                }
            } catch (err) {
                console.error("Failed to update program accreditation level:", err);
                if (showAlert) {
                    showAlert("Failed to update accreditation level", 'error');
                }
            } finally {
                setLoadingProgramLevel(null);
            }
        };

        // Expose refresh + delete via ref
        useImperativeHandle(ref, () => ({
            refresh: (opts) => {
                fetchOffices(opts || { silent: true });
                fetchEventDepartments();
            },
            deleteSelected: async (ids) => {
                try {
                    const targetIds = ids || selectedIds;
                    if (targetIds && targetIds.length > 0) {
                        await officesAPI.deleteMultipleOffices(targetIds);
                    }
                    setSelectedIds([]);
                    fetchOffices();
                    return { success: true };
                } catch (err) {
                    console.error(err);
                    return { success: false, message: err.message };
                }
            },
            clearSelection: () => setSelectedIds([]),
            openOfficeById: (officeid, options = {}) => {
                const targetId = String(officeid || '');
                if (!targetId) return false;

                const targetIndex = filtered.findIndex(
                    (office) => String(office?.id ?? office?.officeid ?? '') === targetId
                );

                if (targetIndex === -1) return false;

                const targetOffice = filtered[targetIndex];
                const targetPage = Math.floor(targetIndex / itemsPerPage) + 1;

                setCurrentPage(targetPage);
                setActiveHighlightOfficeId(targetId);

                setTimeout(() => {
                    setActiveHighlightOfficeId((prev) => (prev === targetId ? null : prev));
                }, 5000);

                if (options?.openModal !== false && typeof onOfficeClick === 'function') {
                    onOfficeClick(targetOffice);
                }

                return true;
            },
        }));

        // Clear selection when deleteMode is turned off
        useEffect(() => {
            if (!deleteMode) setSelectedIds([]);
        }, [deleteMode]);

        useEffect(() => {
            if (!openMenuOfficeId) return;

            const handleOutsideClick = (event) => {
                const target = event.target;
                if (target.closest('.office-card-actions-menu') || target.closest('.office-card-actions-button')) {
                    return;
                }

                setOpenMenuOfficeId(null);
            };

            document.addEventListener('mousedown', handleOutsideClick);
            return () => document.removeEventListener('mousedown', handleOutsideClick);
        }, [openMenuOfficeId]);

        useEffect(() => {
            const nextId = highlightOfficeId ? String(highlightOfficeId) : null;
            if (!nextId) return;

            setActiveHighlightOfficeId(nextId);
            const timer = setTimeout(() => {
                setActiveHighlightOfficeId((prev) => (prev === nextId ? null : prev));
            }, 5000);

            return () => clearTimeout(timer);
        }, [highlightOfficeId]);

        // Load on mount
        useEffect(() => {
            fetchOffices();
            // fetch current user for permission checks
            const fetchCurrentUser = async () => {
                try {
                    const res = await usersAPI.getLoggedInUser().catch(() => null);
                    if (res && res.success) setCurrentUser(res.user);
                } catch (err) {
                    console.error('Failed to load current user:', err);
                }
            };
            fetchCurrentUser();
        }, []);

        // Live syncing on mutations / window focus
        useLiveRefresh(fetchOffices);

        // Notify parent when selected changes
        useEffect(() => {
            const selectedItems = offices.filter(o => selectedIds.includes(o.id));
            onSelectionChange(selectedIds.length, selectedIds, selectedItems);
        }, [selectedIds, offices, onSelectionChange]);

        const handleCheckboxChange = (id, checked) => {
            if (checked) setSelectedIds([...selectedIds, id]);
            else setSelectedIds(selectedIds.filter((i) => i !== id));
        };

        const handleExportOffice = async (office) => {
            try {
                const officeid = office?.id || office?.officeid;
                if (!officeid) return;

                const officename = office?.officename || office?.officename || `office-${officeid}`;
                const { url, filename } = await officesAPI.exportOfficeExcel(officeid, officename);

                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                }, 200);
            } catch (err) {
                console.error('Failed to export office:', err);
                await showAlert(err?.response?.data?.message || err?.message || 'Failed to export office data.');
            }
        };

        // Get status badge style
        const getStatusStyle = (status, totalReqs = null) => {
            if (totalReqs !== null && Number(totalReqs) === 0) {
                return 'bg-slate-100 text-slate-600 border-slate-200';
            }
            const s = String(status || '').toLowerCase();
            if (s.includes('no standard') || s.includes('no req') || s === 'n/a' || s === 'empty') {
                return 'bg-slate-100 text-slate-600 border-slate-200';
            }
            switch (status) {
                case 'Complied':
                    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
                case 'Partially Complied':
                case 'Partial':
                    return 'bg-amber-50 text-amber-700 border-amber-200';
                default:
                    return 'bg-rose-50 text-rose-700 border-rose-200';
            }
        };

        const getStatusDot = (status, totalReqs = null) => {
            if (totalReqs !== null && Number(totalReqs) === 0) {
                return 'bg-slate-400';
            }
            const s = String(status || '').toLowerCase();
            if (s.includes('no standard') || s.includes('no req') || s === 'n/a' || s === 'empty') {
                return 'bg-slate-400';
            }
            switch (status) {
                case 'Complied': return 'bg-emerald-500';
                case 'Partially Complied':
                case 'Partial': return 'bg-amber-500';
                default: return 'bg-rose-500';
            }
        };

        // Map eventid -> event object for quick lookup (eventcode)
        const eventsMap = useMemo(() => {
            try {
                const m = new Map();
                (events || []).forEach(ev => {
                    const id = String(ev.eventid ?? ev.id ?? ev.eventcode ?? ev.eventcode ?? '');
                    if (id) m.set(id, ev);
                });
                return m;
            } catch (e) {
                return new Map();
            }
        }, [events]);

        // Helper to check if office is assigned to the current personnel user
        const isOfficeAssignedToPersonnel = useCallback((o) => {
            if (!currentUser) return false;
            const uid = String(currentUser.userid ?? currentUser.id ?? '');
            const hid = String(currentUser.headid ?? currentUser.headid ?? '');
            const officeid = String(o.id ?? o.officeid ?? '');

            // 1. Check requirements assignments count
            if (myAssignedOfficeCounts && Number(myAssignedOfficeCounts[officeid] || 0) > 0) return true;

            // 2. Check heads array
            if (Array.isArray(o.heads) && o.heads.length > 0) {
                const matchedHead = o.heads.some(h => {
                    if (uid && (String(h.userid ?? '') === uid || String(h.userid ?? '') === uid)) return true;
                    if (hid && (String(h.headid ?? '') === hid || String(h.headid ?? '') === hid)) return true;
                    
                    const headName = String(h.full_name || `${h.firstname || ''} ${h.lastname || ''}`).toLowerCase().trim();
                    const userFirst = String(currentUser.firstname || currentUser.firstname || '').toLowerCase().trim();
                    const userLast = String(currentUser.lastname || currentUser.lastname || '').toLowerCase().trim();
                    if (userFirst && userLast && headName) {
                        if (headName.includes(userFirst) && headName.includes(userLast)) return true;
                    } else if (userFirst && headName && headName.includes(userFirst)) {
                        return true;
                    }
                    return false;
                });
                if (matchedHead) return true;
            }

            // 3. Check direct headid / head_ids
            if (hid) {
                if (String(o.headid ?? '') === hid) return true;
                if (Array.isArray(o.head_ids) && o.head_ids.some(id => String(id) === hid)) return true;
            }

            // 4. Check head_name string
            if (o.head_name && o.head_name !== 'Unassigned' && o.head_name !== 'unassigned') {
                const headName = String(o.head_name).toLowerCase().trim();
                const userFirst = String(currentUser.firstname || currentUser.firstname || '').toLowerCase().trim();
                const userLast = String(currentUser.lastname || currentUser.lastname || '').toLowerCase().trim();
                if (userFirst && userLast) {
                    if (headName.includes(userFirst) && headName.includes(userLast)) return true;
                } else if (userFirst && headName && headName.includes(userFirst)) {
                    return true;
                }
            }

            return false;
        }, [currentUser, myAssignedOfficeCounts]);

        // Restrict offices for Personnel users
        const roleFilteredOffices = useMemo(() => {
            if (isPersonnel) {
                return offices.filter(isOfficeAssignedToPersonnel);
            }
            return offices;
        }, [offices, isPersonnel, isOfficeAssignedToPersonnel]);

        // Search filter
        const filteredBySearch = roleFilteredOffices.filter((o) => {
            const officename = (o.officename || '').toLowerCase();
            const headName = (o.head_name || 'unassigned').toLowerCase();
            const officeType = (o.office_type_name || '').toLowerCase();
            const search = searchTerm.toLowerCase();

            return officename.includes(search) ||
                headName.includes(search) ||
                officeType.includes(search);
        });

        // Filter by event type
        const filteredByEvent = eventType
            ? filteredBySearch.filter((o) => String(o.eventid) === String(eventType))
            : filteredBySearch;

        // Normalize office status to keys: 'compiled', 'partially_compiled', 'not_compiled', 'no_standards'
        const getStatusKey = (office) => {
            const totalReqs = Number(office?.totalrequirements ?? 0);
            const s = (office?.overallstatus || '').toLowerCase().trim();
            if (totalReqs === 0 || s.includes('no standard') || s.includes('no req') || s === 'n/a' || s === 'empty') {
                return 'no_standards';
            }
            // common variations from DB: 'Complied', 'Partially Complied', 'Not Complied',
            // also handle phrases like 'Partially Complied - 50%' or 'Not yet complied'
            if (!s) return 'not_compiled';
            if (s.includes('partial') || s.includes('partially')) return 'partially_compiled';
            if (s.includes('not') || s.includes("n't") || s.includes('incomplete') || s.includes('pending') || s.includes('un') || s.includes('no')) return 'not_compiled';
            if (s.includes('complied') || s.includes('compiled') || s.includes('complete') || s.includes('done') || s.includes('passed') || s.includes('yes')) return 'compiled';
            // fallback heuristics
            if (s.includes('comp')) return 'compiled';
            if (s.includes('part')) return 'partially_compiled';
            return 'not_compiled';
        };

        // Debug: log distinct overallstatus values once so we can adapt matching if needed
        useEffect(() => {
            if (!offices || offices.length === 0) return;
            const statuses = Array.from(new Set(offices.map(o => (o.overallstatus || '').toString()))).slice(0, 50);
            console.debug('OfficesP: distinct overallstatus values:', statuses);
        }, [offices]);

        // Filter by compile status if provided (compiled / partially_compiled / not_compiled / no_standards)
        // Treat 'all' as no filter
        const compiledFiltered = (sortStatus && sortStatus !== 'all')
            ? filteredByEvent.filter((o) => getStatusKey(o) === sortStatus)
            : filteredByEvent;

        // Filter by department if selected
        const deptFiltered = departmentFilter
            ? compiledFiltered.filter((o) => String(o.departmentid ?? o.DepartmentID ?? o.DepartmentId ?? '') === String(departmentFilter))
            : compiledFiltered;

        // Filter by program type if selected
        const programFiltered = programTypeFilter
            ? deptFiltered.filter((o) => String(o.program_type_id ?? o.ProgramTypeID ?? o.ProgramTypeId ?? '') === String(programTypeFilter))
            : deptFiltered;

        // Filter by office type category (academic / non_academic)
        const isAcademicLabel = (label) => {
            if (!label) return false;
            const name = String(label).toLowerCase();
            if (/\bnon\b|non-?academic|not\s+academic/.test(name)) return false;
            return /\bacademic\b/.test(name);
        };

        let filtered = programFiltered;
        if (officeTypeFilter === 'academic') {
            filtered = programFiltered.filter((o) => isAcademicLabel(o.office_type_name || o.office_type || o.officeTypeName || ''));
        } else if (officeTypeFilter === 'non_academic') {
            filtered = programFiltered.filter((o) => !isAcademicLabel(o.office_type_name || o.office_type || o.officeTypeName || ''));
        }

        const ACCREDITATION_LEVELS = [
            'None',
            'Candidate',
            'Level I',
            'Level II',
            'Level III',
            'Level IV',
        ];

        const isAcademicOffice = (o) => {
            return isAcademicEntity(o);
        };

        const academicOffices = useMemo(() => {
            return filtered.filter(isAcademicOffice);
        }, [filtered]);

        const nonAcademicOffices = useMemo(() => {
            return filtered.filter(o => !isAcademicOffice(o));
        }, [filtered]);

        const academicByDept = useMemo(() => {
            const map = new Map();

            // Populate from known eventDepartments for this event
            for (const ed of eventDepartments) {
                map.set(String(ed.departmentid), {
                    deptId: ed.departmentid,
                    deptName: ed.department_name,
                    eventDeptId: ed.id,
                    programs: [],
                });
            }

            // Populate academic offices into their department groups
            for (const office of academicOffices) {
                const deptKey = String(office.departmentid || 'unassigned');
                const deptName = office.department_name || 'Unassigned Department';

                if (!map.has(deptKey)) {
                    map.set(deptKey, {
                        deptId: office.departmentid || null,
                        deptName,
                        eventDeptId: office.eventdepartmentid || null,
                        programs: [],
                    });
                }

                const entry = map.get(deptKey);
                entry.programs.push(office);
                if (office.eventdepartmentid && !entry.eventDeptId) {
                    entry.eventDeptId = office.eventdepartmentid;
                }
            }

            return Array.from(map.values()).filter(group => group.programs.length > 0);
        }, [academicOffices, eventDepartments]);

        // Pagination (cap list view at 30 items per page)
        const [currentPage, setCurrentPage] = useState(1);
        const itemsPerPageGrid = 6; // used only in grid view
        const itemsPerPageList = 30;
        const itemsPerPage = viewMode === 'list' ? itemsPerPageList : itemsPerPageGrid;
        const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
        const startIdx = (currentPage - 1) * itemsPerPage;
        const paginated = filtered.slice(startIdx, startIdx + itemsPerPage);

        useEffect(() => {
            if (currentPage > totalPages) setCurrentPage(1);
        }, [filtered.length, totalPages, currentPage]);

        if (loading) {
            return (
                <div className="w-full py-4">
                    <OfficeCardSkeleton count={6} />
                </div>
            );
        }

        if (serverError) {
            return (
                <ServerOfflineState
                    onRetry={() => fetchOffices(true)}
                    isRetrying={isRetrying}
                    title={serverError === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Offices'}
                    message={serverError === 'Server Offline' 
                        ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                        : serverError}
                />
            );
        }

        if (filtered.length === 0) {
            return (
                <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
                    <div className="w-16 h-16 bg-blue-50 border border-blue-100 text-blue-500 rounded-2xl flex items-center justify-center mb-3">
                        <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">
                        {isAuditor ? 'No Assigned Programs or Offices' : 'No Matching Offices'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm">
                        {isAuditor 
                            ? 'You are not assigned to any audit areas yet. Once an administrator assigns you to an audit area, the corresponding programs and offices will appear here.'
                            : searchTerm ? 'No programs or offices match your current search or filter.' : 'No offices or programs are assigned to the selected event yet.'}
                    </p>
                </div>
            );
        }

        // Helper to render individual Office Card (Grid View)
        const renderOfficeCard = (office) => {
            const officeid = String(office?.id ?? office?.officeid ?? '');
            const officeHeads = office.heads || [];
            const officeAuditors = office.auditors || [];
            const totalReqs = Number(office.totalrequirements || 0);
            const compliancepercent = Math.max(0, Math.min(100, Number(office.compliancepercent || 0)));
            const statusLabel = totalReqs === 0
                ? 'No Standards'
                : (office.overallstatus === 'Partially Complied' ? 'Partial' : (office.overallstatus || 'Not Complied'));

            const isSelected = selectedIds.includes(office.id);
            const isHighlighted = officeid && officeid === String(activeHighlightOfficeId || '');
            const isAssignedToMe = (myAssignedOfficeCounts[officeid] || 0) > 0;

            const officeEventId = String(office.eventid ?? office.eventid ?? office.eventid ?? '');
            const matchedEvent = eventsMap.get(officeEventId);
            const eventcode = matchedEvent?.eventcode ?? matchedEvent?.eventcode ?? matchedEvent?.eventcode ?? office.eventcode ?? office.eventcode ?? '';

            return (
                <div
                    key={office.id}
                    onClick={() => deleteMode ? handleCheckboxChange(office.id, !isSelected) : onOfficeClick(office)}
                    className={`
                        relative rounded-xl bg-white shadow-2xs transition-all duration-200
                        ${isSelected
                            ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                            : deleteMode
                                ? 'border border-gray-200 hover:border-rose-300 cursor-pointer'
                                : isAssignedToMe
                                    ? 'border-cyan-400 bg-cyan-50/40 ring-1 ring-cyan-200 hover:border-cyan-400 cursor-pointer hover:shadow-md'
                                    : isHighlighted
                                        ? 'ring-2 ring-cyan-500 border-cyan-300 shadow-[0_0_0_3px_rgba(6,182,212,0.15)] cursor-pointer'
                                        : 'border border-gray-200 hover:border-cyan-200 hover:shadow-md cursor-pointer'
                        }
                    `}
                >
                    <div className="h-full p-2.5 rounded-xl overflow-visible bg-gradient-to-b from-white via-white to-slate-50/60 flex flex-col justify-between">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-1.5 mb-0.5 min-w-0">
                            <div className="min-w-0 flex-1 flex items-start gap-1.5 relative overflow-hidden">
                                {/* Animated checkbox */}
                                <div
                                    className="absolute left-0 top-2"
                                    style={{
                                        transform: deleteMode ? 'translateX(0)' : 'translateX(-2.5rem)',
                                        opacity: deleteMode ? 1 : 0,
                                        transition: 'transform 220ms cubic-bezier(0.2,0.8,0.2,1), opacity 180ms ease',
                                        pointerEvents: deleteMode ? 'auto' : 'none'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            handleCheckboxChange(office.id, e.target.checked);
                                        }}
                                        className="h-3.5 w-3.5 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                                        aria-label="Select office for deletion"
                                    />
                                </div>

                                {/* When deleteMode is active translate content */}
                                <div
                                    className="flex items-start gap-1.5 min-w-0 flex-1 overflow-hidden"
                                    style={{
                                        transform: deleteMode ? 'translateX(1.75rem)' : 'translateX(0)',
                                        transition: 'transform 220ms cubic-bezier(0.2,0.8,0.2,1)'
                                    }}
                                >
                                    {renderOfficeIcon(office, false)}
                                    <div className="min-w-0 flex-1 overflow-hidden">
                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 leading-snug break-words" title={office.officename}>
                                            {office.officename}
                                        </h3>
                                        <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                                            {eventcode || (officeEventId ? `#${officeEventId}` : 'No event')}
                                        </p>
                                        {(office.department_name || office.program_type_name) && (
                                            <p className="text-[10px] text-slate-400 truncate leading-tight">
                                                {office.department_name ? office.department_name : ''}
                                                {office.department_name && office.program_type_name ? ' • ' : ''}
                                                {office.program_type_name ? office.program_type_name : ''}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-1 shrink-0">
                                {isAcademicOffice(office) && office.accreditationlevel && office.accreditationlevel !== 'None' && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md shadow-2xs">
                                        <Award className="h-3 w-3 text-emerald-600" />
                                        {office.accreditationlevel}
                                    </span>
                                )}
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 overflow-hidden max-w-[7.5rem] truncate">
                                    {office.office_type_name}
                                </span>

                                {!deleteMode && isAdmin && (
                                    <div className="relative z-40">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                setOpenMenuOfficeId((prev) => (prev === office.id ? null : office.id));
                                                setOpenMenuAnchorRect((prev) => (prev && String(openMenuOfficeId) === String(office.id) ? null : rect));
                                            }}
                                            className="office-card-actions-button inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 z-40"
                                            aria-label="Open office actions"
                                        >
                                            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <circle cx="12" cy="5" r="2" />
                                                <circle cx="12" cy="12" r="2" />
                                                <circle cx="12" cy="19" r="2" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Created & Updated Timestamps */}
                        <div className="mt-1 mb-1 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-1 px-0.5">
                            <div className="truncate">
                                <span className="font-semibold uppercase text-slate-400 text-[9px]">Created: </span>
                                <span className="font-medium text-slate-600">{formatDateTime(office.createdat)}</span>
                            </div>
                            <div className="truncate text-right">
                                <span className="font-semibold uppercase text-slate-400 text-[9px]">Updated: </span>
                                <span className="font-medium text-slate-600">{formatDateTime(office.updatedat || office.createdat)}</span>
                            </div>
                        </div>

                        {/* Requirement and status */}
                        <div className="rounded-lg border border-slate-200/90 bg-white/90 px-2 py-1 mb-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-500">
                                    {totalReqs} {totalReqs === 1 ? 'standard' : 'standards'}
                                </span>
                                <span className={`
                                    inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full border
                                    ${getStatusStyle(statusLabel, totalReqs)}
                                `}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(statusLabel, totalReqs)}`}></span>
                                    {statusLabel}
                                </span>
                            </div>
                            <div className="mt-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                                    <span>Compliance</span>
                                    <span className="font-bold text-slate-700">
                                        {totalReqs === 0 ? 'N/A' : `${compliancepercent % 1 === 0 ? compliancepercent.toFixed(0) : compliancepercent.toFixed(1)}%`}
                                    </span>
                                </div>
                                <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${totalReqs === 0 ? 'bg-slate-300' : 'bg-gradient-to-r from-cyan-500 to-indigo-500'}`}
                                        style={{ width: `${totalReqs === 0 ? 0 : compliancepercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personnel & Auditor Section */}
                        <div className="border-t border-slate-100 pt-1">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-semibold text-slate-500">Personnel</span>
                                    {officeHeads.length > 0 && (
                                        <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full">
                                            {officeHeads.length}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-semibold text-sky-600">Auditor</span>
                                    {officeAuditors.length > 0 && (
                                        <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded-full border border-sky-100">
                                            {officeAuditors.length}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start justify-between gap-1.5 pt-0.5">
                                {/* Left: Personnel list */}
                                <div className="flex items-start gap-2 flex-wrap flex-1 min-w-0">
                                    {officeHeads.length === 0 ? (
                                        <div className="flex flex-col items-center max-w-[52px]">
                                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                                                <img src={userIcon} alt="Unassigned" className="w-3.5 h-3.5 opacity-50" />
                                            </div>
                                            <span className="text-[9px] text-slate-400 text-center truncate w-full mt-0.5">Unassigned</span>
                                        </div>
                                    ) : (
                                        officeHeads.map((head) => {
                                            const firstname = (head.full_name || head.firstname || 'Personnel').split(' ')[0];
                                            return (
                                                <div key={head.headid} className="group relative flex flex-col items-center max-w-[54px]">
                                                    <SmartUserAvatar
                                                        user={head}
                                                        size="h-6 w-6"
                                                        textSize="text-[9px] font-bold"
                                                        ring="border border-white shadow-2xs"
                                                    />
                                                    <span 
                                                        className="text-[9px] text-slate-600 text-center truncate w-full mt-0.5 font-medium leading-tight" 
                                                        title={head.full_name}
                                                    >
                                                        {firstname}
                                                    </span>
                                                    <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
                                                        {head.full_name} (Personnel)
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Vertical Separator */}
                                <div className="self-stretch w-px bg-slate-200 my-0.5 shrink-0" />

                                {/* Right: Auditor */}
                                <div className="flex items-start justify-end gap-1.5 shrink-0">
                                    {officeAuditors.length === 0 ? (
                                        <div className="flex flex-col items-center max-w-[52px]">
                                            <div className="w-6 h-6 rounded-full bg-sky-50 border border-sky-100 flex items-center justify-center">
                                                <img src={userIcon} alt="No auditor" className="w-3.5 h-3.5 opacity-40" />
                                            </div>
                                            <span className="text-[9px] text-slate-400 text-center truncate w-full mt-0.5">None</span>
                                        </div>
                                    ) : (
                                        officeAuditors.map((aud) => {
                                            const firstname = (aud.full_name || aud.firstname || 'Auditor').split(' ')[0];
                                            return (
                                                <div key={aud.userid} className="group relative flex flex-col items-center max-w-[54px]">
                                                    <SmartUserAvatar
                                                        user={aud}
                                                        size="h-6 w-6"
                                                        textSize="text-[9px] font-bold"
                                                        ring="border border-white shadow-2xs"
                                                    />
                                                    <span 
                                                        className="text-[9px] text-sky-700 text-center truncate w-full mt-0.5 font-semibold leading-tight" 
                                                        title={aud.full_name}
                                                    >
                                                        {firstname}
                                                    </span>
                                                    <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
                                                        {aud.full_name} (Auditor)
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        };

        // Helper to render individual Office List Row (List View)
        const renderOfficeListRow = (office) => {
            const officeHeads = office.heads || [];
            const officeid = String(office?.id ?? office?.officeid ?? '');
            const officeEventId = String(office.eventid ?? office.eventid ?? office.eventid ?? '');
            const matchedEvent = eventsMap.get(officeEventId);
            const eventcode = matchedEvent?.eventcode ?? matchedEvent?.eventcode ?? matchedEvent?.eventcode ?? office.eventcode ?? office.eventcode ?? '';

            const isSelected = selectedIds.includes(office.id);
            const isHighlighted = officeid && officeid === String(activeHighlightOfficeId || '');
            const isAssignedToMe = (myAssignedOfficeCounts[officeid] || 0) > 0;

            return (
                <div
                    key={office.id}
                    onClick={() => deleteMode ? handleCheckboxChange(office.id, !isSelected) : onOfficeClick(office)}
                    className={`
                        relative rounded-xl bg-white shadow-sm transition-all duration-200
                        ${isSelected
                            ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                            : deleteMode
                                ? 'border border-gray-200 hover:border-rose-300 cursor-pointer'
                                : isAssignedToMe
                                    ? 'border-cyan-400 bg-cyan-50/40 ring-1 ring-cyan-200 hover:border-cyan-400 cursor-pointer hover:shadow-md'
                                    : isHighlighted
                                        ? 'ring-2 ring-cyan-500 border-cyan-300 bg-cyan-50/40 cursor-pointer'
                                        : 'border border-gray-200 hover:border-indigo-200 hover:shadow-md cursor-pointer'
                        }
                    `}
                >
                    <div className="grid grid-cols-[minmax(160px,1fr)_130px_160px_100px_140px_60px] gap-6 items-center px-6 py-4">
                        {/* Office Name */}
                        <div className="flex items-center gap-3 min-w-0 relative">
                            <div
                                className="absolute left-0 top-3"
                                style={{
                                    transform: deleteMode ? 'translateX(0)' : 'translateX(-2.5rem)',
                                    opacity: deleteMode ? 1 : 0,
                                    transition: 'transform 220ms cubic-bezier(0.2,0.8,0.2,1), opacity 180ms ease',
                                    pointerEvents: deleteMode ? 'auto' : 'none'
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => { e.stopPropagation(); handleCheckboxChange(office.id, e.target.checked); }}
                                    className="h-4 w-4 text-rose-600 rounded border-rose-300 focus:ring-rose-500"
                                />
                            </div>

                            {renderOfficeIcon(office, deleteMode)}

                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-slate-900 truncate">{office.officename}</div>
                                <div className="text-xs text-slate-500 truncate">{eventcode}</div>
                                {(office.department_name || office.program_type_name) && (
                                    <div className="text-xs text-slate-400 truncate">{office.department_name ? office.department_name : ''}{office.department_name && office.program_type_name ? ' • ' : ''}{office.program_type_name ? office.program_type_name : ''}</div>
                                )}
                                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                    <span className="font-semibold text-slate-400 uppercase">Created:</span> {formatDateTime(office.createdat)} • <span className="font-semibold text-slate-400 uppercase">Updated:</span> {formatDateTime(office.updatedat || office.createdat)}
                                </div>
                            </div>
                        </div>

                        {/* Office Type */}
                        <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${
                                isAcademicOffice(office)
                                    ? 'bg-blue-50 text-blue-700 border-blue-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}>
                                {office.office_type_name || (isAcademicOffice(office) ? 'Academic' : 'Non Academic')}
                            </span>
                        </div>

                        {/* Compliance Status */}
                        <div className="flex items-center">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(office.overallstatus, office.totalrequirements)}`}>
                                <span className={`w-2 h-2 rounded-full ${getStatusDot(office.overallstatus, office.totalrequirements)}`}></span>
                                {Number(office.totalrequirements || 0) === 0 ? 'No Standards' : (office.overallstatus || 'Not Complied')}
                            </span>
                        </div>

                        {/* Standards */}
                        <div className="flex items-center">
                            <div className="text-xs font-bold text-slate-700">{office.totalrequirements || 0}</div>
                        </div>

                        {/* Level Status (Replacing Personnel per user request) */}
                        <div className="flex items-center">
                            {isAcademicOffice(office) && office.accreditationlevel && office.accreditationlevel !== 'None' && office.accreditationlevel.toUpperCase() !== 'N/A' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200 shadow-2xs">
                                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                                    {office.accreditationlevel}
                                </span>
                            ) : (
                                <span className="text-slate-400 text-xs font-medium">—</span>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                            {!deleteMode && isAdmin && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setOpenMenuOfficeId((prev) => (prev === office.id ? null : office.id));
                                            setOpenMenuAnchorRect((prev) => (prev && String(openMenuOfficeId) === String(office.id) ? null : rect));
                                        }}
                                        className="office-card-actions-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 shadow-2xs hover:border-slate-300 active:scale-95"
                                        aria-label="Open office actions"
                                    >
                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle cx="12" cy="5" r="2" />
                                            <circle cx="12" cy="12" r="2" />
                                            <circle cx="12" cy="19" r="2" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );
        };

        // Controls whether bottom pagination is visible. Set to true if pagination is needed again in the future.
        const SHOW_PAGINATION = false;
        const containerClass = `space-y-4 relative h-full flex-1 min-h-0 overflow-y-auto pr-1 pb-6 custom-scrollbar ${viewMode === 'list' ? 'app-list-scroll overflow-x-auto' : ''}`;

        return (
            <div className={containerClass}>
                {/* Sticky Header Row in List Mode - Perfectly Aligned with Cards */}
                {viewMode === 'list' && (
                    <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur-xs px-[13px] pb-1 pt-0.5">
                        <div className="grid grid-cols-[minmax(160px,1fr)_130px_160px_100px_140px_60px] gap-6 px-6 py-3 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-semibold text-slate-700 min-w-[760px]">
                            <div className="flex items-center">Office Name</div>
                            <div className="flex items-center">Office Type</div>
                            <div className="flex items-center">Compliance Status</div>
                            <div className="flex items-center">Standards</div>
                            <div className="flex items-center">Level Status</div>
                            <div className="flex items-center justify-end">Actions</div>
                        </div>
                    </div>
                )}
                {/* ── ACADEMIC DEPARTMENTS & PROGRAMS SECTION ── */}
                {academicByDept.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <GraduationCap className="h-3.5 w-3.5" />
                                </div>
                                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                    Academic Departments & Programs
                                </h2>
                                <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/80">
                                    {academicByDept.length} {academicByDept.length === 1 ? 'Department' : 'Departments'}
                                </span>
                            </div>
                        </div>

                        {academicByDept.map((deptGroup) => (
                            <div
                                key={deptGroup.deptId || deptGroup.deptName}
                                className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden transition-all"
                            >
                                {/* Department Header Banner */}
                                <div className="bg-gradient-to-r from-slate-50 via-slate-50 to-blue-50/40 px-4 py-3 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-2xs">
                                            <GraduationCap className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                                    {deptGroup.deptName}
                                                </h3>
                                                <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                                    {deptGroup.programs.length} {deptGroup.programs.length === 1 ? 'Program' : 'Programs'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400">Department</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Department Programs List/Grid */}
                                <div className="p-3 bg-slate-50/20">
                                    {viewMode === 'grid' ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 [&>*]:min-w-0">
                                            {deptGroup.programs.map(renderOfficeCard)}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {deptGroup.programs.map(renderOfficeListRow)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── NON-ACADEMIC OFFICES SECTION ── */}
                {nonAcademicOffices.length > 0 && (
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <Building2 className="h-3.5 w-3.5" />
                                </div>
                                <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                    Non-Academic Offices
                                </h2>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                                    {nonAcademicOffices.length} {nonAcademicOffices.length === 1 ? 'Office' : 'Offices'}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
                            {/* Non-Academic Banner */}
                            <div className="bg-gradient-to-r from-slate-50 via-slate-50 to-emerald-50/40 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 tracking-tight">
                                            Institutional Units & Offices
                                        </h3>
                                        <p className="text-[10px] text-slate-400">Evaluated independently of academic departments</p>
                                    </div>
                                </div>
                            </div>

                            {/* Non-Academic Programs List/Grid */}
                            <div className="p-3 bg-slate-50/20">
                                {viewMode === 'grid' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 [&>*]:min-w-0">
                                        {nonAcademicOffices.map(renderOfficeCard)}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {nonAcademicOffices.map(renderOfficeListRow)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Pagination controls - hidden per request as academic & non-academic views render all grouped items. Set SHOW_PAGINATION to true to re-enable */}
                {SHOW_PAGINATION && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(p) => setCurrentPage(p)}
                        fixed={viewMode !== 'list'}
                        showWhenSinglePage={true}
                    />
                )}

                {/* Portal menu to avoid clipping inside card/list containers */}
                {openMenuOfficeId && openMenuAnchorRect && (() => {
                    try {
                        const menuOffice = offices.find(o => String(o.id ?? o.officeid ?? '') === String(openMenuOfficeId));
                        if (!menuOffice) return null;
                        const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
                        const menuWidth = 192; // 12rem = 192px (w-48)
                        const viewportRight = (window.innerWidth / zoom) - 8;
                        const desiredLeft = (openMenuAnchorRect.right / zoom) - menuWidth;
                        const left = Math.min(desiredLeft, viewportRight - menuWidth);
                        const top = (openMenuAnchorRect.bottom / zoom) + 4;

                        return createPortal(
                            <div
                                className="office-card-actions-menu"
                                style={{ position: 'fixed', top: top, left: Math.max(8, left), zIndex: 9999 }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuOfficeId(null); setOpenMenuAnchorRect(null); onEditOffice?.(menuOffice); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
                                    >
                                        <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Edit Office Info</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuOfficeId(null); setOpenMenuAnchorRect(null); onAddRequirements?.(menuOffice); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition whitespace-nowrap"
                                    >
                                        <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        <span>Add Requirements</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={async (e) => { e.stopPropagation(); setOpenMenuOfficeId(null); setOpenMenuAnchorRect(null); await handleExportOffice(menuOffice); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
                                    >
                                        <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4 4 4" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21H3" />
                                        </svg>
                                        <span>Export Excel</span>
                                    </button>
                                    {isAcademicOffice(menuOffice) && (
                                        <div className="border-t border-slate-100 my-1 pt-1.5 px-2.5">
                                            <label className="text-[10px] font-semibold text-slate-400 block mb-1">
                                                Accreditation Level
                                            </label>
                                            <select
                                                value={menuOffice.accreditationlevel || 'Candidate'}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    setOpenMenuOfficeId(null);
                                                    setOpenMenuAnchorRect(null);
                                                    await handleUpdateProgramLevel(menuOffice.id, val);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                className="w-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                                            >
                                                {ACCREDITATION_LEVELS.map((lvl) => (
                                                    <option key={lvl} value={lvl}>{lvl}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={async (e) => { e.stopPropagation(); setOpenMenuOfficeId(null); setOpenMenuAnchorRect(null); await onDeleteOffice?.(menuOffice); }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap"
                                    >
                                        <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                        </svg>
                                        <span>Delete {isAcademicOffice(menuOffice) ? 'Program' : 'Office'}</span>
                                    </button>
                                </div>
                            </div>,
                            document.body
                        );
                    } catch (e) {
                        console.error('Failed to render portal menu', e);
                        return null;
                    }
                })()}
            </div>
        );
    }
);

export default OfficesP;
