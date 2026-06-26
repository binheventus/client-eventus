import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getFeedbackGallery, getFeedbackGalleryPhotos, markFeedbackJobDone } from '../hooks/useFeedback'
import { formatFeedbackDate } from '../lib/feedbackFormat'
import { groupPhotosByFolder } from '../lib/galleryDrive'
import GalleryGrid from '../components/GalleryGrid'
import GalleryFolderTabs from '../components/GalleryFolderTabs'
import GalleryLightbox from '../components/GalleryLightbox'
import GalleryStickyBar from '../components/GalleryStickyBar'
import GalleryClosingCard from '../components/GalleryClosingCard'

const PAGE = 36
const AUTO_PAGE = 24
const AUTO_LOAD_DELAY_MS = 800

export default function FeedbackGalleryPage() {
  const { token: shareToken } = useParams()
  const [gallery, setGallery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [photoStatus, setPhotoStatus] = useState('idle')
  const [tab, setTab] = useState('')
  const [visible, setVisible] = useState(PAGE)
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [pageActive, setPageActive] = useState(true)

  // 1) Fast path: load the page payload (job, links) so the page renders immediately.
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

  // 2) Slow path: fetch Drive photos in the background (can take 20-30s for deep
  //    folders). The page is already usable; the grid area shows a spinner.
  useEffect(() => {
    if (!gallery?.job?.id) return undefined
    let cancelled = false

    async function loadPhotos() {
      setPhotosLoading(true)
      setPhotoStatus('loading')
      try {
        const result = await getFeedbackGalleryPhotos(shareToken)
        if (!cancelled) {
          const nextPhotos = Array.isArray(result?.photos) ? result.photos : []
          setPhotos(nextPhotos)
          setPhotoStatus(result?.photo_status || (nextPhotos.length ? 'ok' : 'empty'))
        }
      } catch {
        if (!cancelled) {
          setPhotos([])
          setPhotoStatus('error')
        }
      } finally {
        if (!cancelled) setPhotosLoading(false)
      }
    }

    loadPhotos()
    return () => {
      cancelled = true
    }
  }, [shareToken, gallery?.job?.id])

  const { groups, hasMultiple } = useMemo(() => groupPhotosByFolder(photos), [photos])

  useEffect(() => {
    function updatePageActive() {
      setPageActive(!document.hidden)
    }

    updatePageActive()
    document.addEventListener('visibilitychange', updatePageActive)
    return () => document.removeEventListener('visibilitychange', updatePageActive)
  }, [])

  useEffect(() => {
    if (!groups.length) return
    if (groups.some(group => group.id === tab)) return
    setTab(groups[0].id)
    setVisible(PAGE)
  }, [groups, tab])

  const activeGroup = useMemo(() => {
    if (!groups.length) return null
    return groups.find(group => group.id === tab) || groups[0]
  }, [groups, tab])

  // The gallery intentionally renders one folder at a time; there is no
  // combined "all photos" view because large galleries get heavy quickly.
  const activePhotos = activeGroup?.photos || []

  // Switching tab resets the lazy-load window to the first page.
  function selectTab(id) {
    setTab(id)
    setVisible(PAGE)
  }

  const shownPhotos = activePhotos.slice(0, visible)
  const canShowMore = visible < activePhotos.length
  const remainingPhotos = Math.max(activePhotos.length - visible, 0)

  useEffect(() => {
    if (!canShowMore || !pageActive || lightboxIndex !== null) return undefined
    const timer = window.setTimeout(() => {
      setVisible(value => Math.min(value + AUTO_PAGE, activePhotos.length))
    }, AUTO_LOAD_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [activePhotos.length, canShowMore, lightboxIndex, pageActive, visible])

  const jobTitle = gallery?.job?.title || (gallery?.job?.id ? `Job #${gallery.job.id}` : 'Bộ ảnh Eventus')
  const jobName = gallery?.job ? `${formatFeedbackDate(gallery.job.job_date)} ${jobTitle}`.trim() : jobTitle
  const hasPhotos = photos.length > 0
  const photoLoadFailed = !photosLoading && !hasPhotos && ['error', 'not_configured'].includes(photoStatus)

  useEffect(() => {
    const previousTitle = document.title
    document.title = loading ? 'Đang tải bộ ảnh...' : error ? 'Bộ ảnh Eventus' : jobName
    return () => {
      document.title = previousTitle
    }
  }, [error, jobName, loading])

  // Header meta: total photos + number of distinct Drive folders.
  const folderCount = hasMultiple ? groups.length : photos.length ? 1 : 0
  const metaText = hasPhotos
    ? `${photos.length} ảnh${folderCount > 1 ? ` · ${folderCount} Folder` : ''}`
    : ''

  return (
    <main className="min-h-screen bg-[#f4f5f8] font-['Montserrat','Segoe_UI',system-ui,sans-serif] text-[#333]">
      <GalleryStickyBar
        jobTitle={loading ? 'Đang tải bộ ảnh...' : error ? 'Bộ ảnh Eventus' : jobName}
        metaText={metaText}
        driveLink={!loading && !error ? gallery?.drive_link : ''}
        surveyLink={!loading && !error ? gallery?.survey_link : ''}
        hidden={lightboxIndex !== null}
        downloadLabel="Xem trên link Google Drive"
      />

      <div className="mx-auto w-full max-w-[1600px] px-3 pb-7 pt-[124px] sm:px-4 sm:pb-10 lg:pt-[82px]">
        {loading ? (
          <div className="mx-auto mt-6 w-full max-w-2xl text-center text-[13px] font-semibold text-[#7a8597]">Đang tải gallery...</div>
        ) : error ? (
          <div className="mx-auto mt-6 w-full max-w-2xl rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-center text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <div>
            {/* Photos load in the background. Show a spinner while fetching;
                a non-empty result renders the grid; empty falls back to the
                closing card below (header already carries the Drive button). */}
            {photosLoading && !hasPhotos && (
              <div className="mx-auto mb-6 flex w-full max-w-2xl items-center justify-center gap-3 rounded-lg border border-[#e5e9f1] bg-white px-4 py-6 text-center">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#f79820] border-t-transparent" />
                <span>
                  <span className="block text-[13px] font-bold text-[#7a8597]">Đang xử lý nhiều ảnh cùng lúc...</span>
                  <span className="mt-1 block text-[12px] font-semibold text-[#9aa4b4]">
                    (Quá trình này có thể mất khoảng 10-20 giây)
                  </span>
                </span>
              </div>
            )}

            {hasPhotos && (
              <div>
                {groups.length > 0 && (
                  <GalleryFolderTabs groups={groups} activeTab={activeGroup?.id} onSelect={selectTab} />
                )}
                <GalleryGrid photos={shownPhotos} onOpen={setLightboxIndex} />
                {canShowMore && (
                  <div className="mt-4 flex justify-center text-[12px] font-bold text-[#9aa4b4]">
                    Đang tải thêm {remainingPhotos} ảnh...
                  </div>
                )}
              </div>
            )}

            {photoLoadFailed && (
              <div className="flex min-h-[calc(100vh-164px)] items-center justify-center py-8 lg:min-h-[calc(100vh-112px)]">
                <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-lg border border-[#e5e9f1] bg-white text-center shadow-[0_18px_45px_rgba(31,45,61,0.08)]">
                  <div className="border-t-4 border-[#f79820] px-5 py-8 sm:px-8 sm:py-10">
                    <h2 className="text-[18px] font-extrabold leading-tight text-[#202b3c] sm:text-[21px]">
                      Bộ ảnh được lưu trên Google Drive
                    </h2>
                    <p className="mx-auto mt-2 max-w-xl text-[13px] font-semibold leading-6 text-[#6b7280] sm:text-[14px]">
                      Nhấn vào liên kết bên dưới để xem hoặc tải bộ ảnh.
                    </p>
                    {gallery?.drive_link && (
                      <a
                        href={gallery.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-auto mt-6 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-lg bg-[#f79820] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_24px_rgba(247,152,32,0.26)] transition hover:bg-[#d97706] sm:text-[14px]"
                      >
                        <svg viewBox="0 0 87.3 78" className="h-5 w-5 shrink-0" aria-hidden="true">
                          <path fill="#0066da" d="M6.6 66.85 11.15 74.7c.95 1.65 2.35 2.95 4 3.75l16.25-28.1H0c0 1.9.5 3.8 1.45 5.45z" />
                          <path fill="#00ac47" d="M43.65 16.9 27.4 0c-1.65.8-3.05 2.1-4 3.75L1.45 41.8C.5 43.45 0 45.35 0 47.25h31.4z" />
                          <path fill="#ea4335" d="M72.15 78c1.65-.8 3.05-2.1 4-3.75l1.9-3.25 9.1-15.75c.95-1.65.95-3.8 0-5.45H55.75L43.65 70.8z" />
                          <path fill="#00832d" d="M43.65 16.9 59.9 0c-1.65-.8-3.55-.8-5.2 0L27.4 0z" />
                          <path fill="#2684fc" d="M55.75 50.35H31.4L15.15 78c1.65.8 3.55.8 5.2 0l23.3-13.45L66.95 78c1.65.8 3.55.8 5.2 0z" />
                          <path fill="#ffba00" d="M86.75 41.8 64.8 3.75C63.85 2.1 62.45.8 60.8 0L43.65 29.65l12.1 20.7h31.4c0-1.9-.5-3.8-1.45-5.45z" />
                        </svg>
                        <span>Mở bộ ảnh trên Google Drive</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {hasPhotos && <GalleryClosingCard surveyLink={gallery.survey_link} />}
          </div>
        )}
      </div>

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
