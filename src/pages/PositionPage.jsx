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

/* ─── ClampCell: wrapper div đảm bảo -webkit-line-clamp hoạt động ─── */
function ClampCell({ items, dotColor, doClamp, expanded }) {
  if (items.length === 0) {
    return <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
  }

  return (
    /*
      QUAN TRỌNG: -webkit-line-clamp chỉ hoạt động khi:
      1. Element là display: -webkit-box
      2. -webkit-box-orient: vertical
      3. overflow: hidden
      Phải đặt trực tiếp lên container có text, KHÔNG qua ul/li trung gian
    */
    <div style={doClamp && !expanded ? {
      display: '-webkit-box',
      WebkitLineClamp: 8,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
    } : {}}>
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
    </div>
  )
}

/* ─── GridRow: một hàng dimension dùng CSS Grid ─── */
function GridRow({ dim, levels, colTemplate }) {
  const c = DIM_COLORS[dim.id]
  const itemsPerLevel = levels.map(lv => parseItems(lv.competencies[dim.id]))

  // Đo chiều cao thực sau render để quyết định clamp
  const measureRefs = useRef([])
  const [clampedIdx, setClampedIdx] = useState(null) // null = chưa đo xong
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Dùng rAF để đảm bảo đo sau khi browser đã layout
    const id = requestAnimationFrame(() => {
      const heights = measureRefs.current.map(el => el ? el.getBoundingClientRect().height : 0)
      const max = Math.max(...heights)
      const sorted = [...heights].sort((a, b) => b - a)
      const second = sorted[1] ?? 0

      if (max > 180 && max > second * 1.15) {
        setClampedIdx(heights.indexOf(max))
      } else {
        setClampedIdx(-1) // không clamp ai
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

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
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: c.text,
          lineHeight: 1.3,
        }}>
          {dim.label}
        </span>
      </div>

      {/* Ô nội dung từng level */}
      {levels.map((lv, i) => {
        const items = itemsPerLevel[i]
        const isLastCol = i === levels.length - 1
        const doClamp = clampedIdx === i

        return (
          <div key={i} style={{
            padding: '12px 10px',
            borderRight: isLastCol ? 'none' : '1px solid #e2e8f0',
            // Khi chưa đo xong (null): hiển thị bình thường để đo được chính xác
          }}>
            {/* Div đo ẩn — luôn full height, không bị clamp, để lấy scrollHeight */}
            <div
              ref={el => { measureRefs.current[i] = el }}
              style={{ visibility: clampedIdx === null ? 'visible' : 'hidden', position: clampedIdx === null ? 'static' : 'absolute', pointerEvents: 'none' }}
              aria-hidden={clampedIdx !== null}
            >
              <ClampCell items={items} dotColor={c.dot} doClamp={false} expanded={true} />
            </div>

            {/* Div thực sự hiển thị — chỉ render sau khi đã đo xong */}
            {clampedIdx !== null && (
              <div>
                <ClampCell items={items} dotColor={c.dot} doClamp={doClamp} expanded={expanded} />
                {doClamp && (
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

/* ─── StickyHeader: tách HOÀN TOÀN khỏi table, sticky độc lập ─── */
function StickyHeader({ levels, colTemplate }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 180)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{
      position: 'sticky',
      top: '56px',         // = chiều cao Navbar (Header.jsx h-14 = 56px)
      zIndex: 40,
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      backgroundColor: 'rgba(255,255,255,0.85)',
      boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.13)' : '0 1px 0 #e2e8f0',
      borderBottom: scrolled ? '2px solid #cbd5e1' : '1px solid #e2e8f0',
      transition: 'box-shadow 0.2s, border-color 0.2s',
      // KHÔNG overflow hidden ở đây
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: colTemplate,
      }}>
        {/* Góc trái trống */}
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
              {/* Số thứ tự chìm — layering */}
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

  // CSS Grid template: cột label 11%, các cột còn lại chia đều
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

        {/*
          Wrapper KHÔNG có overflow: hidden
          border + rounded áp dụng riêng trên header và body
        */}
        <div style={{ marginBottom: '24px' }}>

          {/* Header sticky — hoàn toàn tách khỏi body */}
          <div style={{
            borderRadius: '16px 16px 0 0',
            border: '1px solid #e2e8f0',
            overflow: 'hidden', // chỉ clip border-radius trên header, không ảnh hưởng sticky
          }}>
            <StickyHeader levels={levels} colTemplate={colTemplate} />
          </div>

          {/* Body — KHÔNG overflow hidden, để sticky header hoạt động */}
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderTop: 'none',
            borderRadius: '0 0 16px 16px',
          }}>
            {DIMENSIONS.map((dim, idx) => (
              <GridRow
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
