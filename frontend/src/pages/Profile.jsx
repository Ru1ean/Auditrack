import React, { useEffect, useState } from 'react';
import { User, KeyRound, Pencil } from 'lucide-react';
import { usersAPI } from '../utils/api';
import EditProfileModal from '../components/EditProfile/EditProfileModal.jsx';
import ChangePasswordCard from '../components/Profile/ChangePasswordCard.jsx';
import { API_BASE_URL } from '../utils/apiBase';
import SmartUserAvatar from '../components/UI/SmartUserAvatar';

function DetailRow({ label, value }) {
	return (
		<div className="rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
			<dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
			<dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '-'}</dd>
		</div>
	);
}

function ProfileShell({ children }) {
	return (
		<div className="min-h-screen w-full bg-app">
			<div className="mx-auto max-w-5xl px-4 pb-12 pt-3 sm:px-6 lg:px-8">{children}</div>
		</div>
	);
}

export default function Profile() {
	const [user, setUser] = useState(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'password'
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadUser = async () => {
			try {
				setLoading(true);
				const response = await usersAPI.getLoggedInUser();
				if (response?.success) setUser(response.user);
				else setUser(null);
			} catch (error) {
				console.error('Error loading user:', error);
				setUser(null);
			} finally {
				setLoading(false);
			}
		};
		loadUser();
	}, []);

	const getRoleName = (u) => {
		if (!u) return '';
		if (u.rolename) {
			const rn = String(u.rolename || '').toLowerCase();
			if (rn === 'admin' || rn === 'administrator') return 'Administrator';
			if (rn === 'personnel' || rn.includes('personnel') || rn === 'office head') return 'Office Personnel';
			if (rn === 'user') return 'User';
			return u.rolename;
		}

		if (Number(u.roleid) === 1) return 'Administrator';
		if (Number(u.roleid) === 3) return 'Office Personnel';
		if (Number(u.roleid) === 2) return 'User';
		return 'User';
	};

	const fullName = user
		? `${user.firstname || ''}${user.middleinitial ? ` ${user.middleinitial}.` : ''} ${user.lastname || ''}`.trim()
		: '';

	if (loading) {
		return (
			<ProfileShell>
				<div className="flex min-h-[420px] items-center justify-center">
					<div className="text-center">
						<div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
						<p className="text-sm text-slate-500">Loading your profile...</p>
					</div>
				</div>
			</ProfileShell>
		);
	}

	if (!user) {
		return (
			<ProfileShell>
				<div className="flex min-h-[420px] items-center justify-center">
					<div className="rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
						<p className="text-slate-600">We could not load your profile.</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
						>
							Try again
						</button>
					</div>
				</div>
			</ProfileShell>
		);
	}

	return (
		<ProfileShell>
			<div className="mx-auto mt-4 max-w-4xl">
				<article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
					{/* Top Profile Header */}
					<div className="flex flex-col gap-5 border-b border-slate-200 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 items-center gap-4">
							<SmartUserAvatar
								user={user}
								src={user?.TempPreview || (user?.profilepic ? `${API_BASE_URL}/uploads/profile-pics/${user.profilepic}` : null)}
								fullName={fullName}
								size="h-20 w-20"
								textSize="text-2xl font-bold"
								ring="ring-2 ring-slate-200/80 shadow-sm"
							/>

							<div className="min-w-0">
								<p className="text-xs font-medium uppercase tracking-wide text-slate-500">My account</p>
								<h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{fullName}</h2>
								<div className="mt-2 flex flex-wrap items-center gap-2">
									<span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
										{getRoleName(user)}
									</span>
									<span className="truncate text-sm text-slate-500">{user.Email || user.email}</span>
								</div>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2.5 shrink-0">
							<button
								type="button"
								onClick={() => setModalOpen(true)}
								className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
							>
								<Pencil className="h-4 w-4" />
								<span>Edit profile</span>
							</button>
						</div>
					</div>

					{/* Profile Options Navigation Bar */}
					<div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-6 pt-2">
						<button
							type="button"
							onClick={() => setActiveTab('overview')}
							className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
								activeTab === 'overview'
									? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
									: 'border-transparent text-slate-600 hover:text-slate-900'
							}`}
						>
							<User className="h-3.5 w-3.5" />
							<span>Account Information</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab('password')}
							className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
								activeTab === 'password'
									? 'border-blue-600 text-blue-600 bg-white rounded-t-lg shadow-2xs'
									: 'border-transparent text-slate-600 hover:text-slate-900'
							}`}
						>
							<KeyRound className="h-3.5 w-3.5" />
							<span>Password & Security</span>
						</button>
					</div>

					{/* Tab Content */}
					{activeTab === 'overview' ? (
						<div className="px-6 py-6">
							<div className="mb-4">
								<h3 className="text-base font-semibold text-slate-900">Account information</h3>
								<p className="mt-1 text-sm text-slate-500">Basic information connected to your login.</p>
							</div>

							<dl className="grid gap-3 sm:grid-cols-2">
								<DetailRow label="Full name" value={fullName} />
								<DetailRow label="Email address" value={user.Email || user.email} />
								<DetailRow label="Role" value={getRoleName(user)} />
								{user.Bio ? <DetailRow label="Bio" value={user.Bio} /> : null}
							</dl>
						</div>
					) : (
						<ChangePasswordCard user={user} embedded />
					)}
				</article>
			</div>

			{modalOpen && (
				<EditProfileModal
					user={user}
					isOpen={modalOpen}
					onClose={() => setModalOpen(false)}
					onUpdate={(updatedUser) => setUser(updatedUser)}
				/>
			)}
		</ProfileShell>
	);
}
