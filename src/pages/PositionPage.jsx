import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import CompetencyPanel from '../components/CompetencyPanel'
import data from '../data/competency.json'

const POSITION_META = {
  cameraman: { icon: '🎬', accent: 'border-orange-400 text-orange-700 bg-orange-50', dot: 'bg-orange-400' },
  editor:    { icon: '🎞️', accent: 'border-violet-400 text-violet-700 bg-violet-50', dot: 'bg-violet-400' },
  photographer: { icon: '📷', accent: 'border-sky-400 text-sky-700 bg-sky-50', dot: 'bg-sky-400' },
  account:   { icon: '🤝', accent: 'border-emerald-400 text-emerald-700 bg-emerald-50', dot: 'bg-emerald-400' },
  leader:    { icon: '🧭', accent: 'border-amber-400 text-amber-700 bg-amber-50', dot: 'bg-amber-400' },
}

export default function PositionPage() {
  const { positionId } = useParams()
  const framework = data.competency_framework
  const position = framework.positions.find(p => p.id === positionId)

  const [activeLevel, setActiveLevel] = useState(0)

  if (!position) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4">
        <p className="text-ink-muted">Không tìm thấy vị trí này.</p>
        <Link to="/" className="text-brand-600 font-medium text-sm hover:underline">← Về trang chủ</Link>
      </div>
    )
  }

  const meta = POSITION_META[position.id] || POSITION_META.leader
  const currentLevel = position.levels[activeLevel]

  return (
    <div className="min-h-screen bg-surface">
      <Header back title={position.name} />

      {/* Position hero */}
      <div className="bg-white border-b border-ink-faint/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex items-start gap-4">
            <span className="text-4xl">{meta.icon}</span>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">{position.name}</h1>
              {position.mission && (
                <p className="text-ink-soft text-sm sm:text-base mt-2 max-w-xl leading-relaxed italic">
                  "{position.mission}"
                </p>
              )}
            </div>
          </div>

          {/* Level tabs — scrollable on mobile */}
          <div className="mt-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
            <div className="flex gap-2 pb-1 min-w-max sm:min-w-0 sm:flex-wrap">
              {position.levels.map((lv, idx) => (
                <button
                  key={lv.level}
                  onClick={() => setActiveLevel(idx)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border-2 transition-all whitespace-nowrap ${
                    activeLevel === idx
                      ? `${meta.accent} border-current`
                      : 'border-ink-faint/30 text-ink-muted bg-white hover:border-ink-muted hover:text-ink'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${activeLevel === idx ? meta.dot : 'bg-ink-faint'}`} />
                  <span>{lv.label}</span>
                  <span className="font-normal opacity-70 hidden sm:inline">· {lv.label_short || lv.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Level content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Level header */}
        <div className="flex items-center gap-3 mb-6">
          <div className={`w-1 h-8 rounded-full ${meta.dot}`} />
          <div>
            <div className="text-xs text-ink-muted font-medium uppercase tracking-wider">{currentLevel.label}</div>
            <div className="font-display font-semibold text-xl text-ink">{currentLevel.label}</div>
          </div>
        </div>

        {/* Competency groups */}
        <CompetencyPanel
          competencies={currentLevel.competencies}
          dimensions={framework.competency_dimensions}
        />

        {/* Navigation between levels */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t border-ink-faint/20">
          <button
            onClick={() => setActiveLevel(i => Math.max(0, i - 1))}
            disabled={activeLevel === 0}
            className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Cấp bậc trước
          </button>

          <span className="text-xs text-ink-muted">
            {activeLevel + 1} / {position.levels.length}
          </span>

          <button
            onClick={() => setActiveLevel(i => Math.min(position.levels.length - 1, i + 1))}
            disabled={activeLevel === position.levels.length - 1}
            className="flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Cấp bậc sau
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
