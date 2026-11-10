import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useModal } from "../UI/ModalProvider";
import { API_BASE_URL } from '../../utils/apiBase';
import CustomSelect from '../UI/CustomSelect';

export default function AddRequirementModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        eventid: '8', // Auto-set to PASSCU (eventid = 8)
        requirementcode: '',
        Description: '',
        areaid: '',
        criteriaid: '',
        parentrequirementcode: ''
    });

    const [eventsList, setEventsList] = useState([]);
    const [areasList, setAreasList] = useState([]);
    const [allCriteria, setAllCriteria] = useState([]); // All criteria for the event
    const [criteriaList, setCriteriaList] = useState([]); // Filtered criteria for selected area
    const [requirementsList, setRequirementsList] = useState([]);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showAlert } = useModal();

    // Fetch events when modal opens and auto-load PASSCU areas and criteria
    useEffect(() => {
        if (isOpen) {
            fetchEvents();
            // Automatically load PASSCU areas and criteria (eventid = 8)
            fetchAreasByEvent('8');
            fetchAllCriteriaForEvent('8');
        }
    }, [isOpen]);

    // Fetch areas and criteria when event is selected
    useEffect(() => {
        if (formData.eventid) {
            fetchAreasByEvent(formData.eventid);
            fetchAllCriteriaForEvent(formData.eventid);
        } else {
            setAreasList([]);
            setAllCriteria([]);
            setCriteriaList([]);
        }
    }, [formData.eventid]);

    // Filter criteria when area is selected
    useEffect(() => {
        if (formData.areaid === '' && allCriteria.length > 0) {
            // No area selected, show criteria with no areaid (top-level for event)
            const filtered = allCriteria.filter(c => !c.areaid || c.areaid === '' || c.areaid === null);
            setCriteriaList(filtered);
        } else if (formData.areaid && allCriteria.length > 0) {
            const filtered = allCriteria.filter(c => c.areaid == formData.areaid);
            setCriteriaList(filtered);
        } else {
            setCriteriaList([]);
        }
    }, [formData.areaid, allCriteria]);

    // Fetch requirements for selected criteria
    useEffect(() => {
        if (formData.criteriaid) {
            fetchRequirementsByCriteria(formData.criteriaid);
        } else {
            setRequirementsList([]);
        }
    }, [formData.criteriaid]);

    const fetchEvents = async () => {
        try {
            const { eventsAPI } = await import('../../utils/api');
            const response = await eventsAPI.getAllEvents();
            
            if (response.success) {
                setEventsList(response.data);
            }
        } catch (error) {
            console.error('Error fetching events:', error);
        }
    };

    const fetchAreasByEvent = async (eventid) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/areas/event/${eventid}`);
            const data = await response.json();
            console.log('Areas response:', data);
            
            if (data.success) {
                setAreasList(data.data || []);
            } else {
                console.error('Failed to fetch areas:', data.message);
                setAreasList([]);
            }
        } catch (error) {
            console.error('Error fetching areas:', error);
            setAreasList([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAllCriteriaForEvent = async (eventid) => {
        setIsLoading(true);
        try {
            console.log('Fetching all criteria for eventid:', eventid);
            const { criteriaAPI } = await import('../../utils/api');
            const response = await criteriaAPI.getByEvent(eventid);
            if (response.success) {
                setAllCriteria(response.data || []);
            } else {
                console.error('Failed to fetch criteria:', response.message);
                setAllCriteria([]);
            }
        } catch (error) {
            console.error('Error fetching criteria:', error);
            setAllCriteria([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchRequirementsByCriteria = async (criteriaid) => {
        try {
            const { requirementsAPI } = await import('../../utils/api');
            console.log('Fetching requirements for criteria:', criteriaid);
            const response = await requirementsAPI.getAllRequirements();
            console.log('Requirements response:', response);
            
            if (response.success) {
                // Filter requirements by selected criteria
                const filtered = response.data.filter(req => req.criteriaid == criteriaid);
                console.log('Filtered requirements for criteria:', filtered);
                setRequirementsList(filtered);
            } else {
                console.error('Failed to fetch requirements:', response.message);
            }
        } catch (error) {
            console.error('Error fetching requirements:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.eventid) {
            newErrors.eventid = 'Event is required';
        }
        // Area is now optional for top-level criteria
        if (!formData.requirementcode.trim()) {
            newErrors.requirementcode = 'Requirement code is required';
        }
        if (!formData.Description.trim()) {
            newErrors.Description = 'Description is required';
        }
        if (!formData.criteriaid) {
            newErrors.criteriaid = 'Sub Area is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        
        try {
            // Import requirementsAPI
            const { requirementsAPI } = await import('../../utils/api');
            
            // Add requirement to database
            const response = await requirementsAPI.addRequirement({
                requirementcode: formData.requirementcode,
                Description: formData.Description,
                criteriaid: formData.criteriaid,
                parentrequirementcode: formData.parentrequirementcode || null
            });

            if (response.success) {
                console.log('Requirement added successfully:', response.data);
                
                // Reset form and close modal
                setFormData({
                    eventid: '8', // Keep PASSCU selected
                    requirementcode: '',
                    Description: '',
                    areaid: '',
                    criteriaid: '',
                    parentrequirementcode: ''
                });
                
                // Call onSuccess callback if provided
                if (onSuccess) {
                    onSuccess(response.data);
                }
                
                onClose();
                await showAlert('Requirement added successfully!');
            } else {
                await showAlert(response.message || 'Failed to add requirement');
            }
            
        } catch (error) {
            console.error('Error submitting form:', error);
            await showAlert('An error occurred while adding the requirement. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            // Reset form when closing
            setFormData({
                eventid: '8', // Keep PASSCU selected
                requirementcode: '',
                Description: '',
                areaid: '',
                criteriaid: '',
                parentrequirementcode: ''
            });
            setErrors({});
            setAreasList([]);
            setCriteriaList([]);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50] p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white z-10 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Add New Standard</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Attach a standard specification to a selected sub area</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-y-auto min-h-0">
                    {/* Left Side - Form */}
                    <div className="w-1/2 p-6 border-r border-slate-200 overflow-y-auto">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Event Selection - Hidden/Disabled for PASSCU */}
                            <div>
                                <label htmlFor="eventid" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Accreditation *
                                </label>
                                <CustomSelect
                                    id="eventid"
                                    size="md"
                                    value={formData.eventid}
                                    onChange={(val) => handleInputChange({ target: { name: 'eventid', value: val } })}
                                    options={eventsList.map((event) => ({
                                        value: String(event.eventid),
                                        label: `${event.eventcode} - ${event.eventname}`
                                    }))}
                                    placeholder="Select an accreditation"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Area Dropdown */}
                            <div>
                                <label htmlFor="areaid" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Area (Optional)
                                </label>
                                <CustomSelect
                                    id="areaid"
                                    size="md"
                                    value={formData.areaid}
                                    onChange={(val) => handleInputChange({ target: { name: 'areaid', value: val } })}
                                    options={[
                                        { value: '', label: 'None (Top-level sub area for accreditation)' },
                                        ...areasList.map((area) => ({
                                            value: String(area.areaid),
                                            label: `${area.areacode} - ${area.areaname}`
                                        }))
                                    ]}
                                    placeholder="None (Top-level sub area for accreditation)"
                                    disabled={isSubmitting || isLoading || !formData.eventid}
                                    buttonClassName={errors.areaid ? '!border-red-400' : ''}
                                />
                                {errors.areaid && (
                                    <p className="text-red-500 text-[11px] mt-1">{errors.areaid}</p>
                                )}
                                {!isLoading && areasList.length > 0 && (
                                    <p className="text-emerald-600 text-[11px] mt-1">{areasList.length} areas loaded</p>
                                )}
                            </div>

                            {/* Criteria Dropdown */}
                            <div>
                                <label htmlFor="criteriaid" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Sub Area *
                                </label>
                                <CustomSelect
                                    id="criteriaid"
                                    size="md"
                                    value={formData.criteriaid}
                                    onChange={(val) => handleInputChange({ target: { name: 'criteriaid', value: val } })}
                                    options={criteriaList.map((criteria) => ({
                                        value: String(criteria.criteriaid),
                                        label: `${criteria.criteriacode} - ${criteria.criterianame}`
                                    }))}
                                    placeholder={formData.areaid === '' ? 'Select a sub area' : (!formData.areaid ? 'Select an area first' : 'Select a sub area')}
                                    disabled={isSubmitting || isLoading}
                                    buttonClassName={errors.criteriaid ? '!border-red-400' : ''}
                                />
                                {errors.criteriaid && (
                                    <p className="text-red-500 text-[11px] mt-1">{errors.criteriaid}</p>
                                )}
                                {isLoading && (
                                    <p className="text-slate-400 text-[11px] mt-1">Loading sub areas...</p>
                                )}
                                {!isLoading && criteriaList.length > 0 && (
                                    <p className="text-emerald-600 text-[11px] mt-1">{criteriaList.length} sub areas loaded</p>
                                )}
                            </div>

                            {/* Parent Requirement Code */}
                            <div>
                                <label htmlFor="parentrequirementcode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Parent Standard (Optional)
                                </label>
                                <CustomSelect
                                    id="parentrequirementcode"
                                    size="md"
                                    value={formData.parentrequirementcode}
                                    onChange={(val) => handleInputChange({ target: { name: 'parentrequirementcode', value: val } })}
                                    options={[
                                        { value: '', label: !formData.criteriaid ? 'Select a sub area first' : 'None (Top-level standard)' },
                                        ...requirementsList.map((req) => ({
                                            value: req.requirementcode,
                                            label: `${req.requirementcode} - ${req.Description?.substring(0, 50) || ''}${req.Description?.length > 50 ? '...' : ''}`
                                        }))
                                    ]}
                                    placeholder={!formData.criteriaid ? 'Select a sub area first' : 'None (Top-level standard)'}
                                    disabled={isSubmitting || !formData.criteriaid}
                                />
                                {requirementsList.length > 0 && (
                                    <p className="text-emerald-600 text-[11px] mt-1">
                                        {requirementsList.length} existing standard item{requirementsList.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>

                            {/* Requirement Code */}
                            <div>
                                <label htmlFor="requirementcode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                     Standard Code *
                                 </label>
                                 <input
                                     type="text"
                                     id="requirementcode"
                                     name="requirementcode"
                                     value={formData.requirementcode}
                                     onChange={handleInputChange}
                                     className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${
                                         errors.requirementcode ? 'border-red-400' : 'border-slate-200'
                                     }`}
                                     placeholder="e.g., VMG.1.1.1"
                                     disabled={isSubmitting}
                                 />
                                 {errors.requirementcode && (
                                     <p className="text-red-500 text-[11px] mt-1">{errors.requirementcode}</p>
                                 )}
                            </div>

                            {/* Description */}
                            <div>
                                <label htmlFor="Description" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                    Description *
                                </label>
                                <textarea
                                    id="Description"
                                    name="Description"
                                    value={formData.Description}
                                    onChange={handleInputChange}
                                    rows="3"
                                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors ${
                                        errors.Description ? 'border-red-400' : 'border-slate-200'
                                    }`}
                                    placeholder="Enter standard description"
                                    disabled={isSubmitting}
                                />
                                {errors.Description && (
                                    <p className="text-red-500 text-[11px] mt-1">{errors.Description}</p>
                                )}
                            </div>

                            {/* Form Actions */}
                            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isSubmitting}
                                    className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !formData.eventid || !formData.criteriaid}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isSubmitting && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {isSubmitting ? 'Adding...' : 'Add Standard'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Side - Preview (Sticky) */}
                    <div className="w-1/2 bg-gray-50 min-h-[70vh]" style={{ position: 'relative' }}>
                        <div
                            className="sticky p-6"
                            style={{ top: '4.5rem', maxHeight: '80vh', overflowY: 'auto' }}
                        >
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Preview Structure</h3>
                            {/* Preview of selected hierarchy */}
                            {formData.areaid || formData.criteriaid || formData.requirementcode ? (
                                <div className="space-y-4">
                                    {/* Area Preview */}
                                    {formData.areaid && (
                                        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-3 rounded-lg shadow-md">
                                            <h3 className="text-base font-bold">
                                                {areasList.find(a => a.areaid == formData.areaid)?.areacode || 'Area'}
                                            </h3>
                                            <p className="text-xs text-purple-100 mt-1">
                                                {areasList.find(a => a.areaid == formData.areaid)?.areaname || 'Select an area'}
                                            </p>
                                        </div>
                                    )}

                                    {/* Criteria Preview */}
                                    {formData.criteriaid && (
                                        <div className="ml-4">
                                            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-3 rounded-lg shadow-md">
                                                <h3 className="text-sm font-bold">
                                                    {criteriaList.find(c => c.criteriaid == formData.criteriaid)?.criteriacode || 'Sub Area'}
                                                </h3>
                                                <p className="text-xs text-indigo-100 mt-1">
                                                    {criteriaList.find(c => c.criteriaid == formData.criteriaid)?.criterianame || 'Select a sub area'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Requirement Preview */}
                                    {formData.requirementcode && (
                                        <div className="ml-8">
                                            <div className="border-l-4 border-indigo-200 bg-white p-4 rounded-r-lg shadow-sm">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center mt-1">
                                                        <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-sm text-gray-800">
                                                            {(() => {
                                                                const criteriacode = criteriaList.find(c => c.criteriaid == formData.criteriaid)?.criteriacode || '';
                                                                const parentCode = formData.parentrequirementcode || '';
                                                                const reqCode = formData.requirementcode || '';
                                                                
                                                                if (reqCode) {
                                                                    if (parentCode) {
                                                                        // Parent already includes criteria code
                                                                        return `${parentCode}.${reqCode}`;
                                                                    } else if (criteriacode) {
                                                                        return `${criteriacode}.${reqCode}`;
                                                                    }
                                                                    return reqCode;
                                                                }
                                                                return 'Enter standard code...';
                                                            })()}
                                                        </h4>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            {formData.Description || 'Enter a description...'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-gray-500 text-sm">Fill out the form to see preview</p>
                                    <p className="text-gray-400 text-xs mt-1">Area → Sub Area → Standard</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
