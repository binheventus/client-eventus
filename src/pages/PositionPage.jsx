import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬' },
  editor:       { icon: '🎞️' },
  photographer: { icon: '📷' },
  account:      { icon: '🤝' },
  leader:       { icon: '🧭' },
}

const DIMENSIONS = [
  { id: 'chuyen_mon',          icon: '⚙️', label: 'Năng lực chuyên môn' },
  { id: 'nghien_cuu_sang_tao', icon: '💡', label: 'Nghiên cứu & sáng tạo' },
  { id: 'trach_nhiem',         icon: '✅', label: 'Trách nhiệm' },
  { id: 'xu_ly_tinh_huong',    icon: '⚡', label: 'Xử lý tình huống' },
  { id: 'lam_viec_khach_hang', icon: '🤝', label: 'Làm việc với khách hàng' },
]

const DIM_COLORS = {
  chuyen_mon:          { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: '#60a5fa' },
  nghien_cuu_sang_tao: { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  dot: '#a78bfa' },
  trach_nhiem:         { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: '#34d399' },
  xu_ly_tinh_huong:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: '#fbbf24' },
  lam_viec_khach_hang: { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: '#fb7185' },
}

const LEVEL_TAGS = [
  { label: 'Học & quan sát',        bg: '#f1f5f9', text: '#64748b' },
  { label: 'Độc lập cơ bản',        bg: '#eff6ff', text: '#1d4ed8' },
  { label: 'Chủ động sáng tạo',     bg: '#f0fdf4', text: '#15803d' },
  { label: 'Gánh team kỹ thuật',    bg: '#fff7ed', text: '#c2410c' },
  { label: 'Định hướng chiến lược', bg: '#faf5ff', text: '#7e22ce' },
]

function parseItems(text) {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.replace(/^[\s\-•+]+/, '').trim())
    .filter(l => l.length > 2)
}

export default function PositionPage() {
  const { positionId } = useParams()
  const framework = data.competency_framework
  const position = framework.positions.find(p => p.id === positionId)

  if (!position) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Không tìm thấy vị trí này.</p>
        <Link to="/" className="text-blue-700 font-medium text-sm hover:underline">← Về trang chủ</Link>
      </div>
    )
  }

  const meta = POSITION_META[position.id] || { icon: '📌' }
  const levels = position.levels

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header back title={position.name} />

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Header block */}
        <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg p-8 text-white mb-6">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-4xl">{meta.icon}</span>
            <div>
              <h1 className="text-[22px] md:text-[26px] font-medium tracking-tight">{position.name}</h1>
              {position.mission && (
                <p className="text-sm text-blue-100 mt-1 max-w-xl italic">"{position.mission}"</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-0">
            {levels.map((lv, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white" style={{ opacity: 0.3 + i * 0.15 }} />
                  <span className="text-xs text-blue-200 hidden sm:block whitespace-nowrap">{lv.label}</span>
                </div>
                {i < levels.length - 1 && (
                  <div className="flex-1 h-px mx-2 bg-white/30" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Progression table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${140 + levels.length * 190}px` }} className="p-4">

              {/* Column headers */}
              <div className="flex gap-1.5 mb-1">
                <div className="w-36 shrink-0" />
                {levels.map((lv, i) => (
                  <div key={i} className="flex-1 bg-slate-50 rounded-t-xl px-3 py-2.5 border border-slate-100">
                    <div className="text-[13px] font-medium text-slate-700">{lv.label}</div>
                  </div>
                ))}
              </div>

              {/* Tags */}
              <div className="flex gap-1.5 mb-3">
                <div className="w-36 shrink-0" />
                {levels.map((_, i) => {
                  const tag = LEVEL_TAGS[Math.min(i, LEVEL_TAGS.length - 1)]
                  return (
                    <div key={i} className="flex-1">
                      <span
                        className="inline-block text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: tag.bg, color: tag.text }}
                      >
                        {tag.label}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* Dimension rows */}
              {DIMENSIONS.map((dim) => {
                const c = DIM_COLORS[dim.id]
                return (
                  <div key={dim.id} className="flex gap-1.5 mb-1.5">
                    <div className={`w-36 shrink-0 rounded-xl px-3 py-3 border flex flex-col gap-1 ${c.bg} ${c.border}`}>
                      <span className="text-base leading-none">{dim.icon}</span>
                      <span className={`text-[13px] font-medium leading-snug ${c.text}`}>{dim.label}</span>
                    </div>

                    {levels.map((lv, i) => {
                      const items = parseItems(lv.competencies[dim.id])
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-white rounded-xl px-3 py-3 border border-slate-100"
                        >
                          {items.length === 0 ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <ul className="space-y-1.5">
                              {items.map((item, j) => (
                                <li key={j} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
                                  <span
                                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: c.dot }}
                                  />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

            </div>
          </div>
        </div>

        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Về trang chủ
        </Link>
      </div>
    </div>
  )
}
