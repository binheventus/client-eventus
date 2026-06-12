import { useNavigate } from 'react-router-dom'

const MODULES = [
  {
    id: 'quotes',
    label: 'Báo giá',
    icon: '💼',
    shortDesc: 'Tạo, quản lý và chia sẻ báo giá dịch vụ',
    desc: 'Module tạo báo giá tự động cho sales Eventus.',
    path: '/quotes',
    accent: 'from-slate-900 via-blue-900 to-teal-700',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: '💬',
    shortDesc: 'Quản lý feedback video, survey và gallery',
    desc: 'Module nhận góp ý chỉnh sửa video, theo dõi phản hồi khách hàng và khảo sát sau dịch vụ.',
    path: '/feedbacks',
    accent: 'from-slate-900 via-indigo-900 to-cyan-700',
  },
]

export default function ClientPortalPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8">
        <header className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="rounded-[28px] bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100/90">
              Eventus Dashboard
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Eventus Client Portal
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-blue-100/90">
              Truy cập nhanh các module đang dùng cho báo giá, hợp đồng và feedback khách hàng.
            </p>
          </div>
        </header>

        <section className="mt-6 grid flex-1 content-start gap-4 md:grid-cols-2">
          {MODULES.map((module) => (
            <button
              key={module.id}
              type="button"
              onClick={() => navigate(module.path)}
              className="group overflow-hidden rounded-[24px] border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className={`bg-gradient-to-r ${module.accent} px-5 py-5 text-white`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/12 text-2xl ring-1 ring-white/15">
                      {module.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{module.label}</h2>
                      <p className="mt-1 text-xs leading-5 text-white/75">{module.shortDesc}</p>
                    </div>
                  </div>
                  <span className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/75 transition group-hover:translate-x-0.5 group-hover:bg-white/15 group-hover:text-white">
                    →
                  </span>
                </div>
              </div>

              <div className="px-5 py-5">
                <p className="text-sm leading-6 text-slate-600">{module.desc}</p>
                <div className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                  Mở {module.path}
                </div>
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  )
}
