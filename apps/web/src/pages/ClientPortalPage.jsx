import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Database,
  FileSignature,
  MessageSquareText,
} from 'lucide-react'

const PORTAL_ITEMS = [
  {
    id: 'quotes',
    label: 'Báo giá',
    desc: 'Tạo và quản lý báo giá dịch vụ',
    path: '/quotes',
    icon: BriefcaseBusiness,
    borderTone: 'border-l-[#f8981d]',
    iconTone: 'text-[#d97706] bg-orange-50',
  },
  {
    id: 'contracts',
    label: 'Hợp đồng & chứng từ',
    desc: 'Quản lý hợp đồng và tài liệu liên quan',
    path: '/contracts',
    icon: FileSignature,
    borderTone: 'border-l-blue-500',
    iconTone: 'text-blue-700 bg-blue-50',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    desc: 'Theo dõi phản hồi và job cần xử lý',
    path: '/feedbacks',
    icon: MessageSquareText,
    borderTone: 'border-l-emerald-500',
    iconTone: 'text-emerald-700 bg-emerald-50',
  },
  {
    id: 'pricing',
    label: 'Bảng giá & cấu hình',
    desc: 'Cập nhật pricing và thiết lập dữ liệu',
    path: '/pricing-admin',
    icon: Database,
    borderTone: 'border-l-slate-700',
    iconTone: 'text-slate-700 bg-slate-100',
  },
]

function PortalTile({ item }) {
  const Icon = item.icon

  return (
    <Link
      to={item.path}
      aria-label={item.label}
      className={`group flex min-h-[110px] min-w-0 items-center gap-4 rounded-lg border border-l-4 border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 ${item.borderTone}`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${item.iconTone}`}>
        <Icon className="h-[22px] w-[22px]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[20px] font-semibold leading-6 text-slate-950">
          {item.label}
        </span>
        <span className="mt-1 block text-[13px] font-medium leading-5 text-slate-500">
          {item.desc}
        </span>
      </span>

      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition group-hover:border-orange-200 group-hover:bg-orange-50 group-hover:text-[#d97706]">
        <ArrowUpRight className="h-4 w-4" />
      </span>
    </Link>
  )
}

export default function ClientPortalPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#d97706]">
              Eventus Dashboard
            </p>
            <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight text-slate-950 sm:text-[30px]">
              Eventus Client Portal
            </h1>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-500 ring-1 ring-slate-200">
            4 chức năng chính
          </span>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          {PORTAL_ITEMS.map(item => (
            <PortalTile key={item.id} item={item} />
          ))}
        </section>
      </main>
    </div>
  )
}
