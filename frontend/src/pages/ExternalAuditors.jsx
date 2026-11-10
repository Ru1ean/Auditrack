import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import Header from "../components/Header/header";
import Pagination from "../components/Pagination/Pagination";
import CustomDropdown from "../components/UI/CustomDropdown";
import { CardListSkeleton } from "../components/UI/Skeleton";
import AssignAreaModal from "../components/ExternalAuditors/AssignAreaModal";
import AuditorDetailsModal from "../components/ExternalAuditors/AuditorDetailsModal";
import { useModal } from "../components/UI/ModalProvider";
import { useToast } from "../components/UI/Toast";
import { usersAPI } from "../utils/api";
import ServerOfflineState from "../components/UI/ServerOfflineState";
import ViewModeToggle from "../components/UI/ViewModeToggle";
import SmartUserAvatar from "../components/UI/SmartUserAvatar";

export default function ExternalAuditors() {
    const [auditors, setAuditors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // 'all', 'assigned', 'unassigned'
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('external_auditors_view_mode') || 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('external_auditors_view_mode', mode);
        } catch {}
    };
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [inviteLink, setInviteLink] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [selectedAuditorForAssign, setSelectedAuditorForAssign] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedAuditorForDetails, setSelectedAuditorForDetails] = useState(null);

    const handleOpenDetails = (auditor) => {
        setSelectedAuditorForDetails(auditor);
        setDetailsModalOpen(true);
    };
    const itemsPerPage = viewMode === 'list' ? 30 : 12;
    const { showConfirm, showAlert } = useModal();
    const { toast } = useToast();
    const menuRef = useRef(null);

    // Keep page chrome fixed; internal content scrolls
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const [serverError, setServerError] = useState(null);
    const [isRetrying, setIsRetrying] = useState(false);

    // Fetch External Auditors (roleid === 4 or position External Auditor)
    const fetchAuditors = async (isRetry = false) => {
        try {
            if (isRetry) setIsRetrying(true);
            else setLoading(true);
            setServerError(null);

            const res = await usersAPI.getAllUsers();
            const rawUsers = res?.users || (Array.isArray(res) ? res : res?.data || []);
            
            // Filter users where role is auditor or position is external auditor
            const auditorUsers = rawUsers.filter(u => {
                const roleid = Number(u.roleid ?? u.roleid ?? 0);
                const rolename = String(u.rolename ?? u.rolename ?? "").toLowerCase();
                const pos = String(u.Position ?? u.position ?? "").toLowerCase();
                return roleid === 4 || rolename.includes("auditor") || pos.includes("external auditor") || pos.includes("auditor");
            }).map(u => ({
                ...u,
                userid: u.userid || u.id || u.userid,
                firstname: u.firstname || u.firstname || "",
                lastname: u.lastname || u.lastname || "",
                Email: u.Email || u.email || "",
                assignedArea: u.assignedArea || u.assignedarea || u.assigned_area || u.AssignedAreas || u.assignedareas || u.areaname || u.areaname || "",
                lastActive: u.lastActive || u.last_active || u.updatedat || u.createdat || "Recent",
                status: u.status || u.Status || "Active",
                avatar: u.avatar || u.ProfileImage || u.profile_image || null
            }));

            setAuditors(auditorUsers);
            setServerError(null);
        } catch (err) {
            console.error("Error loading auditors:", err);
            setAuditors([]);
            if (!err.response || err.code === 'ERR_NETWORK' || err.message?.toLowerCase().includes('network error') || err.message?.toLowerCase().includes('failed to fetch')) {
                setServerError('Server Offline');
            } else {
                setServerError(err.response?.data?.message || 'Failed to load external auditors.');
            }
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    };

    useEffect(() => {
        fetchAuditors();
    }, []);

    // Filter & Search
    const filteredAuditors = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return auditors.filter(person => {
            const fullName = `${person.firstname || ""} ${person.lastname || ""}`.toLowerCase();
            const email = (person.Email || "").toLowerCase();
            const area = (person.assignedArea || "").toLowerCase();
            const matchesSearch = !q || fullName.includes(q) || email.includes(q) || area.includes(q);
            
            let matchesFilter = true;
            if (filterStatus === 'assigned') matchesFilter = !!person.assignedArea;
            if (filterStatus === 'unassigned') matchesFilter = !person.assignedArea;

            return matchesSearch && matchesFilter;
        });
    }, [auditors, searchTerm, filterStatus]);

    // Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredAuditors.length / itemsPerPage));
    const visibleAuditors = useMemo(() => {
        const startIdx = (currentPage - 1) * itemsPerPage;
        return filteredAuditors.slice(startIdx, startIdx + itemsPerPage);
    }, [filteredAuditors, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, viewMode]);

    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedIds(visibleAuditors.map(a => a.userid));
        } else {
            setSelectedIds([]);
        }
    };

    const handleToggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        const count = selectedIds.length;
        const confirmed = await showConfirm(
            `Remove ${count} selected external auditor${count === 1 ? '' : 's'}? This cannot be undone.`,
            'Confirm Removal'
        );
        if (!confirmed) return;

        try {
            const resp = await usersAPI.deleteUsers(selectedIds);
            if (resp && resp.success) {
                setAuditors(prev => prev.filter(a => !selectedIds.includes(a.userid)));
                setSelectedIds([]);
                setDeleteMode(false);
                toast({
                    title: 'Auditors Removed',
                    description: `Successfully removed ${count} external auditor${count === 1 ? '' : 's'}.`,
                    variant: 'success',
                    duration: 3000,
                });
            } else {
                toast({
                    title: 'Removal Failed',
                    description: resp?.message || 'Failed to delete selected external auditors.',
                    variant: 'error',
                    duration: 4000,
                });
            }
        } catch (err) {
            console.error('Error deleting auditors:', err);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred while deleting selected auditors.',
                variant: 'error',
                duration: 4000,
            });
        }
    };

    const handleCreateInvite = async () => {
        setInviteLoading(true);
        setInviteLink("");
        setInviteCopied(false);

        try {
            const response = await usersAPI.createRegistrationInvite({ roleid: 4, allowAnyEmail: true });
            if (!response.success || !response.inviteUrl) {
                throw new Error(response.message || "Failed to generate invite link");
            }
            setInviteLink(response.inviteUrl);
            setInviteModalOpen(true);
        } catch (error) {
            console.error("Error creating auditor invite link:", error);
            await showAlert(error.response?.data?.message || error.message || "Failed to generate invite link");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCopyInvite = async () => {
        if (!inviteLink) return;

        try {
            await navigator.clipboard.writeText(inviteLink);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2500);
        } catch (error) {
            const textArea = document.createElement("textarea");
            textArea.value = inviteLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2500);
        }
    };

    const totalCount = auditors.length;
    const assignedCount = useMemo(() => auditors.filter(a => !!a.assignedArea).length, [auditors]);
    const unassignedCount = totalCount - assignedCount;

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">External Auditors</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {deleteMode ? 'Select auditors to batch remove.' : 'Manage quality assurance evaluators, scope assignments, and evaluation access.'}
                            </p>
                        </div>
                    </div>

                    {/* Top Right Actions */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        {deleteMode && (
                            <button
                                type="button"
                                onClick={handleDeleteSelected}
                                disabled={selectedIds.length === 0}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all ${
                                    selectedIds.length === 0
                                        ? 'border-red-200 bg-red-50/50 text-red-400 cursor-not-allowed'
                                        : 'border-red-600 bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-500/20 cursor-pointer'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete Selected ({selectedIds.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                if (deleteMode) {
                                    setDeleteMode(false);
                                    setSelectedIds([]);
                                    return;
                                }
                                setDeleteMode(true);
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
                            onClick={handleCreateInvite}
                            disabled={inviteLoading}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                                inviteLoading
                                    ? "cursor-not-allowed border-sky-200 bg-sky-100/50 text-sky-400"
                                    : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-300 active:scale-95"
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {inviteLoading ? "Generating..." : "Invite Auditor"}
                        </button>
                    </div>
                </div>

                {/* Search, Filter Tabs & View Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    {/* Search Input */}
                    <div className="relative w-full sm:w-72 md:w-80">
                        <svg
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search auditors, areas, email..."
                            className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer flex items-center justify-center"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter Status + View Mode Toggle */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        <CustomDropdown
                            value={filterStatus}
                            onChange={setFilterStatus}
                            options={[
                                { value: 'all', label: `All Auditors (${totalCount})` },
                                { value: 'assigned', label: `Assigned (${assignedCount})` },
                                { value: 'unassigned', label: `Unassigned (${unassignedCount})` },
                            ]}
                            minWidth="min-w-[160px]"
                            size="sm"
                        />

                        {/* View Mode Toggle */}
                        <ViewModeToggle viewMode={viewMode} onChange={handleSetViewMode} />
                    </div>
                </div>
            </div>

            <div className={`flex-1 overflow-hidden px-4 sm:px-6 pt-3 ${viewMode === 'list' ? 'pb-3' : 'pb-8'} flex flex-col min-h-0`}>
                {/* Main Content Area */}
                <div className={`flex-1 min-h-0 ${viewMode === 'list' && !serverError && visibleAuditors.length > 0 ? 'app-list-scroll overflow-x-auto pr-1' : 'flex flex-col h-full overflow-hidden'}`}>
                    {loading ? (
                        <div className="w-full">
                            <CardListSkeleton count={6} />
                        </div>
                    ) : serverError ? (
                        <ServerOfflineState
                            onRetry={() => fetchAuditors(true)}
                            isRetrying={isRetrying}
                            title={serverError === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Auditors'}
                            message={serverError === 'Server Offline' 
                                ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                                : serverError}
                        />
                    ) : visibleAuditors.length === 0 ? (
                        <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
                            <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                </svg>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 mb-1">
                                {searchTerm.trim() || filterStatus !== 'all' ? 'No Auditors Found' : 'No External Auditors Registered'}
                            </h3>
                            <p className="text-xs text-slate-500 max-w-sm mb-4">
                                {searchTerm.trim() || filterStatus !== 'all'
                                    ? 'No external auditors match your search query or filter.'
                                    : 'Invite external auditors to evaluate assigned standards and sub areas.'}
                            </p>
                            {searchTerm.trim() || filterStatus !== 'all' ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('all');
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                                >
                                    Clear Filters
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleCreateInvite}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                                >
                                    <span>+ Invite External Auditor</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {viewMode === 'list' && (
                                <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs font-semibold text-gray-700 sticky top-0 z-30 min-w-[720px] mb-2">
                                    <div className="col-span-4 flex items-center gap-2">
                                        {deleteMode && (
                                            <input
                                                type="checkbox"
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                checked={selectedIds.length === visibleAuditors.length && visibleAuditors.length > 0}
                                                className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                                            />
                                        )}
                                        <span>Auditor Name</span>
                                    </div>
                                    <div className="col-span-2 flex items-center">Role</div>
                                    <div className="col-span-3 flex items-center">Assigned Area</div>
                                    <div className="col-span-2 flex items-center">Status</div>
                                    <div className="col-span-1 flex items-center justify-end">Actions</div>
                                </div>
                            )}

                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5 lg:gap-3 flex-1 min-h-0 h-full p-1 overflow-hidden' : 'space-y-2 pt-1 pb-14 min-w-[720px]'}>
                                {visibleAuditors.map((auditor) => {
                                    const isAssigned = !!auditor.assignedArea;
                                    const isSelected = selectedIds.includes(auditor.userid);
                                    const fullName = `${auditor.firstname || ''} ${auditor.lastname || ''}`.trim() || 'Auditor';

                                    if (viewMode === 'list') {
                                        return (
                                            <div
                                                key={auditor.userid}
                                                onClick={() => {
                                                    if (deleteMode) handleToggleSelect(auditor.userid);
                                                    else handleOpenDetails(auditor);
                                                }}
                                                className={`relative rounded-xl border border-slate-200 bg-white shadow-2xs ${
                                                    isSelected ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20' : ''
                                                } ${deleteMode ? 'cursor-pointer hover:border-rose-300' : 'app-card-hover cursor-pointer'}`}
                                            >
                                                <div className="grid grid-cols-12 items-center gap-3 px-4 py-2.5">
                                                    {/* Auditor Name & Email (col-span-4) */}
                                                    <div className="flex items-center gap-3 col-span-4 min-w-0">
                                                        {deleteMode && (
                                                            <div className="shrink-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => handleToggleSelect(auditor.userid)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                                />
                                                            </div>
                                                        )}
                                                        <SmartUserAvatar
                                                            user={auditor}
                                                            fullName={fullName}
                                                            size="h-9 w-9"
                                                            textSize="text-xs font-bold"
                                                            ring="ring-2 ring-slate-100"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-slate-800 truncate">
                                                                    {fullName}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                                <span>{auditor.Email || 'No email provided'}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Role (col-span-2) */}
                                                    <div className="col-span-2 flex items-center">
                                                        <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold bg-sky-50 text-sky-700 border-sky-200/60">
                                                            External Auditor
                                                        </span>
                                                    </div>

                                                    {/* Assigned Area (col-span-3) */}
                                                    <div className="col-span-3 flex items-center min-w-0">
                                                        {auditor.assignedArea ? (
                                                            <span 
                                                                className="inline-flex items-center gap-1 max-w-full rounded-md bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-[10px] font-semibold text-blue-700 truncate"
                                                                title={auditor.assignedArea}
                                                            >
                                                                <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                </svg>
                                                                <span className="truncate">{auditor.assignedArea}</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 italic">None</span>
                                                        )}
                                                    </div>

                                                    {/* Status (col-span-2) */}
                                                    <div className="col-span-2 flex items-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${
                                                            isAssigned ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${isAssigned ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                            {isAssigned ? 'Assigned' : 'Unassigned'}
                                                        </span>
                                                    </div>

                                                    {/* Actions (col-span-1) */}
                                                    <div className="col-span-1 flex items-center justify-end">
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMenuId(openMenuId === auditor.userid ? null : auditor.userid);
                                                                }}
                                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 shadow-2xs"
                                                                title="Actions"
                                                            >
                                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                                    <circle cx="12" cy="5" r="2" />
                                                                    <circle cx="12" cy="12" r="2" />
                                                                    <circle cx="12" cy="19" r="2" />
                                                                </svg>
                                                            </button>

                                                            {openMenuId === auditor.userid && (
                                                                <div 
                                                                    ref={menuRef}
                                                                    className="absolute right-0 top-8 z-40 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenuId(null);
                                                                            setSelectedAuditorForAssign(auditor);
                                                                            setAssignModalOpen(true);
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                        </svg>
                                                                        <span>Assign Area(s)</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenuId(null);
                                                                            handleOpenDetails(auditor);
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        <span>View Details</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenuId(null);
                                                                            const auditorName = `${auditor.firstname || ''} ${auditor.lastname || ''}`.trim() || 'this auditor';
                                                                            const confirmed = await showConfirm(
                                                                                `Remove external auditor "${auditorName}"? This cannot be undone.`,
                                                                                'Confirm Removal'
                                                                            );
                                                                            if (confirmed) {
                                                                                try {
                                                                                    const resp = await usersAPI.deleteUsers([auditor.userid]);
                                                                                    if (resp?.success) {
                                                                                        fetchAuditors();
                                                                                        toast({
                                                                                            title: 'Auditor Removed',
                                                                                            description: `"${auditorName}" has been successfully removed.`,
                                                                                            variant: 'success',
                                                                                            duration: 3000,
                                                                                        });
                                                                                    } else {
                                                                                        toast({
                                                                                            title: 'Removal Failed',
                                                                                            description: resp?.message || 'Failed to remove auditor.',
                                                                                            variant: 'error',
                                                                                            duration: 4000,
                                                                                        });
                                                                                    }
                                                                                } catch (err) {
                                                                                    console.error('Delete error', err);
                                                                                    toast({
                                                                                        title: 'Error',
                                                                                        description: 'An unexpected error occurred while deleting auditor.',
                                                                                        variant: 'error',
                                                                                        duration: 4000,
                                                                                    });
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                                                        </svg>
                                                                        <span>Delete Auditor</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={auditor.userid}
                                            className={`group relative flex flex-col justify-between rounded-2xl bg-white shadow-2xs h-full min-h-0 transition-all duration-200 ${
                                                isSelected 
                                                    ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm' 
                                                    : deleteMode
                                                        ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                                                        : 'border border-slate-200/90 app-card-hover'
                                            }`}
                                        >
                                            <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-1.5 min-h-0 overflow-hidden">
                                                {/* Card Top Header: Status Badge & Option Menu */}
                                                <div className="flex items-center justify-between gap-2 shrink-0 mb-1 sm:mb-1.5">
                                                    {deleteMode ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleSelect(auditor.userid)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                        />
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide border ${
                                                            isAssigned 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' 
                                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                            <span className={`h-1.5 w-1.5 rounded-full ${
                                                                isAssigned ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                                            }`} />
                                                            {isAssigned ? 'Assigned' : 'Unassigned'}
                                                        </span>
                                                    )}

                                                    {!deleteMode && (
                                                        <div className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMenuId(openMenuId === auditor.userid ? null : auditor.userid);
                                                                }}
                                                                className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                                                                title="Options"
                                                            >
                                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                                    <circle cx="12" cy="5" r="2" />
                                                                    <circle cx="12" cy="12" r="2" />
                                                                    <circle cx="12" cy="19" r="2" />
                                                                </svg>
                                                            </button>

                                                            {openMenuId === auditor.userid && (
                                                                <div 
                                                                    ref={menuRef}
                                                                    className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenMenuId(null);
                                                                            setSelectedAuditorForAssign(auditor);
                                                                            setAssignModalOpen(true);
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                        </svg>
                                                                        <span>Assign Area(s)</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setOpenMenuId(null);
                                                                            handleOpenDetails(auditor);
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                        </svg>
                                                                        <span>View Details</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            setOpenMenuId(null);
                                                                            const auditorName = `${auditor.firstname || ''} ${auditor.lastname || ''}`.trim() || 'this auditor';
                                                                            const confirmed = await showConfirm(
                                                                                `Remove external auditor "${auditorName}"? This cannot be undone.`,
                                                                                'Confirm Removal'
                                                                            );
                                                                            if (confirmed) {
                                                                                try {
                                                                                    const resp = await usersAPI.deleteUsers([auditor.userid]);
                                                                                    if (resp?.success) {
                                                                                        fetchAuditors();
                                                                                        toast({
                                                                                            title: 'Auditor Removed',
                                                                                            description: `"${auditorName}" has been successfully removed.`,
                                                                                            variant: 'success',
                                                                                            duration: 3000,
                                                                                        });
                                                                                    } else {
                                                                                        toast({
                                                                                            title: 'Removal Failed',
                                                                                            description: resp?.message || 'Failed to remove auditor.',
                                                                                            variant: 'error',
                                                                                            duration: 4000,
                                                                                        });
                                                                                    }
                                                                                } catch (err) {
                                                                                    console.error('Delete error', err);
                                                                                    toast({
                                                                                        title: 'Error',
                                                                                        description: 'An unexpected error occurred while deleting auditor.',
                                                                                        variant: 'error',
                                                                                        duration: 4000,
                                                                                    });
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                                                                    >
                                                                        <svg className="h-3.5 w-3.5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                                                        </svg>
                                                                        <span>Delete Auditor</span>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Profile Main Info */}
                                                <div 
                                                    onClick={() => {
                                                        if (deleteMode) handleToggleSelect(auditor.userid);
                                                        else handleOpenDetails(auditor);
                                                    }}
                                                    className="cursor-pointer group/content min-h-0 flex-1 flex flex-col justify-center my-0.5"
                                                    title="Click to view full details"
                                                >
                                                    <div className="flex items-center gap-2 sm:gap-2.5">
                                                        {/* Avatar */}
                                                        <SmartUserAvatar
                                                            user={auditor}
                                                            fullName={fullName}
                                                            size="h-8 w-8 sm:h-9 sm:w-9"
                                                            textSize="text-[11px] sm:text-xs font-bold"
                                                            ring="ring-2 ring-slate-100 shadow-xs"
                                                        />

                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 truncate group-hover/content:text-blue-600 transition-colors leading-tight">
                                                                {fullName}
                                                            </h3>
                                                            <div className="mt-0.5">
                                                                <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-sky-700 border border-sky-200/60 uppercase">
                                                                    External Auditor
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Email Strip */}
                                                    <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 rounded-lg bg-slate-50/80 px-2 py-0.5 border border-slate-100 text-[9px] sm:text-[10px] text-slate-600 group-hover/content:bg-slate-100/70 transition-colors shrink-0">
                                                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                        <span className="truncate font-medium">{auditor.Email || 'No email provided'}</span>
                                                    </div>
                                                </div>

                                                {/* Assigned Scope / Quick Action Footer */}
                                                <div className="mt-0.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1.5 shrink-0">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                                            Assigned Scope
                                                        </div>
                                                        {auditor.assignedArea ? (
                                                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-800 truncate" title={auditor.assignedArea}>
                                                                <svg className="w-3 h-3 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                                </svg>
                                                                <span className="truncate">{auditor.assignedArea}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] sm:text-[11px] text-slate-400 italic">No areas assigned</span>
                                                        )}
                                                    </div>

                                                    {!deleteMode && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAuditorForAssign(auditor);
                                                                setAssignModalOpen(true);
                                                            }}
                                                            className={`shrink-0 rounded-lg px-2 py-0.5 text-[9px] sm:text-[10px] font-bold transition flex items-center gap-1 ${
                                                                auditor.assignedArea
                                                                    ? 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-600 border border-slate-200/60'
                                                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200/80 shadow-2xs'
                                                            }`}
                                                        >
                                                            {auditor.assignedArea ? 'Change' : '+ Assign'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Application Standard Fixed Bottom Pagination Bar (Grid & List mode) */}
            {!loading && filteredAuditors.length > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    fixed={true}
                    showWhenSinglePage={true}
                />
            )}

            {/* Auditor Details & Assigned Areas Modal (Matching User Screenshot 100%) */}
            <AuditorDetailsModal
                isOpen={detailsModalOpen}
                auditor={selectedAuditorForDetails}
                onClose={() => setDetailsModalOpen(false)}
                onAssignClick={(aud) => {
                    setSelectedAuditorForAssign(aud);
                    setAssignModalOpen(true);
                }}
            />

            {/* Assign Area Modal */}
            <AssignAreaModal
                show={assignModalOpen}
                auditor={selectedAuditorForAssign}
                onClose={() => setAssignModalOpen(false)}
                onSaveSuccess={fetchAuditors}
            />

            {/* Invite Link Modal */}
            {inviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs px-4">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">External Auditor Registration Invite</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Active for 10 minutes. Distribute this link to external quality auditors.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInviteModalOpen(false)}
                                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3.5">
                            {/* External Auditor Invite */}
                            <div className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-4 transition hover:border-sky-300">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-sky-950">Auditor Registration Link</span>
                                        <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800 border border-sky-200">
                                            Any Valid Email
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-600 mb-2.5">
                                    Allows prospective external auditors to register with either an institutional account or personal email.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={inviteLink}
                                        className="h-9 min-w-0 flex-1 rounded-lg border border-sky-200 bg-white px-3 text-xs text-slate-700 shadow-2xs select-all font-mono"
                                        onFocus={(event) => event.target.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleCopyInvite}
                                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                            inviteCopied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-sky-600 hover:bg-sky-700 active:scale-95 text-white'
                                        }`}
                                    >
                                        {inviteCopied ? (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Copied
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                                Copy Link
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setInviteModalOpen(false)}
                                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95 cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
