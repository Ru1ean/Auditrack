import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Interactive Compliance Status Slider with Stopper Ticks
 * Status values: 3 = Not Complied, 4 = Partially Complied, 5 = Complied
 */
export default function StatusSlider({
  statusid = 3,
  onChange,
  disabled = false,
  updating = false,
  className = ''
}) {
  const currentStatus = Number(statusid) || 3;
  const [internalStatus, setInternalStatus] = useState(currentStatus);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef(null);

  useEffect(() => {
    setInternalStatus(currentStatus);
  }, [currentStatus]);

  // Convert status ID (3,4,5) to percentage (0%, 50%, 100%)
  const getPercentage = (val) => {
    if (val === 5) return 100;
    if (val === 4) return 50;
    return 0;
  };

  const getRatio = (val) => {
    if (val === 5) return '3/3';
    if (val === 4) return '2/3';
    return '1/3';
  };

  const getLabel = (val) => {
    if (val === 5) return 'Complied';
    if (val === 4) return 'Partial';
    return 'Not';
  };

  const getFullLabel = (val) => {
    if (val === 5) return 'Complied';
    if (val === 4) return 'Partially Complied';
    return 'Not Complied';
  };

  const getTrackColor = (val) => {
    if (val === 5) return 'bg-emerald-500';
    if (val === 4) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  const getBadgeStyle = (val) => {
    if (val === 5) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (val === 4) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  const handleStepChange = (newVal) => {
    if (disabled || updating || newVal === currentStatus) return;
    setInternalStatus(newVal);
    if (onChange) onChange(newVal);
  };

  const handlePointerDown = (e) => {
    if (disabled || updating || !trackRef.current) return;
    setIsDragging(true);
    updateFromPointer(e);

    const handlePointerMove = (moveEv) => updateFromPointer(moveEv);
    const handlePointerUp = (upEv) => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const updateFromPointer = (e) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;

    let targetVal = 3;
    if (ratio >= 0.75) targetVal = 5;
    else if (ratio >= 0.25) targetVal = 4;

    if (targetVal !== internalStatus) {
      setInternalStatus(targetVal);
      if (onChange) onChange(targetVal);
    }
  };

  const percentage = getPercentage(internalStatus);
  const trackColor = getTrackColor(internalStatus);

  return (
    <div className={`w-full max-w-[200px] select-none ${className}`}>
      {/* Top Header Badge */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${
            internalStatus === 5 ? 'bg-emerald-500' : internalStatus === 4 ? 'bg-amber-400' : 'bg-rose-500'
          }`} />
          <span className="text-xs font-semibold text-slate-700">
            {getFullLabel(internalStatus)}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 font-mono">
          {getRatio(internalStatus)}
        </span>
      </div>

      {/* Track & Slider Container */}
      <div 
        ref={trackRef}
        onPointerDown={handlePointerDown}
        className={`relative h-6 flex items-center cursor-pointer touch-none ${
          disabled || updating ? 'opacity-60 cursor-not-allowed' : ''
        }`}
      >
        {/* Background Track */}
        <div className="absolute inset-x-0 h-2 rounded-full bg-slate-100 border border-slate-200/80 overflow-hidden">
          <div 
            className={`h-full transition-all duration-200 ${trackColor}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Stopper Ticks (Not = 0%, Partial = 50%, Complied = 100%) */}
        <div className="absolute inset-x-0 flex justify-between items-center px-1 pointer-events-none">
          {/* Tick 1: Not Complied */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleStepChange(3); }}
            className={`pointer-events-auto h-3 w-3 rounded-full border-2 transition-all duration-150 ${
              internalStatus === 3
                ? 'bg-white border-rose-500 ring-2 ring-rose-400/30 scale-110'
                : 'bg-slate-200 border-white hover:bg-rose-200'
            }`}
            title="Not Complied"
          />

          {/* Tick 2: Partially Complied */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleStepChange(4); }}
            className={`pointer-events-auto h-3 w-3 rounded-full border-2 transition-all duration-150 ${
              internalStatus === 4
                ? 'bg-white border-amber-400 ring-2 ring-amber-400/30 scale-110'
                : 'bg-slate-200 border-white hover:bg-amber-200'
            }`}
            title="Partially Complied"
          />

          {/* Tick 3: Complied */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleStepChange(5); }}
            className={`pointer-events-auto h-3 w-3 rounded-full border-2 transition-all duration-150 ${
              internalStatus === 5
                ? 'bg-white border-emerald-500 ring-2 ring-emerald-400/30 scale-110'
                : 'bg-slate-200 border-white hover:bg-emerald-200'
            }`}
            title="Complied"
          />
        </div>

        {/* Interactive Thumb */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -ml-2.5 h-5 w-5 rounded-full bg-white shadow-md border-2 transition-all duration-150 flex items-center justify-center ${
            internalStatus === 5
              ? 'border-emerald-500 text-emerald-600'
              : internalStatus === 4
              ? 'border-amber-400 text-amber-500'
              : 'border-rose-500 text-rose-600'
          } ${isDragging ? 'scale-110 shadow-lg' : 'hover:scale-105'}`}
          style={{ left: `${percentage}%` }}
        >
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
          ) : (
            <div className={`h-1.5 w-1.5 rounded-full ${
              internalStatus === 5 ? 'bg-emerald-500' : internalStatus === 4 ? 'bg-amber-400' : 'bg-rose-500'
            }`} />
          )}
        </div>
      </div>

      {/* Stopper Tick Labels */}
      <div className="flex justify-between text-[10px] font-medium text-slate-400 mt-1 px-0.5">
        <span 
          onClick={() => handleStepChange(3)} 
          className={`cursor-pointer hover:text-rose-600 transition-colors ${internalStatus === 3 ? 'text-rose-600 font-semibold' : ''}`}
        >
          Not
        </span>
        <span 
          onClick={() => handleStepChange(4)} 
          className={`cursor-pointer hover:text-amber-600 transition-colors ${internalStatus === 4 ? 'text-amber-600 font-semibold' : ''}`}
        >
          Partial
        </span>
        <span 
          onClick={() => handleStepChange(5)} 
          className={`cursor-pointer hover:text-emerald-600 transition-colors ${internalStatus === 5 ? 'text-emerald-600 font-semibold' : ''}`}
        >
          Complied
        </span>
      </div>
    </div>
  );
}
