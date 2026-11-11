import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";

export default function EventOptionsPopup({ onOpenStructure, onEdit, onCopy, onDelete, onAssignPersonnel, onClose, anchorRef }) {
    const [anchorRect, setAnchorRect] = useState(null);
    const menuRef = useRef(null);

    useEffect(() => {
        if (anchorRef?.current) {
            setAnchorRect(anchorRef.current.getBoundingClientRect());
        }
    }, [anchorRef]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (anchorRef?.current?.contains(event.target)) return;
            if (menuRef?.current?.contains(event.target)) return;
            onClose();
        }
        function handleScroll() {
            onClose();
        }
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("touchstart", handleClickOutside);
        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleScroll);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("touchstart", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
            window.removeEventListener("resize", handleScroll);
        };
    }, [onClose, anchorRef]);

    const position = useMemo(() => {
        if (!anchorRect) return null;
        const zoom = (typeof document !== 'undefined' && parseFloat(getComputedStyle(document.body).zoom)) || 1;
        const menuWidth = 192; // w-48
        const viewportRight = (window.innerWidth / zoom) - 8;
        const desiredLeft = (anchorRect.right / zoom) - menuWidth;
        const left = Math.min(desiredLeft, viewportRight - menuWidth);
        const top = (anchorRect.bottom / zoom) + 4;
        return { left: Math.max(8, left), top };
    }, [anchorRect]);

    if (!position) return null;

    return createPortal(
        <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
            className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
            {onOpenStructure && (
                <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 transition whitespace-nowrap cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onOpenStructure?.();
                    }}
                >
                    <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span>View Structure</span>
                </button>
            )}
            {onAssignPersonnel && (
                <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition whitespace-nowrap cursor-pointer"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onAssignPersonnel?.();
                    }}
                >
                    <svg className="h-4 w-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    <span>Assign Personnel</span>
                </button>
            )}
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition whitespace-nowrap cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onEdit?.();
                }}
            >
                <svg className="h-4 w-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Event</span>
            </button>
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition whitespace-nowrap cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onCopy?.();
                }}
            >
                <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h12v12H4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8h12v12H8z" />
                </svg>
                <span>Copy Event</span>
            </button>
            <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition whitespace-nowrap cursor-pointer"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onDelete?.();
                }}
            >
                <svg className="h-4 w-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                </svg>
                <span>Delete Event</span>
            </button>
        </div>,
        document.body
    );
}
