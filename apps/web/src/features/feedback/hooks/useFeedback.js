import { useCallback, useState } from 'react'
import { redirectToLoginIfAuthRequired } from '../../quotes/lib/authRedirect'

async function requestFeedbackApi(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`/api/feedback${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
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

async function requestFeedbackFormApi(path = '', formData) {
  const response = await fetch(`/api/feedback${path}`, {
    method: 'POST',
    body: formData,
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

function buildQuery(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

export async function listFeedbackJobs({ search = '', page = 1, pageSize = 20, feedbackStatus = '' } = {}) {
  return requestFeedbackApi(buildQuery({ resource: 'jobs', search, page, pageSize, feedback_status: feedbackStatus }))
}

export async function listFeedbacks({ search = '', jobId = '', page = 1, pageSize = 20, feedbackStatus = '' } = {}) {
  return requestFeedbackApi(buildQuery({ resource: 'feedbacks', search, job_id: jobId, page, pageSize, feedback_status: feedbackStatus }))
}

export async function ensureFeedback(jobId) {
  const result = await requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'ensure_feedback',
      job_id: jobId,
    },
  })
  return result.feedback
}

export async function createFeedback({
  jobId,
  feedbackId,
  access,
  feedback,
  cloneUnresolved = false,
  cloneUnresolvedFromFeedbackId = '',
}) {
  const result = await requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'create_feedback',
      job_id: jobId,
      feedback_id: feedbackId,
      access,
      feedback,
      clone_unresolved_feedbacks: cloneUnresolved,
      clone_unresolved_from_feedback_id: cloneUnresolvedFromFeedbackId,
    },
  })
  return result.feedback
}

export async function getFeedbackDetail(id, access = {}) {
  return requestFeedbackApi(buildQuery({
    resource: 'feedback',
    id,
  }))
}

export async function saveFeedbackSetup(id, patch = {}, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'save_feedback_setup',
      id,
      access,
      patch,
    },
  })
}

export async function createFeedbackComment(feedbackId, payload = {}, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'create_comment',
      feedback_id: feedbackId,
      access,
      ...payload,
    },
  })
}

export async function updateFeedbackComment(commentId, column, value, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'update_comment',
      id: commentId,
      column,
      value,
      access,
    },
  })
}

export async function deleteFeedbackComment(commentId, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'delete_comment',
      id: commentId,
      access,
    },
  })
}

export async function uploadFeedbackAttachment(commentId, payload = {}, access = {}) {
  const formData = new FormData()
  formData.append('action', 'upload_attachment')
  formData.append('comment_id', commentId)
  formData.append('field_name', payload.field_name || 'comment_1')
  if (access?.token) formData.append('token', access.token)
  if (payload.file) {
    formData.append('image', payload.file, payload.file.name || payload.file_name || 'feedback-image.webp')
  }
  return requestFeedbackFormApi('', formData)
}

export async function deleteFeedbackAttachment(attachmentId, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'delete_attachment',
      id: attachmentId,
      access,
    },
  })
}

export async function toggleFeedbackMoreColumn(feedbackId, value, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'toggle_more_column',
      id: feedbackId,
      value,
      access,
    },
  })
}

export async function updateOverallFeedback(feedbackId, payload = {}, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'overall_feedback',
      id: feedbackId,
      access,
      ...payload,
    },
  })
}

export async function markFeedbackDone(feedbackId, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'feedback_done',
      id: feedbackId,
      access,
    },
  })
}

export async function deleteFeedback(feedbackId, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'delete_feedback',
      id: feedbackId,
      access,
    },
  })
}

export async function clearFeedbackColumn(feedbackId, payload = {}, access = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'clear_column',
      id: feedbackId,
      access,
      ...payload,
    },
  })
}

export async function getFeedbackSurvey({ jobId, surveyType = 'general' } = {}) {
  return requestFeedbackApi(buildQuery({ resource: 'survey', job: jobId, survey_type: surveyType }))
}

export async function submitFeedbackSurvey(payload = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'submit_survey',
      ...payload,
    },
  })
}

export async function getFeedbackGallery(shareToken) {
  return requestFeedbackApi(buildQuery({ resource: 'gallery', share_token: shareToken }))
}

export async function markFeedbackJobDone(payload = {}) {
  return requestFeedbackApi('', {
    method: 'POST',
    body: {
      action: 'job_done',
      ...payload,
    },
  })
}

export function useFeedback() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const run = useCallback(async (operation) => {
    setLoading(true)
    setError(null)
    try {
      return await operation()
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    run,
  }
}
