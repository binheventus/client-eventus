import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬', color: 'hover:border-orange-400 hover:bg-orange-50', dot: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700' },
  editor:       { icon: '🎞️', color: 'hover:border-violet-400 hover:bg-violet-50', dot: 'bg-violet-400', badge: 'bg-violet-100 text-violet-700' },
  photographer: { icon: '📷', color: 'hover:border-sky-400 hover:bg-sky-50',       dot: 'bg-sky-400',    badge: 'bg-sky-100 text-sky-700' },
  account:      { icon: '🤝', color: 'hover:border-emerald-400 hover:bg-emerald-50', dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  leader:       { icon: '🧭', color: 'hover:border-amber-400 hover:bg-amber-50',   dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700' },
}

const DEPT_GROUPS = [
  {
    id: 'sanxuat',
    label: 'Sản xuất',
    description: 'Quay phim · Dựng phim · Chụp ảnh',
    positions: ['cameraman', 'editor', 'photographer'],
    cols: 'grid-cols-1 sm:grid-cols-3',
  },
  {
    id: 'kinhdoanh',
    label: 'Kinh doanh',
    description: 'Quản lý khách hàng & doanh thu',
    positions: ['account'],
    cols: 'grid-cols-1',
  },
  {
    id: 'vanhanh',
    label: 'Vận hành',
    description: 'Quản lý & điều phối team',
    positions: ['leader'],
    cols: 'grid-cols-1',
  },
]

function PositionNode({ position }) {
  const navigate = useNavigate()
  const meta = POSITION_META[position.id]

  return (
    <button
      onClick={() => navigate(`/position/${position.id}`)}
      className={`group w-full text-left bg-white border-2 border-ink-faint/20 rounded-2xl p-5 transition-all duration-200 ${meta.color} hover:shadow-md hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{meta.icon}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.badge}`}>
          {position.levels.length} bậc
        </span>
      </div>

      <div className="font-display font-semibold text-base text-ink mb-3">{position.name}</div>

      <div className="flex items-center gap-1 mb-4">
        {position.levels.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${meta.dot}`}
            style={{ opacity: 0.2 + i * 0.2 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 text-xs font-medium text-ink-muted group-hover:text-ink transition-colors">
        Xem khung năng lực
        <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

function DeptGroup({ group, positions }) {
  const groupPositions = positions.filter(p => group.positions.includes(p.id))

  return (
    <div className="bg-surface-warm rounded-2xl p-5 border border-ink-faint/20">
      <div className="flex items-center gap-3 mb-4">
        <span className="font-display font-semibold text-ink">{group.label}</span>
        <div className="h-px flex-1 bg-ink-faint/30" />
        <span className="text-xs text-ink-muted">{group.description}</span>
      </div>
      <div className={`grid gap-3 ${group.cols}`}>
        {groupPositions.map(position => (
          <PositionNode key={position.id} position={position} />
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const positions = data.competency_framework.positions
  const totalLevels = positions.reduce((sum, p) => sum + p.levels.length, 0)

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Title + stats */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
          <div className="flex-1">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-2">
              Eventus Việt Nam · Internal
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight mb-3">
              Khung năng lực<br />
              <span className="text-ink-muted font-normal italic">nội bộ công ty</span>
            </h1>
            <p className="text-sm text-ink-soft leading-relaxed max-w-md">
              Định nghĩa kỳ vọng theo từng vị trí và cấp bậc — dùng cho đánh giá, thăng cấp và phát triển cá nhân.
            </p>
          </div>

          <div className="flex sm:flex-col gap-6 sm:gap-3 sm:text-right shrink-0">
            {[
              { num: positions.length, label: 'vị trí' },
              { num: totalLevels,      label: 'cấp bậc' },
              { num: 5,                label: 'nhóm năng lực' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl font-display font-bold text-ink">{s.num}</div>
                <div className="text-xs text-ink-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual map */}
        <div className="flex flex-col gap-4">
          <DeptGroup group={DEPT_GROUPS[0]} positions={positions} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DeptGroup group={DEPT_GROUPS[1]} positions={positions} />
            <DeptGroup group={DEPT_GROUPS[2]} positions={positions} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-ink-faint/20 text-center">
          <p className="text-xs text-ink-muted">
            Cập nhật nội dung tại{' '}
            <code className="bg-surface-warm px-1.5 py-0.5 rounded font-mono text-ink-soft">
              src/data/competency.json
            </code>
            {' '}· v{data.competency_framework.version} · {data.competency_framework.last_updated}
          </p>
        </div>
      </div>
    </div>
  )
}
