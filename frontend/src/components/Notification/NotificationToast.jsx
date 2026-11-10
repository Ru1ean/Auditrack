import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, XCircle, Info } from 'lucide-react'

export default function NotificationToast({ title = 'Notice', message = '', visible = false, duration = 1800, onDismiss }) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    if (!visible) {
      setIsMounted(false)
      return
    }

    const enterDelay = 10
    const exitDelay = enterDelay + duration
    const exitTransition = 220

    const enterTimer = window.setTimeout(() => setIsMounted(true), enterDelay)
    const exitTimer = window.setTimeout(() => setIsMounted(false), exitDelay)
    const removeTimer = window.setTimeout(() => {
      onDismiss?.()
    }, exitDelay + exitTransition)

    return () => {
      window.clearTimeout(enterTimer)
      window.clearTimeout(exitTimer)
      window.clearTimeout(removeTimer)
    }
  }, [visible, duration, onDismiss])

  if (!visible && !isMounted) return null

  const msgLower = String(message || '').toLowerCase()
  const isError = ['fail', 'error', 'limit', 'invalid', 'cannot'].some(w => msgLower.includes(w))
  const isSuccess = !isError && ['added', 'updated', 'deleted', 'success', 'saved'].some(w => msgLower.includes(w))

  const containerStyle = isError
    ? 'border-rose-200 bg-rose-50 text-rose-900 shadow-rose-100/80'
    : isSuccess
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 shadow-emerald-100/80'
    : 'border-blue-200 bg-blue-50 text-blue-900 shadow-blue-100/80'

  const titleStyle = isError ? 'text-rose-950 font-bold' : isSuccess ? 'text-emerald-950 font-bold' : 'text-blue-950 font-bold'
  const textStyle = isError ? 'text-rose-800 font-medium' : isSuccess ? 'text-emerald-800 font-medium' : 'text-blue-800 font-medium'
  const IconComp = isError ? XCircle : isSuccess ? CheckCircle : Info
  const iconColor = isError ? 'text-rose-600' : isSuccess ? 'text-emerald-600' : 'text-blue-600'
  const resolvedTitle = title === 'Notice' ? (isError ? 'Error' : isSuccess ? 'Success' : 'Notice') : title

  return createPortal(
    <div className={`fixed top-20 right-4 z-[20011] inline-flex items-center gap-2.5 max-w-full rounded-full border px-4 py-2.5 text-sm shadow-md transition-all duration-300 ease-out ${containerStyle} ${isMounted ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
      <IconComp className={`w-4 h-4 shrink-0 ${iconColor}`} />
      <span className={`font-semibold whitespace-nowrap ${titleStyle}`}>{resolvedTitle}:</span>
      <span className={textStyle}>{message}</span>
    </div>,
    document.body
  )
}
