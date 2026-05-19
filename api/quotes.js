import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { applySupabaseQuoteFilters } from '../src/features/quotes/lib/quoteQueryFilters.js'

const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 7
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000'
const DEFAULT_ENTITY_CODE = 'EVENTUS'
const DEFAULT_TIER_CODE = 'TIER_2'
const RECOVERABLE_FK_COLUMNS = new Set(['client_id'])
const VALID_TIER_CODES = new Set(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_5'])
const LIST_QUOTE_COLUMNS = [
  'id',
  'quote_number',
  'client_name',
  'event_name',
  'total_amount',
  'status',
  'created_by',
  'created_by_name',
  'sales_name',
  'created_at',
  'deleted_at',
  'tier_code',
  'entity_code',
  'share_token',
  'sent_at',
  'validity_days',
].join(',')

function makeShareToken() {
  return Array.from(randomBytes(SHARE_TOKEN_LENGTH), value => (
    SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]
  )).join('')
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY tren Vercel.')
    error.statusCode = 501
    throw error
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function sendError(res, error, fallback = 'Khong xu ly duoc bao gia.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

function getRequestBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function getPositiveInteger(value, fallback) {
  const number = Number(getQueryValue(value))
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function getFilters(query = {}) {
  return [
    'search',
    'status',
    'tier_code',
    'entity_code',
    'created_by',
    'date_from',
    'date_to',
  ].reduce((filters, key) => {
    const value = getQueryValue(query[key], '')
    if (value !== '') filters[key] = value
    return filters
  }, {})
}

function getMissingSchemaColumn(error) {
  const message = String(error?.message || '')
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || ''
}

function getRecoverableInsertColumn(error, payload = {}) {
  const missingColumn = getMissingSchemaColumn(error)
  if (missingColumn) return missingColumn

  const message = String(error?.message || '').toLowerCase()
  const foreignKeyColumn = getRecoverableForeignKeyColumn(error, payload)
  if (foreignKeyColumn) return foreignKeyColumn

  if (
    'validity_days' in payload &&
    (message.includes('quote_validity') ||
      message.includes('validity_days') ||
      (message.includes('cannot cast') && message.includes('integer')))
  ) {
    return 'validity_days'
  }

  if (
    'id' in payload &&
    message.includes('invalid input syntax') &&
    message.includes('uuid') &&
    message.includes(String(payload.id).toLowerCase())
  ) {
    return 'id'
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

function getRecoverableForeignKeyColumn(error, payload = {}) {
  if (error?.code !== '23503') return ''

  const detail = String(error?.details || '')
  const keyMatch = detail.match(/Key \(([^)]+)\)=/i)
  const detailColumn = keyMatch?.[1]?.split(',')?.[0]?.trim()
  if (detailColumn && RECOVERABLE_FK_COLUMNS.has(detailColumn) && detailColumn in payload) {
    return detailColumn
  }

  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  for (const column of RECOVERABLE_FK_COLUMNS) {
    if (column in payload && message.includes(column)) return column
  }

  return ''
}

function isQuoteCodeCollision(error) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '23505' && (
    message.includes('share_token') ||
    message.includes('quotes_pkey') ||
    message.includes('quotes_id')
  )
}

function getRequiredReferenceColumn(error) {
  if (error?.code !== '23503') return ''

  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return ['entity_code', 'tier_code', 'service_code', 'created_by']
    .find(column => message.includes(column)) || ''
}

function makeReferenceSetupError(error) {
  const column = getRequiredReferenceColumn(error)
  if (!column) return error

  const setupError = new Error(
    `Production DB dang ep foreign key cho ${column}. Hay chay docs/quotes-production-simplify.sql de don gian hoa schema quote.`
  )
  setupError.code = error?.code
  setupError.statusCode = 500
  return setupError
}

async function insertWithSchemaRetry(supabase, tableName, payload) {
  let nextPayload = { ...payload }
  const removedColumns = new Set()

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    const { data, error } = await supabase
      .from(tableName)
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

  throw new Error(`Schema bang ${tableName} dang thieu nhieu cot. Hay chay docs/quotes-schema-fix.sql trong Supabase.`)
}

async function insertManyWithSchemaRetry(supabase, tableName, payloads) {
  if (!payloads.length) return []

  let nextPayloads = payloads.map(payload => ({ ...payload }))
  const removedColumns = new Set()
  const maxAttempts = Math.max(...payloads.map(payload => Object.keys(payload).length), 0)

  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from(tableName)
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

  throw new Error(`Schema bang ${tableName} dang thieu nhieu cot. Hay chay docs/quotes-schema-fix.sql trong Supabase.`)
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function normalizeEntityCode(value) {
  const code = normalizeCode(value || DEFAULT_ENTITY_CODE)
  if (['EVENTUS', 'EVT', 'EVENTUS VIET NAM', 'CONG TY TNHH EVENTUS VIET NAM'].includes(code)) return 'EVENTUS'
  if (['MEDIAMONSTER', 'MEDIA_MONSTER', 'MMS'].includes(code)) return 'MEDIAMONSTER'
  return code || DEFAULT_ENTITY_CODE
}

function normalizeTierCode(value) {
  const code = normalizeCode(value || DEFAULT_TIER_CODE).replace(/^TIER(\d)$/i, 'TIER_$1')
  return VALID_TIER_CODES.has(code) ? code : DEFAULT_TIER_CODE
}

async function getQuoteById(supabase, id) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error

  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('sort_order', { ascending: true })

  if (itemsError) throw itemsError
  return { ...quote, items: items || [] }
}

async function getQuoteByShareToken(supabase, shareToken) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('share_token', shareToken)
    .is('deleted_at', null)
    .single()

  if (error) throw error

  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quote.id)
    .order('sort_order', { ascending: true })

  if (itemsError) throw itemsError
  return { ...quote, items: items || [] }
}

async function listQuotes(supabase, queryParams = {}) {
  const page = getPositiveInteger(queryParams.page, 1)
  const pageSize = getPositiveInteger(queryParams.pageSize, 20)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const trash = ['1', 'true', 'yes'].includes(String(getQueryValue(queryParams.trash, '')).toLowerCase())
  const filters = getFilters(queryParams)

  let query = supabase
    .from('quotes')
    .select(LIST_QUOTE_COLUMNS, { count: 'estimated' })

  query = trash
    ? query.not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    : query.is('deleted_at', null).order('created_at', { ascending: false })

  query = applySupabaseQuoteFilters(query, filters).range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return {
    quotes: data || [],
    count: count || 0,
    page,
    pageSize,
  }
}

async function getQuoteStats(supabase, quoteId) {
  const { data, error, count } = await supabase
    .from('quote_views')
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

async function getQuoteAuditLogs(supabase, quoteId) {
  const auditResult = await supabase
    .from('audit_logs')
    .select('*')
    .or(`entity_id.eq.${quoteId},quote_id.eq.${quoteId}`)
    .order('created_at', { ascending: false })
    .limit(30)

  if (!auditResult.error) return auditResult.data || []

  const quote = await getQuoteById(supabase, quoteId)
  return (quote.items || [])
    .filter(item => item.is_overridden)
    .map(item => ({
      id: item.id || `${quoteId}-${item.service_code}`,
      action: 'price_override',
      created_at: item.updated_at || item.created_at,
      description: `Sua gia ${item.service_name || item.service_code}: ${item.original_unit_price} -> ${item.unit_price}`,
      reason: item.override_reason,
    }))
}

async function createQuote(supabase, body = {}) {
  const { items = [], user_id: userId, created_by_id: createdById, user_name: userName, ...quotePayload } = body
  const createdBy = quotePayload.created_by || userId || createdById || SYSTEM_ACTOR_ID
  const creatorName = quotePayload.created_by_name || quotePayload.sales_name || userName || 'Eventus'
  const normalizedQuotePayload = {
    ...quotePayload,
    entity_code: normalizeEntityCode(quotePayload.entity_code),
    tier_code: normalizeTierCode(quotePayload.tier_code),
    created_by: createdBy,
    created_by_name: creatorName,
    sales_name: quotePayload.sales_name || creatorName,
  }
  const shouldGenerateShareToken = !normalizedQuotePayload.share_token
  let quote = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareToken = normalizedQuotePayload.share_token || makeShareToken()
    try {
      quote = await insertWithSchemaRetry(supabase, 'quotes', {
        ...normalizedQuotePayload,
        share_token: shareToken,
      })
      break
    } catch (error) {
      if (getRequiredReferenceColumn(error)) throw makeReferenceSetupError(error)
      if (!shouldGenerateShareToken || !isQuoteCodeCollision(error) || attempt === 4) throw error
    }
  }

  if (!items.length) return { ...quote, items: [] }

  const quoteItems = items.map((item, index) => ({
    ...item,
    quote_id: quote.id,
    sort_order: item.sort_order ?? index + 1,
  }))

  let insertedItems = []
  try {
    insertedItems = await insertManyWithSchemaRetry(supabase, 'quote_items', quoteItems)
  } catch (error) {
    if (getRequiredReferenceColumn(error)) throw makeReferenceSetupError(error)
    throw error
  }
  return { ...quote, items: insertedItems || [] }
}

async function updateQuote(supabase, id, patch = {}) {
  const { items, ...quotePatch } = patch
  const { data, error } = await supabase
    .from('quotes')
    .update({ ...quotePatch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  if (!Array.isArray(items)) return data

  const { error: deleteError } = await supabase
    .from('quote_items')
    .delete()
    .eq('quote_id', id)

  if (deleteError) throw deleteError

  const quoteItems = items.map((item, index) => ({
    ...item,
    quote_id: id,
    sort_order: item.sort_order ?? index + 1,
  }))
  const insertedItems = await insertManyWithSchemaRetry(supabase, 'quote_items', quoteItems)

  return { ...data, items: insertedItems || [] }
}

async function duplicateQuote(supabase, id) {
  const quote = await getQuoteById(supabase, id)
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

  return createQuote(supabase, {
    ...quotePayload,
    status: 'draft',
    event_name: `${quote.event_name || 'Bao gia'} (copy)`,
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

async function deleteQuote(supabase, id, { hard = false } = {}) {
  if (!hard) {
    return updateQuote(supabase, id, { deleted_at: new Date().toISOString() })
  }

  await supabase.from('quote_views').delete().eq('quote_id', id)
  const { error: itemsError } = await supabase.from('quote_items').delete().eq('quote_id', id)
  if (itemsError) throw itemsError

  const { error } = await supabase.from('quotes').delete().eq('id', id)
  if (error) throw error

  return { ok: true }
}

async function logQuoteView(supabase, quoteId, userAgent) {
  const { error } = await supabase
    .from('quote_views')
    .insert({
      quote_id: quoteId,
      user_agent: userAgent || null,
      viewed_at: new Date().toISOString(),
    })

  if (error) throw error
  return { ok: true }
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabaseAdminClient()
  } catch (error) {
    return sendError(res, error, 'Thieu cau hinh Supabase.')
  }

  try {
    if (req.method === 'GET') {
      const id = getQueryValue(req.query?.id, '')
      const shareToken = getQueryValue(req.query?.share_token || req.query?.token, '')
      const statsId = getQueryValue(req.query?.stats_id, '')
      const auditId = getQueryValue(req.query?.audit_id, '')

      if (statsId) return res.status(200).json(await getQuoteStats(supabase, statsId))
      if (auditId) return res.status(200).json({ logs: await getQuoteAuditLogs(supabase, auditId) })
      if (shareToken) return res.status(200).json({ quote: await getQuoteByShareToken(supabase, shareToken) })
      if (id) return res.status(200).json({ quote: await getQuoteById(supabase, id) })

      return res.status(200).json(await listQuotes(supabase, req.query || {}))
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      if (body.action === 'duplicate') {
        if (!body.id) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json({ quote: await duplicateQuote(supabase, body.id) })
      }

      if (body.action === 'view') {
        if (!body.quote_id) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json(await logQuoteView(supabase, body.quote_id, req.headers?.['user-agent']))
      }

      return res.status(201).json({ quote: await createQuote(supabase, body) })
    }

    if (req.method === 'PATCH') {
      const body = getRequestBody(req)
      const id = body.id || getQueryValue(req.query?.id, '')
      if (!id) return res.status(400).json({ error: 'Thieu quote id.' })
      return res.status(200).json({ quote: await updateQuote(supabase, id, body.patch || {}) })
    }

    if (req.method === 'DELETE') {
      const id = getQueryValue(req.query?.id, '')
      if (!id) return res.status(400).json({ error: 'Thieu quote id.' })
      const hard = ['1', 'true', 'yes'].includes(String(getQueryValue(req.query?.hard, '')).toLowerCase())
      return res.status(200).json({ quote: await deleteQuote(supabase, id, { hard }) })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
