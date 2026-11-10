import React, { useState, useEffect } from 'react';

const FILTER_OPTIONS = [
    { value: 'all', label: 'All statuses', dot: 'bg-slate-400' },
    { value: 'complied', label: 'Complied', dot: 'bg-emerald-500' },
    { value: 'partially', label: 'Partial', dot: 'bg-amber-500' },
    { value: 'not-complied', label: 'Not Complied', dot: 'bg-rose-500' },
];

const SUBMISSION_FILTER_OPTIONS = [
    { value: 'all', label: 'All Submissions', dot: 'bg-slate-400' },
    { value: 'rejected', label: 'Needs Revision (Rejected)', dot: 'bg-rose-500' },
    { value: 'pending', label: 'Under Review (Pending)', dot: 'bg-amber-500' },
    { value: 'unsubmitted', label: 'Unsubmitted (0 Files)', dot: 'bg-slate-400' },
    { value: 'approved', label: 'Approved', dot: 'bg-emerald-500' },
    { value: 'priority', label: 'Needs Attention First', dot: 'bg-indigo-500' },
];

export default function RequirementsToolbar({
    showStatusDropdown,
    setShowStatusDropdown,
    statusFilter,
    setStatusFilter,
    submissionFilter = 'all',
    setSubmissionFilter = () => {},
    isPersonnel = false,
    searchTerm,
    setSearchTerm,
}) {
    const [showSubmissionsDropdown, setShowSubmissionsDropdown] = useState(false);
    const activeOption = FILTER_OPTIONS.find((o) => o.value === statusFilter) || FILTER_OPTIONS[0];
    const activeSubOption = SUBMISSION_FILTER_OPTIONS.find((o) => o.value === submissionFilter) || SUBMISSION_FILTER_OPTIONS[0];

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showSubmissionsDropdown && !event.target.closest('.submission-dropdown')) {
                setShowSubmissionsDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSubmissionsDropdown]);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-5 py-3">
            <div>
                <h3 className="text-sm font-bold text-slate-800">Standards</h3>
                <p className="text-[11px] text-slate-400">Browse areas, sub areas, and standards</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {/* Submission Status filter (for Personnel) */}
                {isPersonnel && (
                    <div className="relative submission-dropdown">
                        <button
                            type="button"
                            onClick={() => {
                                setShowSubmissionsDropdown(!showSubmissionsDropdown);
                                if (showStatusDropdown) setShowStatusDropdown(false);
                            }}
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-xs transition ${
                                submissionFilter !== 'all'
                                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-bold'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${activeSubOption.dot}`} />
                            <span>{activeSubOption.label}</span>
                            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {showSubmissionsDropdown && (
                            <div className="absolute right-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-100">
                                {SUBMISSION_FILTER_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            setSubmissionFilter(option.value);
                                            setShowSubmissionsDropdown(false);
                                        }}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition ${
                                            submissionFilter === option.value
                                                ? 'bg-indigo-50/80 font-bold text-indigo-700'
                                                : 'text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Compliance Status filter */}
                <div className="relative status-dropdown">
                    <button
                        type="button"
                        onClick={() => {
                            setShowStatusDropdown(!showStatusDropdown);
                            if (showSubmissionsDropdown) setShowSubmissionsDropdown(false);
                        }}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 shadow-xs transition hover:border-slate-300 hover:bg-white"
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${activeOption.dot}`} />
                        <span>{activeOption.label}</span>
                        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {showStatusDropdown && (
                        <div className="absolute right-0 top-full z-20 mt-1.5 w-44 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-100">
                            {FILTER_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter(option.value);
                                        setShowStatusDropdown(false);
                                    }}
                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition ${
                                        statusFilter === option.value
                                            ? 'bg-indigo-50/80 font-semibold text-indigo-700'
                                            : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search */}
                <div className="relative">
                    <svg className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="search"
                        placeholder="Search standards..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-52 rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-800 shadow-xs placeholder:text-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                    />
                </div>
            </div>
        </div>
    );
}
