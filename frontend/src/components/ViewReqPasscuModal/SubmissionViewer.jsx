import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth/mammoth.browser';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerSrc from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';
import YourWorkFileUpload from './YourWorkFileUpload';
import SmartUserAvatar from './SmartUserAvatar';
import { useToast } from '../UI/Toast';
import { useModal } from '../UI/ModalProvider';
import { API_BASE_URL } from '../../utils/apiBase';
import { dataCache, CacheKeys } from '../../utils/dataCache';
import { useLiveRefresh } from '../../utils/liveSync';

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const THUMB_W = 220;
const THUMB_H = 120;

const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const wrapLines = (text, maxLen, maxLines) => {
	const raw = String(text || '').replace(/\s+/g, ' ').trim();
	if (!raw) return [];
	const lines = [];
	let i = 0;
	while (i < raw.length && lines.length < maxLines) {
		lines.push(raw.slice(i, i + maxLen));
		i += maxLen;
	}
	return lines;
};

const renderDocxThumbSvg = (filename, rawText) => {
	const title = String(filename || 'Document').slice(0, 28);
	const lines = wrapLines(rawText, 34, 6);
	const textEls = lines
		.map((l, idx) => {
			const y = 44 + idx * 12;
			return `<text x="12" y="${y}" font-size="10" fill="#374151" font-family="Poppins, Inter, sans-serif">${
				l.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]))
			}</text>`;
		})
		.join('');

	return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}" viewBox="0 0 ${THUMB_W} ${THUMB_H}">
  <rect x="0" y="0" width="${THUMB_W}" height="${THUMB_H}" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="${THUMB_W - 1}" height="${THUMB_H - 1}" rx="8" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="12" y="22" font-size="11" font-weight="600" fill="#111827" font-family="Poppins, Inter, sans-serif">${
		title.replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]))
	}</text>
  <line x1="12" y1="30" x2="${THUMB_W - 12}" y2="30" stroke="#e5e7eb"/>
  ${textEls}
</svg>`);
};

const renderXlsxThumbSvg = (filename, workbook) => {
	const sheetName = workbook?.SheetNames?.[0];
	const sheet = sheetName ? workbook.Sheets[sheetName] : null;
	const title = String(filename || sheetName || 'Spreadsheet').slice(0, 26);

	const maxRows = 6;
	const maxCols = 4;
	let grid = Array.from({ length: maxRows }, () => Array.from({ length: maxCols }, () => ''));

	if (sheet) {
		const ref = sheet['!ref'] || 'A1';
		const range = XLSX.utils.decode_range(ref);
		for (let r = 0; r < Math.min(maxRows, range.e.r - range.s.r + 1); r++) {
			for (let c = 0; c < Math.min(maxCols, range.e.c - range.s.c + 1); c++) {
				const cellAddr = XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c });
				const cell = sheet[cellAddr];
				const val = cell?.w ?? cell?.v;
				grid[r][c] = val == null ? '' : String(val).slice(0, 10);
			}
		}
	}

	const esc = (s) => String(s).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
	const x0 = 12;
	const y0 = 34;
	const w = THUMB_W - 24;
	const h = THUMB_H - 46;
	const cellW = w / maxCols;
	const cellH = h / maxRows;
	let cells = '';
	for (let r = 0; r < maxRows; r++) {
		for (let c = 0; c < maxCols; c++) {
			const x = x0 + c * cellW;
			const y = y0 + r * cellH;
			cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#ffffff" stroke="#e5e7eb"/>`;
			const v = grid[r][c];
			if (v) {
				cells += `<text x="${x + 4}" y="${y + 12}" font-size="9" fill="#374151" font-family="Poppins, Inter, sans-serif">${esc(
					v
				)}</text>`;
			}
		}
	}

	return svgDataUrl(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${THUMB_W}" height="${THUMB_H}" viewBox="0 0 ${THUMB_W} ${THUMB_H}">
  <rect x="0" y="0" width="${THUMB_W}" height="${THUMB_H}" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="${THUMB_W - 1}" height="${THUMB_H - 1}" rx="8" fill="#ffffff" stroke="#e5e7eb"/>
  <text x="12" y="22" font-size="11" font-weight="600" fill="#111827" font-family="Poppins, Inter, sans-serif">${esc(
		title
	)}</text>
  <line x1="12" y1="30" x2="${THUMB_W - 12}" y2="30" stroke="#e5e7eb"/>
  ${cells}
</svg>`);
};

const getExtension = (fileNameOrUrl) => {
    const s = String(fileNameOrUrl || '');
    const clean = s.split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
};

const getFileTypeLabel = (ext) => {
    if (['doc', 'docx'].includes(ext)) return 'Microsoft Word';
    if (['xls', 'xlsx'].includes(ext)) return 'Microsoft Excel';
    if (ext === 'pdf') return 'PDF Document';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'Image File';
    if (['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)) return 'Video File';
    return ext ? ext.toUpperCase() : 'File';
};

const isImageExt = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext);
const isVideoExt = (ext) => ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext);

export default function SubmissionViewer({
	show,
	leftStyle,
	onClose,
	requirement,
	users = [],
	officeid,
	onCommentSaved,
	currentUser,
	onViewUserFile,
	onViewUserFilesModal,
	showPrivateComments = true,
	canEditPrivateComments = true,
	allowWorkActions = false,
	viewerRoleId = 0,
	onFileUpload,
	onFileUnsubmit,
	onFileRename,
	onFileUpdateComment,
	uploadingFile = false,
	uploadProgressMap = {},
	unsubmittingFile = false,
}) {
	const { showConfirm } = useModal();
	const isViewerAuditor = Number(viewerRoleId || currentUser?.roleid || 0) === 4 ||
		String(currentUser?.rolename || '').toLowerCase().includes('auditor') ||
		String(currentUser?.Position || '').toLowerCase().includes('auditor') ||
		Boolean(currentUser?.isExternalAuditor);

	const [active, setActive] = useState(false);
	const [shouldRender, setShouldRender] = useState(false);
	const [cachedRequirement, setCachedRequirement] = useState(null);
	const [cachedUsers, setCachedUsers] = useState([]);

	useEffect(() => {
		if (show) {
			setShouldRender(true);
			const timer = setTimeout(() => setActive(true), 20);
			return () => clearTimeout(timer);
		} else {
			setActive(false);
			const timer = setTimeout(() => setShouldRender(false), 300);
			return () => clearTimeout(timer);
		}
	}, [show]);

	useEffect(() => {
		if (show && requirement) {
			setCachedRequirement(requirement);
			setCachedUsers(users);
		}
	}, [show, requirement, users]);

	const activeRequirement = show ? requirement : cachedRequirement;
	const activeUsers = show ? users : cachedUsers;

	const requirementid = activeRequirement?.requirementid;
	const title = activeRequirement?.RequirementTitle || activeRequirement?.Title || activeRequirement?.requirementcode || 'Submission';

	const assignedCount = activeUsers.length;
	const turnedInCount = activeUsers.reduce(
		(acc, u) => acc + ((u?.hasuploaded === 1 || u?.hasuploaded === true) ? 1 : 0),
		0
	);

	const uploadedUserIds = useMemo(() => {
		return (activeUsers || [])
			.filter((u) => (u?.hasuploaded === 1 || u?.hasuploaded === true) && u?.userid)
			.map((u) => Number(u.userid))
			.filter((id) => Number.isFinite(id) && id > 0);
	}, [activeUsers]);
	const uploadedUserIdsKey = uploadedUserIds.join(',');

	const [fileByUserId, setFileByUserId] = useState({});
	const [filesByUserId, setFilesByUserId] = useState({});
	const [loadingByUserId, setLoadingByUserId] = useState({});
	const [thumbByUserId, setThumbByUserId] = useState({});
	const [thumbLoadingByUserId, setThumbLoadingByUserId] = useState({});
	const [savedComment, setSavedComment] = useState('');
	const [savedCommentAt, setSavedCommentAt] = useState(null);
	const [commentInput, setCommentInput] = useState('');
	const [savingComment, setSavingComment] = useState(false);
	const [commentStatus, setCommentStatus] = useState('');
	const lastThumbKeyRef = useRef('');
	const thumbByUserIdRef = useRef({});
	const thumbLoadingByUserIdRef = useRef({});
	const shouldRenderPrivateCommentSection = !isViewerAuditor && !!(showPrivateComments && (canEditPrivateComments || String(savedComment || '').trim()));

	const { toast } = useToast();

	useEffect(() => {
		if (!show) return;
		setSavedComment(requirement?.comments || '');
		setSavedCommentAt(null);
		setCommentInput('');
		setCommentStatus('');
	}, [show, requirementid]);

	useEffect(() => {
		thumbByUserIdRef.current = thumbByUserId;
	}, [thumbByUserId]);
	useEffect(() => {
		thumbLoadingByUserIdRef.current = thumbLoadingByUserId;
	}, [thumbLoadingByUserId]);

	useEffect(() => {
		if (!show || !requirementid || uploadedUserIds.length === 0) {
			setFileByUserId({});
			setFilesByUserId({});
			setLoadingByUserId({});
			setThumbByUserId({});
			setThumbLoadingByUserId({});
			return;
		}

		let cancelled = false;
		const controller = new AbortController();

		// Immediately check and populate from cache for instant 0ms rendering
		const initialFilesMap = {};
		const initialFileMap = {};
		const initialLoadingMap = {};

		uploadedUserIds.forEach((id) => {
			const cacheKey = CacheKeys.userFiles(requirementid, id, officeid);
			const cached = dataCache.get(cacheKey);
			if (cached && Array.isArray(cached) && cached.length > 0) {
				const filteredCached = isViewerAuditor ? cached.filter((f) => f.reviewstatus === 'approved') : cached;
				initialFilesMap[id] = filteredCached;
				initialFileMap[id] = filteredCached[filteredCached.length - 1] || null;
				initialLoadingMap[id] = false;
			} else {
				initialLoadingMap[id] = true;
			}
		});

		setFileByUserId((prev) => ({ ...prev, ...initialFileMap }));
		setFilesByUserId((prev) => ({ ...prev, ...initialFilesMap }));
		setLoadingByUserId((prev) => ({ ...prev, ...initialLoadingMap }));
		setThumbByUserId({});
		setThumbLoadingByUserId({});
		lastThumbKeyRef.current = '';

		const fetchUserFile = async (userid) => {
			try {
				const token = localStorage.getItem('token');
				const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
				const res = await fetch(
					`${API_BASE_URL}/api/requirements/${requirementid}/user-file/${userid}${officeid ? `?officeid=${officeid}` : ''}`,
					{ headers, signal: controller.signal }
				);
				if (!res.ok) {
					// 404 means no file exists; silently ignore
					return;
				}
				const data = await res.json();
				if (cancelled) return;
				if (data?.success) {
					const rawList = Array.isArray(data.files) && data.files.length > 0 
						? data.files 
						: (data.file ? [data.file] : []);
					const list = isViewerAuditor ? rawList.filter((f) => f.reviewstatus === 'approved') : rawList;
					
					// Save in dataCache
					dataCache.set(CacheKeys.userFiles(requirementid, userid, officeid), list);

					setFilesByUserId((prev) => ({ ...prev, [userid]: list }));
					if (list.length > 0) {
						setFileByUserId((prev) => ({ ...prev, [userid]: list[list.length - 1] }));
					}
				}
			} catch (e) {
				// ignore
			} finally {
				if (!cancelled) {
					setLoadingByUserId((prev) => ({ ...prev, [userid]: false }));
				}
			}
		};

		const run = async () => {
			const concurrency = 4;
			let index = 0;
			const workers = Array.from({ length: Math.min(concurrency, uploadedUserIds.length) }).map(async () => {
				while (!cancelled) {
					const i = index++;
					if (i >= uploadedUserIds.length) break;
					await fetchUserFile(uploadedUserIds[i]);
				}
			});
			await Promise.all(workers);
		};

		run();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [show, requirementid, officeid, uploadedUserIdsKey, isViewerAuditor]);

	// Real-time live synchronization for evidence files while drawer is open
	useLiveRefresh(async () => {
		if (!show || !requirementid || uploadedUserIds.length === 0) return;
		for (const userid of uploadedUserIds) {
			try {
				const token = localStorage.getItem('token');
				const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
				const res = await fetch(
					`${API_BASE_URL}/api/requirements/${requirementid}/user-file/${userid}${officeid ? `?officeid=${officeid}` : ''}`,
					{ headers }
				);
				if (res.ok) {
					const data = await res.json();
					if (data?.success) {
						const rawList = Array.isArray(data.files) && data.files.length > 0 
							? data.files 
							: (data.file ? [data.file] : []);
						const list = isViewerAuditor ? rawList.filter((f) => f.reviewstatus === 'approved') : rawList;
						dataCache.set(CacheKeys.userFiles(requirementid, userid, officeid), list);
						setFilesByUserId((prev) => ({ ...prev, [userid]: list }));
						if (list.length > 0) {
							setFileByUserId((prev) => ({ ...prev, [userid]: list[list.length - 1] }));
						}
					}
				}
			} catch (e) {
				// ignore
			}
		}
	}, { entityTypes: ['requirements', 'compliance', 'documents', 'all'], deps: [show, requirementid, officeid, uploadedUserIdsKey, isViewerAuditor] });

	// Listen for immediate local review and update events to update file review statuses with 0ms delay
	useEffect(() => {
		const handleReviewed = (e) => {
			const { reqId, fileId, status, userid, reason, resData } = e.detail || {};
			if (reqId && Number(reqId) !== Number(requirementid)) return;

			const targetUserId = userid ? Number(userid) : null;
			if (targetUserId) {
				setFilesByUserId((prev) => {
					const existing = prev[targetUserId] || [];
					const updated = existing.map((f) => {
						if (Number(f.id) === Number(fileId)) {
							return {
								...f,
								reviewstatus: status,
								rejectionreason: status === 'rejected' ? reason : (f.rejectionreason || ''),
								comment: reason || f.comment,
								...(resData || {})
							};
						}
						return f;
					});
					if (requirementid) {
						dataCache.set(CacheKeys.userFiles(requirementid, targetUserId), updated);
					}
					return { ...prev, [targetUserId]: updated };
				});

				setFileByUserId((prev) => {
					const f = prev[targetUserId];
					if (f && Number(f.id) === Number(fileId)) {
						const updated = {
							...f,
							reviewstatus: status,
							rejectionreason: status === 'rejected' ? reason : (f.rejectionreason || ''),
							comment: reason || f.comment,
							...(resData || {})
						};
						return { ...prev, [targetUserId]: updated };
					}
					return prev;
				});
			} else {
				// If userid wasn't specified, scan all users
				setFilesByUserId((prev) => {
					let changed = false;
					const next = { ...prev };
					Object.keys(next).forEach((uid) => {
						const list = next[uid] || [];
						const hasFile = list.some((f) => Number(f.id) === Number(fileId));
						if (hasFile) {
							changed = true;
							next[uid] = list.map((f) => Number(f.id) === Number(fileId) ? {
								...f,
								reviewstatus: status,
								rejectionreason: status === 'rejected' ? reason : (f.rejectionreason || ''),
								comment: reason || f.comment,
								...(resData || {})
							} : f);
							if (requirementid) {
								dataCache.set(CacheKeys.userFiles(requirementid, uid), next[uid]);
							}
						}
					});
					return changed ? next : prev;
				});
			}
		};

		const handleFileUpdated = (e) => {
			const { reqId, userid, files } = e.detail || {};
			if (reqId && Number(reqId) !== Number(requirementid)) return;
			if (userid && Array.isArray(files)) {
				const uid = Number(userid);
				setFilesByUserId((prev) => ({ ...prev, [uid]: files }));
				if (files.length > 0) {
					setFileByUserId((prev) => ({ ...prev, [uid]: files[files.length - 1] }));
				}
				if (requirementid) {
					dataCache.set(CacheKeys.userFiles(requirementid, uid), files);
				}
			}
		};

		window.addEventListener('evidence-file-reviewed', handleReviewed);
		window.addEventListener('evidence-file-updated', handleFileUpdated);
		return () => {
			window.removeEventListener('evidence-file-reviewed', handleReviewed);
			window.removeEventListener('evidence-file-updated', handleFileUpdated);
		};
	}, [requirementid]);

	const handleSaveComment = async () => {
		if (!show || !requirementid || !officeid) return;
		const next = String(commentInput || '').trim();
		if (!next) return;
		setSavingComment(true);
		setCommentStatus('');
		try {
			const token = localStorage.getItem('token');
			const headers = {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {})
			};
			const res = await fetch(
				`${API_BASE_URL}/api/offices/${officeid}/requirements/${requirementid}/status`,
				{
					method: 'PUT',
					headers,
					body: JSON.stringify({
						statusid: requirement?.ComplianceStatusID || 3,
						comments: commentInput
					})
				}
			);
			if (!res.ok) throw new Error('Failed to save');
			setSavedComment(next);
			setSavedCommentAt(new Date());
			setCommentInput('');
			onCommentSaved?.(next);
			toast?.({
				title: 'Comment Saved',
				description: 'Your comment has been saved successfully.',
				variant: 'success',
				duration: 2500
			});
		} catch (e) {
			setCommentStatus('Failed to save');
		} finally {
			setSavingComment(false);
		}
	};

	const handleClearComment = async () => {
		if (!show || !requirementid || !officeid || !canEditPrivateComments || !savedComment) return;
		const ok = await showConfirm('Clear this comment? This cannot be undone.');
		if (!ok) return;

		setSavingComment(true);
		setCommentStatus('');
		try {
			const token = localStorage.getItem('token');
			const headers = {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {})
			};
			const res = await fetch(
				`${API_BASE_URL}/api/offices/${officeid}/requirements/${requirementid}/status`,
				{
					method: 'PUT',
					headers,
					body: JSON.stringify({
						statusid: requirement?.ComplianceStatusID || 3,
						comments: ''
					})
				}
			);
			if (!res.ok) throw new Error('Failed to clear');
			setSavedComment('');
			setSavedCommentAt(null);
			setCommentInput('');
			onCommentSaved?.('');
			toast?.({
				title: 'Comment Cleared',
				description: 'The comment has been removed.',
				variant: 'info',
				duration: 2500
			});
		} catch (e) {
			setCommentStatus('Failed to clear');
		} finally {
			setSavingComment(false);
		}
	};

	// 'Your Work' view only when there's exactly one assigned user, viewer is allowed work actions, and the user is currentUser
	const isCurrentUserSingleUser = users.length === 1 && users.some(u => Number(u?.userid) === Number(currentUser?.userid));
	const isYourWorkView = Boolean(allowWorkActions) && !canEditPrivateComments && isCurrentUserSingleUser;
	const isReadOnlyWorkView = !allowWorkActions;
	const workUser = isYourWorkView
		? (users.length === 1 ? users[0] : users.find(u => Number(u?.userid) === Number(currentUser?.userid)))
		: null;
	const workUserId = workUser?.userid ? Number(workUser.userid) : null;
	const workFile = workUserId ? fileByUserId[workUserId] : null;
	const workFiles = workUserId ? (filesByUserId[workUserId] || (workFile ? [workFile] : [])) : [];
	const workHasUploaded = workUserId && filesByUserId[workUserId] !== undefined
		? filesByUserId[workUserId].length > 0
		: (workUser?.hasuploaded === 1 || workUser?.hasuploaded === true || workFiles.length > 0);
	const workThumb = workUserId ? thumbByUserId[workUserId] : null;
	const workLoadingFile = workUserId ? loadingByUserId[workUserId] : false;
	const workLoadingThumb = workUserId ? thumbLoadingByUserId[workUserId] : false;

	const commentLabel = canEditPrivateComments ? 'Comment' : 'Private comment';
	const formatShortDate = (d) => {
		try {
			return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
		} catch {
			return '';
		}
	};

	const fileByUserIdKey = useMemo(() => {
		return uploadedUserIds
			.map((id) => {
				const f = fileByUserId[id];
				return f ? `${id}:${f.url || ''}:${f.filename || ''}` : `${id}:`;
			})
			.join('|');
	}, [uploadedUserIdsKey, fileByUserId]);

	const getExtension = (fileNameOrUrl) => {
		const s = String(fileNameOrUrl || '');
		const clean = s.split('?')[0].split('#')[0];
		const dot = clean.lastIndexOf('.');
		return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
	};
	const isImageExt = (ext) => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext);
	const isPdfExt = (ext) => ext === 'pdf';
	const isDocxExt = (ext) => ext === 'docx';
	const isXlsxExt = (ext) => ext === 'xlsx' || ext === 'xls';
	const getFileTypeLabel = (ext) => {
		if (isImageExt(ext)) return 'Image';
		if (isPdfExt(ext)) return 'PDF';
		if (isDocxExt(ext) || ext === 'doc') return 'Document';
		if (isXlsxExt(ext) || ext === 'csv') return 'Spreadsheet';
		return ext ? ext.toUpperCase() : 'File';
	};

	// Upload then refresh files for the current user so UI updates immediately
	const handleUploadAndRefresh = async (e) => {
		if (!onFileUpload || !currentUser) return;
		try {
			await onFileUpload(e, requirementid);
		} catch (err) {
			console.error('Upload handler error', err);
			toast?.({ title: 'Upload failed', description: err?.message || 'Failed to upload files', variant: 'error', duration: 2500 });
		}
		// After upload completes, fetch the user's files for this requirement
		try {
			const userid = Number(currentUser.userid);
			if (!userid) return;
			const token = localStorage.getItem('token');
			const headers = token ? { Authorization: `Bearer ${token}` } : {};
			const res = await fetch(`${API_BASE_URL}/api/requirements/${requirementid}/user-file/${userid}${officeid ? `?officeid=${officeid}` : ''}`, { headers });
			if (!res.ok) return;
			const data = await res.json();
			if (data?.success) {
				const list = Array.isArray(data.files) && data.files.length > 0 ? data.files : (data.file ? [data.file] : []);
				dataCache.set(CacheKeys.userFiles(requirementid, userid, officeid), list);
				setFilesByUserId((prev) => ({ ...prev, [userid]: list }));
				if (list.length > 0) setFileByUserId((prev) => ({ ...prev, [userid]: list[list.length - 1] }));
			}
		} catch (err) {
			console.error('Failed to refresh files after upload', err);
		}
	};

	useEffect(() => {
		if (!show || !requirementid || uploadedUserIds.length === 0) return;
		if (!fileByUserIdKey) return;

		const thumbKey = `${requirementid}:${uploadedUserIdsKey}:${fileByUserIdKey}`;
		if (lastThumbKeyRef.current === thumbKey) return;
		lastThumbKeyRef.current = thumbKey;

		let cancelled = false;
		const controller = new AbortController();
		const inFlight = new Set();

		const fetchArrayBuffer = async (url) => {
			const token = localStorage.getItem('token');
			const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
			const res = await fetch(url, { headers, signal: controller.signal });
			if (!res.ok) throw new Error('Failed to fetch');
			return await res.arrayBuffer();
		};

		const makePdfThumb = async (file) => {
			const buf = await fetchArrayBuffer(file.url);
			const loadingTask = getDocument({ data: buf });
			const pdf = await loadingTask.promise;
			try {
				const page = await pdf.getPage(1);
				try {
					const baseViewport = page.getViewport({ scale: 1 });
					const scale = Math.min(2, THUMB_W / Math.max(1, baseViewport.width));
					const viewport = page.getViewport({ scale });
					const canvas = document.createElement('canvas');
					const ctx = canvas.getContext('2d', { alpha: false });
					canvas.width = Math.floor(viewport.width);
					canvas.height = Math.floor(viewport.height);
					if (!ctx) throw new Error('No canvas context');
					await page.render({ canvasContext: ctx, viewport }).promise;
					return canvas.toDataURL('image/png');
				} finally {
					page.cleanup?.();
				}
			} finally {
				pdf.cleanup?.();
				await pdf.destroy?.();
			}
		};

		const makeXlsxThumb = async (file) => {
			const buf = await fetchArrayBuffer(file.url);
			const wb = XLSX.read(buf, { type: 'array' });
			return renderXlsxThumbSvg(file.filename, wb);
		};

		const makeDocxThumb = async (file) => {
			const buf = await fetchArrayBuffer(file.url);
			const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
			return renderDocxThumbSvg(file.filename, value);
		};

		const generateForUser = async (userid) => {
			const file = fileByUserId[userid];
			if (!file?.url) return;
			const ext = getExtension(file.filename || file.url);
			if (isImageExt(ext)) return;
			if (!isPdfExt(ext) && !isDocxExt(ext) && !isXlsxExt(ext)) return;
			if (thumbByUserIdRef.current[userid] || thumbLoadingByUserIdRef.current[userid]) return;
			if (inFlight.has(userid)) return;
			inFlight.add(userid);

			setThumbLoadingByUserId((prev) => ({ ...prev, [userid]: true }));
			try {
				let thumb;
				if (isPdfExt(ext)) thumb = await makePdfThumb(file);
				else if (isXlsxExt(ext)) thumb = await makeXlsxThumb(file);
				else if (isDocxExt(ext)) thumb = await makeDocxThumb(file);
				if (cancelled) return;
				if (thumb) setThumbByUserId((prev) => ({ ...prev, [userid]: thumb }));
			} catch (e) {
				// ignore; fallback UI remains
			} finally {
				inFlight.delete(userid);
				if (!cancelled) setThumbLoadingByUserId((prev) => ({ ...prev, [userid]: false }));
			}
		};

		const run = async () => {
			const targets = uploadedUserIds.filter((id) => fileByUserId[id]?.url);
			const concurrency = 2;
			let index = 0;
			const workers = Array.from({ length: Math.min(concurrency, targets.length) }).map(async () => {
				while (!cancelled) {
					const i = index++;
					if (i >= targets.length) break;
					await generateForUser(targets[i]);
				}
			});
			await Promise.all(workers);
		};

		run();
		return () => {
			cancelled = true;
			controller.abort();
		};
	}, [show, requirementid, uploadedUserIdsKey, fileByUserIdKey]);

	if (!shouldRender) return null;

	return (
		<div
			className={`fixed inset-0 z-[130] bg-transparent transition-opacity duration-300 ease-out ${
				active ? 'opacity-100' : 'opacity-0 pointer-events-none'
			}`}
			style={leftStyle}
			onClick={(e) => {
				e.stopPropagation();
				onClose?.();
			}}
			role="presentation"
		>
			<div
				className={`relative ml-auto flex h-full w-[34%] min-w-[420px] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
					active ? 'translate-x-0' : 'translate-x-full'
				}`}
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-label="Submission"
			>
				<div className="relative flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
					<div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-indigo-500 to-violet-500" />
					<div className="min-w-0">
						<div className="truncate text-base font-semibold tracking-tight text-slate-900">{title}</div>
					</div>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onClose?.();
						}}
						className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100"
						aria-label="Close"
					>
						<svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto bg-app">
					<div className="flex min-h-full flex-col p-4">


						{isYourWorkView && (
							<YourWorkFileUpload
								requirementid={requirementid}
								userid={workUserId}
								hasuploaded={workHasUploaded || workFiles.length > 0}
								file={workFile}
								files={workFiles}
								thumb={workThumb}
								isLoadingFile={workLoadingFile}
								isLoadingThumb={workLoadingThumb}
								uploading={uploadingFile}
								uploadProgressMap={uploadProgressMap}
								onReorder={(newFiles) => {
									if (workUserId) {
										setFilesByUserId((prev) => ({ ...prev, [workUserId]: newFiles }));
										if (newFiles && newFiles.length > 0) {
											setFileByUserId((prev) => ({ ...prev, [workUserId]: newFiles[newFiles.length - 1] }));
										}
										if (requirementid) {
											dataCache.set(CacheKeys.userFiles(requirementid, workUserId), newFiles);
										}
									}
								}}
								onUpload={(e, reqId) => {
									onFileUpload?.(e, reqId, (newFile) => {
										if (!newFile || !workUserId) return;
										setFilesByUserId((prev) => {
											const existing = prev[workUserId] || [];
											const exists = existing.some((f) => ((f.id && newFile.id && f.id === newFile.id) || (f.filename && newFile.filename && f.filename === newFile.filename)));
											const updated = exists ? existing : [...existing, newFile];
											if (requirementid) {
												dataCache.set(CacheKeys.userFiles(requirementid, workUserId), updated);
											}
											return {
												...prev,
												[workUserId]: updated,
											};
										});
										setFileByUserId((prev) => ({
											...prev,
											[workUserId]: newFile,
										}));
									});
								}}
								onUnsubmit={async (reqId, fileId) => {
									let res = true;
									if (onFileUnsubmit) {
										res = await onFileUnsubmit(reqId, fileId);
										if (res === false) return false;
									}
									if (workUserId) {
										setFilesByUserId((prev) => {
											const currentList = prev[workUserId] || [];
											const updated = currentList.filter((f) => {
												if (fileId && f.id && String(f.id) === String(fileId)) return false;
												if (fileId && f.fileId && String(f.fileId) === String(fileId)) return false;
												if (fileId && f.filename && f.filename === fileId) return false;
												return true;
											});
											if (requirementid) {
												dataCache.set(CacheKeys.userFiles(requirementid, workUserId, officeid), updated);
												dataCache.set(CacheKeys.userFiles(requirementid, workUserId), updated);
											}
											return {
												...prev,
												[workUserId]: updated
											};
										});
										setFileByUserId((prev) => {
											const curr = prev[workUserId];
											if (!curr) return prev;
											const matches = (fileId && curr.id && String(curr.id) === String(fileId)) ||
															(fileId && curr.fileId && String(curr.fileId) === String(fileId)) ||
															(fileId && curr.filename && curr.filename === fileId);
											if (matches) {
												return { ...prev, [workUserId]: null };
											}
											return prev;
										});
									}
									return res;
								}}
								onRename={(reqId, fileId, newDisplayName) => {
									if (workUserId) {
										setFilesByUserId((prev) => ({
											...prev,
											[workUserId]: (prev[workUserId] || []).map((f) =>
												((f.id && fileId && f.id === fileId) || f.filename === fileId)
													? { ...f, displayname: newDisplayName }
													: f
											)
										}));
										setFileByUserId((prev) => {
											const curr = prev[workUserId];
											if (curr && ((curr.id && fileId && curr.id === fileId) || curr.filename === fileId)) {
												return { ...prev, [workUserId]: { ...curr, displayname: newDisplayName } };
											}
											return prev;
										});
									}
									onFileRename?.(reqId, fileId, newDisplayName);
								}}
								onUpdateComment={(reqId, fileId, newComment) => {
									if (workUserId) {
										setFilesByUserId((prev) => ({
											...prev,
											[workUserId]: (prev[workUserId] || []).map((f) =>
												((f.id && fileId && f.id === fileId) || f.filename === fileId)
													? { ...f, comment: newComment }
													: f
											)
										}));
									}
									onFileUpdateComment?.(reqId, fileId, newComment);
								}}
								onViewFile={
									workHasUploaded && onViewUserFile && workUser
										? (item) => onViewUserFile(workUser, requirementid, item)
										: undefined
								}
								readOnly={isReadOnlyWorkView}
								isAdmin={canEditPrivateComments}
								viewerRoleId={viewerRoleId}
							/>
						)}

						{!isYourWorkView && (
							<div className="mt-3 pr-1">
								<div className="flex flex-col gap-3">
									{users.map((u) => {
										const displayname = `${u?.firstname || ''}${u?.lastname ? ' ' + u.lastname : ''}`.trim() || u?.Username || 'User';
										const userid = u?.userid ? Number(u.userid) : null;
										const cachedFiles = (userid && requirementid) ? dataCache.get(CacheKeys.userFiles(requirementid, userid)) : null;
										const rawUserFiles = (userid && filesByUserId[userid] && filesByUserId[userid].length > 0)
											? filesByUserId[userid]
											: (cachedFiles && Array.isArray(cachedFiles) && cachedFiles.length > 0)
											? cachedFiles
											: (u?.userFiles && Array.isArray(u.userFiles) && u.userFiles.length > 0)
											? u.userFiles
											: (userid && fileByUserId[userid] ? [fileByUserId[userid]] : []);
										const userFiles = isViewerAuditor
											? rawUserFiles.filter((f) => f && f.reviewstatus === 'approved')
											: rawUserFiles;
										const hasuploaded = isViewerAuditor
											? ((userid && filesByUserId[userid] !== undefined)
												? userFiles.length > 0
												: (userFiles.length > 0 || Number(u?.approvedcount || 0) > 0))
											: ((userid && filesByUserId[userid] !== undefined)
												? filesByUserId[userid].length > 0
												: (userFiles.length > 0 || u?.hasuploaded === 1 || u?.hasuploaded === true));

										return (
											<div
												key={u?.userid || displayname}
												className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs cursor-pointer transition hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20"
												onClick={() => {
													if (onViewUserFilesModal) {
														onViewUserFilesModal(u, requirementid, userFiles);
													} else {
														onViewUserFile?.(u, requirementid);
													}
												}}
												role="button"
												tabIndex={0}
											>
												<div className="flex items-center justify-between">
													{(() => {
														const approvedCount = userFiles.filter(f => f.reviewstatus === 'approved').length;
														const rejectedCount = userFiles.filter(f => f.reviewstatus === 'rejected').length;
														const isAllApproved = approvedCount === userFiles.length && userFiles.length > 0;
														const isPartialApproved = approvedCount > 0 && !isAllApproved;
														const hasRejected = rejectedCount > 0;

														let borderColor = 'border-slate-200';
														let badge = null;

														if (hasuploaded && !isViewerAuditor) {
															if (hasRejected) {
																borderColor = 'border-rose-400';
																badge = (
																	<span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-rose-500 text-white shadow-2xs" title="Needs Revision">
																		<svg className="w-2.5 h-2.5 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
																			<line x1="12" y1="8" x2="12" y2="12"></line>
																			<line x1="12" y1="16" x2="12.01" y2="16"></line>
																		</svg>
																	</span>
																);
															} else if (isAllApproved) {
																borderColor = 'border-emerald-500';
																badge = (
																	<span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-white shadow-2xs" title="All Approved">
																		<svg className="w-2.5 h-2.5 stroke-white" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
																			<polyline points="20 6 9 17 4 12" />
																		</svg>
																	</span>
																);
															} else if (isPartialApproved) {
																borderColor = 'border-blue-400';
																badge = (
																	<span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-2xs" title="Partially Approved">
																		<svg className="w-2.5 h-2.5 stroke-white" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
																			<polyline points="20 6 9 17 4 12" />
																		</svg>
																	</span>
																);
															} else {
																borderColor = 'border-amber-400';
																badge = (
																	<span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] min-w-[18px] min-h-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-white shadow-2xs" title="Pending Review">
																		<svg className="w-2.5 h-2.5 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
																			<circle cx="12" cy="12" r="9"/>
																			<polyline points="12 7 12 12 15 14"/>
																		</svg>
																	</span>
																);
															}
														}

														return (
															<div className="flex items-center gap-3 min-w-0">
																<div className="relative shrink-0">
																	<SmartUserAvatar
																		user={u}
																		size="h-11 w-11"
																		textSize="text-xs"
																		ring={`border-2 ${borderColor}`}
																	/>
																	{badge}
																</div>
																<div className="min-w-0">
																	<div className="truncate text-xs font-bold text-slate-800">{displayname}</div>
																	<div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
																		{hasuploaded ? `${userFiles.length} standard file(s) uploaded` : (isViewerAuditor ? 'Assigned' : 'Assigned (Pending upload)')}
																	</div>
																</div>
															</div>
														);
													})()}

													<div className="flex items-center gap-2">
														{(() => {
															if (isViewerAuditor) return null;
															if (!hasuploaded) {
																return (
																	<span className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold bg-slate-100 text-slate-500">
																		Assigned
																	</span>
																);
															}
															const approvedCount = userFiles.filter(f => f.reviewstatus === 'approved').length;
															const rejectedCount = userFiles.filter(f => f.reviewstatus === 'rejected').length;
															const isAllApproved = approvedCount === userFiles.length && userFiles.length > 0;
															const isPartialApproved = approvedCount > 0 && !isAllApproved;
															const hasRejected = rejectedCount > 0;

															if (hasRejected) {
																return (
																	<span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs flex items-center gap-1">
																		<span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
																		Needs Revision ({rejectedCount})
																	</span>
																);
															}
															if (isAllApproved) {
																return (
																	<span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs flex items-center gap-1">
																		<span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
																		All Approved
																	</span>
																);
															}
															if (isPartialApproved) {
																return (
																	<span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs flex items-center gap-1">
																		<span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
																		{approvedCount}/{userFiles.length} Approved
																	</span>
																);
															}
															return (
																<span className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs flex items-center gap-1">
																	<span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
																	Pending Review
																</span>
															);
														})()}
													</div>
												</div>
											</div>
										);
									})}

									{/* Single upload control placed below the user list for auditors to add files */}
									{allowWorkActions && currentUser && onFileUpload && users.some((uu) => Number(uu?.userid) === Number(currentUser?.userid)) && (
										<div className="mt-2 px-0">
											<input
												id={`user-upload-${requirementid}-${currentUser?.userid}`}
												type="file"
												accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.mp4,.webm,.ogg,.mov,.avi,.mkv"
												multiple
												className="hidden"
												onChange={handleUploadAndRefresh}
											/>
											<label
												htmlFor={`user-upload-${requirementid}-${currentUser?.userid}`}
												onClick={(e) => e.stopPropagation()}
												className="mx-3 w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/50 font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-100/60 transition-all flex px-4 py-2.5 text-xs gap-2"
											>
												<svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
													<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
												</svg>
												<span>+ Add More Standard Files</span>
											</label>
										</div>
									)}
									{users.length === 0 && (
										<div className="rounded-xl border border-dashed border-slate-300/60 bg-slate-100/80 py-8 text-center text-sm text-slate-500">
											No assigned users.
										</div>
									)}
								</div>
							</div>
						)}

						{isYourWorkView && <div className="flex-1 min-h-2" />}

						{shouldRenderPrivateCommentSection ? (
							<div className="mt-4">
							{savedComment ? (
								<div className="mb-2">
									<div className="rounded-lg border border-slate-300/50 bg-slate-50 p-3 shadow-sm">
										<div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-gray-800">
											<span>
												{commentLabel}
												{savedCommentAt ? (
													<span className="font-normal text-gray-500"> - {formatShortDate(savedCommentAt)}</span>
												) : null}
											</span>
											{canEditPrivateComments ? (
												<button
													type="button"
													onClick={handleClearComment}
													disabled={savingComment}
													className="rounded-md px-2 py-0.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 flex items-center gap-1"
												>
													{savingComment ? (
														<>
															<svg className="animate-spin h-3 w-3 text-rose-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
																<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
																<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
															</svg>
															<span>Clearing...</span>
														</>
													) : (
														'Clear'
													)}
												</button>
											) : null}
										</div>
										<div className="mt-1 text-[14px] text-gray-800 break-words">{savedComment}</div>
									</div>
								</div>
							) : null}

							{canEditPrivateComments ? (
								<>
									<div className="rounded-full border border-slate-300/50 bg-slate-50 px-3 py-2 flex items-center gap-2">
										<input
											type="text"
											value={commentInput}
											onChange={(e) => setCommentInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && !savingComment) {
													e.preventDefault();
													handleSaveComment();
												}
											}}
											className="flex-1 bg-transparent outline-none text-[13px] text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
											placeholder={savingComment ? "Saving comment..." : "Add private comment..."}
											disabled={savingComment || !officeid}
										/>
										<button
											type="button"
											onClick={handleSaveComment}
											disabled={savingComment || !officeid || !String(commentInput || '').trim()}
											className="h-8 w-8 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40"
											aria-label="Send private comment"
											title={savingComment ? 'Saving...' : (!officeid ? 'Office required' : 'Send')}
										>
											{savingComment ? (
												<svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
													<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
													<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
												</svg>
											) : (
												<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
													<path d="M3 12L21 3l-6 18-2.7-7.3L3 12Z" fill="currentColor" />
												</svg>
											)}
										</button>
									</div>
									{commentStatus === 'Failed to save' ? (
										<div className="mt-1 text-[11px] text-red-600">Failed to save</div>
									) : null}
								</>
							) : null}
						</div>
					) : null}
					</div>
				</div>
			</div>
		</div>
	);
}
