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

/* ─── SmartRow: đo chiều cao sau render, chỉ clamp ô dài nhất ─── */
function SmartRow({ dim, levels }) {
  const c = DIM_COLORS[dim.id]
  const cellRefs = useRef([])
  // clampedIdx: index ô cần clamp, null = không clamp ô nào
  const [clampedIdx, setClampedIdx] = useState(-2) // -2 = chưa đo xong
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Đo sau khi browser paint xong
    const raf = requestAnimationFrame(() => {
      const heights = cellRefs.current.map(el => (el ? el.scrollHeight : 0))
      const max = Math.max(...heights)
      const sorted = [...heights].sort((a, b) => b - a)
      const second = sorted[1] ?? 0

      if (max > 200 && max > second * 1.15) {
        setClampedIdx(heights.indexOf(max))
      } else {
        setClampedIdx(-1) // không có ô nào cần clamp
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
      {/* Cột label nhóm */}
      <td style={{
        backgroundColor: c.bg,
        borderRight: `2px solid #e2e8f0`,
        verticalAlign: 'middle',
        padding: '12px 6px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          {dim.customIcon
            ? <CheckCircleIcon color={c.text} />
            : <span style={{ fontSize: '15px', lineHeight: 1 }}>{dim.icon}</span>
          }
          <span style={{ fontSize: '10px', fontWeight: 700, color: c.text, lineHeight: 1.3 }}>
            {dim.label}
          </span>
        </div>
      </td>

      {/* Ô nội dung */}
      {levels.map((lv, i) => {
        const items = parseItems(lv.competencies[dim.id])
        const shouldClamp = clampedIdx === i && !expanded
        const isLastCol = i === levels.length - 1

        return (
          <td key={i} style={{
            verticalAlign: 'top',
            padding: '12px 10px',
            borderRight: isLastCol ? 'none' : '1px solid #e2e8f0',
          }}>
            {items.length === 0 ? (
              <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
            ) : (
              <div>
                {/*
                  Quan trọng: ref luôn trỏ vào ul để đo scrollHeight đúng.
                  Khi clamp: dùng WebkitLineClamp + overflow hidden.
                  Khi expand hoặc không phải ô cần clamp: hiện full.
                */}
                <ul
                  ref={el => { cellRefs.current[i] = el }}
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    ...(shouldClamp ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 8,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    } : {
                      display: 'block',
                      overflow: 'visible',
                    }),
                  }}
                >
                  {items.map((item, j) => (
                    <li key={j} style={{
                      display: 'flex',
                      gap: '6px',
                      fontSize: '11px',
                      color: '#475569',
                      lineHeight: 1.6,
                      marginBottom: '5px',
                    }}>
                      <span style={{
                        marginTop: '6px',
                        width: '5px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: c.dot,
                        flexShrink: 0,
                        display: 'inline-block',
                      }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                {/* Nút chỉ xuất hiện ở ô cần clamp */}
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
                    }}
                  >
                    {expanded ? '▲ Thu gọn' : '▼ Xem thêm'}
                  </button>
                )}
              </div>
            )}
          </td>
        )
      })}
    </tr>
  )
}

/* ─── Sticky Table Header ─── */
function TableHeader({ levels }) {
  const [isSticky, setIsSticky] = useState(false)
  const sentinelRef = useRef(null)

  useEffect(() => {
    // Dùng IntersectionObserver để detect khi thead bắt đầu sticky
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: '-57px 0px 0px 0px' }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* Sentinel: phần tử vô hình ngay trước thead để detect scroll */}
      <div ref={sentinelRef} style={{ height: 1, pointerEvents: 'none' }} />

      <thead style={{
        position: 'sticky',
        top: '57px',      // = chiều cao Navbar
        zIndex: 40,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        backgroundColor: 'rgba(255,255,255,0.80)',
        // Khi sticky: shadow đậm hơn + border-bottom sắc nét
        boxShadow: isSticky ? '0 4px 20px rgba(0,0,0,0.12)' : 'none',
        borderBottom: `2px solid ${isSticky ? '#cbd5e1' : '#e2e8f0'}`,
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
      }}>
        <tr>
          {/* Góc trái trống */}
          <th style={{
            padding: '14px 8px',
            borderRight: '2px solid #e2e8f0',
            backgroundColor: 'transparent',
          }} />

          {levels.map((lv, i) => {
            const meta = LEVEL_META[Math.min(i, LEVEL_META.length - 1)]
            const isLastCol = i === levels.length - 1
            return (
              <th key={i} style={{
                padding: '14px 12px 12px',
                textAlign: 'left',
                verticalAlign: 'bottom',
                borderTop: `3px solid ${meta.topBorder}`,
                borderRight: isLastCol ? 'none' : '1px solid #cbd5e1',
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: 'transparent',
              }}>
                {/* Số thứ tự chìm — layering */}
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '8px',
                  fontSize: '38px',
                  fontWeight: 800,
                  color: '#e2e8f0',
                  lineHeight: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  zIndex: 0,
                  letterSpacing: '-1px',
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
                      width: '5px',
                      height: '5px',
                      borderRadius: '50%',
                      backgroundColor: meta.dot,
                      display: 'inline-block',
                      flexShrink: 0,
                    }} />
                    {meta.label}
                  </span>
                </div>
              </th>
            )
          })}
        </tr>
      </thead>
    </>
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

        {/*
          CRITICAL FIX:
          - KHÔNG dùng overflow-hidden trên wrapper (sẽ kill sticky)
          - Dùng overflow-x: auto chỉ khi thực sự cần scroll ngang (màn nhỏ)
          - rounded + border vẫn giữ nhưng không clip thead sticky
        */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          border: '1px solid #e2e8f0',
          overflowX: 'auto',   // scroll ngang nếu màn hình nhỏ
          overflowY: 'visible', // KHÔNG clip theo chiều dọc → sticky hoạt động
          marginBottom: '24px',
          position: 'relative',
        }}>
          <table style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            minWidth: '700px', // đảm bảo không bị quá hẹp trên mobile
          }}>
            <colgroup>
              <col style={{ width: '11%' }} />
              {levels.map((_, i) => (
                <col key={i} style={{ width: `${89 / levels.length}%` }} />
              ))}
            </colgroup>

            <TableHeader levels={levels} />

            <tbody>
              {DIMENSIONS.map(dim => (
                <SmartRow key={dim.id} dim={dim} levels={levels} />
              ))}
            </tbody>
          </table>
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
