import axios from "axios";
import { NavLink } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import auditrackLogo from "../../assets/images/logo.png";
import { usersAPI } from "../../utils/api";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from '../../utils/apiBase';
import { Activity, Building2, Layers } from "lucide-react";
import SmartUserAvatar from "../UI/SmartUserAvatar";

let toggleMobileNavbarHandler = null;

export function toggleMobileNavbar() {
    if (typeof toggleMobileNavbarHandler === 'function') {
        toggleMobileNavbarHandler();
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('toggleMobileMenu'));
    }
}

export default function Navbar({ isMobileMenuOpen: propIsMobileMenuOpen, setIsMobileMenuOpen: propSetIsMobileMenuOpen }) {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const stored = localStorage.getItem("user");
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const isAdmin = Boolean(
        currentUser && (
            Number(currentUser.roleid) === 1 ||
            String(currentUser.rolename || '').toLowerCase() === 'admin' ||
            String(currentUser.rolename || '').toLowerCase() === 'admin' ||
            String(currentUser.rolename || '').toLowerCase() === 'administrator'
        )
    );

    const getInitialSidebarExpanded = () => {
        if (typeof window === 'undefined') return false;
        if (isAdmin) {
            document.documentElement.style.setProperty('--sidebar-width', 'calc(4rem / 0.9)');
        } else {
            document.documentElement.style.setProperty('--sidebar-width', '0px');
        }
        return false;
    };

    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [internalIsMobileMenuOpen, setInternalIsMobileMenuOpen] = useState(false);
    const isMobileMenuOpen = propIsMobileMenuOpen !== undefined ? propIsMobileMenuOpen : internalIsMobileMenuOpen;
    const setIsMobileMenuOpen = propSetIsMobileMenuOpen || setInternalIsMobileMenuOpen;
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(getInitialSidebarExpanded);
    const [isHoverExpanded, setIsHoverExpanded] = useState(false);
    const [expandOnHover, setExpandOnHover] = useState(() => {
        if (typeof window === 'undefined') return true;
        const stored = window.localStorage.getItem('sidebarExpandOnHover');
        return stored === null ? true : stored === 'true';
    });
    const profileMenuRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const navigate = useNavigate();

    // Persist expand on hover preference
    useEffect(() => {
        localStorage.setItem('sidebarExpandOnHover', String(expandOnHover));
    }, [expandOnHover]);

    // Unified logout function
    const handleLogout = () => {
        localStorage.removeItem("token");
        delete axios.defaults.headers.common["Authorization"];
        navigate("/login");
    };

    // Fetch current user data
    useEffect(() => {
        const getCurrentUserData = async () => {
            try {
                const response = await usersAPI.getLoggedInUser();
                if (response.success) setCurrentUser(response.user);
            } catch (error) {
                console.error('Error fetching current user:', error);
                const storedUser = localStorage.getItem("user");
                if (storedUser) setCurrentUser(JSON.parse(storedUser));
            }
        };
        getCurrentUserData();
    }, []);

    // Listen for profile updates
    useEffect(() => {
        const handleProfileUpdated = () => {
            const getCurrentUserData = async () => {
                try {
                    const response = await usersAPI.getLoggedInUser();
                    if (response.success) setCurrentUser(response.user);
                } catch (error) {
                    console.error('Error fetching current user:', error);
                }
            };
            getCurrentUserData();
        };
        window.addEventListener('profileUpdated', handleProfileUpdated);
        return () => {
            window.removeEventListener('profileUpdated', handleProfileUpdated);
        };
    }, []);

    // Persist explicit expanded state, but don't override hover-driven temporary expansion.
    useEffect(() => {
        localStorage.setItem('sidebarExpanded', String(isSidebarExpanded));
    }, [isSidebarExpanded]);

    const effectiveExpanded = isSidebarExpanded || isHoverExpanded;
    useEffect(() => {
        // Keep layout offset fixed; sidebar expands as an overlay.
        document.documentElement.style.setProperty('--sidebar-width', 'calc(4rem / 0.9)');
    }, [effectiveExpanded]);

    // Close menus on outside click & listen for header mobile menu toggle
    useEffect(() => {
        toggleMobileNavbarHandler = () => {
            setIsMobileMenuOpen(prev => !prev);
        };

        function handleClickOutside(event) {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
                setIsProfileMenuOpen(false);
            }
        }

        const handleToggleMobileMenu = () => {
            setIsMobileMenuOpen(prev => !prev);
        };
        const handleOpenMobileMenu = () => {
            setIsMobileMenuOpen(true);
        };
        const handleCloseMobileMenu = () => {
            setIsMobileMenuOpen(false);
        };

        window.addEventListener('toggleMobileMenu', handleToggleMobileMenu);
        window.addEventListener('openMobileMenu', handleOpenMobileMenu);
        window.addEventListener('closeMobileMenu', handleCloseMobileMenu);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            toggleMobileNavbarHandler = null;
            window.removeEventListener('toggleMobileMenu', handleToggleMobileMenu);
            window.removeEventListener('openMobileMenu', handleOpenMobileMenu);
            window.removeEventListener('closeMobileMenu', handleCloseMobileMenu);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // NavLink style function matching user design
    const navLinkClass = ({ isactive }) =>
        `flex items-center rounded-xl transition-all duration-150 text-xs font-semibold ${
            effectiveExpanded ? 'gap-3 px-3.5 py-2.5 justify-start' : 'h-10 w-10 mx-auto px-0 justify-center'
        } ${
            isactive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-200 hover:text-white hover:bg-white/5 font-semibold'
        }`;

    const labelStyle = {
        maxWidth: effectiveExpanded ? '12rem' : '0px',
    };

    const labelClass = `text-xs font-semibold whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-200 ${
        effectiveExpanded ? 'opacity-100 translate-x-0 delay-150' : 'opacity-0 -translate-x-2 delay-0'
    }`;

    const sectionStyle = {
        maxHeight: effectiveExpanded ? '30px' : '0px',
    };

    const sectionClass = `flex items-center gap-2 px-3 pt-3 pb-1 overflow-hidden transition-[max-height,opacity,transform] duration-200 ${
        effectiveExpanded ? 'opacity-100 translate-x-0 delay-150' : 'opacity-0 -translate-x-2 delay-0 pointer-events-none'
    }`;

    const renderDashboardIcon = () => (
        <Activity className="w-4 h-4 shrink-0 mx-auto" />
    );

    const renderDownloadsIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    );

    const renderAccreditationIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
    );

    const renderMasterListIcon = () => (
        <Layers className="w-4 h-4 shrink-0 mx-auto" />
    );

    const renderProgramsOfficesIcon = () => (
        <Building2 className="w-4 h-4 shrink-0 mx-auto" />
    );

    const renderOfficePersonnelIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
    );

    const renderExternalAuditorsIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
    );

    const renderUsersIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    );

    const renderAuditLogsIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    );

    const mobileNavLinkClass = ({ isactive }) =>
        `flex items-center gap-3 py-2.5 px-3.5 rounded-xl transition-all duration-150 text-xs font-semibold ${
            isactive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 font-bold'
                : 'text-slate-200 hover:text-white hover:bg-white/5'
        }`;

    const mobileSectionClass = "flex items-center gap-2 px-3 pt-3 pb-1";

    if (!isAdmin) {
        return null;
    }

    return (
        <>
            {/* Desktop Sidebar */}
            <nav
                onMouseEnter={() => { if (!isSidebarExpanded && expandOnHover) setIsHoverExpanded(true); }}
                onMouseLeave={() => { if (!isSidebarExpanded) setIsHoverExpanded(false); }}
                className={`nav-no-zoom hidden lg:flex fixed top-0 left-0 h-screen border-r border-slate-800/80 shadow-2xl z-[60] flex-col justify-between p-3.5 overflow-hidden transition-[width] duration-200 ease-in-out ${effectiveExpanded ? 'w-64' : 'w-16'}`}
                style={{ background: '#090e1a' }}
            >
                <div className="flex flex-col space-y-1.5">
                    {/* Logo Header */}
                    <div className={`mb-2 flex items-center py-1 ${effectiveExpanded ? 'gap-2.5 px-2 justify-start' : 'justify-center'}`}>
                        <img src={auditrackLogo} alt="Auditrack Logo" className="w-7 h-7 object-contain shrink-0" />
                        <span
                            className={`font-bold text-white text-base truncate whitespace-nowrap overflow-hidden tracking-wide transition-[max-width,opacity,transform] duration-200 ${
                                effectiveExpanded ? 'opacity-100 translate-x-0 delay-150' : 'opacity-0 -translate-x-2 delay-0'
                            }`}
                            style={{ maxWidth: effectiveExpanded ? '10rem' : '0px' }}
                        >
                            Auditrack
                        </span>
                    </div>

                    {/* Section: ANALYZE */}
                    {currentUser && currentUser.roleid === 1 && (
                        <div className="space-y-1">
                            <div className={sectionClass} style={sectionStyle}>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Analyze</span>
                            </div>
                            <NavLink to="/home" className={navLinkClass}>
                                <span className="w-4 text-center shrink-0">
                                    {renderDashboardIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Dashboard</span>
                            </NavLink>
                        </div>
                    )}

                    {/* Section: MANAGEMENT */}
                    <div className="space-y-1">
                        <div className={sectionClass} style={sectionStyle}>
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Management</span>
                        </div>

                        {isAdmin && (
                            <NavLink
                                to="/home/events"
                                onClick={(e) => {
                                    if (window.location.pathname === '/home/officehead') {
                                        e.preventDefault();
                                        window.location.href = '/home/events';
                                    }
                                }}
                                className={navLinkClass}
                            >
                                <span className="w-4 text-center shrink-0">
                                    {renderDownloadsIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Downloads</span>
                            </NavLink>
                        )}

                        <NavLink
                            to="/home/allc"
                            className={navLinkClass}
                        >
                            <span className="w-4 text-center shrink-0">
                                {renderAccreditationIcon()}
                            </span>
                            <span className={labelClass} style={labelStyle}>Accreditation</span>
                        </NavLink>

                        {isAdmin && (
                            <NavLink
                                to="/home/master-list"
                                className={navLinkClass}
                            >
                                <span className="w-4 text-center shrink-0">
                                    {renderMasterListIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Master List</span>
                            </NavLink>
                        )}

                        <NavLink
                            to="/home/acc-management"
                            className={navLinkClass}
                        >
                            <span className="w-4 text-center shrink-0">
                                {renderProgramsOfficesIcon()}
                            </span>
                            <span className={labelClass} style={labelStyle}>Programs and Offices</span>
                        </NavLink>
                    </div>

                    {/* Section: USERS (Admin only) */}
                    {isAdmin && (
                        <div className="space-y-1">
                            <div className={sectionClass} style={sectionStyle}>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Users</span>
                            </div>
                            <NavLink to="/home/officehead" className={navLinkClass}>
                                <span className="w-4 text-center shrink-0">
                                    {renderOfficePersonnelIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Office Personnel</span>
                            </NavLink>
                            <NavLink to="/home/external-auditors" className={navLinkClass}>
                                <span className="w-4 text-center shrink-0">
                                    {renderExternalAuditorsIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>External Auditors</span>
                            </NavLink>
                            <NavLink to="/home/users" className={navLinkClass}>
                                <span className="w-4 text-center shrink-0">
                                    {renderUsersIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Users</span>
                            </NavLink>
                        </div>
                    )}

                    {/* Section: LOGS */}
                    {currentUser && currentUser.roleid === 1 && (
                        <div className="space-y-1">
                            <div className={sectionClass} style={sectionStyle}>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Logs</span>
                            </div>
                            <NavLink to="/home/audit-logs" className={navLinkClass}>
                                <span className="w-4 text-center shrink-0">
                                    {renderAuditLogsIcon()}
                                </span>
                                <span className={labelClass} style={labelStyle}>Audit Logs</span>
                            </NavLink>
                        </div>
                    )}
                </div>

                {/* Hover Expand Toggle Preference */}
                <div className={`mt-auto mb-1.5 p-1.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center transition-all duration-200 ${effectiveExpanded ? 'justify-between px-2.5' : 'justify-center'}`}>
                    <div className={`flex items-center gap-2 min-w-0 overflow-hidden transition-[max-width,opacity] duration-200 ${effectiveExpanded ? 'max-w-[10rem] opacity-100' : 'max-w-0 opacity-0'}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${expandOnHover ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-500'}`} />
                        <span className="text-[11px] font-semibold text-slate-300 truncate whitespace-nowrap">Expand on hover</span>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpandOnHover(prev => !prev);
                        }}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-slate-600/50 transition-colors duration-200 ease-in-out focus:outline-none ${
                            expandOnHover ? 'bg-blue-600' : 'bg-slate-700/80'
                        }`}
                        title={expandOnHover ? 'Hover expand is ON (click to disable)' : 'Hover expand is OFF (click to enable)'}
                        aria-label="Toggle expand on hover"
                    >
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out mt-[2px] ${
                                expandOnHover ? 'translate-x-4 ml-[2px]' : 'translate-x-0.5'
                            }`}
                        />
                    </button>
                </div>

                {/* Bottom Profile Section */}
                <div className="relative border-t border-slate-800/80 pt-2.5" ref={profileMenuRef}>
                    <div className={`flex items-center p-1.5 hover:bg-white/5 rounded-xl transition-colors duration-200 ${effectiveExpanded ? 'justify-between' : 'justify-center'}`}>
                        <NavLink to="/home/Profile" className={`flex items-center ${effectiveExpanded ? 'gap-2.5 flex-1 min-w-0' : 'justify-center'}`}>
                            <SmartUserAvatar
                                user={currentUser}
                                size="w-8 h-8"
                                textSize="text-xs font-bold"
                                ring="border border-slate-700/60 shadow-sm"
                            />
                            <div
                                className={`flex flex-col whitespace-nowrap overflow-hidden transition-[max-width,opacity,transform] duration-200 ${
                                    effectiveExpanded ? 'opacity-100 translate-x-0 delay-150' : 'opacity-0 -translate-x-2 delay-0'
                                }`}
                                style={{ maxWidth: effectiveExpanded ? '11rem' : '0px' }}
                            >
                                <span className="text-xs font-bold text-white leading-tight truncate">
                                    {currentUser
                                        ? `${currentUser.firstname}${currentUser.middleinitial ? ' ' + currentUser.middleinitial + '.' : ''} ${currentUser.lastname}`
                                        : 'Loading...'}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium leading-tight truncate mt-0.5">View Profile</span>
                            </div>
                        </NavLink>

                        {effectiveExpanded && (
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="p-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors duration-200 cursor-pointer"
                                aria-label="Profile actions"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {isProfileMenuOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl overflow-hidden py-1" style={{ background: '#090e1a', border: '1px solid rgba(59,130,246,0.3)' }}>
                            <button
                                onClick={handleLogout}
                                className="flex w-full items-center gap-3 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors duration-200 cursor-pointer"
                            >
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </nav>

            {/* Mobile Navigation Drawer */}
            <div className="lg:hidden">
                {/* Mobile Menu Backdrop */}
                {isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/60 z-[9998] backdrop-blur-xs transition-opacity duration-300"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Mobile Sidebar Drawer */}
                <div
                    ref={mobileMenuRef}
                    className={`nav-no-zoom fixed top-0 left-0 h-screen w-72 max-w-[85vw] shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out ${
                        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                    } flex flex-col justify-between p-4`}
                    style={{ background: '#090e1a' }}
                >
                    {/* Mobile Drawer Top Brand & Close Button */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 shrink-0">
                        <div className="flex items-center gap-2.5">
                            <img src={auditrackLogo} alt="Auditrack Logo" className="w-7 h-7 object-contain" />
                            <span className="font-bold text-white text-base">Auditrack</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="p-1.5 rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            aria-label="Close menu"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col space-y-4 py-3 min-h-0">
                        {/* Analyze */}
                        {currentUser && currentUser.roleid === 1 && (
                            <div className="space-y-1">
                                <div className={mobileSectionClass}>
                                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Analyze</span>
                                </div>
                                <NavLink
                                    to="/home"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderDashboardIcon()}</span>
                                    <span className="text-xs font-semibold">Dashboard</span>
                                </NavLink>
                            </div>
                        )}

                        {/* Management */}
                        <div className="space-y-1">
                            <div className={mobileSectionClass}>
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-500">Management</span>
                            </div>

                            {isAdmin && (
                                <NavLink
                                    to="/home/events"
                                    onClick={(e) => {
                                        if (window.location.pathname === '/home/officehead') {
                                            e.preventDefault();
                                            window.location.href = '/home/events';
                                            return;
                                        }
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={mobileNavLinkClass}
                                >
                                    <span className="w-4 text-center">{renderDownloadsIcon()}</span>
                                    <span className="text-xs font-semibold">Downloads</span>
                                </NavLink>
                            )}

                            <NavLink
                                to="/home/allc"
                                className={mobileNavLinkClass}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="w-4 text-center">{renderAccreditationIcon()}</span>
                                <span className="text-xs font-medium">Accreditation</span>
                            </NavLink>

                            {isAdmin && (
                                <NavLink
                                    to="/home/master-list"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderMasterListIcon()}</span>
                                    <span className="text-xs font-medium">Master List</span>
                                </NavLink>
                            )}

                            <NavLink
                                to="/home/acc-management"
                                className={mobileNavLinkClass}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                <span className="w-4 text-center">{renderProgramsOfficesIcon()}</span>
                                <span className="text-xs font-semibold">Programs and Offices</span>
                            </NavLink>
                        </div>

                        {/* Users (Admin only) */}
                        {isAdmin && (
                            <div className="space-y-1">
                                <div className={mobileSectionClass}>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Users</span>
                                </div>
                                <NavLink
                                    to="/home/officehead"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderOfficePersonnelIcon()}</span>
                                    <span className="text-xs font-medium">Office Personnel</span>
                                </NavLink>
                                <NavLink
                                    to="/home/external-auditors"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderExternalAuditorsIcon()}</span>
                                    <span className="text-xs font-medium">External Auditors</span>
                                </NavLink>
                                <NavLink
                                    to="/home/users"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderUsersIcon()}</span>
                                    <span className="text-xs font-medium">Users</span>
                                </NavLink>
                            </div>
                        )}

                        {/* Logs */}
                        {currentUser && currentUser.roleid === 1 && (
                            <div className="space-y-1">
                                <div className={mobileSectionClass}>
                                    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Logs</span>
                                </div>
                                <NavLink
                                    to="/home/audit-logs"
                                    className={mobileNavLinkClass}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="w-4 text-center">{renderAuditLogsIcon()}</span>
                                    <span className="text-xs font-medium">Audit Logs</span>
                                </NavLink>
                            </div>
                        )}
                    </div>

                    {/* Mobile Profile Section */}
                    <div className="relative border-t border-blue-900/60 pt-3 shrink-0">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                            <NavLink
                                to="/home/Profile"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="flex items-center gap-2.5 flex-1 min-w-0 pr-2 hover:opacity-90 transition-opacity"
                            >
                                <SmartUserAvatar
                                    user={currentUser}
                                    size="w-9 h-9"
                                    textSize="text-xs font-bold"
                                    ring="ring-1 ring-blue-400/40 shadow-sm"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-semibold text-white truncate">
                                        {currentUser
                                            ? `${currentUser.firstname || ''}${currentUser.middleinitial ? ' ' + currentUser.middleinitial + '.' : ''} ${currentUser.lastname || ''}`.trim() || currentUser.FullName || 'User'
                                            : 'Loading...'}
                                    </span>
                                    <span className="text-[10px] text-blue-300 truncate">
                                        {currentUser?.rolename || 'View Profile'}
                                    </span>
                                </div>
                            </NavLink>

                            {/* Mobile Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-200 hover:text-white bg-red-500/20 hover:bg-red-600 border border-red-500/30 transition-colors cursor-pointer shrink-0"
                                title="Sign Out"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
};
