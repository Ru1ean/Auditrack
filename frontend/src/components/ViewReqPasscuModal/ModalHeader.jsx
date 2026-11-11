import React from 'react';
import { officesAPI } from '../../utils/api';
import { useModal } from '../UI/ModalProvider';
import { Award, Lock, CalendarClock } from 'lucide-react';
import { isAcademicEntity } from '../../utils/entityHelpers';
import { getDeadlineInfo } from '../../utils/deadlineHelpers';

const ACCREDITATION_LEVELS = [
    'None',
    'Candidate',
    'Level I',
    'Level II',
    'Level III',
    'Level IV',
];

export default function ModalHeader({
    officeData,
    isAdmin,
    showMenu,
    setShowMenu,
    onEditOffice,
    onAddRequirements,
    onDeleteOffice,
    onClose,
    office,
    onUpdateLevel,
}) {
    const { showAlert } = useModal();
    const currentLevel = officeData?.accreditationlevel || office?.accreditationlevel || 'None';
    const [localLevel, setLocalLevel] = React.useState(currentLevel);
    const [updatingLevel, setUpdatingLevel] = React.useState(false);

    React.useEffect(() => {
        const lvl = officeData?.accreditationlevel || office?.accreditationlevel || 'None';
        setLocalLevel(lvl);
    }, [officeData?.accreditationlevel, office?.accreditationlevel]);

    const handleLevelSelect = async (newLevel) => {
        setLocalLevel(newLevel);
        if (onUpdateLevel) {
            setUpdatingLevel(true);
            try {
                await onUpdateLevel(newLevel);
            } finally {
                setUpdatingLevel(false);
            }
        }
    };
    const isAcademicProgram = (() => {
        const typeId = Number(officeData?.entitytypeid || officeData?.officetypeid || officeData?.type_id);
        if (typeId === 1) return true;
        if (typeId === 2) return false;

        const typename = String(officeData?.office_type_name || officeData?.typename || officeData?.category_name || officeData?.CategoryName || '').toLowerCase();
        if (typename.includes('non academic') || typename.includes('non-academic') || typename.includes('office') || typename.includes('administrative')) {
            return false;
        }
        return typename.includes('academic') || typename.includes('program');
    })();

    return (
        <div className="relative border-b border-slate-200/80 bg-white px-5 py-4 shadow-sm">
            {/* Accent bar */}
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-blue-500 via-sky-500 to-blue-600" />

            <div className="flex items-center justify-between gap-4">
                {/* Left: icon + name */}
                <div className="flex min-w-0 items-center gap-3.5">
                    {/* Icon */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                        isAcademicProgram
                            ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600'
                            : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600'
                    }`}>
                        {isAcademicProgram ? (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A57.778 57.778 0 0012 13.5" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 16.5h1.5m3 0H15M9 21v-3a1 1 0 011-1h4a1 1 0 011 1v3" />
                            </svg>
                        )}
                    </div>

                    {/* Name + meta */}
                    <div className="min-w-0">
                        <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">{officeData.officename}</h2>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {officeData.office_type_name && (
                                <span className="text-xs font-medium text-slate-500">{officeData.office_type_name}</span>
                            )}
                            {(() => {
                                const eventDisplay = String(officeData.eventcode || officeData.eventcode || officeData.eventname || officeData.eventname || '').trim();
                                if (!eventDisplay) return null;
                                const isOfficeComplied = Number(officeData?.compliancepercent ?? office?.compliancepercent ?? 0) >= 100 || officeData?.overallstatus === 'Complied' || office?.overallstatus === 'Complied';
                                const dlInfo = getDeadlineInfo(officeData?.event_deadline ?? office?.event_deadline, isOfficeComplied);
                                return (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-100">
                                            Event: {eventDisplay}
                                        </span>
                                        {dlInfo.hasDeadline && (
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${dlInfo.badgeClasses}`}>
                                                <CalendarClock className="h-3 w-3 shrink-0" />
                                                {dlInfo.shortLabel}
                                            </span>
                                        )}
                                    </>
                                );
                            })()}
                            {(officeData.DepartmentName || officeData.department_name) && (
                                <>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-[11px] text-slate-400">{officeData.DepartmentName || officeData.department_name}</span>
                                </>
                            )}
                            {isAcademicProgram && (
                                <>
                                    <span className="text-slate-300">·</span>
                                    {isAdmin ? (
                                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <span className="text-[11px] font-semibold text-slate-500">Accreditation:</span>
                                            <div className="relative inline-flex items-center">
                                                <select
                                                    value={localLevel}
                                                    disabled={updatingLevel}
                                                    onChange={(e) => handleLevelSelect(e.target.value)}
                                                    className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md py-0.5 pl-2 pr-6 hover:bg-emerald-100/70 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs transition appearance-none disabled:opacity-50"
                                                >
                                                    {ACCREDITATION_LEVELS.map((lvl) => (
                                                        <option key={lvl} value={lvl}>{lvl}</option>
                                                    ))}
                                                </select>
                                                <Award className="h-3 w-3 text-emerald-600 absolute right-1.5 pointer-events-none" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
                                            <Award className="h-3 w-3 text-emerald-600" />
                                            {localLevel}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: actions + close */}
                <div className="flex shrink-0 items-center gap-2">
                    {isAdmin && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowMenu(!showMenu)}
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 active:scale-95 ${showMenu ? 'bg-slate-100 text-slate-900 border-slate-300' : ''}`}
                                aria-label="Office actions"
                            >
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                </svg>
                            </button>

                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 top-10 z-30 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
                                        <button
                                            type="button"
                                            onClick={() => { setShowMenu(false); onEditOffice?.(office); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap"
                                        >
                                            <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span>Edit Office Info</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowMenu(false); onAddRequirements?.(office); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition whitespace-nowrap"
                                        >
                                            <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                            <span>Add Standard</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    setShowMenu(false);
                                                    const officeid = office?.id || office?.officeid;
                                                    if (!officeid) return;
                                                    const officename = office?.officename || office?.officename || `office-${officeid}`;
                                                    const { url, filename } = await officesAPI.exportOfficeExcel(officeid, officename);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = filename;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    document.body.removeChild(link);
                                                    setTimeout(() => window.URL.revokeObjectURL(url), 200);
                                                } catch (err) {
                                                    console.error('Export failed', err);
                                                    await showAlert(err?.response?.data?.message || err?.message || 'Failed to export office');
                                                }
                                            }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition whitespace-nowrap"
                                        >
                                            <svg className="h-4 w-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V6m0 0l-4 4m4-4 4 4" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21H3" />
                                            </svg>
                                            <span>Export Excel</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => { setShowMenu(false); await onDeleteOffice?.(office); }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap"
                                        >
                                            <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                            </svg>
                                            <span>Delete {isAcademicEntity(officeData || office) ? 'Program' : 'Office'}</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
