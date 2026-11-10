import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, ChevronRight, GraduationCap, Building2, CheckSquare, Square, Loader2, X, SlidersHorizontal } from 'lucide-react';
import { officesAPI, areasAPI } from '../../utils/api';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/apiBase';
import CustomSelect from '../UI/CustomSelect';
import { isAcademicEntity } from '../../utils/entityHelpers';

export default function AssignToOfficesModal({
  offices = [],
  areasData = [],
  events = [],
  selectedEventId = '',
  onSelectEvent,
  onAssign,
  onClose,
  saving = false,
  error = '',
  success = ''
}) {
  const [officeSearch, setOfficeSearch] = useState('');
  const [requirementSearch, setRequirementSearch] = useState('');
  const [activeOfficeTab, setActiveOfficeTab] = useState('All');
  const [selectedOfficeIds, setSelectedOfficeIds] = useState(new Set());
  const [selectedRequirementIds, setSelectedRequirementIds] = useState(new Set());
  const [expandedAreas, setExpandedAreas] = useState(new Set(['1', '2']));
  const [expandedCriteria, setExpandedCriteria] = useState(new Set());

  const [localOffices, setLocalOffices] = useState(offices || []);
  const [localAreasData, setLocalAreasData] = useState(areasData || []);
  const [loadingData, setLoadingData] = useState(false);

  // Sync props if provided
  useEffect(() => {
    if (Array.isArray(offices) && offices.length > 0) {
      setLocalOffices(offices);
    }
  }, [offices]);

  useEffect(() => {
    if (Array.isArray(areasData) && areasData.length > 0) {
      const propHasReqs = areasData.some(a => (a.criteria || []).some(c => (c.requirements || []).length > 0));
      const localHasReqs = localAreasData.some(a => (a.criteria || []).some(c => (c.requirements || []).length > 0));
      if (propHasReqs || !localHasReqs) {
        setLocalAreasData(areasData);
      }
    }
  }, [areasData]);

  // Fetch live fresh data directly on mount or when event changes
  const fetchFreshData = useCallback(async (eventid) => {
    try {
      setLoadingData(true);
      const res = await officesAPI.getAll().catch(() => []);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setLocalOffices(list);

      const targetEventId = eventid && eventid !== 'all'
        ? eventid
        : localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id') || (events && events[0]?.eventid);

      if (targetEventId && targetEventId !== 'all') {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        let areas = [];
        try {
          const aRes = await axios.get(`${API_BASE_URL}/api/areas/event/${targetEventId}`, { headers });
          areas = aRes.data?.data || aRes.data || [];
        } catch {
          areas = await areasAPI.getAll().catch(() => []);
        }

        let allCriteria = [];
        try {
          const cRes = await axios.get(`${API_BASE_URL}/api/criteria/event/${targetEventId}`, { headers });
          allCriteria = cRes.data?.data || cRes.data || [];
        } catch {
          allCriteria = [];
        }

        // Fast batch-fetch all requirements for this event
        let allEventReqs = [];
        try {
          const reqRes = await axios.get(`${API_BASE_URL}/api/requirements/all?eventid=${targetEventId}`, { headers });
          allEventReqs = reqRes.data?.data || reqRes.data || [];
        } catch (rErr) {
          console.warn('Batch requirements fetch notice:', rErr.message);
        }

        // Group requirements by criteriaid
        const reqsByCriteria = {};
        allEventReqs.forEach((r) => {
          const cId = String(r.criteriaid || r.criteriaid);
          if (!reqsByCriteria[cId]) reqsByCriteria[cId] = [];
          reqsByCriteria[cId].push(r);
        });

        // Ensure requirements are attached to all criteria (with fallback if batch returned empty)
        const criteriaWithReqs = await Promise.all(
          allCriteria.map(async (crit) => {
            const critId = String(crit.criteriaid || crit.id);
            let reqs = reqsByCriteria[critId] || [];
            if (reqs.length === 0 && allEventReqs.length === 0) {
              try {
                const rRes = await axios.get(`${API_BASE_URL}/api/requirements/criteria/${critId}`, { headers });
                reqs = rRes.data?.data || rRes.data || [];
              } catch {
                reqs = [];
              }
            }
            return { ...crit, requirements: reqs, children: [] };
          })
        );

        // Build criteria hierarchy (parent -> children)
        const criteriaMap = {};
        criteriaWithReqs.forEach(c => {
          const cId = String(c.criteriaid || c.id);
          criteriaMap[cId] = c;
        });

        const topLevelCriteria = [];
        criteriaWithReqs.forEach(c => {
          const parentId = c.parentcriteriaid ? String(c.parentcriteriaid) : null;
          if (parentId && criteriaMap[parentId]) {
            if (!c.areaid && criteriaMap[parentId].areaid) {
              c.areaid = criteriaMap[parentId].areaid;
            }
            criteriaMap[parentId].children.push(c);
          } else {
            topLevelCriteria.push(c);
          }
        });

        const groupedAreas = (Array.isArray(areas) ? areas : []).map(a => {
          const aId = String(a.areaid || a.id);
          const crits = topLevelCriteria.filter(c => String(c.areaid || c.areaid) === aId);
          return { ...a, criteria: crits };
        });

        setLocalAreasData(groupedAreas);
      }
    } catch (err) {
      console.error('Failed to load fresh modal data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [events]);

  useEffect(() => {
    const effectiveEventId = selectedEventId || localStorage.getItem('acc_selected_event_id') || localStorage.getItem('selected_audit_event_id') || (events && events[0]?.eventid);
    if (effectiveEventId) {
      fetchFreshData(effectiveEventId);
    }
  }, [selectedEventId, events, fetchFreshData]);

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

  // Filter offices
  const filteredOffices = useMemo(() => {
    let list = localOffices || [];

    // Filter by selected event ID if provided
    if (selectedEventId && selectedEventId !== 'all') {
      list = list.filter(o => {
        const evId = String(o.eventid || o.eventid || '');
        return evId === String(selectedEventId);
      });
    }

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
  }, [localOffices, selectedEventId, activeOfficeTab, officeSearch]);

  // If user enters a search query and requirements are not loaded yet, ensure fresh data is fetched
  useEffect(() => {
    if (requirementSearch.trim() && localAreasData.length > 0) {
      const hasAnyReqs = localAreasData.some(a => (a.criteria || []).some(c => (c.requirements || []).length > 0));
      if (!hasAnyReqs && !loadingData) {
        fetchFreshData(selectedEventId);
      }
    }
  }, [requirementSearch, localAreasData, loadingData, selectedEventId, fetchFreshData]);

  // Filter evidence hierarchy by search term (searches requirement code/description, criteria code/name, area code/name)
  const filteredAreasData = useMemo(() => {
    const q = requirementSearch.trim().toLowerCase();
    if (!q) return localAreasData;

    const matchesReq = (r) => {
      const code = String(r.requirementcode || r.code || r.req_code || '').toLowerCase();
      const title = String(r.RequirementTitle || r.Title || r.title || r.RequirementName || r.description || r.Description || '').toLowerCase();
      return code.includes(q) || title.includes(q);
    };

    const filterCriteria = (crit) => {
      const critCode = String(crit.criteriacode || crit.code || '').toLowerCase();
      const critName = String(crit.criterianame || crit.name || crit.title || '').toLowerCase();
      const critSelfMatches = critCode.includes(q) || critName.includes(q);

      const matchingReqs = (crit.requirements || []).filter(r => matchesReq(r) || critSelfMatches);
      const matchingChildren = (crit.children || []).map(child => filterCriteria(child)).filter(Boolean);

      if (critSelfMatches || matchingReqs.length > 0 || matchingChildren.length > 0) {
        return {
          ...crit,
          requirements: critSelfMatches ? (crit.requirements || []) : matchingReqs,
          children: matchingChildren
        };
      }
      return null;
    };

    return (localAreasData || []).map((area) => {
      const areacode = String(area.areacode || area.code || '').toLowerCase();
      const areaname = String(area.areaname || area.name || area.title || '').toLowerCase();
      const areaSelfMatches = areacode.includes(q) || areaname.includes(q);

      const filteredCriteria = (area.criteria || []).map(c => {
        if (areaSelfMatches) return c;
        return filterCriteria(c);
      }).filter(Boolean);

      if (areaSelfMatches || filteredCriteria.length > 0) {
        return {
          ...area,
          criteria: filteredCriteria
        };
      }
      return null;
    }).filter(Boolean);
  }, [localAreasData, requirementSearch]);

  // Automatically expand matching areas and criteria when searching so user sees results immediately
  useEffect(() => {
    const q = requirementSearch.trim().toLowerCase();
    if (!q) return;

    const matchedAreaIds = new Set();
    const matchedCritIds = new Set();

    filteredAreasData.forEach((area) => {
      const areaid = String(area.id || area.areaid);
      matchedAreaIds.add(areaid);

      const markCrit = (crit) => {
        const critId = String(crit.id || crit.criteriaid);
        matchedCritIds.add(critId);
        (crit.children || []).forEach(markCrit);
      };

      (area.criteria || []).forEach(markCrit);
    });

    setExpandedAreas(matchedAreaIds);
    setExpandedCriteria(matchedCritIds);
  }, [requirementSearch, filteredAreasData]);

  // Office Selection Handlers
  const toggleOffice = (officeid) => {
    setSelectedOfficeIds(prev => {
      const next = new Set(prev);
      if (next.has(officeid)) next.delete(officeid);
      else next.add(officeid);
      return next;
    });
  };

  const toggleAllOffices = () => {
    const allFilteredIds = filteredOffices.map(o => Number(o.officeid || o.id));
    const allSelected = allFilteredIds.every(id => selectedOfficeIds.has(id));

    setSelectedOfficeIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Requirement Selection Handlers
  const toggleRequirement = (reqId) => {
    setSelectedRequirementIds(prev => {
      const next = new Set(prev);
      if (next.has(reqId)) next.delete(reqId);
      else next.add(reqId);
      return next;
    });
  };

  const getAllReqIdsForCriteria = (criteria) => {
    const ids = (criteria.requirements || []).map(r => Number(r.id || r.requirementid));
    (criteria.children || []).forEach(child => {
      ids.push(...getAllReqIdsForCriteria(child));
    });
    return ids;
  };

  const toggleAreaAll = (area) => {
    const reqIds = [];
    (area.criteria || []).forEach(c => {
      reqIds.push(...getAllReqIdsForCriteria(c));
    });

    if (reqIds.length === 0) return;
    const allSelected = reqIds.every(id => selectedRequirementIds.has(id));
    setSelectedRequirementIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        reqIds.forEach(id => next.delete(id));
      } else {
        reqIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleCriteriaAll = (criteria) => {
    const reqIds = getAllReqIdsForCriteria(criteria);
    if (reqIds.length === 0) return;
    const allSelected = reqIds.every(id => selectedRequirementIds.has(id));

    setSelectedRequirementIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        reqIds.forEach(id => next.delete(id));
      } else {
        reqIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleExpandArea = (areaid) => {
    const normId = String(areaid);
    setExpandedAreas(prev => {
      const next = new Set(prev);
      if (next.has(normId)) next.delete(normId);
      else next.add(normId);
      return next;
    });
  };

  const toggleExpandCriteria = (critId) => {
    const normId = String(critId);
    setExpandedCriteria(prev => {
      const next = new Set(prev);
      if (next.has(normId)) next.delete(normId);
      else next.add(normId);
      return next;
    });
  };

  const handleSubmit = () => {
    if (selectedOfficeIds.size === 0 || selectedRequirementIds.size === 0) return;
    if (onAssign) {
      onAssign(Array.from(selectedOfficeIds), Array.from(selectedRequirementIds));
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-slate-50/40 font-sans">
      {/* Header - Fixed in position */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">Assign Standards to Offices</h2>
              {events && events.length > 0 && (
                <div className="flex items-center gap-1.5 min-w-[200px]">
                  <CustomSelect
                    size="sm"
                    value={selectedEventId || ''}
                    onChange={(val) => {
                      if (val) {
                        localStorage.setItem('acc_selected_event_id', String(val));
                        localStorage.setItem('selected_audit_event_id', String(val));
                      }
                      if (onSelectEvent) onSelectEvent(val);
                    }}
                    options={events.map(ev => ({
                      value: String(ev.eventid || ev.id),
                      label: ev.eventcode || ev.eventname
                    }))}
                    placeholder="Select accreditation"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">Select programs or offices on the left and assign standards on the right.</p>
          </div>
        </div>

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

      {/* Main Grid Content */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4 min-h-0">
        {/* Left Panel: Programs and Offices Checklist */}
        <div className="w-80 md:w-96 flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0 shadow-2xs min-h-0">
          <div className="p-3.5 border-b border-slate-200 bg-white">
            {/* Search */}
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
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-3 text-xs font-semibold">
                {['All', 'Programs', 'Offices'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveOfficeTab(tab)}
                    className={`transition-colors cursor-pointer ${activeOfficeTab === tab ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Select All */}
              <button
                type="button"
                onClick={toggleAllOffices}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Select All
              </button>
            </div>
          </div>

          {/* List of Offices with Checkboxes */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2.5 bg-slate-50/50">
            {filteredOffices.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                {loadingData ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span>Loading programs & offices...</span>
                  </div>
                ) : (
                  <span>No programs or offices found.</span>
                )}
              </div>
            ) : (
              filteredOffices.map((office) => {
                const officeid = Number(office.officeid || office.id);
                const isSelected = selectedOfficeIds.has(officeid);
                const isAcademic = isAcademicEntity(office);

                return (
                  <div
                    key={officeid}
                    onClick={() => toggleOffice(officeid)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 bg-white ${isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                      }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOffice(officeid)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                    />

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${isAcademic ? 'bg-cyan-50 text-cyan-600 border-cyan-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                          {isAcademic ? <GraduationCap className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {office.officename || office.officename}
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-2 pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                        <div>
                          <span className="block font-semibold uppercase text-[8px] text-slate-400">CREATED</span>
                          <span>{formatDateString(office.createdat || office.createdat)}</span>
                        </div>
                        <div>
                          <span className="block font-semibold uppercase text-[8px] text-slate-400">UPDATED</span>
                          <span>{formatDateString(office.updatedat || office.updatedat)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${
                          isAcademic
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {isAcademic ? 'Academic Program' : 'Non Academic'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                          {office.department_name || office.DepartmentCode || (isAcademic ? 'Academic' : 'Institution-wide')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Areas, Criteria, Requirements Checklist Tree */}
        <div className="flex-1 flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs min-w-0 min-h-0">
          <div className="p-3.5 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search areas, sub areas, or standards (e.g. A.1)..."
                value={requirementSearch}
                onChange={(e) => setRequirementSearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
              />
              {requirementSearch && (
                <button
                  type="button"
                  onClick={() => setRequirementSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
            {loadingData && localAreasData.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-slate-400 text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span>Loading standards structure...</span>
              </div>
            ) : filteredAreasData.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-slate-400 text-xs gap-2">
                {requirementSearch ? (
                  <>
                    <span>No standards match "{requirementSearch}".</span>
                    <button
                      type="button"
                      onClick={() => setRequirementSearch('')}
                      className="text-blue-600 font-semibold hover:underline mt-1 cursor-pointer"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <span>No standards hierarchy found for this accreditation.</span>
                )}
              </div>
            ) : (
              filteredAreasData.map((area) => {
                const areaid = String(area.id || area.areaid);
                const isExpanded = expandedAreas.has(areaid);
                const criteriaList = area.criteria || [];
                const areacode = area.areacode || area.code || '';
                const areaname = area.areaname || area.name || area.title || 'Area';

                const allAreaReqIds = [];
                criteriaList.forEach(c => (c.requirements || []).forEach(r => allAreaReqIds.push(Number(r.id || r.requirementid))));
                const isAreaAllSelected = allAreaReqIds.length > 0 && allAreaReqIds.every(id => selectedRequirementIds.has(id));

                return (
                  <div key={areaid} className="rounded-xl border border-blue-200 bg-white overflow-hidden shadow-2xs">
                    {/* Area Banner */}
                    <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white select-none">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isAreaAllSelected}
                          onChange={() => toggleAreaAll(area)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-white/40 text-blue-600 focus:ring-blue-400 cursor-pointer"
                        />
                        <span className="text-xs font-semibold bg-white/20 px-2 py-0.5 rounded text-white uppercase">AREA</span>
                        <h3
                          onClick={() => toggleExpandArea(areaid)}
                          className="text-xs font-bold text-white truncate cursor-pointer hover:underline"
                        >
                          {areacode ? `${areacode} - ${areaname}` : areaname}
                        </h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleExpandArea(areaid)}
                        className="p-1 text-white/80 hover:text-white rounded"
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Criteria List */}
                    {isExpanded && (
                      <div className="p-3 space-y-2 bg-slate-50 border-t border-blue-100">
                        {criteriaList.map((crit) => {
                          const critId = String(crit.id || crit.criteriaid);
                          const isCritExpanded = expandedCriteria.has(critId);
                          const reqs = crit.requirements || [];
                          const critCode = crit.criteriacode || crit.code || '';
                          const critName = crit.criterianame || crit.name || crit.title || 'Sub Area';

                          const critChildren = crit.children || [];
                          const allCritReqIds = getAllReqIdsForCriteria(crit);
                          const isCritAllSelected = allCritReqIds.length > 0 && allCritReqIds.every(id => selectedRequirementIds.has(id));

                          return (
                            <div key={critId} className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-2xs transition-all">
                              <div className="flex items-center justify-between px-3 py-2.5 bg-amber-50/80 border-b border-amber-200/80 select-none hover:bg-amber-100/60 transition-colors">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={isCritAllSelected}
                                    onChange={() => toggleCriteriaAll(crit)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-3.5 w-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500/30 cursor-pointer"
                                  />
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-600 text-white shrink-0 shadow-2xs">
                                    SUB AREA
                                  </span>
                                  <span
                                    onClick={() => toggleExpandCriteria(critId)}
                                    className="text-xs font-bold text-slate-800 truncate cursor-pointer hover:text-amber-700"
                                  >
                                    {critCode ? `${critCode}. ${critName}` : critName}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleExpandCriteria(critId)}
                                  className="text-amber-600 hover:text-amber-800 p-0.5 rounded hover:bg-amber-200/50 transition-colors"
                                >
                                  {isCritExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                </button>
                              </div>

                              {/* Criteria Contents: Direct Requirements & Subcriteria */}
                              {isCritExpanded && (
                                <div className="p-2.5 space-y-2.5 bg-white border-t border-slate-100">
                                  {/* Direct Requirements */}
                                  {reqs.length > 0 && (
                                    <div className="space-y-1.5">
                                      {reqs.map((req) => {
                                        const reqId = Number(req.id || req.requirementid);
                                        const isReqSelected = selectedRequirementIds.has(reqId);
                                        const reqCode = req.requirementcode || req.code || req.req_code || `Req #${reqId}`;
                                        const reqTitle = req.RequirementTitle || req.Title || req.title || req.RequirementName || req.description || req.Description || '';

                                        return (
                                          <div
                                            key={reqId}
                                            onClick={() => toggleRequirement(reqId)}
                                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${isReqSelected
                                                ? 'border-blue-400 bg-blue-50/40 text-blue-950'
                                                : 'border-slate-100 hover:border-slate-300 bg-slate-50/40'
                                              }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isReqSelected}
                                              onChange={() => toggleRequirement(reqId)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                                            />
                                            <div className="text-xs min-w-0">
                                              <span className="font-bold block mb-0.5">
                                                {reqCode}
                                              </span>
                                              {reqTitle && (
                                                <p className="text-slate-600 text-[11px] leading-relaxed">
                                                  {reqTitle}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Sub-criteria (Children) */}
                                  {critChildren.length > 0 && (
                                    <div className="space-y-2 pt-1">
                                      {critChildren.map((subCrit) => {
                                        const subCritId = String(subCrit.id || subCrit.criteriaid);
                                        const isSubCritExpanded = expandedCriteria.has(subCritId);
                                        const subReqs = subCrit.requirements || [];
                                        const subCritCode = subCrit.criteriacode || subCrit.code || '';
                                        const subCritName = subCrit.criterianame || subCrit.name || subCrit.title || 'Sub Area';
                                        const subReqIds = subReqs.map(r => Number(r.id || r.requirementid));
                                        const isSubAllSelected = subReqIds.length > 0 && subReqIds.every(id => selectedRequirementIds.has(id));

                                        return (
                                          <div key={subCritId} className="rounded-lg border border-blue-200 bg-white overflow-hidden shadow-2xs ml-2">
                                            <div className="flex items-center justify-between px-3 py-2 bg-blue-50/70 border-b border-blue-200/70 select-none hover:bg-blue-100/60 transition-colors">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <input
                                                  type="checkbox"
                                                  checked={isSubAllSelected}
                                                  onChange={() => toggleCriteriaAll(subCrit)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="h-3.5 w-3.5 rounded border-blue-400 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                                                />
                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wide uppercase bg-blue-600 text-white shrink-0 shadow-2xs">
                                                  SUB AREA
                                                </span>
                                                <span
                                                  onClick={() => toggleExpandCriteria(subCritId)}
                                                  className="text-xs font-bold text-slate-800 truncate cursor-pointer hover:text-blue-700"
                                                >
                                                  {subCritCode ? `${subCritCode}. ${subCritName}` : subCritName}
                                                </span>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() => toggleExpandCriteria(subCritId)}
                                                className="text-blue-600 hover:text-blue-800 p-0.5 rounded hover:bg-blue-200/50 transition-colors"
                                              >
                                                {isSubCritExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                              </button>
                                            </div>

                                            {/* Sub-criteria Requirements */}
                                            {isSubCritExpanded && (
                                              <div className="p-2 space-y-1.5 bg-slate-50/40">
                                                {subReqs.length === 0 ? (
                                                  <p className="text-[11px] text-slate-400 italic px-2 py-1">No standards in this sub area.</p>
                                                ) : (
                                                  subReqs.map((req) => {
                                                    const reqId = Number(req.id || req.requirementid);
                                                    const isReqSelected = selectedRequirementIds.has(reqId);
                                                    const reqCode = req.requirementcode || req.code || req.req_code || `Req #${reqId}`;
                                                    const reqTitle = req.RequirementTitle || req.Title || req.title || req.RequirementName || req.description || req.Description || '';

                                                    return (
                                                      <div
                                                        key={reqId}
                                                        onClick={() => toggleRequirement(reqId)}
                                                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${isReqSelected
                                                            ? 'border-blue-500 bg-blue-50/70 text-blue-950 shadow-2xs'
                                                            : 'border-slate-200 hover:border-blue-200 bg-white'
                                                          }`}
                                                      >
                                                        <input
                                                          type="checkbox"
                                                          checked={isReqSelected}
                                                          onChange={() => toggleRequirement(reqId)}
                                                          onClick={(e) => e.stopPropagation()}
                                                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30 cursor-pointer"
                                                        />
                                                        <div className="text-xs min-w-0">
                                                          <span className="font-bold block mb-0.5">
                                                             {reqCode}
                                                          </span>
                                                          {reqTitle && (
                                                            <p className="text-slate-600 text-[11px] leading-relaxed">
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

                                  {reqs.length === 0 && critChildren.length === 0 && (
                                    <p className="text-[11px] text-slate-400 italic px-2 py-1">No standards or sub areas added yet.</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Footer Action Bar */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-lg z-10">
        <p className="text-xs font-semibold text-slate-500">
          Pick offices on the left, then standards on the right.
        </p>

        <div className="flex items-center gap-3">
          {/* Counters */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
              OFFICES <strong className="ml-1 text-slate-900">{selectedOfficeIds.size}</strong>
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
              STANDARDS <strong className="ml-1 text-slate-900">{selectedRequirementIds.size}</strong>
            </span>
          </div>

          {/* Action Button */}
          <button
            type="button"
            disabled={saving || selectedOfficeIds.size === 0 || selectedRequirementIds.size === 0}
            onClick={handleSubmit}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 ${selectedOfficeIds.size > 0 && selectedRequirementIds.size > 0 && !saving
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer active:scale-98'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              }`}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Assigning...</span>
              </>
            ) : (
              <span>Assign to offices</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
