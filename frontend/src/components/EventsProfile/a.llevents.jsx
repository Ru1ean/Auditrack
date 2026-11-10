import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { eventsAPI } from "../../utils/api";
import { useModal } from "../UI/ModalProvider";
import { useToast } from "../UI/Toast";
import ServerOfflineState from "../UI/ServerOfflineState";

const EventsP = forwardRef(({ searchTerm = '', deleteMode = false, onSelectionChange, onEventClick }, ref) => {
    const [events, setEvents] = useState([]);
    const [filteredEvents, setFilteredEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEvents, setSelectedEvents] = useState(new Set());
    const [downloadableFolders, setDownloadableFolders] = useState([]);
    const { showAlert } = useModal();
    const { toast } = useToast();

    // Fetch events data from database
    useEffect(() => {
        fetchEvents();
        // Fetch downloadable folders on mount
        eventsAPI.getDownloadableFolders().then(res => {
            if (res.success) setDownloadableFolders(res.folders);
        });
    }, []);

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
                return { success: false, message: 'Network error. Please check if the backend server is running on port 5000.' };
            }
            
            if (error.response) {
                return { success: false, message: `Server error: ${error.response.data?.message || error.response.statusText}` };
            }
            
            return { success: false, message: `Error deleting events: ${error.message}` };
        }
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

    const refreshData = () => {
        fetchEvents();
    };

    useImperativeHandle(ref, () => ({
        refresh: refreshData,
        deleteSelected: deleteSelectedEvents
    }));

    // Get status badge style
    const getStatusStyle = (event) => {
        if (event.createdat) {
            return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        }
        return 'bg-gray-50 text-gray-600 border-gray-200';
    };

    if (loading) {
        return (
            <div className="w-full py-8">
                <div className="flex flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent"></div>
                    <span className="mt-3 text-sm text-gray-500">Loading events...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <ServerOfflineState
                onRetry={() => fetchEvents(true)}
                isRetrying={isRetrying}
                title={error === 'Server Offline' ? 'Backend Server Unavailable' : 'Unable to Load Events'}
                message={error === 'Server Offline' 
                    ? 'The backend server is unreachable or offline. If you stopped the backend server, please start it and click Retry Connection.' 
                    : error}
            />
        );
    }

    if (filteredEvents.length === 0 && !loading) {
        return (
            <div className="w-full py-12">
                <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {searchTerm ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            )}
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-1">
                        {searchTerm ? 'No Results Found' : 'No Events Found'}
                    </h3>
                    <p className="text-xs text-gray-500">
                        {searchTerm 
                            ? `No events match "${searchTerm}"`
                            : 'No compliance events available yet.'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-2">
            {/* Search Results Counter */}
            {searchTerm && (
                <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 rounded-lg">
                    Showing {filteredEvents.length} of {events.length} events
                </div>
            )}
            
            <div className="space-y-2 pt-1 pb-1">
                {filteredEvents.map((event) => (
                    <div 
                        key={event.eventid}
                        onClick={() => !deleteMode && onEventClick && onEventClick(event)}
                        className={`
                            relative bg-white rounded-lg border
                            ${deleteMode 
                                ? 'border-slate-200' 
                                : 'border-slate-200/80 app-card-hover cursor-pointer'
                            }
                            ${selectedEvents.has(event.eventid) 
                                ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/30' 
                                : ''
                            }
                        `}
                    >
                        <div className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                                {/* Checkbox for delete mode */}
                                {deleteMode && (
                                    <div className="flex-shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={selectedEvents.has(event.eventid)}
                                            onChange={(e) => handleCheckboxChange(event.eventid, e.target.checked)}
                                            className="w-3.5 h-3.5 text-indigo-600 border-gray-300 rounded focus:ring-brand-500"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                )}
                                
                                {/* Icon */}
                                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                
                                {/* Event Info - Compact */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-medium text-gray-900 truncate">
                                            {event.eventname}
                                        </h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusStyle(event)}`}>
                                            {event.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    
                                    {event.eventcode && (
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {event.eventcode}
                                        </p>
                                    )}
                                    
                                    {event.Description && (
                                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                                            {event.Description}
                                        </p>
                                    )}
                                </div>

                                {/* Download Button - Only if folder exists */}
                                {downloadableFolders.includes(event.eventname.replace(/[<>:"/\\|?*]/g, '_').trim()) && (
                                    <button
                                        className="flex-shrink-0 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center gap-1 border border-emerald-200"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            try {
                                                const sanitizedName = event.eventname.replace(/[<>:"/\\|?*]/g, '_').trim();
                                                const url = await eventsAPI.downloadEventZip(event.eventname);
                                                
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.download = `${sanitizedName}.zip`;
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                
                                                setTimeout(() => {
                                                    window.URL.revokeObjectURL(url);
                                                }, 100);
                                            } catch (err) {
                                                console.error('Download error:', err);
                                                await showAlert('Download failed: ' + (err.message || 'Unknown error'));
                                            }
                                        }}
                                        title="Download event folder"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span className="hidden sm:inline">Download</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

export default EventsPss;