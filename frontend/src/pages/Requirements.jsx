import { useState, useRef, useEffect, useCallback } from "react";
import AddRequirementModal from "../components/Requirement/AddRequirementModal";
import AddPasscuRequirement from "../components/AddPasscuRequirement/AddPasscuRequirement";
import EditRequirementsModal from "../components/Requirement/EditRequirementsModal";
import RequirementsP from "../components/RequirementsProfile/RequirementsProfile";
import UnifiedSetupWizard from "../components/UnifiedSetupWizard/UnifiedSetupWizard";
import { eventsAPI, usersAPI } from "../utils/api";
import { useModal } from "../components/UI/ModalProvider";
import CustomSelect from "../components/UI/CustomSelect";
import { Wand2, ClipboardList, Plus, Trash2, ChevronDown } from "lucide-react";

export default function Requirements() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [selectedRequirement, setSelectedRequirement] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteMode, setDeleteMode] = useState(false);
    const [selectedCount, setSelectedCount] = useState(0);
    const [selectedIds, setSelectedIds] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const [filterOptions, setFilterOptions] = useState({
        events: [],
        types: []
    });
    const [events, setEvents] = useState([]);
    const requirementsPRef = useRef();
    const { showAlert, showConfirm } = useModal();

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

    // Fetch all events on component mount
    useEffect(() => {
        const fetchEvents = async () => {
            try {
                const allEvents = await eventsAPI.getAllEvents();
                if (allEvents && allEvents.success && Array.isArray(allEvents.data)) {
                    setEvents(allEvents.data);
                    if (allEvents.data.length > 0) {
                        const savedId = localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id');
                        const valid = allEvents.data.find(e => String(e.eventid || e.id) === String(savedId));
                        setSelectedEventId(valid ? (valid.eventid || valid.id) : allEvents.data[0].eventid);
                    }
                } else {
                    setEvents([]);
                }
            } catch (error) {
                console.error("Error fetching events:", error);
                setEvents([]);
            }
        };
        fetchEvents();
    }, []);

    // Reset all states when component unmounts or navigation happens
    useEffect(() => {
        setDeleteMode(false);
        setSelectedCount(0);
        setSelectedIds([]);
        
        return () => {
            setDeleteMode(false);
            setSelectedCount(0);
            setSelectedIds([]);
            setIsModalOpen(false);
        };
    }, []);

    const handleAddSuccess = (newRequirement) => {
        console.log('New requirement added:', newRequirement);
        
        // Refresh the RequirementsP component to show the new data
        if (requirementsPRef.current && requirementsPRef.current.refresh) {
            requirementsPRef.current.refresh();
        }
    };

    const handleRequirementClick = (requirement) => {
        setSelectedRequirement(requirement);
        setIsEditModalOpen(true);
    };

    const handleEditSave = async (updatedRequirement) => {
        try {
            const { requirementsAPI } = await import('../utils/api');
            const response = await requirementsAPI.updateRequirement(
                updatedRequirement.requirementid,
                updatedRequirement
            );

            if (response.success) {
                console.log('Requirement updated successfully');
                
                // Refresh the list
                if (requirementsPRef.current && requirementsPRef.current.refresh) {
                    requirementsPRef.current.refresh();
                }
                
                await showAlert('Requirement updated successfully!');
            } else {
                await showAlert(response.message || 'Failed to update requirement');
            }
        } catch (error) {
            console.error('Error updating requirement:', error);
            await showAlert('An error occurred while updating the requirement');
        }
    };

    const handleSearchChange = (term) => {
        setSearchTerm(term);
    };

    const handleFilterChange = (filters) => {
        setFilterOptions(filters);
    };

    const handleDeleteModeToggle = (mode) => {
        setDeleteMode(mode);
        setSelectedCount(0);
        setSelectedIds([]);
        // Also clear selection in RequirementsP child
        if (requirementsPRef.current && requirementsPRef.current.clearSelection) {
            requirementsPRef.current.clearSelection();
        }
    };

    // Memoize handleSelectionChange to prevent infinite loops
    const handleSelectionChange = useCallback((count, ids) => {
        setSelectedCount(count);
        setSelectedIds(ids);
    }, []);

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0 || !requirementsPRef.current) return;
        
        // Confirm deletion
        const confirmed = await showConfirm(`Are you sure you want to delete ${selectedIds.length} standard item(s)? This action cannot be undone.`);
        if (!confirmed) return;
        
        try {
            const result = await requirementsPRef.current.deleteSelected(selectedIds);
            if (result.success) {
                // Reset selection state
                setSelectedCount(0);
                setSelectedIds([]);
                setDeleteMode(false);
                // Show success message
                console.log('Successfully deleted selected standard(s)');
                await showAlert(`Successfully deleted ${selectedIds.length} standard item(s)`);
            } else {
                // Show error message
                console.error('Failed to delete standard:', result.message);
                await showAlert(result.message || 'Failed to delete standard');
            }
        } catch (error) {
            console.error('Error deleting standard:', error);
            await showAlert('An error occurred while deleting standard');
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <ClipboardList className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Standard Management</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Track standard compliance, documents, and assigned sub areas.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Event Selector */}
                        <div className="min-w-[200px] sm:min-w-[240px]">
                            <CustomSelect
                                size="md"
                                value={selectedEventId}
                                onChange={(val) => setSelectedEventId(val)}
                                options={events.map((event) => ({
                                    value: String(event.eventid),
                                    label: event.eventname || event.eventType,
                                }))}
                            />
                        </div>

                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleDeleteModeToggle}
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
                                    <span>Add Standard</span>
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

            {/* Add Requirement Modal - Always use PASSCU modal */}
            <AddPasscuRequirement
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={handleAddSuccess}
            />

            {/* Edit Requirement Modal */}
            <EditRequirementsModal
                visible={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setSelectedRequirement(null);
                }}
                requirement={selectedRequirement}
                onSave={handleEditSave}
                userRole={currentUser?.roleid}
            />

            {/* Requirements List */}
            <RequirementsP
                ref={requirementsPRef}
                searchTerm={searchTerm}
                filterOptions={filterOptions}
                deleteMode={deleteMode}
                onSelectionChange={handleSelectionChange}
                onRequirementClick={handleRequirementClick}
                eventid={selectedEventId}
            />
            </div>
        </div>
    );
}
