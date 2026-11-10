import React, { useState, useMemo, useEffect } from 'react';
import { Check } from 'lucide-react';
import { API_BASE_URL } from '../../utils/apiBase';
import { useToast } from '../UI/Toast';
import RenameInline from './RenameInline';

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

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function YourWorkFileUpload({
    requirementid,
    userid = null,
    hasuploaded = false,
    file = null,
    files = [],
    isLoadingFile = false,
    uploading = false,
    uploadProgressMap = {},
    unsubmitting = false,
    onUpload,
    onUnsubmit,
    onRename,
    onUpdateComment,
    onViewFile,
    onReorder,
    showHeader = true,
    compact = false,
    readOnly = false,
    isAdmin = false
}) {
    const { toast } = useToast();
    const inputId = `your-work-file-${requirementid}`;
    const [editingFileId, setEditingFileId] = useState(null);
    const [titleInput, setTitleInput] = useState('');
    const [expandedComments, setExpandedComments] = useState({});

    const isAuditorUser = useMemo(() => {
        try {
            const stored = localStorage.getItem('user');
            const currentUser = stored ? JSON.parse(stored) : null;
            if (!currentUser) return false;
            return currentUser.roleid === 4 || 
                   Number(currentUser.roleid) === 4 ||
                   String(currentUser.rolename || '').toLowerCase().includes('auditor') || 
                   String(currentUser.Position || '').toLowerCase().includes('auditor') ||
                   Boolean(currentUser.isExternalAuditor);
        } catch {
            return false;
        }
    }, []);

    // Normalize files list: support either files array or single file prop
    const rawFileList = useMemo(() => {
        const list = Array.isArray(files) && files.length > 0 
            ? files 
            : (file ? [file] : []);
        return isAuditorUser ? list.filter(f => f && f.reviewstatus === 'approved') : list;
    }, [files, file, isAuditorUser]);

    const [localFiles, setLocalFiles] = useState(rawFileList);
    const [draggedIdx, setDraggedIdx] = useState(null);
    const [dragOverIdx, setDragOverIdx] = useState(null);

    // Active uploading items from uploadProgressMap that haven't finished yet
    const activeUploadItems = useMemo(() => {
        if (!uploadProgressMap || typeof uploadProgressMap !== 'object') return [];
        return Object.values(uploadProgressMap).filter((item) => item && item.status !== 'done');
    }, [uploadProgressMap]);

    const isUploading = uploading && activeUploadItems.length > 0;

    useEffect(() => {
        if (rawFileList.length > 0) {
            setLocalFiles(rawFileList);
        } else if (!isUploading) {
            setLocalFiles([]);
        }
    }, [rawFileList, isUploading]);

    const approvedCount = localFiles.filter(f => f.reviewstatus === 'approved').length;
    const rejectedCount = localFiles.filter(f => f.reviewstatus === 'rejected').length;
    const isAllApproved = approvedCount === localFiles.length && localFiles.length > 0;
    const isPartialApproved = approvedCount > 0 && !isAllApproved;
    const hasRejected = rejectedCount > 0;

    let workStatus = isAuditorUser ? '' : 'Assigned';
    let workStatusColor = isAuditorUser ? '' : 'text-slate-400 font-semibold';
    if (!isAuditorUser && localFiles.length > 0) {
        if (hasRejected) {
            workStatus = `Needs Revision (${rejectedCount})`;
            workStatusColor = 'text-rose-600 font-semibold';
        } else if (isAllApproved) {
            workStatus = 'All Approved';
            workStatusColor = 'text-emerald-600 font-semibold';
        } else if (isPartialApproved) {
            workStatus = `${approvedCount}/${localFiles.length} Approved`;
            workStatusColor = 'text-blue-600 font-semibold';
        } else {
            workStatus = 'Pending Review';
            workStatusColor = 'text-amber-600 font-semibold';
        }
    }

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

        const targetUserId = movedItem?.uploadedby || movedItem?.userid || userid;
        const orderedIds = updated.map(f => f.id).filter(Boolean);

        if (orderedIds.length > 0 && targetUserId && requirementid) {
            onReorder?.(updated);
            try {
                const token = localStorage.getItem('token');
                await fetch(`${API_BASE_URL}/api/requirements/${requirementid}/user-file/${targetUserId}/reorder`, {
                    method: 'PATCH',
                    headers: { 
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ orderedIds })
                });
                toast?.({
                    title: 'Order Saved',
                    description: 'Reordered standard file sequence',
                    variant: 'success',
                    duration: 2000
                });
            } catch (err) {
                console.error('Failed to save file order:', err);
            }
        }
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
        setDragOverIdx(null);
    };

    const handleStartRename = (e, item) => {
        e?.stopPropagation();
        if (readOnly) return;
        setEditingFileId(item.id || item.filename);
        setTitleInput(item.displayname || item.filename || '');
    };

    const handleSaveRename = (item) => {
        if (!editingFileId) return;
        const trimmed = titleInput.trim();
        if (trimmed && trimmed !== (item.displayname || item.filename)) {
            setLocalFiles(prev => prev.map(f => (
                ((f.id && item.id && f.id === item.id) || f.filename === item.filename)
                    ? { ...f, displayname: trimmed }
                    : f
            )));
            onRename?.(requirementid, item.id, trimmed);
            toast?.({
                title: 'Title Updated',
                description: `Renamed to "${trimmed}"`,
                variant: 'success',
                duration: 2000
            });
        }
        setEditingFileId(null);
    };

    const handleSaveRenameInline = (item, newTitle) => {
        const trimmed = String(newTitle || '').trim();
        if (!trimmed) return;
        if (trimmed !== (item.displayname || item.filename)) {
            setLocalFiles(prev => prev.map(f => (
                ((f.id && item.id && f.id === item.id) || f.filename === item.filename)
                    ? { ...f, displayname: trimmed }
                    : f
            )));
            onRename?.(requirementid, item.id, trimmed);
            toast?.({ title: 'Title Updated', description: 'Renamed file', variant: 'success', duration: 2000 });
        }
        setEditingFileId(null);
    };

    const handleSaveComment = (item, newCommentVal) => {
        const val = String(newCommentVal || '').trim();
        const oldVal = String(item.comment || '').trim();
        if (val !== oldVal) {
            setLocalFiles(prev => prev.map(f => (
                ((f.id && item.id && f.id === item.id) || f.filename === item.filename)
                    ? { ...f, comment: val }
                    : f
            )));
            onUpdateComment?.(requirementid, item.id, val);
            if (!val && oldVal) {
                toast?.({
                    title: 'Comment Cleared',
                    description: 'The comment has been removed.',
                    variant: 'info',
                    duration: 2500
                });
            } else {
                toast?.({
                    title: 'Comment Saved',
                    description: 'Updated file feedback comment',
                    variant: 'success',
                    duration: 2000
                });
            }
        }
    };

    const toggleExpandComment = (e, itemId) => {
        e.stopPropagation();
        setExpandedComments(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    return (
        <div className={compact ? '' : 'mt-3'} onClick={(e) => e.stopPropagation()}>
            {showHeader && (
                <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">Standard Files</span>
                        {localFiles.length > 0 && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                {localFiles.length}/40 uploaded
                            </span>
                        )}
                    </div>
                    <div className={`text-xs ${workStatusColor}`}>
                        {workStatus}
                    </div>
                </div>
            )}

            {/* Evidence List */}
            {localFiles.length > 0 && (
                <div className="space-y-3 mb-3">
                    {localFiles.map((item, index) => {
                        const fileUrl = item.url || item.filepath || '';
                        const ext = getExtension(item.filename || fileUrl);
                        const displayTitle = item.displayname || item.filename || `Document ${index + 1}`;
                        const isEditingThis = editingFileId === (item.id || item.filename);
                        const fileIdKey = item.id || item.filename || index;
                        const isExpanded = !!expandedComments[fileIdKey];
                        const commentText = String(item.comment || '');
                        const isLongComment = commentText.length > 130 || commentText.split('\n').length > 2;

                        const reviewstatus = item.reviewstatus || 'pending';
                        const isApproved = reviewstatus === 'approved';
                        const isRejected = reviewstatus === 'rejected';

                        return (
                            <div
                                key={fileIdKey}
                                draggable={!readOnly && !editingFileId && localFiles.length > 1}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                onClick={() => onViewFile?.(item)}
                                className={`group/card cursor-pointer flex flex-col gap-2.5 rounded-xl border bg-white p-3.5 shadow-2xs transition-all ${
                                    draggedIdx === index ? 'opacity-40 scale-[0.98] border-dashed border-blue-400 bg-blue-50/20' : 
                                    dragOverIdx === index ? 'border-blue-500 ring-2 ring-blue-400/50 shadow-md scale-[1.01]' : 
                                    !isAuditorUser && isRejected ? 'border-rose-300/80 bg-rose-50/10 hover:border-rose-400 hover:shadow-md' :
                                    !isAuditorUser && isApproved ? 'border-emerald-200/80 bg-emerald-50/10 hover:border-emerald-400 hover:shadow-md' :
                                    'border-slate-200/90 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20'
                                } ${compact ? 'text-xs' : ''}`}
                            >
                                {/* Top Review Badge Header */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                        {!isAuditorUser && isApproved && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                                <svg className="w-3 h-3 text-emerald-600 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                                Approved
                                            </span>
                                        )}
                                        {!isAuditorUser && isRejected && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                                                <svg className="w-3 h-3 text-rose-600 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                                Needs Revision
                                            </span>
                                        )}
                                        {!isAuditorUser && !isApproved && !isRejected && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-2xs">
                                                <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <circle cx="12" cy="12" r="9"/>
                                                    <polyline points="12 7 12 12 15 14"/>
                                                </svg>
                                                Pending Review
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-semibold text-slate-400">
                                        File #{index + 1}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    {!readOnly && localFiles.length > 1 && (
                                        <div 
                                            className="cursor-grab active:cursor-grabbing text-slate-300 group-hover/card:text-slate-500 flex items-center justify-center pt-3 shrink-0 transition-colors"
                                            title="Drag up/down to reorder file"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h.01M8 15h.01M16 9h.01M16 15h.01" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="min-w-0 flex-1 flex items-start gap-3">
                                        <div className={`h-11 w-11 shrink-0 rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden shadow-2xs group-hover/card:border-blue-300 ${
                                            isApproved ? 'border-emerald-200 bg-emerald-50/40' :
                                            isRejected ? 'border-rose-200 bg-rose-50/40' :
                                            'border-slate-200'
                                        }`}>
                                            {isImageExt(ext) && fileUrl ? (
                                                <img src={fileUrl} alt="" className="h-full w-full object-cover" />
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
                                            {/* Title: hide while editing so only the inline form shows */}
                                            {!isEditingThis && (
                                                <div className="font-bold text-slate-900 text-xs truncate group-hover/card:text-blue-600 transition-colors" title={displayTitle}>
                                                    {displayTitle}
                                                </div>
                                            )}

                                            <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-slate-500">
                                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{getFileTypeLabel(ext)}</span>
                                                <span>•</span>
                                                <span className="truncate max-w-[260px] text-slate-400">{item.filename || 'file'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {!readOnly && (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <RenameInline
                                                    item={item}
                                                    forceEditing={isEditingThis}
                                                    onRename={(newTitle) => handleSaveRenameInline(item, newTitle)}
                                                    onCancel={() => setEditingFileId(null)}
                                                    onStart={() => setEditingFileId(item.id || item.filename)}
                                                />
                                            </div>
                                        )}

                                        {!readOnly && (
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (unsubmitting) return;
                                                    const targetId = item.id || item.fileId || item.filename;
                                                    const res = await onUnsubmit?.(requirementid, targetId);
                                                    if (res !== false) {
                                                        setLocalFiles((prev) => prev.filter((f) => {
                                                            if (targetId && f.id && String(f.id) === String(targetId)) return false;
                                                            if (targetId && f.fileId && String(f.fileId) === String(targetId)) return false;
                                                            if (targetId && f.filename && f.filename === targetId) return false;
                                                            return true;
                                                        }));
                                                    }
                                                }}
                                                disabled={unsubmitting}
                                                className="h-7 w-7 shrink-0 rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors disabled:opacity-50 cursor-pointer"
                                                title="Remove this file"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                    <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Rejection Feedback Banner (if rejected) */}
                                {isRejected && !isAuditorUser && (item.rejectionreason || commentText) ? (
                                    <div 
                                        className="rounded-lg bg-rose-50 border border-rose-200/90 p-2.5 text-xs text-rose-900 flex flex-col gap-1 shadow-2xs"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[11px]">
                                            <svg className="w-3.5 h-3.5 shrink-0 text-rose-600" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span>Auditor Revision Feedback:</span>
                                        </div>
                                        <p className="text-rose-700 font-medium text-[11px] leading-snug pl-5 whitespace-pre-wrap break-words break-all [overflow-wrap:anywhere]">
                                            {item.rejectionreason || commentText}
                                        </p>
                                        {item.reviewerName && (
                                            <span className="text-[10px] text-rose-500 pl-5 font-normal">Reviewed by: {item.reviewerName}</span>
                                        )}
                                    </div>
                                ) : (!isAuditorUser && (
                                    /* Dedicated Multi-Line Per-File Comment Section (Only when not rejected) */
                                    <div 
                                        className="mt-1.5 pt-2 border-t border-slate-100 flex flex-col gap-1"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                                            <span>{isApproved ? 'Auditor Note:' : 'Comment:'}</span>
                                            {isLongComment && !isAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => toggleExpandComment(e, fileIdKey)}
                                                    className="text-[10px] font-medium text-blue-600 hover:underline"
                                                >
                                                    {isExpanded ? 'Show less' : 'Show more'}
                                                </button>
                                            )}
                                        </div>

                                        {isAdmin ? (
                                            <textarea
                                                rows={2}
                                                defaultValue={commentText}
                                                onBlur={(e) => handleSaveComment(item, e.target.value)}
                                                spellCheck={false}
                                                autoCorrect="off"
                                                autoCapitalize="off"
                                                placeholder="Add auditor feedback comment (supports multiple lines)..."
                                                className="w-full rounded-lg border border-slate-200 bg-slate-50/80 p-2 text-xs font-medium text-slate-800 shadow-2xs focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-slate-400 resize-y min-h-[54px]"
                                            />
                                        ) : (
                                            <div className="w-full rounded-lg border border-slate-100 bg-slate-50/90 p-2.5 text-xs text-slate-700 font-medium break-words break-all [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed">
                                                {commentText ? (
                                                    <span className={!isExpanded && isLongComment ? 'line-clamp-2' : ''}>
                                                        {commentText}
                                                    </span>
                                                ) : (
                                                    <span className="italic text-slate-400 font-normal">No comment from auditor</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Active Uploading Files (Only show items still uploading or failed since done ones are already posted above) */}
            {activeUploadItems.length > 0 && (
                <div className="space-y-3 mb-3">
                    {activeUploadItems.map((item, idx) => {
                        const ext = getExtension(item.name);
                        const isDone = item.percent >= 100 || item.status === 'done';
                        const isError = item.status === 'error';

                        return (
                            <div
                                key={item.name || idx}
                                className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs transition-all space-y-2.5"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 font-bold text-[10px] uppercase shadow-2xs">
                                            {ext.slice(0, 3) || 'DOC'}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-800 truncate max-w-[220px]" title={item.name}>
                                                {item.name}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {item.size ? formatBytes(item.size) : 'File'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-1.5">
                                        {isError ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                                Failed
                                            </span>
                                        ) : isDone ? (
                                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                                <Check className="w-3 h-3 text-emerald-600 inline" />
                                                <span>Ready</span>
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
                                                <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                                                <span>Uploading...</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Indeterminate Infinite Loop Progress Bar Track */}
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60">
                                    {isError ? (
                                        <div className="h-full w-full rounded-full bg-rose-500 transition-all duration-300" />
                                    ) : isDone ? (
                                        <div className="h-full w-full rounded-full bg-emerald-500 transition-all duration-300" />
                                    ) : (
                                        <div className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-600 to-blue-500 animate-indeterminate-bar" />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Button */}
            {!readOnly && (
                <>
                    <input
                        id={inputId}
                        type="file"
                        accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.mp4,.webm,.ogg,.mov,.avi,.mkv"
                        multiple
                        onChange={(e) => onUpload?.(e, requirementid)}
                        className="hidden"
                        disabled={isUploading}
                    />
                    {localFiles.length >= 40 ? (
                        <div className="w-full text-center py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-100/80 text-xs font-semibold text-slate-500">
                            Maximum limit reached (40/40 files uploaded)
                        </div>
                    ) : (
                        <label
                            htmlFor={inputId}
                            className={`w-full cursor-pointer items-center justify-center rounded-xl border border-dashed border-blue-300 bg-blue-50/50 font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-100/60 transition-all ${compact ? 'inline-flex px-3 py-1.5 text-[11px]' : 'flex px-4 py-2.5 text-xs gap-2'} ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
                        >
                            {isUploading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                    </svg>
                                    Uploading files in progress...
                                </span>
                            ) : (
                                <>
                                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>{localFiles.length > 0 ? `+ Add More Standard Files (${localFiles.length}/40)` : '+ Select Standard File(s) (Max 40)'}</span>
                                </>
                            )}
                        </label>
                    )}
                </>
            )}
        </div>
    );
}
