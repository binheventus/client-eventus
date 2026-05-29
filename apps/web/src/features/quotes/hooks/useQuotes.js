import { useCallback, useState } from 'react'
import { redirectToLoginIfAuthRequired } from '../lib/authRedirect'
import { buildQuoteApiPath } from '../lib/quoteQueryFilters'

const PRIVILEGED_ROLES = new Set(['leader', 'admin'])

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(String(role || '').toLowerCase())
}

async function requestQuoteApi(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`/api/quotes${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Quote API unavailable.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    redirectToLoginIfAuthRequired(response, payload)
    const error = new Error(payload?.error || 'Không gọi được Quote API.')
    error.status = response.status
    error.code = payload?.code
    throw error
  }

  return payload
}

export async function listQuotes({ filters = {}, page = 1, pageSize = 20 } = {}) {
  return requestQuoteApi(buildQuoteApiPath({ filters, page, pageSize }))
}

export async function listQuoteClients() {
  const result = await requestQuoteApi('?resource=clients')
  return result.clients || []
}

export async function getQuote(id) {
  if (!id) throw new Error('Thiếu quote id.')
  const result = await requestQuoteApi(buildQuoteApiPath({ id }))
  return result.quote
}

export async function getQuoteViewStats(quoteId) {
  if (!quoteId) return { count: 0, lastViewedAt: null, views: [] }
  return requestQuoteApi(buildQuoteApiPath({ stats_id: quoteId }))
}

export async function getQuoteAuditLogs(quoteId) {
  if (!quoteId) return []
  const result = await requestQuoteApi(buildQuoteApiPath({ audit_id: quoteId }))
  return result.logs || []
}

export async function createQuote(payload = {}) {
  const result = await requestQuoteApi('', { method: 'POST', body: payload })
  return result.quote
}

export async function updateQuote(id, patch = {}) {
  if (!id) throw new Error('Thiếu quote id.')
  const result = await requestQuoteApi('', {
    method: 'PATCH',
    body: { id, patch },
  })
  return result.quote
}

export async function softDeleteQuote(id) {
  return updateQuote(id, { deleted_at: new Date().toISOString() })
}

export async function duplicateQuote(id) {
  if (!id) throw new Error('Thiếu quote id.')
  const result = await requestQuoteApi('', {
    method: 'POST',
    body: { action: 'duplicate', id },
  })
  return result.quote
}

export async function restoreQuote(id, { role } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để khôi phục báo giá.')
  return updateQuote(id, { deleted_at: null })
}

export async function listTrashed({ role, page = 1, pageSize = 20 } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để xem thùng rác báo giá.')
  return requestQuoteApi(buildQuoteApiPath({ page, pageSize, trash: 1 }))
}

export async function permanentlyDeleteQuote(id, { role } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để xóa vĩnh viễn báo giá.')
  await requestQuoteApi(buildQuoteApiPath({ id, hard: 1 }), { method: 'DELETE' })
}

export async function getPublicQuoteByToken(shareToken) {
  if (!shareToken) throw new Error('Thiếu share token.')
  const result = await requestQuoteApi(buildQuoteApiPath({ share_token: shareToken }))
  return result.quote
}

export async function logQuoteView(quoteId) {
  if (!quoteId) return
  await requestQuoteApi('', {
    method: 'POST',
    body: { action: 'view', quote_id: quoteId },
  })
}

export function useQuotes({ role } = {}) {
  const [quotes, setQuotes] = useState([])
  const [selectedQuote, setSelectedQuote] = useState(null)
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

  const loadQuotes = useCallback(async (params) => run(async () => {
    const result = await listQuotes(params)
    setQuotes(result.quotes)
    return result
  }), [run])

  const loadQuote = useCallback(async (id) => run(async () => {
    const quote = await getQuote(id)
    setSelectedQuote(quote)
    return quote
  }), [run])

  const addQuote = useCallback(async (payload) => run(async () => createQuote(payload)), [run])
  const patchQuote = useCallback(async (id, patch) => run(async () => updateQuote(id, patch)), [run])
  const removeQuote = useCallback(async (id) => run(async () => softDeleteQuote(id)), [run])
  const duplicate = useCallback(async (id) => run(async () => duplicateQuote(id)), [run])
  const restore = useCallback(async (id) => run(async () => restoreQuote(id, { role })), [run, role])
  const loadTrashed = useCallback(async (params = {}) => run(async () => {
    const result = await listTrashed({ ...params, role })
    setQuotes(result.quotes)
    return result
  }), [run, role])

  return {
    quotes,
    selectedQuote,
    loading,
    error,
    loadQuotes,
    loadQuote,
    createQuote: addQuote,
    updateQuote: patchQuote,
    softDeleteQuote: removeQuote,
    duplicateQuote: duplicate,
    restoreQuote: restore,
    listTrashed: loadTrashed,
  }
}
