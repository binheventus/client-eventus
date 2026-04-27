import { useState, useRef, useEffect } from 'react'
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
  { id: 'chuyen_mon',          icon: '⚙️', label: 'Năng lực chuyên môn',     customIcon: false },
  { id: 'nghien_cuu_sang_tao', icon: '💡', label: 'Nghiên cứu & sáng tạo',   customIcon: false },
  { id: 'trach_nhiem',         icon: null, label: 'Trách nhiệm',              customIcon: true  },
  { id: 'xu_ly_tinh_huong',    icon: '⚡', label: 'Xử lý tình huống',        customIcon: false },
  { id: 'lam_viec_khach_hang', icon: '🤝', label: 'Làm việc với khách hàng', customIcon: false },
]

const DIM_COLORS = {
  chuyen_mon:          { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#60a5fa' },
  nghien_cuu_sang_tao: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#a78bfa' },
  trach_nhiem:         { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#34d399' },
  xu_ly_tinh_huong:    { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#fbbf24' },
  lam_viec_khach_hang: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', dot: '#fb7185' },
}

const LEVEL_META = [
  { label: 'Học & quan sát',        badgeBg: '#f1f5f9', badgeText: '#475569', dot: '#94a3b8', topBorder: '#94a3b8' },
  { label: 'Độc lập cơ bản',        badgeBg: '#dbeafe', badgeText: '#1d4ed8', dot: '#60a5fa', topBorder: '#3b82f6' },
  { label: 'Chủ động sáng tạo',     badgeBg: '#dcfce7', badgeText: '#15803d', dot: '#4ade80', topBorder: '#22c55e' },
  { label: 'Gánh team kỹ thuật',    badgeBg: '#ffedd5', badgeText: '#c2410c', dot: '#fb923c', topBorder: '#f97316' },
  { label: 'Định hướng chiến lược', badgeBg: '#f3e8ff', badgeText: '#7e22ce', dot: '#c084fc', topBorder: '#a855f7' },
]

const CLAMP_PX = 180  // ngưỡng max-height khi thu gọn

/* ─── helpers ─── */
function parseItems(text) {
  if (!text) return []
  return text
    .split('\n')
    .map(l => l.replace(/^[\s\-•+]+/, '').trim())
    .filter(l => l.length > 2)
}

function CheckCircleIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
}

/* ─── ItemList: render danh sách bullet đơn giản ─── */
function ItemList({ items, dotColor }) {
  if (!items.length) return <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
  return (
    <>
      {items.map((item, j) => (
        <div key={j} style={{
          display: 'flex',
          gap: '6px',
          fontSize: '11px',
          color: '#475569',
          lineHeight: 1.65,
          marginBottom: '5px',
        }}>
          <span style={{
            marginTop: '7px',
            width: '5px',
            height: '5px',
            minWidth: '5px',
            borderRadius: '50%',
            backgroundColor: dotColor,
            display: 'inline-block',
          }} />
          <span>{item}</span>
        </div>
      ))}
    </>
  )
}

/*
  ─── SmartRow ───
  Logic clamp dùng max-height + overflow:hidden (đáng tin hơn webkit-line-clamp)
  
  Cách hoạt động:
  1. Render nội dung với visibility:hidden để đo scrollHeight thực tế
  2. So sánh các cột trong hàng → tìm cột dài nhất
  3. Nếu cột đó > CLAMP_PX và dài hơn cột 2 > 15% → clamp nó
  4. Clamp = max-height: CLAMP_PX + overflow: hidden + fade gradient
  5. Click "Xem thêm" → max-height: none
*/
function SmartRow({ dim, levels, colTemplate }) {
  const c = DIM_COLORS[dim.id]
  const itemsPerLevel = levels.map(lv => parseItems(lv.competencies[dim.id]))

  // Phase 1: đo (measure), Phase 2: hiển thị (display)
  const [phase, setPhase] = useState('measure')
  const [clampedIdx, setClampedIdx] = useState(-1)
  const [expanded, setExpanded] = useState(false)
  const measureRefs = useRef([])

  useEffect(() => {
    if (phase !== 'measure') return
    // rAF đảm bảo DOM đã layout xong
    const id = requestAnimationFrame(() => {
      const heights = measureRefs.current.map(el => el ? el.offsetHeight : 0)
      const max = Math.max(...heights)
      const sorted = [...heights].sort((a, b) => b - a)
      const second = sorted[1] ?? 0

      let idx = -1
      if (max > CLAMP_PX && max > second * 1.15) {
        idx = heights.indexOf(max)
      }
      setClampedIdx(idx)
      setPhase('display')
    })
    return () => cancelAnimationFrame(id)
  }, [phase])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: colTemplate,
      borderBottom: '1px solid #e2e8f0',
    }}>
      {/* Cột label nhóm */}
      <div style={{
        backgroundColor: c.bg,
        borderRight: '2px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '14px 6px',
        textAlign: 'center',
      }}>
        {dim.customIcon
          ? <CheckCircleIcon color={c.text} />
          : <span style={{ fontSize: '16px', lineHeight: 1 }}>{dim.icon}</span>
        }
        <span style={{ fontSize: '10px', fontWeight: 700, color: c.text, lineHeight: 1.3 }}>
          {dim.label}
        </span>
      </div>

      {/* Ô nội dung */}
      {levels.map((lv, i) => {
        const items = itemsPerLevel[i]
        const isLastCol = i === levels.length - 1
        const shouldClamp = clampedIdx === i && !expanded

        return (
          <div key={i} style={{
            padding: '12px 10px',
            borderRight: isLastCol ? 'none' : '1px solid #e2e8f0',
          }}>
            {phase === 'measure' ? (
              /* Phase đo: render full, visibility hidden để không thấy nhưng vẫn có layout */
              <div
                ref={el => { measureRefs.current[i] = el }}
                style={{ visibility: 'hidden' }}
              >
                <ItemList items={items} dotColor={c.dot} />
              </div>
            ) : (
              /* Phase hiển thị */
              <div>
                <div style={{
                  maxHeight: shouldClamp ? `${CLAMP_PX}px` : 'none',
                  overflow: shouldClamp ? 'hidden' : 'visible',
                  position: 'relative',
                }}>
                  <ItemList items={items} dotColor={c.dot} />

                  {/* Fade gradient khi đang clamp */}
                  {shouldClamp && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '40px',
                      background: 'linear-gradient(to bottom, transparent, white)',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>

                {/* Nút chỉ xuất hiện ở ô bị clamp */}
                {clampedIdx === i && (
                  <button
                    onClick={() => setExpanded(e => !e)}
                    style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'block',
                    }}
                  >
                    {expanded ? '▲ Thu gọn' : '▼ Xem thêm'}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ─── StickyHeader ─── */
function StickyHeader({ levels, colTemplate }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      position: 'sticky',
      top: '56px',
      zIndex: 40,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      backgroundColor: 'rgba(255,255,255,0.85)',
      boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.12)' : '0 1px 0 #e2e8f0',
      borderBottom: scrolled ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
      transition: 'box-shadow 0.2s, border-color 0.2s',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: colTemplate }}>
        <div style={{ borderRight: '2px solid #e2e8f0', padding: '14px 8px' }} />

        {levels.map((lv, i) => {
          const meta = LEVEL_META[Math.min(i, LEVEL_META.length - 1)]
          const isLastCol = i === levels.length - 1
          return (
            <div key={i} style={{
              padding: '14px 12px 12px',
              borderTop: `3px solid ${meta.topBorder}`,
              borderRight: isLastCol ? 'none' : '1px solid #cbd5e1',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Số chìm */}
              <span style={{
                position: 'absolute',
                top: '0px',
                right: '6px',
                fontSize: '40px',
                fontWeight: 800,
                color: '#e8ecf0',
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none',
                letterSpacing: '-2px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1e293b',
                  lineHeight: 1.3,
                  marginBottom: '7px',
                }}>
                  {lv.label}
                </div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: '9999px',
                  backgroundColor: meta.badgeBg,
                  color: meta.badgeText,
                }}>
                  <span style={{
                    width: '5px', height: '5px',
                    borderRadius: '50%',
                    backgroundColor: meta.dot,
                    display: 'inline-block', flexShrink: 0,
                  }} />
                  {meta.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main ─── */
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
  const colTemplate = `11% repeat(${levels.length}, 1fr)`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header back title={position.name} />

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Banner */}
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

        {/* Layout: header sticky + body — KHÔNG có overflow:hidden bao ngoài cả 2 */}
        <div style={{ marginBottom: '24px' }}>

          {/* Sticky header */}
          <div style={{
            borderRadius: '16px 16px 0 0',
            border: '1px solid #e2e8f0',
            borderBottom: 'none',
            overflow: 'hidden',
          }}>
            <StickyHeader levels={levels} colTemplate={colTemplate} />
          </div>

          {/* Body */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderTop: 'none',
            borderRadius: '0 0 16px 16px',
            overflow: 'hidden',
          }}>
            {DIMENSIONS.map(dim => (
              <SmartRow
                key={dim.id}
                dim={dim}
                levels={levels}
                colTemplate={colTemplate}
              />
            ))}
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
