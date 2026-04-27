import { Link } from 'react-router-dom'

export default function Header({ back, title, tab, setTab }) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 flex-shrink-0">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">

        {/* Logo / back */}
        {back ? (
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-700 transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Trang chủ
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-700 to-teal-600 flex items-center justify-center text-white font-bold text-sm">E</span>
            <span className="font-bold text-slate-800 text-sm hidden sm:block">Eventus Production</span>
          </Link>
        )}

        {/* Tab navigation — chỉ hiện ở dashboard */}
        {setTab && (
          <nav className="flex items-center gap-1 ml-4">
            <button
              onClick={() => setTab('competency')}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors
                ${tab === 'competency'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              🏆 Khung năng lực
            </button>
            <button
              onClick={() => setTab('wiki')}
              className={`text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-colors
                ${tab === 'wiki'
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              📚 Internal Wiki
            </button>
          </nav>
        )}

        {title && (
          <span className="text-slate-400 text-sm truncate">{title}</span>
        )}
      </div>
    </header>
  )
}
