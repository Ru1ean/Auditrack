import React from 'react';

export default function officeAddDelete({ onSelect, onClose }) {
    return (
        <div className="absolute right-0 mt-2 w-40 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-50">
            <button
                onClick={() => { onSelect?.('add'); onClose?.(); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100"
            >
                Add Personnel
            </button>
            <button
                onClick={() => { onSelect?.('delete'); onClose?.(); }}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 text-red-600"
            >
                Delete Personnel
            </button>
        </div>
    );
}
