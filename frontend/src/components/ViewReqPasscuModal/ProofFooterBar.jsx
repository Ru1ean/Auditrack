import React from 'react';
import api from '../../utils/api';
import { API_BASE_URL } from '../../utils/apiBase';
import { useToast } from '../UI/Toast';

const btnBase = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

export default function ProofFooterBar({
    isAdmin,
    proofFileUrl,
    fileInputRef,
    handleProofFileChange,
    uploadingProof,
    showConfirm,
    showAlert,
    officeid,
    fetchOfficeRequirements,
    unsubmittingProof,
    setUnsubmittingProof,
    setPersistedProof,
    setProofFileName,
    setProofFileUrl,
    setExcelHtml,
    setExcelPreviewError,
    setExcelHtmlLoading,
    setDocxPreviewError,
    setShowDocViewer,
    onClose,
}) {
    const { toast } = useToast();

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 bg-white px-5 py-3 shadow-[0_-1px_4px_0_rgba(0,0,0,0.04)]">
            {isAdmin ? (
                <div className="flex flex-wrap items-center gap-2">
                    {/* Label */}
                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Proof Document
                    </span>

                    {!proofFileUrl ? (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleProofFileChange}
                                accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
                                disabled={uploadingProof}
                            />
                            <button
                                type="button"
                                className={`${btnBase} border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300`}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingProof}
                            >
                                {uploadingProof ? (
                                    <>
                                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Uploading…
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                        </svg>
                                        Upload proof
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <>
                            {/* File uploaded indicator */}
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700">
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Uploaded
                            </span>

                            <a
                                href={proofFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${btnBase} border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100`}
                                download
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download
                            </a>

                            <button
                                type="button"
                                className={`${btnBase} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
                                onClick={() => {
                                    setExcelHtml(null);
                                    setExcelPreviewError(null);
                                    setExcelHtmlLoading(false);
                                    setDocxPreviewError(null);
                                    setShowDocViewer(true);
                                }}
                            >
                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Preview
                            </button>

                            <button
                                type="button"
                                className={`${btnBase} border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100`}
                                onClick={async () => {
                                    const ok = await showConfirm('Delete proof document? This cannot be undone.');
                                    if (!ok) return;
                                    setUnsubmittingProof(true);
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch(`${API_BASE_URL}/api/officedocuments/${officeid}/proof`, {
                                            method: 'DELETE',
                                            headers: { Authorization: `Bearer ${token}` },
                                        });
                                        let data = {};
                                        const text = await res.text();
                                        try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { __raw: text }; }
                                        if (res.ok && data.success) {
                                            toast({
                                                title: 'Deleted',
                                                description: 'Proof document deleted successfully.',
                                                variant: 'success'
                                            });
                                            setPersistedProof(null);
                                            setProofFileName('');
                                            setProofFileUrl('');
                                            try { await fetchOfficeRequirements(); } catch (e) { /* ignore */ }
                                            try {
                                                const res2 = await api.get(`/api/officedocuments/${officeid}/proof`);
                                                if (res2.data && res2.data.success) {
                                                    setPersistedProof({ filename: res2.data.filename, url: `${API_BASE_URL}${res2.data.url}` });
                                                    setProofFileName(res2.data.filename);
                                                    setProofFileUrl(`${API_BASE_URL}${res2.data.url}`);
                                                } else {
                                                    setPersistedProof(null);
                                                    setProofFileName('');
                                                    setProofFileUrl('');
                                                }
                                            } catch (e) { /* ignore */ }
                                            toast?.({
                                                title: 'Proof Deleted',
                                                description: 'Proof document removed successfully.',
                                                variant: 'success',
                                                duration: 3000
                                            });
                                        } else {
                                            await showAlert(data.message || 'Failed to delete proof');
                                        }
                                    } catch (err) {
                                        console.error('Delete proof error', err);
                                        await showAlert('Failed to delete proof');
                                    } finally {
                                        setUnsubmittingProof(false);
                                    }
                                }}
                                disabled={unsubmittingProof}
                            >
                                {unsubmittingProof ? (
                                    <>
                                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Removing…
                                    </>
                                ) : (
                                    <>
                                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                                        </svg>
                                        Remove
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div /> /* placeholder to keep layout balanced */
            )}
        </div>
    );
}
