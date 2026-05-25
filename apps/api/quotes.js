import { randomBytes, randomUUID } from 'node:crypto'
import {
  emptyToNull,
  insertRow,
  normalizeBoolean,
  normalizeNumber,
  nowMysql,
  query,
  tables,
  toMysqlDateTime,
  updateRow,
  withTransaction,
} from './lib/mysql.js'
import { requireEventusAuth } from './lib/eventus-auth.js'

const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 7
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000'
const DEFAULT_ENTITY_CODE = 'EVENTUS'
const DEFAULT_TIER_CODE = 'TIER_2'
const VALID_TIER_CODES = new Set(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_5'])
const LIST_QUOTE_COLUMNS = [
  'q.id',
  'q.quote_number',
  'q.client_name',
  'q.event_name',
  'q.total_amount',
  'q.status',
  'q.created_by',
  'q.created_by_name',
  'q.sales_name',
  'q.created_at',
  'q.deleted_at',
  'q.tier_code',
  'q.entity_code',
  'q.share_token',
  'q.sent_at',
  'q.validity_days',
  'c.id as contract_id',
  'case when c.id is null then 0 else 1 end as has_saved_contract',
].join(', ')

const QUOTE_COLUMNS = [
  'id',
  'quote_number',
  'ai_input',
  'client_id',
  'client_name',
  'entity_code',
  'tier_code',
  'event_name',
  'event_date',
  'location',
  'duration_hours',
  'validity_days',
  'has_vat',
  'terms_text',
  'status',
  'sent_at',
  'subtotal',
  'travel_fee_total',
  'overtime_fee_total',
  'vat_amount',
  'total_amount',
  'share_token',
  'created_by',
  'created_by_name',
  'sales_name',
  'deleted_at',
]

const QUOTE_ITEM_COLUMNS = [
  'id',
  'quote_id',
  'service_code',
  'service_name',
  'service_name_raw',
  'unit',
  'quantity',
  'num_sessions',
  'billable_duration_hours',
  'unit_price',
  'total_price',
  'is_custom',
  'custom_sort_rank',
  'is_overridden',
  'original_unit_price',
  'override_reason',
  'group_code',
  'group_label',
  'group_sort_order',
  'sort_order',
]

function sendError(res, error, fallback = 'Khong xu ly duoc bao gia.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

function getRequestBody(req) {
  if (req.__eventusRequestBody) return req.__eventusRequestBody

  let body = {}
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body)
    } catch {
      body = {}
    }
  } else {
    body = req.body
  }

  req.__eventusRequestBody = body
  return body
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function getPositiveInteger(value, fallback) {
  const number = Number(getQueryValue(value))
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function isPublicQuoteRequest(req) {
  if (req.method === 'GET') {
    return Boolean(getQueryValue(req.query?.share_token || req.query?.token, ''))
  }

  if (req.method === 'POST') {
    const body = getRequestBody(req)
    return body?.action === 'view'
  }

  return false
}

function getAuthenticatedActorPayload(req) {
  const user = req.eventusUser
  if (!user) return {}

  const userId = user.id || user.user_id || user.uuid
  const userName = getAuthenticatedUserName(user)
  if (!userId && !userName) return {}

  return {
    ...(userId ? { user_id: String(userId), created_by: String(userId) } : {}),
    user_name: userName,
    created_by_name: userName,
    sales_name: userName,
  }
}

function compactName(parts = []) {
  return parts.map(part => String(part || '').trim()).filter(Boolean).join(' ')
}

function getAuthenticatedUserName(user = {}) {
  return (
    user.name ||
    user.full_name ||
    user.display_name ||
    user.username ||
    compactName([user.first_name, user.last_name]) ||
    user.email ||
    'Eventus'
  )
}

function getAuthenticatedUserPayload(req) {
  const user = req.eventusUser
  if (!user) return null

  return {
    id: user.id || user.user_id || user.uuid || null,
    name: getAuthenticatedUserName(user),
    email: user.email || null,
    role: user.role || user.user_role || 'sales',
  }
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

function makeShareToken() {
  return Array.from(randomBytes(SHARE_TOKEN_LENGTH), value => (
    SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]
  )).join('')
}

function makeId(prefix = '') {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID()
}

function pickColumns(payload, columns) {
  return columns.reduce((acc, column) => {
    if (Object.prototype.hasOwnProperty.call(payload, column)) acc[column] = payload[column]
    return acc
  }, {})
}

function normalizeDate(value) {
  return emptyToNull(value)
}

function normalizeQuoteRow(row = {}) {
  if (!row) return row
  return {
    ...row,
    duration_hours: normalizeNumber(row.duration_hours),
    validity_days: normalizeNumber(row.validity_days),
    has_vat: normalizeBoolean(row.has_vat),
    subtotal: normalizeNumber(row.subtotal),
    travel_fee_total: normalizeNumber(row.travel_fee_total),
    overtime_fee_total: normalizeNumber(row.overtime_fee_total),
    vat_amount: normalizeNumber(row.vat_amount),
    total_amount: normalizeNumber(row.total_amount),
    has_saved_contract: normalizeBoolean(row.has_saved_contract),
  }
}

function normalizeQuoteItemRow(row = {}) {
  return {
    ...row,
    quantity: normalizeNumber(row.quantity),
    num_sessions: normalizeNumber(row.num_sessions),
    billable_duration_hours: normalizeNumber(row.billable_duration_hours),
    unit_price: normalizeNumber(row.unit_price),
    total_price: normalizeNumber(row.total_price),
    original_unit_price: normalizeNumber(row.original_unit_price),
    custom_sort_rank: normalizeNumber(row.custom_sort_rank),
    group_sort_order: normalizeNumber(row.group_sort_order),
    sort_order: normalizeNumber(row.sort_order),
    is_custom: normalizeBoolean(row.is_custom),
    is_overridden: normalizeBoolean(row.is_overridden),
  }
}

function normalizeQuotePayload(payload = {}) {
  return pickColumns({
    ...payload,
    client_id: emptyToNull(payload.client_id),
    client_name: emptyToNull(payload.client_name),
    entity_code: normalizeEntityCode(payload.entity_code),
    tier_code: normalizeTierCode(payload.tier_code),
    event_date: normalizeDate(payload.event_date),
    duration_hours: emptyToNull(payload.duration_hours),
    validity_days: payload.validity_days ?? 15,
    has_vat: payload.has_vat === undefined ? true : Boolean(payload.has_vat),
    sent_at: toMysqlDateTime(payload.sent_at),
    deleted_at: toMysqlDateTime(payload.deleted_at),
  }, QUOTE_COLUMNS)
}

function normalizeQuoteItemPayload(item = {}, quoteId, index = 0) {
  const serviceCode = item.is_custom ? 'CUSTOM' : (item.service_code || item.resolved_service_code || null)
  return pickColumns({
    ...item,
    id: item.id || makeId('item'),
    quote_id: quoteId,
    service_code: serviceCode,
    service_name: emptyToNull(item.service_name),
    service_name_raw: emptyToNull(item.service_name_raw || item.service_name),
    unit: emptyToNull(item.unit || item.pricing_unit),
    quantity: Number(item.quantity) || 1,
    num_sessions: Number(item.num_sessions) || 1,
    billable_duration_hours: emptyToNull(item.billable_duration_hours ?? item.item_duration_hours),
    unit_price: Number(item.unit_price) || 0,
    total_price: Number(item.total_price) || 0,
    is_custom: Boolean(item.is_custom || serviceCode === 'CUSTOM'),
    custom_sort_rank: item.custom_sort_rank ?? null,
    is_overridden: Boolean(item.is_overridden || item.is_custom || serviceCode === 'CUSTOM'),
    original_unit_price: item.original_unit_price ?? item.unit_price ?? null,
    override_reason: emptyToNull(item.override_reason),
    group_code: emptyToNull(item.group_code),
    group_label: emptyToNull(item.group_label),
    group_sort_order: item.group_sort_order ?? null,
    sort_order: item.sort_order ?? index + 1,
  }, QUOTE_ITEM_COLUMNS)
}

async function ensureClient(connection, { id, name } = {}) {
  const cleanName = String(name || '').trim()
  if (!cleanName) return id || null

  if (id) {
    await connection.query(
      `insert into ${tables.clients} (id, name) values (?, ?)
       on duplicate key update name = values(name), updated_at = current_timestamp(3)`,
      [id, cleanName],
    )
    return id
  }

  const [existing] = await connection.query(
    `select id from ${tables.clients} where name = ? limit 1`,
    [cleanName],
  )
  if (existing?.[0]?.id) return existing[0].id

  const nextId = makeId('client')
  await connection.query(
    `insert into ${tables.clients} (id, name) values (?, ?)`,
    [nextId, cleanName],
  )
  return nextId
}

async function makeQuoteNumber(connection) {
  const [rows] = await connection.query(
    `select max(cast(substring(quote_number, 4) as unsigned)) as max_number
     from ${tables.quotes}
     where quote_number regexp '^BG-[0-9]+$'`,
  )
  const nextNumber = Number(rows?.[0]?.max_number || 0) + 1
  return `BG-${String(nextNumber).padStart(4, '0')}`
}

async function insertQuoteItems(connection, quoteId, items = []) {
  for (const [index, item] of items.entries()) {
    await insertRow(connection, tables.quoteItems, normalizeQuoteItemPayload(item, quoteId, index))
  }
}

async function getQuoteById(id) {
  const rows = await query(
    `select q.*, c.id as contract_id, case when c.id is null then 0 else 1 end as has_saved_contract
     from ${tables.quotes} q
     left join ${tables.contracts} c on c.quote_id = q.id
     where q.id = ?
     limit 1`,
    [id],
  )
  const quote = rows?.[0]
  if (!quote) {
    const error = new Error('Khong tim thay bao gia.')
    error.statusCode = 404
    throw error
  }

  const items = await query(
    `select * from ${tables.quoteItems} where quote_id = ? order by sort_order asc, created_at asc`,
    [id],
  )
  return { ...normalizeQuoteRow(quote), items: items.map(normalizeQuoteItemRow) }
}

async function getQuoteByShareToken(shareToken) {
  const rows = await query(
    `select * from ${tables.quotes} where share_token = ? and deleted_at is null limit 1`,
    [shareToken],
  )
  const quote = rows?.[0]
  if (!quote) {
    const error = new Error('Khong tim thay bao gia.')
    error.statusCode = 404
    throw error
  }

  return getQuoteById(quote.id)
}

function getFilters(queryParams = {}) {
  return [
    'search',
    'status',
    'tier_code',
    'entity_code',
    'created_by',
    'date_from',
    'date_to',
  ].reduce((filters, key) => {
    const value = getQueryValue(queryParams[key], '')
    if (value !== '') filters[key] = value
    return filters
  }, {})
}

function addQuoteFilters(where, params, filters = {}) {
  const filterColumns = {
    status: 'q.status',
    tier_code: 'q.tier_code',
    entity_code: 'q.entity_code',
    created_by: 'q.created_by',
  }

  Object.entries(filters).forEach(([key, rawValue]) => {
    if (rawValue === undefined || rawValue === null || rawValue === '') return
    const values = String(rawValue).split(',').map(value => value.trim()).filter(Boolean)

    if (key === 'search') {
      where.push('(q.quote_number like ? or q.client_name like ? or q.event_name like ?)')
      const pattern = `%${rawValue}%`
      params.push(pattern, pattern, pattern)
      return
    }

    if (key === 'date_from') {
      where.push('q.created_at >= ?')
      params.push(rawValue)
      return
    }

    if (key === 'date_to') {
      where.push('q.created_at <= ?')
      params.push(rawValue)
      return
    }

    const column = filterColumns[key]
    if (!column) return

    if (values.length > 1) {
      where.push(`${column} in (${values.map(() => '?').join(', ')})`)
      params.push(...values)
      return
    }

    where.push(`${column} = ?`)
    params.push(rawValue)
  })
}

async function listQuotes(queryParams = {}) {
  const page = getPositiveInteger(queryParams.page, 1)
  const pageSize = getPositiveInteger(queryParams.pageSize, 20)
  const offset = (page - 1) * pageSize
  const trash = ['1', 'true', 'yes'].includes(String(getQueryValue(queryParams.trash, '')).toLowerCase())
  const filters = getFilters(queryParams)
  const where = [trash ? 'q.deleted_at is not null' : 'q.deleted_at is null']
  const params = []

  addQuoteFilters(where, params, filters)
  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const orderColumn = trash ? 'deleted_at' : 'created_at'

  const countRows = await query(`select count(*) as count from ${tables.quotes} q ${whereSql}`, params)
  const rows = await query(
    `select ${LIST_QUOTE_COLUMNS}
     from ${tables.quotes} q
     left join ${tables.contracts} c on c.quote_id = q.id
     ${whereSql}
     order by q.${orderColumn} desc
     limit ${pageSize} offset ${offset}`,
    params,
  )

  return {
    quotes: rows.map(normalizeQuoteRow),
    count: Number(countRows?.[0]?.count || 0),
    page,
    pageSize,
  }
}

async function listClients() {
  const rows = await query(
    `select * from ${tables.clients} order by updated_at desc, created_at desc limit 50`,
  )
  return rows || []
}

async function getQuoteStats(quoteId) {
  const countRows = await query(`select count(*) as count from ${tables.quoteViews} where quote_id = ?`, [quoteId])
  const rows = await query(
    `select * from ${tables.quoteViews} where quote_id = ? order by viewed_at desc limit 20`,
    [quoteId],
  )

  return {
    count: Number(countRows?.[0]?.count || 0),
    lastViewedAt: rows?.[0]?.viewed_at || null,
    views: rows || [],
  }
}

async function getQuoteAuditLogs(quoteId) {
  const quote = await getQuoteById(quoteId)
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

async function createQuote(body = {}) {
  const { items = [], user_id: userId, created_by_id: createdById, user_name: userName, ...quotePayload } = body
  const createdBy = quotePayload.created_by || userId || createdById || SYSTEM_ACTOR_ID
  const creatorName = quotePayload.created_by_name || quotePayload.sales_name || userName || 'Eventus'

  const quoteId = await withTransaction(async connection => {
    const shareToken = quotePayload.share_token || makeShareToken()
    const nextQuoteId = quotePayload.id || shareToken
    const clientId = await ensureClient(connection, {
      id: quotePayload.client_id,
      name: quotePayload.client_name,
    })
    const quote = normalizeQuotePayload({
      ...quotePayload,
      id: nextQuoteId,
      quote_number: quotePayload.quote_number || await makeQuoteNumber(connection),
      share_token: shareToken,
      client_id: clientId,
      created_by: createdBy,
      created_by_name: creatorName,
      sales_name: quotePayload.sales_name || creatorName,
    })

    await insertRow(connection, tables.quotes, quote)
    await insertQuoteItems(connection, nextQuoteId, items)
    return nextQuoteId
  })

  return getQuoteById(quoteId)
}

async function updateQuote(id, patch = {}) {
  const { items, ...quotePatch } = patch

  await withTransaction(async connection => {
    const clientId = await ensureClient(connection, {
      id: quotePatch.client_id,
      name: quotePatch.client_name,
    })
    const payload = normalizeQuotePayload({
      ...quotePatch,
      ...(quotePatch.client_name ? { client_id: clientId } : {}),
      updated_at: nowMysql(),
    })

    await updateRow(connection, tables.quotes, payload, 'id = ?', [id])

    if (Array.isArray(items)) {
      await connection.query(`delete from ${tables.quoteItems} where quote_id = ?`, [id])
      await insertQuoteItems(connection, id, items)
    }
  })

  return getQuoteById(id)
}

async function duplicateQuote(id) {
  const quote = await getQuoteById(id)
  const {
    id: _id,
    quote_number: _quoteNumber,
    share_token: _shareToken,
    created_at: _createdAt,
    updated_at: _UpdatedAt,
    deleted_at: _deletedAt,
    sent_at: _sentAt,
    items = [],
    ...quotePayload
  } = quote

  return createQuote({
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

async function deleteQuote(id, { hard = false } = {}) {
  if (!hard) return updateQuote(id, { deleted_at: new Date().toISOString() })

  await withTransaction(async connection => {
    await connection.query(`delete from ${tables.quoteViews} where quote_id = ?`, [id])
    await connection.query(`delete from ${tables.quoteItems} where quote_id = ?`, [id])
    await connection.query(`delete from ${tables.contracts} where quote_id = ?`, [id])
    await connection.query(`delete from ${tables.quotes} where id = ?`, [id])
  })
  return { ok: true }
}

async function logQuoteView(quoteId, userAgent) {
  await query(
    `insert into ${tables.quoteViews} (id, quote_id, user_agent, viewed_at) values (?, ?, ?, current_timestamp(3))`,
    [makeId('view'), quoteId, userAgent || null],
  )
  return { ok: true }
}

export default async function handler(req, res) {
  try {
    if (!isPublicQuoteRequest(req) && !await requireEventusAuth(req, res)) return

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, '')
      if (resource === 'clients') return res.status(200).json({ clients: await listClients() })

      const id = getQueryValue(req.query?.id, '')
      const shareToken = getQueryValue(req.query?.share_token || req.query?.token, '')
      const statsId = getQueryValue(req.query?.stats_id, '')
      const auditId = getQueryValue(req.query?.audit_id, '')

      if (statsId) return res.status(200).json(await getQuoteStats(statsId))
      if (auditId) return res.status(200).json({ logs: await getQuoteAuditLogs(auditId) })
      if (shareToken) return res.status(200).json({ quote: await getQuoteByShareToken(shareToken) })
      if (id) return res.status(200).json({ quote: await getQuoteById(id) })

      const quoteList = await listQuotes(req.query || {})
      return res.status(200).json({
        ...quoteList,
        current_user: getAuthenticatedUserPayload(req),
      })
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      if (body.action === 'duplicate') {
        if (!body.id) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json({ quote: await duplicateQuote(body.id) })
      }

      if (body.action === 'view') {
        if (!body.quote_id) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json(await logQuoteView(body.quote_id, req.headers?.['user-agent']))
      }

      return res.status(201).json({ quote: await createQuote({ ...body, ...getAuthenticatedActorPayload(req) }) })
    }

    if (req.method === 'PATCH') {
      const body = getRequestBody(req)
      const id = body.id || getQueryValue(req.query?.id, '')
      if (!id) return res.status(400).json({ error: 'Thieu quote id.' })
      return res.status(200).json({ quote: await updateQuote(id, body.patch || {}) })
    }

    if (req.method === 'DELETE') {
      const id = getQueryValue(req.query?.id, '')
      if (!id) return res.status(400).json({ error: 'Thieu quote id.' })
      const hard = ['1', 'true', 'yes'].includes(String(getQueryValue(req.query?.hard, '')).toLowerCase())
      return res.status(200).json({ quote: await deleteQuote(id, { hard }) })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
