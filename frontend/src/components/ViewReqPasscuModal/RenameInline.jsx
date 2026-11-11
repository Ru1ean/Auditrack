import React, { useState, useEffect } from 'react';

const stripExtension = (name) => {
    if (!name) return '';
    const str = String(name);
    const lastDot = str.lastIndexOf('.');
    if (lastDot > 0 && lastDot > str.lastIndexOf('/')) {
        return str.substring(0, lastDot);
    }
    return str;
};

export default function RenameInline({ item, onRename, forceEditing = false, onCancel, onStart }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(() => stripExtension(item.displayname || item.filename || ''));

    useEffect(() => {
        setValue(stripExtension(item.displayname || item.filename || ''));
    }, [item.displayname, item.filename]);

    useEffect(() => {
        if (forceEditing) setEditing(true);
    }, [forceEditing]);

    useEffect(() => {
        if (editing && typeof onStart === 'function') onStart(item);
    }, [editing, onStart, item]);

    const isEditing = forceEditing || editing;

    const doCancel = () => {
        setValue(stripExtension(item.displayname || item.filename || ''));
        setEditing(false);
        if (typeof onCancel === 'function') onCancel();
    };

    const handleSave = () => {
        const cleaned = stripExtension(value.trim());
        if (cleaned) {
            onRename?.(cleaned);
        }
        setEditing(false);
        if (typeof onCancel === 'function') onCancel();
    };

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {isEditing ? (
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSave();
                            }
                            if (e.key === 'Escape') {
                                doCancel();
                            }
                        }}
                        className="rounded-full border px-2 py-1 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-300 max-w-[140px] w-full"
                        style={{ minWidth: 0 }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                        className="rounded-md bg-blue-600 text-white px-2.5 py-1 text-xs cursor-pointer hover:bg-blue-700 transition"
                    >Save</button>
                    {/* Cancel via Escape key or clicking outside; explicit cancel button removed per request */}
                </div>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditing(true); if (typeof onStart === 'function') onStart(item); }}
                        className="p-1 rounded-md hover:bg-rose-50 text-rose-600 border border-transparent"
                        title="Rename"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                    </button>
                </>
            )}
        </div>
    );
}
