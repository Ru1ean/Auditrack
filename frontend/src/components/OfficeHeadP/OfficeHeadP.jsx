import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { createPortal } from 'react-dom';
import user from "../../assets/images/user.svg";
import { officeHeadsAPI, officesAPI, usersAPI } from "../../utils/api";
import { useModal } from "../UI/ModalProvider";
import EditOfficeHeadModal from '../OfficeHead/EditOfficeHeadModal.jsx';
import Pagination from "../Pagination/Pagination";
import OfficeHeaddetails from "../OfficeHead/OfficeHeaddetails.jsx";
import { API_BASE_URL } from '../../utils/apiBase';
import { OfficeCardSkeleton } from "../UI/Skeleton";
import { useLiveRefresh } from "../../utils/liveSync";
import ServerOfflineState from "../UI/ServerOfflineState";
import SmartUserAvatar from "../UI/SmartUserAvatar";
import { Layers } from "lucide-react";
import AssignPersonnelScopeModal from "../OfficeHead/AssignPersonnelScopeModal";

const STATIC_MOCK_PERSONNEL = [
    {
        headid: 901,
        firstname: "Sarah",
        middleinitial: "M",
        lastname: "Connor",
        Position: "Office Head",
        Email: "s.connor@university.edu",
        contactinfo: "s.connor@university.edu",
        officeid: 1,
        assigned_offices: [{ officename: "Registrar Office", id: 1 }, { officename: "Admissions Office", id: 2 }]
    },
    {
        headid: 902,
        firstname: "James",
        middleinitial: "R",
        lastname: "Vance",
        Position: "Personnel",
        Email: "james.vance@university.edu",
        contactinfo: "james.vance@university.edu",
        officeid: 2,
        assigned_offices: [{ officename: "Admissions", id: 2 }]
    },
    {
        headid: 903,
        firstname: "Elena",
        middleinitial: "G",
        lastname: "Cruz",
        Position: "Office Head",
        Email: "elena.cruz@university.edu",
        contactinfo: "elena.cruz@university.edu",
        officeid: 3,
        assigned_offices: [{ officename: "College of Science", id: 3 }, { officename: "Biology Dept", id: 4 }, { officename: "Chemistry Dept", id: 5 }]
    },
    {
        headid: 904,
        firstname: "Marcus",
        middleinitial: "T",
        lastname: "Brody",
        Position: "Personnel",
        Email: "marcus.brody@university.edu",
        contactinfo: "marcus.brody@university.edu",
        officeid: 6,
        assigned_offices: [{ officename: "Information Technology", id: 6 }, { officename: "MIS Unit", id: 7 }]
    },
    {
        headid: 905,
        firstname: "Maria",
        middleinitial: "D",
        lastname: "Santos",
        Position: "Office Head",
        Email: "maria.santos@university.edu",
        contactinfo: "maria.santos@university.edu",
        officeid: 8,
        assigned_offices: [{ officename: "Human Resources", id: 8 }]
    },
    {
        headid: 906,
        firstname: "John",
        middleinitial: "K",
        lastname: "Miller",
        Position: "Personnel",
        Email: "john.miller@university.edu",
        contactinfo: "john.miller@university.edu",
        officeid: 9,
        assigned_offices: [{ officename: "Finance & Accounting", id: 9 }, { officename: "Cashier Office", id: 10 }]
    },
    {
        headid: 907,
        firstname: "Patricia",
        middleinitial: "L",
        lastname: "Reyes",
        Position: "Personnel",
        Email: "patricia.reyes@university.edu",
        contactinfo: "patricia.reyes@university.edu",
        officeid: 11,
        assigned_offices: [{ officename: "Student Affairs", id: 11 }, { officename: "Guidance Office", id: 12 }, { officename: "Scholarship Dept", id: 13 }]
    },
    {
        headid: 908,
        firstname: "David",
        middleinitial: "W",
        lastname: "Chen",
        Position: "Office Head",
        Email: "david.chen@university.edu",
        contactinfo: "david.chen@university.edu",
        officeid: 14,
        assigned_offices: [{ officename: "Library Services", id: 14 }]
    },
    {
        headid: 909,
        firstname: "Anna",
        middleinitial: "V",
        lastname: "Lopez",
        Position: "Personnel",
        Email: "anna.lopez@university.edu",
        contactinfo: "anna.lopez@university.edu",
        officeid: 15,
        assigned_offices: [{ officename: "Research & Development", id: 15 }, { officename: "Publications", id: 16 }]
    },
    {
        headid: 910,
        firstname: "Robert",
        middleinitial: "H",
        lastname: "Taylor",
        Position: "Personnel",
        Email: "robert.taylor@university.edu",
        contactinfo: "robert.taylor@university.edu",
        officeid: 17,
        assigned_offices: [{ officename: "Guidance Counseling", id: 17 }]
    },
    {
        headid: 911,
        firstname: "Carmen",
        middleinitial: "S",
        lastname: "Diaz",
        Position: "Office Head",
        Email: "carmen.diaz@university.edu",
        contactinfo: "carmen.diaz@university.edu",
        officeid: 18,
        assigned_offices: [{ officename: "College of Engineering", id: 18 }, { officename: "Civil Eng Lab", id: 19 }]
    }
];

const OfficeHeadP = forwardRef(({ searchTerm = '', sortType = 'name', deleteMode = false, onSelectionChange, viewMode = 'grid' }, ref) => {
    const [officeHeads, setOfficeHeads] = useState([]);
    const [offices, setOffices] = useState([]);
    const [filteredOfficeHeads, setFilteredOfficeHeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedHeads, setSelectedHeads] = useState(new Set());
    const [expandedCards, setExpandedCards] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [detailsHead, setDetailsHead] = useState(null);
    const [detailsOffices, setDetailsOffices] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
    const [scopeModalPerson, setScopeModalPerson] = useState(null);

    const isAdmin = currentUser?.rolename === 'admin' || currentUser?.roleid === 1;

    // Fetch office heads and offices data from database
    useEffect(() => {
        fetchOfficeHeads();
        fetchOffices();
        const fetchCurrentUser = async () => {
            try {
                const res = await usersAPI.getLoggedInUser().catch(() => null);
                if (res && res.success) setCurrentUser(res.user);
            } catch (err) {
                console.error('Failed to load current user:', err);
            }
        };
        fetchCurrentUser();
    }, []);

    // Live syncing on mutations / window focus
    useLiveRefresh(() => {
        fetchOfficeHeads();
        fetchOffices();
    });

    const fetchOffices = async () => {
        try {
            const res = await officesAPI.getAll();
            // Support both {data: [...]} and [...] response
            if (Array.isArray(res)) {
                setOffices(res);
            } else if (res && Array.isArray(res.data)) {
                setOffices(res.data);
            } else {
                setOffices([]);
            }
        } catch (err) {
            setOffices([]);
        }
    };

    // Filter and sort office heads based on search term and sort type
    useEffect(() => {
        let filtered = officeHeads;

        // Apply search filter first
        if (searchTerm.trim()) {
            filtered = officeHeads.filter(person => {
                const fullName = `${person.firstname}${person.middleinitial ? ' ' + person.middleinitial + '.' : ''} ${person.lastname}`.toLowerCase();
                const position = person.Position?.toLowerCase() || '';
                const contact = (person.Email || person.contactinfo || '').toLowerCase();
                const searchLower = searchTerm.toLowerCase();

                return fullName.includes(searchLower) ||
                    position.includes(searchLower) ||
                    contact.includes(searchLower);
            });
        }

        // Apply filtering based on sort type
        switch (sortType) {
            case 'assigned':
                // Show only assigned office heads (those with officeid or assigned_offices)
                filtered = filtered.filter(person => person.officeid || (person.assigned_offices && person.assigned_offices.length > 0));
                break;

            case 'unassigned':
                // Show only unassigned office heads
                filtered = filtered.filter(person => !person.officeid && (!person.assigned_offices || person.assigned_offices.length === 0));
                break;

            case 'name':
            default:
                // Show all, no additional filtering
                break;
        }

        // Sort by name in ascending order for all cases
        const sortedFiltered = [...filtered].sort((a, b) => {
            const nameA = `${a.firstname} ${a.lastname}`.toLowerCase();
            const nameB = `${b.firstname} ${b.lastname}`.toLowerCase();
            return nameA.localeCompare(nameB);
        });

        setFilteredOfficeHeads(sortedFiltered);
    }, [officeHeads, searchTerm, sortType]);

    // Handle selection changes and notify parent component
    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(selectedHeads.size, Array.from(selectedHeads));
        }
    }, [selectedHeads, onSelectionChange]);

    // Clear selections when delete mode is turned off
    useEffect(() => {
        if (!deleteMode) {
            setSelectedHeads(new Set());
        }
    }, [deleteMode]);

    const handleCheckboxChange = (headid, isChecked) => {
        setSelectedHeads(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(headid);
            } else {
                newSet.delete(headid);
            }
            return newSet;
        });
    };

    const toggleHeadSelection = (headid) => {
        setSelectedHeads(prev => {
            const next = new Set(prev);
            if (next.has(headid)) {
                next.delete(headid);
            } else {
                next.add(headid);
            }
            return next;
        });
    };

    const toggleExpand = (headid) => {
        setExpandedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(headid)) {
                newSet.delete(headid);
            } else {
                newSet.add(headid);
            }
            return newSet;
        });
    };

    const openDetails = (person, assignedOffices) => {
        setDetailsHead(person);
        setDetailsOffices(assignedOffices || []);
        setIsDetailsOpen(true);
    };

    const closeDetails = () => {
        setIsDetailsOpen(false);
        setDetailsHead(null);
        setDetailsOffices([]);
    };

    const deleteSelectedHeads = async (headIds) => {
        try {
            console.log('Attempting to delete heads:', headIds);
            console.log('API Base URL:', `${API_BASE_URL}/api/officeheads/delete`);

            // Make API call to delete heads
            const response = await officeHeadsAPI.deleteHeads(headIds);
            return response;
        } catch (error) {
            console.error('Error in deleteSelectedHeads:', error);
            if (error.response) {
                return { success: false, message: `Server error: ${error.response.data?.message || error.response.statusText}` };
            }
            return { success: false, message: 'Error deleting office heads. Please try again.' };
        }
    };

    const [isRetrying, setIsRetrying] = useState(false);

    const fetchOfficeHeads = async (isRetry = false) => {
        try {
            if (isRetry) setIsRetrying(true);
            else setLoading(true);
            setError(null);
            const response = await officeHeadsAPI.getAllHeads();
            let headsList = [];
            if (Array.isArray(response)) {
                headsList = response;
            } else if (response && Array.isArray(response.data)) {
                headsList = response.data;
            }

            setOfficeHeads(headsList);
            setError(null);
        } catch (error) {
            console.error('Error fetching office heads:', error);
            setOfficeHeads([]);
            if (!error.response || error.code === 'ERR_NETWORK' || error.message?.toLowerCase().includes('network error') || error.message?.toLowerCase().includes('failed to fetch')) {
                setError('Server Offline');
            } else {
                setError(error.response?.data?.message || 'Failed to load office personnel.');
            }
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    };
    // Function to refresh data (can be called from parent component)
    const refreshData = () => {
        fetchOfficeHeads();
    };

    // Expose refresh function to parent
    useImperativeHandle(ref, () => ({
        refresh: refreshData,
        deleteSelected: deleteSelectedHeads
    }));

    // Edit modal state
    const [selectedHead, setSelectedHead] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [actionMenuHeadId, setActionMenuHeadId] = useState(null);
    const [actionMenuAnchorRect, setActionMenuAnchorRect] = useState(null);
    const { showConfirm, showAlert } = useModal();

    const openEdit = (person) => {
        setSelectedHead(person);
        setIsEditModalOpen(true);
    };

    const closeEdit = () => {
        setIsEditModalOpen(false);
        setSelectedHead(null);
    };

    const handleDeleteHead = async (person) => {
        if (!person?.headid) return;

        const confirmed = await showConfirm(`Delete office personnel "${person.firstname || ''} ${person.lastname || ''}"? This cannot be undone.`);
        if (!confirmed) return;

        const result = await deleteSelectedHeads([person.headid]);
        if (result?.success) {
            await showAlert('Office personnel deleted successfully.');
        } else {
            await showAlert(result?.message || 'Failed to delete office personnel.');
        }
    };

    useEffect(() => {
        if (!actionMenuHeadId) return;

        const closeOnOutsideClick = (event) => {
            const target = event.target;
            if (
                target.closest('.office-head-actions-menu') ||
                target.closest('.office-head-actions-button')
            ) {
                return;
            }

            setActionMenuHeadId(null);
            setActionMenuAnchorRect(null);
        };

        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, [actionMenuHeadId]);

    useEffect(() => {
        if (!actionMenuHeadId) return;

        const closeOnScrollOrResize = () => {
            setActionMenuHeadId(null);
            setActionMenuAnchorRect(null);
        };

        window.addEventListener('resize', closeOnScrollOrResize);
        window.addEventListener('scroll', closeOnScrollOrResize, true);
        return () => {
            window.removeEventListener('resize', closeOnScrollOrResize);
            window.removeEventListener('scroll', closeOnScrollOrResize, true);
        };
    }, [actionMenuHeadId]);

    const handleSave = async (updated) => {
        try {
            const formData = new FormData();
            const fallbackHead = selectedHead || {};
            const firstname = (updated.firstname !== undefined ? updated.firstname : fallbackHead.firstname) || '';
            const middleinitial = (updated.middleinitial !== undefined ? updated.middleinitial : fallbackHead.middleinitial) || '';
            const lastname = (updated.lastname !== undefined ? updated.lastname : fallbackHead.lastname) || '';
            const position = (updated.Position !== undefined ? updated.Position : fallbackHead.Position) || '';
            const contactinfo = (updated.contactinfo !== undefined ? updated.contactinfo : fallbackHead.contactinfo) || '';

            formData.append('firstname', firstname.trim());
            formData.append('middleinitial', middleinitial.trim());
            formData.append('lastname', lastname.trim());
            formData.append('Position', position.trim());
            formData.append('contactinfo', contactinfo.trim());

            if (updated.profilepic && typeof updated.profilepic === 'object') {
                formData.append('profilepic', updated.profilepic);
            }

            const response = await officeHeadsAPI.updateHead(updated.headid, formData);
            if (!response?.success) {
                await showAlert(response?.message || 'Failed to update office personnel.');
                return false;
            }

            await fetchOfficeHeads();
            await fetchOffices();
            await showAlert('Office personnel updated successfully.');
            return true;
        } catch (error) {
            console.error('Error updating office personnel:', error);
            await showAlert(error?.response?.data?.message || error?.message || 'Failed to update office personnel.');
            return false;
        }
    };

    const parseContactInfo = (person = {}) => {
        const primaryEmail = person.Email || person.email || person.EmailAddress || person.emailAddress || person.email_address;
        const contactinfo = person.contactinfo || person.contactinfo || '';
        const normalizedContact = String(contactinfo || '');
        const emailMatch = normalizedContact.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const phoneMatch = normalizedContact.match(/(\+?\d[\d\s()-]{6,}\d)/);

        return {
            email: primaryEmail || (emailMatch ? emailMatch[0] : 'No email provided'),
            phone: phoneMatch ? phoneMatch[0] : 'No phone provided'
        };
    };

    const formatJoinDate = (person) => {
        const rawDate = person?.createdat || person?.createdat || person?.createdat || person?.JoinDate;
        if (!rawDate) {
            return 'N/A';
        }

        const dateObj = new Date(rawDate);
        if (Number.isNaN(dateObj.getTime())) {
            return 'N/A';
        }

        return dateObj.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    const officeHasHead = (office, headid) => {
        const normalizedHeadId = Number(headid);

        if (!Number.isNaN(normalizedHeadId)) {
            if (Number(office?.headid) === normalizedHeadId || Number(office?.headid) === normalizedHeadId) {
                return true;
            }

            if (Array.isArray(office?.head_ids) && office.head_ids.some((id) => Number(id) === normalizedHeadId)) {
                return true;
            }

            if (Array.isArray(office?.HeadIDs) && office.HeadIDs.some((id) => Number(id) === normalizedHeadId)) {
                return true;
            }

            if (Array.isArray(office?.heads) && office.heads.some((head) => Number(head?.headid || head?.headid) === normalizedHeadId)) {
                return true;
            }
        }

        return false;
    };

    const itemsPerPage = viewMode === 'list' ? 30 : 12;
    const totalPages = Math.max(1, Math.ceil(filteredOfficeHeads.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedOfficeHeads = filteredOfficeHeads.slice(startIdx, startIdx + itemsPerPage);
    const visibleOfficeHeads = paginatedOfficeHeads;

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(1);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortType]);

    useEffect(() => {
        setCurrentPage(1);
    }, [viewMode]);

    if (loading) {
        return (
            <div className="w-full py-4">
                <OfficeCardSkeleton count={6} />
            </div>
        );
    }

    if (error) {
        return (
            <ServerOfflineState
                onRetry={() => fetchOfficeHeads(true)}
                isRetrying={isRetrying}
                title={error === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Personnel'}
                message={error === 'Server Offline' 
                    ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                    : error}
            />
        );
    }

    if (filteredOfficeHeads.length === 0) {
        return (
            <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                    {searchTerm.trim() ? 'No Personnel Found' : 'No Office Personnel Added'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                    {searchTerm.trim() 
                        ? `No office personnel match your search for "${searchTerm}".` 
                        : 'No office personnel or department heads have been registered yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className={viewMode === 'list' ? 'mt-1 w-full flex flex-col pb-24' : 'w-full h-full min-h-0 flex-1 flex flex-col pt-1.5 px-0.5 overflow-hidden'}>
            {/* Search Results Counter */}
            {searchTerm.trim() && (
                <div className="text-xs text-gray-600 mb-2 shrink-0">
                    Showing {filteredOfficeHeads.length} of {officeHeads.length} office personnel
                    {filteredOfficeHeads.length !== officeHeads.length && ` matching "${searchTerm}"`}
                </div>
            )}

            {viewMode === 'list' && (
                <div
                    className="grid grid-cols-8 gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-semibold text-gray-700 sticky z-30 min-w-[720px] mb-2"
                    style={{ top: 0, zIndex: 3 }}
                >
                    <div className="col-span-4 flex items-center">Name</div>
                    <div className="col-span-2 flex items-center">Role</div>
                    <div className="col-span-1 flex items-center">Status</div>
                    <div className="col-span-1 flex items-center justify-end">Actions</div>
                </div>
            )}

            <div className={viewMode === 'list' ? 'flex flex-col gap-2 pt-1 pb-14' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5 lg:gap-3 flex-1 min-h-0 h-full p-1 overflow-hidden'}>
                {visibleOfficeHeads.map((person) => {
                    const fullName = `${person.firstname || ''}${person.middleinitial ? ' ' + person.middleinitial + '.' : ''} ${person.lastname || ''}`.trim() || 'Personnel';
                    const initials = `${(person.firstname || '').trim().charAt(0)}${(person.lastname || '').trim().charAt(0)}`.toUpperCase() || 'OP';
                    const profilePicUrl = person.TempPreview
                        ? person.TempPreview
                        : person.profilepic
                            ? `${API_BASE_URL}/uploads/profile-pics/${person.profilepic}`
                            : null;
                    const assignedOffices = (person.assigned_offices && person.assigned_offices.length > 0)
                        ? person.assigned_offices
                        : offices.filter((office) => officeHasHead(office, person.headid));
                    const isAssigned = assignedOffices.length > 0;
                    const statusClass = isAssigned
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        : 'bg-slate-100 text-slate-600 border-slate-200';
                    const isExpanded = expandedCards.has(person.headid);
                    const isSelected = selectedHeads.has(person.headid);
                    const { email } = parseContactInfo(person);

                    if (viewMode === 'list') {
                        return (
                            <div
                                key={person.headid}
                                onClick={() => {
                                    if (deleteMode) toggleHeadSelection(person.headid);
                                    else openDetails(person, assignedOffices);
                                }}
                                className={`relative rounded-xl border border-slate-200 bg-white shadow-2xs ${selectedHeads.has(person.headid) ? 'ring-2 ring-blue-500 border-blue-500' : ''
                                    } ${deleteMode ? 'cursor-pointer' : 'app-card-hover cursor-pointer'}`}
                            >
                                <div className="grid grid-cols-8 items-center gap-2 px-4 py-3">
                                    {/* Name column (col-span-4) */}
                                    <div className="col-span-4 flex items-center gap-3 min-w-0">
                                        {deleteMode && (
                                            <div className="flex-shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedHeads.has(person.headid)}
                                                    onChange={(e) => handleCheckboxChange(person.headid, e.target.checked)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </div>
                                        )}

                                        <SmartUserAvatar
                                            user={person}
                                            src={profilePicUrl}
                                            fullName={fullName}
                                            size="h-10 w-10"
                                            textSize="text-xs font-bold"
                                            ring="ring-2 ring-slate-100"
                                        />

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="truncate text-[13px] font-semibold text-gray-900">{fullName}</h3>
                                            </div>
                                            <div className="mt-0.5 text-[11px] text-gray-600 truncate">{email}</div>
                                        </div>
                                    </div>

                                    {/* Role column (col-span-2) */}
                                    <div className="col-span-2 flex items-center">
                                        <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold bg-indigo-50 text-indigo-700 border-indigo-200">
                                            {person.Position || person.rolename || person.role || 'Personnel'}
                                        </span>
                                    </div>

                                    {/* Status column (col-span-1) */}
                                    <div className="col-span-1 flex items-center">
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                                            {isAssigned ? 'Assigned' : 'Unassigned'}
                                        </span>
                                    </div>

                                    {/* Actions column (col-span-1) */}
                                    <div className="col-span-1 flex items-center justify-end">
                                        <div className="flex items-center gap-2">
                                            {isAdmin && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const isOpen = actionMenuHeadId === person.headid;
                                                            if (isOpen) {
                                                                setActionMenuHeadId(null);
                                                                setActionMenuAnchorRect(null);
                                                            } else {
                                                                setActionMenuHeadId(person.headid);
                                                                setActionMenuAnchorRect(rect);
                                                            }
                                                        }}
                                                        className="office-head-actions-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
                                                        aria-label="Open office personnel actions"
                                                        title="Actions"
                                                    >
                                                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                            <circle cx="12" cy="5" r="2" />
                                                            <circle cx="12" cy="12" r="2" />
                                                            <circle cx="12" cy="19" r="2" />
                                                        </svg>
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
                            key={person.headid}
                            className={`group relative flex flex-col justify-between rounded-2xl bg-white shadow-2xs h-full min-h-0 transition-all duration-200 ${
                                isSelected
                                    ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                                    : deleteMode
                                        ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                                        : 'border border-slate-200/90 app-card-hover'
                            }`}
                        >
                            <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-1.5 min-h-0 overflow-hidden">
                                {/* Card Top: Status Badge & Option Menu */}
                                <div className="flex items-center justify-between gap-2 shrink-0">
                                    {deleteMode ? (
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => handleCheckboxChange(person.headid, e.target.checked)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                        />
                                    ) : (
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide border ${statusClass}`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${isAssigned ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                                }`} />
                                            {isAssigned ? 'Assigned' : 'Unassigned'}
                                        </span>
                                    )}

                                    {!deleteMode && isAdmin && (
                                        <div className="relative">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    const isOpen = actionMenuHeadId === person.headid;
                                                    if (isOpen) {
                                                        setActionMenuHeadId(null);
                                                        setActionMenuAnchorRect(null);
                                                    } else {
                                                        setActionMenuHeadId(person.headid);
                                                        setActionMenuAnchorRect(rect);
                                                    }
                                                }}
                                                className="office-head-actions-button inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-2xs"
                                                aria-label="Open office personnel actions"
                                                title="Actions"
                                            >
                                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <circle cx="12" cy="5" r="2" />
                                                    <circle cx="12" cy="12" r="2" />
                                                    <circle cx="12" cy="19" r="2" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Profile Section */}
                                <div
                                    onClick={() => {
                                        if (deleteMode) toggleHeadSelection(person.headid);
                                        else openDetails(person, assignedOffices);
                                    }}
                                    className="cursor-pointer group/content min-h-0 flex-1 flex flex-col justify-center"
                                    title="Click to view details and assigned offices"
                                >
                                    <div className="flex items-center gap-2 sm:gap-2.5">
                                        <SmartUserAvatar
                                            user={person}
                                            src={profilePicUrl}
                                            fullName={fullName}
                                            size="h-8 w-8 sm:h-9 sm:w-9"
                                            textSize="text-[11px] sm:text-xs font-bold"
                                            ring="ring-2 ring-slate-100 shadow-xs"
                                        />

                                        {/* Name & Role */}
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 truncate group-hover/content:text-blue-600 transition-colors leading-tight">
                                                {fullName}
                                            </h3>
                                            <div className="mt-0.5">
                                                <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-emerald-800 border border-emerald-200/60 uppercase">
                                                    {person.Position || 'Office Personnel'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Email Strip */}
                                    <div className="mt-1 sm:mt-1.5 flex items-center gap-1.5 rounded-lg bg-slate-50/80 px-2 py-0.5 border border-slate-100 text-[9px] sm:text-[10px] text-slate-600 group-hover/content:bg-slate-100/70 transition-colors shrink-0">
                                        <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span className="truncate font-medium">{email || 'No email registered'}</span>
                                    </div>
                                </div>

                                {/* Assigned Office(s) Footer */}
                                <div className="mt-0.5 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1.5 shrink-0">
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                                            Assigned Office(s)
                                        </div>
                                        {assignedOffices.length > 0 ? (
                                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-800 truncate" title={assignedOffices.map(o => o.officename || o.officename).join(', ')}>
                                                <svg className="w-3 h-3 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                </svg>
                                                <span className="truncate">
                                                    {assignedOffices[0].officename || assignedOffices[0].officename || `Office #${assignedOffices[0].id || assignedOffices[0].officeid}`}
                                                    {assignedOffices.length > 1 && ` (+${assignedOffices.length - 1})`}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] sm:text-[11px] text-slate-400 italic">Not assigned to any office</span>
                                        )}
                                    </div>

                                    {!deleteMode && (
                                        <div className="flex items-center gap-1">
                                            {isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setScopeModalPerson(person);
                                                        setIsScopeModalOpen(true);
                                                    }}
                                                    className="shrink-0 rounded-lg px-2 py-0.5 text-[9px] sm:text-[10px] font-bold transition flex items-center gap-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/80 cursor-pointer"
                                                    title="Assign Areas, Sub Areas, or Standards"
                                                >
                                                    <Layers className="w-2.5 h-2.5" />
                                                    <span>Scope</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openDetails(person, assignedOffices);
                                                }}
                                                className="shrink-0 rounded-lg px-2 py-0.5 text-[9px] sm:text-[10px] font-bold transition flex items-center gap-1 bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60 cursor-pointer"
                                            >
                                                Details
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="pt-1">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={(p) => setCurrentPage(p)}
                    fixed={true}
                    showWhenSinglePage={true}
                />
            </div>

            {/* Portal actions menu to avoid clipping inside list/card containers */}
            {isAdmin && actionMenuHeadId && actionMenuAnchorRect && typeof document !== 'undefined' && (() => {
                const menuPerson = officeHeads.find((h) => String(h.headid) === String(actionMenuHeadId))
                    || filteredOfficeHeads.find((h) => String(h.headid) === String(actionMenuHeadId));

                if (!menuPerson) return null;

                const zoom = parseFloat(getComputedStyle(document.body).zoom) || 1;
                const menuWidth = 192;
                const viewportRight = (window.innerWidth / zoom) - 8;
                const desiredLeft = (actionMenuAnchorRect.right / zoom) - menuWidth;
                const left = Math.min(desiredLeft, viewportRight - menuWidth);
                const top = (actionMenuAnchorRect.bottom / zoom) + 4;

                return createPortal(
                    <div
                        className="office-head-actions-menu"
                        style={{ position: 'fixed', left: Math.max(8, left), top, zIndex: 9999 }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuHeadId(null);
                                    setActionMenuAnchorRect(null);
                                    openEdit(menuPerson);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
                            >
                                <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit Personnel</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuHeadId(null);
                                    setActionMenuAnchorRect(null);
                                    setScopeModalPerson(menuPerson);
                                    setIsScopeModalOpen(true);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition whitespace-nowrap cursor-pointer"
                            >
                                <Layers className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span>Assign Scope</span>
                            </button>
                            <button
                                type="button"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    setActionMenuHeadId(null);
                                    setActionMenuAnchorRect(null);
                                    await handleDeleteHead(menuPerson);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap"
                            >
                                <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                </svg>
                                <span>Delete Personnel</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                );
            })()}

            <OfficeHeaddetails
                visible={isDetailsOpen}
                onClose={closeDetails}
                head={detailsHead}
                offices={detailsOffices}
                onAssignScope={isAdmin ? (person) => {
                    closeDetails();
                    setScopeModalPerson(person);
                    setIsScopeModalOpen(true);
                } : null}
            />

            {/* Edit modal */}
            <EditOfficeHeadModal
                visible={isEditModalOpen}
                onClose={closeEdit}
                head={selectedHead}
                onSave={handleSave}
            />

            {/* Scope Assignment Modal */}
            {isScopeModalOpen && scopeModalPerson && (
                <AssignPersonnelScopeModal
                    isOpen={isScopeModalOpen}
                    onClose={() => {
                        setIsScopeModalOpen(false);
                        setScopeModalPerson(null);
                    }}
                    personnel={scopeModalPerson}
                    onSuccess={() => {
                        fetchOfficeHeads(true);
                    }}
                />
            )}
        </div>
    );
});

export default OfficeHeadP;
