import { useEffect, useState } from 'react'
import { MessageSquareText, RefreshCw, Search } from 'lucide-react'
import {
  listFeedbackJobs,
  listFeedbacks,
} from '../hooks/useFeedback'
import { getFeedbackPublicPath } from '../lib/feedbackFormat'

const ORANGE_BUTTON_CLASS = 'bg-[#f79820] text-white hover:bg-[#df861d]'
const TABLE_HEADER_CLASS = 'bg-slate-200 text-[12px] uppercase text-slate-950'
const JOB_COLUMN_CLASS = 'w-[42%]'
const CAMERA_COLUMN_CLASS = 'w-[14%]'
const EDITOR_COLUMN_CLASS = 'w-[22%]'
const STATUS_COLUMN_CLASS = 'w-[10%]'
const DEADLINE_COLUMN_CLASS = 'w-[12%]'
const INITIAL_DASHBOARD_PAGE_SIZE = 12
const LOAD_MORE_INCREMENT = 10

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
  if (Array.isArray(names)) {
    const filteredNames = names.filter(Boolean)
    return filteredNames.length ? filteredNames.join(', ') : '-'
  }
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

function getDeadlineStatus(deadline) {
  const date = toDate(deadline)
  if (!date) return { label: 'Thiếu deadline', className: 'bg-slate-100 text-slate-500' }

  const now = Date.now()
  const delta = date.getTime() - now
  if (delta < 0) return { label: 'Quá hạn', className: 'bg-rose-50 text-rose-700' }
  if (delta <= 24 * 60 * 60 * 1000) return { label: 'Sắp quá hạn', className: 'bg-amber-50 text-amber-700' }
  return { label: 'Trong hạn', className: 'bg-emerald-50 text-emerald-700' }
}

function DeadlineBadge({ deadline }) {
  const status = getDeadlineStatus(deadline)
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

function getJobVideoStatus(job = {}) {
  const statusId = Number(job.video_employee_status_id || 1)
  const labelById = {
    1: 'Chưa làm',
    2: 'Đang làm',
    3: 'Đang feedback',
    4: 'Đã feedback',
  }
  const label = String(job.video_employee_status_name || '').trim() || labelById[statusId] || labelById[1]
  const classById = {
    1: 'bg-slate-100 text-slate-600',
    2: 'bg-blue-50 text-blue-700',
    3: 'bg-emerald-50 text-emerald-700',
    4: 'bg-amber-50 text-amber-700',
  }

  return {
    label,
    className: classById[statusId] || 'bg-slate-100 text-slate-500',
  }
}

function JobStatusBadge({ job }) {
  const status = getJobVideoStatus(job)
  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}>
        {status.label}
      </span>
    </div>
  )
}

function getRecordJob(record = {}, feedback = false) {
  return feedback ? getFeedbackJob(record) : record
}

function getRecordEditorName(record = {}, feedback = false) {
  const job = getRecordJob(record, feedback)
  return feedback
    ? (record.editor_name || job.editor_name || '')
    : (job.editor_name || '')
}

function getReviewerNames(job = {}) {
  return Array.isArray(job.video_reviewer_names)
    ? job.video_reviewer_names.filter(Boolean).join(', ')
    : String(job.video_reviewer_names || '').trim()
}

function StaffCell({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 align-top text-[12px] font-medium leading-5 text-slate-700 ${className}`}>
      {children || '-'}
    </td>
  )
}

function FeedbackTableHead() {
  return (
    <thead className={TABLE_HEADER_CLASS}>
      <tr>
        <th className={`${JOB_COLUMN_CLASS} px-4 py-3 font-bold`}>Job</th>
        <th className={`${CAMERA_COLUMN_CLASS} px-4 py-3 font-bold`}>Nhân sự quay</th>
        <th className={`${EDITOR_COLUMN_CLASS} px-4 py-3 font-bold`}>Video-Editor</th>
        <th className={`${STATUS_COLUMN_CLASS} px-4 py-3 font-bold`}>Trạng thái</th>
        <th className={`${DEADLINE_COLUMN_CLASS} px-4 py-3 font-bold`}>Deadline</th>
      </tr>
    </thead>
  )
}

function LoadMoreButton({ onClick }) {
  return (
    <div className="border-t border-slate-100 px-5 py-3 text-center">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:border-[#f79820] hover:text-[#d97706]"
      >
        Xem thêm 10 job
      </button>
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

function JobRow({ job }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className={`${JOB_COLUMN_CLASS} px-4 py-3`}>
        <div className="font-semibold text-slate-900">{getJobTitleWithDate(job, job.id)}</div>
      </td>
      <StaffCell className={CAMERA_COLUMN_CLASS}>{formatStaffNames(job.camera_staff_names)}</StaffCell>
      <StaffCell className={EDITOR_COLUMN_CLASS}>{getRecordEditorName(job) || '-'}</StaffCell>
      <td className={`${STATUS_COLUMN_CLASS} px-4 py-3`}>
        <JobStatusBadge job={job} />
      </td>
      <td className={`${DEADLINE_COLUMN_CLASS} px-4 py-3`}>
        <DeadlineBadge deadline={job.end_feedback} />
      </td>
    </tr>
  )
}

function RecentFeedbackRow({ feedback }) {
  const job = getFeedbackJob(feedback)
  const feedbackPath = getFeedbackPublicPath(feedback)
  const editorName = getRecordEditorName(feedback, true)
  const reviewerNames = getReviewerNames(job)

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className={`${JOB_COLUMN_CLASS} px-4 py-3`}>
        <a
          href={feedbackPath}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#d97706] hover:text-[#c46a04]"
        >
          {getJobTitleWithDate(job, feedback.job_id, feedback.created_at)}
        </a>
      </td>
      <StaffCell className={CAMERA_COLUMN_CLASS}>{formatStaffNames(job.camera_staff_names)}</StaffCell>
      <StaffCell className={EDITOR_COLUMN_CLASS}>
        <div>{editorName || '-'}</div>
        <div className="mt-0.5 text-[11px] font-medium text-slate-500">
          Duyệt: {reviewerNames || <span className="font-semibold text-rose-600">Chưa có</span>}
        </div>
      </StaffCell>
      <td className={`${STATUS_COLUMN_CLASS} px-4 py-3`}>
        <JobStatusBadge job={job} />
      </td>
      <td className={`${DEADLINE_COLUMN_CLASS} px-4 py-3`}>
        <DeadlineBadge deadline={job.end_feedback} />
      </td>
    </tr>
  )
}

export default function FeedbackDashboardPage() {
  const [search, setSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [jobTotal, setJobTotal] = useState(0)
  const [feedbackTotal, setFeedbackTotal] = useState(0)
  const [jobPageSize, setJobPageSize] = useState(INITIAL_DASHBOARD_PAGE_SIZE)
  const [feedbackPageSize, setFeedbackPageSize] = useState(INITIAL_DASHBOARD_PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canSearch = search.trim().length > 0

  async function loadData(nextSearch = search, options = {}) {
    setLoading(true)
    setError('')
    try {
      const query = nextSearch.trim()
      const nextJobPageSize = options.jobPageSize || jobPageSize
      const nextFeedbackPageSize = options.feedbackPageSize || feedbackPageSize
      const [jobResult, feedbackResult] = await Promise.all([
        listFeedbackJobs({ search: query, pageSize: nextJobPageSize, feedbackStatus: 'missing' }),
        listFeedbacks({ search: query, pageSize: nextFeedbackPageSize, feedbackStatus: 'open' }),
      ])
      setJobs(jobResult.jobs || [])
      setFeedbacks(feedbackResult.feedbacks || [])
      setJobTotal(Number(jobResult.total || 0))
      setFeedbackTotal(Number(feedbackResult.total || 0))
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData('', {
      jobPageSize: INITIAL_DASHBOARD_PAGE_SIZE,
      feedbackPageSize: INITIAL_DASHBOARD_PAGE_SIZE,
    })
  }, [])

  function handleReload() {
    loadData(search)
  }

  function handleLoadMoreJobs() {
    const nextPageSize = jobPageSize + LOAD_MORE_INCREMENT
    setJobPageSize(nextPageSize)
    loadData(search, { jobPageSize: nextPageSize })
  }

  function handleLoadMoreFeedbacks() {
    const nextPageSize = feedbackPageSize + LOAD_MORE_INCREMENT
    setFeedbackPageSize(nextPageSize)
    loadData(search, { feedbackPageSize: nextPageSize })
  }

  const hasMoreJobs = jobs.length < jobTotal
  const hasMoreFeedbacks = feedbacks.length < feedbackTotal

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
                  if (event.key === 'Enter') handleReload()
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Tìm theo job, khách hàng hoặc tên feedback..."
              />
            </div>
            <button
              type="button"
              onClick={handleReload}
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

        <section className="grid gap-5">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">
                  Theo dõi feedback đang mở ({formatSectionCount(feedbackTotal, loading)})
                </h2>
                <p className="mt-1 text-[12px] text-slate-500">Các feedback chưa Done, ưu tiên theo trạng thái vận hành và deadline.</p>
              </div>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-[13px] font-semibold text-slate-400">Đang tải...</div>
            ) : feedbacks.length ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-left text-[13px]">
                    <FeedbackTableHead />
                    <tbody>
                      {feedbacks.map(feedback => (
                        <RecentFeedbackRow key={feedback.id} feedback={feedback} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMoreFeedbacks ? (
                  <LoadMoreButton onClick={handleLoadMoreFeedbacks} />
                ) : null}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Không có feedback đang mở" desc="Các feedback trong kết quả hiện tại đã được xử lý xong." />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">
                  Job chưa tạo feedback ({formatSectionCount(jobTotal, loading)})
                </h2>
                <p className="mt-1 text-[12px] text-slate-500">Dùng dữ liệu job hiện có trong client-eventus.</p>
              </div>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-[13px] font-semibold text-slate-400">Đang tải...</div>
            ) : jobs.length ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-left text-[13px]">
                    <FeedbackTableHead />
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
                {hasMoreJobs ? (
                  <LoadMoreButton onClick={handleLoadMoreJobs} />
                ) : null}
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Chưa có job phù hợp" desc="Thử tìm bằng tên khách hàng hoặc tên job khác." />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
