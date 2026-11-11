import React, { useState, useRef, useEffect } from 'react';

/**
 * Modern Custom Dropdown Component styled with outer container padding (p-1.5)
 * and rounded option items (rounded-lg), matching the 3-dot menu & view PACUCOA modal style.
 */
export default function CustomDropdown({
    value,
    onChange,
    options = [],
    placeholder = 'Select option',
    className = '',
    buttonClassName = '',
    menuClassName = '',
    align = 'right',
    minWidth = 'min-w-[140px]',
    size = 'md',
    disabled = false
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0];
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    const sizeClasses = size === 'sm' 
        ? 'h-8 px-3 text-[11px]' 
        : 'h-9 px-3.5 text-xs';

    return (
        <div className={`relative inline-block ${className}`} ref={ref}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen((prev) => !prev)}
                className={`relative flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 shadow-2xs transition hover:border-slate-300 hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50 ${sizeClasses} ${minWidth} ${buttonClassName}`}
            >
                <div className="flex items-center gap-2 truncate text-left">
                    {selectedOption?.dot && (
                        <span className={`h-2 w-2 shrink-0 rounded-full ${selectedOption.dot}`} />
                    )}
                    {selectedOption?.icon}
                    <span className="truncate">{displayLabel}</span>
                </div>
                <svg
                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    className={`absolute ${align === 'left' ? 'left-0' : 'right-0'} top-full z-50 mt-1.5 max-h-60 min-w-full overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-xl shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
                >
                    {options.map((option) => {
                        const isSelected = String(option.value) === String(value);
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                                    isSelected
                                        ? 'bg-indigo-50/80 font-semibold text-indigo-700'
                                        : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {option.dot && (
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${option.dot}`} />
                                )}
                                {option.icon}
                                <span className="truncate">{option.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
