import orgChart from '../data/orgChart.json'

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
}

function PersonToken({ name, title, tone = 'default' }) {
  const toneClasses = tone === 'leader'
    ? 'border-blue-200 bg-blue-50'
    : 'border-slate-200 bg-white'

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${toneClasses}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-teal-700 text-[13px] font-semibold text-white">
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <div className="break-words text-[14px] font-semibold leading-5 text-slate-900">{name}</div>
          {title && <div className="mt-1 text-[12px] leading-5 text-slate-500">{title}</div>}
        </div>
      </div>
    </div>
  )
}

function DepartmentCard({ department }) {
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Department</div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-900">{department.name}</h2>
        </div>
        <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 md:inline-flex">
          {department.subteams.length} nhóm
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">Lead</div>
        <PersonToken name={department.leader.name} title={department.leader.title} tone="leader" />
      </div>

      <div className="space-y-5">
        {department.subteams.map((subteam) => (
          <div key={subteam.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[16px] font-semibold text-slate-900">{subteam.name}</h3>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {subteam.members.length} người
              </div>
            </div>
            <div className="grid gap-3">
              {subteam.members.map((member, index) => (
                <PersonToken
                  key={`${subteam.id}-${member.name}-${index}`}
                  name={member.name}
                  title={member.title}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function OrgChartPage() {
  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-6 text-white md:px-8 md:py-7">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-blue-100">Eventus Production</div>
            <h1 className="mt-2 text-[30px] font-semibold tracking-tight md:text-[36px]">Sơ đồ tổ chức</h1>
            <p className="mt-3 max-w-3xl text-[14px] leading-7 text-blue-100/90">
              Tổng quan cơ cấu nhân sự theo team và vai trò tại Eventus. Dữ liệu được tổ chức để dễ cập nhật trực tiếp qua GitHub.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-5 text-center">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive</div>
          </div>
          <div className="mx-auto max-w-md">
            <PersonToken name={orgChart.executive.name} title={orgChart.executive.title} tone="leader" />
          </div>

          <div className="mt-6 hidden h-12 items-center justify-center md:flex">
            <div className="h-full w-px bg-slate-200" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {orgChart.departments.map((department) => (
              <DepartmentCard key={department.id} department={department} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
