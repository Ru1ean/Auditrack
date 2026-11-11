import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useModal } from "../UI/ModalProvider";
import { API_BASE_URL } from '../../utils/apiBase';
import { dataCache } from '../../utils/dataCache';

export default function AddReqOffModal({ isOpen, onClose, office, onSave }) {
    const [requirements, setRequirements] = useState([]);
    const [selectedRequirements, setSelectedRequirements] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const { showAlert } = useModal();

    useEffect(() => {
        if (isOpen && office) {
            fetchEventRequirements();
        }
    }, [isOpen, office]);

    const fetchEventRequirements = async () => {
        setLoading(true);
        try {
            // Fetch all requirements for the office's event
            const response = await axios.get(`${API_BASE_URL}/api/requirements/all?eventid=${office.eventid}`);
            const allRequirements = response.data.data || [];
            console.log('All requirements for event:', allRequirements);
            console.log('First requirement:', JSON.stringify(allRequirements[0], null, 2));

            // Fetch current office requirements
            const officeReqResponse = await axios.get(`${API_BASE_URL}/api/offices/${office.id}/requirements`);
            const officeRequirements = officeReqResponse.data.data || [];
            const officeReqIds = officeRequirements.map(r => r.requirementid);

            // Filter out requirements already assigned to office
            const availableReqs = allRequirements.filter(req => !officeReqIds.includes(req.requirementid));
            console.log('Available requirements:', availableReqs);
            console.log('Available requirement details:', JSON.stringify(availableReqs, null, 2));
            setRequirements(availableReqs);
        } catch (error) {
            console.error('Error fetching requirements:', error);
            setRequirements([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRequirement = (reqId) => {
        setSelectedRequirements(prev =>
            prev.includes(reqId)
                ? prev.filter(id => id !== reqId)
                : [...prev, reqId]
        );
    };

    const handleSelectAll = () => {
        const filtered = getFilteredRequirements();
        if (selectedRequirements.length === filtered.length) {
            setSelectedRequirements([]);
        } else {
            setSelectedRequirements(filtered.map(r => r.requirementid));
        }
    };

    const handleSave = async () => {
        if (selectedRequirements.length === 0) return;

        setSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/api/offices/${office.id}/requirements`, {
                requirementIds: selectedRequirements
            });

            dataCache.invalidate('office_reqs_');

            await showAlert(`Successfully added ${selectedRequirements.length} standard item(s) to ${office.officename || office.officename || 'office'}.`, 'success');
            
            onSave();
            onClose();
            setSelectedRequirements([]);
        } catch (error) {
            console.error('Error adding requirements:', error);
            await showAlert('Failed to add standard. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const getFilteredRequirements = () => {
        return requirements.filter(req =>
            (req.requirementcode && req.requirementcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.Description && req.Description.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (req.criteriacode && req.criteriacode.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    };

    if (!isOpen || !office) return null;

    const filteredRequirements = getFilteredRequirements();

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out z-[50] bg-black/50 overflow-auto" onClick={onClose}>
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl my-8 flex flex-col h-[85vh]" onClick={(e) => e.stopPropagation()}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Add Standards to Office</h2>
                                <p className="text-sm text-green-100">{office.officename}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex flex-1 overflow-hidden">
                        {/* Left Side - Requirements List */}
                        <div className="w-1/2 flex flex-col border-r">
                            {/* Search and Select All */}
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 space-y-3 flex-shrink-0">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search standards by code, description, or sub area..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-gray-100 w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                onClick={handleSelectAll}
                                className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-2"
                            >
                                <input
                                    type="checkbox"
                                    checked={filteredRequirements.length > 0 && selectedRequirements.length === filteredRequirements.length}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                />
                                Select All ({filteredRequirements.length})
                            </button>
                            <span className="text-sm text-gray-600">
                                {selectedRequirements.length} selected
                            </span>
                            </div>
                        </div>

                        {/* Requirements List */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                            </div>
                        ) : filteredRequirements.length === 0 ? (
                            <div className="text-center py-12">
                                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                                <p className="text-gray-500 font-medium">
                                    {searchTerm ? 'No standards match your search' : 'All standards are already assigned'}
                                </p>
                            </div>
                        ) : office.eventid === 8 ? (
                            // PASSCU - Hierarchical view with Area -> Criteria -> Requirements
                            <div className="space-y-6">
                                {(() => {
                                    // Group requirements by Area
                                    const areaGroups = filteredRequirements.reduce((acc, req) => {
                                        const areacode = req.areacode || 'No Area';
                                        if (!acc[areacode]) {
                                            acc[areacode] = {
                                                areaname: req.areaname || 'Unknown Area',
                                                requirements: []
                                            };
                                        }
                                        acc[areacode].requirements.push(req);
                                        return acc;
                                    }, {});

                                    return Object.entries(areaGroups).map(([areacode, areaData]) => (
                                        <div key={areacode} className="space-y-4">
                                            {/* Area Header */}
                                            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                <h3 className="text-base font-bold">{areacode}</h3>
                                                <p className="text-xs text-purple-100 mt-1">{areaData.areaname}</p>
                                            </div>

                                            {/* Group by Criteria within this Area */}
                                            {(() => {
                                                const criteriaGroups = areaData.requirements.reduce((acc, req) => {
                                                    const criteriacode = req.criteriacode || 'No Sub Area';
                                                    if (!acc[criteriacode]) {
                                                        acc[criteriacode] = {
                                                            criterianame: req.criterianame || 'Unknown Sub Area',
                                                            requirements: []
                                                        };
                                                    }
                                                    acc[criteriacode].requirements.push(req);
                                                    return acc;
                                                }, {});

                                                return Object.entries(criteriaGroups).map(([criteriacode, criteriaData]) => (
                                                    <div key={criteriacode} className="ml-4 space-y-2">
                                                        {/* Criteria Header */}
                                                        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                            <h3 className="text-sm font-bold">{criteriacode}</h3>
                                                            <p className="text-xs text-indigo-100 mt-1">{criteriaData.criterianame}</p>
                                                        </div>

                                                        {/* Requirements under this Criteria */}
                                                        <div className="ml-4 space-y-2">
                                                            {criteriaData.requirements.map((req) => (
                                                                <div
                                                                    key={req.requirementid}
                                                                    onClick={() => handleToggleRequirement(req.requirementid)}
                                                                    className={`border-l-4 rounded-r-lg p-4 cursor-pointer transition-all ${
                                                                        selectedRequirements.includes(req.requirementid)
                                                                            ? 'bg-green-50 border-green-500 shadow-sm'
                                                                            : 'bg-white border-indigo-200 hover:border-green-300 hover:bg-green-50/30'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedRequirements.includes(req.requirementid)}
                                                                            onChange={() => handleToggleRequirement(req.requirementid)}
                                                                            className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5"
                                                                        />
                                                                        <div className="flex-1">
                                                                            <h4 className="font-semibold text-gray-800">
                                                                                {req.requirementcode || 'No Code'}
                                                                            </h4>
                                                                            <p className="text-sm text-gray-600 mt-1">{req.Description}</p>
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
                        ) : (
                            // PACUCOA & ISO - Hierarchical view with Criteria -> Requirements
                            <div className="space-y-6">
                                {(() => {
                                    // Group requirements by Criteria
                                    const criteriaGroups = filteredRequirements.reduce((acc, req) => {
                                        const criteriacode = req.criteriacode || 'No Sub Area';
                                        if (!acc[criteriacode]) {
                                            acc[criteriacode] = {
                                                criterianame: req.criterianame || 'Unknown Sub Area',
                                                requirements: []
                                            };
                                        }
                                        acc[criteriacode].requirements.push(req);
                                        return acc;
                                    }, {});

                                    return Object.entries(criteriaGroups).map(([criteriacode, criteriaData]) => (
                                        <div key={criteriacode} className="space-y-2">
                                            {/* Criteria Header */}
                                            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                <h3 className="text-base font-bold">{criteriacode}</h3>
                                                <p className="text-xs text-indigo-100 mt-1">{criteriaData.criterianame}</p>
                                            </div>

                                            {/* Requirements under this Criteria */}
                                            <div className="ml-4 space-y-2">
                                                {criteriaData.requirements.map((req) => (
                                                    <div
                                                        key={req.requirementid}
                                                        onClick={() => handleToggleRequirement(req.requirementid)}
                                                        className={`border-l-4 rounded-r-lg p-4 cursor-pointer transition-all ${
                                                            selectedRequirements.includes(req.requirementid)
                                                                ? 'bg-green-50 border-green-500 shadow-sm'
                                                                : 'bg-white border-indigo-200 hover:border-green-300 hover:bg-green-50/30'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRequirements.includes(req.requirementid)}
                                                                onChange={() => handleToggleRequirement(req.requirementid)}
                                                                className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 mt-0.5"
                                                            />
                                                            <div className="flex-1">
                                                                <h4 className="font-semibold text-gray-800">
                                                                    {req.requirementcode || 'No Code'}
                                                                </h4>
                                                                <p className="text-sm text-gray-600 mt-1">{req.Description}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        )}
                        </div>
                    </div>

                    {/* Right Side - Preview */}
                    <div className="w-1/2 flex flex-col bg-gray-50">
                        <div className="p-6 border-b border-gray-200 flex-shrink-0">
                            <h3 className="text-lg font-semibold text-gray-800">Preview Selected Requirements</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                {selectedRequirements.length} requirement{selectedRequirements.length !== 1 ? 's' : ''} selected
                            </p>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6">
                            {selectedRequirements.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-gray-500 text-sm">Select requirements to preview</p>
                                    <p className="text-gray-400 text-xs mt-1">Selected items will appear here</p>
                                </div>
                            ) : office.eventid === 8 ? (
                                // PASSCU - Preview with Area -> Criteria -> Requirements hierarchy
                                <div className="space-y-6">
                                    {(() => {
                                        const selectedReqs = requirements.filter(req => selectedRequirements.includes(req.requirementid));
                                        
                                        // Group by Area
                                        const areaGroups = selectedReqs.reduce((acc, req) => {
                                            const areacode = req.areacode || 'No Area';
                                            if (!acc[areacode]) {
                                                acc[areacode] = {
                                                    areaname: req.areaname || 'Unknown Area',
                                                    requirements: []
                                                };
                                            }
                                            acc[areacode].requirements.push(req);
                                            return acc;
                                        }, {});

                                        return Object.entries(areaGroups).map(([areacode, areaData]) => (
                                            <div key={areacode} className="space-y-4">
                                                {/* Area Header */}
                                                <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                    <h3 className="text-base font-bold">{areacode}</h3>
                                                    <p className="text-xs text-purple-100 mt-1">{areaData.areaname}</p>
                                                </div>

                                                {/* Group by Criteria within this Area */}
                                                {(() => {
                                                    const criteriaGroups = areaData.requirements.reduce((acc, req) => {
                                                        const criteriacode = req.criteriacode || 'No Sub Area';
                                                        if (!acc[criteriacode]) {
                                                            acc[criteriacode] = {
                                                                criterianame: req.criterianame || 'Unknown Sub Area',
                                                                requirements: []
                                                            };
                                                        }
                                                        acc[criteriacode].requirements.push(req);
                                                        return acc;
                                                    }, {});

                                                    return Object.entries(criteriaGroups).map(([criteriacode, criteriaData]) => (
                                                        <div key={criteriacode} className="ml-4 space-y-2">
                                                            {/* Criteria Header */}
                                                            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                                <h3 className="text-sm font-bold">{criteriacode}</h3>
                                                                <p className="text-xs text-indigo-100 mt-1">{criteriaData.criterianame}</p>
                                                            </div>

                                                            {/* Requirements under this Criteria */}
                                                            <div className="ml-4 space-y-2">
                                                                {criteriaData.requirements.map((req) => (
                                                                    <div key={req.requirementid} className="border-l-4 border-indigo-200 bg-white p-4 rounded-r-lg shadow-sm">
                                                                        <div className="flex items-start gap-3">
                                                                            <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-1">
                                                                                <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                                </svg>
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <h4 className="font-bold text-sm text-gray-800">{req.requirementcode || 'No Code'}</h4>
                                                                                <p className="text-xs text-gray-600 mt-1">{req.Description}</p>
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
                            ) : (
                                // Non-PASSCU - Preview with Criteria grouping
                                <div className="space-y-4">
                                    {(() => {
                                        const selectedReqs = requirements.filter(req => selectedRequirements.includes(req.requirementid));
                                        
                                        // Group by Criteria
                                        const criteriaGroups = selectedReqs.reduce((acc, req) => {
                                            const criteriacode = req.criteriacode || 'No Sub Area';
                                            if (!acc[criteriacode]) {
                                                acc[criteriacode] = {
                                                    criterianame: req.criterianame || 'Unknown Sub Area',
                                                    requirements: []
                                                };
                                            }
                                            acc[criteriacode].requirements.push(req);
                                            return acc;
                                        }, {});

                                        return Object.entries(criteriaGroups).map(([criteriacode, criteriaData]) => (
                                            <div key={criteriacode} className="space-y-2">
                                                {/* Criteria Header */}
                                                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                    <h3 className="text-sm font-bold">{criteriacode}</h3>
                                                    <p className="text-xs text-blue-100 mt-1">{criteriaData.criterianame}</p>
                                                </div>

                                                {/* Requirements under this Criteria */}
                                                <div className="ml-4 space-y-2">
                                                    {criteriaData.requirements.map((req) => (
                                                        <div key={req.requirementid} className="border-l-4 border-blue-200 bg-white p-4 rounded-r-lg shadow-sm">
                                                            <div className="flex items-start gap-3">
                                                                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-1">
                                                                    <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="font-bold text-sm text-gray-800">{req.requirementcode || 'No Code'}</h4>
                                                                    <p className="text-xs text-gray-600 mt-1">{req.Description}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
                        <p className="text-sm text-gray-600">
                            {selectedRequirements.length} standard item{selectedRequirements.length !== 1 ? 's' : ''} selected
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={selectedRequirements.length === 0 || saving}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        Add Evidence
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

