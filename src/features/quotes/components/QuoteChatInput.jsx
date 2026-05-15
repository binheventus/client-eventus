export default function QuoteChatInput({
  value,
  onChange,
  onAnalyze,
  loading = false,
  disabled = false,
}) {
  return (
    <div className="space-y-3">
      <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Sales brief
      </label>
      <textarea
        value={value}
        disabled={disabled || loading}
        onChange={event => onChange?.(event.target.value)}
        rows={6}
        placeholder="VD: 2 chụp, 1 quay, 2 flycam, 5 tiếng, Hải Phòng, khách lạ..."
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[14px] leading-6 text-slate-800 shadow-sm outline-none transition focus:border-[#f8981d] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <button
        type="button"
        disabled={disabled || loading || !String(value || '').trim()}
        onClick={onAnalyze}
        className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Đang phân tích...' : 'Phân tích'}
      </button>
    </div>
  )
}
