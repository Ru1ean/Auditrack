import { useState, useRef } from "react";
import EventOptionsPopup from "./eventsoptions";
import { formatDateTime } from "../../utils/formatDateTime";
import { getDeadlineInfo } from "../../utils/deadlineHelpers";
import { Check, Lock, CalendarClock } from "lucide-react";

export default function EventCard({
    event,
    onClick,
    onEdit,
    onCopy,
    onDelete,
    onAssignPersonnel,
    showCheckbox = false,
    isChecked = false,
    onToggleSelect,
    isAdmin = false,
    assignedAreas = []
}) {
    const [showOptions, setShowOptions] = useState(false);
    const dotBtnRef = useRef(null);

    const isactive = String(event.status || event.Status || '').toLowerCase().trim() !== 'inactive';
    const deadlineInfo = getDeadlineInfo(event.deadline, event);
    const accLevel = event.accreditationlevel && String(event.accreditationlevel).toUpperCase() !== 'N/A'
        ? event.accreditationlevel
        : null;

    return (
        <div
            key={event.eventid}
            className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 bg-white p-4 sm:p-5 h-full min-h-0 flex flex-col justify-between ${
                isChecked
                    ? 'border-blue-400/80 bg-blue-50/30 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 hover:border-blue-300 hover:shadow-lg'
            } ${showCheckbox ? 'cursor-default' : 'cursor-pointer'} shadow-xs`}
            onClick={onClick}
        >
            {/* Ambient subtle background aura */}
            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-transparent blur-xl group-hover:from-blue-500/10 transition-all duration-500" />

            {/* Checkbox for Delete Mode */}
            <div
                className="absolute top-3.5 left-3.5 z-20 transition-all duration-200"
                style={{
                    opacity: showCheckbox ? 1 : 0,
                    transform: showCheckbox ? 'scale(1)' : 'scale(0.7)',
                    pointerEvents: showCheckbox ? 'auto' : 'none'
                }}
            >
                <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelect?.(event, e.target.checked);
                    }}
                    aria-label={`Select ${event.eventname} for deletion`}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
            </div>

            {/* Main Content Container with transition slide when checkbox is shown */}
            <div
                className="h-full min-h-0 flex flex-col justify-between transition-transform duration-200"
                style={{
                    transform: showCheckbox ? 'translateX(22px)' : 'translateX(0)'
                }}
            >
                {/* Header: Type, Code/Name, Status & Menu */}
                <div className="flex items-start justify-between gap-2 shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                <svg className="w-3 h-3 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                                </svg>
                                {event.eventcode || 'STANDARD'}
                            </span>

                            {accLevel && (
                                <span className="inline-flex items-center rounded-md bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                                    {accLevel}
                                </span>
                            )}

                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isactive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${isactive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                {isactive ? 'Active' : 'Inactive'}
                            </span>

                            {deadlineInfo.hasDeadline && (
                                <span
                                    title={`Target submission deadline: ${deadlineInfo.label}`}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${deadlineInfo.badgeClasses}`}
                                >
                                    <CalendarClock className="w-2.5 h-2.5 shrink-0" />
                                    {deadlineInfo.shortLabel}
                                </span>
                            )}
                        </div>

                        <h3 className="text-base sm:text-lg font-bold leading-snug text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                            {event.eventname}
                        </h3>

                        {event.Description && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {event.Description}
                            </p>
                        )}
                    </div>

                    {isAdmin && (
                        <div className="relative shrink-0 ml-1">
                            <button
                                ref={dotBtnRef}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowOptions(v => !v);
                                }}
                                aria-label="More options"
                            >
                                <svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                </svg>
                            </button>
                            {showOptions && (
                                <EventOptionsPopup
                                    onOpenStructure={() => onClick?.(event)}
                                    onEdit={() => onEdit?.(event)}
                                    onCopy={() => onCopy?.(event)}
                                    onDelete={() => onDelete?.(event)}
                                    onAssignPersonnel={() => onAssignPersonnel?.(event)}
                                    onClose={() => setShowOptions(false)}
                                    anchorRef={dotBtnRef}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Assigned Areas (if auditor) */}
                {assignedAreas && assignedAreas.length > 0 && (
                    <div className="mt-3 rounded-xl bg-slate-50/80 border border-slate-200/70 p-2.5 shrink-0">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Assigned Areas</span>
                            <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-1.5 py-0.2 rounded">
                                {assignedAreas.length} {assignedAreas.length === 1 ? 'Area' : 'Areas'}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
                            {assignedAreas.map(a => (
                                <span
                                    key={a.id || a.areaid || a.areacode}
                                    className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 shadow-2xs whitespace-nowrap"
                                >
                                    <Check className="w-3 h-3 text-emerald-500 inline shrink-0" />
                                    <span>{a.areacode || a.areaname}</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Meta Details & Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2.5 shrink-0">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <div className="min-w-0">
                                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Created</span>
                                    <span className="text-slate-700 font-medium truncate block">{formatDateTime(event.createdat)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                                <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="min-w-0">
                                    <span className="block text-[9px] font-semibold uppercase tracking-wider text-slate-400">Updated</span>
                                    <span className="text-slate-700 font-medium truncate block">{formatDateTime(event.updatedat || event.createdat)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Far-Right Deadline Capsule (matching Header Clock Pill) */}
                        <div
                            onClick={(e) => {
                                if (isAdmin && onEdit) {
                                    e.stopPropagation();
                                    onEdit(event);
                                }
                            }}
                            title={deadlineInfo.hasDeadline ? `Target submission deadline: ${deadlineInfo.label}` : (isAdmin ? 'Click to set submission deadline' : 'No deadline set')}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs text-slate-600 font-medium select-none shadow-2xs shrink-0 ${
                                isAdmin ? 'hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer' : ''
                            }`}
                        >
                            <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${
                                    deadlineInfo.hasDeadline
                                        ? `${deadlineInfo.dotClasses} shadow-[0_0_6px_rgba(16,185,129,0.35)]`
                                        : 'bg-slate-400'
                                }`}
                            />
                            <span className="text-slate-700 font-semibold">
                                {deadlineInfo.hasDeadline ? deadlineInfo.formattedDate : 'No Deadline'}
                            </span>
                            {deadlineInfo.hasDeadline && (
                                <>
                                    <span className="text-slate-300 font-light">·</span>
                                    <span className={`font-medium ${
                                        deadlineInfo.status === 'completed'
                                            ? 'text-emerald-600 font-semibold'
                                            : deadlineInfo.status === 'overdue' || deadlineInfo.status === 'due-today'
                                                ? 'text-rose-600 font-semibold'
                                                : deadlineInfo.status === 'urgent' || deadlineInfo.status === 'upcoming'
                                                    ? 'text-amber-600 font-semibold'
                                                    : 'text-slate-500'
                                    }`}>
                                        {deadlineInfo.shortLabel}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">
                            Hierarchy & Evidence Tree
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                            Open Structure
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

