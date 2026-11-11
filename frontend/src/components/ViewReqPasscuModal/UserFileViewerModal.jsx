import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { downloadFileFromUrl, fileNameFromUrl } from '../../utils/downloadFile';
import { usersAPI } from '../../utils/api';

export default function UserFileViewerModal({
    show,
    leftStyle,
    selectedUserFile,
    excelHtml,
    excelHtmlLoading,
    excelPreviewError,
    handleExcelPreview,
    userDocxPreviewRef,
    userDocxPreviewLoading,
    userDocxPreviewError,
    onClose,
}) {
    const [downloading, setDownloading] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        usersAPI.getLoggedInUser().then(res => {
            if (res?.success) setCurrentUser(res.user);
        }).catch(() => {});
    }, []);

    const isAuditor = currentUser?.roleid === 4 || 
                      Number(currentUser?.roleid) === 4 ||
                      String(currentUser?.rolename || '').toLowerCase().includes('auditor') || 
                      String(currentUser?.role || '').toLowerCase().includes('auditor') ||
                      String(currentUser?.Position || '').toLowerCase().includes('auditor') ||
                      Boolean(currentUser?.isExternalAuditor);

    useEffect(() => {
        if (!show || !isAuditor) return;
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && ['s', 'S', 'p', 'P'].includes(e.key)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [show, isAuditor]);

    if (!show || !selectedUserFile) return null;

    const url = String(selectedUserFile?.url || selectedUserFile?.filepath || '');
    const rawName = String(selectedUserFile?.displayname || selectedUserFile?.filename || '').trim() || fileNameFromUrl(url);
    const extMatch = (selectedUserFile?.filename || url).match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
    const ext = extMatch ? extMatch[1] : '';
    let downloadName = rawName;
    if (ext && !downloadName.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
        downloadName = `${downloadName}.${ext}`;
    }

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (!url || downloading) return;
        setDownloading(true);
        try {
            await downloadFileFromUrl(url, downloadName);
        } catch (err) {
            console.error('Download error:', err);
            showAlert(err?.message || 'Failed to download file', 'error');
        } finally {
            setDownloading(false);
        }
    };
    const isImage = url.match(/\.(jpg|jpeg|png|gif|bmp|webp|avif)$/i);
    const isVideo = url.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i);
    const isPdf = url.match(/\.(pdf)$/i);
    const isExcel = url.match(/\.(xlsx|xls)$/i);
    const isDocx = url.match(/\.(docx)$/i);
    const isOfficeEmbed = url.match(/\.(pptx|doc)$/i);

    const modalContent = (
        <div
            className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
            onClick={onClose}
            onContextMenu={(e) => {
                if (isAuditor) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }}
            role="presentation"
        >
            {/* Auditor Watermark Overlay */}
            {isAuditor && (
                <div className="pointer-events-none fixed inset-0 z-[10001] flex items-center justify-center overflow-hidden opacity-15 select-none">
                    <div className="rotate-[-25deg] text-center text-white text-sm sm:text-lg md:text-2xl font-black uppercase tracking-widest leading-loose">
                        CONFIDENTIAL • AUDIT EVALUATION ONLY<br />
                        {currentUser?.firstname || ''} {currentUser?.lastname || 'Auditor'} • {new Date().toLocaleDateString()}
                    </div>
                </div>
            )}

            <div className="fixed top-4 right-4 z-[10002] flex items-center gap-2">
                {!isAuditor && (
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-black/40 px-3 py-1.5 text-sm font-medium text-white hover:bg-black/60 disabled:opacity-50"
                        onClick={handleDownload}
                        disabled={downloading || !url}
                        aria-label="Download file"
                        title="Download"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                        </svg>
                        {downloading ? 'Downloading...' : 'Download'}
                    </button>
                )}
                <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/30 bg-black/40 text-white/80 hover:bg-black/60 hover:text-white"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose?.();
                    }}
                    aria-label="Close preview"
                    title="Close"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                <div className="w-[94vw] max-w-[1600px] h-[94vh] max-h-[94vh]">
                    {isVideo ? (
                        <div 
                            className="w-full h-full flex items-center justify-center bg-black/60 rounded-xl overflow-hidden p-2"
                            onContextMenu={(e) => {
                                if (isAuditor) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }}
                        >
                            <video 
                                controls 
                                autoPlay 
                                src={url} 
                                controlsList={isAuditor ? "nodownload" : undefined}
                                disablePictureInPicture={isAuditor}
                                className="max-h-full max-w-full object-contain rounded-lg shadow-2xl" 
                            />
                        </div>
                    ) : isImage ? (
                        <div 
                            className="relative w-full h-full flex items-center justify-center select-none"
                            onContextMenu={(e) => {
                                if (isAuditor) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                            }}
                        >
                            <img 
                                src={url} 
                                alt="Document Preview" 
                                className={`max-h-full max-w-full object-contain ${isAuditor ? 'pointer-events-none select-none' : ''}`}
                                draggable={!isAuditor}
                                onContextMenu={(e) => {
                                    if (isAuditor) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                }}
                            />
                            {/* Shield overlay for auditors */}
                            {isAuditor && (
                                <div 
                                    className="absolute inset-0 z-20 cursor-default select-none"
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                    onDragStart={(e) => e.preventDefault()}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full overflow-hidden rounded-lg bg-transparent">
                            {isPdf ? (
                                <iframe 
                                    src={isAuditor ? `${url}#toolbar=0&navpanes=0` : url} 
                                    title="Document Preview" 
                                    className="w-full h-full border-0 rounded-lg" 
                                />
                            ) : isExcel ? (
                                <div className="w-full h-full flex flex-col">
                                    {excelHtml ? (
                                        <div
                                            className="w-full h-full overflow-auto"
                                            dangerouslySetInnerHTML={{ __html: excelHtml }}
                                        />
                                    ) : excelHtmlLoading ? (
                                        <div className="flex items-center justify-center h-full">
                                            <div className="text-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent mx-auto mb-3"></div>
                                                <p className="text-xs text-gray-500">Loading preview...</p>
                                            </div>
                                        </div>
                                    ) : excelPreviewError ? (
                                        <div className="flex items-center justify-center h-full">
                                            <div className="text-center">
                                                <div className="w-10 h-10 mx-auto mb-2 bg-rose-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                                        />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">Failed to load preview</p>
                                                <button
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                                                    onClick={() => handleExcelPreview(url)}
                                                >
                                                    Try Again
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <div className="text-center">
                                                <div className="w-10 h-10 mx-auto mb-2 bg-indigo-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                        />
                                                    </svg>
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">Click to preview Excel file</p>
                                                <button
                                                    className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                                                    onClick={() => handleExcelPreview(url)}
                                                >
                                                    Load Preview
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : isDocx ? (
                                <div className="relative w-full h-full overflow-auto bg-transparent p-3">
                                    <div ref={userDocxPreviewRef} className="min-h-full" />
                                    {userDocxPreviewLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500">
                                            Loading DOCX preview...
                                        </div>
                                    )}
                                    {!!userDocxPreviewError && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-rose-600">
                                            {userDocxPreviewError}
                                        </div>
                                    )}
                                </div>
                            ) : isOfficeEmbed ? (
                                <iframe
                                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                                    title="Office Preview"
                                    className="w-full h-full border-0"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-xs text-gray-500">Preview not supported</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
