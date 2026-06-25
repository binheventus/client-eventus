import GalleryPhotoCard from './GalleryPhotoCard'

// Masonry grid via CSS multi-column (cards use break-inside-avoid). Photos
// carry no dimensions from GAS, so column balancing is left to the browser:
// 2 columns under 480px, 3 columns at/above. Receives an already-sliced list.
export default function GalleryGrid({ photos, onOpen }) {
  if (!photos?.length) return null

  return (
    <div className="columns-2 gap-3 [column-fill:_balance] min-[480px]:columns-3">
      {photos.map((photo, index) => (
        <GalleryPhotoCard
          key={photo.fileId || index}
          photo={photo}
          onOpen={() => onOpen?.(index)}
        />
      ))}
    </div>
  )
}
