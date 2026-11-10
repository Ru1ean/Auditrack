import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { useModal } from "../UI/ModalProvider";
import { useToast } from "../UI/Toast";
import { eventsAPI } from "../../utils/api";
import Pagination from "../Pagination/Pagination";
import { CardListSkeleton } from "../UI/Skeleton";
import { useLiveRefresh } from "../../utils/liveSync";
import ServerOfflineState from "../UI/ServerOfflineState";

const EventsP = forwardRef(({ searchTerm = '', deleteMode = false, viewMode = 'grid', onSelectionChange, onEventClick }, ref) => {
    const [events, setEvents] = useState([]);
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEvents, setSelectedEvents] = useState(new Set());
    const [downloadableFolders, setDownloadableFolders] = useState([]);
    const [downloadingId, setDownloadingId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const { showAlert } = useModal();
    const { toast } = useToast();

    const itemsPerPage = viewMode === 'grid' ? 12 : 20;

    // Helper to normalize folder/event names to a consistent form
    const normalizeName = (s) => {
        if (!s) return '';
        return String(s)
            .replace(/[^A-Za-z0-9.-]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .trim();
    };

    const [isRetrying, setIsRetrying] = useState(false);

    const fetchEvents = useCallback(async (isRetry = false) => {
        try {
            if (isRetry) setIsRetrying(true);
            else setLoading(true);
            setError(null);
            const response = await eventsAPI.getAllEvents();

            if (response.success) {
                setEvents(response.data || []);
                setError(null);
            } else {
                setError('Failed to fetch events');
            }
        } catch (error) {
            console.error('Error fetching events:', error);
            setEvents([]);
            if (!error.response || error.code === 'ERR_NETWORK' || error.message?.toLowerCase().includes('network error') || error.message?.toLowerCase().includes('failed to fetch')) {
                setError('Server Offline');
            } else {
                setError(error.response?.data?.message || 'Failed to load events.');
            }
        } finally {
            setLoading(false);
            setIsRetrying(false);
        }
    }, []);

    // Fetch events data from database
    useEffect(() => {
        fetchEvents();
        // Fetch downloadable folders on mount
        eventsAPI.getDownloadableFolders().then(res => {
            if (res.success) setDownloadableFolders(res.folders || []);
        });
    }, [fetchEvents]);

    // Live syncing on mutations / window focus
    useLiveRefresh(fetchEvents);

    // Filter and sort events based on search term
    useEffect(() => {
        let filtered = events;

        // Apply search filter
        if (searchTerm.trim()) {
            filtered = events.filter(event => {
                const eventname = event.eventname?.toLowerCase() || '';
                const description = event.Description?.toLowerCase() || '';
                const eventcode = event.eventcode?.toLowerCase() || '';
                const searchLower = searchTerm.toLowerCase();

                return eventname.includes(searchLower) ||
                    description.includes(searchLower) ||
                    eventcode.includes(searchLower);
            });
        }

        // Sort by event name in ascending order
        const sortedFiltered = [...filtered].sort((a, b) => {
            return (a.eventname || '').localeCompare(b.eventname || '');
        });

        setFilteredEvents(sortedFiltered);
    }, [events, searchTerm]);

    // Handle selection changes and notify parent component
    useEffect(() => {
        if (onSelectionChange) {
            onSelectionChange(selectedEvents.size, Array.from(selectedEvents));
        }
    }, [selectedEvents, onSelectionChange]);

    // Clear selections when delete mode is turned off
    useEffect(() => {
        if (!deleteMode) {
            setSelectedEvents(new Set());
        }
    }, [deleteMode]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, viewMode]);

    useEffect(() => {
        const pageCount = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
        if (currentPage > pageCount) {
            setCurrentPage(1);
        }
    }, [filteredEvents.length, currentPage, itemsPerPage]);

    const handleCheckboxChange = (eventid, isChecked) => {
        setSelectedEvents(prev => {
            const newSet = new Set(prev);
            if (isChecked) {
                newSet.add(eventid);
            } else {
                newSet.delete(eventid);
            }
            return newSet;
        });
    };

    const deleteSelectedEvents = async (eventIds) => {
        try {
            console.log('Attempting to delete events:', eventIds);

            const response = await eventsAPI.deleteEvents(eventIds);

            if (response.success) {
                setEvents(prev => prev.filter(event => !eventIds.includes(event.eventid)));
                setSelectedEvents(new Set());
                toast?.({
                    title: 'Events Deleted',
                    description: `Successfully deleted ${eventIds.length} event(s)`,
                    variant: 'success',
                    duration: 3000,
                });
                return { success: true };
            } else {
                toast?.({
                    title: 'Delete Failed',
                    description: response.message || 'Failed to delete events',
                    variant: 'error',
                    duration: 3000,
                });
                return { success: false, message: response.message || 'Failed to delete events' };
            }
        } catch (error) {
            console.error('Error deleting events:', error);

            if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
                return { success: false, message: 'Network error. Please check if the backend server is running.' };
            }

            if (error.response) {
                return { success: false, message: `Server error: ${error.response.data?.message || error.response.statusText}` };
            }

            return { success: false, message: `Error deleting events: ${error.message}` };
        }
    };

    const handleDownloadZip = async (e, event) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            setDownloadingId(event.eventid);
            const keyName = event.eventid;
            const sanitizedName = String(event.eventcode || event.eventname || `event_${event.eventid}`).replace(/[<>:"/\\|?*]/g, '_').trim();
            const url = await eventsAPI.downloadEventZip(keyName);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${sanitizedName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);
        } catch (err) {
            console.error('Download error:', err);
            await showAlert('Download failed: ' + (err.message || 'Unknown error'));
        } finally {
            setDownloadingId(null);
        }
    };

    const refreshData = () => {
        fetchEvents();
    };

    useImperativeHandle(ref, () => ({
        refresh: refreshData,
        deleteSelected: deleteSelectedEvents
    }));

    if (loading) {
        return (
            <div className="w-full py-4">
                <CardListSkeleton count={6} />
            </div>
        );
    }

    if (error) {
        return (
            <ServerOfflineState
                onRetry={() => fetchEvents(true)}
                isRetrying={isRetrying}
                title={error === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Downloads'}
                message={error === 'Server Offline' 
                    ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                    : error}
            />
        );
    }

    if (filteredEvents.length === 0) {
        return (
            <div className="flex-1 w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-center bg-white/70 border border-dashed border-slate-200 rounded-2xl animate-fadeIn my-auto">
                <div className="w-16 h-16 bg-slate-100 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-1">
                    {searchTerm ? 'No Downloads Found' : 'No Downloadable Packages Available'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                    {searchTerm
                        ? `No events or downloadable packages match "${searchTerm}".`
                        : 'No compliance events or generated download archives are available yet.'}
                </p>
            </div>
        );
    }

    const totalPages = Math.max(1, Math.ceil(filteredEvents.length / itemsPerPage));
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedEvents = filteredEvents.slice(startIdx, startIdx + itemsPerPage);
    const visibleEvents = viewMode === 'list' ? filteredEvents : paginatedEvents;

    return (
        <div className={viewMode === 'list' ? 'mt-1 w-full flex flex-col pb-3' : 'w-full h-full min-h-0 flex-1 flex flex-col pt-1 px-0.5 overflow-hidden'}>
            {/* Search Results Counter */}
            {searchTerm.trim() && (
                <div className="text-xs text-slate-500 mb-2 shrink-0">
                    Showing {filteredEvents.length} of {events.length} event packages matching "{searchTerm}"
                </div>
            )}

            {viewMode === 'list' && (
                <div className="grid grid-cols-12 items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-2xs text-xs font-semibold text-gray-700 sticky top-0 z-30 min-w-[720px] mb-2">
                    <div className="col-span-5 flex items-center gap-2">
                        {deleteMode && <span>Select</span>}
                        <span>Event Name & Code</span>
                    </div>
                    <div className="col-span-3 flex items-center">Status</div>
                    <div className="col-span-2 flex items-center">Archive Status</div>
                    <div className="col-span-2 flex items-center justify-end">Download</div>
                </div>
            )}

            <div className={viewMode === 'list' ? 'flex flex-col gap-2 pt-1 pb-1' : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 grid-rows-3 gap-3 flex-1 min-h-0 overflow-hidden'}>
                {visibleEvents.map((event) => {
                    const isFolderReady = downloadableFolders.some(folder => 
                        String(folder) === String(event.eventid) ||
                        normalizeName(folder) === normalizeName(event.eventcode) ||
                        normalizeName(folder) === normalizeName(event.eventname) ||
                        normalizeName(folder) === normalizeName(event.eventcode || event.eventname)
                    );
                    const isSelected = selectedEvents.has(event.eventid);
                    const isDownloading = downloadingId === event.eventid;

                    if (viewMode === 'list') {
                        return (
                            <div
                                key={event.eventid}
                                onClick={() => {
                                    if (deleteMode) handleCheckboxChange(event.eventid, !isSelected);
                                    else if (onEventClick) onEventClick(event);
                                }}
                                className={`relative rounded-xl border border-slate-200 bg-white shadow-2xs ${
                                    isSelected ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20' : ''
                                } ${deleteMode ? 'cursor-pointer hover:border-rose-300' : 'app-card-hover cursor-pointer'}`}
                            >
                                <div className="grid grid-cols-12 items-center gap-3 px-4 py-3">
                                    {/* Event Name & Code (col-span-5) */}
                                    <div className="flex items-center gap-3 col-span-5 min-w-0">
                                        {deleteMode && (
                                            <div className="shrink-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={(e) => handleCheckboxChange(event.eventid, e.target.checked)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                />
                                            </div>
                                        )}
                                        <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="text-xs font-bold text-slate-900 truncate">{event.eventname}</h3>
                                                {event.eventcode && (
                                                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                        {event.eventcode}
                                                    </span>
                                                )}
                                            </div>
                                            {event.Description && (
                                                <p className="text-[10px] text-slate-500 truncate mt-0.5">{event.Description}</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Status (col-span-3) */}
                                    <div className="col-span-3 flex items-center">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${
                                            event.status === 'active' || event.createdat
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${event.status === 'active' || event.createdat ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                            {event.status === 'active' || event.createdat ? 'Active' : 'Archived'}
                                        </span>
                                    </div>

                                    {/* Archive Availability Status (col-span-2) */}
                                    <div className="col-span-2 flex items-center">
                                        {isFolderReady ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold">
                                                ZIP Ready
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 text-[10px] font-medium italic">
                                                Pending ZIP
                                            </span>
                                        )}
                                    </div>

                                    {/* Action (col-span-2) */}
                                    <div className="col-span-2 flex items-center justify-end">
                                        {isFolderReady ? (
                                            <button
                                                type="button"
                                                disabled={isDownloading}
                                                onClick={(e) => handleDownloadZip(e, event)}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                                            >
                                                <svg className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                <span>{isDownloading ? 'Downloading...' : 'Download ZIP'}</span>
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic">No package</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div
                            key={event.eventid}
                            className={`group relative flex flex-col justify-between rounded-2xl bg-white shadow-2xs transition-all duration-200 ${
                                isSelected
                                    ? 'border-2 border-rose-500 ring-2 ring-inset ring-rose-400/50 bg-rose-50/25 shadow-sm'
                                    : deleteMode
                                        ? 'border border-slate-200/90 hover:border-rose-300 cursor-pointer'
                                        : 'border border-slate-200/90 app-card-hover'
                            }`}
                        >
                            <div className="p-4 flex flex-col flex-1 justify-between gap-3">
                                {/* Card Top: Folder Icon + Code + Active Pill */}
                                <div className="flex items-center justify-between gap-2 shrink-0">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                            </svg>
                                        </div>
                                        {event.eventcode && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 truncate">
                                                {event.eventcode}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {deleteMode ? (
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => handleCheckboxChange(event.eventid, e.target.checked)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                            />
                                        ) : (
                                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide border ${
                                                event.status === 'active' || event.createdat
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${event.status === 'active' || event.createdat ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                                {event.status === 'active' || event.createdat ? 'Active' : 'Archived'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Event Title & Description */}
                                <div className="min-h-0 flex-1">
                                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors line-clamp-2 leading-snug">
                                        {event.eventname}
                                    </h3>
                                    {event.Description && (
                                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                            {event.Description}
                                        </p>
                                    )}
                                </div>

                                {/* Card Footer: Download Status and Action Button */}
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                                    <div className="min-w-0 flex-1">
                                        {isFolderReady ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                                ZIP Available
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic">
                                                No archive generated
                                            </span>
                                        )}
                                    </div>

                                    {isFolderReady && !deleteMode && (
                                        <button
                                            type="button"
                                            disabled={isDownloading}
                                            onClick={(e) => handleDownloadZip(e, event)}
                                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
                                        >
                                            <svg className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>{isDownloading ? 'Downloading...' : 'Download ZIP'}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {viewMode === 'grid' && (
                <div className="pt-2">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={(page) => setCurrentPage(page)}
                        fixed={true}
                        showWhenSinglePage={false}
                    />
                </div>
            )}
        </div>
    );
});

export default EventsP;