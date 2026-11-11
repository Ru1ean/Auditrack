import React, { useState, useEffect } from 'react';
import { requirementsAPI } from '../../utils/api';
import { useModal } from "../UI/ModalProvider";
import { API_BASE_URL } from '../../utils/apiBase';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function AssignUserModal({ isOpen, onClose, requirement, officeid, onSuccess, currentUserId, isAdmin = false }) {
    const [availableUsers, setAvailableUsers] = useState([]);
    const [assignedUsers, setAssignedUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('assign'); // 'assign' or 'assigned'
    const { showAlert, showConfirm } = useModal();

    // Fetch available users and assigned users when modal opens
    useEffect(() => {
        if (isOpen && requirement) {
            fetchData();
            setSelectedUserIds([]);
            setSearchTerm('');
            setError('');
        }
    }, [isOpen, requirement]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch available users and assigned users in parallel
            const [availableRes, assignedRes] = await Promise.all([
                requirementsAPI.getAvailableUsersForAssignment(requirement.requirementid, officeid),
                requirementsAPI.getAssignedUsers(requirement.requirementid, officeid)
            ]);

            setAvailableUsers(availableRes.data || []);
            setAssignedUsers(assignedRes.data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError('Failed to load users. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Toggle user selection
    const toggleUserSelection = (userid) => {
        setSelectedUserIds(prev => {
            if (prev.includes(userid)) {
                return prev.filter(id => id !== userid);
            } else {
                // Check if we can add more (max 4 total assigned)
                const totalAfterAdd = assignedUsers.length + prev.length + 1;
                if (totalAfterAdd > 4) {
                    setError('Maximum 4 users can be assigned to a requirement');
                    return prev;
                }
                return [...prev, userid];
            }
        });
        setError('');
    };

    // Filter users by search term
    const filteredUsers = availableUsers.filter(user => {
        if (user.isAssigned) return false; // Hide already assigned users
        const fullName = `${user.firstname} ${user.middleinitial ? user.middleinitial + '.' : ''} ${user.lastname}`.toLowerCase();
        const email = (user.Email || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
    });

    // Calculate remaining slots
    const remainingSlots = 4 - assignedUsers.length;
    const canSelectMore = remainingSlots - selectedUserIds.length > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedUserIds.length === 0) {
            setError('Please select at least one user');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await requirementsAPI.assignUsersToRequirement(
                requirement.requirementid,
                officeid,
                selectedUserIds,
                currentUserId
            );
            
            if (response.success) {
                await showAlert(`Successfully assigned ${selectedUserIds.length} user(s)!`);
                if (onSuccess) {
                    onSuccess();
                }
                // Refresh data
                await fetchData();
                setSelectedUserIds([]);
                setActiveTab('assigned');
            } else {
                setError(response.message || 'Failed to assign users');
            }
        } catch (err) {
            console.error('Error assigning users:', err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveAssignment = async (assignmentid) => {
        const ok = await showConfirm('Are you sure you want to remove this user assignment?');
        if (!ok) return;

        try {
            const response = await requirementsAPI.removeUserAssignment(assignmentid);
            if (response.success) {
                await fetchData();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error removing assignment:', err);
            setError('Failed to remove assignment');
        }
    };

    const handleToggleUploadStatus = async (assignmentid, currentStatus) => {
        try {
            const response = await requirementsAPI.updateUserUploadStatus(assignmentid, !currentStatus);
            if (response.success) {
                await fetchData();
                if (onSuccess) onSuccess();
            }
        } catch (err) {
            console.error('Error updating upload status:', err);
            setError('Failed to update upload status');
        }
    };

    if (!isOpen || !requirement) return null;

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-black bg-opacity-50 flex items-center justify-center z-[50]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-t-lg">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold truncate">Assign Users</h2>
                        <p className="text-sm text-indigo-100 truncate" title={requirement.requirementcode}>
                            {requirement.requirementcode}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="ml-2 text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('assign')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'assign'
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Assign Users ({remainingSlots} slots left)
                    </button>
                    <button
                        onClick={() => setActiveTab('assigned')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                            activeTab === 'assigned'
                                ? 'text-indigo-600 border-b-2 border-indigo-600'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Assigned ({assignedUsers.length}/4)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'assign' ? (
                        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                            {/* Search */}
                            <div className="p-3 border-b bg-gray-50">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search users..."
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                                    />
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Select up to {remainingSlots} user(s) for this requirement.
                                </p>
                            </div>

                            {/* User List */}
                            <div className="flex-1 overflow-y-auto p-3">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : remainingSlots <= 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <svg className="mx-auto h-10 w-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <p className="mt-2 font-medium">Maximum users assigned</p>
                                        <p className="text-sm">This requirement already has 4 users assigned</p>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <p className="mt-2">No available users found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {filteredUsers.map(user => {
                                            const isSelected = selectedUserIds.includes(user.userid);
                                            const fullName = `${user.firstname} ${user.middleinitial ? user.middleinitial + '.' : ''} ${user.lastname}`;
                                            const isDisabled = !isSelected && !canSelectMore;
                                            
                                            return (
                                                <label
                                                    key={user.userid}
                                                    className={`flex items-center p-2.5 rounded-lg border cursor-pointer transition-all ${
                                                        isSelected 
                                                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' 
                                                            : isDisabled
                                                            ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                                                            : 'bg-white border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => !isDisabled && toggleUserSelection(user.userid)}
                                                        disabled={isDisabled}
                                                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-brand-500"
                                                    />
                                                    <div className="ml-2.5 flex items-center flex-1">
                                                        <div className="flex-shrink-0">
                                                            <SmartUserAvatar
                                                                user={user}
                                                                fullName={fullName}
                                                                size="w-8 h-8"
                                                                textSize="text-xs font-bold"
                                                                ring="border border-gray-200"
                                                            />
                                                        </div>
                                                        <div className="ml-2.5 flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                                                            <p className="text-xs text-gray-500 truncate">{user.Email}</p>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="px-3 py-2 bg-red-50 border-t border-red-200">
                                    <p className="text-sm text-red-600">{error}</p>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between p-3 border-t bg-gray-50">
                                <div className="text-sm text-gray-600">
                                    {selectedUserIds.length > 0 ? (
                                        <span className="font-medium text-indigo-600">
                                            {selectedUserIds.length} selected
                                        </span>
                                    ) : (
                                        <span>No users selected</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                        className="px-3 py-1.5 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting || selectedUserIds.length === 0}
                                        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        {isSubmitting && (
                                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                                                <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        )}
                                        {isSubmitting ? 'Assigning...' : 'Assign'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    ) : (
                        /* Assigned Users Tab */
                        <div className="flex-1 overflow-y-auto p-3">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : assignedUsers.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <p className="mt-2">No users assigned yet</p>
                                    <p className="text-sm">Switch to "Assign Users" tab to add users</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {assignedUsers.map(user => {
                                        const fullName = `${user.firstname} ${user.middleinitial ? user.middleinitial + '.' : ''} ${user.lastname}`;
                                        const hasuploaded = user.hasuploaded === 1 || user.hasuploaded === true;
                                        
                                        return (
                                            <div
                                                key={user.assignmentid}
                                                className={`flex items-center p-2.5 rounded-lg border bg-white ${hasuploaded ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                                            >
                                                <div className="flex-shrink-0 relative">
                                                    <SmartUserAvatar
                                                        user={user}
                                                        fullName={fullName}
                                                        size="w-8 h-8"
                                                        textSize="text-xs font-bold"
                                                        ring={`border-2 ${hasuploaded ? 'border-green-500' : 'border-gray-300'}`}
                                                    />
                                                    {/* Upload status indicator */}
                                                    {hasuploaded && (
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full flex items-center justify-center">
                                                            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ml-2.5 flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-gray-900 truncate">{fullName}</p>
                                                    <p className="text-xs text-gray-500 truncate">{user.Email}</p>
                                                </div>
                                                {/* Upload Status - Toggle for admin, read-only for users */}
                                                {isAdmin ? (
                                                    <button
                                                        onClick={() => handleToggleUploadStatus(user.assignmentid, hasuploaded)}
                                                        className={`ml-2 px-2 py-1 text-xs font-medium rounded transition-colors ${
                                                            hasuploaded 
                                                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                        title={hasuploaded ? 'Click to mark as not uploaded' : 'Click to mark as uploaded'}
                                                    >
                                                        {hasuploaded ? 'Uploaded' : 'Not Uploaded'}
                                                    </button>
                                                ) : (
                                                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded ${
                                                        hasuploaded 
                                                            ? 'bg-green-100 text-green-700' 
                                                            : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {hasuploaded ? 'Uploaded' : 'Not Uploaded'}
                                                    </span>
                                                )}
                                                {isAdmin && (
                                                    <button
                                                        onClick={() => handleRemoveAssignment(user.assignmentid)}
                                                        className="ml-2 p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                                        title="Remove assignment"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

