import React, { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from './Toast'

const ModalContext = createContext(null)

export function ModalProvider({ children }) {
  const [modal, setModal] = useState({ open: false })
  const { toast } = useToast()

  const showAlert = useCallback((message, titleOrVariant = 'Notice', variantParam = 'info') => {
    let title = 'Notice';
    let variant = 'info';

    const msgLower = String(message || '').toLowerCase();
    const titleLower = String(titleOrVariant || '').toLowerCase();

    const isErr = ['error', 'failed', 'cannot', 'invalid', 'denied', 'limit', 'reached', 'violates'].some(word => 
      msgLower.includes(word) || titleLower.includes(word)
    );

    const isSuccess = ['success', 'successfully', 'created', 'updated', 'deleted', 'assigned', 'saved', 'added', 'copied'].some(word =>
      msgLower.includes(word) || titleLower.includes(word)
    );

    if (isErr || titleOrVariant === 'error' || variantParam === 'error') {
      variant = 'error';
      title = 'Error';
    } else if (isSuccess || titleOrVariant === 'success' || variantParam === 'success') {
      variant = 'success';
      title = 'Success';
    } else if (['error', 'success', 'warning', 'info'].includes(titleOrVariant)) {
      variant = titleOrVariant;
      title = titleOrVariant === 'success' ? 'Success' : titleOrVariant === 'warning' ? 'Warning' : 'Notice';
    } else {
      title = titleOrVariant;
      variant = variantParam;
    }

    toast({ title, description: message, variant, duration: 3500 });
    return Promise.resolve(true);
  }, [toast]);

  const showConfirm = useCallback((message, title = 'Confirm') => {
    return new Promise((resolve) => {
      setModal({
        open: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setModal({ open: false })
          resolve(true)
        },
        onCancel: () => {
          setModal({ open: false })
          resolve(false)
        },
      })
    })
  }, [])

  const value = {
    showAlert,
    showConfirm,
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      {modal.open && <ModalRoot {...modal} />}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('useModal must be used within ModalProvider')
  return ctx
}

function ModalRoot({ type, title, message, onConfirm, onCancel }) {
  if (type === 'alert') return null

  return createPortal(
    <div className="fixed inset-0 z-[20012] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <h3 className="text-lg font-bold text-slate-900">{title || 'Confirm'}</h3>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {type === 'confirm' && (
            <button
              type="button"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 focus:outline-none"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none"
            onClick={onConfirm}
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ModalProvider
