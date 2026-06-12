import { useEffect, useMemo, useState } from 'react'
import { MessageSquareText, RefreshCw, Search } from 'lucide-react'
import {
  getFeedbackSummary,
  listFeedbackJobs,
  listFeedbacks,
} from '../hooks/useFeedback'
import { getFeedbackPublicPath } from '../lib/feedbackFormat'

const ORANGE_BUTTON_CLASS = 'bg-[#f79820] text-white hover:bg-[#df861d]'

function formatJobDatePrefix(value) {
  if (!value) return ''
  const raw = String(value)
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}`

  const date = toDate(value)
  if (!date) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

function getJobTitleWithDate(job = {}, fallbackId, fallbackDate) {
  const prefix = formatJobDatePrefix(job.job_date || fallbackDate)
  const title = job.title || `Job #${fallbackId || job.id}`
  return prefix ? `${prefix} ${title}` : title
}

function formatStaffNames(names) {
  if (Array.isArray(names) && names.length) return names.filter(Boolean).join(', ')
  const text = String(names || '').trim()
  return text || '-'
}

function getFeedbackJob(feedback = {}) {
  return feedback.job || {}
}

function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDeadline(value) {
  const date = toDate(value)
  if (!date) return 'Chưa có deadline'
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${minute}`
}

function getDeadlineStatus(deadline, done = false) {
  if (done) return { label: 'Đã xong', className: 'bg-emerald-50 text-emerald-700' }
  const date = toDate(deadline)
  if (!date) return { label: 'Thiếu deadline', className: 'bg-slate-100 text-slate-500' }

  const now = Date.now()
  const delta = date.getTime() - now
  if (delta < 0) return { label: 'Quá hạn', className: 'bg-rose-50 text-rose-700' }
  if (delta <= 24 * 60 * 60 * 1000) return { label: 'Sắp quá hạn', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Trong hạn', className: 'bg-emerald-50 text-emerald-700' }
}

function DeadlineBadge({ deadline, done = false }) {
  const status = getDeadlineStatus(deadline, done)
  const hasDeadline = Boolean(toDate(deadline))

  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
        {status.label}
      </span>
      {hasDeadline ? (
        <div className="text-[12px] font-medium text-slate-500">{formatDeadline(deadline)}</div>
      ) : null}
    </div>
  )
}

function getOperationalStatus(feedback = {}) {
  if (feedback.done_feedback) {
    return {
      label: 'Đã hoàn tất',
      desc: 'Khách đã xác nhận xong',
      className: 'bg-emerald-50 text-emerald-700',
    }
  }

  if (!feedback.video_url) {
    return {
      label: 'Chờ gửi video',
      desc: '',
      className: 'bg-slate-100 text-slate-600',
    }
  }

  const unresolvedCount = Number(feedback.unresolved_comment_count || 0)
  const commentCount = Number(feedback.comment_count || 0)
  if (unresolvedCount > 0) {
    return {
      label: 'Cần xử lý feedback',
      desc: `${unresolvedCount.toLocaleString('vi-VN')} góp ý chưa tick xong`,
      className: 'bg-rose-50 text-rose-700',
    }
  }

  if (commentCount > 0) {
    return {
      label: 'Đã xử lý feedback',
      desc: 'Chờ xác nhận hoàn tất',
      className: 'bg-amber-50 text-amber-700',
    }
  }

  return {
    label: 'Chờ khách feedback',
    desc: 'Đã gửi video, chưa có góp ý',
    className: 'bg-blue-50 text-blue-700',
  }
}

function OperationalStatusBadge({ feedback }) {
  const status = getOperationalStatus(feedback)
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
        {status.label}
      </span>
      {status.desc ? (
        <div className="text-[12px] font-medium text-slate-500">{status.desc}</div>
      ) : null}
    </div>
  )
}

function StaffMeta({ record, feedback }) {
  const job = feedback ? getFeedbackJob(record) : record
  const editorName = feedback
    ? (record.editor_name || job.editor_name)
    : job.editor_name
  const reviewerNames = Array.isArray(job.video_reviewer_names)
    ? job.video_reviewer_names.filter(Boolean).join(', ')
    : String(job.video_reviewer_names || '').trim()

  return (
    <div className="mt-2 space-y-0.5 text-[12px] leading-5 text-slate-500">
      <div><span className="font-semibold text-slate-600">Nhân sự quay:</span> {formatStaffNames(job.camera_staff_names)}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        <span><span className="font-semibold text-slate-600">Video-Editor:</span> {editorName || '-'}</span>
        {feedback ? (
          <span>
            <span className="font-semibold text-slate-600">Người duyệt:</span>{' '}
            {reviewerNames ? reviewerNames : <span className="font-semibold text-rose-600">Chưa có</span>}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function formatSectionCount(value, loading = false) {
  if (loading) return '...'
  return Number(value || 0).toLocaleString('vi-VN')
}

function EmptyState({ title, desc }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-[13px] text-slate-500">{desc}</p>
    </div>
  )
}

function RiskItem({ item, badgeClassName = 'bg-rose-50 text-rose-700' }) {
  return (
    <div className="px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-slate-900">
            {getJobTitleWithDate(
              { title: item.job_title, job_date: item.job_date || item.event_date },
              item.job_id,
            )}
          </div>
          <div className="mt-1 text-[12px] text-slate-500">Deadline {formatDeadline(item.end_feedback)}</div>
          <div className="mt-1 text-[12px] text-slate-500">Video-Editor: {item.editor_name || '-'}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${badgeClassName}`}>
          {item.type === 'missing_feedback' ? 'Chưa tạo' : 'Đang mở'}
        </span>
      </div>
    </div>
  )
}

function RiskPanel({ title, desc, count, items = [], tone = 'rose', emptyText }) {
  const toneClass = {
    amber: {
      panel: 'border-amber-200 bg-white',
      title: 'text-[#d97706]',
      desc: 'text-amber-700',
      badge: 'bg-amber-50 text-amber-700',
      divider: 'divide-amber-100 border-amber-100',
    },
    rose: {
      panel: 'border-rose-200 bg-white',
      title: 'text-rose-700',
      desc: 'text-rose-700',
      badge: 'bg-rose-50 text-rose-700',
      divider: 'divide-rose-100 border-rose-100',
    },
  }[tone] || {}

  return (
    <div className={`rounded-lg border px-5 py-4 ${toneClass.panel}`}>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className={`text-[15px] font-semibold ${toneClass.title}`}>
            {title} ({formatSectionCount(count)})
          </h2>
          <p className={`mt-1 text-[12px] ${toneClass.desc}`}>{desc}</p>
        </div>
      </div>
      <div className={`mt-3 divide-y rounded-md border bg-white ${toneClass.divider}`}>
        {items.length ? (
          items.map(item => (
            <RiskItem
              key={`${item.type}-${item.feedback_id || item.job_id}`}
              item={item}
              badgeClassName={toneClass.badge}
            />
          ))
        ) : (
          <div className="px-3 py-4 text-[13px] font-semibold text-slate-400">{emptyText}</div>
        )}
      </div>
    </div>
  )
}

function JobRow({ job }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{getJobTitleWithDate(job, job.id)}</div>
        <StaffMeta record={job} />
      </td>
      <td className="px-4 py-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
          Chưa tạo
        </span>
      </td>
      <td className="px-4 py-3">
        <DeadlineBadge deadline={job.end_feedback} />
      </td>
    </tr>
  )
}

function RecentFeedbackRow({ feedback }) {
  const job = getFeedbackJob(feedback)
  const feedbackPath = getFeedbackPublicPath(feedback)

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <a
          href={feedbackPath}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#d97706] hover:text-[#c46a04]"
        >
          {getJobTitleWithDate(job, feedback.job_id, feedback.created_at)}
        </a>
        <StaffMeta record={feedback} feedback />
      </td>
      <td className="px-4 py-3">
        <OperationalStatusBadge feedback={feedback} />
      </td>
      <td className="px-4 py-3">
        <DeadlineBadge deadline={job.end_feedback} done={feedback.done_feedback} />
      </td>
    </tr>
  )
}

export default function FeedbackDashboardPage() {
  const [search, setSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canSearch = useMemo(() => search.trim().length > 0, [search])

  async function loadData(nextSearch = search) {
    setLoading(true)
    setError('')
    try {
      const query = nextSearch.trim()
      const summaryResult = await getFeedbackSummary({ search: query })
      const jobResult = await listFeedbackJobs({ search: query, pageSize: 12, feedbackStatus: 'missing' })
      const feedbackResult = await listFeedbacks({ search: query, pageSize: 12, feedbackStatus: 'open' })
      setSummary(summaryResult || null)
      setJobs(jobResult.jobs || [])
      setFeedbacks(feedbackResult.feedbacks || [])
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData('')
  }, [])

  const kpi = summary || {}
  const overdueItems = kpi.overdue_items || []
  const dueSoonItems = kpi.due_soon_items || []
  const hasRiskItems = overdueItems.length > 0 || dueSoonItems.length > 0

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#f79820]">
                  <MessageSquareText className="h-5 w-5" />
                </span>
                <h1 className="text-[24px] font-semibold leading-10 text-slate-950">Quản lý Feedbacks</h1>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') loadData(search)
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Tìm theo job, khách hàng hoặc tên feedback..."
              />
            </div>
            <button
              type="button"
              onClick={() => loadData(search)}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-[13px] font-semibold ${ORANGE_BUTTON_CLASS}`}
            >
              <RefreshCw className="h-4 w-4" />
              {canSearch ? 'Tìm kiếm' : 'Tải lại'}
            </button>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        )}

        {!loading && hasRiskItems ? (
          <section className="grid gap-3 lg:grid-cols-2">
            <RiskPanel
              title="Quá hạn cần xử lý"
              desc="Các job/feedback có deadline feedback đã qua."
              count={kpi.risk?.overdue || overdueItems.length}
              items={overdueItems}
              tone="rose"
              emptyText="Không có mục quá hạn."
            />
            <RiskPanel
              title="Sắp quá hạn"
              desc="Các job/feedback có deadline trong 24 giờ tới."
              count={kpi.risk?.due_soon || dueSoonItems.length}
              items={dueSoonItems}
              tone="amber"
              emptyText="Không có mục sắp quá hạn."
            />
          </section>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">
                  Job chưa tạo feedback ({formatSectionCount(kpi.missing_feedback_jobs?.total, loading)})
                </h2>
                <p className="mt-1 text-[12px] text-slate-500">Dùng dữ liệu job hiện có trong client-eventus.</p>
              </div>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-[13px] font-semibold text-slate-400">Đang tải...</div>
            ) : jobs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[12px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Job</th>
                      <th className="px-4 py-3 font-semibold">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <JobRow
                        key={job.id}
                        job={job}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Chưa có job phù hợp" desc="Thử tìm bằng tên khách hàng hoặc tên job khác." />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">
                  Theo dõi feedback đang mở ({formatSectionCount(kpi.feedbacks?.open, loading)})
                </h2>
                <p className="mt-1 text-[12px] text-slate-500">Các feedback chưa Done, ưu tiên theo trạng thái vận hành và deadline.</p>
              </div>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-[13px] font-semibold text-slate-400">Đang tải...</div>
            ) : feedbacks.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[12px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Job</th>
                      <th className="px-4 py-3 font-semibold">Trạng thái</th>
                      <th className="px-4 py-3 font-semibold">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbacks.map(feedback => (
                      <RecentFeedbackRow key={feedback.id} feedback={feedback} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Không có feedback đang mở" desc="Các feedback trong kết quả hiện tại đã được xử lý xong." />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
