import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import CustomDropdown from "../components/UI/CustomDropdown";
import { useModal } from "../components/UI/ModalProvider";
import { useToast } from "../components/UI/Toast";
import UsersP from "../components/UsersProfile/UsersProfle";
import UserEditApproval from "../components/usereditapproval/usereditapproval";

const APPROVAL_FILTER_OPTIONS = [
    { value: "all", label: "All Personnel" },
    { value: "approved", label: "Approved" },
    { value: "pending", label: "Pending" },
    { value: "denied", label: "Denied" },
];

const ROLE_FILTER_OPTIONS = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "user", label: "User" },
    { value: "office head", label: "Office Head" },
    { value: "personnel", label: "Personnel" },
];

export default function Users() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOptions, setFilterOptions] = useState({
        approvalstatus: [],
        roles: []
    });
    const [approvalFilter, setApprovalFilter] = useState('all');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const usersRef = useRef();
    const filterDropdownRef = useRef(null);
    const roleDropdownRef = useRef(null);
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const { showConfirm } = useModal();
    const { toast } = useToast();

    const handleSelectionChange = useCallback((count, ids) => {
        setSelectedCount(count);
        setSelectedIds(ids || []);
    }, []);

    const handleDeleteSelected = async () => {
        if (!usersRef.current || selectedIds.length === 0) return;
        const count = selectedIds.length;
        const confirmed = await showConfirm(
            `Delete ${count} selected user${count === 1 ? '' : 's'}? This cannot be undone.`,
            'Confirm Deletion'
        );
        if (!confirmed) return;
        try {
            const result = await usersRef.current.deleteSelected(selectedIds);
            if (result && result.success) {
                setSelectedCount(0);
                setSelectedIds([]);
                setDeleteMode(false);
                // Refresh list
                if (usersRef.current && usersRef.current.refresh) usersRef.current.refresh();
                toast({
                    title: 'Users Deleted',
                    description: `Successfully deleted ${count} user${count === 1 ? '' : 's'}.`,
                    variant: 'success',
                    duration: 3000,
                });
            } else {
                toast({
                    title: 'Delete Failed',
                    description: result?.message || 'Failed to delete selected users.',
                    variant: 'error',
                    duration: 4000,
                });
            }
        } catch (err) {
            console.error('Error deleting users:', err);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred while deleting users.',
                variant: 'error',
                duration: 4000,
            });
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                showFilterDropdown &&
                filterDropdownRef.current &&
                !filterDropdownRef.current.contains(event.target)
            ) {
                setShowFilterDropdown(false);
            }

            if (
                showRoleDropdown &&
                roleDropdownRef.current &&
                !roleDropdownRef.current.contains(event.target)
            ) {
                setShowRoleDropdown(false);
            }

        };

        const handleEscapeKey = (event) => {
            if (event.key === 'Escape') {
                setShowFilterDropdown(false);
                setShowRoleDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [showFilterDropdown, showRoleDropdown]);

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, []);

    const applyApprovalFilter = (value) => {
        setApprovalFilter(value);
        setFilterOptions((prev) => ({
            ...prev,
            approvalstatus: value === 'all' ? [] : [value],
        }));
    };

    const applyRoleFilter = (value) => {
        setRoleFilter(value);
        setFilterOptions((prev) => ({
            ...prev,
            roles: value === 'all' ? [] : [value],
        }));
    };

    const handleUserClick = (user) => {
        setSelectedUser(user);
        setShowApprovalModal(true);
    };

    const handleCloseModal = () => {
        setShowApprovalModal(false);
        setSelectedUser(null);
    };

    const handleUpdateSuccess = () => {
        // Refresh users list
        if (usersRef.current && usersRef.current.refresh) {
            usersRef.current.refresh();
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">User Management</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {deleteMode ? 'Select users to batch delete.' : 'Manage registered accounts, roles, access permissions, and approval statuses.'}
                            </p>
                        </div>
                    </div>

                    {/* Top Right Action Buttons */}
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
                    </div>
                </div>

                {/* Search & Filter Toolbar */}
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
                            placeholder="Search users, email, role..."
                            className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
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
                            value={approvalFilter}
                            onChange={applyApprovalFilter}
                            options={APPROVAL_FILTER_OPTIONS}
                            minWidth="min-w-[145px]"
                            size="sm"
                        />

                        <CustomDropdown
                            value={roleFilter}
                            onChange={applyRoleFilter}
                            options={ROLE_FILTER_OPTIONS}
                            minWidth="min-w-[140px]"
                            size="sm"
                        />
                    </div>
                </div>
            </div>

            {/* List view container */}
            <div className="flex-1 min-h-0 px-4 sm:px-6 pt-3 pb-8 flex flex-col overflow-hidden">
                <div className="overflow-x-auto flex-1 min-h-0 flex flex-col">
                    <div className="relative z-10 flex-1 min-h-0 overflow-y-auto pr-1 pb-24 min-w-[720px] flex flex-col">
                        <UsersP 
                            ref={usersRef}
                            searchTerm={searchTerm}
                            filterOptions={filterOptions}
                            onUserClick={handleUserClick}
                            deleteMode={deleteMode}
                            onSelectionChange={handleSelectionChange}
                            viewMode="list"
                        />
                    </div>
                </div>
            </div>

            {/* Approval Status Modal Component */}
            {showApprovalModal && selectedUser && (
                <UserEditApproval 
                    selectedUser={selectedUser}
                    onClose={handleCloseModal}
                    onSuccess={handleUpdateSuccess}
                />
            )}
        </div>
    );
}
