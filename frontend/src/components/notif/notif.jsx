import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { buildNotificationRedirect, getDisplayMessage, getNotificationMeta } from '../../utils/notificationMeta';
import { API_BASE_URL } from '../../utils/apiBase';
import { CardListSkeleton } from "../UI/Skeleton";

export default function NotificationPopup({ onClose }) {
	const [notifications, setNotifications] = useState([]);
	const [filterStatus, setFilterStatus] = useState('all');
	const [loading, setLoading] = useState(false);
	const [currentUser, setCurrentUser] = useState(null);
	const [notificationCounts, setNotificationCounts] = useState({ total: 0, unread: 0, read: 0 });
	const [expandedIds, setExpandedIds] = useState(() => new Set());
	const navigate = useNavigate();

	const toggleExpanded = (e, notification) => {
		e.stopPropagation();
		const id = notification.notificationid;
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
		if (!notification.isread) {
			markAsRead(id);
		}
	};

	useEffect(() => {
		const token = localStorage.getItem('token');
		if (token) {
			const userData = localStorage.getItem('user');
			if (userData) {
				setCurrentUser(JSON.parse(userData));
			}
		}
	}, []);

	useEffect(() => {
		if (currentUser && currentUser.userid) {
			fetchNotifications();
			fetchNotificationCounts();
		}
	}, [currentUser, filterStatus]);

	const fetchNotifications = async () => {
		if (!currentUser?.userid) return;

		setLoading(true);
		try {
			const token = localStorage.getItem('token');
			const response = await axios.get(
				`${API_BASE_URL}/api/notifications/user/${currentUser.userid}?filter=${filterStatus}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			if (response.data.success) {
				setNotifications(response.data.data || []);
			}
		} catch (error) {
			console.error('Error fetching notifications:', error);
		} finally {
			setLoading(false);
		}
	};

	const fetchNotificationCounts = async () => {
		if (!currentUser?.userid) return;

		try {
			const token = localStorage.getItem('token');
			const response = await axios.get(
				`${API_BASE_URL}/api/notifications/user/${currentUser.userid}/counts`,
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			if (response.data.success) {
				setNotificationCounts(response.data.data);
				try {
					window.dispatchEvent(new CustomEvent('notificationsUpdated'));
				} catch {
					/* ignore */
				}
			}
		} catch (error) {
			console.error('Error fetching notification counts:', error);
		}
	};

	const markAsRead = async (notificationid) => {
		try {
			const token = localStorage.getItem('token');
			await axios.put(
				`${API_BASE_URL}/api/notifications/${notificationid}/read`,
				{},
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			setNotifications((prev) =>
				prev.map((notif) =>
					notif.notificationid === notificationid
						? { ...notif, isread: 1, readat: new Date().toISOString() }
						: notif
				)
			);
			fetchNotificationCounts();
		} catch (error) {
			console.error('Error marking notification as read:', error);
		}
	};

	const markAllAsRead = async () => {
		if (!currentUser?.userid) return;

		try {
			const token = localStorage.getItem('token');
			await axios.put(
				`${API_BASE_URL}/api/notifications/user/${currentUser.userid}/read-all`,
				{},
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			setNotifications((prev) =>
				prev.map((notif) => ({ ...notif, isread: 1, readat: new Date().toISOString() }))
			);
			fetchNotificationCounts();
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
		}
	};

	const formatTimestamp = (timestamp) => {
		if (!timestamp) return 'Just now';
		let str = String(timestamp);
		if (str && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
			str = str.replace(' ', 'T') + 'Z';
		}
		const date = new Date(str);
		const now = new Date();
		const diffInSeconds = Math.max(0, Math.floor((now - date) / 1000));

		if (diffInSeconds < 60) return 'Just now';
		const diffInMinutes = Math.floor(diffInSeconds / 60);
		if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) return `${diffInHours}h ago`;
		const diffInDays = Math.floor(diffInHours / 24);
		if (diffInDays === 1) return 'Yesterday';
		if (diffInDays < 7) return `${diffInDays}d ago`;
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	};

	const getCategoryBadge = (notification) => {
		const table = String(notification?.relatedtable || '').toLowerCase();
		const type = String(notification?.Type || '').toLowerCase();

		if (table.includes('requirement') || table.includes('file')) {
			return { 
				label: 'Requirement', 
				bg: 'bg-blue-50 text-blue-700 border-blue-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				)
			};
		}
		if (table.includes('auditor') || table.includes('area') || table.includes('criteria')) {
			return { 
				label: 'Audit', 
				bg: 'bg-blue-50 text-blue-700 border-blue-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				)
			};
		}
		if (table.includes('office') || table.includes('personnel')) {
			return { 
				label: 'Office', 
				bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
					</svg>
				)
			};
		}
		if (table.includes('user') || table.includes('role')) {
			return { 
				label: 'Account', 
				bg: 'bg-amber-50 text-amber-700 border-amber-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
				)
			};
		}
		if (type === 'announcement') {
			return { 
				label: 'Notice', 
				bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
					</svg>
				)
			};
		}
		if (type === 'error' || type === 'warning') {
			return { 
				label: 'Alert', 
				bg: 'bg-rose-50 text-rose-700 border-rose-200/80', 
				icon: (
					<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
					</svg>
				)
			};
		}
		return { 
			label: 'System', 
			bg: 'bg-slate-50 text-slate-700 border-slate-200', 
			icon: (
				<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
				</svg>
			)
		};
	};

	const handleNotificationClick = async (notification) => {
		if (!notification) return;

		if (!notification.isread) {
			await markAsRead(notification.notificationid);
		}

		const target = buildNotificationRedirect(notification);
		if (target?.path) {
			onClose?.();
			navigate(target.path);
		}
	};

	return (
		<div className="flex h-full min-h-0 max-h-[min(540px,calc(100vh-5.5rem))] flex-col bg-white select-none">
			{/* Top Header */}
			<div className="shrink-0 border-b border-slate-100 bg-white px-4 py-3">
				<div className="flex items-center justify-between mb-2.5">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-bold text-slate-800">Notifications</h3>
						{notificationCounts.unread > 0 && (
							<span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-100 animate-pulse">
								{notificationCounts.unread} new
							</span>
						)}
					</div>
					{notificationCounts.unread > 0 && (
						<button
							type="button"
							onClick={markAllAsRead}
							className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer"
						>
							<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							Mark all read
						</button>
					)}
				</div>

				{/* Filter Tabs */}
				<div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
					{[
						{ value: 'all', label: 'All', count: notificationCounts.total },
						{ value: 'unread', label: 'Unread', count: notificationCounts.unread },
						{ value: 'read', label: 'Read', count: notificationCounts.read },
					].map((filter) => (
						<button
							key={filter.value}
							type="button"
							onClick={() => setFilterStatus(filter.value)}
							className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-semibold transition-all cursor-pointer ${
								filterStatus === filter.value
									? 'bg-white text-slate-800 shadow-2xs'
									: 'text-slate-500 hover:text-slate-700'
							}`}
						>
							<span>{filter.label}</span>
							<span className={`text-[10px] rounded-full px-1.5 py-0.2 font-bold ${
								filterStatus === filter.value 
									? (filter.value === 'unread' && filter.count > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600')
									: 'text-slate-400'
							}`}>
								{filter.count}
							</span>
						</button>
					))}
				</div>
			</div>

			{/* Notification List Body */}
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-100/90">
				{loading ? (
					<div className="p-3">
						<CardListSkeleton count={3} />
					</div>
				) : notifications.length === 0 ? (
					<div className="flex flex-col items-center justify-center p-8 text-center my-auto min-h-[220px]">
						<div className="w-12 h-12 bg-slate-100/80 border border-slate-200/80 rounded-2xl flex items-center justify-center mb-2.5 text-slate-400">
							<svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0M3.124 7.5A8.969 8.969 0 015.292 3m13.416 0a8.969 8.969 0 012.168 4.5" />
							</svg>
						</div>
						<h4 className="text-xs font-bold text-slate-800 mb-0.5">
							{filterStatus === 'unread' ? 'No Unread Notifications' : 'All Caught Up!'}
						</h4>
						<p className="text-[11px] text-slate-500 max-w-[240px] leading-relaxed">
							{filterStatus === 'unread'
								? 'You have reviewed all current notifications.'
								: 'Audit assignments, upload notices, and system alerts will appear here.'}
						</p>
					</div>
				) : (
					notifications.map((notification) => {
						const hasLink = Boolean(buildNotificationRedirect(notification)?.path);
						const displayMessage = getDisplayMessage(notification);
						const badge = getCategoryBadge(notification);
						const isUnread = !notification.isread;

						const adminFirst = notification.AdminFirstName || notification.adminfirstname || notification.adminFirstName || '';
						const adminLast = notification.AdminLastName || notification.adminlastname || notification.adminLastName || '';
						const notifTitle = notification.Title || notification.title || 'Notification';
						const isExpanded = expandedIds.has(notification.notificationid);
						const isTruncatable =
							String(displayMessage || '').length > 80 ||
							String(displayMessage || '').includes('\n') ||
							String(notifTitle || '').length > 48;

						return (
							<div
								key={notification.notificationid}
								role={hasLink ? 'button' : undefined}
								tabIndex={hasLink ? 0 : undefined}
								onClick={() => handleNotificationClick(notification)}
								onKeyDown={(e) => {
									if (hasLink && (e.key === 'Enter' || e.key === ' ')) {
										e.preventDefault();
										handleNotificationClick(notification);
									}
								}}
								className={`group relative p-3 transition-all ${
									hasLink ? 'cursor-pointer' : ''
								} ${
									isUnread 
										? 'bg-indigo-50/25 hover:bg-indigo-50/50' 
										: 'bg-white hover:bg-slate-50/80'
								}`}
							>
								{/* Unread Left Border Accent */}
								{isUnread && (
									<div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-600" />
								)}

								<div className="flex items-start gap-2.5">
									{/* Category Icon Badge */}
									<div className="shrink-0 mt-0.5">
										<div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs border shadow-2xs ${badge.bg}`}>
											{badge.icon}
										</div>
									</div>

									{/* Main Notification Content */}
									<div className="min-w-0 flex-1">
										{/* Tag, Timestamp, & Unread Indicator */}
										<div className="flex items-center justify-between gap-1.5 mb-1">
											<div className="flex items-center gap-1.5 min-w-0">
												<span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold border ${badge.bg}`}>
													{badge.label}
												</span>
												{adminFirst && (
													<span className="text-[10px] text-slate-400 truncate">
														• by {adminFirst} {adminLast}
													</span>
												)}
											</div>
											<div className="flex items-center gap-1.5 shrink-0">
												<span className="text-[10px] font-medium text-slate-400">
													{formatTimestamp(notification.createdat)}
												</span>
												{isUnread && (
													<span className="h-2 w-2 rounded-full bg-blue-600 ring-2 ring-blue-200" title="Unread" />
												)}
											</div>
										</div>

										{/* Notification Title */}
										<h4 className={`text-xs font-semibold mb-0.5 leading-snug ${
											isExpanded ? '' : 'line-clamp-1'
										} ${
											isUnread ? 'text-slate-900 font-bold' : 'text-slate-700'
										}`}>
											{notifTitle}
										</h4>

										{/* Detailed Message Text */}
										<p className={`text-[11px] text-slate-600 leading-relaxed mb-1.5 ${
											isExpanded ? 'whitespace-pre-line break-words' : 'line-clamp-2'
										}`}>
											{displayMessage}
										</p>

										{/* Action Link Footer */}
										{(isTruncatable || hasLink) && (
											<div className="flex items-center justify-between gap-2 pt-0.5">
												{isTruncatable ? (
													<button
														type="button"
														onClick={(e) => toggleExpanded(e, notification)}
														className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
													>
														<span>{isExpanded ? 'See less' : 'See more'}</span>
														<svg
															className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
															strokeWidth={2}
														>
															<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
														</svg>
													</button>
												) : <span />}

												{hasLink && (
													<span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 group-hover:text-blue-700 transition group-hover:translate-x-0.5">
														View Details
														<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
															<path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
														</svg>
													</span>
												)}
											</div>
										)}
									</div>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
