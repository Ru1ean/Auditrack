import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../../utils/apiBase';
import { dataCache, CacheKeys } from '../../utils/dataCache';
import { useToast } from '../UI/Toast';
import { useLiveRefresh } from '../../utils/liveSync';
import RenameInline from './RenameInline';
import SmartUserAvatar from './SmartUserAvatar';

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

// Memoized Card Item with Drag and Drop Support & Review Status
const FileCardItem = memo(({ 
    item, 
    idx, 
    onViewFile, 
    onSaveComment, 
    isAdmin, 
    isExpanded, 
    onToggleExpand,
    isDragging,
    isDragOver,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    canReorder,
    isOwnFiles,
    onUnsubmit,
    onRename,
    isViewerAuditor,
    onReview
}) => {
    const [editingTitle, setEditingTitle] = React.useState(false);
    const fileUrl = item.url || item.filepath || '';
    const ext = getExtension(item.filename || fileUrl);
    const displayTitle = item.displayname || item.filename || `Standard ${idx + 1}`;
    const commentText = String(item.comment || item.rejectionreason || '');
    const [localComment, setLocalComment] = React.useState(commentText);
    const [savedComment, setSavedComment] = React.useState(commentText);
    const [isSavedRecently, setIsSavedRecently] = React.useState(false);
    const textareaRef = React.useRef(null);
    const saveTimerRef = React.useRef(null);

    React.useEffect(() => {
        const text = String(item.comment || item.rejectionreason || '');
        setLocalComment(text);
        setSavedComment(text);
    }, [item.comment, item.rejectionreason]);

    const isDirty = localComment.trim() !== savedComment.trim();
    const isLongComment = localComment.length > 130 || localComment.split('\n').length > 2;

    const reviewstatus = item.reviewstatus || 'pending';
    const isApproved = reviewstatus === 'approved';
    const isRejected = reviewstatus === 'rejected';
    const canApproveReject = Boolean(isAdmin);
    const canComment = Boolean(isAdmin || isViewerAuditor);

    const handleSaveComment = (valToSave = localComment) => {
        const val = String(valToSave || '').trim();
        const oldVal = String(savedComment || '').trim();
        setSavedComment(val);
        setLocalComment(val);
        onSaveComment?.(item, val);
        setIsSavedRecently(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setIsSavedRecently(false), 2500);

        if (!val && oldVal) {
            toast?.({
                title: 'Comment Cleared',
                description: 'The comment has been removed.',
                variant: 'info',
                duration: 2500
            });
        } else if (val && val !== oldVal) {
            toast?.({
                title: 'Comment Saved',
                description: 'File comment updated successfully.',
                variant: 'success',
                duration: 2500
            });
        }
    };

    const handleRejectClick = (e) => {
        e.stopPropagation();
        onReview?.(item, 'rejected', localComment);
        if (!localComment.trim() && textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handleApproveClick = (e) => {
        e.stopPropagation();
        onReview?.(item, 'approved', localComment);
    };

    const handleResetClick = (e) => {
        e.stopPropagation();
        onReview?.(item, 'pending', localComment);
    };

    const handleBlurComment = (e) => {
        if (isDirty) {
            handleSaveComment(e.target.value);
        }
    };

    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSaveComment(localComment);
        }
    };

    return (
        <div
            draggable={canReorder}
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={(e) => onDragOver(e, idx)}
            onDrop={(e) => onDrop(e, idx)}
            onDragEnd={onDragEnd}
            onClick={() => onViewFile?.(item)}
            onContextMenu={(e) => {
                if (isViewerAuditor) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            className={`group cursor-pointer rounded-xl border-2 bg-white p-3 sm:p-3.5 shadow-2xs flex flex-col justify-between gap-2 transition-all [content-visibility:auto] [contain-intrinsic-size:200px] ${
                isDragging ? 'opacity-40 scale-[0.98] border-dashed border-blue-400 bg-blue-50/20' :
                isDragOver ? 'border-blue-500 ring-2 ring-blue-400/50 shadow-md scale-[1.01]' :
                !isViewerAuditor && isRejected ? 'border-rose-400 bg-rose-50/25 hover:border-rose-500 hover:shadow-md' :
                !isViewerAuditor && isApproved ? 'border-emerald-400 bg-emerald-50/25 hover:border-emerald-500 hover:shadow-md' :
                'border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 hover:shadow-md'
            }`}
        >
            {/* Top Review Status Badge */}
            <div className="flex items-center justify-between gap-2">
                {!isViewerAuditor ? (
                    <div className="flex items-center gap-1.5">
                        {isApproved && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                <svg className="w-3 h-3 text-emerald-600 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Approved
                            </span>
                        )}
                        {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                                <svg className="w-3 h-3 text-rose-600 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Needs Revision
                            </span>
                        )}
                        {!isApproved && !isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                                <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <circle cx="12" cy="12" r="9"/>
                                    <polyline points="12 7 12 12 15 14"/>
                                </svg>
                                Pending Review
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            Standard
                        </span>
                    </div>
                )}

                <span className="text-[10px] font-bold text-slate-400">
                    File #{idx + 1}
                </span>
            </div>

            {/* Card Header & Preview */}
            <div className="flex items-center gap-2.5">
                {canReorder && (
                    <div 
                        className="cursor-grab active:cursor-grabbing text-slate-300 group-hover:text-slate-500 flex items-center justify-center pt-1 shrink-0 transition-colors"
                        title="Drag to reorder file"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h.01M8 15h.01M16 9h.01M16 15h.01" />
                        </svg>
                    </div>
                )}

                <div className={`h-11 w-11 shrink-0 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden shadow-2xs group-hover:border-blue-300 ${
                    !isViewerAuditor && isApproved ? 'border-emerald-200 bg-emerald-50/40' :
                    !isViewerAuditor && isRejected ? 'border-rose-200 bg-rose-50/40' :
                    'border-slate-200'
                }`}>
                    {isImageExt(ext) && fileUrl ? (
                        <img 
                            src={fileUrl} 
                            alt="" 
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover" 
                        />
                    ) : isVideoExt(ext) ? (
                        <div className="h-full w-full bg-slate-900 flex items-center justify-center text-white">
                            <svg className="w-5 h-5 text-indigo-400 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                        </div>
                    ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                            {(ext || '').slice(0, 4) || 'FILE'}
                        </span>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                        <div className="font-bold text-slate-900 text-xs truncate group-hover:text-blue-600 transition-colors" title={displayTitle}>
                            {!editingTitle ? displayTitle : (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <RenameInline
                                        item={item}
                                        forceEditing={true}
                                        onRename={(newTitle) => { onRename?.(item, newTitle); setEditingTitle(false); }}
                                        onCancel={() => setEditingTitle(false)}
                                    />
                                </div>
                            )}
                        </div>
                        {isOwnFiles && (
                            <div className="flex items-center gap-2">
                                {!editingTitle && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
                                        className="p-1 rounded-md hover:bg-rose-50 text-rose-600 border border-transparent"
                                        title="Rename"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                        </svg>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUnsubmit?.(item.id || item.filename);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
                                    title="Remove file"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{getFileTypeLabel(ext)}</span>
                        <span>•</span>
                        <span className="truncate max-w-[140px] text-slate-400">{item.filename || 'file'}</span>
                    </div>
                </div>
            </div>

            {/* Admin Review Action Bar (Approve / Reject only for Admin) */}
            {canApproveReject && (
                <div 
                    className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="text-[11px] font-bold text-slate-600">Review:</span>
                    <div className="flex items-center gap-1.5">
                        {/* Approve Button */}
                        <button
                            type="button"
                            onClick={handleApproveClick}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                isApproved 
                                    ? 'bg-emerald-600 text-white shadow-2xs ring-1 ring-emerald-700' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title="Approve standard file"
                        >
                            <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>Approve</span>
                        </button>

                        {/* Reject Button */}
                        <button
                            type="button"
                            onClick={handleRejectClick}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                isRejected 
                                    ? 'bg-rose-600 text-white shadow-2xs ring-1 ring-rose-700' 
                                    : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            }`}
                            title="Reject standard file and set comment as rejection reason"
                        >
                            <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            <span>Reject</span>
                        </button>

                        {/* Reset to Pending (if already reviewed) */}
                        {(isApproved || isRejected) && (
                            <button
                                type="button"
                                onClick={handleResetClick}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                                title="Reset status to Pending"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Per-File Comment & Rejection Reason Section (Hidden for Auditors) */}
            {!isViewerAuditor && (
                <div 
                    className="pt-2 border-t border-slate-100 flex flex-col gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between text-xs font-semibold h-6 min-h-[24px]">
                        {isRejected ? (
                            <span className="text-rose-700 font-bold flex items-center gap-1 leading-none">
                                <svg className="w-3.5 h-3.5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Rejection Reason / Revision Note:
                            </span>
                        ) : isApproved ? (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 leading-none">
                                <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Auditor Note:
                            </span>
                        ) : (
                            <span className="text-slate-700 font-semibold leading-none">Auditor Note / Comment:</span>
                        )}

                        {canComment && (
                            <div className="h-6 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {isSavedRecently && !isDirty && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-in fade-in duration-200 leading-none">
                                        <svg className="w-3 h-3 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Saved
                                    </span>
                                )}
                                {isDirty && (
                                    <button
                                        type="button"
                                        onClick={() => handleSaveComment(localComment)}
                                        className="inline-flex items-center gap-1 px-2 h-5 rounded text-[10px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-all cursor-pointer animate-in zoom-in-90 duration-150 leading-none"
                                        title="Save note (Ctrl+Enter)"
                                    >
                                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        Save
                                    </button>
                                )}
                            </div>
                        )}

                        {isLongComment && !canComment && (
                            <button
                                type="button"
                                onClick={onToggleExpand}
                                className="text-[11px] font-medium text-blue-600 hover:underline leading-none"
                            >
                                {isExpanded ? 'Show less' : 'Show more'}
                            </button>
                        )}
                    </div>

                    {canComment ? (
                        <textarea
                            ref={textareaRef}
                            rows={2}
                            value={localComment}
                            onChange={(e) => setLocalComment(e.target.value)}
                            onBlur={handleBlurComment}
                            onKeyDown={handleKeyDown}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            placeholder={
                                isRejected 
                                    ? "Type rejection reason / revision note (Ctrl+Enter to save)..."
                                    : "Add feedback or revision note (Ctrl+Enter to save)..."
                            }
                            className={`w-full rounded-lg border-2 py-1.5 px-2 text-[11px] font-medium shadow-2xs focus:bg-white focus:outline-none focus:ring-1 resize-none min-h-[44px] max-h-[58px] leading-tight ${
                                isRejected
                                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-500 focus:ring-rose-400 placeholder:text-rose-400'
                                    : isApproved
                                    ? 'border-emerald-400 bg-emerald-50/20 text-emerald-900 focus:border-emerald-500 focus:ring-emerald-400 placeholder:text-emerald-400'
                                    : 'border-slate-300 bg-slate-50/80 text-slate-800 focus:border-blue-400 focus:ring-blue-400 placeholder:text-slate-400'
                            }`}
                        />
                    ) : (
                        <div className={`w-full rounded-lg border-2 py-1.5 px-2 text-[11px] font-medium break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap leading-tight min-h-[38px] ${
                            isRejected 
                                ? 'border-rose-300 bg-rose-50/70 text-rose-900' 
                                : isApproved
                                ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800'
                                : 'border-slate-200 bg-slate-50/90 text-slate-700'
                        }`}>
                            {localComment ? (
                                <span className={!isExpanded && isLongComment ? 'line-clamp-2' : ''}>
                                    {localComment}
                                </span>
                            ) : (
                                <span className="italic text-slate-400 font-normal">
                                    {isRejected ? 'Needs revision (no comment provided)' : 'No comment from auditor'}
                                </span>
                            )}
                            {item.reviewerName && (
                                <div className="mt-0.5 text-[9px] text-slate-400 font-normal">
                                    Reviewed by: {item.reviewerName}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export default function UserFilesGridModal({
    show = false,
    user = null,
    requirement = null,
    files = [],
    officeid = null,
    onClose,
    onViewFile,
    onUpdateComment,
    onReorderFiles,
    isAdmin = false,
    currentUser = null,
    onUpload = null,
    onUnsubmit = null,
    onRename = null,
    onReviewFile = null,
    viewerRoleId = 0,
    uploading = false
}) {
    const isOwnFiles = !!(currentUser && user && Number(currentUser.userid) === Number(user.userid));
    const isViewerAuditor = Number(viewerRoleId || currentUser?.roleid || 0) === 4 ||
        String(currentUser?.rolename || '').toLowerCase().includes('auditor') ||
        String(currentUser?.Position || '').toLowerCase().includes('auditor') ||
        Boolean(currentUser?.isExternalAuditor);
    const { toast } = useToast();
    const [expandedComments, setExpandedComments] = useState({});
    const [visibleCount, setVisibleCount] = useState(9);
    const filterForAuditor = (arr) => isViewerAuditor ? (arr || []).filter(f => f && f.reviewstatus === 'approved') : (arr || []);
    const [localFiles, setLocalFiles] = useState(() => filterForAuditor(files));
    const [draggedIdx, setDraggedIdx] = useState(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const sentinelRef = useRef(null);

    useEffect(() => {
        setLocalFiles(filterForAuditor(files));
    }, [files, isViewerAuditor]);

    const pageSize = isViewerAuditor ? 15 : 9;

    useEffect(() => {
        if (show) {
            setVisibleCount(pageSize);
        }
    }, [show, user?.userid, pageSize]);

    // Real-time live synchronization while modal is open
    useLiveRefresh(async () => {
        if (!show || !requirement?.requirementid || !user?.userid) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(
                `${API_BASE_URL}/api/requirements/${requirement.requirementid}/user-file/${user.userid}${officeid ? `?officeid=${officeid}` : ''}`,
                { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
            );
            if (res.ok) {
                const data = await res.json();
                if (data?.success) {
                    const fresh = Array.isArray(data.files) && data.files.length > 0 
                        ? data.files 
                        : (data.file ? [data.file] : []);
                    setLocalFiles(filterForAuditor(fresh));
                }
            }
        } catch (err) {
            console.warn('Live refresh error in UserFilesGridModal:', err);
        }
    }, { entityTypes: ['requirements', 'compliance', 'documents', 'all'], deps: [show, requirement?.requirementid, user?.userid, officeid, isViewerAuditor] });

    // Native IntersectionObserver for zero JS scroll overhead
    useEffect(() => {
        if (!show || visibleCount >= localFiles.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => Math.min(prev + pageSize, localFiles.length));
                }
            },
            { threshold: 0.1, rootMargin: '200px' }
        );

        const currentSentinel = sentinelRef.current;
        if (currentSentinel) {
            observer.observe(currentSentinel);
        }

        return () => {
            if (currentSentinel) {
                observer.unobserve(currentSentinel);
            }
        };
    }, [show, visibleCount, localFiles.length, pageSize]);

    if (!show || !user) return null;

    const displayname = `${user?.firstname || ''}${user?.lastname ? ' ' + user.lastname : ''}`.trim() || user?.Username || 'Personnel';

    const reqCode = requirement?.requirementcode || 'Requirement';
    const reqDesc = requirement?.description || requirement?.Description || '';

    const handleSaveComment = (item, newCommentVal) => {
        const val = newCommentVal.trim();
        if (val !== (item.comment || '')) {
            onUpdateComment?.(requirement?.requirementid, item.id, val);
            setLocalFiles(prev => {
                const updated = prev.map(f => f.id === item.id ? { ...f, comment: val, rejectionreason: f.reviewstatus === 'rejected' ? val : f.rejectionreason } : f);
                if (requirement?.requirementid && user?.userid) {
                    dataCache.set(CacheKeys.userFiles(requirement.requirementid, user.userid), updated);
                    window.dispatchEvent(new CustomEvent('evidence-file-updated', {
                        detail: { reqId: requirement.requirementid, userid: user.userid, files: updated }
                    }));
                }
                return updated;
            });
            toast?.({
                title: 'Comment Saved',
                description: 'Updated file feedback comment',
                variant: 'success',
                duration: 2000
            });
        }
    };

    const handleRename = async (item, newTitle) => {
        if (!newTitle || !item) return;
        try {
            await onRename?.(requirement?.requirementid, item.id, newTitle);
            setLocalFiles(prev => {
                const updated = prev.map(f => f.id === item.id ? { ...f, displayname: newTitle } : f);
                if (requirement?.requirementid && user?.userid) {
                    dataCache.set(CacheKeys.userFiles(requirement.requirementid, user.userid), updated);
                    window.dispatchEvent(new CustomEvent('evidence-file-updated', {
                        detail: { reqId: requirement.requirementid, userid: user.userid, files: updated }
                    }));
                }
                return updated;
            });
            toast?.({ title: 'Title Updated', description: 'File title updated', variant: 'success', duration: 2000 });
        } catch (err) {
            console.error('Rename failed', err);
            toast?.({ title: 'Rename Failed', description: 'Could not update title', variant: 'error', duration: 3000 });
        }
    };

    const handleReviewClick = (item, status, reason = '') => {
        handleExecuteReview(item, status, reason);
    };

    const handleExecuteReview = async (item, status, reason = '') => {
        if (!requirement?.requirementid || !item?.id) return;
        setIsSubmittingReview(true);

        // Instant optimistic update
        setLocalFiles(prev => {
            const updated = prev.map(f => f.id === item.id ? {
                ...f,
                reviewstatus: status,
                comment: reason || f.comment,
                rejectionreason: status === 'rejected' ? reason : '',
            } : f);
            if (requirement?.requirementid && user?.userid) {
                dataCache.set(CacheKeys.userFiles(requirement.requirementid, user.userid), updated);
                window.dispatchEvent(new CustomEvent('evidence-file-reviewed', {
                    detail: {
                        reqId: requirement.requirementid,
                        fileId: item.id,
                        status,
                        userid: user.userid,
                        reason
                    }
                }));
            }
            return updated;
        });

        try {
            if (onReviewFile) {
                const resData = await onReviewFile(requirement.requirementid, item.id, status, reason);
                if (resData) {
                    setLocalFiles(prev => {
                        const updated = prev.map(f => f.id === item.id ? {
                            ...f,
                            reviewstatus: resData?.reviewstatus || status,
                            comment: resData?.comment || reason || f.comment,
                            rejectionreason: resData?.rejectionreason || reason,
                            reviewedby: resData?.reviewedby,
                            reviewedat: resData?.reviewedat,
                            reviewerName: resData?.reviewerName || (currentUser ? `${currentUser.firstname || ''} ${currentUser.lastname || ''}`.trim() : 'Auditor')
                        } : f);
                        if (requirement?.requirementid && user?.userid) {
                            dataCache.set(CacheKeys.userFiles(requirement.requirementid, user.userid), updated);
                            window.dispatchEvent(new CustomEvent('evidence-file-reviewed', {
                                detail: {
                                    reqId: requirement.requirementid,
                                    fileId: item.id,
                                    status: resData?.reviewstatus || status,
                                    userid: user.userid,
                                    reason: resData?.rejectionreason || reason,
                                    resData
                                }
                            }));
                        }
                        return updated;
                    });
                }
            } else {
                const res = await fetch(`${API_BASE_URL}/api/requirements/${requirement.requirementid}/file/${item.id}/review`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                    },
                    body: JSON.stringify({ status, reason })
                });
                const data = await res.json();
                if (data.success) {
                    setLocalFiles(prev => {
                        const updated = prev.map(f => f.id === item.id ? {
                            ...f,
                            reviewstatus: data.reviewstatus || status,
                            comment: data.comment || reason || f.comment,
                            rejectionreason: data.rejectionreason || reason,
                            reviewedby: data.reviewedby,
                            reviewedat: data.reviewedat,
                            reviewerName: data.reviewerName
                        } : f);
                        if (requirement?.requirementid && user?.userid) {
                            dataCache.set(CacheKeys.userFiles(requirement.requirementid, user.userid), updated);
                            window.dispatchEvent(new CustomEvent('evidence-file-reviewed', {
                                detail: {
                                    reqId: requirement.requirementid,
                                    fileId: item.id,
                                    status: data.reviewstatus || status,
                                    userid: user.userid,
                                    reason: data.rejectionreason || reason,
                                    resData: data
                                }
                            }));
                        }
                        return updated;
                    });
                }
            }

            const label = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Needs Revision' : 'Reset to Pending';
            toast?.({
                title: `Standard ${label}`,
                description: status === 'rejected' ? 'Rejection note saved to comment' : `File marked as ${status}`,
                variant: status === 'approved' ? 'success' : status === 'rejected' ? 'warning' : 'info',
                duration: 2500
            });
        } catch (err) {
            console.error('Failed to review standard:', err);
            toast?.({
                title: 'Review Failed',
                description: err?.response?.data?.message || err.message || 'Could not update status',
                variant: 'error',
                duration: 3000
            });
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const toggleExpandComment = (itemId) => {
        setExpandedComments(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const handleDragStart = (e, index) => {
        setDraggedIdx(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === index) return;
        setDragOverIdx(index);
    };

    const handleDrop = async (e, targetIdx) => {
        e.preventDefault();
        if (draggedIdx === null || draggedIdx === targetIdx) {
            setDraggedIdx(null);
            setDragOverIdx(null);
            return;
        }

        const updated = [...localFiles];
        const [movedItem] = updated.splice(draggedIdx, 1);
        updated.splice(targetIdx, 0, movedItem);

        setLocalFiles(updated);
        setDraggedIdx(null);
        setDragOverIdx(null);

        const targetUserId = user.userid || user.id;
        const targetReqId = requirement?.requirementid;
        const orderedIds = updated.map(f => f.id).filter(Boolean);

        if (targetReqId && targetUserId && orderedIds.length > 0) {
            onReorderFiles?.(targetReqId, updated);
            if (targetReqId && targetUserId) {
                dataCache.set(CacheKeys.userFiles(targetReqId, targetUserId), updated);
            }
            try {
                const token = localStorage.getItem('token');
                await fetch(`${API_BASE_URL}/api/requirements/${targetReqId}/user-file/${targetUserId}/reorder`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ orderedIds })
                });
                toast?.({
                    title: 'Order Updated',
                    description: 'File order saved successfully',
                    variant: 'success',
                    duration: 2000
                });
            } catch (err) {
                console.error('Failed to persist file reorder:', err);
            }
        }
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const visibleFiles = localFiles.slice(0, visibleCount);
    const hasMore = visibleCount < localFiles.length;

    const modalContent = (
        <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 transition-opacity animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                className="relative w-full max-w-6xl max-h-[94vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header matching App Design System */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
                    {(() => {
                        const approvedCount = localFiles.filter(f => f.reviewstatus === 'approved').length;
                        const rejectedCount = localFiles.filter(f => f.reviewstatus === 'rejected').length;
                        const isAllApproved = approvedCount === localFiles.length && localFiles.length > 0;
                        const isPartialApproved = approvedCount > 0 && !isAllApproved;
                        const hasRejected = rejectedCount > 0;

                        let borderColor = 'border-slate-200';
                        let badgeBg = null;
                        let badgeIcon = null;
                        let statusPill = null;

                        if (!isViewerAuditor) {
                            borderColor = 'border-amber-400';
                            badgeBg = 'bg-amber-500';
                            badgeIcon = (
                                <svg className="w-2 h-2 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                    <circle cx="12" cy="12" r="9"/>
                                    <polyline points="12 7 12 12 15 14"/>
                                </svg>
                            );
                            statusPill = (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 border border-amber-200 shadow-2xs">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                    Pending Review ({localFiles.length} files)
                                </span>
                            );

                            if (hasRejected) {
                                borderColor = 'border-rose-400';
                                badgeBg = 'bg-rose-500';
                                badgeIcon = (
                                    <svg className="w-2 h-2 stroke-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                        <line x1="12" y1="8" x2="12" y2="12"></line>
                                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                    </svg>
                                );
                                statusPill = (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                        Needs Revision ({rejectedCount})
                                    </span>
                                );
                            } else if (isAllApproved) {
                                borderColor = 'border-emerald-500';
                                badgeBg = 'bg-emerald-500';
                                badgeIcon = (
                                    <svg className="w-2 h-2 stroke-white" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                );
                                statusPill = (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                        All Approved ({localFiles.length} files)
                                    </span>
                                );
                            } else if (isPartialApproved) {
                                borderColor = 'border-blue-400';
                                badgeBg = 'bg-blue-500';
                                badgeIcon = (
                                    <svg className="w-2 h-2 stroke-white" fill="none" viewBox="0 0 24 24" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                );
                                statusPill = (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700 border border-blue-200 shadow-2xs">
                                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                                        {approvedCount}/{localFiles.length} Approved
                                    </span>
                                );
                            }
                        }

                        return (
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="relative shrink-0">
                                    <SmartUserAvatar
                                        user={user}
                                        size="h-10 w-10"
                                        textSize="text-xs"
                                        ring={`border-2 ${borderColor} shadow-2xs`}
                                    />
                                    {!isViewerAuditor && badgeIcon && (
                                        <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 min-w-[16px] min-h-[16px] shrink-0 items-center justify-center rounded-full border-2 border-white ${badgeBg} text-white shadow-2xs`}>
                                            {badgeIcon}
                                        </span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2.5">
                                        <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{displayname}</h2>
                                        {!isViewerAuditor && statusPill}
                                    </div>
                                    <p className="text-xs text-slate-500 truncate mt-0.5">
                                        <span className="font-semibold text-slate-700">{reqCode}</span>
                                        {reqDesc ? `: ${reqDesc}` : ''}
                                    </p>
                                </div>
                            </div>
                        );
                    })()}
                    
                    <div className="flex items-center gap-3 shrink-0">
                        {isOwnFiles && (
                            <>
                                <label
                                    htmlFor="grid-file-upload-input"
                                    className={`inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100 cursor-pointer ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span>{uploading ? 'Uploading...' : 'Upload File(s)'}</span>
                                </label>
                                <input
                                    type="file"
                                    id="grid-file-upload-input"
                                    className="hidden"
                                    multiple
                                    disabled={uploading}
                                    onChange={(e) => onUpload?.(e, requirement?.requirementid)}
                                />
                            </>
                        )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 shrink-0 cursor-pointer"
                        aria-label="Close"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    </div>
                </div>

                {/* Indeterminate Infinite Loop Bar when uploading in Grid Modal */}
                {uploading && (
                    <div className="px-5 py-2 bg-blue-50/70 border-b border-blue-100 flex flex-col gap-1.5 shrink-0">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700">
                            <span>Uploading standard file(s)...</span>
                            <span className="text-[10px] text-blue-600">Please wait</span>
                        </div>
                        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-blue-100/80">
                            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 animate-indeterminate-bar" />
                        </div>
                    </div>
                )}

                {/* Body: 3-Column 3x2 Grid */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 bg-slate-50/70 [contain:content]">
                    {localFiles.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {visibleFiles.map((item, idx) => {
                                    const fileIdKey = item.id || item.filename || idx;
                                    return (
                                        <div key={fileIdKey}>
                                            <FileCardItem
                                                item={item}
                                                idx={idx}
                                                onViewFile={onViewFile}
                                                onSaveComment={handleSaveComment}
                                                isAdmin={isAdmin}
                                                isExpanded={!!expandedComments[fileIdKey]}
                                                onToggleExpand={() => toggleExpandComment(fileIdKey)}
                                                isDragging={draggedIdx === idx}
                                                isDragOver={dragOverIdx === idx}
                                                onDragStart={handleDragStart}
                                                onDragOver={handleDragOver}
                                                onDrop={handleDrop}
                                                onDragEnd={handleDragEnd}
                                                canReorder={localFiles.length > 1 && (isOwnFiles || isAdmin)}
                                                isOwnFiles={isOwnFiles}
                                                onUnsubmit={onUnsubmit}
                                                onRename={handleRename}
                                                isViewerAuditor={isViewerAuditor}
                                                onReview={handleReviewClick}
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Native Observer Sentinel & Manual Button */}
                            {hasMore && (
                                <div 
                                    ref={sentinelRef}
                                    className="flex flex-col items-center justify-center pt-3 pb-2"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setVisibleCount((prev) => Math.min(prev + pageSize, localFiles.length))}
                                        className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-white px-5 py-2 text-xs font-bold text-blue-600 shadow-2xs hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer"
                                    >
                                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                        </svg>
                                        <span>Load More Files ({localFiles.length - visibleCount} remaining)</span>
                                    </button>
                                    <span className="text-[11px] font-medium text-slate-400 mt-1">
                                        Showing {visibleCount} of {localFiles.length} uploaded files
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-300/80 bg-white py-12 text-center text-sm font-medium text-slate-500">
                            No standard files submitted by this user.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
