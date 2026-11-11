import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { createPortal } from 'react-dom';
import user from "../../assets/images/user.svg";
import { usersAPI } from "../../utils/api";
import { useModal } from "../UI/ModalProvider";
import { useToast } from "../UI/Toast";
import Pagination from "../Pagination/Pagination";
import { API_BASE_URL } from '../../utils/apiBase';
import { CardListSkeleton } from "../UI/Skeleton";
import { useLiveRefresh } from "../../utils/liveSync";
import ServerOfflineState from "../UI/ServerOfflineState";
import SmartUserAvatar from "../UI/SmartUserAvatar";

const UsersP = forwardRef(({ searchTerm = '', filterOptions = {}, deleteMode = false, onSelectionChange, onUserClick, viewMode = 'list' }, ref) => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [currentUserID, setCurrentUserID] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const isAdmin = currentUser?.rolename === 'admin' || currentUser?.roleid === 1;
    const [actionMenuUserId, setActionMenuUserId] = useState(null);
    const [actionMenuAnchorRect, setActionMenuAnchorRect] = useState(null);
    const { showConfirm } = useModal();
    const { toast } = useToast();

    const normalizeRoleKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const getRoleLabel = (person) => person.rolename || (person.roleid === 1 ? 'Admin' : 'User');
    const getRoleBadgeClass = (person) => {
        if (person.roleid === 1) return 'bg-blue-100 text-blue-800 border-blue-200';
        if (person.roleid === 2) return 'bg-sky-100 text-sky-800 border-sky-200';
        if (person.roleid === 3) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };
    const getApprovalLabel = (person) => {
        const status = String(person.approvalstatus || 'pending');
        return status.charAt(0).toUpperCase() + status.slice(1);
    };
    const getApprovalBadgeClass = (person) => {
        const status = String(person.approvalstatus || 'pending').toLowerCase();
        if (status === 'approved') return 'bg-green-100 text-green-800 border-green-200';
        if (status === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        if (status === 'denied') return 'bg-red-100 text-red-800 border-red-200';
        return 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const itemsPerPage = 30; // limit to 30 per page for users pagination

    // Fetch current user ID from token
    useEffect(() => {
        {
            const fetchCurrentUser = async () => {
                {
                    try {
                        {
                            const response = await usersAPI.getLoggedInUser();
                            if (response && response.success && response.user) {
                                {
                                    setCurrentUserID(response.user.userid);
                                    setCurrentUser(response.user);
                                }
                            }
                        }
                    } catch (error) {
                        {
                            console.error('Error fetching current user:', error);
                        }
                    }
                }
            };
            fetchCurrentUser();
        }
    }, []);

    // Close action menu when clicking outside
    useEffect(() => {
        if (!actionMenuUserId) return;
        const closeOnOutside = (event) => {
            const target = event.target;
            if (target.closest && (target.closest('.user-actions-menu') || target.closest('.user-actions-button'))) {
                return;
            }
            setActionMenuUserId(null);
            setActionMenuAnchorRect(null);
        };
        document.addEventListener('mousedown', closeOnOutside);
        return () => document.removeEventListener('mousedown', closeOnOutside);
    }, [actionMenuUserId]);

    // Close action menu on scroll/resize (portal is anchored to a DOM rect)
    useEffect(() => {
        if (!actionMenuUserId) return;

        const closeMenu = () => {
            setActionMenuUserId(null);
            setActionMenuAnchorRect(null);
        };

        window.addEventListener('resize', closeMenu);
        window.addEventListener('scroll', closeMenu, true);
        return () => {
            window.removeEventListener('resize', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [actionMenuUserId]);

    const [isRetrying, setIsRetrying] = useState(false);

    const fetchUsers = useCallback(async (isRetry = false) => {
        try {
            if (isRetry) setIsRetrying(true);
            else setLoading(true);
            setError(null);
            const response = await usersAPI.getAllUsers();

            if (response.success) {
                setUsers(response.users || []);
                setError(null);
            } else {
                setError('Failed to fetch users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]);
            if (!error.response || error.code === 'ERR_NETWORK' || error.message?.toLowerCase().includes('network error') || error.message?.toLowerCase().includes('failed to fetch')) {
                setError('Server Offline');
            } else {
                setError(error.response?.data?.message || 'Failed to load users.');
            }
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    }, []);

    // Fetch users data from database
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Live syncing on mutations / window focus
    useLiveRefresh(fetchUsers);

    // Filter and sort users based on search term and approval status
    useEffect(() => {
        let filtered = users;

        // Apply search filter
        if (searchTerm.trim()) {
            filtered = users.filter(person => {
                const fullName = `${person.firstname}${person.middleinitial ? ' ' + person.middleinitial + '.' : ''} ${person.lastname}`.toLowerCase();
                const email = person.Email?.toLowerCase() || '';
                const role = person.rolename?.toLowerCase() || '';
                const searchLower = searchTerm.toLowerCase();

                return fullName.includes(searchLower) ||
                    email.includes(searchLower) ||
                    role.includes(searchLower);
            });
        }

        // Apply approval status filter
        if (filterOptions.approvalstatus && filterOptions.approvalstatus.length > 0) {
            filtered = filtered.filter(person =>
                filterOptions.approvalstatus.includes(person.approvalstatus || 'pending')
            );
        }

        // Apply role filter
        if (filterOptions.roles && filterOptions.roles.length > 0) {
            filtered = filtered.filter(person => {
                const selectedRoles = filterOptions.roles.map(normalizeRoleKey);
                const userRole = normalizeRoleKey(person.rolename || (person.roleid === 1 ? 'admin' : 'user'));
                return selectedRoles.includes(userRole);
            });
        }

        // Sort by name in ascending order
        const sortedFiltered = [...filtered].sort((a, b) => {
            const nameA = `${a.firstname} ${a.lastname}`.toLowerCase();
            const nameB = `${b.firstname} ${b.lastname}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        setFilteredUsers(sortedFiltered);
    }, [users, searchTerm, filterOptions]);

    // Pagination: reset page when filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterOptions]);

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedUsers = filteredUsers.slice(startIdx, startIdx + itemsPerPage);
    const visibleUsers = paginatedUsers;

    // Handle selection changes and notify parent component
    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(selectedUsers.size, Array.from(selectedUsers));
        }
    }, [selectedUsers, onSelectionChange]);

    // Clear selections when delete mode is turned off
    useEffect(() => {
        if (!deleteMode) {
            setSelectedUsers(new Set());
        }
    }, [deleteMode]);

    const handleCheckboxChange = (userid, isChecked) => {
        setSelectedUsers(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(userid);
            } else {
                newSet.delete(userid);
            }
            return newSet;
        });
    };

    const deleteSelectedUsers = async (userIds) => {
        try {
            if (!Array.isArray(userIds) || userIds.length === 0) {
                return { success: false, message: 'No user IDs provided' };
            }

            const response = await usersAPI.deleteUsers(userIds);
            if (response && response.success) {
                // refresh local list
                await fetchUsers();
                return { success: true, message: response.message };
            }

            return { success: false, message: response?.message || 'Deletion failed' };
        } catch (error) {
            console.error('Error deleting users:', error);
            if (error.response) {
                return { success: false, message: error.response.data?.message || error.response.statusText };
            }
            if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
                return { success: false, message: 'Network error. Please check if the backend server is running.' };
            }
            return { success: false, message: `Error deleting users: ${error.message}` };
        }
    };

    // Function to refresh data (can be called from parent component)
    const refreshData = () => {
        fetchUsers();
    };

    // Expose refresh function to parent
    useImperativeHandle(ref, () => ({
        refresh: refreshData,
        deleteSelected: deleteSelectedUsers
    }));

    if (loading) {
        return (
            <div className="w-full py-4">
                <CardListSkeleton count={6} />
            </div>
        );
    }

    if (error) {
        return (
            <ServerOfflineState
                onRetry={() => fetchUsers(true)}
                isRetrying={isRetrying}
                title={error === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Users'}
                message={error === 'Server Offline' 
                    ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                    : error}
            />
        );
    }

    if (filteredUsers.length === 0) {
        return (
            <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                    {searchTerm.trim() ? 'No Users Found' : 'No Users Registered'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                    {searchTerm.trim()
                        ? `No registered users match your search for "${searchTerm}".`
                        : 'No users have registered or been created in the system yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className="mt-1 w-full flex flex-col">
            {/* Search Results Counter */}
            {searchTerm.trim() && (
                <div className="text-xs text-gray-600 mb-2">
                    Showing {filteredUsers.length} of {users.length} users
                    {filteredUsers.length !== users.length && ` matching "${searchTerm}"`}
                </div>
            )}

            {viewMode === 'list' && (
                <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs font-semibold text-gray-700 sticky top-0 z-30 min-w-[720px] mb-2">
                    <div className="col-span-5 flex items-center">Name</div>
                    <div className="col-span-3 flex items-center">Role</div>
                    <div className="col-span-3 flex items-center">Approval Status</div>
                    <div className="col-span-1 flex items-center justify-end">Actions</div>
                </div>
            )}

            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1.5 pb-20' : 'space-y-2 pt-1 pb-1'}>
                {visibleUsers.map((person) => {
                    // Construct full name
                    const fullName = `${person.firstname || ''}${person.middleinitial ? ' ' + person.middleinitial + '.' : ''} ${person.lastname || ''}`.trim() || 'User';
                    const initials = `${(person.firstname || '').trim().charAt(0)}${(person.lastname || '').trim().charAt(0)}`.toUpperCase() || 'U';
                    const roleLabel = getRoleLabel(person);
                    const approvalLabel = getApprovalLabel(person);
                    const roleBadgeClass = getRoleBadgeClass(person);
                    const approvalBadgeClass = getApprovalBadgeClass(person);

                    // Profile photo logic: use preview if available, else use uploaded filename, else null
                    let profilePicUrl = null;
                    if (person.TempPreview) {
                        profilePicUrl = person.TempPreview;
                    } else if (person.profilepic) {
                        profilePicUrl = `${API_BASE_URL}/uploads/profile-pics/${person.profilepic}`;
                    }
                    if (viewMode === 'list') {
                        return (
                            <div
                                key={person.userid}
                                onClick={() => deleteMode ? handleCheckboxChange(person.userid, !selectedUsers.has(person.userid)) : (onUserClick && onUserClick(person))}
                                className={`relative rounded-xl border border-slate-200 bg-white shadow-2xs ${selectedUsers.has(person.userid) ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20' : ''
                                    } ${currentUserID === person.userid ? 'border-blue-300 bg-blue-50/30' : ''
                                    } ${deleteMode ? 'cursor-pointer hover:border-rose-300' : 'app-card-hover cursor-pointer'}`}
                            >
                                <div className="grid grid-cols-12 items-center gap-3 px-4 py-2.5">
                                    {/* Name & Email */}
                                    <div className="flex items-center gap-3 col-span-5 min-w-0">
                                        {deleteMode && (
                                            <div className="flex-shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.has(person.userid)}
                                                    onChange={(e) => handleCheckboxChange(person.userid, e.target.checked)}
                                                    className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        )}
                                        <SmartUserAvatar
                                            user={person}
                                            src={profilePicUrl}
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
                                                {currentUserID === person.userid && (
                                                    <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.2 rounded shrink-0">
                                                        You
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                                                <span>{person.Email}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Role */}
                                    <div className="col-span-3 flex items-center">
                                        <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-[10px] font-semibold ${roleBadgeClass}`}>
                                            {roleLabel}
                                        </span>
                                    </div>

                                    {/* Status */}
                                    <div className="col-span-3 flex items-center">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${approvalBadgeClass}`}>
                                            {approvalLabel}
                                        </span>
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        {!deleteMode && isAdmin && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setActionMenuUserId((prev) => (prev === person.userid ? null : person.userid));
                                                    setActionMenuAnchorRect((prev) => (actionMenuUserId === person.userid ? null : rect));
                                                }}
                                                className="user-actions-button flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 shadow-2xs"
                                                aria-label="User actions"
                                                title="User actions"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle cx="12" cy="5" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="12" cy="19" r="2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={person.userid}
                            onClick={() => deleteMode ? handleCheckboxChange(person.userid, !selectedUsers.has(person.userid)) : (onUserClick && onUserClick(person))}
                            className={`group relative flex flex-col justify-between rounded-2xl border bg-white shadow-2xs app-card-hover min-h-[200px] ${selectedUsers.has(person.userid)
                                    ? 'border-rose-500 ring-2 ring-rose-400/50 bg-rose-50/15'
                                    : currentUserID === person.userid
                                        ? 'border-blue-300 bg-blue-50/20'
                                        : 'border-slate-200/90'
                                } ${deleteMode ? 'cursor-pointer hover:border-rose-300' : 'cursor-pointer'}`}
                        >
                            <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                                {/* Card Top: Approval Badge & Actions / Checkbox */}
                                <div className="flex items-center justify-between gap-2">
                                    {deleteMode ? (
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.has(person.userid)}
                                            onChange={(e) => handleCheckboxChange(person.userid, e.target.checked)}
                                            className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${approvalBadgeClass}`}>
                                            {approvalLabel}
                                        </span>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass}`}>
                                            {roleLabel}
                                        </span>

                                        {!deleteMode && isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setActionMenuUserId((prev) => (prev === person.userid ? null : person.userid));
                                                    setActionMenuAnchorRect((prev) => (actionMenuUserId === person.userid ? null : rect));
                                                }}
                                                className="user-actions-button flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                                                aria-label="User actions"
                                                title="User actions"
                                            >
                                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle cx="12" cy="5" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="12" cy="19" r="2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Profile Info */}
                                <div className="flex items-center gap-3">
                                    <SmartUserAvatar
                                        user={person}
                                        src={profilePicUrl}
                                        fullName={fullName}
                                        size="h-12 w-12"
                                        textSize="text-sm font-bold"
                                        ring="ring-2 ring-slate-100 shadow-xs"
                                    />

                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-[14px] font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                                            {fullName}
                                        </h3>
                                        {currentUserID === person.userid && (
                                            <span className="inline-block mt-0.5 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                                                (You)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Email Container */}
                                <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 px-2.5 py-1.5 border border-slate-100 text-[11px] text-slate-600 group-hover:bg-slate-100/70 transition-colors">
                                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span className="truncate font-medium">{person.Email}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Portal action menu (prevents clipping inside card/list containers) */}
            {isAdmin && actionMenuUserId && actionMenuAnchorRect && typeof document !== 'undefined' && (() => {
                const menuPerson = users.find((u) => String(u.userid) === String(actionMenuUserId))
                    || filteredUsers.find((u) => String(u.userid) === String(actionMenuUserId));

                if (!menuPerson) return null;

                const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
                const menuWidth = 192;
                const viewportRight = (window.innerWidth / zoom) - 8;
                const desiredLeft = (actionMenuAnchorRect.right / zoom) - menuWidth;
                const left = Math.min(desiredLeft, viewportRight - menuWidth);
                const top = (actionMenuAnchorRect.bottom / zoom) + 4;

                return createPortal(
                    <div
                        className="user-actions-menu"
                        style={{ position: 'fixed', top, left: Math.max(8, left), zIndex: 9999 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuUserId(null);
                                    setActionMenuAnchorRect(null);
                                    if (onUserClick) onUserClick(menuPerson);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
                            >
                                <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit User</span>
                            </button>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setActionMenuUserId(null);
                                    setActionMenuAnchorRect(null);
                                    const userName = `${menuPerson.firstname || ''} ${menuPerson.lastname || ''}`.trim() || 'this user';
                                    const confirmed = await showConfirm(
                                        `Delete user "${userName}"? This cannot be undone.`,
                                        'Confirm Deletion'
                                    );
                                    if (!confirmed) return;
                                    try {
                                        const result = await deleteSelectedUsers([menuPerson.userid]);
                                        if (result?.success) {
                                            fetchUsers();
                                            toast({
                                                title: 'User Deleted',
                                                description: `"${userName}" has been successfully deleted.`,
                                                variant: 'success',
                                                duration: 3000,
                                            });
                                        } else {
                                            setUsers((prev) => prev.filter((u) => u.userid !== menuPerson.userid));
                                            toast({
                                                title: 'Notice',
                                                description: result?.message || `"${userName}" was removed.`,
                                                variant: 'warning',
                                                duration: 3000,
                                            });
                                        }
                                    } catch (err) {
                                        console.error('Error deleting user:', err);
                                        toast({
                                            title: 'Error',
                                            description: `An error occurred while deleting "${userName}".`,
                                            variant: 'error',
                                            duration: 4000,
                                        });
                                    }
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap"
                            >
                                <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                </svg>
                                <span>Delete User</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                );
            })()}
            <div className="pt-1">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    fixed={true}
                    showWhenSinglePage={true}
                />
            </div>
        </div>
    );
});

export default UsersP;
