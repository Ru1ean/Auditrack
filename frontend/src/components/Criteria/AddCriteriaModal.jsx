import { API_BASE_URL } from '../../utils/apiBase';

import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useModal } from "../UI/ModalProvider";
import CustomSelect from "../UI/CustomSelect";
import StructureLivePreview from '../ALLC/AddAreaPop/StructureLivePreview';

export default function AddCriteriaModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        eventid: '',
        areaid: '',
        criteriacode: '',
        criterianame: '',
        Description: '',
        parentcriteriaid: ''
    });
    const [eventsList, setEventsList] = useState([]);
    const [areasList, setAreasList] = useState([]);
    const [criteriaList, setCriteriaList] = useState([]);
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { showAlert } = useModal();

    useEffect(() => {
        if (isOpen) {
            fetchEvents();
        }
    }, [isOpen]);

    useEffect(() => {
        if (formData.eventid) {
            fetchAreasByEvent(formData.eventid);
            fetchCriteriaByEvent(formData.eventid);
        } else {
            setAreasList([]);
            setCriteriaList([]);
        }
    }, [formData.eventid]);

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
            const { areasAPI } = await import('../../utils/api');
            const response = await areasAPI.getByEvent(eventid);
            if (response.success) {
                setAreasList(response.data || []);
            } else {
                setAreasList([]);
            }
        } catch (error) {
            setAreasList([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCriteriaByEvent = async (eventid) => {
        try {
            const { criteriaAPI } = await import('../../utils/api');
            const response = await criteriaAPI.getByEvent(eventid);
            if (response.success) {
                setCriteriaList(response.data || []);
            } else {
                setCriteriaList([]);
            }
        } catch (error) {
            setCriteriaList([]);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        // if areaid is cleared, also clear parentcriteriaid to prevent selecting a parent without an area
        if (name === 'areaid' && value === '') {
            setFormData(prev => ({
                ...prev,
                areaid: value,
                parentcriteriaid: ''
            }));
        } else if (name === 'criteriacode') {
            // remove any leading dots and normalize to uppercase
            const sanitized = (value || '').replace(/^\.+/, '').toUpperCase();
            setFormData(prev => ({ ...prev, criteriacode: sanitized }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.eventid) newErrors.eventid = 'Event is required';
        // Area is optional for top-level criteria (no parent)
        // If parentcriteriaid is not set, areaid is optional
        // If parentcriteriaid is set, areaid is also optional (criteria can be nested without area)
        // So, areaid is always optional
        // If creating a child (parentcriteriaid set), criteriacode is not required and will be null
        if (!formData.parentcriteriaid && !formData.criteriacode.trim()) newErrors.criteriacode = 'Sub area code is required';
        if (!formData.criterianame.trim()) newErrors.criterianame = 'Sub area name is required';
        if (!formData.Description.trim()) newErrors.Description = 'Description is required';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setIsSubmitting(true);
        try {
            const { criteriaAPI } = await import('../../utils/api');
            const payload = {
                ...formData,
                description: formData.Description,
                Description: formData.Description,
                criteriacode: formData.parentcriteriaid ? null : (formData.criteriacode ? String(formData.criteriacode).replace(/^\.+/, '') : formData.criteriacode)
            };
            const data = await criteriaAPI.addCriteria(payload);
            if (data.success) {
                setFormData({ eventid: '', areaid: '', criteriacode: '', criterianame: '', Description: '', parentcriteriaid: '' });
                if (onSuccess) onSuccess(data.data);
                onClose();
            } else {
                await showAlert(data.message || 'Failed to add sub area');
            }
        } catch (error) {
            console.error('Error adding sub area:', error);
            await showAlert(error?.response?.data?.message || error?.message || 'An error occurred while adding the sub area. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            setFormData({ eventid: '', areaid: '', criteriacode: '', criterianame: '', Description: '', parentcriteriaid: '' });
            setErrors({});
            setAreasList([]);
            setCriteriaList([]);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50] p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white z-10 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Add New Sub Area</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Define a new evaluation sub area for your assessment</p>
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
                                <label htmlFor="eventid" className="block text-xs font-semibold text-slate-700 mb-1.5">Event *</label>
                                <CustomSelect
                                    size="md"
                                    value={formData.eventid}
                                    onChange={(val) => handleInputChange({ target: { name: 'eventid', value: val } })}
                                    disabled={isSubmitting}
                                    placeholder="Select an event"
                                    options={[
                                        { value: "", label: "Select an event" },
                                        ...eventsList.map((event) => ({
                                            value: String(event.eventid),
                                            label: `${event.eventcode} - ${event.eventname}`,
                                        })),
                                    ]}
                                />
                                {errors.eventid && <p className="text-red-500 text-[11px] mt-1">{errors.eventid}</p>}
                            </div>
                            {/* Area Dropdown */}
                            <div>
                                <label htmlFor="areaid" className="block text-xs font-semibold text-slate-700 mb-1.5">Area *</label>
                                <CustomSelect
                                    size="md"
                                    value={formData.areaid}
                                    onChange={(val) => handleInputChange({ target: { name: 'areaid', value: val } })}
                                    disabled={isSubmitting || isLoading || !formData.eventid}
                                    placeholder={!formData.eventid ? 'Select an event first' : 'Select an area'}
                                    options={[
                                        { value: "", label: !formData.eventid ? 'Select an event first' : 'Select an area' },
                                        ...areasList.map((area) => ({
                                            value: String(area.areaid),
                                            label: `${area.areacode} - ${area.areaname}`,
                                        })),
                                    ]}
                                />
                                {errors.areaid && <p className="text-red-500 text-[11px] mt-1">{errors.areaid}</p>}
                            </div>
                            {/* Parent Criteria Dropdown */}
                            <div>
                                <label htmlFor="parentcriteriaid" className="block text-xs font-semibold text-slate-700 mb-1.5">Parent Sub Area (Optional)</label>
                                <CustomSelect
                                    size="md"
                                    value={formData.parentcriteriaid}
                                    onChange={(val) => handleInputChange({ target: { name: 'parentcriteriaid', value: val } })}
                                    disabled={isSubmitting || !formData.eventid || criteriaList.length === 0 || !formData.areaid}
                                    placeholder={!formData.areaid ? 'Select an area first to choose a parent sub area' : 'None (Top-level sub area)'}
                                    options={[
                                        { value: "", label: "None (Top-level sub area)" },
                                        ...criteriaList
                                            .filter(criteria =>
                                                criteria.criteriacode !== formData.criteriacode &&
                                                (!formData.areaid || String(criteria.areaid) === String(formData.areaid))
                                            )
                                            .map(criteria => ({
                                                value: String(criteria.criteriaid),
                                                label: `${criteria.criteriacode} - ${criteria.criterianame}`,
                                            })),
                                    ]}
                                />
                                {formData.eventid && (
                                    <p className="text-emerald-600 text-[11px] mt-1">
                                        {criteriaList.length} existing sub areas in this accreditation
                                    </p>
                                )}
                            </div>
                            {/* Criteria Code */}
                            <div>
                                <label htmlFor="criteriacode" className="block text-xs font-semibold text-slate-700 mb-1.5">Sub Area Code *</label>
                                <input
                                    type="text"
                                    id="criteriacode"
                                    name="criteriacode"
                                    value={formData.criteriacode}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${errors.criteriacode ? 'border-red-400' : 'border-slate-200'}`}
                                    placeholder={formData.parentcriteriaid ? 'No code required for child sub area' : 'e.g., A.1, B.2.1'}
                                    disabled={isSubmitting || !!formData.parentcriteriaid}
                                />
                                {errors.criteriacode && <p className="text-red-500 text-[11px] mt-1">{errors.criteriacode}</p>}
                            </div>
                            {/* Criteria Name */}
                            <div>
                                <label htmlFor="criterianame" className="block text-xs font-semibold text-slate-700 mb-1.5">Sub Area Name *</label>
                                <input
                                    type="text"
                                    id="criterianame"
                                    name="criterianame"
                                    value={formData.criterianame}
                                    onChange={handleInputChange}
                                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors ${errors.criterianame ? 'border-red-400' : 'border-slate-200'}`}
                                    placeholder="Enter sub area name"
                                    disabled={isSubmitting}
                                />
                                {errors.criterianame && <p className="text-red-500 text-[11px] mt-1">{errors.criterianame}</p>}
                            </div>
                            {/* Description */}
                            <div>
                                <label htmlFor="Description" className="block text-xs font-semibold text-slate-700 mb-1.5">Description *</label>
                                <textarea
                                    id="Description"
                                    name="Description"
                                    value={formData.Description}
                                    onChange={handleInputChange}
                                    rows="3"
                                    className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors ${errors.Description ? 'border-red-400' : 'border-slate-200'}`}
                                    placeholder="Enter a detailed description of this sub area"
                                    disabled={isSubmitting}
                                />
                                {errors.Description && <p className="text-red-500 text-[11px] mt-1">{errors.Description}</p>}
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
                                    disabled={isSubmitting || !formData.eventid}
                                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {isSubmitting && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    {isSubmitting ? 'Adding...' : 'Add Sub Area'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Right Side - Preview */}
                    <div className="w-1/2 p-6 bg-slate-50 flex flex-col justify-start">
                        <StructureLivePreview
                            mode="add-criteria"
                            areaData={areasList.find(a => String(a.areaid) === String(formData.areaid)) || null}
                            criteriaData={{
                                criteriacode: formData.criteriacode,
                                criterianame: formData.criterianame,
                                Description: formData.Description
                            }}
                            event={eventsList.find(e => String(e.eventid) === String(formData.eventid)) || null}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
