
import React, { useState, useEffect } from 'react';

const EditAreaModal = ({ visible, onClose, area = {}, onSave, userRole = 'user' }) => {
  const [areacode, setAreaCode] = useState('');
  const [areaname, setAreaName] = useState('');
  // Description removed from form; will send null when saving
  // Removed sortorder and isactive
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = userRole === 'admin' || userRole === 1;

  useEffect(() => {
    if (area) {
      setAreaCode(area.areacode || '');
      setAreaName(area.areaname || '');
      // description intentionally ignored (send null)
      // Removed sortorder and isactive
    }
  }, [area]);

  if (!visible) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const updated = {
      areaid: area.areaid,
      areacode: areacode,
      areaname: areaname,
      description: null,
      Description: null,
    };
    try {
      if (onSave) {
        await onSave(updated);
      }
      onClose();
    } catch (err) {
      console.error('Error saving area:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 lg:left-[var(--sidebar-width)] lg:transition-[left] lg:duration-200 lg:ease-in-out bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[50]">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl mx-4 max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">{isAdmin ? 'Edit Area' : 'View Area'}</h2>
            <p className="mt-0.5 text-xs text-slate-500">Configure accreditation area details and classification.</p>
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
            {/* Area Code */}
            <div>
              <label htmlFor="areacode" className="block text-sm font-semibold text-gray-800 mb-1">
                Area Code *
              </label>
              <input
                type="text"
                id="areacode"
                name="areacode"
                value={areacode}
                onChange={e => setAreaCode(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., AREA1"
                disabled={isSubmitting || !isAdmin}
                required
              />
            </div>
            {/* Area Name */}
            <div>
              <label htmlFor="areaname" className="block text-sm font-semibold text-gray-800 mb-1">
                Area Name *
              </label>
              <input
                type="text"
                id="areaname"
                name="areaname"
                value={areaname}
                onChange={e => setAreaName(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="e.g., Vision, Mission, Goals & Objectives"
                disabled={isSubmitting || !isAdmin}
                required
              />
            </div>
          </div>
          {/* Description */}
          {/* Description removed - backend accepts null */}
          {/* Form Actions */}
          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
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

export default EditAreaModal;

