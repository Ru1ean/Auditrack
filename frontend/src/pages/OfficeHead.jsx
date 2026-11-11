import React, { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import OfficeHeadP from "../components/OfficeHeadP/OfficeHeadP";
import AddOfficeHeadModal from "../components/OfficeHead/AddOfficeHeadModal";
import Sortoffice from "../components/OfficeHead/sorthead";
import { usersAPI } from "../utils/api";
import { useModal } from "../components/UI/ModalProvider";
import ViewModeToggle from "../components/UI/ViewModeToggle";

export default function OfficeHead() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortType, setSortType] = useState('name');
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [institutionalInviteLink, setInstitutionalInviteLink] = useState("");
    const [standardInviteLink, setStandardInviteLink] = useState("");
    const [institutionalCopied, setInstitutionalCopied] = useState(false);
    const [standardCopied, setStandardCopied] = useState(false);
    const [activeInviteTab, setActiveInviteTab] = useState("institutional");
    const [inviteLoading, setInviteLoading] = useState(false);
    const officePRef = useRef();
    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('officehead_view_mode') || 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('officehead_view_mode', mode);
        } catch {}
    };
    const { showAlert, showConfirm } = useModal();

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

    // Reset all states when component unmounts or navigation happens
    useEffect(() => {
        // Clear any blocking states when component mounts
        setDeleteMode(false);
        setSelectedCount(0);
        setSelectedIds([]);
        
        return () => {
            // Cleanup function
            setDeleteMode(false);
            setSelectedCount(0);
            setSelectedIds([]);
            setIsModalOpen(false);
        };
    }, []);

    // Keep page chrome fixed; list scrolling happens inside the content panel.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const handleSuccess = (newOfficeHead) => {
        console.log('New office head added:', newOfficeHead);
        
        // Refresh the OfficeP component to show the new data
        if (officePRef.current && officePRef.current.refresh) {
            officePRef.current.refresh();
        }
    };

    const handleSearchChange = (term) => {
        setSearchTerm(term);
    };

    const handleSortChange = (type) => {
        setSortType(type);
    };

    const handleDeleteModeToggle = (mode) => {
        setDeleteMode(mode);
        if (!mode) {
            setSelectedCount(0);
            setSelectedIds([]);
        }
    };

    // Memoize handleSelectionChange to prevent infinite loops
    const handleSelectionChange = useCallback((count, ids) => {
        setSelectedCount(count);
        setSelectedIds(ids);
    }, []);

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0 || !officePRef.current) return;
        
        // Confirm deletion
        const confirmed = await showConfirm(
            `Are you sure you want to delete ${selectedIds.length} office personnel? This action cannot be undone.`
        );
        if (!confirmed) return;
        
        try {
            const result = await officePRef.current.deleteSelected(selectedIds);
            if (result.success) {
                // Reset selection state
                setSelectedCount(0);
                setSelectedIds([]);
                setDeleteMode(false);
                // Show success message
                console.log('Successfully deleted selected office heads');
                await showAlert(`Successfully deleted ${selectedIds.length} office personnel`);
            } else {
                // Show error message
                console.error('Failed to delete office heads:', result.message);
                await showAlert(result.message || 'Failed to delete office personnel');
            }
        } catch (error) {
            console.error('Error deleting office heads:', error);
            await showAlert('An error occurred while deleting office personnel');
        }
    };

    const handleCreateInvite = async () => {
        setInviteLoading(true);
        setInstitutionalInviteLink("");
        setStandardInviteLink("");
        setInstitutionalCopied(false);
        setStandardCopied(false);

        try {
            const [instRes, stdRes] = await Promise.all([
                usersAPI.createRegistrationInvite({ roleid: 3, allowAnyEmail: false }),
                usersAPI.createRegistrationInvite({ roleid: 3, allowAnyEmail: true })
            ]);

            if (!instRes.success || !instRes.inviteUrl) {
                throw new Error(instRes.message || "Failed to generate institutional invite link");
            }
            if (!stdRes.success || !stdRes.inviteUrl) {
                throw new Error(stdRes.message || "Failed to generate standard invite link");
            }

            setInstitutionalInviteLink(instRes.inviteUrl);
            setStandardInviteLink(stdRes.inviteUrl);
            setInviteModalOpen(true);
        } catch (error) {
            console.error("Error creating invite links:", error);
            await showAlert(error.response?.data?.message || error.message || "Failed to generate invite links");
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCopyInvite = async (link, type) => {
        if (!link) return;

        try {
            await navigator.clipboard.writeText(link);
            if (type === 'institutional') setInstitutionalCopied(true);
            else setStandardCopied(true);
            setTimeout(() => {
                if (type === 'institutional') setInstitutionalCopied(false);
                else setStandardCopied(false);
            }, 2500);
        } catch (error) {
            const textArea = document.createElement("textarea");
            textArea.value = link;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            if (type === 'institutional') setInstitutionalCopied(true);
            else setStandardCopied(true);
            setTimeout(() => {
                if (type === 'institutional') setInstitutionalCopied(false);
                else setStandardCopied(false);
            }, 2500);
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Office Personnel</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {deleteMode ? 'Select personnel to batch delete.' : 'Manage institution personnel, office assignments, and registration links.'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                        {deleteMode && (
                            <button
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
                            onClick={() => setIsModalOpen(true)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Personnel
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateInvite}
                            disabled={inviteLoading}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                                inviteLoading
                                    ? "cursor-not-allowed border-blue-200 bg-blue-100/50 text-blue-400"
                                    : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 active:scale-95"
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {inviteLoading ? "Generating..." : "Invite Link"}
                        </button>
                    </div>
                </div>

                {/* Toolbar: Search, Sort, View Mode Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    <div className="relative w-full sm:w-72 md:w-80">
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
                            placeholder="Search personnel, office, email..."
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
                        <div className="relative inline-block">
                            <Sortoffice value={sortType} onChange={setSortType} />
                        </div>

                        <ViewModeToggle viewMode={viewMode} onChange={handleSetViewMode} />
                    </div>
                </div>
            </div>

            {/* Content Container */}
            <div className={`flex-1 min-h-0 flex flex-col px-4 sm:px-6 pt-3 ${viewMode === 'list' ? 'pb-3' : 'pb-8'} overflow-hidden`}>
                <div className={`relative z-10 flex-1 min-h-0 ${viewMode === 'list' ? 'app-list-scroll overflow-auto pr-1' : 'flex flex-col h-full overflow-hidden'}`}>
                    <div className={`${viewMode === 'list' ? 'flex flex-col gap-0 min-w-[720px] pb-14' : 'flex-1 min-h-0 h-full flex flex-col overflow-hidden'}`}>
                        <OfficeHeadP 
                            ref={officePRef} 
                            searchTerm={searchTerm} 
                            sortType={sortType}
                            deleteMode={deleteMode}
                            viewMode={viewMode}
                            onSelectionChange={handleSelectionChange}
                        />
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isModalOpen && (
                <AddOfficeHeadModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={handleSuccess}
                />
            )}

            {/* Invite Links Modal */}
            {inviteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs px-4">
                    <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-slate-900">Personnel Registration Invites</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Active for 10 minutes. Distribute to incoming department personnel.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setInviteModalOpen(false)}
                                className="h-8 w-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3.5">
                            {/* 1. Institutional Invite (@lccbonline.edu.ph) */}
                            <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 transition hover:border-blue-300">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-blue-900">Institutional School Invite</span>
                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                                            @lccbonline.edu.ph required
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-600 mb-2.5">
                                    Restricts registration exclusively to authenticated institutional school email accounts.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={institutionalInviteLink}
                                        className="h-9 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-xs text-slate-700 shadow-2xs select-all font-mono"
                                        onFocus={(event) => event.target.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopyInvite(institutionalInviteLink, 'institutional')}
                                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 ${
                                            institutionalCopied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 text-white'
                                        }`}
                                    >
                                        {institutionalCopied ? (
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

                            {/* 2. Standard / External Email Invite */}
                            <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4 transition hover:border-amber-300">
                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-amber-950">Standard / External Email Invite</span>
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                                            Any Valid Email
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-600 mb-2.5">
                                    Bypasses school domain requirement. Allows registration with any valid email address.
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={standardInviteLink}
                                        className="h-9 min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 text-xs text-slate-700 shadow-2xs select-all font-mono"
                                        onFocus={(event) => event.target.select()}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopyInvite(standardInviteLink, 'standard')}
                                        className={`h-9 px-3.5 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 shrink-0 ${
                                            standardCopied
                                                ? 'bg-emerald-600 text-white'
                                                : 'bg-amber-600 hover:bg-amber-700 active:scale-95 text-white'
                                        }`}
                                    >
                                        {standardCopied ? (
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
                                className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-95"
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
