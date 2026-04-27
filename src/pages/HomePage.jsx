import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman:    { icon: '🎬' },
  editor:       { icon: '🎞️' },
  photographer: { icon: '📷' },
  account:      { icon: '🤝' },
  leader:       { icon: '🧭' },
  ketoan:       { icon: '📊' },
}

// Placeholder — anh điền nội dung vào competency.json sau
const PLACEHOLDER_POSITION = {
  id: 'ketoan',
  name: 'Kế toán',
  levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
  placeholder: true,
}

function PositionNode({ position }) {
  const navigate = useNavigate()
  const meta = POSITION_META[position.id] || POSITION_META.leader

  return (
    <button
      onClick={() => !position.placeholder && navigate(`/position/${position.id}`)}
      className={`group w-full text-left bg-white rounded-2xl shadow-sm px-5 py-4 border border-slate-200 transition-all duration-200
        ${position.placeholder
          ? 'opacity-50 cursor-default'
          : 'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="text-[14px] font-bold text-slate-800">{position.name}</div>
      </div>

      <div className="flex items-center gap-1 mb-0">
        {position.levels.map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full bg-blue-500"
            style={{ opacity: 0.15 + i * 0.17 }}
          />
        ))}
      </div>

      {!position.placeholder && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400 group-hover:text-blue-700 transition-colors">
          Xem khung năng lực
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

export default function HomePage() {
  const positions = [...data.competency_framework.positions, PLACEHOLDER_POSITION]

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />

      <div className="flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full px-4 py-6">

        {/* Header block */}
        <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg px-8 py-5 text-white mb-5 flex-shrink-0">
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-1">
            Eventus Production Competency Framework
          </p>
          <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight">
            Khung năng lực nội bộ
          </h1>
        </div>

        {/* 3×2 flat grid — auto rows to fit content */}
        <div className="grid grid-cols-3 gap-4" style={{ gridTemplateRows: 'auto auto' }}>
          {positions.map(position => (
            <PositionNode key={position.id} position={position} />
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 tracking-wide mt-4 flex-shrink-0">
          Cập nhật nội dung tại{' '}
          <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
            src/data/competency.json
          </code>
          <span className="mx-3 text-slate-200">|</span>
          Eventus Production · Built by Phạm Thanh Bình · 2026
        </p>
      </div>
    </div>
  )
}
