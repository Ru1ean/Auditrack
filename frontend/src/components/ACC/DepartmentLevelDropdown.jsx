import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const DEFAULT_LEVELS = ['None', 'Candidate', 'Level I', 'Level II', 'Level III', 'Level IV'];

export default function DepartmentLevelDropdown({
  value = 'Level I',
  onChange,
  disabled = false,
  levels = DEFAULT_LEVELS,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Update anchor rectangle when opening
  useEffect(() => {
    if (open && buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
  }, [open]);

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
      setOpen(false);
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
  }, [open]);

  // Calculate portal popup position with browser zoom compatibility
  const position = useMemo(() => {
    if (!anchorRect) return null;
    const zoom = (typeof document !== 'undefined' && parseFloat(getComputedStyle(document.body).zoom)) || 1;
    const menuWidth = 160;
    const menuHeight = levels.length * 36 + 16;
    const padding = 8;

    const desiredLeft = anchorRect.right / zoom - menuWidth;
    const left = Math.min(
      Math.max(padding, desiredLeft),
      Math.max(padding, window.innerWidth / zoom - menuWidth - padding)
    );

    const desiredTop = anchorRect.bottom / zoom + 4;
    const top = Math.min(
      Math.max(padding, desiredTop),
      Math.max(padding, window.innerHeight / zoom - menuHeight - padding)
    );

    return { left, top };
  }, [anchorRect, levels.length]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className={`h-7 pl-2.5 pr-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 hover:border-emerald-300 rounded-lg inline-flex items-center gap-1.5 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Change Accreditation Level"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{value || 'Level I'}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-emerald-600 transition-transform duration-150 pointer-events-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        position &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 99999,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-40 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-xl shadow-slate-300/40 animate-in fade-in zoom-in-95 duration-100"
            role="listbox"
          >
            {levels.map((lvl) => {
              const isSelected = String(lvl) === String(value);
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    onChange?.(lvl);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/90 font-bold text-emerald-700'
                      : 'font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="truncate">{lvl}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
