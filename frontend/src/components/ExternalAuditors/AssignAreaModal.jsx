import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "../../utils/apiBase";
import { useModal } from "../UI/ModalProvider";
import CustomSelect from "../UI/CustomSelect";

export default function AssignAreaModal({ show, auditor, onClose, onSaveSuccess }) {
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [areas, setAreas] = useState([]);
    const [loadingAreas, setLoadingAreas] = useState(false);
    const [selectedAreaIds, setSelectedAreaIds] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [saving, setSaving] = useState(false);
    const { showAlert } = useModal();

    // Fetch Accreditation Events and Areas on mount or when auditor changes
    useEffect(() => {
        if (!show || !auditor) return;

        let mounted = true;
        const loadData = async () => {
            try {
                setLoadingAreas(true);
                const token = localStorage.getItem('token');
                const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

                // 1. Fetch Events & filter only active ones
                const eventsRes = await fetch(`${API_BASE_URL}/api/events`, { headers });
                const eventsData = await eventsRes.json();
                const fetchedEvents = Array.isArray(eventsData) ? eventsData : (eventsData.events || eventsData.data || []);
                
                const activeEvents = fetchedEvents.filter(ev => {
                    const s = String(ev.status || ev.Status || ev.isactive || '').toLowerCase();
                    return s !== 'inactive' && s !== '0' && s !== 'false' && s !== 'archived';
                });
                if (mounted) setEvents(activeEvents);

                // 2. Fetch All Areas & filter active ones under active events
                const areasRes = await fetch(`${API_BASE_URL}/api/areas`, { headers });
                const areasData = await areasRes.json();
                const fetchedAreas = Array.isArray(areasData) ? areasData : (areasData.data || []);
                
                const activeEventIds = new Set(activeEvents.map(e => Number(e.eventid)));
                const activeAreas = fetchedAreas.filter(area => {
                    const isAreaActive = Number(area.isactive ?? 1) === 1;
                    const isParentEventActive = !area.eventid || activeEventIds.has(Number(area.eventid));
                    return isAreaActive && isParentEventActive;
                });
                if (mounted) setAreas(activeAreas);

                // 3. Fetch current auditor's assigned areas
                const targetUserId = auditor.userid ?? auditor.id ?? auditor.userid;
                let preferredEventId = '';
                if (targetUserId) {
                    const assignRes = await fetch(`${API_BASE_URL}/api/areas/assignments/${targetUserId}`, { headers });
                    if (assignRes.ok) {
                        const assignData = await assignRes.json();
                        const existingAssigned = assignData.assignments || [];
                        const assignedIds = new Set(existingAssigned.map(a => Number(a.areaid ?? a.areaid)));
                        if (mounted) setSelectedAreaIds(assignedIds);

                        // If auditor is already assigned in one of the active events, pick that as default
                        const match = existingAssigned.find(a => a.eventid && activeEvents.some(e => String(e.eventid) === String(a.eventid)));
                        if (match) {
                            preferredEventId = String(match.eventid);
                        }
                    }
                }

                if (mounted) {
                    const defaultId = preferredEventId || (activeEvents[0] ? String(activeEvents[0].eventid) : '');
                    setSelectedEventId(prev => (prev && activeEvents.some(e => String(e.eventid) === String(prev))) ? prev : defaultId);
                }
            } catch (err) {
                console.error("Error loading areas/events for assignment:", err);
            } finally {
                if (mounted) setLoadingAreas(false);
            }
        };

        loadData();
        return () => { mounted = false; };
    }, [show, auditor]);

    if (!show || !auditor) return null;

    const filteredAreas = areas.filter(area => {
        const matchesEvent = String(area.eventid) === String(selectedEventId);
        const code = String(area.areacode || '').toLowerCase();
        const name = String(area.areaname || '').toLowerCase();
        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !search || code.includes(search) || name.includes(search);
        return matchesEvent && matchesSearch;
    });

    const toggleArea = (areaid) => {
        setSelectedAreaIds(prev => {
            const next = new Set(prev);
            const numId = Number(areaid);
            if (next.has(numId)) {
                next.delete(numId);
            } else {
                next.add(numId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedAreaIds(prev => {
            const next = new Set(prev);
            filteredAreas.forEach(a => next.add(Number(a.areaid)));
            return next;
        });
    };

    const handleDeselectAll = () => {
        setSelectedAreaIds(prev => {
            const next = new Set(prev);
            filteredAreas.forEach(a => next.delete(Number(a.areaid)));
            return next;
        });
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const targetUserId = auditor.userid ?? auditor.id ?? auditor.userid;
            const res = await fetch(`${API_BASE_URL}/api/areas/assign`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    userid: targetUserId,
                    areaIds: Array.from(selectedAreaIds)
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                await showAlert(`Successfully updated area assignments for ${auditor.firstname} ${auditor.lastname}!`, 'success');
                onSaveSuccess?.();
                onClose?.();
            } else {
                await showAlert(data.message || 'Failed to save area assignments', 'error');
            }
        } catch (err) {
            console.error('Error saving area assignment:', err);
            await showAlert('Failed to save area assignments. Please check backend connection.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const fullName = `${auditor.firstname || ''} ${auditor.lastname || ''}`.trim() || 'Auditor';

    return createPortal(
        <div 
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-full bg-white/20 border border-white/30 text-white font-bold flex items-center justify-center text-lg shrink-0 shadow-inner">
                            {fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white leading-tight">Assign Areas to External Auditor</h3>
                            <p className="text-xs text-blue-100 mt-0.5">{fullName} ({auditor.Email})</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filter Toolbar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between shrink-0">
                    {/* Accreditation Dropdown */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Accreditation</label>
                        <CustomSelect
                            value={selectedEventId}
                            onChange={(val) => setSelectedEventId(val)}
                            options={events.map(ev => ({
                                value: String(ev.eventid),
                                label: `${ev.eventcode ? `${ev.eventcode}: ` : ''}${ev.eventname}`
                            }))}
                            placeholder={events.length === 0 ? "No active accreditations" : "Select Accreditation"}
                            size="sm"
                        />
                    </div>

                    {/* Search Bar */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Search Area</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search code or area name..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
                            />
                            <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Selection Count Bar */}
                <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between shrink-0 text-xs">
                    <span className="font-semibold text-blue-800">
                        {filteredAreas.filter(a => selectedAreaIds.has(Number(a.areaid))).length} of {filteredAreas.length} Area(s) Selected
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                            Select All Filtered
                        </button>
                        <span className="text-blue-200">|</span>
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                        >
                            Deselect All
                        </button>
                    </div>
                </div>

                {/* Area List Container */}
                <div className="p-4 overflow-y-auto flex-1 space-y-2 min-h-[220px]">
                    {loadingAreas ? (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                            <span className="text-xs">Loading available areas...</span>
                        </div>
                    ) : filteredAreas.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                            <p className="text-xs font-semibold text-slate-600">No matching areas found</p>
                            <p className="text-[11px] text-slate-400 mt-1">Try selecting a different accreditation or clearing your search term.</p>
                        </div>
                    ) : (
                        filteredAreas.map(area => {
                            const isChecked = selectedAreaIds.has(Number(area.areaid));
                            const targetUserId = auditor.userid ?? auditor.id ?? auditor.userid;
                            const isAssignedToOther = area.AuditorUserID && Number(area.AuditorUserID) !== Number(targetUserId);

                            return (
                                <label
                                    key={area.areaid}
                                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                                        isChecked 
                                            ? 'border-blue-500 bg-blue-50/70 shadow-xs' 
                                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleArea(area.areaid)}
                                        className="h-4 w-4 mt-0.5 accent-blue-600 rounded border-slate-300"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-blue-100 text-blue-700 shrink-0">
                                                    {area.areacode || 'AREA'}
                                                </span>
                                                <span className="font-semibold text-xs text-slate-800 truncate">
                                                    {area.areaname}
                                                </span>
                                            </div>
                                            {isAssignedToOther && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
                                                    Currently: {area.AuditorName || `Auditor #${area.AuditorUserID}`}
                                                </span>
                                            )}
                                        </div>
                                        {area.Description && (
                                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                                                {area.Description}
                                            </p>
                                        )}
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition"
                    >
                        {saving ? (
                            <>
                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Saving...
                            </>
                        ) : (
                            'Save Assignments'
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
