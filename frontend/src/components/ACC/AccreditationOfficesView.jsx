import React, { useState, useMemo, useEffect } from 'react';
import { Search, GraduationCap, Building2, User, MoreVertical, LayoutGrid, List, Plus, Trash2, GripVertical } from 'lucide-react';
import { isAcademicEntity } from '../../utils/entityHelpers';
import Pagination from '../Pagination/Pagination';
import CustomDropdown from '../UI/CustomDropdown';
import { formatDateTime } from '../../utils/formatDateTime';
import ViewModeToggle from '../UI/ViewModeToggle';

export default function AccreditationOfficesView({
  offices = [],
  events = [],
  selectedEventId = '',
  onSelectEvent,
  onSelectOffice,
  onAddOffice,
  onEditOffice,
  onDeleteOffice,
  onReorderOffices,
  isAdmin = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeEventTab, setActiveEventTab] = useState(selectedEventId || 'all');
  const [officeTypeFilter, setOfficeTypeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [localOffices, setLocalOffices] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    setLocalOffices(offices || []);
  }, [offices]);

  const formatDateString = (dateStr) => {
    if (!dateStr) return 'Aug 24, 2026';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Aug 24, 2026';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'Aug 24, 2026';
    }
  };

  // Derive unique departments & office types
  const departmentOptions = useMemo(() => {
    const depts = new Set();
    localOffices.forEach(o => {
      if (o.department_name || o.DepartmentCode) {
        depts.add(o.department_name || o.DepartmentCode);
      }
    });
    return Array.from(depts);
  }, [localOffices]);

  const [assignedOfficeIds, setAssignedOfficeIds] = useState(new Set());

  useEffect(() => {
    import('../../utils/api').then(({ requirementsAPI }) => {
      requirementsAPI.getMyAssignments().then(res => {
        if (res && res.success) {
          const ids = new Set();
          (res.data || []).forEach(r => {
            if (r.officeid) ids.add(String(r.officeid));
          });
          (res.officeIds || []).forEach(id => {
            if (id) ids.add(String(id));
          });
          setAssignedOfficeIds(ids);
        }
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  // Filter offices by active event tab, search query, role, and filters
  const filteredOffices = useMemo(() => {
    let currentUser = null;
    try {
      const stored = localStorage.getItem('user');
      currentUser = stored ? JSON.parse(stored) : null;
    } catch {
      currentUser = null;
    }

    const rId = Number(currentUser?.roleid);
    const rName = String(currentUser?.rolename || currentUser?.rolename || '').toLowerCase();
    const isPersonnelUser = (rId === 2 || rId === 3 || rName.includes('personnel') || rName.includes('office') || rName === 'user' || rName === 'head') && !rName.includes('auditor') && rId !== 4 && rId !== 1 && rName !== 'admin';

    let list = localOffices;

    // Filter by Personnel assignment
    if (isPersonnelUser && currentUser) {
      const uid = String(currentUser.userid ?? currentUser.id ?? '');
      const hid = String(currentUser.headid ?? currentUser.headid ?? '');

      list = list.filter(o => {
        const oid = String(o.id ?? o.officeid ?? '');
        if (assignedOfficeIds.has(oid)) return true;

        if (Array.isArray(o.heads) && o.heads.length > 0) {
          const matchedHead = o.heads.some(h => {
            if (uid && (String(h.userid ?? '') === uid || String(h.userid ?? '') === uid)) return true;
            if (hid && (String(h.headid ?? '') === hid || String(h.headid ?? '') === hid)) return true;
            const headName = String(h.full_name || `${h.firstname || ''} ${h.lastname || ''}`).toLowerCase().trim();
            const userFirst = String(currentUser.firstname || currentUser.firstname || '').toLowerCase().trim();
            const userLast = String(currentUser.lastname || currentUser.lastname || '').toLowerCase().trim();
            if (userFirst && userLast && headName) {
              if (headName.includes(userFirst) && headName.includes(userLast)) return true;
            } else if (userFirst && headName && headName.includes(userFirst)) {
              return true;
            }
            return false;
          });
          if (matchedHead) return true;
        }

        if (hid) {
          if (String(o.headid ?? '') === hid) return true;
          if (Array.isArray(o.head_ids) && o.head_ids.some(id => String(id) === hid)) return true;
        }

        if (o.head_name && o.head_name !== 'Unassigned' && o.head_name !== 'unassigned') {
          const headName = String(o.head_name).toLowerCase().trim();
          const userFirst = String(currentUser.firstname || currentUser.firstname || '').toLowerCase().trim();
          const userLast = String(currentUser.lastname || currentUser.lastname || '').toLowerCase().trim();
          if (userFirst && userLast) {
            if (headName.includes(userFirst) && headName.includes(userLast)) return true;
          } else if (userFirst && headName && headName.includes(userFirst)) {
            return true;
          }
        }

        return false;
      });
    }

    // Filter by Event Tab
    if (activeEventTab && activeEventTab !== 'all') {
      list = list.filter(o => String(o.eventid || o.eventid) === String(activeEventTab));
    }

    // Filter by Office Type
    if (officeTypeFilter !== 'all') {
      if (officeTypeFilter === 'academic') {
        list = list.filter(o => isAcademicEntity(o));
      } else if (officeTypeFilter === 'non-academic') {
        list = list.filter(o => !isAcademicEntity(o));
      }
    }

    // Filter by Department
    if (departmentFilter !== 'all') {
      list = list.filter(o => (o.department_name || o.DepartmentCode) === departmentFilter);
    }

    // Filter by Status
    if (statusFilter !== 'all') {
      list = list.filter(o => {
        const reqCount = Number(o.totalrequirements || 0);
        const rawPct = Number(o.compliancepercent ?? o.compliancepercent ?? o.compliance_percentage ?? o.compliancePercentage ?? 0);
        const pct = isNaN(rawPct) ? 0 : rawPct;
        if (statusFilter === 'no_standards') return reqCount === 0;
        if (reqCount === 0) return false;
        if (statusFilter === 'complied') return pct >= 100 || o.overallstatus === 'Complied' || o.overallstatus === 'Complied';
        if (statusFilter === 'partial') return (pct > 0 && pct < 100) || o.overallstatus === 'Partially Complied' || o.overallstatus === 'Partially Complied';
        if (statusFilter === 'not') return pct === 0 && (o.overallstatus === 'Not Complied' || o.overallstatus === 'Not Complied' || !o.overallstatus);
        return true;
      });
    }

    // Filter by Search Query
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(o =>
        String(o.officename || o.officename || '').toLowerCase().includes(q) ||
        String(o.DepartmentCode || o.department_name || '').toLowerCase().includes(q) ||
        String(o.eventcode || o.eventname || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [localOffices, activeEventTab, officeTypeFilter, departmentFilter, statusFilter, searchTerm, assignedOfficeIds]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeEventTab, officeTypeFilter, departmentFilter, statusFilter, searchTerm]);

  const totalPages = Math.ceil(filteredOffices.length / itemsPerPage) || 1;
  const paginatedOffices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOffices.slice(start, start + itemsPerPage);
  }, [filteredOffices, currentPage, itemsPerPage]);

  // Drag and Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...localOffices];
    const [movedItem] = updated.splice(draggedIdx, 1);
    updated.splice(targetIdx, 0, movedItem);

    setLocalOffices(updated);
    setDraggedIdx(null);
    setDragOverIdx(null);

    if (onReorderOffices) {
      onReorderOffices(updated);
    }
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans p-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Programs & Offices</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">Manage your Programs & Offices.</p>
        </div>

        <div className="flex items-center gap-2.5">
          {onDeleteOffice && (
            <button
              type="button"
              onClick={onDeleteOffice}
              className="px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 font-extrabold text-xs hover:bg-rose-100 transition-all cursor-pointer"
            >
              Delete
            </button>
          )}

          {onAddOffice && (
            <button
              type="button"
              onClick={onAddOffice}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search offices..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-full pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none shadow-2xs"
          />
        </div>

        {/* Dropdown Filters & Grid View Toggles */}
        <div className="flex items-center gap-3 shrink-0">
          <CustomDropdown
            value={officeTypeFilter}
            onChange={setOfficeTypeFilter}
            options={[
              { value: 'all', label: 'All Office Types' },
              { value: 'academic', label: 'Academic Programs' },
              { value: 'non-academic', label: 'Non-Academic Offices' },
            ]}
            minWidth="min-w-[146px]"
            size="sm"
          />

          <CustomDropdown
            value={departmentFilter}
            onChange={setDepartmentFilter}
            options={[
              { value: 'all', label: 'All Departments' },
              ...departmentOptions.map((dept) => ({ value: dept, label: dept })),
            ]}
            minWidth="min-w-[146px]"
            size="sm"
          />

          <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {localOffices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center my-auto shadow-2xs">
          <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Programs or Offices Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">There are no programs or offices matching the selected accreditation tab or filter criteria.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col h-full">
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-2 sm:gap-2.5 lg:gap-3 flex-1 min-h-0 h-full p-1' : 'space-y-3 pt-1 pb-1 overflow-y-auto flex-1'}>
            {paginatedOffices.map((office, idx) => {
              const officeid = office.officeid || office.id;
              const isAcademic = isAcademicEntity(office);

              const reqCount = Number(office.totalrequirements || 0);
              const rawPct = Number(office.compliancepercent ?? office.compliancepercent ?? office.compliance_percentage ?? office.compliancePercentage ?? 0);
              const compliancePct = isNaN(rawPct) ? 0 : rawPct;
              const statusLabel = reqCount === 0
                ? 'No Standards'
                : (office.overallstatus || (compliancePct >= 100 ? 'Complied' : compliancePct > 0 ? 'Partially Complied' : 'Not Complied'));
              const statusBadgeClass = reqCount === 0 || statusLabel === 'No Standards'
                ? 'bg-slate-100 text-slate-600 border-slate-200'
                : (compliancePct >= 100 || statusLabel === 'Complied')
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : (compliancePct > 0 || statusLabel === 'Partially Complied')
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200';

              const isDraggingThis = draggedIdx === idx;
              const isDragOverThis = dragOverIdx === idx;

              return (
                <div
                  key={officeid}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelectOffice && onSelectOffice(office)}
                  className={`bg-white border rounded-2xl p-2.5 sm:p-3 shadow-2xs app-card-hover cursor-pointer group relative h-full min-h-0 flex flex-col justify-between ${
                    isDraggingThis ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/20 scale-[0.98]' :
                    isDragOverThis ? 'border-blue-500 ring-2 ring-blue-400/50 shadow-lg scale-[1.01]' :
                    'border-slate-200'
                  }`}
                >
                  {/* Drag Grip Handle */}
                  <div 
                    className="absolute top-2.5 right-2.5 text-slate-300 group-hover:text-slate-500 cursor-grab active:cursor-grabbing p-0.5 rounded-md hover:bg-slate-100 transition-colors"
                    title="Drag to reorder"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>

                  {/* Header Row */}
                  <div className="flex items-start gap-2.5 pr-5 min-h-0">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                      isAcademic ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                      {isAcademic ? <GraduationCap className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-xs sm:text-[13px] font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate leading-tight">
                        {office.officename || office.officename}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate max-w-[110px]">
                          {office.eventcode || office.eventcode || (office.eventname ? String(office.eventname).split(' ')[0] : 'PAASCU-COPY')}
                        </span>
                        <span className="text-slate-300 shrink-0">•</span>
                        <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">
                          {office.department_name || office.DepartmentCode || (isAcademic ? 'Academic' : 'Institution-wide')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Type Badge */}
                  <div className="mt-1 shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                      isAcademic
                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    }`}>
                      {isAcademic ? 'Academic' : 'Non-Academic'}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-1.5 mt-1 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500 shrink-0">
                    <div>
                      <span className="block text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400">CREATED</span>
                      <span className="font-semibold text-slate-700 truncate block">{formatDateString(office.createdat || office.createdat)}</span>
                    </div>
                    <div>
                      <span className="block text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400">UPDATED</span>
                      <span className="font-semibold text-slate-700 truncate block">{formatDateString(office.updatedat || office.updatedat)}</span>
                    </div>
                  </div>

                  {/* Requirements & Compliance Bar */}
                  <div className="mt-1 pt-1.5 border-t border-slate-100 shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-slate-600">
                        {reqCount} requirements
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${statusBadgeClass}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          compliancePct >= 100 ? 'bg-emerald-500' : compliancePct > 0 ? 'bg-amber-500' : 'bg-rose-500'
                        }`} />
                        {statusLabel}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            compliancePct >= 100 ? 'bg-emerald-500' : compliancePct > 0 ? 'bg-amber-400' : 'bg-rose-500'
                          }`}
                          style={{ width: `${compliancePct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-700 font-mono w-8 text-right">
                        {compliancePct % 1 === 0 ? compliancePct.toFixed(0) : compliancePct.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Personnel Section Footer */}
                  <div className="mt-1 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] shrink-0">
                    <div>
                      <span className="block text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">Personnel</span>
                      <div className="flex items-center gap-1">
                        <div className="h-5 w-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500">
                          <User className="h-3 w-3" />
                        </div>
                        <span className="font-semibold text-slate-600 truncate max-w-[130px]">
                          {office.head_name || office.HeadName || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Pagination Control */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            fixed={true}
            showWhenSinglePage={true}
          />
        </div>
      )}
    </div>
  );
}
