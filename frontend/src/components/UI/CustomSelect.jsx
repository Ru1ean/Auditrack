import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * CustomSelect - Antislop UI Replacement for HTML <select>
 * Renders a custom styled trigger button and a portal-based option menu
 * with concentric rounded corners, subtle shadows, and check indicators.
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  size = 'lg', // 'sm' | 'md' | 'lg'
  className = '',
  buttonClassName = '',
  menuClassName = '',
  usePortal = true,
  id,
  name,
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Normalize options array: string[] or { value, label, icon, dot, disabled }[]
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: String(opt), label: String(opt) };
      }
      return {
        ...opt,
        value: String(opt.value ?? ''),
        label: opt.label ?? String(opt.value ?? ''),
      };
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    if (value === undefined || value === null || value === '') return null;
    return normalizedOptions.find((opt) => String(opt.value) === String(value)) || null;
  }, [normalizedOptions, value]);

  // Update anchor position
  const updateAnchor = useCallback(() => {
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
  }, []);

  useEffect(() => {
    if (open) {
      updateAnchor();
    }
  }, [open, updateAnchor]);

  // Click outside and escape key handling
  useEffect(() => {
    if (!open) return;

    const handleOutsideClick = (e) => {
      if (
        buttonRef.current &&
        !buttonRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateAnchor();
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, updateAnchor]);

  // Calculate portal popup position with browser zoom compatibility
  const position = useMemo(() => {
    if (!anchorRect) return null;
    const zoom = (typeof document !== 'undefined' && parseFloat(getComputedStyle(document.body).zoom)) || 1;
    const padding = 8;
    const menuWidth = Math.max(anchorRect.width, 160);
    const estimatedHeight = Math.min(normalizedOptions.length * 36 + 16, 260);

    const desiredLeft = anchorRect.left / zoom;
    const left = Math.min(
      Math.max(padding, desiredLeft),
      Math.max(padding, window.innerWidth / zoom - menuWidth - padding)
    );

    // If there's not enough room below, open upward
    const spaceBelow = window.innerHeight / zoom - (anchorRect.bottom / zoom);
    const openUpward = spaceBelow < estimatedHeight && (anchorRect.top / zoom) > estimatedHeight;

    const top = openUpward
      ? Math.max(padding, (anchorRect.top / zoom) - estimatedHeight - 4)
      : Math.min(
          Math.max(padding, anchorRect.bottom / zoom + 4),
          window.innerHeight / zoom - estimatedHeight - padding
        );

    return {
      left,
      top,
      width: menuWidth,
    };
  }, [anchorRect, normalizedOptions.length]);

  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs rounded-lg',
    md: 'h-9 px-3 text-xs rounded-xl',
    lg: 'h-10 px-3.5 text-xs sm:text-sm rounded-xl',
  }[size] || 'h-10 px-3.5 text-xs sm:text-sm rounded-xl';

  const handleSelect = (optValue) => {
    onChange?.(optValue);
    setOpen(false);
  };

  const menuContent = (
    <div
      ref={menuRef}
      style={
        usePortal && position
          ? {
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: `${position.width}px`,
              zIndex: 99999,
            }
          : undefined
      }
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`max-h-64 overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-300/40 animate-in fade-in zoom-in-95 duration-100 ${
        !usePortal ? 'absolute left-0 top-full mt-1.5 w-full z-50' : ''
      } ${menuClassName}`}
      role="listbox"
      aria-orientation="vertical"
    >
      {normalizedOptions.map((opt) => {
        const isSelected = String(opt.value) === String(value);
        const isOptionDisabled = opt.disabled;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={isOptionDisabled}
            onClick={() => handleSelect(opt.value)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition cursor-pointer ${
              isSelected
                ? 'bg-blue-50/90 font-bold text-blue-700'
                : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
            } ${isOptionDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
            role="option"
            aria-selected={isSelected}
          >
            <div className="flex items-center gap-2 truncate">
              {opt.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${opt.dot}`} />}
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </div>
            {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={`relative inline-block w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`flex w-full items-center justify-between gap-2 border border-slate-200/90 bg-slate-50/50 text-slate-800 shadow-2xs transition-all hover:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${sizeClasses} ${
          open ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white' : ''
        } ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 truncate text-left">
          {selectedOption?.dot && (
            <span className={`h-2 w-2 shrink-0 rounded-full ${selectedOption.dot}`} />
          )}
          {selectedOption?.icon}
          <span className={`truncate ${!selectedOption ? 'text-slate-400 font-normal' : 'font-medium text-slate-800'}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 pointer-events-none ${
            open ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Hidden input for HTML form requirement validation if needed */}
      {required && (
        <input
          type="text"
          value={value ?? ''}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          className="sr-only"
        />
      )}

      {open &&
        (usePortal && typeof document !== 'undefined'
          ? position && createPortal(menuContent, document.body)
          : menuContent)}
    </div>
  );
}
