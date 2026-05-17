import { useCallback, useState } from 'react'
import { fromQuoteTable } from '../../../lib/supabase'

const PRIVILEGED_ROLES = new Set(['leader', 'admin'])

function isPrivilegedRole(role) {
  return PRIVILEGED_ROLES.has(String(role || '').toLowerCase())
}

function applyFilters(query, filters = {}) {
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if (key === 'search') {
      query = query.or(`quote_number.ilike.%${value}%,client_name.ilike.%${value}%,event_name.ilike.%${value}%`)
      return
    }

    if (key === 'date_from') {
      query = query.gte('created_at', value)
      return
    }

    if (key === 'date_to') {
      query = query.lte('created_at', value)
      return
    }

    if (Array.isArray(value)) {
      query = query.in(key, value)
      return
    }

    query = query.eq(key, value)
  })

  return query
}

function getMissingSchemaColumn(error) {
  if (!error) return ''
  const message = String(error.message || '')
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || ''
}

function getRecoverableInsertColumn(error, payload) {
  const missingColumn = getMissingSchemaColumn(error)
  if (missingColumn) return missingColumn

  const message = String(error?.message || '').toLowerCase()
  if (
    'validity_days' in payload &&
    (message.includes('quote_validity') ||
      message.includes('validity_days') ||
      (message.includes('cannot cast') && message.includes('integer')))
  ) {
    return 'validity_days'
  }

  if (
    'client_id' in payload &&
    (message.includes('client_id') ||
      (message.includes('uuid') && message.includes('invalid input syntax')))
  ) {
    return 'client_id'
  }

  if (
    'status' in payload &&
    (message.includes('quote_status') || (message.includes('status') && message.includes('enum')))
  ) {
    return 'status'
  }

  return ''
}

async function insertWithSchemaCacheRetry(tableKey, payload) {
  let nextPayload = { ...payload }
  const removedColumns = new Set()

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    const { data, error } = await fromQuoteTable(tableKey)
      .insert(nextPayload)
      .select()
      .single()

    const recoverableColumn = getRecoverableInsertColumn(error, nextPayload)
    if (!recoverableColumn || !(recoverableColumn in nextPayload) || removedColumns.has(recoverableColumn)) {
      if (error) throw error
      return data
    }

    removedColumns.add(recoverableColumn)
    const { [recoverableColumn]: _removed, ...payloadWithoutMissingColumn } = nextPayload
    nextPayload = payloadWithoutMissingColumn
  }

  throw new Error('Schema bảng quotes đang thiếu nhiều cột. Hãy chạy script docs/quotes-schema-fix.sql trong Supabase.')
}

async function insertManyWithSchemaCacheRetry(tableKey, payloads) {
  let nextPayloads = payloads.map(payload => ({ ...payload }))
  const removedColumns = new Set()

  const maxAttempts = Math.max(...payloads.map(payload => Object.keys(payload).length), 0)

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await fromQuoteTable(tableKey)
      .insert(nextPayloads)
      .select()

    const recoverableColumn = getRecoverableInsertColumn(error, nextPayloads[0] || {})
    if (!recoverableColumn || removedColumns.has(recoverableColumn)) {
      if (error) throw error
      return data || []
    }

    removedColumns.add(recoverableColumn)
    nextPayloads = nextPayloads.map(payload => {
      const { [recoverableColumn]: _removed, ...payloadWithoutMissingColumn } = payload
      return payloadWithoutMissingColumn
    })
  }

  throw new Error('Schema bảng quote_items đang thiếu nhiều cột. Hãy chạy script docs/quotes-schema-fix.sql trong Supabase.')
}

export async function listQuotes({ filters = {}, page = 1, pageSize = 20 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || 20, 1)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let query = fromQuoteTable('activeQuotes')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  query = applyFilters(query, filters)

  const { data, error, count } = await query
  if (error) throw error

  return {
    quotes: data || [],
    count: count || 0,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function getQuote(id) {
  if (!id) throw new Error('Thiếu quote id.')

  const { data: quote, error: quoteError } = await fromQuoteTable('quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (quoteError) throw quoteError

  const { data: items, error: itemsError } = await fromQuoteTable('quoteItems')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true })

  if (itemsError) throw itemsError
  return { ...quote, items: items || [] }
}

export async function getQuoteViewStats(quoteId) {
  if (!quoteId) return { count: 0, lastViewedAt: null, views: [] }

  const { data, error, count } = await fromQuoteTable('quoteViews')
    .select('*', { count: 'exact' })
    .eq('quote_id', quoteId)
    .order('viewed_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return {
    count: count || 0,
    lastViewedAt: data?.[0]?.viewed_at || null,
    views: data || [],
  }
}

export async function getQuoteAuditLogs(quoteId) {
  if (!quoteId) return []

  const auditResult = await fromQuoteTable('auditLogs')
    .select('*')
    .or(`entity_id.eq.${quoteId},quote_id.eq.${quoteId}`)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!auditResult.error) return auditResult.data || []

  const { items } = await getQuote(quoteId)
  return (items || [])
    .filter(item => item.is_overridden)
    .map(item => ({
      id: item.id || `${quoteId}-${item.service_code}`,
      action: 'price_override',
      created_at: item.updated_at || item.created_at,
      description: `Sửa giá ${item.service_name || item.service_code}: ${item.original_unit_price} -> ${item.unit_price}`,
      reason: item.override_reason,
    }))
}

export async function createQuote(payload = {}) {
  const { items = [], ...quotePayload } = payload

  const quote = await insertWithSchemaCacheRetry('quotes', quotePayload)

  if (!items.length) return { ...quote, items: [] }

  const quoteItems = items.map((item, index) => ({
    ...item,
    quote_id: quote.id,
    sort_order: item.sort_order ?? index + 1,
  }))

  const insertedItems = await insertManyWithSchemaCacheRetry('quoteItems', quoteItems)
  return { ...quote, items: insertedItems || [] }
}

export async function updateQuote(id, patch = {}) {
  if (!id) throw new Error('Thiếu quote id.')

  const { data, error } = await fromQuoteTable('quotes')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function softDeleteQuote(id) {
  return updateQuote(id, { deleted_at: new Date().toISOString() })
}

export async function duplicateQuote(id) {
  const quote = await getQuote(id)
  const {
    id: _id,
    quote_number: _quoteNumber,
    share_token: _shareToken,
    created_at: _createdAt,
    updated_at: _updatedAt,
    deleted_at: _deletedAt,
    sent_at: _sentAt,
    items = [],
    ...quotePayload
  } = quote

  return createQuote({
    ...quotePayload,
    status: 'draft',
    event_name: `${quote.event_name || 'Báo giá'} (copy)`,
    items: items.map(item => {
      const {
        id: _itemId,
        quote_id: _quoteId,
        created_at: _itemCreatedAt,
        updated_at: _itemUpdatedAt,
        ...itemPayload
      } = item
      return itemPayload
    }),
  })
}

export async function restoreQuote(id, { role } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để khôi phục báo giá.')
  return updateQuote(id, { deleted_at: null })
}

export async function listTrashed({ role, page = 1, pageSize = 20 } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để xem thùng rác báo giá.')

  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || 20, 1)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1

  let response = await fromQuoteTable('trashedQuotes')
    .select('*', { count: 'exact' })
    .order('deleted_at', { ascending: false })
    .range(from, to)

  if (response.error) {
    response = await fromQuoteTable('quotes')
      .select('*', { count: 'exact' })
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(from, to)
  }

  if (response.error) throw response.error

  return {
    quotes: response.data || [],
    count: response.count || 0,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function permanentlyDeleteQuote(id, { role } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để xóa vĩnh viễn báo giá.')

  await fromQuoteTable('quoteViews').delete().eq('quote_id', id)
  const { error: itemsError } = await fromQuoteTable('quoteItems').delete().eq('quote_id', id)
  if (itemsError) throw itemsError

  const { error } = await fromQuoteTable('quotes').delete().eq('id', id)
  if (error) throw error
}

export async function getPublicQuoteByToken(shareToken) {
  if (!shareToken) throw new Error('Thiếu share token.')

  const { data: quote, error } = await fromQuoteTable('quotes')
    .select('*')
    .eq('share_token', shareToken)
    .is('deleted_at', null)
    .single()

  if (error) throw error

  const { data: items, error: itemsError } = await fromQuoteTable('quoteItems')
    .select('*')
    .eq('quote_id', quote.id)
    .order('sort_order', { ascending: true })

  if (itemsError) throw itemsError
  return { ...quote, items: items || [] }
}

export async function logQuoteView(quoteId) {
  if (!quoteId) return

  await fromQuoteTable('quoteViews')
    .insert({
      quote_id: quoteId,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      viewed_at: new Date().toISOString(),
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
    listQuotes: loadQuotes,
    getQuote: loadQuote,
    createQuote: addQuote,
    updateQuote: patchQuote,
    softDeleteQuote: removeQuote,
    duplicateQuote: duplicate,
    restoreQuote: restore,
    listTrashed: loadTrashed,
  }
}
