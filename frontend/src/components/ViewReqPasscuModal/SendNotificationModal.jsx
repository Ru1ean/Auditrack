import React from 'react';
import { createPortal } from 'react-dom';

export default function SendNotificationModal({
    show,
    leftStyle,
    showNotifForm,
    notifTitle,
    setNotifTitle,
    notifMessage,
    setNotifMessage,
    sendingNotification,
    onClose,
    onSend,
}) {
    if (!show || !showNotifForm) return null;

    return createPortal(
        <div
            className="fixed inset-y-0 right-0 z-[140] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
            style={leftStyle}
            onClick={onClose}
        >
            <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/20" onClick={(e) => e.stopPropagation()}>
                <div className="relative border-b border-slate-100 px-5 py-4">
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-400" />
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                                <svg className="h-5 w-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-900">Send notification</h3>
                                <p className="text-xs text-slate-500">
                                    To: {showNotifForm.user.firstname} {showNotifForm.user.lastname}
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Title</label>
                        <input
                            type="text"
                            value={notifTitle}
                            onChange={(e) => setNotifTitle(e.target.value)}
                            placeholder="Notification title..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 transition focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-700">Message</label>
                        <textarea
                            value={notifMessage}
                            onChange={(e) => setNotifMessage(e.target.value)}
                            placeholder="Write your message..."
                            rows={4}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 transition focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        disabled={sendingNotification}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSend}
                        disabled={sendingNotification || !notifTitle.trim() || !notifMessage.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
                    >
                        {sendingNotification ? (
                            <>
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                Send
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
