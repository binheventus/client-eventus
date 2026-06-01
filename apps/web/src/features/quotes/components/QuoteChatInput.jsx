import { useEffect, useRef } from 'react'

export default function QuoteChatInput({
  value,
  onChange,
  onAnalyze,
  loading = false,
  disabled = false,
}) {
  const textareaRef = useRef(null)
  const hasBrief = Boolean(String(value || '').trim())

  function resizeTextarea() {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }

  useEffect(() => {
    resizeTextarea()
  }, [value])

  return (
    <div className="space-y-3">
      <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Brief
      </label>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled || loading}
        onChange={event => {
          onChange?.(event.target.value)
          requestAnimationFrame(resizeTextarea)
        }}
        rows={2}
        placeholder="VD: 2 chụp, 1 quay, 2 flycam, 5 tiếng, Hải Phòng, khách lạ..."
        className="w-full resize-none overflow-hidden rounded-2xl border border-[#f8981d] bg-white px-4 py-3 text-[14px] leading-6 text-slate-800 shadow-sm outline-none transition focus:border-[#f8981d] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <button
        type="button"
        disabled={disabled || loading || !hasBrief}
        onClick={onAnalyze}
        className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed ${
          hasBrief && !disabled
            ? 'bg-[#f8981d] hover:bg-orange-500 disabled:bg-orange-300'
            : 'bg-slate-400'
        }`}
      >
        {loading ? 'Đang phân tích...' : 'Phân tích'}
      </button>
    </div>
  )
}
