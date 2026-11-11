import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function RowActionMenu({
    onAssign,
    onEdit,
    onDelete,
    items,
    assignLabel = 'Assign Personnel',
    editLabel = 'Edit',
    deleteLabel = 'Delete',
    disabled = false,
    buttonClassName = ''
}) {
    const buttonRef = useRef(null);
    const menuRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [anchorRect, setAnchorRect] = useState(null);

    const menuItems = Array.isArray(items) && items.length > 0
        ? items
        : [
            typeof onAssign === 'function' ? {
                label: assignLabel,
                onClick: onAssign,
                disabled: disabled,
                tone: 'indigo',
                icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                )
            } : null,
            typeof onEdit === 'function' ? {
                label: editLabel,
                onClick: onEdit,
                disabled: disabled,
                tone: 'indigo',
                icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                )
            } : null,
            typeof onDelete === 'function' ? {
                label: deleteLabel,
                onClick: onDelete,
                disabled: disabled,
                tone: 'red',
                icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                )
            } : null,
        ].filter(Boolean);

    const position = useMemo(() => {
        if (!anchorRect) return null;
        const zoom = (typeof document !== 'undefined' && parseFloat(getComputedStyle(document.body).zoom)) || 1;
        const menuWidth = 192; // w-48
        const menuHeight = Math.max(44, (menuItems.length * 40) + 8);
        const padding = 8;

        const desiredLeft = (anchorRect.right / zoom) - menuWidth;
        const left = Math.min(
            Math.max(padding, desiredLeft),
            Math.max(padding, (window.innerWidth / zoom) - menuWidth - padding)
        );
        const desiredTop = (anchorRect.bottom / zoom) + 4;
        const top = Math.min(
            Math.max(padding, desiredTop),
            Math.max(padding, (window.innerHeight / zoom) - menuHeight - padding)
        );

        return { left, top };
    }, [anchorRect, menuItems.length]);

    const close = () => setOpen(false);

    useEffect(() => {
        if (!open) return;

        const updateAnchor = () => {
            if (!buttonRef.current) return;
            setAnchorRect(buttonRef.current.getBoundingClientRect());
        };

        updateAnchor();

        const onPointerDown = (e) => {
            const target = e.target;
            if (buttonRef.current && buttonRef.current.contains(target)) return;
            if (menuRef.current && menuRef.current.contains(target)) return;
            close();
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') close();
        };

        const onScrollOrResize = () => close();

        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onScrollOrResize);
        window.addEventListener('scroll', onScrollOrResize, true);

        return () => {
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onScrollOrResize);
            window.removeEventListener('scroll', onScrollOrResize, true);
        };
    }, [open]);

    const menu = open && position ? (
        <div
            ref={menuRef}
            role="menu"
            className="office-card-actions-menu fixed z-[200] w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
            style={{ left: position.left, top: position.top }}
            onClick={(e) => e.stopPropagation()}
        >
            {menuItems.map((item) => {
                const tone = item.tone || 'slate';
                const hoverClass = item.hoverClassName || (tone === 'red' || tone === 'rose' ? 'hover:bg-rose-50' : tone === 'emerald' ? 'hover:bg-emerald-50' : tone === 'indigo' || tone === 'blue' ? 'hover:bg-blue-50 hover:text-blue-600' : 'hover:bg-slate-50');
                const textClass = item.textClassName || (tone === 'red' || tone === 'rose' ? 'text-rose-600 font-semibold' : 'text-slate-700 font-semibold');
                const iconClass = item.iconClassName || (tone === 'red' || tone === 'rose' ? 'text-rose-600 shrink-0' : tone === 'emerald' ? 'text-emerald-600 shrink-0' : tone === 'indigo' || tone === 'blue' ? 'text-blue-600 shrink-0' : 'text-slate-500 shrink-0');

                return (
                    <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        disabled={item.disabled}
                        onClick={(e) => {
                            e.stopPropagation();
                            close();
                            item.onClick?.(e);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition ${textClass} ${hoverClass} disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap`}
                    >
                        {item.icon ? (
                            <svg className={`h-4 w-4 ${iconClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                {item.icon}
                            </svg>
                        ) : null}
                        <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                );
            })}
        </div>
    ) : null;

    if (!menuItems || menuItems.length === 0) return null;

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    if (disabled) return;
                    setOpen((prev) => !prev);
                }}
                aria-label="Actions"
                title="Actions"
                className={buttonClassName || 'office-card-actions-button inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-500 transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-2xs'}
            >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                </svg>
            </button>
            {menu ? createPortal(menu, document.body) : null}
        </>
    );
}

