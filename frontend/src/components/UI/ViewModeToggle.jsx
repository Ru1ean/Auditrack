import React from 'react';

/**
 * ViewModeToggle - High-precision, antislop segmented toggle for Grid and List views.
 * Uses exact concentric corner radii (R_inner = R_outer - padding) for perfect geometric alignment.
 */
export default function ViewModeToggle({ viewMode = 'grid', onChange, className = '' }) {
  return (
    <div
      className={`inline-flex items-center rounded-lg bg-slate-100 p-1 border border-slate-200/90 shadow-2xs shrink-0 select-none ${className}`}
      role="group"
      aria-label="View mode switcher"
    >
      <button
        type="button"
        onClick={() => onChange?.('grid')}
        aria-pressed={viewMode === 'grid'}
        title="Grid View"
        className={`flex h-7 w-7 items-center justify-center rounded-[6px] text-xs font-medium transition-all duration-150 cursor-pointer focus:outline-none ${
          viewMode === 'grid'
            ? 'bg-white text-blue-600 shadow-2xs font-semibold ring-1 ring-slate-900/5'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onChange?.('list')}
        aria-pressed={viewMode === 'list'}
        title="List View"
        className={`flex h-7 w-7 items-center justify-center rounded-[6px] text-xs font-medium transition-all duration-150 cursor-pointer focus:outline-none ${
          viewMode === 'list'
            ? 'bg-white text-blue-600 shadow-2xs font-semibold ring-1 ring-slate-900/5'
            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}
