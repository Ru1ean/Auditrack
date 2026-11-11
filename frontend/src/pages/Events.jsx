import React, { useState, useRef, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { X } from "lucide-react";
import EventsP from "../components/EventsProfile/EventsProfle";
import { usersAPI } from "../utils/api";
import Header from "../components/Header/header";
import ViewModeToggle from "../components/UI/ViewModeToggle";

export default function Events() {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUser, setCurrentUser] = useState(null);
    const eventsPRef = useRef();

    const isAuditor = currentUser?.roleid === 4 || 
                      String(currentUser?.rolename || '').toLowerCase().includes('auditor') || 
                      currentUser?.isExternalAuditor;

    // Fetch current user on mount
    useEffect(() => {
        const fetchCurrentUser = async () => {
            try {
                const response = await usersAPI.getLoggedInUser();
                if (response.success) setCurrentUser(response.user);
            } catch (error) {
                console.error('Error fetching current user:', error);
            }
        };
        fetchCurrentUser();
    }, []);

    // Redirect Auditors away from Downloads page
    if (currentUser && isAuditor) {
        return <Navigate to="/home" replace />;
    }

    const [viewMode, setViewMode] = useState(() => {
        try {
            return localStorage.getItem('events_view_mode') || 'grid';
        } catch {
            return 'grid';
        }
    });

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        try {
            localStorage.setItem('events_view_mode', mode);
        } catch {}
    };

    return (
        <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-50/50 overflow-hidden">
            {/* Top Header Card */}
            <div className="px-4 sm:px-6 pt-4 pb-3.5 shrink-0 border-b border-slate-200/70 bg-white shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
                            <svg className="w-5 h-5 sm:w-5.5 sm:h-5.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">Accreditation Archives & Downloads</h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Download complete zipped standard packages, master trees, and office folders by event.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Toolbar: Search & View Mode Switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-100">
                    <div className="relative w-full sm:w-72 md:w-80">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        >
                            <circle cx="11" cy="11" r="7" />
                            <path d="m20 20-3.5-3.5" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Search event packages, code..."
                            className="h-9 w-full rounded-xl border border-slate-200/90 bg-slate-50/60 pl-10 pr-8 text-xs text-slate-800 placeholder-slate-400 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-slate-300"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-0.5 rounded-md cursor-pointer flex items-center justify-center"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* View Switcher: Segmented Toggle */}
                    <ViewModeToggle viewMode={viewMode} onChange={handleSetViewMode} className="self-end sm:self-auto" />
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 min-h-0 px-4 sm:px-6 pt-3 pb-3 flex flex-col overflow-hidden">
                <div className={`relative z-10 flex-1 min-h-0 ${viewMode === 'list' ? 'app-list-scroll overflow-x-auto pr-1' : 'flex flex-col h-full overflow-hidden'}`}>
                    <div className={`${viewMode === 'list' ? 'flex flex-col gap-0 min-w-[720px] pb-3' : 'flex-1 min-h-0 h-full flex flex-col overflow-hidden'}`}>
                        <EventsP 
                            ref={eventsPRef} 
                            searchTerm={searchTerm} 
                            deleteMode={false}
                            viewMode={viewMode}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
