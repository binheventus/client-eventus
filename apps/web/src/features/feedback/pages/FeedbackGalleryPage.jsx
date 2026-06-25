import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFeedbackGallery, markFeedbackJobDone } from '../hooks/useFeedback'
import { formatFeedbackDate } from '../lib/feedbackFormat'
import { groupPhotosByFolder } from '../lib/galleryDrive'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFolderTabs from '../components/GalleryFolderTabs'
import GalleryLightbox from '../components/GalleryLightbox'

const PAGE = 36

export default function FeedbackGalleryPage() {
  const { token: shareToken } = useParams()
  const [gallery, setGallery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('all')
  const [visible, setVisible] = useState(PAGE)
  const [lightboxIndex, setLightboxIndex] = useState(null)

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

  const photos = gallery?.photos || []
  const { groups, hasMultiple } = useMemo(() => groupPhotosByFolder(photos), [photos])

  // Photos of the active tab ('all' = everything). Tabs only matter when ≥2 groups.
  const activePhotos = useMemo(() => {
    if (!hasMultiple || tab === 'all') return photos
    return groups.find(g => g.id === tab)?.photos || photos
  }, [photos, groups, hasMultiple, tab])

  // Switching tab resets the lazy-load window to the first page.
  function selectTab(id) {
    setTab(id)
    setVisible(PAGE)
  }

  const shownPhotos = activePhotos.slice(0, visible)
  const canShowMore = visible < activePhotos.length

  const jobTitle = gallery?.job?.title || (gallery?.job?.id ? `Job #${gallery.job.id}` : 'Bộ ảnh Eventus')
  const jobName = gallery?.job ? `${formatFeedbackDate(gallery.job.job_date)} ${jobTitle}`.trim() : jobTitle
  const hasPhotos = photos.length > 0

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f5f8] px-3 py-7 font-['Montserrat','Segoe_UI',system-ui,sans-serif] text-[#333] sm:px-4 sm:py-10">
      <section className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-[#e5e9f1] bg-[linear-gradient(135deg,rgba(255,247,237,0.92),rgba(255,255,255,0.96)_46%,rgba(232,246,242,0.92))] p-[18px] shadow-[0_12px_32px_rgba(31,45,61,0.07)] sm:p-7">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[38%] bg-[repeating-linear-gradient(135deg,rgba(247,152,32,0.08)_0_1px,transparent_1px_16px)]" />
        <div className="relative z-10 mb-5 flex justify-center">
          <img src="/logos/logo_eventus.png" alt="Eventus Production" className="h-auto w-[min(184px,54vw)]" />
        </div>
        <div className="relative z-10">
          <p className="text-[13px] font-bold leading-[1.6] text-[#f79820]">Bạn đang xem bộ ảnh</p>
          <h1 className="mt-2 text-[11px] font-bold leading-[1.45] text-[#202b3c] sm:text-[13px]">
            {loading ? 'Đang tải bộ ảnh...' : error ? 'Bộ ảnh Eventus' : jobName}
          </h1>
        </div>

        {loading ? (
          <div className="relative z-10 mt-6 text-[13px] font-semibold text-[#7a8597]">Đang tải gallery...</div>
        ) : error ? (
          <div className="relative z-10 mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <div className="relative z-10 mt-6">
            {/* Inline viewer when photos exist; otherwise the legacy Drive button below carries the album. */}
            {hasPhotos && (
              <div className="mb-6">
                {hasMultiple && (
                  <GalleryFolderTabs groups={groups} total={photos.length} activeTab={tab} onSelect={selectTab} />
                )}
                <GalleryGrid photos={shownPhotos} onOpen={setLightboxIndex} />
                {canShowMore && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisible(v => v + PAGE)}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#f79820]/40 bg-white px-5 text-[13px] font-extrabold text-[#d97706] transition hover:bg-[#fff7ed]"
                    >
                      Xem thêm ({activePhotos.length - visible})
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {gallery.drive_link ? (
                <a
                  href={gallery.drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#f79820] px-4 text-center text-[14px] font-extrabold leading-tight text-white shadow-[0_10px_20px_rgba(247,152,32,0.18)] transition hover:-translate-y-px hover:bg-[#d97706]"
                >
                  <span>{hasPhotos ? 'Tải toàn bộ' : 'Tải ảnh từ Google Drive'}</span>
                </a>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 px-4 py-3 text-center text-[13px] font-semibold text-slate-500">
                  Chưa có link tải ảnh
                </div>
              )}
              <Link
                to={gallery.survey_link}
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#f79820] px-4 text-center text-[14px] font-extrabold leading-tight text-white shadow-[0_10px_20px_rgba(247,152,32,0.18)] transition hover:-translate-y-px hover:bg-[#d97706]"
              >
                <span className="whitespace-nowrap">Phản hồi về trải nghiệm tại Eventus</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {lightboxIndex !== null && activePhotos[lightboxIndex] && (
        <GalleryLightbox
          photos={activePhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </main>
  )
}
