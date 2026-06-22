import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'

const BRIEF_GUIDE_ITEMS = [
  'Ghi số lượng trước dịch vụ: 2 chụp, 1 quay, 1 flycam.',
  'Với quay, ghi rõ quay recap, quay full, quay live, hoặc không dựng.',
  'Thời lượng nên ghi là 4 tiếng, 5 tiếng, 8 tiếng; tránh ghi 8h-12h nếu parser chưa xử lý khung giờ, vì hiện dễ bị hiểu nhầm thành 8 tiếng.',
  'Địa điểm nên dùng tên rõ theo bảng phí: Hà Nội, Hải Phòng, Bắc Ninh, Hưng Yên...',
  'Tier nên ghi rõ: khách lạ, khách quen, Vingroup, JMB.',
  'Nếu không muốn hệ thống tự thêm dựng recap, ghi rõ không dựng hoặc raw/file thô.',
  'Nếu có nhiều ngày, tách bằng dòng Ngày 1:, Ngày 2: để hệ thống gom hạng mục theo từng ngày.',
  'Nếu là nhiều ngày, mỗi ngày nên ghi đủ hạng mục và thời lượng riêng.',
  'Nếu có nhiều dịch vụ trong cùng một combo, viết cùng một dòng; nếu muốn tách nhóm, ghi rõ Nhóm 1:, Nhóm 2: hoặc từng ngày.',
  'Không dùng dấu gạch ngang cho khung giờ thay thời lượng; nên ghi 4 tiếng thay vì 8h-12h.',
  'Tránh cụm mơ hồ như team media, gói cơ bản, quay/chụp đầy đủ, như lần trước.',
]

const BRIEF_GUIDE_EXAMPLES = [
  { label: 'Sự kiện nửa ngày', text: '2 chụp, 1 quay recap, 1 flycam, 5 tiếng, Hải Phòng, khách lạ.' },
  { label: 'Không dựng', text: '2 quay không dựng, 4 tiếng, Hà Nội, khách quen.' },
  { label: 'Nhiều ngày', text: 'Ngày 1: 2 quay 3 tiếng Hà Nội. Ngày 2: 1 chụp 5 tiếng Hà Nội.' },
]

export default function QuoteChatInput({
  value,
  onChange,
  onAnalyze,
  onAnalyzeWithAi,
  loading = false,
  aiLoading = false,
  aiAvailable = false,
  aiModel = '',
  disabled = false,
}) {
  const textareaRef = useRef(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const hasBrief = Boolean(String(value || '').trim())
  const anyLoading = loading || aiLoading
  const aiTitle = aiAvailable
    ? (aiModel ? `Phân tích bằng Claude (${aiModel})` : 'Phân tích bằng Claude')
    : 'Chưa cấu hình API key Claude'

  function resizeTextarea() {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }

  useEffect(() => {
    resizeTextarea()
  }, [value])

  useEffect(() => {
    if (!guideOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setGuideOpen(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [guideOpen])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Brief
        </label>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          Hướng dẫn
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        disabled={disabled || anyLoading}
        onChange={event => {
          onChange?.(event.target.value)
          requestAnimationFrame(resizeTextarea)
        }}
        rows={2}
        placeholder="VD: 2 chụp, 1 quay, 2 flycam, 5 tiếng, Hải Phòng, khách lạ..."
        className="w-full resize-none overflow-hidden rounded-2xl border border-[#f8981d] bg-white px-4 py-3 text-[14px] leading-6 text-slate-800 shadow-sm outline-none transition focus:border-[#f8981d] focus:ring-4 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={disabled || anyLoading || !hasBrief}
          onClick={onAnalyze}
          className={`inline-flex items-center justify-center rounded-xl px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed ${
            hasBrief && !disabled
              ? 'bg-[#f8981d] hover:bg-orange-500 disabled:bg-orange-300'
              : 'bg-slate-400'
          }`}
        >
          {loading ? 'Đang phân tích...' : 'Phân tích nhanh'}
        </button>
        <button
          type="button"
          disabled={disabled || anyLoading || !hasBrief || !aiAvailable}
          onClick={onAnalyzeWithAi}
          title={aiTitle}
          className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition disabled:cursor-not-allowed ${
            hasBrief && !disabled && aiAvailable
              ? 'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-300'
              : 'bg-slate-400'
          }`}
        >
          {aiLoading ? (
            <>
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              <span>Đang phân tích bằng AI...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Phân tích bằng AI</span>
            </>
          )}
        </button>
      </div>

      {guideOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-[15px] font-semibold text-slate-900">Các nguyên tắc nhập Brief</h3>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[12px] font-semibold text-slate-500 transition hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-[13px] leading-5 text-slate-700">
              {BRIEF_GUIDE_ITEMS.map(item => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-700">Ví dụ</div>
              <div className="mt-2 space-y-2 text-[13px] font-semibold leading-5 text-slate-950">
                {BRIEF_GUIDE_EXAMPLES.map(example => (
                  <div key={example.label} className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#f8981d]">
                      {example.label}
                    </span>
                    <span>{example.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
