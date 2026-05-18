import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 7
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000'
const SYNTHETIC_ACTOR_IDS = new Set([
  SYSTEM_ACTOR_ID,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
])
const DEFAULT_ENTITY_CODE = 'EVENTUS'
const DEFAULT_TIER_CODE = 'TIER_2'
const RECOVERABLE_FK_COLUMNS = new Set(['client_id'])
const LEGAL_ENTITY_SEEDS = [
  {
    entity_code: 'EVENTUS',
    code: 'EVENTUS',
    name: 'CONG TY TNHH EVENTUS VIET NAM',
    entity_name_full: 'CONG TY TNHH EVENTUS VIET NAM',
    legal_name: 'CONG TY TNHH EVENTUS VIET NAM',
    display_name: 'Eventus',
    tax_code: '0107929531',
    address: 'So 3, ngo 280 duong Le Trong Tan, Phuong Phuong Liet, TP. Ha Noi',
    representative: 'Ong Pham Thanh Binh',
    position: 'Giam doc',
    email: 'Account@eventusproduction.com',
    hotline: '058.369.2222',
    website: 'eventusproduction.com',
    bank_account: '02612345678',
    bank_name: 'Ngan Hang Thuong Mai Co Phan Tien Phong TP Bank',
    logo_file: 'logo_eventus.png',
    source_entity_code: 'EVT',
    is_active: true,
    is_default: true,
    sort_order: 1,
  },
  {
    entity_code: 'MEDIAMONSTER',
    code: 'MEDIAMONSTER',
    name: 'CONG TY TNHH MEDIAMONSTER',
    entity_name_full: 'CONG TY TNHH MEDIAMONSTER',
    legal_name: 'CONG TY TNHH MEDIAMONSTER',
    display_name: 'Mediamonster',
    tax_code: '1001255108',
    address: 'Thon Le Loi, Xa Tien Hai, Tinh Hung Yen',
    representative: 'Ong Pham Ngoc Bao',
    position: 'Giam doc',
    email: 'Account@eventusproduction.com',
    hotline: '058.369.2222',
    website: 'eventusproduction.com',
    bank_account: '01212345678',
    bank_name: 'Ngan Hang Thuong Mai Co Phan Tien Phong TP Bank',
    logo_file: 'logo_mediamonster.png',
    source_entity_code: 'MMS',
    is_active: true,
    is_default: false,
    sort_order: 2,
  },
]
const CUSTOMER_TIER_SEEDS = [
  { tier_code: 'TIER_1', code: 'TIER_1', tier_name: 'Khach VinGroup / Agency dac biet', name: 'Khach VinGroup / Agency dac biet', sort_order: 1 },
  { tier_code: 'TIER_2', code: 'TIER_2', tier_name: 'Khach moi / Khach thong thuong', name: 'Khach moi / Khach thong thuong', sort_order: 2 },
  { tier_code: 'TIER_3', code: 'TIER_3', tier_name: 'Khach giam gia / Nguoi quen', name: 'Khach giam gia / Nguoi quen', sort_order: 3 },
  { tier_code: 'TIER_4', code: 'TIER_4', tier_name: '2res', name: '2res', sort_order: 4 },
  { tier_code: 'TIER_5', code: 'TIER_5', tier_name: 'Tier 5', name: 'Tier 5', sort_order: 5 },
]

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

function applyFilters(query, filters = {}) {
  Object.entries(filters).forEach(([key, value]) => {
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

    query = query.eq(key, value)
  })

  return query
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

async function upsertWithSchemaRetry(supabase, tableName, payload, onConflict) {
  let nextPayload = { ...payload }
  const removedColumns = new Set()

  for (let attempt = 0; attempt <= Object.keys(payload).length; attempt += 1) {
    const { error } = await supabase
      .from(tableName)
      .upsert(nextPayload, onConflict ? { onConflict } : undefined)

    const recoverableColumn = getRecoverableInsertColumn(error, nextPayload)
    if (!recoverableColumn || !(recoverableColumn in nextPayload) || recoverableColumn === onConflict || removedColumns.has(recoverableColumn)) {
      if (error) throw error
      return true
    }

    removedColumns.add(recoverableColumn)
    const { [recoverableColumn]: _removed, ...payloadWithoutMissingColumn } = nextPayload
    nextPayload = payloadWithoutMissingColumn
  }

  return false
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
  return CUSTOMER_TIER_SEEDS.some(row => row.tier_code === code) ? code : DEFAULT_TIER_CODE
}

async function rowExists(supabase, tableName, column, value) {
  const { data, error } = await supabase
    .from(tableName)
    .select(column)
    .eq(column, value)
    .maybeSingle()

  if (error) return false
  return Boolean(data)
}

async function ensureReferenceRow(supabase, tableName, column, row) {
  const value = row?.[column]
  if (!value) return false

  try {
    if (await rowExists(supabase, tableName, column, value)) return true
    return await upsertWithSchemaRetry(supabase, tableName, row, column)
  } catch {
    return false
  }
}

async function ensureQuoteReferences(supabase, quotePayload = {}, items = []) {
  const normalizedEntityCode = normalizeEntityCode(quotePayload.entity_code)
  const entitySeed = LEGAL_ENTITY_SEEDS.find(row => row.entity_code === normalizedEntityCode) || LEGAL_ENTITY_SEEDS[0]
  const entityCode = entitySeed.entity_code
  await ensureReferenceRow(supabase, 'legal_entities', 'entity_code', entitySeed)

  const tierCode = normalizeTierCode(quotePayload.tier_code)
  const tierSeed = CUSTOMER_TIER_SEEDS.find(row => row.tier_code === tierCode) || CUSTOMER_TIER_SEEDS[1]
  await ensureReferenceRow(supabase, 'customer_tiers', 'tier_code', tierSeed)

  await Promise.all(items
    .map((item, index) => ({
      service_code: item.service_code,
      code: item.service_code,
      service_name: item.service_name || item.service_name_raw || item.service_code,
      quote_display_name: item.service_name || item.service_name_raw || item.service_code,
      unit: item.unit || 'Goi',
      is_active: true,
      sort_order: item.sort_order ?? index + 1,
    }))
    .filter(row => row.service_code)
    .map(row => ensureReferenceRow(supabase, 'services', 'service_code', row)))

  return {
    ...quotePayload,
    entity_code: entityCode,
    tier_code: tierCode,
  }
}

async function getFallbackQuoteActor(supabase) {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('created_by,created_by_name,sales_name')
      .not('created_by', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error && data?.created_by) {
      return {
        created_by: data.created_by,
        created_by_name: data.created_by_name || data.sales_name || 'Eventus',
        sales_name: data.sales_name || data.created_by_name || 'Eventus',
        is_existing: true,
      }
    }
  } catch {
    // Keep quote creation working even when older schemas cannot answer this lookup.
  }

  return {
    created_by: SYSTEM_ACTOR_ID,
    created_by_name: 'Eventus',
    sales_name: 'Eventus',
    is_existing: false,
  }
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
    .select('*', { count: 'exact' })

  query = trash
    ? query.not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    : query.is('deleted_at', null).order('created_at', { ascending: false })

  query = applyFilters(query, filters).range(from, to)

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
  const preparedQuotePayload = await ensureQuoteReferences(supabase, quotePayload, items)
  const requestedCreatedBy = preparedQuotePayload.created_by || userId || createdById
  const canReplaceSyntheticActor = requestedCreatedBy && SYNTHETIC_ACTOR_IDS.has(String(requestedCreatedBy))
  const fallbackActor = (!requestedCreatedBy || canReplaceSyntheticActor)
    ? await getFallbackQuoteActor(supabase)
    : null
  const createdBy = fallbackActor?.is_existing ? fallbackActor.created_by : requestedCreatedBy || fallbackActor?.created_by || SYSTEM_ACTOR_ID
  const creatorName = fallbackActor?.is_existing
    ? fallbackActor.created_by_name
    : preparedQuotePayload.created_by_name ||
      preparedQuotePayload.sales_name ||
      userName ||
      fallbackActor?.created_by_name ||
      (createdBy === 'admin' ? 'Admin' : 'Eventus')
  const salesName = fallbackActor?.is_existing
    ? fallbackActor.sales_name
    : preparedQuotePayload.sales_name || creatorName
  const normalizedQuotePayload = {
    ...preparedQuotePayload,
    created_by: createdBy,
    created_by_name: creatorName,
    sales_name: salesName,
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
