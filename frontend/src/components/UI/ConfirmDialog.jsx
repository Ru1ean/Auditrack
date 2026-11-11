import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * Confirmation Dialog component.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the dialog is open
 * @param {Function} props.onConfirm - Confirm handler
 * @param {Function} props.onCancel - Cancel handler
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message
 * @param {string} [props.confirmText='Confirm'] - Confirm button text
 * @param {string} [props.cancelText='Cancel'] - Cancel button text
 * @param {'danger' | 'info'} [props.variant='info'] - Dialog variant
 * @param {boolean} [props.loading=false] - Loading state for confirm button
 */
export default function ConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  loading = false,
}) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the confirm button when opened
      setTimeout(() => {
        confirmRef.current?.focus();
      }, 50);
      
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          onCancel();
        } else if (e.key === 'Enter') {
          if (confirmRef.current && document.activeElement !== confirmRef.current) {
            e.preventDefault();
            if (!loading) onConfirm();
          }
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel, onConfirm, loading]);

  if (!isOpen || typeof document === 'undefined') return null;

  const isDanger = variant === 'danger';
  const Icon = isDanger ? AlertTriangle : Info;
  const iconColorClass = isDanger ? 'text-[var(--danger-600,#dc2626)] bg-[var(--danger-500,#ef4444)] bg-opacity-10' : 'text-[var(--info-600,#2563eb)] bg-[var(--info-500,#3b82f6)] bg-opacity-10';
  const confirmBtnClass = isDanger 
    ? 'bg-[var(--danger-600,#dc2626)] hover:bg-[var(--danger-700,#b91c1c)] text-white focus:ring-[var(--danger-500,#ef4444)]' 
    : 'bg-[var(--info-600,#2563eb)] hover:bg-[var(--info-700,#1d4ed8)] text-white focus:ring-[var(--info-500,#3b82f6)]';

  return createPortal(
    <div className="fixed inset-0 z-[20010] flex items-center justify-center bg-black/50 px-4">
      <div 
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <h3 id="dialog-title" className="text-lg font-bold text-slate-900">
          {title || 'Confirm'}
        </h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 focus:outline-none"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50 focus:outline-none flex items-center justify-center min-w-[60px]"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              confirmText === 'Confirm' ? 'OK' : confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
