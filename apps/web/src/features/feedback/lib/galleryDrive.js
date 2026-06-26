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
 * Group photos by downloadable folder. Prefer parentId when present so
 * duplicate folder names do not merge; parentPath enables a parent-tab + child
 * folder UI for nested Drive structures.
 * @param {Array<{fileId:string,name:string,parentName?:string|null,parentId?:string|null,parentUrl?:string|null,folderUrl?:string|null,parentPath?:Array<string>|string,topParentName?:string|null,topParentId?:string|null,topParentUrl?:string|null}>} photos
 * @returns {{ groups: Array<{ id: string, name: string, fullName: string, folderId: string|null, folderUrl: string|null, parentGroupId: string|null, parentGroupName: string|null, parentGroupUrl: string|null, photos: Array }>, hasMultiple: boolean }}
 */
export function groupPhotosByFolder(photos) {
  const list = Array.isArray(photos) ? photos : []
  const order = []
  const byKey = new Map()

  for (const photo of list) {
    const path = normalizeFolderPath(photo?.parentPath)
    const raw = photo?.parentName
    const fallbackName = raw == null || raw === '' ? 'Gốc' : String(raw)
    const folderId = photo?.parentId ? String(photo.parentId) : null
    const folderUrl = photo?.parentUrl || photo?.folderUrl || (folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null)
    const fullName = path.length ? path.join(' / ') : fallbackName
    const name = path.length > 1 ? path.slice(1).join(' / ') : fallbackName
    const parentGroupName = photo?.topParentName
      ? String(photo.topParentName)
      : (path.length > 1 ? path[0] : null)
    const parentGroupId = photo?.topParentId
      ? String(photo.topParentId)
      : (parentGroupName ? `parent:${parentGroupName}` : null)
    const parentGroupUrl = photo?.topParentUrl ? String(photo.topParentUrl) : null
    const key = folderId || (path.length ? path.join('/') : name)
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: key,
        name,
        fullName,
        folderId,
        folderUrl,
        parentGroupId,
        parentGroupName,
        parentGroupUrl,
        photos: [],
      })
      order.push(key)
    }
    byKey.get(key).photos.push(photo)
  }

  const groups = order.map(key => byKey.get(key))
  return { groups, hasMultiple: groups.length >= 2 }
}

function normalizeFolderPath(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('/').map(item => item.trim()).filter(Boolean)
  return []
}
