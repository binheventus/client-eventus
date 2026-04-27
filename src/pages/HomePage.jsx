import { useState } from 'react'
import Header from '../components/Header'
import PositionCard from '../components/PositionCard'
import data from '../data/competency.json'

const DEPARTMENTS = ['Tất cả', 'Sản xuất', 'Account', 'Leader']

const DEPT_MAP = {
  cameraman: 'Sản xuất',
  editor: 'Sản xuất',
  photographer: 'Sản xuất',
  account: 'Account',
  leader: 'Leader',
}

export default function HomePage() {
  const [activeDept, setActiveDept] = useState('Tất cả')
  const positions = data.competency_framework.positions

  const filtered = activeDept === 'Tất cả'
    ? positions
    : positions.filter(p => DEPT_MAP[p.id] === activeDept)

  const totalLevels = positions.reduce((sum, p) => sum + p.levels.length, 0)

  return (
    <div className="min-h-screen bg-surface">
      <Header />

      {/* Hero */}
      <div className="bg-white border-b border-ink-faint/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-widest mb-3">
              Eventus Việt Nam · Internal
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight mb-4">
              Khung năng lực<br />
              <span className="text-ink-muted font-normal italic">nội bộ công ty</span>
            </h1>
            <p className="text-ink-soft text-base leading-relaxed">
              Tài liệu định nghĩa kỳ vọng năng lực theo từng vị trí và cấp bậc — dùng cho đánh giá, thăng cấp và phát triển cá nhân.
            </p>
          </div>

          <div className="flex gap-6 mt-8 pt-8 border-t border-ink-faint/20">
            <div>
              <div className="text-2xl font-display font-bold text-ink">{positions.length}</div>
              <div className="text-xs text-ink-muted mt-0.5">Vị trí</div>
            </div>
            <div className="w-px bg-ink-faint/30" />
            <div>
              <div className="text-2xl font-display font-bold text-ink">{totalLevels}</div>
              <div className="text-xs text-ink-muted mt-0.5">Cấp bậc</div>
            </div>
            <div className="w-px bg-ink-faint/30" />
            <div>
              <div className="text-2xl font-display font-bold text-ink">5</div>
              <div className="text-xs text-ink-muted mt-0.5">Nhóm năng lực</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter + Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Filter bar */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {DEPARTMENTS.map(dept => (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                activeDept === dept
                  ? 'bg-ink text-white border-ink'
                  : 'bg-white text-ink-soft border-ink-faint hover:border-ink-muted hover:text-ink'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(position => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-ink-faint/20 text-center">
          <p className="text-xs text-ink-muted">
            Nội dung được cập nhật tại <code className="bg-surface-warm px-1.5 py-0.5 rounded text-ink-soft font-mono">src/data/competency.json</code> · v{data.competency_framework.version} · {data.competency_framework.last_updated}
          </p>
        </div>
      </div>
    </div>
  )
}
