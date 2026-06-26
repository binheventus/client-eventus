import { useState } from 'react'
import { buildDriveDownloadUrl, buildDriveImageUrl } from '../lib/galleryDrive'

const GRID_SIZE = 800

// Single grid image: lazy-loaded, rounded, hover overlay with a download button.
// A failed load swaps in a placeholder so the rest of the grid keeps working.
export default function GalleryPhotoCard({ photo, onOpen }) {
  const [failed, setFailed] = useState(false)
  const fileId = photo?.fileId

  return (
    <div className="group relative mb-3 break-inside-avoid overflow-hidden rounded-lg bg-[#eef1f6] shadow-[0_4px_12px_rgba(31,45,61,0.06)]">
      {failed ? (
        <div className="flex aspect-square w-full items-center justify-center text-[12px] font-semibold text-[#9aa4b4]">
          Ảnh lỗi
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-zoom-in"
          aria-label={photo?.name || 'Xem ảnh'}
        >
          <img
            src={buildDriveImageUrl(fileId, GRID_SIZE)}
            alt={photo?.name || ''}
            loading="lazy"
            onError={() => setFailed(true)}
            className="block w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </button>
      )}

      {!failed && (
        <a
          href={buildDriveDownloadUrl(fileId)}
          download
          onClick={event => event.stopPropagation()}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/65"
          aria-label="Tải ảnh này"
          title="Tải ảnh này"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
        </a>
      )}
    </div>
  )
}
