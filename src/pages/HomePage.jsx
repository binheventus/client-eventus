import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬', accent: 'blue' },
  editor:       { icon: '🎞️', accent: 'blue' },
  photographer: { icon: '📷', accent: 'blue' },
  account:      { icon: '🤝', accent: 'blue' },
  leader:       { icon: '🧭', accent: 'blue' },
}

const DEPT_GROUPS = [
  {
    id: 'sanxuat',
    label: 'Sản xuất',
    positions: ['cameraman', 'editor', 'photographer'],
    cols: 'grid-cols-1 sm:grid-cols-3',
  },
  {
    id: 'kinhdoanh',
    label: 'Kinh doanh',
    positions: ['account'],
    cols: 'grid-cols-1',
  },
  {
    id: 'vanhanh',
    label: 'Vận hành',
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
      className="group w-full text-left bg-white rounded-2xl shadow-sm p-6 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{meta.icon}</span>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
          {position.levels.length} bậc
        </span>
      </div>

      <div className="text-[15px] font-bold text-slate-800 mb-3">{position.name}</div>

      <div className="flex items-center gap-1 mb-4">
        {position.levels.map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full bg-blue-500"
            style={{ opacity: 0.15 + i * 0.17 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-blue-700 transition-colors">
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
    <div className="bg-white rounded-2xl shadow-sm p-6 border border-slate-200">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-lg font-bold text-slate-800">{group.label}</span>
        <div className="h-px flex-1 bg-slate-100" />
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Header block */}
        <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg p-8 text-white mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-blue-200 mb-2">
            Eventus Việt Nam · Internal
          </p>
          <h1 className="text-[22px] md:text-[26px] font-medium tracking-tight mb-2">
            Khung năng lực nội bộ
          </h1>
          <p className="text-sm text-blue-100 max-w-md">
            Định nghĩa kỳ vọng theo từng vị trí và cấp bậc — dùng cho đánh giá, thăng cấp và phát triển cá nhân.
          </p>

          <div className="flex gap-8 mt-6 pt-6 border-t border-white/20">
            {[
              { num: positions.length, label: 'Vị trí' },
              { num: totalLevels,      label: 'Cấp bậc' },
              { num: 5,                label: 'Nhóm năng lực' },
            ].map((s, i) => (
              <div key={i}>
                <div className="text-2xl font-bold">{s.num}</div>
                <div className="text-xs text-blue-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Visual map */}
        <div className="flex flex-col gap-4 mb-6">
          <DeptGroup group={DEPT_GROUPS[0]} positions={positions} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DeptGroup group={DEPT_GROUPS[1]} positions={positions} />
            <DeptGroup group={DEPT_GROUPS[2]} positions={positions} />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 tracking-wide">
          Cập nhật nội dung tại{' '}
          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            src/data/competency.json
          </code>
          {' '}· v{data.competency_framework.version} · {data.competency_framework.last_updated}
        </p>
      </div>
    </div>
  )
}
