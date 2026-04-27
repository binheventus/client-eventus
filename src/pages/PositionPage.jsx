import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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
  { id: 'chuyen_mon',          icon: '⚙️', label: 'Năng lực\nchuyên môn',   customIcon: false },
  { id: 'nghien_cuu_sang_tao', icon: '💡', label: 'Nghiên cứu\n& sáng tạo', customIcon: false },
  { id: 'trach_nhiem',         icon: null, label: 'Trách\nnhiệm',            customIcon: true  },
  { id: 'xu_ly_tinh_huong',    icon: '⚡', label: 'Xử lý\ntình huống',      customIcon: false },
  { id: 'lam_viec_khach_hang', icon: '🤝', label: 'Làm việc\nvới KH',        customIcon: false },
]

const DIM_COLORS = {
  chuyen_mon:          { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', dot: '#60a5fa' },
  nghien_cuu_sang_tao: { bg: '#f5f3ff', border: '#ddd6fe', text: '#6d28d9', dot: '#a78bfa' },
  trach_nhiem:         { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', dot: '#34d399' },
  xu_ly_tinh_huong:    { bg: '#fffbeb', border: '#fde68a', text: '#b45309', dot: '#fbbf24' },
  lam_viec_khach_hang: { bg: '#fff1f2', border: '#fecdd3', text: '#be123c', dot: '#fb7185' },
}

const LEVEL_META = [
  { label: 'Học & quan sát',        badgeBg: 'rgba(255,255,255,0.15)', badgeText: '#e2e8f0', dot: 'rgba(255,255,255,0.5)', topBorder: 'rgba(255,255,255,0.25)' },
  { label: 'Độc lập cơ bản',        badgeBg: 'rgba(147,197,253,0.25)', badgeText: '#bfdbfe', dot: '#93c5fd',               topBorder: '#60a5fa' },
  { label: 'Chủ động sáng tạo',     badgeBg: 'rgba(134,239,172,0.20)', badgeText: '#bbf7d0', dot: '#86efac',               topBorder: '#4ade80' },
  { label: 'Gánh team kỹ thuật',    badgeBg: 'rgba(253,186,116,0.25)', badgeText: '#fed7aa', dot: '#fdba74',               topBorder: '#fb923c' },
  { label: 'Định hướng chiến lược', badgeBg: 'rgba(216,180,254,0.25)', badgeText: '#e9d5ff', dot: '#d8b4fe',               topBorder: '#c084fc' },
]

const CLAMP_PX = 180
const NAVBAR_H = 0
// Width tối thiểu mỗi cột level để không bị vỡ trên mobile
const COL_LABEL_W = 80   // px — minWidth cột nhóm năng lực
const COL_LEVEL_W = 160  // px — minWidth mỗi cột level
const EMBEDDED_COL_LEVEL_W = 190

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

function ItemList({ items, dotColor }) {
  if (!items.length) return <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>
  return (
    <>
      {items.map((item, j) => (
        <div key={j} style={{
          display: 'flex', gap: '6px',
          fontSize: '10px', color: '#475569',
          lineHeight: 1.7, marginBottom: '6px',
        }}>
          <span style={{
            marginTop: '7px', width: '5px', height: '5px', minWidth: '5px',
            borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block',
          }} />
          <span>{item}</span>
        </div>
      ))}
    </>
  )
}

/* ─── SmartRow ─── */
function SmartRow({ dim, levels, levelColumnWidth = COL_LEVEL_W }) {
  const c = DIM_COLORS[dim.id]
  const itemsPerLevel = levels.map(lv => parseItems(lv.competencies[dim.id]))
  const [phase, setPhase] = useState('measure')
  const [clampedIdx, setClampedIdx] = useState(-1)
  const [expanded, setExpanded] = useState(false)
  const measureRefs = useRef([])

  useEffect(() => {
    if (phase !== 'measure') return
    const id = requestAnimationFrame(() => {
      const heights = measureRefs.current.map(el => el ? el.offsetHeight : 0)
      const max = Math.max(...heights)
      const sorted = [...heights].sort((a, b) => b - a)
      const second = sorted[1] ?? 0
      let idx = -1
      if (max > CLAMP_PX && max > second * 1.15) idx = heights.indexOf(max)
      setClampedIdx(idx)
      setPhase('display')
    })
    return () => cancelAnimationFrame(id)
  }, [phase])

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      borderBottom: '1px solid #e2e8f0',
    }}>
      {/* Cột nhóm năng lực */}
      <div style={{
        flex: '0 0 auto',
        width: `${COL_LABEL_W}px`,
        minWidth: `${COL_LABEL_W}px`,
        backgroundColor: c.bg,
        borderRight: '2px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '6px', padding: '14px 6px', textAlign: 'center',
      }}>
        {dim.customIcon
          ? <CheckCircleIcon color={c.text} />
          : <span style={{ fontSize: '16px', lineHeight: 1 }}>{dim.icon}</span>
        }
        <span style={{
          fontSize: '12px', fontWeight: 700, color: c.text,
          lineHeight: 1.35, whiteSpace: 'pre-line', textAlign: 'center',
        }}>
          {dim.label}
        </span>
      </div>

      {/* Ô nội dung từng level */}
      {levels.map((lv, i) => {
        const items = itemsPerLevel[i]
        const isLastCol = i === levels.length - 1
        const shouldClamp = clampedIdx === i && !expanded
        return (
          <div key={i} style={{
            flex: 1,
            minWidth: `${levelColumnWidth}px`,
            padding: '14px 16px',
            borderRight: isLastCol ? 'none' : '1px solid #e2e8f0',
          }}>
            {phase === 'measure' ? (
              <div ref={el => { measureRefs.current[i] = el }} style={{ visibility: 'hidden' }}>
                <ItemList items={items} dotColor={c.dot} />
              </div>
            ) : (
              <div>
                <div style={{
                  maxHeight: shouldClamp ? `${CLAMP_PX}px` : 'none',
                  overflow: shouldClamp ? 'hidden' : 'visible',
                  position: 'relative',
                }}>
                  <ItemList items={items} dotColor={c.dot} />
                  {shouldClamp && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px',
                      background: 'linear-gradient(to bottom, transparent, white)',
                      pointerEvents: 'none',
                    }} />
                  )}
                </div>
                {clampedIdx === i && (
                  <button onClick={() => setExpanded(e => !e)} style={{
                    marginTop: '6px', fontSize: '11px', fontWeight: 600,
                    color: '#2563eb', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, display: 'block',
                  }}>
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

/* ─── HeaderRow: dùng chung cho static + fixed clone ─── */
function HeaderRow({ position, meta, levels, totalMinW, showBanner, levelColumnWidth = COL_LEVEL_W }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #1d4ed8 0%, #0d9488 100%)',
      width: '100%',
      minWidth: `${totalMinW}px`,
    }}>
      {/* Banner — chỉ hiện ở static, không hiện ở fixed clone */}
      {showBanner && (
        <>
          <div style={{ padding: '24px 28px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '36px', lineHeight: 1 }}>{meta.icon}</span>
              <div>
                <h1 style={{
                  fontSize: '22px', fontWeight: 600, color: 'white',
                  letterSpacing: '-0.3px', margin: 0, lineHeight: 1.2,
                }}>
                  {position.name}
                </h1>
                {position.mission && (
                  <p style={{
                    fontSize: '13px', color: 'rgba(191,219,254,0.9)',
                    marginTop: '4px', fontStyle: 'italic',
                    maxWidth: '520px', lineHeight: 1.5,
                  }}>
                    "{position.mission}"
                  </p>
                )}
              </div>
            </div>
          </div>
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.12)', margin: '0 28px' }} />
        </>
      )}

      {/* Level header row */}
      <div style={{ display: 'flex' }}>
        {/* Góc trái */}
        <div style={{
          flex: '0 0 auto',
          width: `${COL_LABEL_W}px`, minWidth: `${COL_LABEL_W}px`,
          borderRight: '1px solid rgba(255,255,255,0.15)',
          padding: '14px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {/* Icon nhỏ khi ở chế độ fixed (không có banner) */}
          {!showBanner && (
            <span style={{ fontSize: '20px' }}>{meta.icon}</span>
          )}
        </div>

        {levels.map((lv, i) => {
          const lmeta = LEVEL_META[Math.min(i, LEVEL_META.length - 1)]
          const isLastCol = i === levels.length - 1
          return (
            <div key={i} style={{
              flex: 1,
              minWidth: `${levelColumnWidth}px`,
              borderTop: `3px solid ${lmeta.topBorder}`,
              borderRight: isLastCol ? 'none' : '1px solid rgba(255,255,255,0.15)',
              position: 'relative', overflow: 'hidden',
            }}>
              <span style={{
                position: 'absolute', top: '2px', right: '8px',
                fontSize: '40px', fontWeight: 800,
                color: 'rgba(255,255,255,0.10)',
                lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-2px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px 16px' }}>
                <div style={{
                  fontSize: '12px', fontWeight: 700, color: 'white',
                  lineHeight: 1.3, marginBottom: '7px',
                }}>
                  {lv.label}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '10px', fontWeight: 700,
                  padding: '3px 9px', borderRadius: '9999px',
                  backgroundColor: lmeta.badgeBg, color: lmeta.badgeText,
                  whiteSpace: 'nowrap', // badge không xuống dòng
                }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%',
                    backgroundColor: lmeta.dot, display: 'inline-block', flexShrink: 0,
                  }} />
                  {lmeta.label}
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
export default function PositionPage({ embedded = false }) {
  const { positionId } = useParams()
  const framework = data.competency_framework
  const position = framework.positions.find(p => p.id === positionId)

  const scrollWrapperRef = useRef(null)  // div có overflow-x: auto
  const staticBlockRef = useRef(null)
  const tableEndRef = useRef(null)
  const [showFixed, setShowFixed] = useState(false)
  const [fixedLeft, setFixedLeft] = useState(0)
  const [fixedWidth, setFixedWidth] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      if (!staticBlockRef.current || !tableEndRef.current) return
      const blockRect = staticBlockRef.current.getBoundingClientRect()
      const endRect = tableEndRef.current.getBoundingClientRect()
      const wrapperRect = scrollWrapperRef.current?.getBoundingClientRect()
      const shouldShow = blockRect.bottom < NAVBAR_H && endRect.top > NAVBAR_H
      setShowFixed(shouldShow)
      if (wrapperRect) {
        setFixedLeft(wrapperRect.left)
        setFixedWidth(wrapperRect.width)
      }
    }
    // Sync scroll ngang của fixed header theo scroll wrapper
    const onWrapperScroll = () => {
      if (scrollWrapperRef.current) {
        setScrollLeft(scrollWrapperRef.current.scrollLeft)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    scrollWrapperRef.current?.addEventListener('scroll', onWrapperScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      scrollWrapperRef.current?.removeEventListener('scroll', onWrapperScroll)
    }
  }, [])

  if (!position) {
    return (
      <div className={`${embedded ? 'px-6 py-8' : 'min-h-screen'} bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center gap-4`}>
        <p className="text-slate-500">Không tìm thấy vị trí này.</p>
        <Link to="/" className="text-blue-700 font-medium text-sm hover:underline">← Về trang chủ</Link>
      </div>
    )
  }

  const meta = POSITION_META[position.id] || { icon: '📌' }
  const levels = position.levels
  const levelColumnWidth = embedded ? EMBEDDED_COL_LEVEL_W : COL_LEVEL_W
  // Tổng width thực tế của bảng
  const totalMinW = COL_LABEL_W + levelColumnWidth * levels.length

  return (
    <div className={`${embedded ? 'px-6 pb-6 pt-0' : 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50'}`}>
      {/* Fixed clone khi scroll — overflow hidden để cắt đúng viền wrapper */}
      {showFixed && (
        <div style={{
          position: 'fixed',
          top: `${NAVBAR_H}px`,
          left: `${fixedLeft}px`,
          width: `${fixedWidth}px`,
          zIndex: 50,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.20)',
          borderRadius: '0 0 12px 12px',
        }}>
          {/* Inner div dịch chuyển theo scrollLeft để đồng bộ với bảng */}
          <div style={{ transform: `translateX(-${scrollLeft}px)` }}>
            <HeaderRow
                position={position}
                meta={meta}
                levels={levels}
                totalMinW={totalMinW}
                showBanner={false}
                levelColumnWidth={levelColumnWidth}
            />
          </div>
        </div>
      )}

      <div className={`${embedded ? 'w-full' : 'max-w-6xl mx-auto px-4 py-10'}`}>
        <div style={{ marginBottom: '24px' }}>

          {/*
            scrollWrapperRef: div duy nhất có overflow-x: auto
            Tất cả nội dung bên trong đều có width cố định = totalW
            → scroll ngang đồng bộ giữa header và body
          */}
          <div
            ref={scrollWrapperRef}
            style={{
              overflowX: 'auto',
              overflowY: 'visible',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              // Không overflow:hidden ở đây để sticky/fixed không bị block
            }}
          >
            {/* Static Banner + Level header */}
            <div ref={staticBlockRef} style={{ borderRadius: '16px 16px 0 0', overflow: 'hidden' }}>
              <HeaderRow
                position={position}
                meta={meta}
                levels={levels}
                totalMinW={totalMinW}
                showBanner={true}
                levelColumnWidth={levelColumnWidth}
              />
            </div>

            {/* Body */}
            <div style={{
              backgroundColor: 'white',
              borderTop: 'none',
            }}>
              {DIMENSIONS.map(dim => (
                <SmartRow key={dim.id} dim={dim} levels={levels} levelColumnWidth={levelColumnWidth} />
              ))}
              <div ref={tableEndRef} style={{ height: 1 }} />
            </div>
          </div>

        </div>

        {!embedded && (
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Về trang chủ
          </Link>
        )}
      </div>
    </div>
  )
}
