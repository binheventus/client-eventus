// Tầng điều phối tách biệt cho trợ lý feedback AI.
// Nhận `feedback` đã được handler cấp quyền (qua assertFeedbackAccess), tự nạp comment
// chưa sửa, map sang input AI rồi gọi client thuần `claude-feedback-summary.js`.
// KHÔNG chứa logic auth. Mọi lỗi AI degrade mềm thành { source: 'ai_unavailable' }.

import { createHash } from 'node:crypto'
import { query, tables } from './mysql.js'
import {
  getAiModelName,
  hasAnthropicKey,
  rewriteReply as rewriteReplyWithClaude,
  summarizeFeedbackComments,
} from './claude-feedback-summary.js'

const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000

// Client mặc định = tầng AI thuần. Cho phép override trong test (mock).
const defaultClient = {
  hasAnthropicKey,
  getAiModelName,
  summarizeFeedbackComments,
  rewriteReply: rewriteReplyWithClaude,
}

// Loader mặc định: chỉ lấy comment CHƯA sửa (is_done_1 = 0) của bản feedback.
async function defaultFetchComments(feedbackId) {
  if (!feedbackId) return []
  return query(
    `select id, time_comment_1, comment_1, author_name, is_done_1
     from ${tables.feedbackComments}
     where feedback_id = ? and coalesce(is_done_1, 0) = 0
     order by coalesce(time_comment_1, time_comment_2, 999999), created_at asc`,
    [feedbackId],
  )
}

// Lọc lại theo is_done_1 = 0 (phòng khi loader trả cả comment đã sửa) và map sang input AI.
export function toAiComments(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter(row => Number(row?.is_done_1 ?? 0) === 0)
    .map(row => ({
      comment_id: String(row?.id ?? row?.comment_id ?? '').trim(),
      time_comment_1: Number.isFinite(Number(row?.time_comment_1)) ? Number(row.time_comment_1) : null,
      comment_1: String(row?.comment_1 ?? '').trim(),
      author_name: String(row?.author_name ?? '').trim() || null,
    }))
    .filter(comment => comment.comment_id && comment.comment_1)
}

const summaryCache = new Map()

function pruneSummaryCache(now = Date.now()) {
  for (const [key, entry] of summaryCache) {
    if (entry.expiresAt <= now) summaryCache.delete(key)
  }
}

function buildSummaryCacheKey(feedbackId, aiComments) {
  const fingerprint = aiComments.map(comment => [
    comment.comment_id,
    comment.time_comment_1 ?? '',
    comment.comment_1,
  ].join('')).join('')
  return createHash('sha1').update(`${feedbackId}${fingerprint}`).digest('hex')
}

function getCachedSummary(key) {
  if (!key) return null
  const entry = summaryCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    summaryCache.delete(key)
    return null
  }
  return entry.value
}

function setCachedSummary(key, value) {
  if (!key) return
  pruneSummaryCache()
  summaryCache.set(key, { value, expiresAt: Date.now() + SUMMARY_CACHE_TTL_MS })
}

export function clearFeedbackSummaryCache() {
  summaryCache.clear()
}

export async function summarizeComments(feedback, options = {}) {
  const client = options.client || defaultClient
  const fetchComments = options.fetchComments || defaultFetchComments

  if (!feedback?.id) return { source: 'ai_unavailable', reason: 'no_feedback' }
  if (!client.hasAnthropicKey()) return { source: 'ai_unavailable', reason: 'no_api_key' }

  let aiComments
  try {
    aiComments = toAiComments(await fetchComments(feedback.id))
  } catch (error) {
    console.warn(`[feedback-ai] fetch comments failed: ${error?.message || error}`)
    return { source: 'ai_unavailable', reason: 'fetch_failed' }
  }

  if (!aiComments.length) {
    return { source: 'ai_unavailable', reason: 'no_comments', unresolved_count: 0 }
  }

  const cacheKey = buildSummaryCacheKey(feedback.id, aiComments)
  const cached = getCachedSummary(cacheKey)
  if (cached) return { ...cached, cached: true }

  try {
    const result = await client.summarizeFeedbackComments(aiComments, options)
    const payload = {
      source: 'ai',
      model: client.getAiModelName(),
      unresolved_count: aiComments.length,
      cached: false,
      ...result,
    }
    setCachedSummary(cacheKey, payload)
    return payload
  } catch (error) {
    console.warn(`[feedback-ai] summarize failed: ${error?.code || error?.message || error}`)
    return { source: 'ai_unavailable', reason: error?.code || 'error' }
  }
}

export async function rewriteReply({ rawText = '', context = '', tone = '' } = {}, options = {}) {
  const client = options.client || defaultClient
  const text = String(rawText || '').trim()
  if (!text) {
    const error = new Error('Thiếu nội dung lý do để viết lại.')
    error.code = 'EMPTY_RAW_TEXT'
    error.status = 400
    throw error
  }
  if (!client.hasAnthropicKey()) return { source: 'ai_unavailable', reason: 'no_api_key' }

  try {
    const result = await client.rewriteReply(text, {
      context: String(context || '').trim() || undefined,
      tone: String(tone || '').trim() || undefined,
      ...options,
    })
    const replies = (Array.isArray(result?.replies) ? result.replies : [])
      .map(reply => String(reply || '').trim())
      .filter(Boolean)
    if (!replies.length) return { source: 'ai_unavailable', reason: 'empty_result' }
    return { source: 'ai', model: client.getAiModelName(), replies }
  } catch (error) {
    console.warn(`[feedback-ai] rewrite failed: ${error?.code || error?.message || error}`)
    return { source: 'ai_unavailable', reason: error?.code || 'error' }
  }
}

export function probe(options = {}) {
  const client = options.client || defaultClient
  const available = client.hasAnthropicKey()
  return {
    ai_available: available,
    model: available ? client.getAiModelName() : null,
  }
}
