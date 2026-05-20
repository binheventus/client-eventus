import { Link } from 'react-router-dom'

const POSITION_META = {
  cameraman: {
    icon: '🎬',
    color: 'bg-orange-50 border-orange-200 hover:border-orange-400',
    badge: 'bg-orange-100 text-orange-700',
    accent: 'text-orange-600',
  },
  editor: {
    icon: '🎞️',
    color: 'bg-violet-50 border-violet-200 hover:border-violet-400',
    badge: 'bg-violet-100 text-violet-700',
    accent: 'text-violet-600',
  },
  photographer: {
    icon: '📷',
    color: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    badge: 'bg-sky-100 text-sky-700',
    accent: 'text-sky-600',
  },
  account: {
    icon: '🤝',
    color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    accent: 'text-emerald-600',
  },
  leader: {
    icon: '🧭',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    accent: 'text-amber-600',
  },
}

export default function PositionCard({ position }) {
  const meta = POSITION_META[position.id] || POSITION_META.leader
  const levelCount = position.levels.length

  return (
    <Link
      to={`/position/${position.id}`}
      className={`group block rounded-2xl border-2 p-5 transition-all duration-200 ${meta.color} hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{meta.icon}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
          {levelCount} cấp bậc
        </span>
      </div>

      <h3 className="font-display font-semibold text-lg text-ink mb-1">{position.name}</h3>

      {position.mission && (
        <p className="text-sm text-ink-soft leading-relaxed line-clamp-3 mb-4">
          {position.mission}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {position.levels.map((lv) => (
          <span key={lv.level} className="text-xs bg-white/70 text-ink-soft px-2 py-0.5 rounded-full border border-current/10">
            {lv.label}
          </span>
        ))}
      </div>

      <div className={`flex items-center gap-1 text-sm font-medium ${meta.accent}`}>
        Xem chi tiết
        <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
