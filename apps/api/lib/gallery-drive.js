import { getGalleryGasTimeoutMs, getGalleryGasUrl } from './server-env.js'

const FOLDER_ID_RE = /\/folders\/([A-Za-z0-9_-]+)/
const QUERY_ID_RE = /[?&]id=([A-Za-z0-9_-]+)/

/**
 * Extract a Google Drive folder ID from common share-link formats.
 * Handles: /drive/folders/<id>, .../folders/<id>?usp=sharing|drive_link,
 * /drive/u/0/folders/<id>, open?id=<id>. Returns null for anything it cannot
 * confidently parse as a folder (empty, single-file /file/d/ links, shorteners).
 * @param {string} url
 * @returns {string|null}
 */
export function extractDriveFolderId(url) {
  const value = typeof url === 'string' ? url.trim() : ''
  if (!value) return null

  const folderMatch = value.match(FOLDER_ID_RE)
  if (folderMatch) return folderMatch[1]

  // open?id=<id> and similar query-style links. Guard against /file/d/ which is
  // a single file, not a folder.
  if (!/\/file\/d\//.test(value)) {
    const queryMatch = value.match(QUERY_ID_RE)
    if (queryMatch) return queryMatch[1]
  }

  return null
}

/**
 * Build a static Drive URL from a fileId. Pure function, no network.
 * @param {string} fileId
 * @param {'view'|'download'} [kind='view']
 * @param {number} [size] only used for kind 'view'; omitted → original size
 * @returns {string}
 */
export function driveImageUrl(fileId, kind = 'view', size) {
  const id = String(fileId || '')
  if (kind === 'download') {
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`
  }
  const sizeSuffix = Number.isFinite(size) && size > 0 ? `=w${size}` : ''
  return `https://lh3.googleusercontent.com/d/${id}${sizeSuffix}`
}

/**
 * Group photos two levels deep by their parentName (subfolder name).
 * Root photos (parentName null/'') go to a "Gốc" group. Returns the groups in
 * first-seen order plus a flag for whether the UI should show folder tabs
 * (true when there are 2+ distinct named groups).
 * @param {Array<{fileId:string,name:string,parentName?:string|null}>} photos
 * @returns {{ groups: Array<{ name: string, photos: Array }>, hasMultiple: boolean }}
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

  const groups = order.map(name => ({ name, photos: byName.get(name) }))
  return { groups, hasMultiple: groups.length >= 2 }
}

/**
 * List image files in a Drive folder by calling the Google Apps Script Web App
 * server-to-server. Never throws: any failure (no GAS URL, non-2xx, timeout,
 * malformed JSON, ok:false) is logged and yields []. The GAS URL is read from
 * server env and is never exposed to the browser.
 * @param {string} folderId
 * @returns {Promise<Array<{fileId:string,name:string,parentName:string|null}>>}
 */
export async function listDriveFolderPhotos(folderId) {
  const id = String(folderId || '').trim()
  if (!id) return []

  const gasUrl = getGalleryGasUrl()
  if (!gasUrl) return []

  const timeoutMs = getGalleryGasTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${gasUrl}${gasUrl.includes('?') ? '&' : '?'}folderId=${encodeURIComponent(id)}`
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      console.warn(`[gallery-drive] GAS responded ${response.status} for folder ${id}`)
      return []
    }

    const payload = await response.json()
    if (!payload || payload.ok !== true || !Array.isArray(payload.photos)) {
      console.warn(`[gallery-drive] GAS returned non-ok payload for folder ${id}`)
      return []
    }

    return payload.photos
      .filter(photo => photo && photo.fileId)
      .map(photo => ({
        fileId: String(photo.fileId),
        name: typeof photo.name === 'string' ? photo.name : '',
        parentName: photo.parentName == null || photo.parentName === '' ? null : String(photo.parentName),
      }))
  } catch (error) {
    const reason = error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message || error)
    console.warn(`[gallery-drive] failed to list folder ${id}: ${reason}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}
