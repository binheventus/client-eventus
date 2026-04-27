import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬', accent: 'from-orange-500 to-amber-400',   badge: 'bg-orange-50 text-orange-700 border-orange-200',   bar: 'bg-orange-400',  ring: 'hover:ring-orange-300' },
  editor:       { icon: '🎞️', accent: 'from-violet-600 to-purple-400',  badge: 'bg-violet-50 text-violet-700 border-violet-200',   bar: 'bg-violet-400',  ring: 'hover:ring-violet-300' },
  photographer: { icon: '📷', accent: 'from-sky-600 to-cyan-400',       badge: 'bg-sky-50 text-sky-700 border-sky-200',            bar: 'bg-sky-400',     ring: 'hover:ring-sky-300' },
  account:      { icon: '🤝', accent: 'from-emerald-600 to-teal-400',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-400', ring: 'hover:ring-emerald-300' },
  leader:       { icon: '🧭', accent: 'from-amber-600 to-yellow-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',      bar: 'bg-amber-400',   ring: 'hover:ring-amber-300' },
  ketoan:       { icon: '📊', accent: 'from-rose-500 to-pink-400',      badge: 'bg-rose-50 text-rose-700 border-rose-200',         bar: 'bg-rose-400',    ring: 'hover:ring-rose-300' },
}

// Placeholder position for Kế toán
const PLACEHOLDER_POSITION = {
  id: 'ketoan',
  name: 'Kế toán',
  mission: 'Đảm bảo tính chính xác, minh bạch và hiệu quả trong quản lý tài chính công ty',
  levels: [
    { level: 1, label: 'Nhân viên Kế toán' },
    { level: 2, label: 'Chuyên viên Kế toán' },
    { level: 3, label: 'Kế toán Trưởng' },
  ],
  placeholder: true,
}

function PositionCard({ position }) {
  const navigate = useNavigate()
  const meta = POSITION_META[position.id] || POSITION_META.leader

  return (
    <button
      onClick={() => !position.placeholder && navigate(`/position/${position.id}`)}
      className={`
        group relative w-full text-left bg-white rounded-2xl border border-slate-200/80
        shadow-sm overflow-hidden transition-all duration-200
        ring-2 ring-transparent ${meta.ring}
        ${position.placeholder
          ? 'opacity-60 cursor-default'
          : 'hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'}
      `}
    >
      {/* Gradient top bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${meta.accent}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.accent} flex items-center justify-center text-xl shadow-sm`}>
            {meta.icon}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.badge}`}>
            {position.levels.length} bậc
          </span>
        </div>

        {/* Name */}
        <div className="text-[13px] font-bold text-slate-800 mb-1 leading-tight">
          {position.name}
        </div>

        {/* Mission */}
        {position.mission && (
          <p className="text-[11px] text-slate-400 leading-relaxed mb-3 line-clamp-2">
            {position.mission}
          </p>
        )}

        {/* Level pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {position.levels.map((lv, i) => (
            <span
              key={i}
              className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md"
            >
              {lv.label}
            </span>
          ))}
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1">
          {position.levels.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${meta.bar}`}
              style={{ opacity: 0.2 + i * (0.8 / (position.levels.length - 1 || 1)) }}
            />
          ))}
        </div>

        {/* CTA */}
        {!position.placeholder && (
          <div className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-slate-700 transition-colors">
            Xem khung năng lực
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        {position.placeholder && (
          <div className="mt-3 text-[10px] font-medium text-slate-300 italic">
            Đang cập nhật nội dung...
          </div>
        )}
      </div>
    </button>
  )
}

export default function HomePage() {
  const positions = [...data.competency_framework.positions, PLACEHOLDER_POSITION]
  const totalLevels = data.competency_framework.positions.reduce((sum, p) => sum + p.levels.length, 0)
  const totalPositions = positions.length

  const STATS = [
    { num: data.competency_framework.positions.length, label: 'Vị trí' },
    { num: totalLevels, label: 'Cấp bậc' },
    { num: 5, label: 'Nhóm NL' },
  ]

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <Header />

      {/* Main layout: sidebar + grid */}
      <div className="flex flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 py-4 gap-4">

        {/* Left: Brand panel */}
        <div className="w-56 flex-shrink-0 flex flex-col gap-3">

          {/* Hero card */}
          <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-teal-600 rounded-2xl p-5 text-white flex-shrink-0 shadow-lg shadow-blue-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-sm font-black">E</div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-blue-200 uppercase">Eventus VN</div>
              </div>
            </div>
            <h1 className="text-[15px] font-bold leading-snug mb-1">
              Khung năng lực nội bộ
            </h1>
            <p className="text-[11px] text-blue-200 leading-relaxed">
              Đánh giá · Thăng cấp · Phát triển cá nhân
            </p>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex-shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tổng quan</div>
            <div className="space-y-3">
              {STATS.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">{s.label}</span>
                  <span className="text-[16px] font-black text-slate-800 tabular-nums">{s.num}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dimensions legend */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex-1 min-h-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">5 Nhóm năng lực</div>
            <div className="space-y-2">
              {[
                { icon: '⚙️', label: 'Chuyên môn', color: 'text-blue-600' },
                { icon: '💡', label: 'Nghiên cứu & Sáng tạo', color: 'text-violet-600' },
                { icon: '✅', label: 'Trách nhiệm', color: 'text-emerald-600' },
                { icon: '⚡', label: 'Xử lý tình huống', color: 'text-amber-600' },
                { icon: '🤝', label: 'Làm việc với KH', color: 'text-rose-600' },
              ].map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm">{d.icon}</span>
                  <span className={`text-[11px] font-medium ${d.color}`}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Version */}
          <div className="text-center text-[10px] text-slate-300 flex-shrink-0">
            v{data.competency_framework.version} · {data.competency_framework.last_updated}
          </div>
        </div>

        {/* Right: 3×2 position grid */}
        <div className="flex-1 min-w-0 grid grid-cols-3 grid-rows-2 gap-3">
          {positions.map(position => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      </div>
    </div>
  )
}
