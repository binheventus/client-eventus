import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageSquareText, Plus, RefreshCw, Search, Video } from 'lucide-react'
import {
  createFeedback,
  ensureFeedback,
  listFeedbackJobs,
  listFeedbacks,
  lookupFeedbackJob,
} from '../hooks/useFeedback'
import { formatFeedbackDate, getFeedbackNameParts, getFeedbackPublicPath } from '../lib/feedbackFormat'

function EmptyState({ title, desc }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
      <p className="text-[14px] font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-[13px] text-slate-500">{desc}</p>
    </div>
  )
}

function JobRow({ job, onOpen, onCreate }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-900">{job.title || `Job #${job.id}`}</div>
        <div className="mt-1 text-[12px] text-slate-500">{job.customer_name || 'Chưa có khách hàng'} · {formatFeedbackDate(job.job_date)}</div>
      </td>
      <td className="px-4 py-3 text-[13px] text-slate-600">{job.zalo_id || '-'}</td>
      <td className="px-4 py-3">
        {job.feedback_id ? (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
            Đã có feedback
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-500">
            Chưa tạo
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => (job.feedback_id ? onOpen({ id: job.feedback_id, share_token: job.feedback_share_token }) : onCreate(job.id))}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-[13px] font-semibold text-white hover:bg-slate-800"
        >
          {job.feedback_id ? <Video className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {job.feedback_id ? 'Mở' : 'Tạo'}
        </button>
      </td>
    </tr>
  )
}

function FeedbackCard({ feedback, onOpen }) {
  const { name, dateBadge } = getFeedbackNameParts(feedback)

  return (
    <button
      type="button"
      onClick={() => onOpen(feedback)}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-[14px] font-semibold text-slate-900">
            <span className="min-w-0 truncate">{name}</span>
            {dateBadge && (
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-4 text-slate-500">
                {dateBadge}
              </span>
            )}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">
            {feedback.job?.title || `Job #${feedback.job_id}`} · {feedback.job?.customer_name || 'Chưa có khách hàng'}
          </p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${feedback.done_feedback ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {feedback.done_feedback ? 'Done' : 'Open'}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-[12px] text-slate-500">
        <span>{formatFeedbackDate(feedback.created_at)}</span>
        <span className="font-semibold text-slate-700">{feedback.video_title || feedback.video_url ? 'Có video' : 'Chờ video'}</span>
      </div>
    </button>
  )
}

export default function FeedbackDashboardPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [jobCode, setJobCode] = useState('')
  const [jobs, setJobs] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const canSearch = useMemo(() => search.trim().length > 0, [search])

  async function loadData(nextSearch = search) {
    setLoading(true)
    setError('')
    try {
      const [jobResult, feedbackResult] = await Promise.all([
        listFeedbackJobs({ search: nextSearch.trim(), pageSize: 12 }),
        listFeedbacks({ search: nextSearch.trim(), pageSize: 12 }),
      ])
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

  useEffect(() => {
    if (!jobs.length) {
      setSelectedJobId('')
      return
    }

    setSelectedJobId(current => jobs.some(job => String(job.id) === String(current)) ? current : String(jobs[0].id))
  }, [jobs])

  function openFeedback(feedback) {
    navigate(getFeedbackPublicPath(feedback))
  }

  async function handleCreate(jobId) {
    setActionLoading(true)
    setError('')
    try {
      const feedback = await ensureFeedback(jobId)
      navigate(getFeedbackPublicPath(feedback))
      await loadData()
    } catch (err) {
      setError(err?.message || 'Không tạo được feedback.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLookup(event) {
    event.preventDefault()
    const code = jobCode.trim()
    if (!code) return

    setActionLoading(true)
    setError('')
    try {
      const result = await lookupFeedbackJob(code)
      navigate(getFeedbackPublicPath(result.feedback))
    } catch (err) {
      setError(err?.message || 'Không tìm thấy mã job.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCreateBlankFeedback(jobId) {
    setActionLoading(true)
    setError('')
    try {
      const feedback = await createFeedback({
        jobId,
        feedback: { name: 'Feedback mới' },
      })
      navigate(getFeedbackPublicPath(feedback))
      await loadData()
    } catch (err) {
      setError(err?.message || 'Không tạo được feedback mới.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1440px] space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <MessageSquareText className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-[24px] font-semibold text-slate-950">Feedback</h1>
                  <p className="mt-1 text-[13px] text-slate-500">Quản lý link feedback video, góp ý của khách hàng, survey và gallery.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleLookup} className="flex w-full max-w-xl gap-2">
              <input
                value={jobCode}
                onChange={event => setJobCode(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Nhập ID JOB/Zalo để mở link feedback"
              />
              <button
                type="submit"
                disabled={actionLoading}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
                Mở
              </button>
            </form>
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
                placeholder="Tìm theo job, khách hàng, mã Zalo, tên feedback..."
              />
            </div>
            <button
              type="button"
              onClick={() => loadData(search)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
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

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-[16px] font-semibold text-slate-950">Job có thể tạo feedback</h2>
                <p className="mt-1 text-[12px] text-slate-500">Dùng dữ liệu job hiện có trong client-eventus.</p>
              </div>
            </div>
            {loading ? (
              <div className="px-5 py-8 text-[13px] font-semibold text-slate-400">Đang tải...</div>
            ) : jobs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[12px] uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Job</th>
                      <th className="px-4 py-3 font-semibold">Zalo ID</th>
                      <th className="px-4 py-3 font-semibold">Trạng thái</th>
                      <th className="px-4 py-3 text-right font-semibold">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(job => (
                      <JobRow
                        key={job.id}
                        job={job}
                        onOpen={openFeedback}
                        onCreate={handleCreate}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Chưa có job phù hợp" desc="Thử tìm bằng tên khách hàng, tên job hoặc mã Zalo khác." />
              </div>
            )}
          </div>

          <aside className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-[16px] font-semibold text-slate-950">Feedback gần đây</h2>
              <div className="mt-4 grid gap-3">
                {loading ? (
                  <div className="text-[13px] font-semibold text-slate-400">Đang tải...</div>
                ) : feedbacks.length ? feedbacks.map(feedback => (
                  <FeedbackCard key={feedback.id} feedback={feedback} onOpen={openFeedback} />
                )) : (
                  <EmptyState title="Chưa có feedback" desc="Tạo feedback từ danh sách job để bắt đầu." />
                )}
              </div>
            </div>

            {jobs.length ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-[16px] font-semibold text-slate-950">Tạo bản feedback mới</h2>
                <p className="mt-1 text-[13px] leading-6 text-slate-500">Chọn job trong kết quả hiện tại để tạo thêm bản feedback phụ.</p>
                <select
                  value={selectedJobId}
                  onChange={event => setSelectedJobId(event.target.value)}
                  className="mt-4 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title || `Job #${job.id}`} {job.customer_name ? `- ${job.customer_name}` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={actionLoading || !selectedJobId}
                  onClick={() => handleCreateBlankFeedback(selectedJobId)}
                  className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Tạo feedback cho job đang chọn
                </button>
              </div>
            ) : null}
          </aside>
        </section>
      </div>
    </div>
  )
}
