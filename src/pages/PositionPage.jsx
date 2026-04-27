import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬', accent: '#f97316' },
  editor:       { icon: '🎞️', accent: '#8b5cf6' },
  photographer: { icon: '📷', accent: '#0ea5e9' },
  account:      { icon: '🤝', accent: '#10b981' },
  leader:       { icon: '🧭', accent: '#f59e0b' },
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
  { label: 'Độc lập cơ bản',        bg: '#eff6ff', text: '#3b82f6' },
  { label: 'Chủ động sáng tạo',     bg: '#f0fdf4', text: '#16a34a' },
  { label: 'Gánh team kỹ thuật',    bg: '#fff7ed', text: '#ea580c' },
  { label: 'Định hướng chiến lược', bg: '#faf5ff', text: '#9333ea' },
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
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-ink-muted">Không tìm thấy vị trí này.</p>
        <Link to="/" className="text-brand-600 font-medium text-sm hover:underline">← Về trang chủ</Link>
      </div>
    )
  }

  const meta = POSITION_META[position.id] || { icon: '📌', accent: '#6b7280' }
  const levels = position.levels
  const isHighlight = (i) => i >= levels.length - 2

  return (
    <div className="min-h-screen bg-surface">
      <Header back title={position.name} />

      {/* Hero */}
      <div className="bg-white border-b border-ink-faint/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7">
          <div className="flex items-center gap-4 mb-5">
            <span className="text-4xl">{meta.icon}</span>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">{position.name}</h1>
              {position.mission && (
                <p className="text-ink-muted text-sm mt-1 italic max-w-xl">"{position.mission}"</p>
              )}
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center">
            {levels.map((lv, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: meta.accent, opacity: 0.25 + i * 0.15 }}
                  />
                  <span className="text-xs text-ink-muted hidden sm:block whitespace-nowrap">{lv.label}</span>
                </div>
                {i < levels.length - 1 && (
                  <div className="flex-1 h-px mx-2" style={{ backgroundColor: meta.accent, opacity: 0.2 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-2">
          <div style={{ minWidth: `${140 + levels.length * 190}px` }}>

            {/* Column headers */}
            <div className="flex gap-1.5 mb-1">
              <div className="w-36 shrink-0" />
              {levels.map((lv, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-xl px-3 py-2.5"
                  style={{ background: isHighlight(i) ? `${meta.accent}15` : '#f5f2ee' }}
                >
                  <div className="text-xs text-ink-muted font-medium">{lv.label}</div>
                  <div className="text-sm font-semibold text-ink mt-0.5 leading-snug">{lv.label}</div>
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

            {/* Rows per dimension */}
            {DIMENSIONS.map((dim) => {
              const c = DIM_COLORS[dim.id]
              return (
                <div key={dim.id} className="flex gap-1.5 mb-1.5">
                  {/* Label */}
                  <div className={`w-36 shrink-0 rounded-xl px-3 py-3 border flex flex-col gap-1 ${c.bg} ${c.border}`}>
                    <span className="text-base leading-none">{dim.icon}</span>
                    <span className={`text-xs font-semibold leading-snug ${c.text}`}>{dim.label}</span>
                  </div>

                  {/* Cells */}
                  {levels.map((lv, i) => {
                    const items = parseItems(lv.competencies[dim.id])
                    const hi = isHighlight(i)
                    return (
                      <div
                        key={i}
                        className="flex-1 bg-white rounded-xl px-3 py-3 border border-ink-faint/20"
                        style={hi ? { borderTopColor: meta.accent, borderTopWidth: '2px' } : {}}
                      >
                        {items.length === 0 ? (
                          <span className="text-xs text-ink-faint">—</span>
                        ) : (
                          <ul className="space-y-1.5">
                            {items.map((item, j) => (
                              <li key={j} className="flex gap-2 text-xs text-ink-soft leading-relaxed">
                                <span
                                  className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: c.dot, opacity: hi ? 1 : 0.5 }}
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

        <div className="mt-8 pt-6 border-t border-ink-faint/20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  )
}
