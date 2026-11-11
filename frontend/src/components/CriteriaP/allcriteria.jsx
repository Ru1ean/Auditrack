import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { criteriaAPI } from "../../utils/api";

const CriteriaP = forwardRef(function CriteriaP({ searchTerm = "", eventid = null, deleteMode = false, onSelectionChange, selectedIds = [], onDeleteSelected, onCriteriaClick }, ref) {
  const [criteria, setCriteria] = useState([]);
  const [selected, setSelected] = useState(selectedIds || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    fetchCriteria();
    // eslint-disable-next-line
  }, [eventid]);

  useImperativeHandle(ref, () => ({
    refresh: fetchCriteria
  }));


  const fetchCriteria = async () => {
    setLoading(true);
    setError(null);
    try {
      let response;
      if (eventid) {
        response = await criteriaAPI.getByEvent(eventid);
      } else {
        response = await criteriaAPI.getAll();
      }
      if (response.success) {
        setCriteria(response.data);
      } else {
        setError("Failed to fetch sub areas");
      }
    } catch (err) {
      setError("Error loading sub areas");
    } finally {
      setLoading(false);
    }
  };


  let filtered = criteria;
  // Filter by search term
  if (searchTerm.trim()) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter(c =>
      (c.criteriacode?.toLowerCase() || "").includes(searchLower) ||
      (c.criterianame?.toLowerCase() || "").includes(searchLower) ||
      (c.areaname?.toLowerCase() || "").includes(searchLower) ||
      (c.eventname?.toLowerCase() || "").includes(searchLower)
    );
  }


  // Group by area, then by criteria (no requirements), and sort by Area sortorder and criteriacode
  const areaGroups = {};
  filtered.forEach((c) => {
    const areaKey = c.areaid || 'no-area';
    if (!areaGroups[areaKey]) {
      areaGroups[areaKey] = {
        areaname: c.areaname || 'Unknown Area',
        areacode: c.areacode || 'No Area',
        sortorder: c.sortorder || 9999,
        criteria: []
      };
    }
    areaGroups[areaKey].criteria.push(c);
  });

  // Convert to array and sort areas by sortorder, then by areaname
  const sortedAreas = Object.values(areaGroups)
    .filter(area => area.criteria.length > 0)
    .sort((a, b) => a.sortorder - b.sortorder || a.areaname.localeCompare(b.areaname));

  // Selection logic
  const handleSelect = (id) => {
    let updated;
    if (selected.includes(id)) {
      updated = selected.filter((sid) => sid !== id);
    } else {
      updated = [...selected, id];
    }
    setSelected(updated);
    if (onSelectionChange) onSelectionChange(updated.length, updated);
  };

  if (loading) {
    return <div className="p-6">Loading sub areas...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }
  if (filtered.length === 0) {
    return <div className="p-6 text-gray-600">No sub areas found.</div>;
  }


  return (
    <div className="mt-6 w-full space-y-4">
      {sortedAreas.map((area) => (
        <div key={area.areacode} className="space-y-4">
          {/* AREA HEADER */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg shadow-md">
            <h3 className="text-base font-bold">{area.areacode}</h3>
            <p className="text-xs text-purple-100 mt-1">{area.areaname}</p>
          </div>
          {/* CRITERIA GROUPS */}
          {area.criteria
            .sort((a, b) => (a.criteriacode || '').localeCompare(b.criteriacode || ''))
            .map((c) => {
              // Level calculation: number of dots in criteriacode (e.g., CUR.4.1.2 = Level 3)
              const level = c.criteriacode ? c.criteriacode.split('.').length - 1 : 0;
              return (
                <div key={c.criteriaid} className="ml-4 space-y-2">
                  {/* CRITERIA HEADER */}
                  <div
                    className={`bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md flex items-center cursor-pointer ${deleteMode && selected.includes(c.criteriaid) ? 'ring-2 ring-red-500 ring-inset' : ''}`}
                    onClick={() => !deleteMode && onCriteriaClick && onCriteriaClick(c)}
                  >
                    {deleteMode && (
                      <input
                        type="checkbox"
                        className="mr-3 h-5 w-5 text-purple-300 border-gray-300 rounded focus:ring-brand-500"
                        checked={selected.includes(c.criteriaid)}
                        onChange={() => handleSelect(c.criteriaid)}
                      />
                    )}
                    <div className="flex flex-col w-full">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-base">{c.criteriacode}</h3>
                        {/* Always show child/level if has parent (by code or ID, prefer code) */}
                        {(c.ParentCriteriaCode || c.parentcriteriaid) && (() => {
                          let parentCode = c.ParentCriteriaCode;
                          if (!parentCode && c.parentcriteriaid) {
                            // Try to find the parent code from the loaded criteria list
                            const parent = criteria.find(pc => String(pc.criteriaid) === String(c.parentcriteriaid));
                            parentCode = parent?.criteriacode || c.parentcriteriaid;
                          }
                          return (
                            <>
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded ml-2">
                                Child of {parentCode}
                              </span>
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded ml-2">
                                Level 2
                              </span>
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-indigo-100 mt-1">{c.criterianame}</p>
                      <p className="text-xs text-indigo-200 mt-1">Event: {c.eventname}</p>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
});
export default CriteriaP;
