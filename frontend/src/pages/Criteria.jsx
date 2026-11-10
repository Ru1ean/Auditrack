import React, { useState, useRef, useEffect, useCallback } from "react";
import { officesAPI, officeHeadsAPI, officetypesAPI, eventsAPI, criteriaAPI, usersAPI } from "../utils/api";
import CriteriaP from "../components/CriteriaP/CriteriaP";
import AddCriteriaModal from "../components/Criteria/AddCriteriaModal";
import EditOfficeModal from "../components/Organization/EditOfficeModal";
import ViewReqPasscuModal from "../components/ViewReqPasscuModal/ViewReqPasscuModal";
import ViewReqPASSCUModal from "../components/ViewReqPasscuModal/ViewReqPasscuModal";
import AddReqOffModal from "../components/AddReqOffModal/AddReqOffModal";
import EditCriteriaModal from "../components/Criteria/EditCriteriaModal";
import UnifiedSetupWizard from "../components/UnifiedSetupWizard/UnifiedSetupWizard";
import { useModal } from "../components/UI/ModalProvider";
import CustomSelect from "../components/UI/CustomSelect";
import { Wand2, CheckSquare, Plus, Trash2, ChevronDown } from "lucide-react";

export default function Criteria() {
    const [officeTypes, setOfficeTypes] = useState([]);
    const [heads, setHeads] = useState([]);
    const [events, setEvents] = useState([]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isEditCriteriaModalOpen, setIsEditCriteriaModalOpen] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [editCriteria, setEditCriteria] = useState(null);
    const [isViewReqModalOpen, setIsViewReqModalOpen] = useState(false);
    const [isAddReqModalOpen, setIsAddReqModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    const { showAlert, showConfirm } = useModal();

    const [selectedOffice, setSelectedOffice] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedEventType, setSelectedEventType] = useState('PACUCOA');
    const [selectedEventId, setSelectedEventId] = useState(null);

    const criteriaPRef = useRef();

    // Default to admin (show features) until we confirm otherwise
    const isAdmin = !!(currentUser && (currentUser.rolename === 'admin' || currentUser.roleid === 1));

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

    // Fetch office types safely
    useEffect(() => {
        async function fetchOfficeTypes() {
            try {
                const res = await officetypesAPI.getAll();
                setOfficeTypes(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error("Failed to fetch office types:", err);
                setOfficeTypes([]); // fallback to empty array
            }
        }
        fetchOfficeTypes();
    }, []);

    // Fetch office heads safely
    useEffect(() => {
        async function fetchHeads() {
            try {
                const res = await officeHeadsAPI.getAllHeads();
                setHeads(Array.isArray(res) ? res : []);
            } catch (err) {
                console.error("Failed to fetch heads:", err);
                setHeads([]); // fallback to empty array
            }
        }
        fetchHeads();
    }, []);

    // Fetch all events for dropdown
    useEffect(() => {
        async function fetchEvents() {
            try {
                const res = await eventsAPI.getAllEvents();
                if (res && res.success && Array.isArray(res.data)) {
                    setEvents(res.data);
                    if (res.data.length > 0) {
                        const savedId = localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id');
                        const valid = res.data.find(e => String(e.eventid || e.id) === String(savedId));
                        const target = valid || res.data[0];
                        setSelectedEventType(target.eventname || target.eventType);
                        setSelectedEventId(target.eventid || target.id);
                    }
                } else {
                    setEvents([]);
                }
            } catch (err) {
                setEvents([]);
            }
        }
        fetchEvents();
    }, []);

    // Reset states on mount
    useEffect(() => {
        setDeleteMode(false);
        setSelectedCount(0);
        setSelectedIds([]);
    }, []);

    // Refresh CriteriaP after adding new criteria
    const handleSuccess = () => {
        if (criteriaPRef.current?.refresh) {
            criteriaPRef.current.refresh();
        }
    };

    const handleOfficeClick = (office) => {
        if (!deleteMode) {
            setSelectedOffice(office);
            setIsViewReqModalOpen(true);
        }
    };

    const handleCloseViewReqModal = () => {
        setIsViewReqModalOpen(false);
        if (criteriaPRef.current?.refresh) {
            criteriaPRef.current.refresh();
        }
    };

    const handleEditOffice = (office) => {
        setIsViewReqModalOpen(false);
        setSelectedOffice(office);
        setIsEditModalOpen(true);
    };

    const handleAddRequirements = (office) => {
        setIsViewReqModalOpen(false);
        setSelectedOffice(office);
        setIsAddReqModalOpen(true);
    };

    const handleRequirementsSaved = () => {
        setIsAddReqModalOpen(false);
        setIsViewReqModalOpen(true);
        if (criteriaPRef.current?.refresh) {
            criteriaPRef.current.refresh();
        }
    };

    const handleEditSave = async (updatedOffice) => {
        try {
            const { officesAPI } = await import('../utils/api');
            const response = await officesAPI.updateOffice(updatedOffice.id, updatedOffice);

            if (response?.success) {
                criteriaPRef.current.refresh();
                await showAlert('Office updated successfully!');
            } else {
                await showAlert(response?.message || 'Failed to update office');
            }
        } catch (err) {
            console.error(err);
            await showAlert('Error updating office');
        }
    };

    const handleSelectionChange = useCallback((count, ids) => {
        setSelectedCount(count);
        setSelectedIds(ids);
    }, []);

    const isPaascu = selectedEventType === 'PAASCU' || selectedEventType === 'PASSCU';

    // Delete selected criteria
    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        const ok = await showConfirm(`Delete ${selectedIds.length} sub area(s)?`);
        if (!ok) return;
        try {
            await criteriaAPI.deleteCriteria(selectedIds);
            setSelectedCount(0);
            setSelectedIds([]);
            setDeleteMode(false);
            if (criteriaPRef.current?.refresh) criteriaPRef.current.refresh();
            await showAlert('Sub area(s) deleted successfully!');
        } catch (err) {
            console.error('Failed to delete criteria', err);
            await showAlert('Failed to delete sub area(s).');
        }
    };

    const handleCriteriaClick = (criteria) => {
        setEditCriteria(criteria);
        setIsEditCriteriaModalOpen(true);
    };

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <CheckSquare className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Sub Area Management</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Define assessment sub areas, standards, and compliance metrics.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Event Selector */}
                        <div className="min-w-[200px] sm:min-w-[240px]">
                            <CustomSelect
                                size="md"
                                value={selectedEventId || ''}
                                onChange={(val) => {
                                    const selected = events.find(ev => String(ev.eventid) === val);
                                    setSelectedEventId(val);
                                    setSelectedEventType(selected?.eventname || '');
                                }}
                                options={events.map(event => ({
                                    value: String(event.eventid),
                                    label: event.eventname || event.eventType,
                                }))}
                            />
                        </div>

                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setDeleteMode(prev => !prev)}
                                    className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold shadow-2xs transition active:scale-95 cursor-pointer ${
                                        deleteMode
                                            ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    <span>{deleteMode ? 'Cancel Selection' : 'Delete Mode'}</span>
                                </button>

                                {deleteMode && selectedIds.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteSelected}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-rose-700 active:scale-95 cursor-pointer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Delete Selected ({selectedIds.length})</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(true)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 cursor-pointer"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Sub Area</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowWizard(true)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
                                    title="Quick setup wizard"
                                >
                                    <Wand2 className="h-4 w-4 text-indigo-500" />
                                    <span>Wizard</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content Body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pt-4 pb-12">

            <div className="relative z-10">
                <CriteriaP
                    ref={criteriaPRef}
                    searchTerm={searchTerm}
                    eventid={selectedEventId}
                    deleteMode={deleteMode}
                    selectedIds={selectedIds}
                    onSelectionChange={(count, ids) => {
                        setSelectedCount(count);
                        setSelectedIds(ids);
                    }}
                    onCriteriaClick={handleCriteriaClick}
                />
            </div>

            {/* Add Criteria Modal */}
            {isModalOpen && (
                <AddCriteriaModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={async () => {
                        setIsModalOpen(false);
                        if (criteriaPRef.current?.refresh) criteriaPRef.current.refresh();
                        await showAlert('Sub area added successfully!');
                    }}
                />
            )}

            {/* Edit Criteria Modal */}
            {isEditCriteriaModalOpen && editCriteria && (
                <EditCriteriaModal
                    visible={isEditCriteriaModalOpen}
                    onClose={() => setIsEditCriteriaModalOpen(false)}
                    event={editCriteria}
                    onSave={async (updated) => {
                        try {
                            const { criteriaAPI } = await import('../utils/api');
                            const response = await criteriaAPI.updateCriteria(updated.criteriaid, updated);
                            if (response?.success) {
                                setIsEditCriteriaModalOpen(false);
                                if (criteriaPRef.current?.refresh) criteriaPRef.current.refresh();
                                await showAlert('Sub area updated successfully!');
                            } else {
                                await showAlert(response?.message || 'Failed to update sub area');
                            }
                        } catch (err) {
                            console.error('Error updating sub area:', err);
                            await showAlert('Failed to update sub area');
                        }
                    }}
                    userRole={currentUser?.roleid}
                />
            )}

            {/* View Requirements Modal - Use PASSCU Modal for PAASCU, regular for others */}
            {isViewReqModalOpen && isPaascu && (
                <ViewReqPASSCUModal
                    isOpen={isViewReqModalOpen}
                    onClose={handleCloseViewReqModal}
                    office={selectedOffice}
                    onEditOffice={handleEditOffice}
                    onAddRequirements={handleAddRequirements}
                />
            )}

            {isViewReqModalOpen && !isPaascu && (
                <ViewReqPasscuModal
                    isOpen={isViewReqModalOpen}
                    onClose={handleCloseViewReqModal}
                    office={selectedOffice}
                    onEditOffice={handleEditOffice}
                    onAddRequirements={handleAddRequirements}
                />
            )}

            {/* Edit Modal */}
            {isEditModalOpen && (
                <EditOfficeModal
                    visible={isEditModalOpen}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setIsViewReqModalOpen(true);
                    }}
                    office={selectedOffice}
                    onSave={handleEditSave}
                    officeTypes={officeTypes}
                    heads={heads}
                />
            )}

            {/* Add Requirements Modal */}
            {isAddReqModalOpen && (
                <AddReqOffModal
                    isOpen={isAddReqModalOpen}
                    onClose={() => {
                        setIsAddReqModalOpen(false);
                        setIsViewReqModalOpen(true);
                    }}
                    office={selectedOffice}
                    onSave={handleRequirementsSaved}
                />
            )}
            </div>
        </div>
    );
}
