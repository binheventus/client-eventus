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
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? `&origin=${encodeURIComponent(window.location.origin)}`
    : ''
  return `https://www.youtube.com/embed/${videoId}?rel=0&enablejsapi=1${origin}`
}

export function isFeedbackShareToken(value = '') {
  return /^[A-Z2-9]{12,40}$/.test(String(value || '').trim())
}

export function getFeedbackAccessFromSearch(search = '', pathToken = '') {
  const params = new URLSearchParams(search)
  const queryToken = params.get('token') || params.get('share_token') || ''
  return {
    zalo: params.get('zalo') || '',
    token: queryToken || (isFeedbackShareToken(pathToken) ? pathToken : ''),
  }
}

export function getFeedbackPublicPath(feedback) {
  if (!feedback?.share_token) return '/feedbacks'
  return `/feedbacks/${encodeURIComponent(feedback.share_token)}`
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('Không đọc được file.'))
    reader.readAsDataURL(file)
  })
}
