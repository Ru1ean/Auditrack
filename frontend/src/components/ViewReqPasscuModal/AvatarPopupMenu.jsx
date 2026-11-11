import React from 'react';
import { createPortal } from 'react-dom';

export default function AvatarPopupMenu({
    isAdmin,
    isOfficeHead,
    isAuditor,
    avatarPopup,
    onClose,
    onViewUserFile,
    onDownloadUserFile,
    onOpenNotifForm,
}) {
    if ((!isAdmin && !isOfficeHead && !isAuditor) || !avatarPopup || !avatarPopup.rect) return null;

    const hasuploaded = isAuditor
        ? (Number(avatarPopup.user.approvedcount ?? avatarPopup.user.totalfiles ?? 0) > 0 && (avatarPopup.user.hasuploaded === 1 || avatarPopup.user.hasuploaded === true))
        : (avatarPopup.user.hasuploaded === 1 || avatarPopup.user.hasuploaded === true);

    return createPortal(
        <div className="fixed inset-0 z-[9999]" onClick={onClose}>
            <div
                className="avatar-popup-menu w-52 overflow-hidden rounded-xl border border-slate-200/80 bg-white py-1 shadow-xl shadow-slate-300/40"
                style={{
                    position: 'fixed',
                    top: avatarPopup.rect.bottom + 6,
                    left: Math.min(avatarPopup.rect.right - 208, window.innerWidth - 220),
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="border-b border-slate-100 px-3.5 py-2.5">
                    <p className="truncate text-xs font-semibold text-slate-900">
                        {avatarPopup.user.firstname} {avatarPopup.user.lastname}
                    </p>
                    {!isAuditor && (
                        <p className={`mt-0.5 text-[10px] font-medium ${hasuploaded ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {hasuploaded ? 'Uploaded' : 'Not uploaded'}
                        </p>
                    )}
                </div>

                {hasuploaded && (
                    <button
                        type="button"
                        onClick={() => onViewUserFile(avatarPopup.user, avatarPopup.requirementid)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[11px] text-slate-700 transition hover:bg-indigo-50"
                    >
                        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View file
                    </button>
                )}

                {hasuploaded && !isAuditor && (
                    <button
                        type="button"
                        onClick={() => onDownloadUserFile(avatarPopup.user, avatarPopup.requirementid)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[11px] text-slate-700 transition hover:bg-indigo-50"
                    >
                        <svg className="h-3.5 w-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4 4-4M21 21H3" />
                        </svg>
                        Download file
                    </button>
                )}

                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => onOpenNotifForm(avatarPopup.user, avatarPopup.requirementid)}
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[11px] text-slate-700 transition hover:bg-amber-50"
                    >
                        <svg className="h-3.5 w-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Send notification
                    </button>
                )}
            </div>
        </div>,
        document.body
    );
}
