import { getGalleryGasCacheTtlMs, getGalleryGasTimeoutMs, getGalleryGasUrl } from './server-env.js'

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

/**
 * List image files in a Drive folder, with an in-memory cache + in-flight
 * dedup so a gallery shared to many viewers triggers at most one GAS call per
 * folder per TTL window. Never throws: any failure yields []. Only non-empty
 * results are cached (a transient timeout must not poison the cache).
 * @param {string} folderId
 * @returns {Promise<Array<{fileId:string,name:string,parentName:string|null,parentId:string|null,parentUrl:string|null}>>}
 */
export async function listDriveFolderPhotos(folderId) {
  const id = String(folderId || '').trim()
  if (!id) return []

  const cached = getCachedPhotos(id)
  if (cached) return cached

  // Coalesce concurrent requests for the same folder onto one GAS call.
  const inFlight = photosInFlight.get(id)
  if (inFlight) return inFlight

  const promise = (async () => {
    const photos = await fetchDriveFolderPhotos(id)
    if (photos.length) setCachedPhotos(id, photos)
    return photos
  })().finally(() => {
    photosInFlight.delete(id)
  })

  photosInFlight.set(id, promise)
  return promise
}

const photosCache = new Map()
const photosInFlight = new Map()

function getCachedPhotos(folderId) {
  const entry = photosCache.get(folderId)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    photosCache.delete(folderId)
    return null
  }
  return entry.value
}

function setCachedPhotos(folderId, value) {
  const ttl = getGalleryGasCacheTtlMs()
  if (ttl <= 0) return
  const now = Date.now()
  for (const [key, entry] of photosCache) {
    if (entry.expiresAt <= now) photosCache.delete(key)
  }
  photosCache.set(folderId, { value, expiresAt: now + ttl })
}

/** Clears the Drive photo cache. Exposed for tests. */
export function clearGalleryDriveCache() {
  photosCache.clear()
  photosInFlight.clear()
}

/**
 * Raw GAS fetch with no caching. Reads GALLERY_GAS_URL from server env (never
 * exposed to the browser). Returns [] on missing URL, non-2xx, timeout,
 * malformed JSON, or ok:false — logging a warning.
 * @param {string} id already-trimmed folder ID
 * @returns {Promise<Array<{fileId:string,name:string,parentName:string|null,parentId:string|null,parentUrl:string|null}>>}
 */
async function fetchDriveFolderPhotos(id) {
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
        parentId: photo.parentId == null || photo.parentId === '' ? null : String(photo.parentId),
        parentUrl: photo.parentUrl == null || photo.parentUrl === ''
          ? (photo.folderUrl == null || photo.folderUrl === '' ? null : String(photo.folderUrl))
          : String(photo.parentUrl),
        parentPath: Array.isArray(photo.parentPath)
          ? photo.parentPath.map(item => String(item || '').trim()).filter(Boolean)
          : [],
        topParentName: photo.topParentName == null || photo.topParentName === '' ? null : String(photo.topParentName),
        topParentId: photo.topParentId == null || photo.topParentId === '' ? null : String(photo.topParentId),
        topParentUrl: photo.topParentUrl == null || photo.topParentUrl === '' ? null : String(photo.topParentUrl),
      }))
  } catch (error) {
    const reason = error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : String(error?.message || error)
    console.warn(`[gallery-drive] failed to list folder ${id}: ${reason}`)
    return []
  } finally {
    clearTimeout(timer)
  }
}
