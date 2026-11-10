import React, { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { requirementsAPI } from "../../utils/api";

const RequirementsP = forwardRef(
  (
    {
      searchTerm = '',
      filterOptions = { events: [], types: [] },
      deleteMode = false,
      onSelectionChange,
      onRequirementClick,
      eventid = ''
    },
    ref
  ) => {
    const [requirements, setRequirements] = useState([]);
    const [filteredRequirements, setFilteredRequirements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedRequirements, setSelectedRequirements] = useState(new Set());

    // Fetch requirements data from database
    useEffect(() => {
      fetchRequirements();
    }, [eventid]);

    // Filter and sort requirements based on search term and filters
    useEffect(() => {
      let filtered = requirements;

      // Filter by selected eventid FIRST
      if (eventid) {
        filtered = requirements.filter(req => String(req.eventid) === String(eventid));
      }

      // Apply search filter
      if (searchTerm.trim()) {
        filtered = filtered.filter(req => {
          const requirementcode = req.requirementcode?.toLowerCase() || '';
          const description = (req.description || req.Description || '').toLowerCase();
          const criterianame = req.criterianame?.toLowerCase() || '';
          const eventname = req.eventname?.toLowerCase() || '';
          const searchLower = searchTerm.toLowerCase();

          return (
            requirementcode.includes(searchLower) ||
            description.includes(searchLower) ||
            criterianame.includes(searchLower) ||
            eventname.includes(searchLower)
          );
        });
      }

      // Apply event filters
      if (filterOptions.events.length > 0) {
        filtered = filtered.filter(req => filterOptions.events.includes(req.eventname));
      }

      // Apply type filters
      if (filterOptions.types.length > 0) {
        filtered = filtered.filter(req => {
          const hasParent = req.parentrequirementcode;
          const nestingLevel = req.requirementcode ? req.requirementcode.split('.').length - 1 : 0;

          return filterOptions.types.some(type => {
            if (type === 'main') return !hasParent;
            if (type === 'sub') return hasParent && nestingLevel <= 2;
            if (type === 'nested') return nestingLevel > 2;
            return false;
          });
        });
      }

      // Sort by requirement code or name (ascending)
      const sortedFiltered = [...filtered].sort((a, b) => {
        return (a.requirementcode || '').localeCompare(b.requirementcode || '');
      });

      setFilteredRequirements(sortedFiltered);
    }, [requirements, searchTerm, filterOptions, eventid]);

    // Handle selection changes and notify parent component
    useEffect(() => {
      if (onSelectionChange) {
        onSelectionChange(selectedRequirements.size, Array.from(selectedRequirements));
      }
    }, [selectedRequirements, onSelectionChange]);

    // Clear selections when delete mode is turned off
    useEffect(() => {
      if (!deleteMode) {
        setSelectedRequirements(new Set());
      }
    }, [deleteMode]);

    const handleCheckboxChange = (requirementid, isChecked) => {
      setSelectedRequirements(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
          newSet.add(requirementid);
        } else {
          newSet.delete(requirementid);
        }
        return newSet;
      });
    };

    const deleteSelectedRequirements = async (requirementIds) => {
      try {
        console.log('Attempting to delete requirements:', requirementIds);

        // Make API call to delete requirements
        const response = await requirementsAPI.deleteRequirements(requirementIds);
        console.log('Delete response:', response);

        if (response.success) {
          // Remove deleted requirements from local state
          setRequirements(prev => prev.filter(req => !requirementIds.includes(req.requirementid)));
          setSelectedRequirements(new Set());
          return { success: true };
        } else {
          console.error('Delete failed:', response.message);
          return { success: false, message: response.message || 'Failed to delete requirements' };
        }
      } catch (error) {
        console.error('Error deleting requirements:', error);

        // Check if it's a network error
        if (error.code === 'ERR_NETWORK' || (error.message && error.message.includes('Network Error'))) {
          return { success: false, message: 'Network error. Please check if the backend server is running on port 5000.' };
        }

        // Check for specific error responses
        if (error.response) {
          return { success: false, message: `Server error: ${error.response.data?.message || error.response.statusText}` };
        }

        return { success: false, message: `Error deleting requirements: ${error.message}` };
      }
    };

    const fetchRequirements = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await requirementsAPI.getAllRequirements();

        if (response.success) {
          setRequirements(response.data);
        } else {
          setError('Failed to fetch requirements');
        }
      } catch (error) {
        console.error('Error fetching requirements:', error);
        setError('Error loading requirements. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    // Function to refresh data (can be called from parent component)
    const refreshData = () => {
      fetchRequirements();
    };

    // Expose refresh function to parent
    useImperativeHandle(ref, () => ({
      refresh: refreshData,
      deleteSelected: deleteSelectedRequirements,
      clearSelection: () => setSelectedRequirements(new Set())
    }));

    if (loading) {
      return (
        <div className="mt-6 w-full">
          <div className="bg-white rounded-md p-4 shadow-lg border-2 border-gray-200">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading requirements...</span>
            </div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-6 w-full">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700">{error}</span>
              <button
                onClick={fetchRequirements}
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (filteredRequirements.length === 0 && !loading) {
      if (searchTerm.trim()) {
        return (
          <div className="mt-6 w-full">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
              <p className="text-gray-600">No standards match your search for "{searchTerm}".</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms or browse all standards.</p>
            </div>
          </div>
        );
      } else if (requirements.length === 0) {
        return (
          <div className="mt-6 w-full">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-8 text-center">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Standards Found</h3>
              <p className="text-gray-600">No standards available yet.</p>
            </div>
          </div>
        );
      }
    }

    // ========== UNIVERSAL HIERARCHY (AREA -> CRITERIA -> REQUIREMENTS) ==========
    return (
      <div className="mt-6 w-full space-y-4">
        {/* Search Results Counter */}
        {searchTerm.trim() && (
          <div className="text-sm text-gray-600 mb-4">
            Showing {filteredRequirements.length} of {requirements.length} standard items
            {filteredRequirements.length !== requirements.length && ` matching "${searchTerm}"`}
          </div>
        )}

        <div className="space-y-6">
          {(() => {
            // Group by Area
            const areaGroups = filteredRequirements.reduce((acc, req) => {
              const areacode = req.areacode || "No Area";
              if (!acc[areacode]) {
                acc[areacode] = {
                  areaname: req.areaname || "Unknown Area",
                  requirements: []
                };
              }
              acc[areacode].requirements.push(req);
              return acc;
            }, {});

              return Object.entries(areaGroups).map(([areacode, areaData]) => (
                <div key={areacode} className="space-y-4">
                  {/* AREA HEADER */}
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg shadow-md">
                    <h3 className="text-base font-bold">{areacode}</h3>
                    <p className="text-xs text-purple-100 mt-1">{areaData.areaname}</p>
                  </div>

                  {/* Group by Criteria */}
                  {(() => {
                  const criteriaGroups = areaData.requirements.reduce((acc, req) => {
                    const criteriacode = req.criteriacode || "No Sub Area";
                    if (!acc[criteriacode]) {
                      acc[criteriacode] = {
                        criterianame: req.criterianame || "Unknown Sub Area",
                        requirements: []
                      };
                    }
                    acc[criteriacode].requirements.push(req);
                    return acc;
                  }, {});

                  return Object.entries(criteriaGroups).map(([criteriacode, criteriaData]) => (
                    <div key={criteriacode} className="ml-4 space-y-2">
                      {/* CRITERIA HEADER */}
                      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md">
                        <h3 className="text-sm font-bold">{criteriacode}</h3>
                        <p className="text-xs text-indigo-100 mt-1">{criteriaData.criterianame}</p>
                      </div>

                      {/* Requirements */}
                      <div className="ml-4 space-y-2 pt-1 pb-1">
                        {criteriaData.requirements.map((requirement) => (
                          <div
                            key={requirement.requirementid}
                            onClick={() => !deleteMode && onRequirementClick && onRequirementClick(requirement)}
                            className={`
                              bg-white rounded-xl shadow-2xs border border-slate-200 border-l-4 border-l-cyan-500
                              ${deleteMode ? "cursor-pointer hover:border-rose-300" : "app-card-hover cursor-pointer"}
                              ${selectedRequirements.has(requirement.requirementid) ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/25" : ""}
                            `}
                          >
                            <div className="flex items-center justify-between p-4">
                              {/* LEFT: checkbox + info */}
                              <div className="flex items-center gap-4 flex-1">
                                {deleteMode && (
                                  <input
                                    type="checkbox"
                                    checked={selectedRequirements.has(requirement.requirementid)}
                                    onChange={(e) =>
                                      handleCheckboxChange(requirement.requirementid, e.target.checked)
                                    }
                                    className="w-4 h-4 text-rose-600 border-rose-300 rounded focus:ring-rose-500"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                )}

                                {/* Requirement Info */}
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-gray-900 text-base">
                                      {requirement.requirementcode}
                                    </h3>
                                    {requirement.parentrequirementcode && (
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        Child of {requirement.parentrequirementcode}
                                      </span>
                                    )}
                                    {requirement.requirementcode && requirement.requirementcode.split('.').length > 2 && (
                                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
                                        Level {requirement.requirementcode.split('.').length - 1}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                                    {requirement.description || requirement.Description}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            ));
          })()}
        </div>
      </div>
    );
  }
);

export default RequirementsP;
