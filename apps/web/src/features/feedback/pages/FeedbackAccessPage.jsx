import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, MessageSquareText } from 'lucide-react'
import { lookupFeedbackJob } from '../hooks/useFeedback'
import { getFeedbackPublicPath } from '../lib/feedbackFormat'

export function FeedbackRedirectPage() {
  const { zaloId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const result = await lookupFeedbackJob(zaloId)
        if (!cancelled) navigate(getFeedbackPublicPath(result.feedback), { replace: true })
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Không mở được link feedback.')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [navigate, zaloId])

  return (
    <FeedbackAccessLayout>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
          <MessageSquareText className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-[24px] font-semibold text-slate-950">Đang mở Feedback</h1>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">
          Hệ thống đang kiểm tra mã job và chuyển Anh/Chị tới trang feedback tương ứng.
        </p>
        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <div className="mt-5 text-[13px] font-semibold text-slate-400">Đang xử lý...</div>
        )}
      </div>
    </FeedbackAccessLayout>
  )
}

function FeedbackAccessLayout({ children }) {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center">
        <section className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </section>
      </div>
    </main>
  )
}

export default function FeedbackAccessPage() {
  const navigate = useNavigate()
  const [jobCode, setJobCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const code = jobCode.trim()
    if (!code) return

    setLoading(true)
    setError('')
    try {
      const result = await lookupFeedbackJob(code)
      navigate(getFeedbackPublicPath(result.feedback))
    } catch (err) {
      setError(err?.message || 'Mã Job không chính xác.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <FeedbackAccessLayout>
      <div className="text-center">
        <img src="/logos/logo_eventus.png" alt="Eventus Production" className="mx-auto h-auto w-[180px]" />
        <h1 className="mt-5 text-[24px] font-semibold text-slate-950">Truy cập Feedback Eventus</h1>
        <p className="mt-2 text-[13px] leading-6 text-slate-500">
          Nhập ID JOB nhận từ Zalo ZNS để xem video, gửi góp ý chỉnh sửa và hoàn tất feedback.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <input
          value={jobCode}
          onChange={event => setJobCode(event.target.value)}
          className="h-12 w-full rounded-lg border border-slate-200 px-4 text-center text-[15px] font-semibold text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder="Nhập ID JOB"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[14px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Đang kiểm tra...' : 'Vào Feedback'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[13px] font-semibold text-rose-700">
          {error}
        </div>
      )}
    </FeedbackAccessLayout>
  )
}
