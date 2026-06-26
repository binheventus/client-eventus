import { useEffect, useMemo, useState } from 'react'
import GalleryPhotoCard from './GalleryPhotoCard'

function getColumnCount() {
  if (typeof window === 'undefined') return 2
  if (window.matchMedia('(min-width: 1280px)').matches) return 5
  if (window.matchMedia('(min-width: 1024px)').matches) return 4
  if (window.matchMedia('(min-width: 640px)').matches) return 3
  return 2
}

// Stable masonry columns. CSS multi-column rebalances when more photos are
// appended, which makes already-visible photos jump. Splitting into explicit
// columns keeps existing items anchored while auto-load adds the next batch.
export default function GalleryGrid({ photos, onOpen }) {
  const [columnCount, setColumnCount] = useState(getColumnCount)

  useEffect(() => {
    function handleResize() {
      setColumnCount(getColumnCount())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const columns = useMemo(() => {
    const next = Array.from({ length: columnCount }, () => [])
    photos?.forEach((photo, index) => {
      next[index % columnCount].push({ photo, index })
    })
    return next
  }, [columnCount, photos])

  if (!photos?.length) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {columns.map((column, columnIndex) => (
        <div key={columnIndex} className="min-w-0">
          {column.map(({ photo, index }) => (
            <GalleryPhotoCard
              key={photo.fileId || index}
              photo={photo}
              onOpen={() => onOpen?.(index)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
