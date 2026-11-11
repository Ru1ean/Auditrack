import React, { useEffect, useState } from 'react';
import CustomSelect from '../UI/CustomSelect';

export default function AddMasterListModal({ isOpen, onClose, onSubmit, departments = [] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Academic Program');
  const [departmentid, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setName('');
    setType('Academic Program');
    setDepartmentId('');
    setLoading(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const isAcademic = type === 'Academic Program';

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!name.trim()) return;

    if (isAcademic && !departmentid) return;

    setLoading(true);

    try {
      await onSubmit?.({
        name: name.trim(),
        type,
        entitytypeid: isAcademic ? 1 : 2,
        departmentid: isAcademic ? departmentid : null,
      });
      onClose?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs px-4">
      <div className="mx-4 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-800">Add Master List Item</h2>
            <p className="mt-0.5 text-xs text-slate-500">Create a new academic program or non-academic office entry.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95 cursor-pointer disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200/90 bg-slate-50/50 px-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
              placeholder="e.g. BSIT"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">Type *</label>
            <CustomSelect
              value={type}
              onChange={(val) => {
                setType(val);
                if (val !== 'Academic Program') {
                  setDepartmentId('');
                }
              }}
              options={[
                { value: 'Academic Program', label: 'Academic Program' },
                { value: 'Non-Academic Office', label: 'Non-Academic Office' },
              ]}
            />
          </div>

          {isAcademic && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">Department *</label>
              <CustomSelect
                value={departmentid}
                onChange={(val) => setDepartmentId(val)}
                placeholder="Select Department"
                options={[
                  { value: '', label: 'Select Department' },
                  ...departments.map((dept) => ({
                    value: String(dept.id),
                    label: dept.name,
                  })),
                ]}
                required={isAcademic}
              />
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 active:scale-95 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex h-9 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-700 active:scale-95 cursor-pointer disabled:cursor-not-allowed disabled:bg-emerald-400"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
