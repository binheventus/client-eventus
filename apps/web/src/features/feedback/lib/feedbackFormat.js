export function formatFeedbackDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatFeedbackDateDots(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date).replace(/\D+/g, '.')
}

export function formatFeedbackDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatFeedbackDayMonth(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
  }).format(date).replace(/\D+/g, '.')
}

export function stripFeedbackDateSuffix(value = '') {
  const text = String(value || '').trim()
  const match = text.match(/^(.*?)(?:\s+)(\d{1,2})[\s./-]+(\d{1,2})(?:[\s./-]+\d{2,4})?$/)
  if (!match) return { name: text, dateBadge: '' }
  const day = String(match[2]).padStart(2, '0')
  const month = String(match[3]).padStart(2, '0')
  return {
    name: match[1].trim(),
    dateBadge: `${day}.${month}`,
  }
}

export function getFeedbackNameParts(feedback = {}, fallbackDate = new Date()) {
  const parts = stripFeedbackDateSuffix(feedback?.name || '')
  const createdDateBadge = formatFeedbackDayMonth(feedback?.created_at || fallbackDate)
  return {
    name: parts.name || 'Feedback',
    dateBadge: createdDateBadge || parts.dateBadge,
  }
}

const FEEDBACK_LINK_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+/gi
const FEEDBACK_LINK_TRAILING_PUNCTUATION = /[.,!?;:)]/

function splitFeedbackLinkPunctuation(value = '') {
  let linkText = String(value || '')
  let trailing = ''

  while (linkText && FEEDBACK_LINK_TRAILING_PUNCTUATION.test(linkText[linkText.length - 1])) {
    trailing = `${linkText[linkText.length - 1]}${trailing}`
    linkText = linkText.slice(0, -1)
  }

  return { linkText, trailing }
}

function pushFeedbackTextPart(parts, text) {
  if (!text) return
  const previous = parts[parts.length - 1]
  if (previous?.type === 'text') {
    previous.text += text
    return
  }
  parts.push({ type: 'text', text })
}

export function normalizeFeedbackLinkHref(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''

  const href = /^www\./i.test(text) ? `https://${text}` : text
  try {
    const parsed = new URL(href)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
  } catch {
    return ''
  }
}

export function linkifyFeedbackText(value = '') {
  const text = String(value || '')
  if (!text) return []

  const parts = []
  let lastIndex = 0

  for (const match of text.matchAll(FEEDBACK_LINK_PATTERN)) {
    const start = match.index || 0
    const rawLink = match[0]
    if (start > lastIndex) {
      pushFeedbackTextPart(parts, text.slice(lastIndex, start))
    }

    const { linkText, trailing } = splitFeedbackLinkPunctuation(rawLink)
    const href = normalizeFeedbackLinkHref(linkText)
    if (href) {
      parts.push({ type: 'link', text: linkText, href })
    } else {
      pushFeedbackTextPart(parts, rawLink)
    }
    if (trailing) {
      pushFeedbackTextPart(parts, trailing)
    }

    lastIndex = start + rawLink.length
  }

  if (lastIndex < text.length) {
    pushFeedbackTextPart(parts, text.slice(lastIndex))
  }

  return parts
}

export function buildDefaultFeedbackName(sequence = 1) {
  const safeSequence = Math.max(1, Math.floor(Number(sequence) || 1))
  return `Feedback #${safeSequence}`
}

export function formatFeedbackCloneCount(count = 0) {
  const safeCount = Math.max(0, Math.floor(Number(count) || 0))
  return String(safeCount).padStart(2, '0')
}

export function getFeedbackEditorFirstName(editorName = '') {
  const parts = String(editorName || '').trim().split(/\s+/).filter(Boolean)
  return parts.at(-1) || ''
}

export function buildFeedbackCloneTitleText({ editorName = '', feedbackName = '', count = 0 } = {}) {
  const safeEditorName = getFeedbackEditorFirstName(editorName) || 'Editor'
  const safeFeedbackName = String(feedbackName || '').trim() || 'Bản feedback gần nhất'
  const countText = formatFeedbackCloneCount(count)
  return `${safeEditorName} ơi, ${safeFeedbackName} vẫn còn ${countText} feedback chưa được sửa.`
}

export function buildFeedbackClonePromptText(count = 0) {
  const countText = formatFeedbackCloneCount(count)
  return `Bạn có muốn clone ${countText} feedback chưa được sửa đó sang bản mới này không ?`
}

export function parseTimeToSeconds(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null

  const text = String(value).trim()
  if (!text) return null
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text)

  const parts = text.split(':').map(part => Number(part))
  if (parts.some(part => !Number.isFinite(part))) return null
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return null
}

export function formatTimeline(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total)) return '--:--'

  const safe = Math.max(total, 0)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const secs = Math.floor(safe % 60)
  const pad = value => String(value).padStart(2, '0')
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`
}

export function getYoutubeVideoId(url = '') {
  const text = String(url || '').trim()
  if (!text) return ''

  try {
    const parsed = new URL(text)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.replace(/^\//, '')
    if (parsed.pathname.includes('/shorts/')) return parsed.pathname.split('/shorts/')[1]?.split('/')[0] || ''
    if (parsed.pathname.includes('/embed/')) return parsed.pathname.split('/embed/')[1]?.split('/')[0] || ''
    return parsed.searchParams.get('v') || ''
  } catch {
    const match = text.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{6,})/)
    return match?.[1] || ''
  }
}

export function getFeedbackVideoEmbedUrl(url = '') {
  const videoId = getYoutubeVideoId(url)
  if (!videoId) return ''
  const params = new URLSearchParams({
    controls: '1',
    enablejsapi: '1',
    fs: '0',
    iv_load_policy: '3',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
  })

  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin)
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

export function isFeedbackShareToken(value = '') {
  return /^[A-Z2-9]{12,40}$/.test(String(value || '').trim())
}

export function getFeedbackAccessFromSearch(search = '', pathToken = '') {
  const params = new URLSearchParams(search)
  const queryToken = params.get('token') || params.get('share_token') || ''
  return {
    token: queryToken || (isFeedbackShareToken(pathToken) ? pathToken : ''),
  }
}

export function getFeedbackPublicPath(feedback) {
  if (!feedback?.share_token) return '/feedbacks'
  return `/feedbacks/${encodeURIComponent(feedback.share_token)}`
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Không đọc được ảnh.'))
    }
    image.src = url
  })
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob), type, quality)
  })
}

function replaceFileExtension(fileName = 'feedback-image', extension = 'webp') {
  const base = String(fileName || 'feedback-image').replace(/\.[^.]+$/, '') || 'feedback-image'
  return `${base}.${extension}`
}

export async function prepareFeedbackImageUpload(file, {
  maxEdge = 1600,
  maxBytes = 3 * 1024 * 1024,
  quality = 0.82,
} = {}) {
  if (!file?.type?.startsWith('image/')) throw new Error('Chỉ upload file ảnh.')

  const image = await loadImageFromFile(file)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  if (!width || !height) throw new Error('Ảnh upload không hợp lệ.')

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Trình duyệt không hỗ trợ nén ảnh.')

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  const attempts = [
    ['image/webp', quality],
    ['image/webp', 0.74],
    ['image/jpeg', quality],
    ['image/jpeg', 0.74],
    ['image/jpeg', 0.66],
  ]

  let selectedBlob = null
  for (const [type, attemptQuality] of attempts) {
    const blob = await canvasToBlob(canvas, type, attemptQuality)
    if (!blob) continue
    if (!selectedBlob || blob.size < selectedBlob.size) selectedBlob = blob
    if (blob.size <= maxBytes) {
      selectedBlob = blob
      break
    }
  }

  if (!selectedBlob) throw new Error('Không nén được ảnh.')
  if (selectedBlob.size > maxBytes) throw new Error('Ảnh quá lớn, vui lòng chọn ảnh nhẹ hơn.')

  const extension = selectedBlob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([selectedBlob], replaceFileExtension(file.name, extension), {
    type: selectedBlob.type,
    lastModified: Date.now(),
  })
}
