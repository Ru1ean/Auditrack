import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Check, Search, Shield, Info, Loader2 } from 'lucide-react';
import { usersAPI, personnelAssignmentsAPI } from '../../utils/api';
import { useToast } from '../UI/Toast';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function AssignPersonnelModal({
    isOpen,
    onClose,
    eventid,
    eventname,
    targetType, // 'area' | 'criteria' | 'requirement'
    target,     // { areaid, areacode, areaname } OR { criteriaid, ... } OR { requirementid, ... }
    existingAssignments = [], // array of assignment objects for this event
    onSuccess
}) {
    const { toast } = useToast();
    const [personnelList, setPersonnelList] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [initialUserIds, setInitialUserIds] = useState(new Set());

    // Determine target identifiers and display labels
    const targetLabel = useMemo(() => {
        if (!target) return '';
        if (targetType === 'area') {
            return `${target.areacode ? `${target.areacode}: ` : ''}${target.areaname || 'Area'}`;
        }
        if (targetType === 'criteria') {
            const code = String(target.criteriacode || '').trim().replace(/\.$/, '');
            return `${code ? `${code}. ` : ''}${target.criterianame || 'Sub Area'}`;
        }
        if (targetType === 'requirement') {
            return target.requirementcode || target.description || 'Standard';
        }
        return '';
    }, [targetType, target]);

    // Load available personnel and initialize selection
    useEffect(() => {
        if (!isOpen || !target) return;

        let mounted = true;
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch users
                const res = await usersAPI.getAllUsers();
                const allUsers = Array.isArray(res) ? res : (res?.data || res?.users || []);
                
                // Filter personnel / officers / users (role 2 or 3 or rolename personnel/head/user/officer)
                const filtered = allUsers.filter(u => {
                    const role = String(u.rolename || '').toLowerCase();
                    const rid = Number(u.roleid);
                    return rid === 2 || rid === 3 || role.includes('personnel') || role.includes('office') || role.includes('head') || role === 'user';
                });

                if (mounted) setPersonnelList(filtered);

                // Identify currently assigned users for this specific target
                const currentAssigned = new Set();
                const targetAreaId = targetType === 'area' ? Number(target.areaid) : null;
                const targetCritId = targetType === 'criteria' ? Number(target.criteriaid) : null;
                const targetReqId = targetType === 'requirement' ? Number(target.requirementid) : null;

                (existingAssignments || []).forEach(pa => {
                    const paArea = pa.areaid ? Number(pa.areaid) : null;
                    const paCrit = pa.criteriaid ? Number(pa.criteriaid) : null;
                    const paReq = pa.requirementid ? Number(pa.requirementid) : null;

                    if (targetType === 'area' && paArea === targetAreaId && !paCrit && !paReq) {
                        currentAssigned.add(Number(pa.userid));
                    } else if (targetType === 'criteria' && paCrit === targetCritId && !paReq) {
                        currentAssigned.add(Number(pa.userid));
                    } else if (targetType === 'requirement' && paReq === targetReqId) {
                        currentAssigned.add(Number(pa.userid));
                    }
                });

                if (mounted) {
                    setSelectedUserIds(new Set(currentAssigned));
                    setInitialUserIds(new Set(currentAssigned));
                }
            } catch (err) {
                console.error('Error fetching personnel for assignment modal:', err);
                toast?.({ title: 'Error', description: 'Failed to load personnel list.', variant: 'error' });
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [isOpen, target, targetType, existingAssignments, toast]);

    const filteredPersonnel = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return personnelList;
        return personnelList.filter(p => {
            const fullName = `${p.firstname || ''} ${p.lastname || ''}`.toLowerCase();
            const email = (p.email || p.Email || '').toLowerCase();
            const pos = String(p.position || p.Position || '').toLowerCase();
            return fullName.includes(query) || email.includes(query) || pos.includes(query);
        });
    }, [personnelList, searchTerm]);

    const toggleUser = (userid) => {
        setSelectedUserIds(prev => {
            const next = new Set(prev);
            const id = Number(userid);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSave = async () => {
        if (!target || !eventid) return;
        setSaving(true);
        try {
            const currentSelected = Array.from(selectedUserIds);
            const initialArr = Array.from(initialUserIds);

            // Users to add: in currentSelected but not in initialUserIds
            const toAdd = currentSelected.filter(id => !initialUserIds.has(id));
            // Users to remove: in initialUserIds but not in currentSelected
            const toRemove = initialArr.filter(id => !selectedUserIds.has(id));

            const targetAreaId = targetType === 'area' ? Number(target.areaid) : null;
            const targetCritId = targetType === 'criteria' ? Number(target.criteriaid) : null;
            const targetReqId = targetType === 'requirement' ? Number(target.requirementid) : null;

            // Perform adds
            if (toAdd.length > 0) {
                await personnelAssignmentsAPI.assign({
                    eventid: Number(eventid),
                    userIds: toAdd,
                    areaid: targetAreaId,
                    criteriaid: targetCritId,
                    requirementid: targetReqId
                });
            }

            // Perform removes
            for (const uid of toRemove) {
                await personnelAssignmentsAPI.unassign({
                    eventid: Number(eventid),
                    userid: uid,
                    areaid: targetAreaId,
                    criteriaid: targetCritId,
                    requirementid: targetReqId
                });
            }

            toast?.({
                title: 'Success',
                description: `Personnel assignments updated for ${targetType === 'area' ? 'Area' : targetType === 'criteria' ? 'Sub Area' : 'Standard'}.`,
                variant: 'success'
            });

            onSuccess?.();
            onClose();
        } catch (err) {
            console.error('Error saving personnel assignments:', err);
            toast?.({ title: 'Error', description: err?.message || 'Failed to save assignments.', variant: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !target) return null;

    return createPortal(
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900 leading-tight">
                                Assign Personnel
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs md:max-w-sm">
                                {targetType === 'area' ? 'Area' : targetType === 'criteria' ? 'Sub Area' : 'Standard'}: <span className="font-semibold text-slate-700">{targetLabel}</span>
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Explanation Alert */}
                <div className="px-6 pt-3 pb-1">
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-900 text-xs">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            {targetType === 'area' && (
                                <span>
                                    Personnel assigned to this <strong>Area</strong> will automatically handle and be authorized to upload evidence for all <strong>sub-areas</strong> and <strong>standards</strong> under it.
                                </span>
                            )}
                            {targetType === 'criteria' && (
                                <span>
                                    Personnel assigned to this <strong>Sub Area</strong> will automatically handle and be authorized to upload evidence for all <strong>standards</strong> under it.
                                </span>
                            )}
                            {targetType === 'requirement' && (
                                <span>
                                    Personnel assigned to this <strong>Standard</strong> will be directly responsible for fulfilling and uploading evidence for it.
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="px-6 pt-3 pb-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search personnel by name, email, or role..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                        />
                    </div>
                </div>

                {/* Personnel List */}
                <div className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-slate-100">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            <span className="text-xs">Loading personnel...</span>
                        </div>
                    ) : filteredPersonnel.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-xs">
                            {searchTerm ? 'No personnel match your search.' : 'No personnel found.'}
                        </div>
                    ) : (
                        filteredPersonnel.map((person) => {
                            const isChecked = selectedUserIds.has(Number(person.userid));
                            const fullName = `${person.firstname || ''} ${person.lastname || ''}`.trim() || person.email;

                            return (
                                <div
                                    key={person.userid}
                                    onClick={() => toggleUser(person.userid)}
                                    className={`py-3 px-3 rounded-xl flex items-center justify-between cursor-pointer transition ${
                                        isChecked ? 'bg-blue-50/70 border border-blue-200/60' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <SmartUserAvatar user={person} size="sm" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-900 truncate">
                                                {fullName}
                                            </p>
                                            <p className="text-[11px] text-slate-500 truncate">
                                                {person.email || person.Email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 ml-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                                            isChecked ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                            {isChecked ? 'Assigned' : 'Unassigned'}
                                        </span>
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                            isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                                        }`}>
                                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                        <strong>{selectedUserIds.size}</strong> personnel selected
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{saving ? 'Saving...' : 'Save Assignments'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
