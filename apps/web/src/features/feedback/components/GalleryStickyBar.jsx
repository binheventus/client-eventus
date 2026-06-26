import { Link } from 'react-router-dom'

// Compact gallery header: always available from the first viewport and keeps
// the two primary actions close without spending hero-banner height.
export default function GalleryStickyBar({ jobTitle, metaText, driveLink, surveyLink, hidden, downloadLabel = 'Tải toàn bộ ảnh' }) {
  const metaItems = String(metaText || '')
    .split(' · ')
    .map(item => item.trim())
    .filter(Boolean)

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 border-b border-[#e5e9f1] bg-white/95 shadow-[0_10px_28px_rgba(31,45,61,0.08)] backdrop-blur-sm transition-transform duration-300 ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2 px-3 py-2.5 sm:px-4 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img src="/logos/logo_eventus.png" alt="Eventus Production" className="h-auto w-[82px] shrink-0 sm:w-[112px]" />
          <div className="min-w-0 border-l border-[#e5e9f1] pl-3">
            <p className="text-[11px] font-extrabold uppercase leading-tight text-[#f79820]">
              Bạn đang xem bộ ảnh
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 max-w-full truncate text-[13px] font-extrabold leading-tight text-[#202b3c] sm:text-[15px]">
                {jobTitle}
              </span>
              {metaItems.map(item => (
                <span
                  key={item}
                  className="inline-flex min-h-6 items-center rounded-full bg-[#f1f3f7] px-2 text-[11px] font-bold leading-none text-[#7a8597] ring-1 ring-[#e5e9f1]"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid w-full shrink-0 grid-cols-2 items-center gap-2 lg:flex lg:w-auto">
          {driveLink && (
            <a
              href={driveLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-[#f79820]/40 bg-white px-2 text-[11px] font-extrabold text-[#d97706] transition hover:bg-[#fff7ed] sm:px-3 sm:text-[12px]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h6v6" />
                <path d="M10 14 21 3" />
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              </svg>
              <span className="truncate">{downloadLabel}</span>
            </a>
          )}
          {surveyLink && (
            <Link
              to={surveyLink}
              className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#f79820] px-2 text-[11px] font-extrabold text-white shadow-[0_6px_14px_rgba(247,152,32,0.22)] transition hover:bg-[#d97706] sm:px-3 sm:text-[12px]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="truncate">Phản hồi về trải nghiệm tại Eventus</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
