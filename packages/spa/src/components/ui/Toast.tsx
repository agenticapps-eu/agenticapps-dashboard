import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ToastVariant = 'success' | 'error'

export interface ToastInput {
  message: string
  variant?: ToastVariant
  duration?: number
}

export interface ToastContextValue {
  show(input: ToastInput): void
}

interface ActiveToast extends ToastInput {
  id: number
  phase: 'enter' | 'exit'
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION = 2400
const FADE_OUT_MS = 200

export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<ActiveToast | null>(null)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idRef = useRef(0)

  const clearTimers = () => {
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    dismissTimerRef.current = null
    exitTimerRef.current = null
  }

  const show = useCallback((input: ToastInput) => {
    clearTimers()
    const id = ++idRef.current
    const duration = Math.max(0, input.duration ?? DEFAULT_DURATION)
    setToast({ ...input, variant: input.variant ?? 'success', id, phase: 'enter' })
    if (duration > 0) {
      dismissTimerRef.current = setTimeout(() => {
        setToast((prev) => (prev && prev.id === id ? { ...prev, phase: 'exit' } : prev))
        exitTimerRef.current = setTimeout(() => {
          setToast((prev) => (prev && prev.id === id ? null : prev))
        }, FADE_OUT_MS)
      }, duration)
    }
  }, [])

  useEffect(() => () => clearTimers(), [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && createPortal(<ToastView key={toast.id} toast={toast} />, document.body)}
    </ToastContext.Provider>
  )
}

function ToastView({ toast }: { toast: ActiveToast }): React.JSX.Element {
  const variant = toast.variant ?? 'success'
  const isError = variant === 'error'
  const glyph = isError ? '✕' : '✓'
  const role = isError ? 'alert' : 'status'
  const opacityClass = toast.phase === 'enter' ? 'opacity-100' : 'opacity-0'
  const tintBg = isError ? 'bg-status-error/10' : 'bg-status-success/10'
  const tintText = isError ? 'text-status-error' : 'text-status-success'

  return (
    <div
      role={role}
      className={`fixed top-16 right-4 z-[var(--z-toast)] min-w-72 max-w-96 px-4 py-2 rounded-md shadow-card border border-current/30 ${tintBg} ${tintText} flex items-center gap-2 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out ${opacityClass}`}
    >
      <span aria-hidden="true" className="font-semibold">{glyph}</span>
      <span className="text-sm">{toast.message}</span>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside a <ToastProvider>')
  }
  return ctx
}
