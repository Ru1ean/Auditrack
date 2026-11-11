import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../../utils/apiBase';
import SmartUserAvatar from '../UI/SmartUserAvatar';

export default function AuditorDetailsModal({ isOpen, onClose, auditor, onAssignClick }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !auditor?.userid) return;
        let mounted = true;
        setLoading(true);

        const fetchAssignments = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/areas/assignments/${auditor.userid}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                });
                const data = await res.json();
                if (mounted && res.ok && data.success) {
                    setAssignments(data.assignments || []);
                } else if (mounted) {
                    setAssignments([]);
                }
            } catch (err) {
                console.error('Error fetching auditor area assignments:', err);
                if (mounted) setAssignments([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchAssignments();
        return () => { mounted = false; };
    }, [isOpen, auditor]);

    if (!isOpen || !auditor) return null;

    const avatarSrc = auditor.profilepic
        ? `${API_BASE_URL}/uploads/profile-pics/${auditor.profilepic}`
        : null;

    const fullName = `${auditor.firstname || ''} ${auditor.lastname || ''}`.trim() || 'External Auditor';
    const initialLetter = (auditor.firstname || auditor.Email || 'A').charAt(0).toUpperCase();

    // Group assignments by eventname / eventid
    const groupedByEvent = assignments.reduce((acc, curr) => {
        const eventKey = curr.eventname || curr.eventcode || 'General / Unassigned Event';
        if (!acc[eventKey]) {
            acc[eventKey] = [];
        }
        acc[eventKey].push(curr);
        return acc;
    }, {});

    const totalAreasCount = assignments.length;

    return createPortal(
        <div 
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header (100% Matching AssignAreaModal System Blueprint) */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <SmartUserAvatar
                            user={auditor}
                            fullName={fullName}
                            size="h-11 w-11"
                            textSize="text-base font-bold"
                            ring="border-2 border-white/60 shadow-sm"
                        />
                        <div className="min-w-0">
                            <h3 className="font-bold text-base text-white leading-tight truncate">
                                {fullName}
                            </h3>
                            <p className="text-xs text-blue-100 mt-0.5 truncate">
                                External Auditor {auditor.Email ? `(${auditor.Email})` : ''}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition shrink-0 ml-3"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Main Content Body */}
                <div className="p-5 bg-slate-50/50 overflow-y-auto">
                    {/* Header Controls */}
                    <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-900">Assigned Areas & Accreditations</h4>
                                <p className="text-[11px] font-medium text-slate-500">Authorized areas for compliance inspection</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                            <span className="inline-flex items-center rounded-full bg-slate-200/80 px-3 py-1 text-[11px] font-extrabold tracking-wider uppercase text-slate-700">
                                {totalAreasCount} {totalAreasCount === 1 ? 'AREA ASSIGNED' : 'AREAS ASSIGNED'}
                            </span>
                            {typeof onAssignClick === 'function' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        onAssignClick(auditor);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-blue-700 transition"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Manage Areas
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Area Cards grouped by Event */}
                    {loading ? (
                        <div className="space-y-4 py-4">
                            {[1, 2].map((i) => (
                                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 animate-pulse shadow-2xs">
                                    <div className="h-4 w-40 rounded bg-slate-200" />
                                    <div className="h-12 w-full rounded-xl bg-slate-100" />
                                </div>
                            ))}
                        </div>
                    ) : totalAreasCount === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-2xs">
                            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-2xs">
                                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">No Areas Currently Assigned</h4>
                            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                                Click <strong className="text-blue-600">"Manage Areas"</strong> above to select which accreditation events and areas this auditor can audit.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                            {Object.entries(groupedByEvent).map(([eventname, items]) => {
                                const codeMatch = eventname.match(/\(([^)]+)\)/);
                                const displayTitle = codeMatch ? `${codeMatch[1]} — ${eventname.replace(/\([^)]+\)/, '').trim()}` : eventname;

                                return (
                                    <div key={eventname} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:shadow-xs">
                                        {/* Event Header */}
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold shrink-0 border border-blue-100">
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                                    </svg>
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-900 truncate">
                                                    {displayTitle}
                                                </h4>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
                                                {items.length} {items.length === 1 ? 'Area' : 'Areas'}
                                            </span>
                                        </div>

                                        {/* Area Items Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {items.map((item) => (
                                                <div 
                                                    key={item.id || item.areaid} 
                                                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs transition hover:bg-blue-50/40 hover:border-blue-200"
                                                >
                                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-2xs border border-slate-200">
                                                        <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        </svg>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-extrabold text-slate-900 block truncate">
                                                            {item.areacode || `Area ${item.areaid}`}
                                                        </span>
                                                        <span className="text-[11px] text-slate-500 block truncate font-medium">
                                                            {item.areaname}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
