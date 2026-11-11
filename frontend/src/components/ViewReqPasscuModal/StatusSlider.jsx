import React, { useState, useRef, useEffect } from 'react';

const STATUS_OPTIONS = [
    { id: 3, label: 'Not Complied', shortLabel: 'Not', color: 'rose', dotClass: 'bg-rose-500', textClass: 'text-rose-600', fillClass: 'from-rose-500 to-rose-600' },
    { id: 4, label: 'Partially Complied', shortLabel: 'Partial', color: 'amber', dotClass: 'bg-amber-500', textClass: 'text-amber-600', fillClass: 'from-amber-500 to-amber-600' },
    { id: 5, label: 'Complied', shortLabel: 'Complied', color: 'emerald', dotClass: 'bg-emerald-500', textClass: 'text-emerald-600', fillClass: 'from-emerald-500 to-emerald-600' },
];

export default function StatusSlider({
    currentStatusId = 3,
    disabled = false,
    onChange,
    onDisabledClick,
    className = '',
}) {
    const trackRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPercent, setDragPercent] = useState(null);
    const [optimisticStatusId, setOptimisticStatusId] = useState(() => Number(currentStatusId) || 3);

    useEffect(() => {
        setOptimisticStatusId(Number(currentStatusId) || 3);
    }, [currentStatusId]);

    const effectiveStatusId = optimisticStatusId;
    const currentIndex = Math.max(0, STATUS_OPTIONS.findIndex(opt => opt.id === Number(effectiveStatusId)));
    const activeOption = STATUS_OPTIONS[currentIndex] || STATUS_OPTIONS[0];

    // Target fill percent based on current index or active drag
    const selectedPercent = (currentIndex / (STATUS_OPTIONS.length - 1)) * 100;
    const effectivePercent = dragPercent !== null ? dragPercent : selectedPercent;

    // Nearest option index based on effective percent
    const hoveredIndex = Math.min(
        STATUS_OPTIONS.length - 1,
        Math.max(0, Math.round((effectivePercent / 100) * (STATUS_OPTIONS.length - 1)))
    );

    const getPercentFromClientX = (clientX) => {
        if (!trackRef.current) return 0;
        const rect = trackRef.current.getBoundingClientRect();
        const width = rect.width;
        if (width === 0) return 0;
        const offsetX = clientX - rect.left;
        const clampedX = Math.max(0, Math.min(width, offsetX));
        return (clampedX / width) * 100;
    };

    const handlePointerDown = (e) => {
        e.stopPropagation();
        if (disabled) {
            onDisabledClick?.();
            return;
        }

        setIsDragging(true);
        const percent = getPercentFromClientX(e.clientX);
        setDragPercent(percent);

        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (_) {}
    };

    const handlePointerMove = (e) => {
        if (!isDragging || disabled) return;
        e.stopPropagation();
        const percent = getPercentFromClientX(e.clientX);
        setDragPercent(percent);
    };

    const finishDrag = (e) => {
        if (!isDragging) return;
        e?.stopPropagation?.();
        setIsDragging(false);

        if (dragPercent !== null) {
            const nearestIndex = Math.min(
                STATUS_OPTIONS.length - 1,
                Math.max(0, Math.round((dragPercent / 100) * (STATUS_OPTIONS.length - 1)))
            );
            const targetOption = STATUS_OPTIONS[nearestIndex];
            if (targetOption && targetOption.id !== Number(effectiveStatusId)) {
                setOptimisticStatusId(targetOption.id);
                onChange?.(targetOption.id);
            }
        }
        setDragPercent(null);

        try {
            if (e?.pointerId && e?.target?.hasPointerCapture?.(e.pointerId)) {
                e.target.releasePointerCapture(e.pointerId);
            }
        } catch (_) {}
    };

    const handleOptionClick = (e, index) => {
        e.stopPropagation();
        if (disabled) {
            onDisabledClick?.();
            return;
        }
        const targetOption = STATUS_OPTIONS[index];
        if (targetOption && targetOption.id !== Number(effectiveStatusId)) {
            setOptimisticStatusId(targetOption.id);
            onChange?.(targetOption.id);
        }
    };

    return (
        <div
            className={`w-48 select-none flex flex-col justify-between rounded-xl border border-slate-300/50 bg-slate-200/50 p-2.5 shadow-xs transition-opacity ${
                disabled ? 'opacity-60 cursor-not-allowed' : ''
            } ${className}`}
            title={disabled ? 'Upload standard proof document before selecting compliance status' : ''}
            onClick={(e) => {
                e.stopPropagation();
                if (disabled) onDisabledClick?.();
            }}
        >
            {/* Header: Label + Step counter */}
            <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold ${activeOption.textClass}`}>
                    <span className={`h-2 w-2 shrink-0 rounded-full shadow-xs ${activeOption.dotClass}`} />
                    <span className="truncate">{activeOption.label}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded-md">
                    {currentIndex + 1}/3
                </span>
            </div>

            {/* Slider track container */}
            <div
                ref={trackRef}
                className="relative h-6 flex items-center cursor-pointer touch-none my-auto"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Background bar */}
                <div className="h-2.5 w-full rounded-full bg-slate-300/90 shadow-inner relative overflow-hidden">
                    {/* Filled bar */}
                    <div
                        className={`h-full rounded-full bg-gradient-to-r ${activeOption.fillClass} ${
                            isDragging ? '' : 'transition-all duration-200 ease-out'
                        }`}
                        style={{ width: `${effectivePercent}%` }}
                    />
                </div>

                {/* Stopper Tick Marks / Notch Sockets */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-1">
                    {STATUS_OPTIONS.map((option, idx) => {
                        const tickPercent = (idx / (STATUS_OPTIONS.length - 1)) * 100;
                        const isPassed = effectivePercent >= tickPercent - 5;
                        const isCurrent = hoveredIndex === idx;

                        return (
                            <div
                                key={option.id}
                                style={{ left: `${tickPercent}%` }}
                                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-auto"
                                onClick={(e) => handleOptionClick(e, idx)}
                            >
                                <span
                                    className={`rounded-full transition-all duration-150 ${
                                        isCurrent
                                            ? 'h-3.5 w-3.5 ring-2 ring-indigo-500/40 border-2 border-white shadow-sm ' + option.dotClass
                                            : isPassed
                                                ? 'h-2.5 w-2.5 border border-white/80 ' + option.dotClass
                                                : 'h-2.5 w-2.5 bg-slate-400/80 border border-slate-200'
                                    }`}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Pin / Thumb Handle */}
                <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none ${
                        isDragging ? '' : 'transition-all duration-200 ease-out'
                    }`}
                    style={{ left: `${effectivePercent}%` }}
                >
                    {/* Glowing circular pin with pointer notch */}
                    <div
                        className={`h-5 w-5 rounded-full border-2 border-white shadow-md flex items-center justify-center ${
                            activeOption.dotClass
                        } ${isDragging ? 'scale-125 shadow-lg ring-4 ring-indigo-400/30' : 'hover:scale-110'}`}
                    >
                        {/* Pin Center Dot */}
                        <div className="h-1.5 w-1.5 rounded-full bg-white shadow-xs" />
                    </div>
                    {/* Small pin tip pointing down at the track stopper */}
                    <div
                        className={`-mt-0.5 w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] ${
                            activeOption.color === 'rose' ? 'border-t-rose-500' :
                            activeOption.color === 'amber' ? 'border-t-amber-500' : 'border-t-emerald-500'
                        }`}
                    />
                </div>
            </div>

            {/* Labels below track */}
            <div className="grid grid-cols-3 gap-1 text-center text-[9.5px] font-semibold">
                {STATUS_OPTIONS.map((option, idx) => {
                    const isSelected = currentIndex === idx;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            disabled={disabled}
                            onClick={(e) => handleOptionClick(e, idx)}
                            className={`truncate py-0.5 transition-colors rounded hover:bg-slate-300/30 ${
                                isSelected ? `${option.textClass} font-bold` : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            {option.shortLabel}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
