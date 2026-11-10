import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Search, GraduationCap, Building2, LayoutGrid, List, Plus, Trash2, MoreVertical, Edit2, Layers, X } from 'lucide-react';
import AddMasterListModal from '../components/MasterList/AddMasterListModal';
import EditMasterListModal from '../components/MasterList/EditMasterListModal';
import Pagination from '../components/Pagination/Pagination';
import NotificationToast from '../components/Notification/NotificationToast';
import CustomDropdown from '../components/UI/CustomDropdown';
import { departmentsAPI, masterlistAPI, usersAPI } from '../utils/api';
import { formatDateTime } from '../utils/formatDateTime';
import { MasterListSkeleton } from '../components/UI/Skeleton';
import { useLiveRefresh } from '../utils/liveSync';
import { useModal } from '../components/UI/ModalProvider';
import ServerOfflineState from '../components/UI/ServerOfflineState';
import ViewModeToggle from '../components/UI/ViewModeToggle';
import { isAcademicEntity } from '../utils/entityHelpers';

const DEFAULT_DEPARTMENTS = [];
const ITEMS_PER_PAGE = 12;

export default function MasterList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('masterlist_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('masterlist_view_mode', mode);
    } catch {}
  };
  const [deleteMode, setDeleteMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);
  const [loadingItems, setLoadingItems] = useState(true);
  const [isNoticeVisible, setIsNoticeVisible] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const { showConfirm } = useModal();

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await usersAPI.getLoggedInUser();
        if (response?.success) setCurrentUser(response.user);
      } catch (error) {
        console.error('Error fetching current user:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  const isAdmin = currentUser?.rolename === 'admin' || currentUser?.roleid === 1;

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && !e.target.closest('.masterlist-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const [serverError, setServerError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const loadMasterList = useCallback(async (isRetry = false) => {
    try {
      if (isRetry) setIsRetrying(true);
      else setLoadingItems(true);
      setServerError(null);
      const response = await masterlistAPI.getAll();
      setItems(response.data || response);
      setServerError(null);
    } catch (error) {
      console.error('Failed to load master list items:', error);
      if (error.response?.status === 429) {
        setNotice('Rate limit exceeded (Max 30 requests/min). Please try again later.');
      } else if (!error.response || error.code === 'ERR_NETWORK' || error.message?.toLowerCase().includes('network error') || error.message?.toLowerCase().includes('failed to fetch')) {
        setServerError('Server Offline');
      } else {
        setServerError(error.response?.data?.message || 'Failed to load master list items.');
      }
    } finally {
      setLoadingItems(false);
      setIsRetrying(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await departmentsAPI.getAll();
      setDepartments(response.data || response);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  }, []);

  useEffect(() => {
    loadMasterList();
    loadDepartments();
  }, [loadMasterList, loadDepartments]);

  // Live syncing on mutations / window focus
  useLiveRefresh(loadMasterList);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    setIsNoticeVisible(true);
    const hideTimer = window.setTimeout(() => setIsNoticeVisible(false), 1500);
    const clearTimer = window.setTimeout(() => setNotice(''), 1800);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [notice]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, typeFilter, departmentFilter, viewMode]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesSearch = !term || item.name.toLowerCase().includes(term) || item.type.toLowerCase().includes(term) || (item.description || '').toLowerCase().includes(term);
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesDepartment = departmentFilter === 'all' || String(item.departmentid ?? '') === departmentFilter;
      return matchesSearch && matchesType && matchesDepartment;
    });

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, departmentFilter, searchTerm, typeFilter]);

  const itemsPerPage = viewMode === 'list' ? 30 : 12;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);
  const visibleItems = paginatedItems;

  const renderItemIcon = (itemOrType) => {
    const isAcademic = typeof itemOrType === 'object' && itemOrType !== null
      ? isAcademicEntity(itemOrType)
      : isAcademicEntity({ type: itemOrType });
    if (isAcademic) {
      return (
        <div className="h-9 w-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 border border-cyan-100 shadow-2xs">
          <GraduationCap className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
        <Building2 className="h-5 w-5" />
      </div>
    );
  };

  const handleAddItem = async (newItem) => {
    try {
      const response = await masterlistAPI.addItem(newItem);
      const addedItem = response.data || response;
      setItems((prev) => [addedItem, ...prev]);
      setNotice(`${newItem.name} added to master list.`);
      setCurrentPage(1);
      setShowAddModal(false);
    } catch (error) {
      console.error('Failed to add master list item:', error);
      if (error.response?.status === 429) {
        setNotice('Rate limit exceeded (Max 30 requests/min). Please try again later.');
      } else {
        setNotice('Failed to add item.');
      }
    }
  };

  const handleEditItem = async (updatedFields) => {
    if (!editItem) return;
    try {
      const response = await masterlistAPI.updateItem(editItem.id, updatedFields);
      const updated = response.data || response;
      setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
      setNotice(`"${updated.name}" updated successfully.`);
      setEditItem(null);
    } catch (error) {
      console.error('Failed to update master list item:', error);
      setNotice('Failed to update item.');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      setDeleteLoading(true);
      await masterlistAPI.deleteItem(deleteTarget.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setNotice(`"${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete master list item:', error);
      setNotice('Failed to delete item.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showConfirm(`Are you sure you want to delete ${selectedIds.length} selected item(s)?`);
    if (!confirmed) return;

    try {
      setDeleteLoading(true);
      const res = await (masterlistAPI.deleteMultiple ? masterlistAPI.deleteMultiple(selectedIds) : masterlistAPI.bulkDelete(selectedIds));
      if (res && res.success === false) {
        throw new Error(res.message || 'Failed to delete selected items.');
      }
      setSelectedIds([]);
      setDeleteMode(false);
      setNotice(`Successfully deleted ${selectedIds.length} item(s).`);
      setIsNoticeVisible(true);
      await loadMasterList();
    } catch (err) {
      console.error('Failed to bulk delete master list items:', err);
      setNotice(err?.response?.data?.message || err?.message || 'Failed to delete selected items.');
      setIsNoticeVisible(true);
    } finally {
      setDeleteLoading(false);
    }
  };

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'Academic Program', label: 'Academic Programs' },
    { value: 'Non-Academic Office', label: 'Non-Academic Offices' },
  ];

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    ...departments.map((department) => ({
      value: String(department.id),
      label: department.name,
    })),
  ];

  return (
    <div className="w-full h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)] flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
      <NotificationToast title="Notice" message={notice} visible={isNoticeVisible} onDismiss={() => setNotice('')} />

      {/* Top Header Card */}
      <div className="px-4 sm:px-6 pt-2 pb-1.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">Master List</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {deleteMode ? 'Select items to delete from master list.' : 'Manage your reusable academic programs and non-academic offices.'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              {deleteMode && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.length === 0 || deleteLoading}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-xs transition-all ${
                    selectedIds.length === 0 || deleteLoading
                      ? 'border-red-200 bg-red-50/50 text-red-400 cursor-not-allowed'
                      : 'border-red-600 bg-red-600 text-white hover:bg-red-700 active:scale-95 shadow-red-500/20 cursor-pointer'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleteLoading ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (deleteMode) {
                    setDeleteMode(false);
                    setSelectedIds([]);
                    return;
                  }
                  setDeleteMode(true);
                  setSelectedIds([]);
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all cursor-pointer ${
                  deleteMode
                    ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300'
                }`}
              >
                {deleteMode ? <X className="w-3.5 h-3.5" /> : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                {deleteMode ? 'Cancel' : 'Delete Mode'}
              </button>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Program / Office</span>
              </button>
            </div>
          )}
        </div>

        {/* Search, Filters & View Mode Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100">
          <div className="relative w-full sm:w-72 md:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search master list..."
              className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <CustomDropdown
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              minWidth="min-w-[145px]"
              size="sm"
            />

            <CustomDropdown
              value={departmentFilter}
              onChange={setDepartmentFilter}
              options={departmentOptions}
              minWidth="min-w-[160px]"
              size="sm"
            />

            <ViewModeToggle viewMode={viewMode} onChange={handleSetViewMode} />
          </div>
        </div>
      </div>

      <div className={`flex-1 px-4 sm:px-6 pt-1.5 ${viewMode === 'list' ? 'pb-1 sm:pb-1.5' : 'pb-8'} flex flex-col min-h-0 overflow-hidden`}>

        {/* Content Area */}
        <div 
          className={`flex-1 min-h-0 ${viewMode === 'list' && !serverError && filteredItems.length > 0 ? 'app-list-scroll overflow-auto pr-1' : 'flex flex-col h-full overflow-hidden'}`}
        >
          {loadingItems ? (
            <MasterListSkeleton count={9} />
          ) : serverError ? (
            <ServerOfflineState
              onRetry={() => loadMasterList(true)}
              isRetrying={isRetrying}
              title={serverError === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Master List'}
              message={serverError === 'Server Offline' 
                ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                : serverError}
            />
          ) : filteredItems.length === 0 ? (
            <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mb-3">
                <Building2 className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-base font-bold text-slate-800 mb-1">No Items Found</h3>
              <p className="text-xs text-slate-500 max-w-sm mb-4">
                {searchTerm || typeFilter !== 'all' || departmentFilter !== 'all'
                  ? 'No master list items match your current filter or search query.'
                  : 'No programs or offices have been added to the master list yet.'}
              </p>
              {searchTerm || typeFilter !== 'all' || departmentFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setTypeFilter('all');
                    setDepartmentFilter('all');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : isAdmin ? (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm cursor-pointer"
                >
                  <span>+ Add Program / Office</span>
                </button>
              ) : null}
            </div>
          ) : viewMode === 'list' ? (
            <div className="flex flex-col min-w-[760px] pb-12">
              {/* Sticky Header Row matching Programs & Offices */}
              <div className="grid grid-cols-[minmax(220px,1fr)_160px_160px_120px_80px] gap-6 px-6 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs text-xs font-semibold text-slate-700 sticky top-0 z-20 mb-1">
                <div className="flex items-center">Office Name</div>
                <div className="flex items-center">Office Type</div>
                <div className="flex items-center">Department</div>
                <div className="flex items-center">Status</div>
                <div className="flex items-center justify-end">Actions</div>
              </div>

              {/* Rows List */}
              <div className="space-y-1">
                {visibleItems.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isAcademic = isAcademicEntity(item);

                  return (
                    <div
                      key={item.id}
                      onClick={() => deleteMode && toggleSelect(item.id)}
                      className={`rounded-xl bg-white shadow-2xs transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                          : deleteMode
                            ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                            : 'border border-slate-200/90 app-card-hover cursor-pointer'
                      }`}
                    >
                      <div className="grid grid-cols-[minmax(220px,1fr)_160px_160px_120px_80px] items-center gap-6 px-6 py-2">
                        {/* Office / Program Name & Detailed Metadata */}
                        <div className="flex items-center gap-3 min-w-0">
                          {deleteMode && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer shrink-0"
                            />
                          )}
                          {renderItemIcon(item)}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900 truncate leading-snug hover:text-indigo-600 transition-colors">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-medium truncate">
                              <span className="font-semibold text-slate-500 uppercase">{item.department || 'INSTITUTION-WIDE'}</span>
                              <span className="text-slate-300">•</span>
                              <span><span className="font-semibold text-slate-400 uppercase">CREATED:</span> {formatDateTime(item.createdat)}</span>
                              <span className="text-slate-300">•</span>
                              <span><span className="font-semibold text-slate-400 uppercase">UPDATED:</span> {formatDateTime(item.updatedat || item.createdat)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Office Type */}
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isAcademic
                              ? 'bg-blue-50 text-blue-700 border-blue-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {isAcademic ? 'Academic' : 'Non Academic'}
                          </span>
                        </div>

                        {/* Department */}
                        <div className="flex items-center text-xs font-bold text-slate-700">
                          {item.department ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                              {item.department}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end relative">
                          {!deleteMode && (
                            <div className="relative masterlist-menu-container">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === item.id ? null : item.id);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
                                aria-label="Options"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>

                              {openMenuId === item.id && (
                                <div
                                  className="absolute right-0 top-9 z-30 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-fadeIn"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditItem(item);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-indigo-500" />
                                    <span>Edit Item</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteTarget(item);
                                      setOpenMenuId(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5 lg:gap-3 flex-1 min-h-0 h-full p-1 overflow-hidden">
              {paginatedItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isAcademic = isAcademicEntity(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => deleteMode && toggleSelect(item.id)}
                    className={`relative rounded-2xl bg-white p-3 sm:p-3.5 shadow-2xs h-full min-h-0 flex flex-col justify-between transition-all duration-200 ${
                      isSelected
                        ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                        : deleteMode
                          ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                          : 'border border-slate-200/90 app-card-hover cursor-pointer'
                    }`}
                  >
                    {deleteMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-3 h-3.5 w-3.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500 z-10 cursor-pointer"
                      />
                    )}

                    {/* Header Row & 3-dot Menu */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 pr-2">
                        {renderItemIcon(item)}
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 truncate leading-tight">
                            {item.name}
                          </h3>
                          <div className="mt-0.5 text-[10px] text-slate-500 truncate font-semibold uppercase tracking-wider">
                            {item.department || 'Institution-wide'}
                          </div>
                        </div>
                      </div>

                      {!deleteMode && (
                        <div className="relative masterlist-menu-container">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === item.id ? null : item.id);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-400 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-2xs focus:outline-none cursor-pointer"
                            aria-label="Options"
                            title="Options"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </button>

                          {openMenuId === item.id && (
                            <div
                              className="absolute right-0 top-6 z-30 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg animate-fadeIn"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setEditItem(item);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              >
                                <Edit2 className="h-3.5 w-3.5 text-indigo-500" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteTarget(item);
                                  setOpenMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Metadata Dates */}
                    <div className="my-2 border-t border-slate-100 pt-2 flex flex-col gap-1 text-[10px] text-slate-500">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-400 uppercase tracking-wider">Created</span>
                        <span className="font-medium text-slate-600 truncate ml-2">{formatDateTime(item.createdat)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-400 uppercase tracking-wider">Updated</span>
                        <span className="font-medium text-slate-600 truncate ml-2">{formatDateTime(item.updatedat || item.createdat)}</span>
                      </div>
                    </div>

                    {/* Footer Badge */}
                    <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        isAcademic
                          ? 'bg-blue-50 text-blue-700 border-blue-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {isAcademic ? 'Academic' : 'Non-Academic'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[100px]">
                        {item.code || ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom Pagination (Grid and List mode) */}
        {!loadingItems && !serverError && filteredItems.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            fixed={true}
            showWhenSinglePage={true}
          />
        )}
      </div>

      <AddMasterListModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddItem}
        departments={departments}
      />

      <EditMasterListModal
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        onSubmit={handleEditItem}
        item={editItem}
        departments={departments}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">Delete Item</h3>
            <p className="mt-2 text-xs text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-800">&ldquo;{deleteTarget.name}&rdquo;</span> from the master list? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deleteLoading}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
