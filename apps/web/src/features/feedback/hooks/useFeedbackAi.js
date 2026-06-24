// Client API riêng cho trợ lý feedback AI. Tách khỏi useFeedback.js chung để dễ gỡ.
import { redirectToLoginIfAuthRequired } from '../../quotes/lib/authRedirect'

async function requestFeedbackApi(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`/api/feedback${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Feedback API unavailable.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    redirectToLoginIfAuthRequired(response, payload)
    const error = new Error(payload?.error || 'Không gọi được Feedback API.')
    error.status = response.status
    error.code = payload?.code
    throw error
  }

  return payload
}

export async function probeFeedbackAi() {
  try {
    return await requestFeedbackApi('?resource=ai_probe')
  } catch {
    return { ai_available: false, model: null }
  }
}

export async function summarizeFeedbackComments(feedbackId, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'summarize_comments',
      feedback_id: feedbackId,
      access,
    },
  })
}

export async function rewriteFeedbackReply(feedbackId, { rawText = '', context = '', tone = '' } = {}, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'rewrite_reply',
      feedback_id: feedbackId,
      access,
      raw_text: rawText,
      context,
      tone,
    },
  })
}
