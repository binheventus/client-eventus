import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

/* ─── constants ─── */
const POSITION_META = {
  cameraman:    { icon: '🎬' },
  editor:       { icon: '🎞️' },
  photographer: { icon: '📷' },
  account:      { icon: '🤝' },
  leader:       { icon: '🧭' },
}

const DIMENSIONS = [
  { id: 'chuyen_mon',          icon: '⚙️',  label: 'Năng lực chuyên môn' },
  { id: 'nghien_cuu_sang_tao', icon: '💡',  label: 'Nghiên cứu & sáng tạo' },
  { id: 'trach_nhiem',         icon: '○',   label: 'Trách nhiệm', customIcon: true },
  { id: 'xu_ly_tinh_huong',    icon: '⚡',  label: 'Xử lý tình huống' },
  { id: 'lam_viec_khach_hang', icon: '🤝',  label: 'Làm việc với khách hàng' },
]

const DIM_COLORS = {
  chuyen_mon:          { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    dot: '#60a5fa' },
  nghien_cuu_sang_tao: { bg: 'bg-violet-50',  border: 'border-violet-200',  text: 'text-violet-700',  dot: '#a78bfa' },
  trach_nhiem:         { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: '#34d399' },
  xu_ly_tinh_huong:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: '#fbbf24' },
  lam_viec_khach_hang: { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    dot: '#fb7185' },
}

// Tag cho từng level (tối đa 5)
const LEVEL_TAGS = [
  { label: 'Học & quan sát',        bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  { label: 'Độc lập cơ bản',        bg: '#eff6ff', text: '#1d4ed8', dot: '#60a5fa' },
  { label: 'Chủ động sáng tạo',     bg: '#f0fdf4', text: '#15803d', dot: '#4ade80' },
  { label: 'Gánh team kỹ thuật',    bg: '#fff7ed', text: '#c2410c', dot: '#fb923c' },
  { label: 'Định hướng chiến lược', bg: '#faf5ff', text: '#7e22ce', dot: '#c084fc' },
]

const CLAMP_HEIGHT = 200 // px — ngưỡng để hiện nút "Xem thêm"

/* ─── helpers ─── */
function parseItems(text) {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.replace(/^[\s\-•+]+/, '').trim())
    .filter(l => l.length > 2)
}

/* ─── SmartCell: ô nội dung với logic "Xem thêm" thông minh ─── */
function SmartCell({ items, dotColor }) {
  const [expanded, setExpanded] = useState(false)
  const [needsClamp, setNeedsClamp] = useState(false)
  const innerRef = useRef(null)

  useEffect(() => {
    if (innerRef.current) {
      setNeedsClamp(innerRef.current.scrollHeight > CLAMP_HEIGHT)
    }
  }, [items])

  if (items.length === 0) {
    return <span className="text-xs text-slate-300">—</span>
  }

  return (
    <div>
      <div
        style={{
          maxHeight: needsClamp && !expanded ? `${CLAMP_HEIGHT}px` : 'none',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <ul ref={innerRef} className="space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
              <span
                className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: dotColor }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        {/* fade gradient khi đang clamp */}
        {needsClamp && !expanded && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '48px',
              background: 'linear-gradient(to bottom, transparent, white)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {needsClamp && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? '▲ Thu gọn' : '▼ Xem thêm'}
        </button>
      )}
    </div>
  )
}

/* ─── CheckCircle icon (outline) ─── */
function CheckCircleIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

/* ─── Main page ─── */
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

        {/* ── Banner: chỉ giữ tên vị trí + mission, bỏ timeline ── */}
        <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg px-8 py-7 text-white mb-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{meta.icon}</span>
            <div>
              <h1 className="text-[22px] md:text-[26px] font-medium tracking-tight">{position.name}</h1>
              {position.mission && (
                <p className="text-sm text-blue-100 mt-1 max-w-xl italic">"{position.mission}"</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Progression table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${140 + levels.length * 210}px` }}>

              {/*
                ── STICKY HEADER với 3 tầng ──
                Tầng 1: số thứ tự trong vòng tròn + đường kẻ ngang kết nối
                Tầng 2: tên cấp bậc (bold, lớn)
                Tầng 3: badge mô tả (pill shape, pastel)
              */}
              <div
                className="sticky top-0 z-20 bg-white/80 backdrop-blur-md shadow-md"
                style={{ borderBottom: '1px solid #e2e8f0' }}
              >
                <div className="flex gap-0">
                  {/* ô rỗng góc trái */}
                  <div
                    className="shrink-0 bg-white/80"
                    style={{ width: '140px', borderRight: '1px solid #e2e8f0' }}
                  />

                  {/* các cột level */}
                  {levels.map((lv, i) => {
                    const tag = LEVEL_TAGS[Math.min(i, LEVEL_TAGS.length - 1)]
                    const isLast = i === levels.length - 1
                    return (
                      <div
                        key={i}
                        className="flex-1 px-4 pt-4 pb-3 flex flex-col gap-2"
                        style={{
                          borderRight: isLast ? 'none' : '1px solid #e2e8f0',
                        }}
                      >
                        {/* Tầng 1: số + connector */}
                        <div className="flex items-center">
                          <div
                            className="w-7 h-7 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center shrink-0"
                            style={{ zIndex: 1 }}
                          >
                            <span className="text-[11px] font-bold text-slate-500">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                          </div>
                          {/* đường kẻ ngang mờ chỉ trong header */}
                          {!isLast && (
                            <div className="flex-1 h-px bg-slate-200 ml-1" />
                          )}
                        </div>

                        {/* Tầng 2: tên cấp bậc */}
                        <div className="text-[13px] font-bold text-slate-800 leading-snug">
                          {lv.label}
                        </div>

                        {/* Tầng 3: badge pill */}
                        <div>
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                            style={{ background: tag.bg, color: tag.text }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: tag.dot }}
                            />
                            {tag.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ── Body: các hàng dimension ── */}
              <div className="p-4 pt-2">
                {DIMENSIONS.map((dim, dimIdx) => {
                  const c = DIM_COLORS[dim.id]
                  const isLast = dimIdx === DIMENSIONS.length - 1
                  return (
                    <div
                      key={dim.id}
                      className="flex gap-0"
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
                        marginBottom: isLast ? 0 : '2px',
                      }}
                    >
                      {/* Cột label nhóm năng lực — thu hẹp, căn giữa, kẻ dọc phân cách */}
                      <div
                        className={`shrink-0 flex flex-col items-center justify-center gap-1.5 py-4 px-2 rounded-xl my-1 ${c.bg} ${c.border}`}
                        style={{
                          width: '128px',
                          border: `1px solid`,
                          borderColor: c.border.replace('border-', '').replace('-200', ''),
                          marginRight: '8px',
                        }}
                      >
                        {/* Icon */}
                        {dim.customIcon ? (
                          <CheckCircleIcon className={`w-5 h-5 ${c.text}`} />
                        ) : (
                          <span className="text-lg leading-none">{dim.icon}</span>
                        )}
                        {/* Label */}
                        <span
                          className={`text-[11px] font-bold text-center leading-snug ${c.text}`}
                          style={{ maxWidth: '100px' }}
                        >
                          {dim.label}
                        </span>
                      </div>

                      {/* Các ô nội dung */}
                      <div className="flex flex-1 gap-0">
                        {levels.map((lv, i) => {
                          const items = parseItems(lv.competencies[dim.id])
                          const isLastCol = i === levels.length - 1
                          return (
                            <div
                              key={i}
                              className="flex-1 py-4 px-3 my-1"
                              style={{
                                borderRight: isLastCol ? 'none' : '1px solid transparent', // không kẻ dọc ở body
                              }}
                            >
                              <SmartCell items={items} dotColor={c.dot} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

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
