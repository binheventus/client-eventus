import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Download, Image, MessageSquareText } from 'lucide-react'
import { getFeedbackGallery, markFeedbackJobDone } from '../hooks/useFeedback'
import { formatFeedbackDate } from '../lib/feedbackFormat'

export default function FeedbackGalleryPage() {
  const { token: shareToken } = useParams()
  const [gallery, setGallery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getFeedbackGallery(shareToken)
        if (!cancelled) {
          setGallery(result)
          markFeedbackJobDone({ share_token: shareToken, image: 1 }).catch(() => {})
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Không tải được gallery.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [shareToken])

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Image className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase text-amber-600">Eventus Gallery</p>
            <h1 className="text-[24px] font-semibold text-slate-950">Tải file ảnh</h1>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 text-[13px] font-semibold text-slate-400">Đang tải gallery...</div>
        ) : error ? (
          <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-[13px] text-slate-500">Bạn đang xem bộ ảnh</p>
            <h2 className="mt-2 text-[20px] font-semibold leading-8 text-slate-950">
              {formatFeedbackDate(gallery.job?.job_date)} {gallery.job?.title || `Job #${gallery.job?.id}`}
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">{gallery.job?.customer_name || 'Eventus Production'}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {gallery.drive_link ? (
                <a
                  href={gallery.drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[14px] font-semibold text-white hover:bg-blue-700"
                >
                  <Download className="h-4 w-4" />
                  Lấy link tải bộ ảnh
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-[13px] font-semibold text-slate-500">
                  Chưa có link tải ảnh
                </div>
              )}
              <Link
                to={gallery.survey_link}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MessageSquareText className="h-4 w-4" />
                Góp ý cho Eventus
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
