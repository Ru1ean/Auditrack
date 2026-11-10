import React, { useState, useEffect, useCallback } from 'react';
import { criteriaAPI } from '../../utils/api';
import { useModal } from "../UI/ModalProvider";
import CustomSelect from '../UI/CustomSelect';

const EditCriteriaModal = ({ visible, onClose, event = {}, onSave, userRole = 'user' }) => {
  const [criteriacode, setCriteriaCode] = useState('');
  const [criterianame, setCriteriaName] = useState('');
  // Description removed from form; will send null when saving
  const [parentcriteriaid, setParentCriteriaId] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [eventid, setEventId] = useState('');
  const [criteriaList, setCriteriaList] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const isAdmin = userRole === 'admin' || userRole === 1;
  const { showAlert } = useModal();

  useEffect(() => {
    if (event && visible) {
      setCriteriaCode((event.criteriacode || '').toUpperCase());
      setCriteriaName(event.criterianame || '');
      // description intentionally ignored (send null)
      setParentCriteriaId(event.parentcriteriaid ? String(event.parentcriteriaid) : '');
      setIsChild(Boolean(event.parentcriteriaid));
      setEventId(event.eventid || '');
    }
  }, [event, visible]);

  useEffect(() => {
    async function fetchCriteria() {
      try {
        const res = await criteriaAPI.getAll();
        if (event && event.eventid) {
          setCriteriaList((res.data || []).filter(c => String(c.eventid) === String(event.eventid)));
        } else {
          setCriteriaList(res.data || []);
        }
      } catch {
        setCriteriaList([]);
      }
    }
    fetchCriteria();
  }, [event]);

  if (!visible) return null;

  const validateForm = () => {
    const newErrors = {};
    if (!criteriacode.trim() && !isChild) newErrors.criteriacode = 'Sub area code is required';
    if (!criterianame.trim()) newErrors.criterianame = 'Sub area name is required';
    // ensure uniqueness of criteriacode within the same event (case-insensitive)
    const code = String(criteriacode || '').trim().toLowerCase();
    if (code) {
      const duplicate = (criteriaList || []).find(c => String(c.criteriacode || '').trim().toLowerCase() === code && Number(c.criteriaid) !== Number(event.criteriaid));
      if (duplicate) newErrors.criteriacode = 'A sub area with this code already exists for this event.';
    }
    // Description is optional/removed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'criteriacode') setCriteriaCode((value || '').toUpperCase());
    else if (name === 'criterianame') setCriteriaName(value);
    else if (name === 'parentcriteriaid') setParentCriteriaId(value);
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    const updated = {
      criteriaid: event.criteriaid,
      criteriacode: isChild ? null : criteriacode,
      criterianame: criterianame,
      Description: null,
      areaid: event.areaid === undefined ? null : event.areaid,
      parentcriteriaid: parentcriteriaid === '' ? null : parentcriteriaid,
      eventid: eventid
    };
      try {
        if (onSave) await onSave(updated);
        onClose();
      } catch (err) {
        console.log('Update criteria error (parent):', err);
        let msg = 'Failed to update sub area.';
        if (err?.message) msg += '\n' + err.message;
        await showAlert(msg);
      } finally {
        setIsSubmitting(false);
      }
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">{isAdmin ? 'Edit Sub Area' : 'View Sub Area'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Configure accreditation sub area parameters and requirements.</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5">
          {/* Criteria Code */}
          <div className="mb-6">
            <label htmlFor="criteriacode" className="block text-sm font-semibold text-gray-800 mb-2">
              Sub Area Code *
            </label>
            <input
              type="text"
              id="criteriacode"
              name="criteriacode"
              value={criteriacode}
              onChange={handleInputChange}
              className={`w-full rounded-md bg-white px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ${errors.criteriacode ? 'border-red-500' : 'border border-slate-200'}`}
              placeholder="e.g., CUR.4.1"
              disabled={isSubmitting || !isAdmin || isChild}
              required={!isChild}
            />
            {errors.criteriacode && <p className="text-red-500 text-sm mt-1">{errors.criteriacode}</p>}
          </div>

          {/* Criteria Name */}
          <div className="mb-6">
            <label htmlFor="criterianame" className="block text-sm font-semibold text-gray-800 mb-2">
              Sub Area Name *
            </label>
            <input
              type="text"
              id="criterianame"
              name="criterianame"
              value={criterianame}
              onChange={handleInputChange}
              className={`w-full rounded-md bg-white px-4 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500 ${errors.criterianame ? 'border-red-500' : 'border border-slate-200'}`}
              placeholder="Enter sub area name"
              disabled={isSubmitting || !isAdmin}
              required
            />
            {errors.criterianame && <p className="text-red-500 text-sm mt-1">{errors.criterianame}</p>}
          </div>

          {/* Parent Criteria Dropdown */}
          <div className="mb-6">
            <label htmlFor="parentcriteriaid" className="block text-sm font-semibold text-gray-800 mb-2">
              Parent Sub Area (Optional)
            </label>
            <CustomSelect
              id="parentcriteriaid"
              size="md"
              value={parentcriteriaid}
              onChange={(val) => handleInputChange({ target: { name: 'parentcriteriaid', value: val } })}
              options={[
                { value: '', label: 'None (Top-level sub area)' },
                ...criteriaList
                  .filter(c => String(c.criteriaid) !== String(event.criteriaid))
                  .map(c => ({
                    value: String(c.criteriaid),
                    label: `${c.criteriacode} - ${c.criterianame}`
                  }))
              ]}
              placeholder="None (Top-level sub area)"
              disabled={isSubmitting || !isAdmin || isChild}
            />
          </div>

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

export default EditCriteriaModal;
