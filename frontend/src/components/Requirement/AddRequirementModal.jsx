import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useModal } from "../UI/ModalProvider";
import StructureLivePreview from '../ALLC/AddAreaPop/StructureLivePreview';
import CustomSelect from '../UI/CustomSelect';

export default function AddRequirementModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        eventid: '',
        requirementcode: '',
        Description: '',
        criteriaid: '',
        parentrequirementcode: '',
        ChildCriteriaID: ''
    });

    const [eventsList, setEventsList] = useState([]);
    const [criteriaList, setCriteriaList] = useState([]);
    const [requirementsList, setRequirementsList] = useState([]);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showAlert } = useModal();

    // Fetch events when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchEvents();
        }
    }, [isOpen]);

    // Fetch criteria when event is selected
    useEffect(() => {
        if (formData.eventid) {
            fetchCriteriaByEvent(formData.eventid);
        } else {
            setCriteriaList([]);
        }
    }, [formData.eventid]);

    // Fetch requirements for selected criteria
    useEffect(() => {
        if (formData.criteriaid) {
            fetchRequirementsByCriteria(formData.criteriaid);
        } else {
            setRequirementsList([]);
        }
        // clear selected child when criteria changes
        setFormData(prev => ({ ...prev, ChildCriteriaID: '' }));
    }, [formData.criteriaid]);

    // When child selection changes, load requirements for that child (to populate parent options)
    useEffect(() => {
        if (formData.ChildCriteriaID) {
            fetchRequirementsByCriteria(formData.ChildCriteriaID);
        } else if (formData.criteriaid) {
            fetchRequirementsByCriteria(formData.criteriaid);
        } else {
            setRequirementsList([]);
        }
        // also auto-generate requirement code based on parent criteria code
        generateRequirementCode();
    }, [formData.ChildCriteriaID]);

    // Also regenerate when criteria list or criteria selection changes
    useEffect(() => {
        generateRequirementCode();
    }, [criteriaList, formData.criteriaid]);

    // Regenerate when parent selection, child selection, or available requirements change
    useEffect(() => {
        generateRequirementCode();
    }, [formData.parentrequirementcode, formData.ChildCriteriaID, requirementsList]);

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

    const fetchCriteriaByEvent = async (eventid) => {
        setIsLoading(true);
        try {
            const { criteriaAPI } = await import('../../utils/api');
            console.log('Fetching criteria for event:', eventid);
            const response = await criteriaAPI.getByEvent(eventid);
            console.log('Criteria response:', response);
            
            if (response.success) {
                console.log('Criteria data:', response.data);
                setCriteriaList(response.data);
            } else {
                console.error('Failed to fetch criteria:', response.message);
            }
        } catch (error) {
            console.error('Error fetching criteria:', error);
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

    // compute child criteria for selected criteria
    const childCriteriaOptions = (criteriaList || []).filter(c => String(c.parentcriteriaid || '') === String(formData.criteriaid));

    // top-level criteria (exclude children) for the main Criteria dropdown
    const topLevelCriteria = (criteriaList || []).filter(c => c.parentcriteriaid === null || c.parentcriteriaid === undefined || String(c.parentcriteriaid) === '');

    const getBaseCriteriaCode = (criteriaid) => {
        if (!criteriaid) return '';
        const list = criteriaList || [];
        const crit = list.find(c => String(c.criteriaid) === String(criteriaid) || Number(c.criteriaid) === Number(criteriaid));
        if (!crit) return '';
        const code = crit.criteriacode ?? crit.criteriacode ?? '';
        if (code) return code;
        const parentId = crit.parentcriteriaid ?? crit.parentcriteriaid ?? null;
        if (parentId) {
            const parent = list.find(c => String(c.criteriaid) === String(parentId) || Number(c.criteriaid) === Number(parentId));
            return parent?.criteriacode ?? parent?.criteriacode ?? '';
        }
        return '';
    };

    const generateRequirementCode = () => {
        // Base code should always come from the parent criteria (children are grouping only)
        const baseCriteriaId = formData.criteriaid;
        const baseCode = getBaseCriteriaCode(baseCriteriaId);
        if (!baseCode) {
            setFormData(prev => ({ ...prev, requirementcode: '' }));
            return;
        }

        // Determine list of existing requirements to compute next index
        const targetCriteriaId = formData.ChildCriteriaID || formData.criteriaid;
        const list = (requirementsList || []).filter(r => String(r.criteriaid) === String(targetCriteriaId));
        const escapedBase = baseCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nums = list.map(o => {
            const rc = String(o.requirementcode || '');
            const m = rc.match(new RegExp(`^${escapedBase}\\.(\\d+)$`));
            return m ? Number(m[1]) : null;
        }).filter(n => n !== null);
        const next = nums.length ? Math.max(...nums) + 1 : 1;
        setFormData(prev => ({ ...prev, requirementcode: `${baseCode}.${next}` }));
    };

    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.eventid) {
            newErrors.eventid = 'Event is required';
        }
        if (!formData.requirementcode.trim()) {
            newErrors.requirementcode = 'Standard code is required';
        }
        if (!formData.Description.trim()) {
            newErrors.Description = 'Description is required';
        }
        if (!formData.criteriaid) {
            newErrors.criteriaid = 'Sub area is required';
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
            const targetCriteriaId = formData.ChildCriteriaID ? formData.ChildCriteriaID : formData.criteriaid;
            const response = await requirementsAPI.addRequirement({
                requirementcode: formData.requirementcode,
                description: formData.Description,
                Description: formData.Description,
                criteriaid: targetCriteriaId,
                parentrequirementcode: formData.parentrequirementcode || null
            });

            if (response.success) {
                console.log('Requirement added successfully:', response.data);
                
                // Reset form and close modal
                setFormData({
                    requirementcode: '',
                    Description: '',
                    criteriaid: '',
                    parentrequirementcode: ''
                });
                
                // Call onSuccess callback if provided
                if (onSuccess) {
                    onSuccess(response.data);
                }
                
                onClose();
                await showAlert('Standard added successfully!');
            } else {
                await showAlert(response.message || 'Failed to add standard');
            }
            
        } catch (error) {
            console.error('Error submitting form:', error);
            await showAlert('An error occurred while adding the standard. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            // Reset form when closing
            setFormData({
                eventid: '',
                requirementcode: '',
                Description: '',
                criteriaid: '',
                parentrequirementcode: ''
            });
            setErrors({});
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
                    {/* Event Selection */}
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
                            buttonClassName={errors.eventid ? '!border-red-400' : ''}
                        />
                        {errors.eventid && (
                            <p className="text-red-500 text-[11px] mt-1">{errors.eventid}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">Select the accreditation to filter sub areas</p>
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
                            options={topLevelCriteria.map((criteria) => ({
                                value: String(criteria.criteriaid),
                                label: `${criteria.criteriacode} - ${criteria.criterianame}`
                            }))}
                            placeholder={!formData.eventid ? 'Select an accreditation first' : 'Select a sub area'}
                            disabled={isSubmitting || isLoading || !formData.eventid}
                            buttonClassName={errors.criteriaid ? '!border-red-400' : ''}
                        />
                        {errors.criteriaid && (
                            <p className="text-red-500 text-[11px] mt-1">{errors.criteriaid}</p>
                        )}
                        {isLoading && (
                            <p className="text-slate-400 text-[11px] mt-1">Loading sub areas...</p>
                        )}
                        {!isLoading && formData.eventid && topLevelCriteria.length === 0 && (
                            <p className="text-amber-600 text-[11px] mt-1">No top-level sub areas found for this accreditation.</p>
                        )}
                        {!isLoading && topLevelCriteria.length > 0 && (
                            <p className="text-emerald-600 text-[11px] mt-1">Loaded {topLevelCriteria.length} top-level sub areas for this accreditation</p>
                        )}
                    </div>

                    {/* Parent Requirement Code */}
                    <div>
                        <label htmlFor="parentrequirementcode" className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Parent Standard Code (Optional)
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
                        {!formData.criteriaid ? (
                            <p className="text-slate-400 text-[11px] mt-1">
                                Select a sub area to see available parent standards
                            </p>
                        ) : requirementsList.length === 0 ? (
                            <p className="text-amber-600 text-[11px] mt-1">
                                No existing standards in this sub area. This will be top-level standard.
                            </p>
                        ) : (
                            <p className="text-emerald-600 text-[11px] mt-1">
                                Loaded {requirementsList.length} standard item{requirementsList.length !== 1 ? 's' : ''} for this sub area
                            </p>
                        )}
                    </div>

                    {/* Child Criteria Dropdown (optional) */}
                    {childCriteriaOptions.length > 0 && (
                        <div>
                            <label htmlFor="ChildCriteriaID" className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Place under Child Sub Area (Optional)
                            </label>
                            <CustomSelect
                                id="ChildCriteriaID"
                                size="md"
                                value={formData.ChildCriteriaID}
                                onChange={(val) => handleInputChange({ target: { name: 'ChildCriteriaID', value: val } })}
                                options={[
                                    { value: '', label: 'No child selected (use selected sub area)' },
                                    ...childCriteriaOptions.map(cc => ({
                                        value: String(cc.criteriaid),
                                        label: cc.criteriacode ? `${cc.criteriacode} - ${cc.criterianame}` : cc.criterianame
                                    }))
                                ]}
                                placeholder="No child selected (use selected sub area)"
                                disabled={isSubmitting || !formData.criteriaid}
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Choose a child sub area to save this standard under that child.</p>
                        </div>
                    )}

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
                            placeholder="e.g., A.1, B.2.1"
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
                            rows="4"
                            className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors ${
                                errors.Description ? 'border-red-400' : 'border-slate-200'
                            }`}
                            placeholder="Enter a detailed description of this standard"
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

                    {/* Right Side - Preview */}
                    <div className="w-1/2 p-6 bg-slate-50 flex flex-col justify-start">
                        {(() => {
                            const selectedCrit = criteriaList.find(c => String(c.criteriaid) === String(formData.ChildCriteriaID || formData.criteriaid));
                            const selectedArea = selectedCrit ? {
                                areaid: selectedCrit.areaid,
                                areaname: selectedCrit.areaname || selectedCrit.areaname,
                                areacode: selectedCrit.areacode || selectedCrit.areacode
                            } : null;

                            return (
                                <StructureLivePreview
                                    mode="add-requirement"
                                    areaData={selectedArea}
                                    criteriaData={selectedCrit || null}
                                    requirementData={{
                                        requirementcode: formData.requirementcode,
                                        Description: formData.Description
                                    }}
                                    event={eventsList.find(e => String(e.eventid) === String(formData.eventid)) || null}
                                />
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
