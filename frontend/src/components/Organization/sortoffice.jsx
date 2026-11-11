import React, { useState, useRef, useEffect } from 'react';

const SORT_OPTIONS = [
    { value: 'all', label: 'All Offices', dot: 'bg-blue-500' },
    { value: 'compiled', label: 'Complied', dot: 'bg-emerald-500' },
    { value: 'partially_compiled', label: 'Partially Complied', dot: 'bg-amber-500' },
    { value: 'not_compiled', label: 'Not Complied', dot: 'bg-rose-500' },
    { value: 'no_standards', label: 'No Standards', dot: 'bg-slate-400' },
];

export default function Sortoffice({ value = 'all', onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const onDocClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    const activeOption = SORT_OPTIONS.find((o) => o.value === value) || SORT_OPTIONS[0];

    return (
        <div className="relative inline-block" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex h-8 min-w-[146px] items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                title="Filter offices by status"
                aria-label={`Filter offices: ${activeOption.label}`}
            >
                <div className="flex items-center gap-2 truncate">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${activeOption.dot}`} />
                    <span className="truncate">{activeOption.label}</span>
                </div>
                <svg
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-48 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-100">
                    {SORT_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                                value === option.value
                                    ? 'bg-indigo-50/80 font-semibold text-indigo-700'
                                    : 'text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                            <span className="truncate">{option.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
