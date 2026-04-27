import { Link } from 'react-router-dom'

export default function Header({ back, title }) {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-ink-faint/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        {back ? (
          <Link to="/" className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Trang chủ
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-7 h-7 rounded-md bg-brand-600 flex items-center justify-center text-white font-display font-bold text-sm">E</span>
            <span className="font-display font-semibold text-ink text-sm tracking-tight hidden sm:block">Eventus Việt Nam</span>
          </Link>
        )}
        {title && (
          <span className="text-ink-muted text-sm truncate">{title}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-ink-muted font-medium hidden sm:block">Khung năng lực v2.0</span>
          <span className="text-xs bg-brand-50 text-brand-600 border border-brand-200 px-2 py-0.5 rounded-full font-medium">2025</span>
        </div>
      </div>
    </header>
  )
}
