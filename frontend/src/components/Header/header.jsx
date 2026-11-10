import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Menu, User, LogOut, ChevronDown, Building2 } from 'lucide-react';
import { usersAPI } from '../../utils/api';
import NotificationPopup from '../notif/notif';
import { API_BASE_URL } from '../../utils/apiBase';
import { toggleMobileNavbar } from '../Navigation/navbar';
import SmartUserAvatar from '../UI/SmartUserAvatar';

function displayNameFromUser(user) {
  if (!user || typeof user !== 'object') return '';
  if (user.FullName && String(user.FullName).trim()) return String(user.FullName).trim();
  const { firstname, middleinitial, lastname } = user;
  if (!firstname && !lastname) return '';
  const mid = middleinitial ? ` ${middleinitial}.` : '';
  return `${firstname || ''}${mid} ${lastname || ''}`.replace(/\s+/g, ' ').trim();
}

function readStoredDisplayName() {
  const legacy = localStorage.getItem('name');
  if (legacy && legacy.trim()) return legacy.trim();
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    return displayNameFromUser(JSON.parse(raw));
  } catch {
    return '';
  }
}

function readStoredUserRole() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return '';
    const u = JSON.parse(raw);
    if (u.rolename) return u.rolename;
    const roleid = Number(u.roleid);
    if (roleid === 1) return 'Administrator';
    if (roleid === 4) return 'Auditor';
    if (roleid === 3) return 'Office Head';
    if (roleid === 2) return 'Staff';
    return '';
  } catch {
    return '';
  }
}

export default function Header({ onToggleMobileMenu, isAdmin: propIsAdmin }) {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(new Date());
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const isAdmin = propIsAdmin !== undefined ? propIsAdmin : Boolean(
    currentUser && (
      Number(currentUser.roleid) === 1 ||
      String(currentUser.rolename || '').toLowerCase() === 'admin' ||
      String(currentUser.rolename || '').toLowerCase() === 'administrator'
    )
  );

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationWrapperRef = useRef(null);
  const profileDropdownRef = useRef(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationWrapperRef.current && !notificationWrapperRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setShowProfileMenu(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('name');
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  // Fetch unread count
  useEffect(() => {
    const token = localStorage.getItem('token');
    let userid = null;
    if (token) {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          userid = JSON.parse(userData).userid;
        } catch {}
      }
    }
    if (!userid) return;

    const fetchUnread = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/notifications/user/${userid}/counts`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (response.ok) {
          const data = await response.json();
          const unread = Number(data?.data?.unread ?? data?.unread ?? 0);
          setUnreadCount(Number.isFinite(unread) ? unread : 0);
        }
      } catch (err) {
        // silent fail
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);

    const onNotificationsUpdated = () => fetchUnread();
    window.addEventListener('notificationsUpdated', onNotificationsUpdated);
    window.addEventListener('app:data-sync', onNotificationsUpdated);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationsUpdated', onNotificationsUpdated);
      window.removeEventListener('app:data-sync', onNotificationsUpdated);
    };
  }, []);

  // User profile and clock sync
  useEffect(() => {
    setName(readStoredDisplayName());
    setRole(readStoredUserRole());

    const refreshFromServer = async () => {
      try {
        const response = await usersAPI.getLoggedInUser();
        if (response.success && response.user) {
          setCurrentUser(response.user);
          const n = displayNameFromUser(response.user);
          if (n) setName(n);
          if (response.user.rolename) setRole(response.user.rolename);
        }
      } catch {
        setName(readStoredDisplayName());
        setRole(readStoredUserRole());
      }
    };
    refreshFromServer();

    const onProfileUpdated = () => refreshFromServer();
    const onStorage = (e) => {
      if (e.key === 'user' || e.key === 'name') {
        try {
          const raw = localStorage.getItem('user');
          if (raw) setCurrentUser(JSON.parse(raw));
        } catch {}
        setName(readStoredDisplayName());
        setRole(readStoredUserRole());
      }
    };
    window.addEventListener('profileUpdated', onProfileUpdated);
    window.addEventListener('storage', onStorage);

    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timer);
      window.removeEventListener('profileUpdated', onProfileUpdated);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Calm, human-friendly date & time formatting
  const formattedDate = dateTime.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const formattedTime = dateTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <header
      className={`fixed top-0 left-0 w-full z-40 ${isAdmin ? 'lg:left-[var(--sidebar-width)] lg:w-[calc(100%-var(--sidebar-width))]' : ''} transition-[left,width] duration-200`}
      style={{ height: '56px' }}
    >
      <div className="flex items-center justify-between h-full px-4 sm:px-6 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        {/* Left Side: Mobile Hamburger Menu + Human Context & Greeting */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Hamburger Button (Only shown if Admin has sidebar) */}
          {isAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleMobileMenu) {
                  onToggleMobileMenu();
                } else {
                  toggleMobileNavbar();
                }
              }}
              className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 shrink-0 cursor-pointer"
              aria-label="Open navigation menu"
              title="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Clean User Identity Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate(isAdmin ? '/home' : '/home/acc-management')}
              className="text-xs font-semibold text-slate-400 hover:text-blue-600 hidden sm:inline select-none tracking-wide uppercase cursor-pointer transition-colors"
              title="Go to main workspace"
            >
              Auditrack
            </button>
            <span className="text-slate-300 hidden sm:inline select-none">/</span>
            <span className="text-sm font-semibold text-slate-800 truncate">
              {name ? `Hello, ${name}` : 'Welcome'}
            </span>
            {role && (
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-600 border border-slate-200/80 select-none">
                {role}
              </span>
            )}
          </div>
        </div>

        {/* Right Side: Neutral Date/Time Pill + Notification Bell + Profile Avatar Dropdown */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Human-formatted Live Date/Time */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50/80 border border-slate-200/70 text-xs text-slate-600 font-medium select-none shadow-2xs">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]" title="Connected" />
            <span className="text-slate-700 font-semibold">{formattedDate}</span>
            <span className="text-slate-300 font-light">·</span>
            <span className="text-slate-500 font-medium">{formattedTime}</span>
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notificationWrapperRef}>
            <button
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowProfileMenu(false);
              }}
              aria-label="Show notifications"
              title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
            >
              <Bell className="w-[18px] h-[18px] text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white shadow-xs pointer-events-none select-none leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Popup */}
            {showNotifications && (
              <div className="absolute right-0 z-50 mt-2 flex w-[360px] sm:w-[390px] max-h-[min(540px,calc(100vh-5.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100">
                <NotificationPopup onClose={() => setShowNotifications(false)} />
              </div>
            )}
          </div>

          {/* User Profile Avatar with Dropdown Options */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu((v) => !v);
                setShowNotifications(false);
              }}
              className="flex items-center gap-1.5 sm:gap-2 p-1 pl-1 pr-1.5 sm:pr-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              aria-label="User profile menu"
              title={name ? `${name} - Account Options` : "My Profile"}
            >
              <SmartUserAvatar
                user={currentUser}
                size="w-7 h-7 sm:w-7.5 sm:h-7.5"
                textSize="text-[11px] font-bold"
                ring="ring-1 ring-blue-500/20 shadow-2xs"
              />
              <span className="hidden md:inline-block text-xs font-semibold text-slate-700 max-w-[100px] truncate">
                {name ? name.split(' ')[0] : 'Profile'}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProfileMenu ? 'rotate-180 text-blue-600' : ''}`} />
            </button>

            {/* Profile Dropdown Popup */}
            {showProfileMenu && (
              <div className="absolute right-0 z-50 mt-2 w-64 sm:w-72 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-100 p-1.5">
                {/* User Identity Info Card */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 border border-slate-100 mb-1">
                  <SmartUserAvatar
                    user={currentUser}
                    size="w-10 h-10"
                    textSize="text-sm font-bold"
                    ring="ring-2 ring-blue-500/30 shadow-xs"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {name || 'User'}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      {currentUser?.Email || currentUser?.email || 'No email registered'}
                    </span>
                    {role && (
                      <span className="mt-1 inline-flex items-center self-start px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80">
                        {role}
                      </span>
                    )}
                  </div>
                </div>

                {/* Navigation: Programs & Offices (Non-admin workspace shortcut) */}
                {!isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/home/acc-management');
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 transition cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">Programs &amp; Offices</span>
                      <span className="text-[10px] text-slate-400 font-normal">Audits &amp; requirements</span>
                    </div>
                  </button>
                )}

                {/* Navigation: My Profile */}
                <button
                  type="button"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate('/home/profile');
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 transition cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-105 transition-transform">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700">My Profile</span>
                    <span className="text-[10px] text-slate-400 font-normal">View &amp; edit account details</span>
                  </div>
                </button>

                {/* Divider */}
                <div className="my-1 border-t border-slate-100" />

                {/* Action: Sign Out */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer group"
                >
                  <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 group-hover:scale-105 transition-transform">
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-rose-600">Sign Out</span>
                    <span className="text-[10px] text-rose-400 font-normal">Log out of your session</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
