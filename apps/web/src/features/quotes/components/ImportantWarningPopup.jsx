import { AlertTriangle, X } from 'lucide-react'

export default function ImportantWarningPopup({
  title = 'Cảnh báo quan trọng',
  description = '',
  items = [],
  confirmLabel = 'Tôi đã hiểu',
  onClose = null,
}) {
  if (!description && !items.length) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
        <header className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-red-800">{title}</h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cảnh báo"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-500 hover:bg-red-100 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </header>

        <div className="px-5 py-4">
          {description ? <p className="text-[14px] leading-6 text-slate-700">{description}</p> : null}
          {items.length ? (
            <ul className="mt-3 space-y-2">
              {items.map(item => (
                <li key={item} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[13px] font-semibold leading-5 text-red-800">
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {onClose ? (
          <footer className="flex justify-center border-t border-slate-100 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700"
            >
              {confirmLabel}
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  )
}
