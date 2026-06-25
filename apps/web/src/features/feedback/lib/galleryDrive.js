// Client mirror of apps/api/lib/gallery-drive.js URL builders + grouping.
// Pure functions, no network. Keep in sync with the server helpers.

/**
 * Viewable Drive image URL. Omit size for the original.
 * @param {string} fileId
 * @param {number} [size] width in px; Google resizes server-side
 * @returns {string}
 */
export function buildDriveImageUrl(fileId, size) {
  const id = String(fileId || '')
  const sizeSuffix = Number.isFinite(size) && size > 0 ? `=w${size}` : ''
  return `https://lh3.googleusercontent.com/d/${id}${sizeSuffix}`
}

/**
 * Direct download URL for a single Drive file (bypasses the virus-scan page).
 * @param {string} fileId
 * @returns {string}
 */
export function buildDriveDownloadUrl(fileId) {
  const id = String(fileId || '')
  return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
}

/**
 * Group photos two levels deep by parentName (subfolder name). Root photos
 * (parentName null/'') land in a "Gốc" group. Returns groups in first-seen
 * order plus hasMultiple (true when 2+ groups → the UI shows folder tabs).
 * @param {Array<{fileId:string,name:string,parentName?:string|null}>} photos
 * @returns {{ groups: Array<{ id: string, name: string, photos: Array }>, hasMultiple: boolean }}
 */
export function groupPhotosByFolder(photos) {
  const list = Array.isArray(photos) ? photos : []
  const order = []
  const byName = new Map()

  for (const photo of list) {
    const raw = photo && photo.parentName
    const name = raw == null || raw === '' ? 'Gốc' : String(raw)
    if (!byName.has(name)) {
      byName.set(name, [])
      order.push(name)
    }
    byName.get(name).push(photo)
  }

  const groups = order.map(name => ({ id: name, name, photos: byName.get(name) }))
  return { groups, hasMultiple: groups.length >= 2 }
}
