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
              <div className="mx-auto mt-6 w-full max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[13px] font-semibold text-amber-800">
                Chưa tải được ảnh trực tiếp. Bạn vẫn có thể xem bộ ảnh bằng nút Google Drive phía trên.
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
