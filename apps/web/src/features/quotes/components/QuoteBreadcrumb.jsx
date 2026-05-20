import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export default function QuoteBreadcrumb({ items = [] }) {
  const crumbs = [
    { label: 'Báo giá', to: '/quotes' },
    ...items,
  ].filter(item => item?.label)

  if (!crumbs.length) return null

  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-slate-500">
      {crumbs.map((item, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <div key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" /> : null}
            {item.to && !isLast ? (
              <Link to={item.to} className="rounded-lg px-1 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                {item.label}
              </Link>
            ) : (
              <span className="rounded-lg px-1 py-0.5 text-slate-900" aria-current={isLast ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </div>
        )
      })}
    </nav>
  )
}
