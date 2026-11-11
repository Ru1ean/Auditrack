import React, { useEffect, useState } from 'react';
import CustomSelect from '../UI/CustomSelect';

const EditRequirementsModal = ({ visible, onClose, requirement = {}, onSave, userRole = 'user' }) => {
  const [formData, setFormData] = useState({
    eventid: '',
    requirementcode: '',
    Description: '',
    criteriaid: '',
    parentrequirementcode: ''
  });
  
  const [eventsList, setEventsList] = useState([]);
  const [criteriaList, setCriteriaList] = useState([]);
  const [requirementsList, setRequirementsList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const isAdmin = userRole === 'admin' || userRole === 1;

  // Populate form when requirement data is loaded
  useEffect(() => {
    if (requirement && visible) {
      setFormData({
        eventid: requirement.eventid || '',
        requirementcode: requirement.requirementcode || '',
        Description: requirement.description || requirement.Description || '',
        criteriaid: requirement.criteriaid || '',
        parentrequirementcode: requirement.parentrequirementcode || ''
      });
      
      // Fetch initial data
      fetchEvents();
      
      // If there's an eventid, fetch criteria for that event
      if (requirement.eventid) {
        fetchCriteriaByEvent(requirement.eventid);
      }
      
      // If there's a criteriaid, fetch requirements for that criteria
      if (requirement.criteriaid) {
        fetchRequirementsByCriteria(requirement.criteriaid);
      }
    }
  }, [requirement, visible]);

  // Fetch criteria when event is selected
  useEffect(() => {
    if (formData.eventid && visible) {
      fetchCriteriaByEvent(formData.eventid);
    } else {
      setCriteriaList([]);
    }
  }, [formData.eventid, visible]);

  // Fetch requirements for selected criteria
  useEffect(() => {
    if (formData.criteriaid && visible) {
      fetchRequirementsByCriteria(formData.criteriaid);
    } else {
      setRequirementsList([]);
    }
  }, [formData.criteriaid, visible]);

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
      const response = await criteriaAPI.getByEvent(eventid);
      
      if (response.success) {
        setCriteriaList(response.data);
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
      const response = await requirementsAPI.getAllRequirements();
      
      if (response.success) {
        // Filter by selected criteria and exclude current requirement
        const filtered = response.data.filter(req => 
          req.criteriaid == criteriaid && 
          req.requirementid !== requirement.requirementid
        );
        setRequirementsList(filtered);
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
    if (!formData.requirementcode.trim()) {
      newErrors.requirementcode = 'Standard code is required';
    }
    if (!formData.Description.trim()) {
      newErrors.Description = 'Description is required';
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

    const updated = {
      requirementid: requirement.requirementid,
      requirementcode: formData.requirementcode,
      description: formData.Description,
      Description: formData.Description,
      criteriaid: formData.criteriaid,
      parentrequirementcode: formData.parentrequirementcode || null
    };

    try {
      await onSave(updated);
      onClose();
    } catch (error) {
      console.error('Error saving requirement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };


  if (!visible) return null;

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">{isAdmin ? 'Edit Standard' : 'View Standard'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Configure accreditation standard parameters.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-4">


            {/* Parent Requirement Dropdown */}
            <div className="mb-4">
              <label htmlFor="parentrequirementcode" className="block text-sm font-semibold text-gray-800 mb-1">
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
                disabled={isSubmitting || !formData.criteriaid || !isAdmin}
              />
              {!formData.criteriaid ? (
                <p className="text-gray-500 text-xs mt-1">
                  Select a sub area to see available parent standards
                </p>
              ) : requirementsList.length === 0 ? (
                <p className="text-yellow-600 text-xs mt-1">
                  No other standards in this sub area
                </p>
              ) : (
                <p className="text-green-600 text-xs mt-1">
                  Loaded {requirementsList.length} standard item{requirementsList.length !== 1 ? 's' : ''} for this sub area
                </p>
              )}
            </div>

            {/* Requirement Code */}
            <div className="mb-4">
              <label htmlFor="requirementcode" className="block text-sm font-semibold text-gray-800 mb-1">
                Standard Code *
              </label>
              <input
                type="text"
                id="requirementcode"
                name="requirementcode"
                value={formData.requirementcode}
                onChange={handleInputChange}
                className={`w-full rounded-md bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  errors.requirementcode ? 'border-red-500' : 'border border-slate-200'
                }`}
                placeholder="e.g., A.1 or just enter a number"
                disabled={isSubmitting || !isAdmin}
              />
              {errors.requirementcode && (
                <p className="text-red-500 text-sm mt-1">{errors.requirementcode}</p>
              )}
              {formData.parentrequirementcode && (
                <p className="text-blue-600 text-xs mt-1">
                  If you enter just a number, it will be appended to the parent code
                </p>
              )}
            </div>

            {/* Description */}
            <div className="mb-4">
              <label htmlFor="Description" className="block text-sm font-semibold text-gray-800 mb-1">
                Description *
              </label>
              <textarea
                id="Description"
                name="Description"
                value={formData.Description}
                onChange={handleInputChange}
                rows="4"
                className={`w-full rounded-md bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none ${
                  errors.Description ? 'border-red-500' : 'border border-slate-200'
                }`}
                placeholder="Enter a detailed description of this standard"
                disabled={isSubmitting || !isAdmin}
              />
              {errors.Description && (
                <p className="text-red-500 text-sm mt-1">{errors.Description}</p>
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-white">
            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && (
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                      <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </>
            )}
            {!isAdmin && (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditRequirementsModal;
