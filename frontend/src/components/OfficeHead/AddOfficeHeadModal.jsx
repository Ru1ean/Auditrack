import React, { useState, useEffect } from 'react';
import { X, Loader2, Search, Users } from 'lucide-react';
import { officeHeadsAPI, usersAPI } from '../../utils/api';
import { useModal } from "../UI/ModalProvider";
import { API_BASE_URL } from '../../utils/apiBase';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function AddOfficeHeadModal({ isOpen, onClose, onSuccess }) {
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [position, setPosition] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const { showAlert } = useModal();

    // Fetch available users when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchAvailableUsers();
            setSelectedUserIds([]);
            setPosition('');
            setSearchTerm('');
            setError('');
        }
    }, [isOpen]);

    const fetchAvailableUsers = async () => {
        setIsLoading(true);
        try {
            // Get all users - response format: { success: true, users: [...] }
            const usersResponse = await usersAPI.getAllUsers();
            const allUsers = usersResponse.users || usersResponse.data || usersResponse || [];
            
            // Get existing office heads to exclude them
            const headsResponse = await officeHeadsAPI.getAllHeads();
            const existingHeadUserIds = (headsResponse || []).map(h => h.userid);
            
            // Filter: only users with roleid = 2 (regular users) who are not already heads
            // and are approved
            const filteredUsers = allUsers.filter(user => 
                user.roleid === 2 && 
                !existingHeadUserIds.includes(user.userid) &&
                user.approvalstatus === 'approved'
            );
            
            setAvailableUsers(filteredUsers);
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
                return [...prev, userid];
            }
        });
    };

    // Filter users by search term
    const filteredUsers = availableUsers.filter(user => {
        const fullName = `${user.firstname} ${user.middleinitial ? user.middleinitial + '.' : ''} ${user.lastname}`.toLowerCase();
        const email = (user.Email || '').toLowerCase();
        const search = searchTerm.toLowerCase();
        return fullName.includes(search) || email.includes(search);
    });

    // Select all filtered users
    const selectAll = () => {
        const filteredUserIds = filteredUsers.map(u => u.userid);
        setSelectedUserIds(filteredUserIds);
    };

    // Clear all selections
    const clearAll = () => {
        setSelectedUserIds([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (selectedUserIds.length === 0) {
            setError('Please select at least one user');
            return;
        }
        
        if (!position.trim()) {
            setError('Please enter a position');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const response = await officeHeadsAPI.addMultipleHeads(selectedUserIds, position);
            
                if (response.success) {
                // Show success message
                const addedCount = response.data?.length || selectedUserIds.length;
                await showAlert(`Successfully added ${addedCount} office personnel!`);
                
                // Show any errors that occurred
                if (response.errors && response.errors.length > 0) {
                    const errorMessages = response.errors.map(e => e.error).join('\n');
                    await showAlert(`Some users could not be added:\n${errorMessages}`);
                }
                
                if (onSuccess) {
                    onSuccess(response.data);
                }
                onClose();
            } else {
                setError(response.message || 'Failed to add office personnel');
            }
        } catch (err) {
            console.error('Error adding office heads:', err);
            setError(err.response?.data?.message || err.message || 'An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50] p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Add Office Personnel</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Assign approved users to office leadership roles</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto flex flex-col min-h-0 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Position / Title for selected users *
                        </label>
                        <input
                            type="text"
                            value={position}
                            onChange={(e) => setPosition(e.target.value)}
                            placeholder="e.g., Department Head, Program Chair, Director"
                            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            disabled={isSubmitting}
                            required
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search users by name, email, or department..."
                                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <button
                            type="button"
                            onClick={selectAll}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-blue-600 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                        >
                            Select All
                        </button>
                        <button
                            type="button"
                            onClick={clearAll}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                        >
                            Clear
                        </button>
                    </div>

                    <div className="flex-1 min-h-[220px] max-h-[360px] overflow-y-auto pr-1">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 gap-2 text-xs text-slate-500 font-semibold">
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span>Loading users...</span>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">
                                <Users className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                <p className="text-xs font-semibold text-slate-700">No available users found</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">All approved users are either already assigned or are administrators</p>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {filteredUsers.map(user => {
                                    const isSelected = selectedUserIds.includes(user.userid);
                                    const fullName = `${user.firstname} ${user.middleinitial ? user.middleinitial + '.' : ''} ${user.lastname}`;
                                    
                                    return (
                                        <label
                                            key={user.userid}
                                            className={`flex items-center p-2.5 rounded-xl border cursor-pointer transition-all ${
                                                isSelected 
                                                    ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300' 
                                                    : 'bg-white border-slate-200 hover:bg-slate-50/80'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleUserSelection(user.userid)}
                                                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div className="ml-3 flex items-center flex-1 min-w-0">
                                                <div className="shrink-0">
                                                    <SmartUserAvatar
                                                        user={user}
                                                        fullName={fullName}
                                                        size="w-8 h-8"
                                                        textSize="text-xs font-bold"
                                                        ring="border border-slate-200"
                                                    />
                                                </div>
                                                <div className="ml-2.5 flex-1 min-w-0">
                                                    <div className="text-xs font-bold text-slate-800 truncate">{fullName}</div>
                                                    <div className="text-[11px] text-slate-400 truncate">{user.Email}</div>
                                                </div>
                                                {user.Department && (
                                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                                        {user.Department}
                                                    </span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                        <div className="text-xs text-slate-600 font-medium">
                            {selectedUserIds.length > 0 ? (
                                <span className="font-bold text-blue-600">
                                    {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
                                </span>
                            ) : (
                                <span>No users selected</span>
                            )}
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting || selectedUserIds.length === 0}
                                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {isSubmitting && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                )}
                                {isSubmitting ? 'Adding...' : `Add ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Personnel`}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
