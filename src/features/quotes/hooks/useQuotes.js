import { useCallback, useState } from 'react'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'

const PRIVILEGED_ROLES = new Set(['leader', 'admin'])
const LOCAL_QUOTES_KEY = 'eventus_local_quotes'
const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 7

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

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readLocalQuotes() {
  if (!canUseLocalStorage()) return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_QUOTES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalQuotes(quotes = []) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(quotes))
}

function makeLocalId(prefix = 'quote') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function makeShareToken() {
  const values = new Uint8Array(SHARE_TOKEN_LENGTH)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(values)
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * 256)
    }
  }

  return Array.from(values, value => SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]).join('')
}

function getLocalQuoteText(quote = {}) {
  return [
    quote.quote_number,
    quote.client_name,
    quote.event_name,
  ].filter(Boolean).join(' ').toLowerCase()
}

function applyLocalFilters(quotes = [], filters = {}) {
  return quotes.filter(quote => {
    if (quote.deleted_at) return false
    if (filters.search && !getLocalQuoteText(quote).includes(String(filters.search).toLowerCase())) return false
    if (filters.date_from && String(quote.created_at || '') < filters.date_from) return false
    if (filters.date_to && String(quote.created_at || '') > filters.date_to) return false

    return Object.entries(filters || {}).every(([key, value]) => {
      if (['search', 'date_from', 'date_to'].includes(key)) return true
      if (value === undefined || value === null || value === '') return true
      if (Array.isArray(value)) return value.includes(quote[key])
      return quote[key] === value
    })
  })
}

function makeLocalQuoteNumber(quotes = []) {
  const nextNumber = quotes.length + 1
  return `LOCAL-${String(nextNumber).padStart(4, '0')}`
}

function listLocalQuotes({ filters = {}, page = 1, pageSize = 20 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || 20, 1)
  const from = (safePage - 1) * safePageSize
  const rows = applyLocalFilters(readLocalQuotes(), filters)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))

  return {
    quotes: rows.slice(from, from + safePageSize),
    count: rows.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

function getLocalQuote(id) {
  const quote = readLocalQuotes().find(row => row.id === id)
  if (!quote) throw new Error('Không tìm thấy báo giá local.')
  return quote
}

function createLocalQuote(payload = {}) {
  const quotes = readLocalQuotes()
  const now = new Date().toISOString()
  const { items = [], ...quotePayload } = payload
  const quoteCode = quotePayload.id || quotePayload.share_token || makeShareToken()
  const quote = {
    ...quotePayload,
    id: quoteCode,
    quote_number: makeLocalQuoteNumber(quotes),
    share_token: quotePayload.share_token || quoteCode,
    created_at: now,
    updated_at: now,
    items: items.map((item, index) => ({
      ...item,
      id: makeLocalId('item'),
      sort_order: item.sort_order ?? index + 1,
    })),
    is_local_only: true,
  }

  writeLocalQuotes([quote, ...quotes])
  return quote
}

function updateLocalQuote(id, patch = {}) {
  let updated = null
  const quotes = readLocalQuotes().map(quote => {
    if (quote.id !== id) return quote
    updated = { ...quote, ...patch, updated_at: new Date().toISOString() }
    return updated
  })

  if (!updated) throw new Error('Không tìm thấy báo giá local.')
  writeLocalQuotes(quotes)
  return updated
}

function duplicateLocalQuote(id) {
  const source = getLocalQuote(id)
  const {
    id: _id,
    quote_number: _quoteNumber,
    share_token: _shareToken,
    created_at: _createdAt,
    updated_at: _updatedAt,
    deleted_at: _deletedAt,
    sent_at: _sentAt,
    ...quotePayload
  } = source

  return createLocalQuote({
    ...quotePayload,
    status: 'draft',
    event_name: `${source.event_name || 'Báo giá'} (copy)`,
    items: source.items || [],
  })
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

function canUseQuoteApi() {
  return typeof window !== 'undefined' && hasSupabaseConfig
}

function shouldFallbackToSupabase(error) {
  const message = String(error?.message || '')
  return Boolean(error?.quoteApiUnavailable) ||
    [404, 405, 501].includes(Number(error?.status)) ||
    message.includes('Thieu SUPABASE') ||
    message.includes('Thiếu SUPABASE')
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
    const error = new Error('Quote API unavailable.')
    error.quoteApiUnavailable = true
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error || 'Không gọi được Quote API.')
    error.status = response.status
    error.code = payload?.code
    throw error
  }

  return payload
}

function getQuoteApiPath(params = {}) {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return

    if (key === 'filters') {
      Object.entries(value || {}).forEach(([filterKey, filterValue]) => {
        if (filterValue === undefined || filterValue === null || filterValue === '') return
        if (Array.isArray(filterValue)) {
          if (filterValue.length) searchParams.set(filterKey, filterValue.join(','))
          return
        }
        searchParams.set(filterKey, String(filterValue))
      })
      return
    }

    searchParams.set(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

function isMissingCachedRelation(error, relationName) {
  const message = String(error?.message || '').toLowerCase()
  return message.includes(relationName.toLowerCase()) &&
    (message.includes('schema cache') || message.includes('could not find') || error?.code === 'PGRST205')
}

async function listSupabaseQuotes({ filters = {}, page = 1, pageSize = 20, trash = false } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || 20, 1)
  const from = (safePage - 1) * safePageSize
  const to = from + safePageSize - 1
  const viewKey = trash ? 'trashedQuotes' : 'activeQuotes'
  const viewName = trash ? 'trashed_quotes' : 'active_quotes'
  const orderColumn = trash ? 'deleted_at' : 'created_at'

  let query = fromQuoteTable(viewKey)
    .select('*', { count: 'exact' })
    .order(orderColumn, { ascending: false })
    .range(from, to)

  query = applyFilters(query, filters)
  let response = await query

  if (response.error && isMissingCachedRelation(response.error, viewName)) {
    let fallbackQuery = fromQuoteTable('quotes')
      .select('*', { count: 'exact' })

    fallbackQuery = trash
      ? fallbackQuery.not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
      : fallbackQuery.is('deleted_at', null).order('created_at', { ascending: false })

    fallbackQuery = applyFilters(fallbackQuery, filters).range(from, to)
    response = await fallbackQuery
  }

  if (response.error) throw response.error

  return {
    quotes: response.data || [],
    count: response.count || 0,
    page: safePage,
    pageSize: safePageSize,
  }
}

async function getSupabaseQuote(id) {
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

async function getSupabasePublicQuoteByToken(shareToken) {
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

function listLocalTrashed({ page = 1, pageSize = 20 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1)
  const safePageSize = Math.max(Number(pageSize) || 20, 1)
  const from = (safePage - 1) * safePageSize
  const rows = readLocalQuotes()
    .filter(quote => quote.deleted_at)
    .sort((a, b) => String(b.deleted_at || '').localeCompare(String(a.deleted_at || '')))

  return {
    quotes: rows.slice(from, from + safePageSize),
    count: rows.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

export async function listQuotes({ filters = {}, page = 1, pageSize = 20 } = {}) {
  if (!hasSupabaseConfig) return listLocalQuotes({ filters, page, pageSize })

  if (canUseQuoteApi()) {
    try {
      return await requestQuoteApi(getQuoteApiPath({ filters, page, pageSize }))
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  return listSupabaseQuotes({ filters, page, pageSize })
}

export async function getQuote(id) {
  if (!id) throw new Error('Thiếu quote id.')
  if (!hasSupabaseConfig) return getLocalQuote(id)

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi(getQuoteApiPath({ id }))
      return result.quote
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  return getSupabaseQuote(id)
}

export async function getQuoteViewStats(quoteId) {
  if (!quoteId) return { count: 0, lastViewedAt: null, views: [] }
  if (!hasSupabaseConfig) return { count: 0, lastViewedAt: null, views: [] }

  if (canUseQuoteApi()) {
    try {
      return await requestQuoteApi(getQuoteApiPath({ stats_id: quoteId }))
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

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
  if (!hasSupabaseConfig) return []

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi(getQuoteApiPath({ audit_id: quoteId }))
      return result.logs || []
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

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
  if (!hasSupabaseConfig) return createLocalQuote(payload)

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi('', { method: 'POST', body: payload })
      return result.quote
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  const quoteCode = payload.id || payload.share_token || makeShareToken()
  const nextPayload = {
    ...payload,
    id: payload.id || quoteCode,
    share_token: payload.share_token || quoteCode,
  }
  const { items = [], ...quotePayload } = nextPayload

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
  if (!hasSupabaseConfig) return updateLocalQuote(id, patch)

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi('', {
        method: 'PATCH',
        body: { id, patch },
      })
      return result.quote
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  const { items, ...quotePatch } = patch
  const { data, error } = await fromQuoteTable('quotes')
    .update({ ...quotePatch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (!Array.isArray(items)) return data

  const { error: deleteError } = await fromQuoteTable('quoteItems')
    .delete()
    .eq('quote_id', id)

  if (deleteError) throw deleteError

  const quoteItems = items.map((item, index) => ({
    ...item,
    quote_id: id,
    sort_order: item.sort_order ?? index + 1,
  }))
  const insertedItems = await insertManyWithSchemaCacheRetry('quoteItems', quoteItems)

  return { ...data, items: insertedItems || [] }
}

export async function softDeleteQuote(id) {
  return updateQuote(id, { deleted_at: new Date().toISOString() })
}

export async function duplicateQuote(id) {
  if (!hasSupabaseConfig) return duplicateLocalQuote(id)

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi('', {
        method: 'POST',
        body: { action: 'duplicate', id },
      })
      return result.quote
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

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
  if (!hasSupabaseConfig) return listLocalTrashed({ page, pageSize })

  if (canUseQuoteApi()) {
    try {
      return await requestQuoteApi(getQuoteApiPath({ page, pageSize, trash: 1 }))
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  return listSupabaseQuotes({ page, pageSize, trash: true })
}

export async function permanentlyDeleteQuote(id, { role } = {}) {
  if (!isPrivilegedRole(role)) throw new Error('Bạn cần quyền leader/admin để xóa vĩnh viễn báo giá.')
  if (!hasSupabaseConfig) {
    writeLocalQuotes(readLocalQuotes().filter(quote => quote.id !== id))
    return
  }

  if (canUseQuoteApi()) {
    try {
      await requestQuoteApi(getQuoteApiPath({ id, hard: 1 }), { method: 'DELETE' })
      return
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  await fromQuoteTable('quoteViews').delete().eq('quote_id', id)
  const { error: itemsError } = await fromQuoteTable('quoteItems').delete().eq('quote_id', id)
  if (itemsError) throw itemsError

  const { error } = await fromQuoteTable('quotes').delete().eq('id', id)
  if (error) throw error
}

export async function getPublicQuoteByToken(shareToken) {
  if (!shareToken) throw new Error('Thiếu share token.')
  if (!hasSupabaseConfig) {
    const quote = readLocalQuotes().find(row => row.share_token === shareToken && !row.deleted_at)
    if (!quote) throw new Error('Không tìm thấy báo giá local.')
    return quote
  }

  if (canUseQuoteApi()) {
    try {
      const result = await requestQuoteApi(getQuoteApiPath({ share_token: shareToken }))
      return result.quote
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) throw error
    }
  }

  return getSupabasePublicQuoteByToken(shareToken)
}

export async function logQuoteView(quoteId) {
  if (!quoteId) return
  if (!hasSupabaseConfig) return

  if (canUseQuoteApi()) {
    try {
      await requestQuoteApi('', {
        method: 'POST',
        body: { action: 'view', quote_id: quoteId },
      })
      return
    } catch (error) {
      if (!shouldFallbackToSupabase(error)) return
    }
  }

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
