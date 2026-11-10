import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Building2,
  ChevronRight,
  ArrowLeft,
  Search,
  Award,
  Users,
  FileText,
  ChevronDown,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { eventDepartmentsAPI, officesAPI } from '../../utils/api';
import { useModal } from '../UI/ModalProvider';
import { isAcademicEntity } from '../../utils/entityHelpers';
import { API_BASE_URL } from '../../utils/apiBase';
import userIcon from '../../assets/images/user.svg';
import DepartmentLevelDropdown from './DepartmentLevelDropdown';
import SmartUserAvatar from '../UI/SmartUserAvatar';

const ACCREDITATION_LEVELS = ['None', 'Candidate', 'Level I', 'Level II', 'Level III', 'Level IV'];

const FIXED_DEPARTMENTS = [
  { id: 1, name: 'SBIT' },
  { id: 2, name: 'SHTM' },
  { id: 3, name: 'SARFAID' },
  { id: 4, name: 'SSLATE' },
  { id: 5, name: 'IBED' },
];

export default function DepartmentsView({
  events = [],
  offices = [],
  selectedEventId,
  onSelectEvent,
  onSelectOffice,
  currentUser,
  onRefresh,
  loading = false,
}) {
  const { showAlert } = useModal();

  const [activeEventId, setActiveEventId] = useState(() => {
    return selectedEventId && selectedEventId !== 'all'
      ? selectedEventId
      : localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id') || '';
  });
  const [selectedDeptId, setSelectedDeptId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingProgramLevel, setUpdatingProgramLevel] = useState(null);
  const [viewSection, setViewSection] = useState('academic'); // 'academic' or 'non-academic'

  const rolename = String(currentUser?.rolename || '').toLowerCase();
  const roleid = Number(currentUser?.roleid);
  const isAdmin = (roleid === 1 || rolename === 'admin') && !rolename.includes('auditor');

  // Sync active event if prop changes or auto-select first active event / persisted event
  useEffect(() => {
    if (!events || events.length === 0) return;

    const savedId = localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id');
    const validPassed = events.find((e) => String(e.eventid ?? e.id) === String(selectedEventId));
    const validSaved = events.find((e) => String(e.eventid ?? e.id) === String(savedId));
    const currentValid = events.find((e) => String(e.eventid ?? e.id) === String(activeEventId));
    
    const target = validPassed || currentValid || validSaved || events[0];
    const targetId = String(target.eventid ?? target.id);

    if (activeEventId !== targetId) {
      setActiveEventId(targetId);
      localStorage.setItem('acc_selected_event_id', targetId);
      localStorage.setItem('selected_audit_event_id', targetId);
      if (onSelectEvent) onSelectEvent(targetId);
    }
  }, [selectedEventId, events, activeEventId, onSelectEvent]);

  // Handle program accreditation level change
  const handleProgramLevelChange = async (newLevelOrEvent, program) => {
    if (newLevelOrEvent && typeof newLevelOrEvent.stopPropagation === 'function') {
      newLevelOrEvent.stopPropagation();
    }
    const newLevel = typeof newLevelOrEvent === 'string' ? newLevelOrEvent : newLevelOrEvent?.target?.value;
    const progId = program.id ?? program.officeid;

    if (!newLevel || newLevel === (program.accreditationlevel || 'None')) return;

    try {
      setUpdatingProgramLevel(progId);
      await officesAPI.updateLevel(progId, newLevel);
      if (onRefresh) onRefresh();
      if (showAlert) {
        showAlert(`Updated ${program.officename || program.officename} to ${newLevel}`, 'success');
      }
    } catch (err) {
      console.error('Failed to update program accreditation level:', err);
      if (showAlert) {
        showAlert('Failed to update program accreditation level', 'error');
      }
    } finally {
      setUpdatingProgramLevel(null);
    }
  };

  // Filter offices by active event
  const officesInEvent = useMemo(() => {
    if (!activeEventId || activeEventId === 'all') return offices;
    return offices.filter(
      (o) => String(o.eventid ?? o.eventid ?? '') === String(activeEventId)
    );
  }, [offices, activeEventId]);

  // Is academic office check
  const isAcademicOffice = (o) => {
    return isAcademicEntity(o);
  };

  // Split into academic and non-academic
  const academicOffices = useMemo(() => {
    return officesInEvent.filter(isAcademicOffice);
  }, [officesInEvent]);

  const nonAcademicOffices = useMemo(() => {
    return officesInEvent.filter((o) => !isAcademicOffice(o));
  }, [officesInEvent]);

  // Group academic offices by department - All 5 fixed departments ALWAYS present
  const departmentsList = useMemo(() => {
    const map = new Map();

    // 1. Always seed with ALL 5 predefined institutional departments
    for (const fd of FIXED_DEPARTMENTS) {
      map.set(String(fd.id), {
        deptId: fd.id,
        deptCode: fd.name,
        deptName: fd.name,
        programs: [],
      });
    }

    // 2. Distribute academic programs into their predefined departments
    for (const office of academicOffices) {
      if (!office.departmentid) continue; // Never create an unassigned/empty department card
      const deptKey = String(office.departmentid);
      if (map.has(deptKey)) {
        map.get(deptKey).programs.push(office);
      }
    }

    let list = Array.from(map.values());

    // Search query
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((dept) => {
        const matchDept =
          dept.deptCode.toLowerCase().includes(q) ||
          dept.deptName.toLowerCase().includes(q);
        const matchPrograms = dept.programs.some((p) =>
          (p.officename || p.officename || '').toLowerCase().includes(q) ||
          (p.accreditationlevel || '').toLowerCase().includes(q)
        );
        return matchDept || matchPrograms;
      });
    }

    return list;
  }, [academicOffices, searchTerm]);

  // Currently selected department for drill-down
  const selectedDepartment = useMemo(() => {
    if (!selectedDeptId) return null;
    return departmentsList.find(
      (d) => String(d.deptId ?? d.deptCode) === String(selectedDeptId)
    );
  }, [selectedDeptId, departmentsList]);

  // Compliance status helper
  const getStatusBadge = (status, totalReqs = null) => {
    if (totalReqs !== null && Number(totalReqs) === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> No Standards
        </span>
      );
    }
    const s = String(status || '').toLowerCase();
    if (s.includes('no standard') || s.includes('no req') || s === 'n/a' || s === 'empty') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> No Standards
        </span>
      );
    }
    if (s.includes('complied') && !s.includes('not') && !s.includes('partial')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
          <CheckCircle2 className="h-3 w-3" /> Complied
        </span>
      );
    }
    if (s.includes('partial')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
          <Clock className="h-3 w-3" /> Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full">
        <AlertCircle className="h-3 w-3" /> Incomplete
      </span>
    );
  };

  // Header event switch handler
  const handleEventTabClick = (eventid) => {
    setActiveEventId(eventid);
    setSelectedDeptId(null);
    localStorage.setItem('acc_selected_event_id', String(eventid));
    localStorage.setItem('selected_audit_event_id', String(eventid));
    if (onSelectEvent) onSelectEvent(eventid);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/60 overflow-hidden">
      {/* ── TOP OPTIONS TABS: Event Selector (Matching User Photo 2) ── */}
      <div className="bg-white border-b border-slate-200 px-6 pt-3 shrink-0 shadow-2xs">
        <div className="flex items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              Academic Departments
            </h1>
            <p className="text-xs text-slate-500">
              Department-level accreditation structures and academic programs
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search departments or programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-9 pr-3 text-xs rounded-lg border border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-56 transition"
              />
            </div>
          </div>
        </div>

        {/* Event Horizontal Tabs (Photo 2) */}
        <div className="flex items-center gap-6 overflow-x-auto border-t border-slate-100 pt-1 -mb-[1px] scrollbar-none">
          {events.map((ev) => {
            const evId = String(ev.eventid ?? ev.id);
            const evCode = ev.eventcode || ev.eventname || `Event #${evId}`;
            const isSelected = String(activeEventId) === String(evId);

            return (
              <button
                key={evId}
                type="button"
                onClick={() => handleEventTabClick(evId)}
                className={`pb-2.5 text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                {evCode}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── SECTION NAV (Academic Departments vs Non-Academic Offices) ── */}
      <div className="bg-slate-100/70 border-b border-slate-200/80 px-6 py-2 flex items-center justify-between shrink-0">
        {selectedDepartment ? (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDeptId(null)}
              className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Departments</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-extrabold text-slate-800">
              {selectedDepartment.deptName}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewSection('academic')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewSection === 'academic'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
              <span>Academic Departments ({departmentsList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewSection('non-academic')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewSection === 'non-academic'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Institutional Offices ({nonAcademicOffices.length})</span>
            </button>
          </div>
        )}

        <div className="text-[11px] text-slate-400 font-medium">
          {selectedDepartment
            ? `${selectedDepartment.programs.length} Academic Programs in this Department`
            : viewSection === 'academic'
            ? 'Click any department card to view its programs'
            : 'Non-academic units evaluated independently'}
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <span className="text-xs font-medium">Loading department structures...</span>
          </div>
        ) : selectedDepartment ? (
          /* ── DRILL-DOWN: Programs inside Selected Department ── */
          <div className="space-y-4">
            {/* Department Summary Banner */}
            <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50 via-white to-indigo-50/40 p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      {selectedDepartment.deptName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedDepartment.programs.length}{' '}
                      {selectedDepartment.programs.length === 1 ? 'Program' : 'Programs'}{' '}
                      under this department for this accreditation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <span className="text-xs font-semibold text-slate-500">
                    Academic Programs:
                  </span>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-md">
                    {selectedDepartment.programs.length} Active
                  </span>
                </div>
              </div>
            </div>

            {/* Program Cards Grid inside Department */}
            {selectedDepartment.programs.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <GraduationCap className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No Programs in this Department</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  No academic programs are currently assigned under this department for this accreditation.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedDepartment.programs.map((program) => {
                  const progId = program.id ?? program.officeid;
                  const heads = program.heads || [];
                  const isUpdatingThisProg = updatingProgramLevel === progId;

                  return (
                    <div
                      key={progId}
                      onClick={() => onSelectOffice?.(program)}
                      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Tag & Status */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-md">
                            ACADEMIC PROGRAM
                          </span>
                          {getStatusBadge(program.overallstatus, program.totalrequirements)}
                        </div>

                        {/* Program Name */}
                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {program.officename || program.officename}
                        </h4>

                        {/* Program Accreditation Level Dropdown */}
                        <div
                          className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs font-semibold text-slate-500">
                            Accreditation Level:
                          </span>
                          {isAdmin ? (
                            <DepartmentLevelDropdown
                              value={program.accreditationlevel || 'None'}
                              onChange={(newLevel) => handleProgramLevelChange(newLevel, program)}
                              disabled={isUpdatingThisProg}
                              levels={ACCREDITATION_LEVELS}
                            />
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                              {program.accreditationlevel || 'None'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer Info: Requirements & Heads */}
                      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 font-medium">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span>{program.totalrequirements || 0} Reqs</span>
                        </div>

                        {/* Heads Avatars */}
                        <div className="flex items-center -space-x-1.5">
                          {heads.slice(0, 3).map((h, i) => (
                            <SmartUserAvatar
                              key={h.headid || i}
                              user={h}
                              size="h-6 w-6"
                              textSize="text-[9px] font-bold"
                              ring="border-2 border-white shadow-2xs"
                              title={h.full_name || 'Assigned Head'}
                            />
                          ))}
                          {heads.length > 3 && (
                            <div className="h-6 w-6 rounded-full bg-slate-100 text-[9px] font-bold text-slate-600 flex items-center justify-center border-2 border-white">
                              +{heads.length - 3}
                            </div>
                          )}
                          {heads.length === 0 && (
                            <span className="text-[10px] text-slate-400 italic">No head</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewSection === 'academic' ? (
          /* ── DEPARTMENT CARDS GRID (Matching User Photo 3 Layout) ── */
          departmentsList.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
              <Search className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700">No Matching Departments</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No departments or programs match your search term. Try a different search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
              {departmentsList.map((deptGroup) => {
                const totalPrograms = deptGroup.programs.length;

                return (
                  <div
                    key={deptGroup.deptId || deptGroup.deptCode}
                    onClick={() => setSelectedDeptId(deptGroup.deptId ?? deptGroup.deptCode)}
                    className="group rounded-2xl border border-slate-200/90 bg-white shadow-xs hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    {/* Card Header */}
                    <div className="p-5 pb-4 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-100">
                            DEPARTMENT
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">
                          <GraduationCap className="h-3.5 w-3.5 text-blue-600" />
                          <span>{totalPrograms} {totalPrograms === 1 ? 'Program' : 'Programs'}</span>
                        </span>
                      </div>

                      {/* Department Title */}
                      <h3 className="text-xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                        {deptGroup.deptCode}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                        {deptGroup.deptName}
                      </p>
                    </div>

                    {/* Program Badges Preview */}
                    <div className="p-5 py-3 bg-slate-50/40 flex-1 flex flex-col justify-center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Assigned Programs
                      </div>
                      {totalPrograms === 0 ? (
                        <span className="text-xs text-slate-400 italic">No programs linked yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {deptGroup.programs.slice(0, 3).map((p) => (
                            <span
                              key={p.id ?? p.officeid}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md truncate max-w-[200px]"
                              title={p.officename || p.officename}
                            >
                              <span className="truncate">{p.officename || p.officename}</span>
                              {p.accreditationlevel && p.accreditationlevel !== 'None' && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 shrink-0">
                                  {p.accreditationlevel}
                                </span>
                              )}
                            </span>
                          ))}
                          {totalPrograms > 3 && (
                            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-md">
                              +{totalPrograms - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Open Structure View Link (Photo 3 style) */}
                    <div className="px-5 py-3 bg-white border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Open programs</span>
                      <span className="font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                        <span>View</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* ── NON-ACADEMIC INSTITUTIONAL OFFICES ── */
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 to-slate-50 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-2xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Institutional Units & Support Offices
                  </h3>
                  <p className="text-xs text-slate-500">
                    Non-academic offices evaluated independently of academic departments
                  </p>
                </div>
              </div>
            </div>

            {nonAcademicOffices.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-700">No Non-Academic Offices</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Add non-academic offices (e.g. Registrar, Library) from the Master List.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nonAcademicOffices.map((office) => {
                  const offId = office.id ?? office.officeid;
                  const heads = office.heads || [];

                  return (
                    <div
                      key={offId}
                      onClick={() => onSelectOffice?.(office)}
                      className="group rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            INSTITUTIONAL UNIT
                          </span>
                          {getStatusBadge(office.overallstatus, office.totalrequirements)}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                          {office.officename || office.officename}
                        </h4>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-1 font-medium">
                          <FileText className="h-3.5 w-3.5 text-slate-400" />
                          <span>{office.totalrequirements || 0} Reqs</span>
                        </div>

                        <div className="flex items-center -space-x-1.5">
                          {heads.slice(0, 3).map((h, i) => (
                            <SmartUserAvatar
                              key={h.headid || i}
                              user={h}
                              size="h-6 w-6"
                              textSize="text-[9px] font-bold"
                              ring="border-2 border-white shadow-2xs"
                              title={h.full_name || 'Head'}
                            />
                          ))}
                          {heads.length > 3 && (
                            <div className="h-6 w-6 rounded-full bg-slate-100 text-[9px] font-bold text-slate-600 flex items-center justify-center border-2 border-white">
                              +{heads.length - 3}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
