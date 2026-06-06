import { CheckCircle2, X } from 'lucide-react'
import { useEffect } from 'react'

export default function NoticePopup({ message = '', onClose = null, duration = 2200 }) {
  useEffect(() => {
    if (!message || !onClose || !duration) return undefined

    const timer = window.setTimeout(onClose, duration)
    return () => window.clearTimeout(timer)
  }, [duration, message, onClose])

  if (!message) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-emerald-100 bg-white px-4 py-4 text-left shadow-2xl shadow-slate-900/18">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 pt-1 text-[14px] font-semibold leading-5 text-slate-900">{message}</p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng thông báo"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
