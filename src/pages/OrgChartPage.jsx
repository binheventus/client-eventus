import orgChart from '../data/orgChart.json'

function getInitials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')
}

function getSeniorityClasses(seniority = 'Senior') {
  if (seniority === 'Intern') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (seniority === 'Junior') return 'border-sky-200 bg-sky-50 text-sky-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function SeniorityBadge({ seniority = 'Senior' }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getSeniorityClasses(seniority)}`}>
      {seniority}
    </span>
  )
}

function PersonToken({ name, title, tone = 'default', seniority = 'Senior', showSeniority = true }) {
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
          {showSeniority && (
            <div className="mt-1">
              <SeniorityBadge seniority={seniority} />
            </div>
          )}
          {title && <div className="mt-1 text-[12px] leading-5 text-slate-500">{title}</div>}
        </div>
      </div>
    </div>
  )
}

function CompactPersonToken({ name, title, seniority = 'Senior', showSeniority = true, narrow = false }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className={`flex ${narrow ? 'h-7 w-7 text-[9px]' : 'h-8 w-8 text-[10px]'} flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 via-blue-900 to-teal-700 font-semibold text-white`}>
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <div className={`${narrow ? 'text-[11px] leading-4' : 'text-[12px] leading-5'} text-slate-900 font-semibold`}>{name}</div>
          {showSeniority && (
            <div className="mt-1">
              <SeniorityBadge seniority={seniority} />
            </div>
          )}
          {title && <div className={`${narrow ? 'text-[9px]' : 'text-[10px]'} mt-0.5 leading-4 text-slate-500`}>{title}</div>}
        </div>
      </div>
    </div>
  )
}

function countMembers(department) {
  return 1 + department.subteams.reduce((total, subteam) => total + subteam.members.length, 0)
}

function getOverviewSubteams(department) {
  if (department.id === 'video-cam-op') {
    return [...department.subteams].sort((a, b) => a.members.length - b.members.length)
  }
  return department.subteams
}

function DepartmentOverviewCard({ department }) {
  const shouldShowMembersInline = department.id === 'account'
  const inlineMembers = shouldShowMembersInline
    ? department.subteams.flatMap((subteam) => subteam.members)
    : []
  const overviewSubteams = getOverviewSubteams(department)

  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mt-2 text-[20px] font-semibold tracking-tight text-slate-900">{department.name}</h3>
      <div className="mt-2 text-[12px] text-slate-500">{countMembers(department)} thành viên</div>
      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-500">Lead</div>
        <div className="mt-1 text-[15px] font-semibold text-slate-900">{department.leader.name}</div>
        <div className="mt-1 text-[12px] text-slate-500">{department.leader.title}</div>
      </div>
      {!shouldShowMembersInline && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          {department.id === 'photography' ? (
            <div className="text-[13px] font-medium text-slate-700">{department.subteams[0]?.members.length || 0} Others Team Member</div>
          ) : department.id === 'accountant' ? (
            <div className="text-[13px] font-medium text-slate-700">4 Others Team Member</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {overviewSubteams.map((subteam) => (
                <span
                  key={`${department.id}-${subteam.id}`}
                  className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700"
                >
                  {subteam.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {shouldShowMembersInline && (
        <div className="mt-4 grid gap-3">
            {inlineMembers.map((member, index) => (
              <PersonToken
                key={`${department.id}-inline-${member.name}-${index}`}
                name={member.name}
                title={member.title}
                seniority={member.seniority}
                showSeniority={false}
              />
            ))}
        </div>
      )}
    </div>
  )
}

function DepartmentCard({ department, compact = false }) {
  const getMemberGridClass = (subteam) => {
    const isWideSingleColumn = ['flycam-operator', 'account-members'].includes(subteam.id)
    if (isWideSingleColumn) return 'grid gap-2'
    if (compact) return 'grid gap-2 sm:grid-cols-2 xl:grid-cols-2'
    return 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
  }
  const subteamLayoutClass = department.id === 'video-cam-op' ? 'grid gap-5 xl:grid-cols-10' : 'space-y-5'

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="mb-6 border-b border-slate-100 pb-5">
        <h2 className={`${compact ? 'text-[20px]' : 'text-[22px]'} font-semibold tracking-tight text-slate-900`}>{department.name}</h2>
      </div>

      <div className="mb-6">
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">Lead</div>
        <PersonToken
          name={department.leader.name}
          title={department.leader.title}
          tone="leader"
          seniority={department.leader.seniority}
        />
      </div>

      <div className={subteamLayoutClass}>
        {department.subteams.map((subteam) => {
          const subteamWidthClass = department.id === 'video-cam-op'
            ? subteam.id === 'video-editor'
              ? 'xl:col-span-4'
              : subteam.id === 'camera-operator'
                ? 'xl:col-span-4'
                : 'xl:col-span-2'
            : department.id === 'photography'
              ? 'xl:col-span-2'
              : department.id === 'account'
                ? 'xl:col-span-1'
                : ''

          return (
          <div key={subteam.id} className={`rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 md:p-5 ${subteamWidthClass}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">{subteam.name}</h3>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {subteam.members.length} người
              </div>
            </div>
            <div className={getMemberGridClass(subteam)}>
              {subteam.members.map((member, index) => (
                <CompactPersonToken
                  key={`${subteam.id}-${member.name}-${index}`}
                  name={member.name}
                  title={member.title}
                  seniority={member.seniority}
                  narrow={['flycam-operator', 'account-members'].includes(subteam.id)}
                />
              ))}
            </div>
          </div>
        )})}
      </div>
    </section>
  )
}

export default function OrgChartPage() {
  const videoDepartment = orgChart.departments.find((department) => department.id === 'video-cam-op')
  const lowerDepartments = orgChart.departments
    .filter((department) => department.id !== 'video-cam-op')
    .sort((a, b) => {
      const order = ['photography', 'accountant', 'account']
      return order.indexOf(a.id) - order.indexOf(b.id)
    })

  return (
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
      <div className="mx-auto max-w-[1440px] space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-4 text-white md:px-8 md:py-5">
            <h1 className="text-[26px] font-semibold tracking-tight md:text-[32px]">Sơ đồ tổ chức</h1>
            <p className="mt-2 max-w-none text-[12px] leading-6 text-blue-100/90">
              Eventus là nơi quy tụ những con người đa dạng, mang đến nhiều kỹ năng và nhiều góc nhìn. Chúng tôi trân trọng từng cá nhân, xem mỗi người như một mảnh ghép quan trọng giúp xây dựng lên sức mạnh tập thể. Với niềm tin rằng mọi ý tưởng đều có giá trị, chúng tôi khuyến khích bạn tỏa sáng theo phong cách riêng, đồng thời tạo điều kiện để học hỏi và thử thách bản thân qua các dự án đa dạng.
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-5 text-center">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Executive</div>
          </div>
          <div className="mx-auto max-w-md">
            <PersonToken
              name={orgChart.executive.name}
              title={orgChart.executive.title}
              tone="leader"
              seniority={orgChart.executive.seniority}
            />
          </div>

          <div className="mt-6 hidden h-12 items-center justify-center md:flex">
            <div className="h-full w-px bg-slate-200" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2 2xl:grid-cols-4">
            {orgChart.departments.map((department) => (
              <DepartmentOverviewCard key={`${department.id}-overview`} department={department} />
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="mb-6">
            <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Chi tiết theo team</div>
            <h2 className="mt-2 text-[26px] font-semibold tracking-tight text-slate-900">Danh sách nhân sự</h2>
          </div>

          <div className="space-y-5">
            {videoDepartment && (
              <DepartmentCard department={videoDepartment} compact />
            )}

            <div className="grid gap-5 xl:grid-cols-10">
              {lowerDepartments.map((department) => {
                const widthClass = department.id === 'photography' ? 'xl:col-span-4' : department.id === 'accountant' ? 'xl:col-span-4' : 'xl:col-span-2'
                return (
                  <div key={department.id} className={widthClass}>
                    <DepartmentCard department={department} compact />
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
