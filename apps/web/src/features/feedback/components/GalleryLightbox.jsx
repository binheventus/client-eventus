import { useCallback, useEffect, useRef, useState } from 'react'
import { buildDriveDownloadUrl, buildDriveImageUrl } from '../lib/galleryDrive'

const VIEW_SIZE = 1600
const THUMB_SIZE = 600
const MAX_ZOOM = 4
const MIN_ZOOM = 1

// Full-screen single-photo viewer for the active group: prev/next (← → keys +
// buttons), wheel/pinch zoom + pan, mobile swipe, blur-up from the grid thumb,
// per-image download, close (Esc / button / backdrop). No comments/favorites.
export default function GalleryLightbox({ photos, index, onClose, onNavigate }) {
  const photo = photos?.[index]
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)

  const dragRef = useRef(null)
  const pinchRef = useRef(null)
  const swipeRef = useRef(null)

  const resetView = useCallback(() => {
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setLoaded(false)
  }, [])

  const goPrev = useCallback(() => {
    if (index > 0) { resetView(); onNavigate?.(index - 1) }
  }, [index, onNavigate, resetView])

  const goNext = useCallback(() => {
    if (index < (photos?.length || 0) - 1) { resetView(); onNavigate?.(index + 1) }
  }, [index, photos, onNavigate, resetView])

  // PLACEHOLDER_EFFECTS
  // Keyboard: Esc closes, ← → navigate. Lock body scroll while open.
  useEffect(() => {
    function onKey(event) {
      if (event.key === 'Escape') onClose?.()
      else if (event.key === 'ArrowLeft') goPrev()
      else if (event.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, goPrev, goNext])

  // PLACEHOLDER_HANDLERS
  const clampZoom = z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

  function handleWheel(event) {
    event.preventDefault()
    const next = clampZoom(zoom - event.deltaY * 0.0015 * zoom)
    setZoom(next)
    if (next === 1) setOffset({ x: 0, y: 0 })
  }

  function distance(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  function handleTouchStart(event) {
    if (event.touches.length === 2) {
      pinchRef.current = { dist: distance(event.touches), zoom }
      swipeRef.current = null
    } else if (event.touches.length === 1) {
      const t = event.touches[0]
      if (zoom > 1) dragRef.current = { x: t.clientX - offset.x, y: t.clientY - offset.y }
      else swipeRef.current = { x: t.clientX, y: t.clientY }
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length === 2 && pinchRef.current) {
      event.preventDefault()
      const ratio = distance(event.touches) / pinchRef.current.dist
      setZoom(clampZoom(pinchRef.current.zoom * ratio))
    } else if (event.touches.length === 1 && zoom > 1 && dragRef.current) {
      event.preventDefault()
      const t = event.touches[0]
      setOffset({ x: t.clientX - dragRef.current.x, y: t.clientY - dragRef.current.y })
    }
  }

  function handleTouchEnd(event) {
    if (pinchRef.current) {
      if (zoom <= 1) setOffset({ x: 0, y: 0 })
      pinchRef.current = null
      return
    }
    // swipe to navigate when not zoomed
    if (swipeRef.current && zoom === 1) {
      const t = event.changedTouches[0]
      const dx = t.clientX - swipeRef.current.x
      const dy = t.clientY - swipeRef.current.y
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) goPrev()
        else goNext()
      }
    }
    swipeRef.current = null
    dragRef.current = null
  }

  function handleMouseDown(event) {
    if (zoom <= 1) return
    dragRef.current = { x: event.clientX - offset.x, y: event.clientY - offset.y }
  }

  function handleMouseMove(event) {
    if (!dragRef.current) return
    setOffset({ x: event.clientX - dragRef.current.x, y: event.clientY - dragRef.current.y })
  }

  function endMouseDrag() {
    dragRef.current = null
  }

  if (!photo) return null

  const hasPrev = index > 0
  const hasNext = index < (photos?.length || 0) - 1
  const transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose?.() }}
      role="dialog"
      aria-modal="true"
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
        aria-label="Đóng"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>

      {/* Download current */}
      <a
        href={buildDriveDownloadUrl(photo.fileId)}
        download
        onClick={event => event.stopPropagation()}
        className="absolute right-16 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
        aria-label="Tải ảnh này"
        title="Tải ảnh này"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
      </a>

      {/* Counter */}
      <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-[12px] font-semibold text-white/90">
        {index + 1} / {photos.length}
      </div>

      {/* Prev */}
      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          className="absolute left-2 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:left-4"
          aria-label="Ảnh trước"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          className="absolute right-2 top-1/2 z-20 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25 sm:right-4"
          aria-label="Ảnh kế"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {/* Image stage: blur-up thumb behind the sharp full image */}
      <div
        className="relative flex h-full w-full items-center justify-center overflow-hidden px-4 py-16 select-none"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endMouseDrag}
        onMouseLeave={endMouseDrag}
        style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
      >
        <div className="relative max-h-full max-w-full" style={{ transform, transition: dragRef.current || pinchRef.current ? 'none' : 'transform 0.18s ease-out' }}>
          {!loaded && (
            <img
              src={buildDriveImageUrl(photo.fileId, THUMB_SIZE)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-105 object-contain blur-xl"
            />
          )}
          <img
            key={photo.fileId}
            src={buildDriveImageUrl(photo.fileId, VIEW_SIZE)}
            alt={photo.name || ''}
            onLoad={() => setLoaded(true)}
            draggable={false}
            className={`max-h-[80vh] max-w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </div>
    </div>
  )
}
