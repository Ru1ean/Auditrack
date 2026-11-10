import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Search, MoreVertical, X, Building2, GraduationCap, Plus, Edit2, Copy, Trash2, SlidersHorizontal } from 'lucide-react';
import { isAcademicEntity } from '../../utils/entityHelpers';

export default function AccreditationMasterList({
  event,
  areasData = [],
  noAreaCriteriaData = [],
  offices = [],
  onClose,
  onOpenAssignToOffices,
  onSelectOffice,
  onAddArea,
  onEditArea,
  onDeleteArea,
  onAddCriteria,
  onAddRequirement,
  onEditEvent,
  onCopyEvent,
  onDeleteEvent,
  isAdmin = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [officeSearch, setOfficeSearch] = useState('');
  const [activeOfficeTab, setActiveOfficeTab] = useState('All');
  const [expandedAreas, setExpandedAreas] = useState(new Set([1, 2, 5]));
  const [expandedCriteria, setExpandedCriteria] = useState(new Set());
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

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

  const toggleArea = (areaid) => {
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(areaid)) next.delete(areaid);
      else next.add(areaid);
      return next;
    });
  };

  const toggleCriteria = (criteriaid) => {
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(criteriaid)) next.delete(criteriaid);
      else next.add(criteriaid);
      return next;
    });
  };

  // Filter offices by tab and search
  const filteredOffices = useMemo(() => {
    let list = offices || [];
    if (activeOfficeTab === 'Programs') {
      list = list.filter(o => isAcademicEntity(o));
    } else if (activeOfficeTab === 'Offices') {
      list = list.filter(o => !isAcademicEntity(o));
    }

    const q = officeSearch.trim().toLowerCase();
    if (!q) return list;

    return list.filter(o => {
      const name = String(o.officename || o.officename || '').toLowerCase();
      const dept = String(o.department_name || o.DepartmentCode || '').toLowerCase();
      return name.includes(q) || dept.includes(q);
    });
  }, [offices, activeOfficeTab, officeSearch]);

  // Filter areas and criteria by search term
  const filteredAreas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return areasData;

    return areasData.map(area => {
      const areaMatch = String(area.name || '').toLowerCase().includes(q) || String(area.code || '').toLowerCase().includes(q);
      const matchingCriteria = (area.criteria || []).filter(c => {
        const critMatch = String(c.name || '').toLowerCase().includes(q) || String(c.code || '').toLowerCase().includes(q);
        const reqMatch = (c.requirements || []).some(r =>
          String(r.description || r.Description || '').toLowerCase().includes(q) ||
          String(r.code || r.requirementcode || '').toLowerCase().includes(q)
        );
        return critMatch || reqMatch;
      });

      if (areaMatch || matchingCriteria.length > 0) {
        return {
          ...area,
          criteria: areaMatch ? area.criteria : matchingCriteria
        };
      }
      return null;
    }).filter(Boolean);
  }, [areasData, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-2xl shadow-sm overflow-hidden font-sans">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase truncate">
              {event?.eventcode || event?.code || event?.eventname || event?.title || 'PAASCU-COPY'}
            </h1>
            {onOpenAssignToOffices && (
              <button
                type="button"
                onClick={onOpenAssignToOffices}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200 hover:bg-blue-100 transition-colors shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span>ASSIGN TO OFFICES</span>
              </button>
            )}
          </div>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5 truncate">
            {event?.Description || 'Philippine Accrediting Association of Schools, Colleges and Universities (Copy)'}
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[10px]">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
              Created: {formatDateString(event?.createdat || event?.createdat)}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
              Updated: {formatDateString(event?.updatedat || event?.updatedat)}
            </span>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Action Menu (Admin Only) */}
          {isAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-2xs"
                title="Options"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {isHeaderMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 font-medium text-xs text-slate-700">
                  {onEditEvent && (
                    <button
                      onClick={() => { setIsHeaderMenuOpen(false); onEditEvent(event); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                      Edit Event Details
                    </button>
                  )}
                  {onCopyEvent && (
                    <button
                      onClick={() => { setIsHeaderMenuOpen(false); onCopyEvent(event); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-400" />
                      Copy Event
                    </button>
                  )}
                  {onAddArea && (
                    <button
                      onClick={() => { setIsHeaderMenuOpen(false); onAddArea(); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 text-blue-700 flex items-center gap-2"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Area
                    </button>
                  )}
                  {isAdmin && onDeleteEvent && (
                    <button
                      onClick={() => { setIsHeaderMenuOpen(false); onDeleteEvent(event); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2 border-t border-slate-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Event
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Split Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Areas & Hierarchy Tree */}
        <div className="flex-1 flex flex-col border-r border-slate-200 bg-white min-w-0">
          {/* Area Search Bar */}
          <div className="p-4 border-b border-slate-100 bg-white">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search areas, sub areas, or standards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>
          </div>

          {/* Scrollable Tree Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3">
            {/* Area Blocks */}
            {filteredAreas.map((area) => {
              const areaid = area.id || area.areaid;
              const isExpanded = expandedAreas.has(areaid);
              const criteriaList = area.criteria || [];
              const areacode = area.areacode || area.code || '';
              const areaname = area.areaname || area.name || area.title || 'Area';

              return (
                <div key={areaid} className="rounded-xl border border-blue-200/80 bg-white overflow-hidden shadow-2xs">
                  {/* Area Banner Header */}
                  <div
                    onClick={() => toggleArea(areaid)}
                    className="flex items-center justify-between px-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-white/80" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/80" />
                      )}
                      <div className="min-w-0">
                        <h2 className="text-sm font-bold text-white tracking-wide truncate">
                          {areacode ? `${areacode}: ${areaname}` : areaname}
                        </h2>
                        <p className="text-[11px] font-medium text-blue-100/90 mt-0.5">
                          Created: {formatDateString(area.createdat || area.createdat)} Updated: {formatDateString(area.updatedat || area.updatedat)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-white/20 text-white rounded-md backdrop-blur-xs">
                        {criteriaList.length} sub areas
                      </span>
                    </div>
                  </div>

                  {/* Criteria Accordion Content */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-50/50 space-y-2 border-t border-blue-100">
                      {criteriaList.length === 0 ? (
                        <p className="text-xs text-slate-400 italic px-3 py-2">No sub areas defined in this area yet.</p>
                      ) : (
                        criteriaList.map((crit) => {
                          const critId = crit.id || crit.criteriaid;
                          const isCritExpanded = expandedCriteria.has(critId);
                          const reqs = crit.requirements || [];
                          const critCode = crit.criteriacode || crit.code || '';
                          const critName = crit.criterianame || crit.name || crit.title || 'Sub Area';

                          return (
                            <div key={critId} className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                              {/* Criteria Header */}
                              <div
                                onClick={() => toggleCriteria(critId)}
                                className="flex items-center justify-between px-3.5 py-2.5 bg-slate-100/90 hover:bg-slate-200/80 cursor-pointer transition-colors select-none"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {isCritExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                  )}
                                  <span className="text-xs font-bold text-slate-800 truncate">
                                    {critCode ? `${critCode}. ${critName}` : critName}
                                  </span>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-white text-slate-600 rounded border border-slate-200">
                                  {reqs.length + (crit.children || []).reduce((acc, ch) => acc + (ch.requirements || []).length, 0)} reqs
                                </span>
                              </div>

                              {/* Requirements & Subcriteria List */}
                              {isCritExpanded && (
                                <div className="p-2.5 space-y-2 bg-white border-t border-slate-100">
                                  {/* Direct Requirements */}
                                  {reqs.length > 0 && (
                                    <div className="space-y-1.5">
                                      {reqs.map((req) => {
                                        const reqId = req.id || req.requirementid;
                                        const reqCode = req.requirementcode || req.code || req.req_code || `Req #${reqId}`;
                                        const reqTitle = req.RequirementTitle || req.Title || req.title || req.RequirementName || req.description || req.Description || '';

                                        return (
                                          <div
                                            key={reqId}
                                            className="flex items-start justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-300 bg-slate-50/50 transition-all text-xs"
                                          >
                                            <div className="min-w-0 pr-2">
                                              <span className="font-bold text-slate-900 block mb-0.5">
                                                {reqCode}
                                              </span>
                                              {reqTitle && (
                                                <p className="text-slate-600 line-clamp-2 leading-relaxed">
                                                  {reqTitle}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Child Subcriteria */}
                                  {(crit.children || []).length > 0 && (
                                    <div className="space-y-2 pt-1">
                                      {(crit.children || []).map((subCrit) => {
                                        const subCritId = subCrit.id || subCrit.criteriaid;
                                        const isSubCritExpanded = expandedCriteria.has(subCritId);
                                        const subReqs = subCrit.requirements || [];
                                        const subCritCode = subCrit.criteriacode || subCrit.code || '';
                                        const subCritName = subCrit.criterianame || subCrit.name || subCrit.title || 'Sub Area';

                                        return (
                                          <div key={subCritId} className="rounded-lg border border-blue-200 bg-white overflow-hidden shadow-2xs ml-2">
                                            <div
                                              onClick={() => toggleCriteria(subCritId)}
                                              className="flex items-center justify-between px-3 py-2 bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer transition-colors select-none"
                                            >
                                              <div className="flex items-center gap-2 min-w-0">
                                                {isSubCritExpanded ? (
                                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                ) : (
                                                  <ChevronRight className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                )}
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase bg-blue-600 text-white shrink-0 shadow-2xs">
                                                  SUB AREA
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 truncate">
                                                  {subCritCode ? `${subCritCode}. ${subCritName}` : subCritName}
                                                </span>
                                              </div>
                                              <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-white text-blue-700 rounded border border-blue-200">
                                                {subReqs.length} reqs
                                              </span>
                                            </div>

                                            {/* Subcriteria Requirements */}
                                            {isSubCritExpanded && (
                                              <div className="p-2 space-y-1.5 bg-slate-50/40 border-t border-blue-100">
                                                {subReqs.length === 0 ? (
                                                  <p className="text-[11px] text-slate-400 italic px-2 py-1">No requirements in this subcriterion.</p>
                                                ) : (
                                                  subReqs.map((req) => {
                                                    const reqId = req.id || req.requirementid;
                                                    const reqCode = req.requirementcode || req.code || req.req_code || `Req #${reqId}`;
                                                    const reqTitle = req.RequirementTitle || req.Title || req.title || req.RequirementName || req.description || req.Description || '';

                                                    return (
                                                      <div
                                                        key={reqId}
                                                        className="flex items-start justify-between p-2.5 rounded-lg border border-slate-200 hover:border-blue-200 bg-white transition-all text-xs"
                                                      >
                                                        <div className="min-w-0 pr-2">
                                                          <span className="font-bold text-slate-900 block mb-0.5">
                                                            {reqCode}
                                                          </span>
                                                          {reqTitle && (
                                                            <p className="text-slate-600 line-clamp-2 leading-relaxed">
                                                              {reqTitle}
                                                            </p>
                                                          )}
                                                        </div>
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {reqs.length === 0 && (crit.children || []).length === 0 && (
                                    <p className="text-[11px] text-slate-400 italic px-2 py-1">No requirements added yet.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* No Area Assigned Criteria Block */}
            {noAreaCriteriaData && noAreaCriteriaData.length > 0 && (
              <div className="rounded-xl border border-slate-700 bg-slate-800 text-white overflow-hidden shadow-2xs">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800">
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white">No Area Assigned</h3>
                      <p className="text-[11px] text-slate-400">Sub areas without area assignment</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-700 text-slate-300 rounded">
                    {noAreaCriteriaData.length} sub areas
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Programs and Offices Panel */}
        <div className="w-80 md:w-96 flex flex-col bg-white border-l border-slate-200 shrink-0">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Programs and Offices</h3>

            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search programs and offices..."
                value={officeSearch}
                onChange={(e) => setOfficeSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-4 text-xs font-semibold border-b border-slate-200 pb-1">
              {['All', 'Programs', 'Offices'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveOfficeTab(tab)}
                  className={`pb-1.5 transition-colors relative cursor-pointer ${activeOfficeTab === tab
                      ? 'text-blue-600 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  {tab}
                  {activeOfficeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Programs & Offices List */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/50">
            {filteredOffices.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No matching programs or offices found under this accreditation.
              </div>
            ) : (
              filteredOffices.map((office) => {
                const isAcademic = isAcademicEntity(office);

                return (
                  <div
                    key={office.officeid || office.id}
                    onClick={() => onSelectOffice && onSelectOffice(office)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white app-card-hover cursor-pointer group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${isAcademic ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {isAcademic ? (
                            <GraduationCap className="h-5 w-5" />
                          ) : (
                            <Building2 className="h-5 w-5" />
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {office.officename || office.officename}
                          </h4>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                            {office.department_name || office.DepartmentCode || (isAcademic ? 'Academic' : 'Institution-wide')}
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-400 hover:text-slate-700 hover:border-slate-300 shadow-2xs transition-all"
                          aria-label="Options"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Metadata Dates */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500">
                      <div>
                        <span className="block font-semibold uppercase text-[9px] text-slate-400">CREATED</span>
                        <span>{formatDateString(office.createdat || office.createdat)}</span>
                      </div>
                      <div>
                        <span className="block font-semibold uppercase text-[9px] text-slate-400">UPDATED</span>
                        <span>{formatDateString(office.updatedat || office.updatedat)}</span>
                      </div>
                    </div>

                    {/* Tags Footer */}
                    <div className="flex items-center justify-between mt-2.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        isAcademic
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      }`}>
                        {isAcademic ? 'Academic Program' : 'Non Academic'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {office.department_name || office.DepartmentCode || (isAcademic ? 'Academic' : 'Institution-wide')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
