import React, { useState } from "react";
import { usersAPI } from "../../utils/api";
import { useToast } from "../UI/Toast";
import CustomSelect from "../UI/CustomSelect";

export default function UserEditApproval({ selectedUser, onClose, onSuccess }) {
    const { toast } = useToast();
    const [newApprovalStatus, setNewApprovalStatus] = useState(selectedUser?.approvalstatus || 'pending');
    const [newRoleID, setNewRoleID] = useState(selectedUser?.roleid || 2);
    const [updating, setUpdating] = useState(false);

    const handleApprovalStatusUpdate = async () => {
        if (!selectedUser) return;
        
        try {
            setUpdating(true);
            
            // Update approval status
            const approvalResponse = await usersAPI.updateApprovalStatus(selectedUser.userid, newApprovalStatus);
            
            // If backend deleted the user (denied), it may return deletedRows; handle that first
            if (approvalResponse.deletedRows && approvalResponse.deletedRows > 0) {
                toast({
                    title: 'User Denied',
                    description: approvalResponse.message || 'User application was denied and removed.',
                    variant: 'info',
                    duration: 3500,
                });
                onClose();
                if (onSuccess) onSuccess();
                return;
            }

            // Update role if it changed
            let roleUpdated = false;
            if (newRoleID !== selectedUser.roleid) {
                const roleResponse = await usersAPI.updateUserRole(selectedUser.userid, newRoleID);
                roleUpdated = roleResponse.success;
            }
            
            if (approvalResponse.success) {
                const statusChanged = newApprovalStatus !== selectedUser.approvalstatus;
                const roleChanged = newRoleID !== selectedUser.roleid;
                
                let message = 'User updated successfully';
                if (statusChanged && roleChanged) {
                    message = `User approval status set to ${newApprovalStatus} and role changed to ${newRoleID === 1 ? 'Admin' : 'User'}`;
                } else if (statusChanged) {
                    message = `User approval status set to ${newApprovalStatus}`;
                } else if (roleChanged) {
                    message = `User role changed to ${newRoleID === 1 ? 'Admin' : 'User'}`;
                }

                toast({
                    title: 'Updated',
                    description: message,
                    variant: 'success',
                    duration: 3000,
                });
                onClose();
                if (onSuccess) {
                    onSuccess();
                }
            } else {
                toast({
                    title: 'Update Failed',
                    description: approvalResponse.message || 'Failed to update user.',
                    variant: 'error',
                    duration: 4000,
                });
            }
        } catch (error) {
            console.error('Error updating user:', error);
            toast({
                title: 'Error',
                description: 'An unexpected error occurred while updating user.',
                variant: 'error',
                duration: 4000,
            });
        } finally {
            setUpdating(false);
        }
    };

    if (!selectedUser) return null;

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out z-[50] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
            <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-800">Update Approval Status</h2>
                        <p className="mt-0.5 text-xs text-slate-500">Manage user account activation and permissions.</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95 cursor-pointer disabled:opacity-50"
                        disabled={updating}
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="space-y-5 px-6 py-6">
                    <div className="space-y-2 text-sm text-gray-600">
                        <p><span className="font-semibold text-gray-800">User:</span> {selectedUser.firstname} {selectedUser.lastname}</p>
                        <p><span className="font-semibold text-gray-800">Email:</span> {selectedUser.Email}</p>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">User Role</label>
                        <CustomSelect
                            value={newRoleID}
                            onChange={(val) => setNewRoleID(parseInt(val))}
                            options={[
                                { value: '2', label: 'User' },
                                { value: '1', label: 'Admin' }
                            ]}
                            size="md"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">Approval Status</label>
                        <CustomSelect
                            value={newApprovalStatus}
                            onChange={(val) => setNewApprovalStatus(val)}
                            options={[
                                { value: 'pending', label: 'Pending' },
                                { value: 'approved', label: 'Approved' },
                                { value: 'denied', label: 'Denied' }
                            ]}
                            size="md"
                        />
                    </div>
                </div>

                <div className="flex gap-2.5 border-t border-slate-100 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="flex-1 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50"
                        disabled={updating}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApprovalStatusUpdate}
                        className="flex-1 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:bg-blue-400"
                        disabled={updating || (newApprovalStatus === selectedUser.approvalstatus && newRoleID === selectedUser.roleid)}
                        type="button"
                    >
                        {updating ? 'Updating...' : 'Update Status'}
                    </button>
                </div>
            </div>
        </div>
    );
}

