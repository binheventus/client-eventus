import { randomBytes, randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
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
import { loadServerEnv } from './lib/server-env.js'
import { expandQuoteEntityFilterValues, normalizeQuoteEntityCode } from './lib/entity-codes.js'
import { calculateQuotePricing } from '../web/src/features/quotes/lib/pricingCalculator.js'

const require = createRequire(import.meta.url)
const servicesPricingData = require('../web/src/data/pricing/services.json')
const travelFeesPricingData = require('../web/src/data/pricing/travel_fees.json')
const businessRulesPricingData = require('../web/src/data/pricing/business_rules.json')

const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 7
const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000'
const DEFAULT_ENTITY_CODE = 'EVENTUS'
const DEFAULT_TIER_CODE = 'TIER_2'
const DEFAULT_NHANSU_URL = 'https://nhansu.eventusproduction.com'
const EVENTUS_AUTH_HOST = 'lichlamviec.eventusproduction.com'
const VALID_TIER_CODES = new Set(['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_5'])
const SURVEY_RESPONSE_TYPES = new Set(['budget_fit', 'optimize_cost', 'premium_upgrade'])
const SURVEY_RESPONSE_LABELS = {
  budget_fit: 'Khá hợp lý, tôi cần tư vấn thêm',
  optimize_cost: 'Giá hơi cao, tôi muốn tối ưu chi phí',
  premium_upgrade: 'Thấp hơn dự kiến, tôi cần gói cao cấp hơn',
}
const SURVEY_RESPONSE_SUGGESTIONS = {
  budget_fit:
    'Dạ em thấy mình vừa duyệt gói chi phí trên web rồi ạ. Để bên em sớm chuẩn bị mọi thứ cho sự kiện, mình có cần em soạn hợp đồng trước không ạ? Nếu anh/chị sẵn sàng, em xin phép gửi thông tin chuyển khoản tạm ứng để mình kịp giữ lịch nhé.',
  optimize_cost:
    'Em nhận được yêu cầu tối ưu chi phí của mình rồi ạ. Nếu sự kiện này mình bớt 1 máy quay phụ đi thì giá sẽ giảm được [X] triệu, anh/chị thấy phương án này ổn hơn không ạ?',
  premium_upgrade:
    'Em gửi anh/chị xem thêm một số dự án phân khúc cao cấp hơn bên em từng làm cho các tập đoàn lớn để mình tham khảo về chất lượng hình ảnh ạ...',
}
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
  'c.share_token as contract_share_token',
  'c.contract_number',
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
  'show_stamp',
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

const QUOTE_DOCUMENT_TYPES = [
  'advance_request',
  'acceptance_liquidation',
  'payment_request',
]

const QUOTE_DOCUMENT_LABELS = {
  contract: 'Hợp đồng',
  advance_request: 'Đề nghị tạm ứng',
  acceptance_liquidation: 'Biên bản nghiệm thu',
  payment_request: 'Đề nghị thanh toán',
}

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
    return body?.action === 'view' || body?.action === 'survey_response'
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

function getRuleCode(row = {}) {
  return row?.rule_code || row?.code || row?.key
}

function getRuleValue(row = {}) {
  return row?.rule_value ?? row?.value ?? row?.config_value ?? null
}

function getActivePricingRows(rows = []) {
  return [...rows]
    .filter(row => row?.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

function getBusinessRulesMap(rows = []) {
  return rows.reduce((acc, row) => {
    const code = getRuleCode(row)
    if (code) acc[code] = getRuleValue(row)
    return acc
  }, {})
}

function getCurrentQuotePricingContext() {
  return {
    services: getActivePricingRows(servicesPricingData),
    travelFees: getActivePricingRows(travelFeesPricingData),
    businessRules: getBusinessRulesMap(businessRulesPricingData),
  }
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

function normalizeQuoteStatus(value) {
  const status = String(value || 'sent').trim().toLowerCase()
  return status === 'draft' ? 'sent' : status
}

function normalizeQuoteRow(row = {}) {
  if (!row) return row
  return {
    ...row,
    duration_hours: normalizeNumber(row.duration_hours),
    validity_days: normalizeNumber(row.validity_days),
    has_vat: normalizeBoolean(row.has_vat),
    show_stamp: normalizeBoolean(row.show_stamp),
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
  const hasStatus = Object.prototype.hasOwnProperty.call(payload, 'status')
  const hasSentAt = Object.prototype.hasOwnProperty.call(payload, 'sent_at')
  const status = hasStatus ? normalizeQuoteStatus(payload.status) : undefined
  const sentAt = hasSentAt || hasStatus
    ? status === 'sent'
      ? toMysqlDateTime(payload.sent_at || nowMysql())
      : toMysqlDateTime(payload.sent_at)
    : undefined

  return pickColumns({
    ...payload,
    client_id: emptyToNull(payload.client_id),
    client_name: emptyToNull(payload.client_name),
    entity_code: normalizeQuoteEntityCode(payload.entity_code, DEFAULT_ENTITY_CODE),
    tier_code: normalizeTierCode(payload.tier_code),
    event_date: normalizeDate(payload.event_date),
    duration_hours: emptyToNull(payload.duration_hours),
    validity_days: payload.validity_days ?? 15,
    has_vat: payload.has_vat === undefined ? true : Boolean(payload.has_vat),
    show_stamp: payload.show_stamp === undefined ? true : Boolean(payload.show_stamp),
    ...(hasStatus ? { status } : {}),
    ...(hasSentAt || hasStatus ? { sent_at: sentAt } : {}),
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

function getContractQuoteDocument(quote = {}) {
  if (!quote.contract_id) return null

  return {
    type: 'contract',
    label: QUOTE_DOCUMENT_LABELS.contract,
    id: quote.contract_id,
    contract_id: quote.contract_id,
    share_token: quote.contract_share_token || '',
    number: quote.contract_number || '',
    url: `/contracts/${encodeURIComponent(quote.contract_id)}`,
  }
}

function normalizeQuoteDocumentBadge(row = {}) {
  const type = row.document_type || ''
  const shareToken = row.share_token || ''

  return {
    type,
    label: QUOTE_DOCUMENT_LABELS[type] || type,
    id: row.id || '',
    contract_id: row.contract_id || '',
    share_token: shareToken,
    number: row.document_number || '',
    url: shareToken ? `/d/${encodeURIComponent(shareToken)}` : '',
  }
}

function normalizeSurveyResponseRow(row = {}) {
  if (!row?.id) return null

  return {
    id: row.id,
    quote_id: row.quote_id,
    response_type: row.response_type || '',
    response_label: row.response_label || SURVEY_RESPONSE_LABELS[row.response_type] || '',
    selected_tag: row.selected_tag || '',
    created_at: row.created_at || null,
  }
}

async function getLatestSurveyResponses(quoteIds = []) {
  const ids = [...new Set(quoteIds.filter(Boolean))]
  if (!ids.length) return new Map()

  const rows = await query(
    `select id, quote_id, response_type, response_label, selected_tag, created_at
     from ${tables.quoteSurveyResponses}
     where quote_id in (${ids.map(() => '?').join(', ')})
     order by quote_id asc, created_at desc, id desc`,
    ids,
  )

  const responses = new Map()
  for (const row of rows || []) {
    if (!responses.has(row.quote_id)) responses.set(row.quote_id, normalizeSurveyResponseRow(row))
  }
  return responses
}

async function getSurveyResponseById(id) {
  if (!id) return null
  const rows = await query(
    `select id, quote_id, response_type, response_label, selected_tag, created_at
     from ${tables.quoteSurveyResponses}
     where id = ?
     limit 1`,
    [id],
  )

  return normalizeSurveyResponseRow(rows?.[0])
}

async function attachQuoteSurveyResponses(quotes = []) {
  const responses = await getLatestSurveyResponses(quotes.map(quote => quote.id))
  return quotes.map(quote => ({
    ...quote,
    survey_response: responses.get(quote.id) || null,
  }))
}

async function attachQuoteDocuments(quotes = []) {
  const contractIds = [...new Set(quotes.map(quote => quote.contract_id).filter(Boolean))]
  if (!contractIds.length) {
    return quotes.map(quote => ({
      ...quote,
      quote_documents: [getContractQuoteDocument(quote)].filter(Boolean),
    }))
  }

  const placeholders = contractIds.map(() => '?').join(', ')
  const documentRows = await query(
    `select id, contract_id, document_type, document_number, share_token, issued_date, created_at
     from ${tables.contractDocuments}
     where deleted_at is null
       and contract_id in (${placeholders})
       and document_type in (${QUOTE_DOCUMENT_TYPES.map(() => '?').join(', ')})
     order by contract_id asc,
       field(document_type, ${QUOTE_DOCUMENT_TYPES.map(() => '?').join(', ')}),
       issued_date desc,
       created_at desc`,
    [...contractIds, ...QUOTE_DOCUMENT_TYPES, ...QUOTE_DOCUMENT_TYPES],
  )

  const documentsByContract = new Map()
  for (const row of documentRows) {
    if (!documentsByContract.has(row.contract_id)) documentsByContract.set(row.contract_id, new Map())
    const documentsByType = documentsByContract.get(row.contract_id)
    if (!documentsByType.has(row.document_type)) documentsByType.set(row.document_type, normalizeQuoteDocumentBadge(row))
  }

  return quotes.map(quote => {
    const documentsByType = documentsByContract.get(quote.contract_id) || new Map()
    return {
      ...quote,
      quote_documents: [
        getContractQuoteDocument(quote),
        ...QUOTE_DOCUMENT_TYPES.map(type => documentsByType.get(type)).filter(Boolean),
      ].filter(Boolean),
    }
  })
}

async function getQuoteById(id) {
  const rows = await query(
    `select q.*, c.id as contract_id, c.share_token as contract_share_token, c.contract_number,
       case when c.id is null then 0 else 1 end as has_saved_contract
     from ${tables.quotes} q
     left join ${tables.contracts} c on c.quote_id = q.id and c.deleted_at is null
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
  const responses = await getLatestSurveyResponses([id])
  return {
    ...normalizeQuoteRow(quote),
    survey_response: responses.get(id) || null,
    items: items.map(normalizeQuoteItemRow),
  }
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

  const publicQuote = await getQuoteById(quote.id)
  const { survey_response: _surveyResponse, ...safeQuote } = publicQuote
  return safeQuote
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
      where.push('(q.quote_number like ? or q.client_name like ?)')
      const pattern = `%${rawValue}%`
      params.push(pattern, pattern)
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

    const filterValues = key === 'entity_code' ? expandQuoteEntityFilterValues(values) : values

    if (filterValues.length > 1) {
      where.push(`${column} in (${filterValues.map(() => '?').join(', ')})`)
      params.push(...filterValues)
      return
    }

    where.push(`${column} = ?`)
    params.push(filterValues[0] || rawValue)
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
     left join ${tables.contracts} c on c.quote_id = q.id and c.deleted_at is null
     ${whereSql}
     order by q.${orderColumn} desc
     limit ${pageSize} offset ${offset}`,
    params,
  )

  const quotesWithDocuments = await attachQuoteDocuments(rows.map(normalizeQuoteRow))
  const quotes = await attachQuoteSurveyResponses(quotesWithDocuments)

  return {
    quotes,
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
      service_name: item.service_name || item.service_code,
      original_unit_price: item.original_unit_price,
      unit_price: item.unit_price,
      description: `Sửa giá: ${item.service_name || item.service_code} ${new Intl.NumberFormat('vi-VN').format(Number(item.original_unit_price) || 0)} -> ${new Intl.NumberFormat('vi-VN').format(Number(item.unit_price) || 0)}`,
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
      status: quotePayload.status || 'sent',
      sent_at: quotePayload.sent_at || nowMysql(),
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

function removeDuplicatedQuoteItemMetadata(item = {}) {
  const {
    id: _itemId,
    quote_id: _quoteId,
    created_at: _itemCreatedAt,
    updated_at: _itemUpdatedAt,
    service: _service,
    resolved_service_code: _resolvedServiceCode,
    overtime_unit_add_on: _overtimeUnitAddOn,
    ...itemPayload
  } = item
  return itemPayload
}

function prepareDuplicateItemForPricing(item = {}) {
  const normalizedServiceCode = normalizeCode(item.service_code)
  const isCustom = Boolean(item.is_custom || normalizedServiceCode === 'CUSTOM')
  if (isCustom) return { ...item, service_code: 'CUSTOM', is_custom: true, is_overridden: true }

  return {
    ...item,
    is_overridden: false,
    original_unit_price: null,
    override_reason: '',
  }
}

function getServiceDisplayName(service = {}) {
  return service?.quote_display_name || service?.service_name || service?.name || service?.service_code || service?.code || ''
}

function normalizeDuplicatedCalculatedItem(item = {}, index = 0) {
  const isCustom = Boolean(item.is_custom || normalizeCode(item.service_code) === 'CUSTOM')
  const serviceName = getServiceDisplayName(item.service)
  const unitPrice = Number(item.unit_price) || 0

  return {
    ...item,
    service_code: isCustom ? 'CUSTOM' : (item.resolved_service_code || item.service_code || null),
    service_name: isCustom ? item.service_name : (serviceName || item.service_name),
    service_name_raw: isCustom ? (item.service_name_raw || item.service_name) : (serviceName || item.service_name_raw || item.service_name),
    unit: item.unit || item.pricing_unit || item.service?.unit || 'Người',
    unit_price: unitPrice,
    total_price: Number(item.total_price) || 0,
    is_custom: isCustom,
    is_overridden: isCustom,
    original_unit_price: isCustom ? (item.original_unit_price ?? unitPrice) : unitPrice,
    override_reason: isCustom ? item.override_reason : '',
    sort_order: index + 1,
  }
}

function buildDuplicatedQuotePayload(quote = {}, actorPayload = {}, pricingContext = getCurrentQuotePricingContext()) {
  const {
    id: _id,
    quote_number: _quoteNumber,
    share_token: _shareToken,
    created_at: _createdAt,
    updated_at: _updatedAt,
    deleted_at: _deletedAt,
    sent_at: _sentAt,
    created_by: _createdBy,
    created_by_name: _createdByName,
    sales_name: _salesName,
    contract_id: _contractId,
    has_saved_contract: _hasSavedContract,
    items = [],
    ...quotePayload
  } = quote

  const duplicateItems = items
    .map(removeDuplicatedQuoteItemMetadata)
    .map(prepareDuplicateItemForPricing)
  const pricing = calculateQuotePricing({
    items: duplicateItems,
    services: pricingContext.services,
    travelFees: pricingContext.travelFees,
    businessRules: pricingContext.businessRules,
    location: quotePayload.location,
    customer_tier: quotePayload.tier_code,
    has_vat: quotePayload.has_vat,
    duration_hours: quotePayload.duration_hours,
  })

  return {
    ...quotePayload,
    ...actorPayload,
    status: 'sent',
    sent_at: nowMysql(),
    event_name: null,
    subtotal: pricing.subtotal,
    travel_fee_total: pricing.travel_fee_total,
    overtime_fee_total: pricing.overtime_fee_total,
    vat_amount: pricing.vat_amount,
    total_amount: pricing.total_amount,
    items: (pricing.items_with_calculated_price || []).map(normalizeDuplicatedCalculatedItem),
  }
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

async function duplicateQuote(id, actorPayload = {}) {
  const quote = await getQuoteById(id)
  if (quote.deleted_at) {
    const error = new Error('Khong the nhan ban bao gia da xoa.')
    error.statusCode = 400
    throw error
  }

  return createQuote(buildDuplicatedQuotePayload(quote, actorPayload))
}

async function deleteQuote(id, { hard = false } = {}) {
  if (!hard) return updateQuote(id, { deleted_at: new Date().toISOString() })

  await withTransaction(async connection => {
    await connection.query(`delete from ${tables.quoteViews} where quote_id = ?`, [id])
    await connection.query(`delete from ${tables.quoteItems} where quote_id = ?`, [id])
    await connection.query(
      `delete d from ${tables.contractDocuments} d
       inner join ${tables.contracts} c on c.id = d.contract_id
       where c.quote_id = ?`,
      [id],
    )
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

function getTruncatedText(value, maxLength = 255) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function getBaseUrlHost(value = '') {
  try {
    return new URL(value).host.toLowerCase()
  } catch {
    try {
      return new URL(`https://${value}`).host.toLowerCase()
    } catch {
      return ''
    }
  }
}

function normalizeNhansuBaseUrl(value = '') {
  const baseUrl = String(value || '').trim().replace(/\/+$/, '')
  if (!baseUrl) return ''
  const host = getBaseUrlHost(baseUrl)
  if (host === EVENTUS_AUTH_HOST) return ''
  return /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
}

function getNhansuBaseUrl() {
  loadServerEnv()
  return normalizeNhansuBaseUrl(process.env.BASE_NHANSU_URL)
    || normalizeNhansuBaseUrl(process.env.NHANSU_URL)
    || DEFAULT_NHANSU_URL
}

function makeHttpError(message, statusCode = 400, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (code) error.code = code
  return error
}

function formatQuoteNotificationDate(value = '') {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

function getQuoteSurveyNotificationCustomerName(quote = {}) {
  return getTruncatedText(quote.client_name, 255)
}

function buildQuoteSurveyNotificationContent(response = {}) {
  const suggestion = getTruncatedText(SURVEY_RESPONSE_SUGGESTIONS[response.response_type], 1000)
  const customerResponse = [
    getTruncatedText(response.response_label, 255),
    getTruncatedText(response.selected_tag, 1000),
  ].filter(Boolean).join('\n')

  return [
    customerResponse,
    suggestion ? `Gợi ý tư vấn: ${suggestion}` : '',
  ].filter(Boolean).join('\n\n')
}

function buildQuoteSurveyNotificationPayload(quote = {}, response = {}, recipients = []) {
  const customerName = getQuoteSurveyNotificationCustomerName(quote)
  const customerText = customerName ? `Khách ${customerName}` : 'Khách hàng'
  const createdDate = formatQuoteNotificationDate(quote.created_at) || 'không rõ ngày'

  return {
    type: 1,
    need_to_send: recipients.filter(Boolean),
    title: `${customerText} đã phản hồi báo giá ngày ${createdDate}`,
    content: buildQuoteSurveyNotificationContent(response),
  }
}

async function getAccountEmployeeIds() {
  const rows = await query(
    `select distinct e.id
     from ${tables.employees} e
     inner join employee_skill es on es.employee_id = e.id
     inner join skills s on s.id = es.skill_id
     where lower(trim(s.name)) = lower(trim(?))
     order by e.id asc`,
    ['Account'],
  )

  return rows.map(row => row.id).filter(Boolean)
}

async function notifyQuoteSurveyResponse(quote = {}, response = {}) {
  const baseUrl = getNhansuBaseUrl()
  if (!baseUrl) throw makeHttpError('Chưa cấu hình BASE_NHANSU_URL để gửi thông báo tới Account.', 500, 'NHANSU_URL_MISSING')

  const accountEmployeeIds = await getAccountEmployeeIds()
  if (!accountEmployeeIds.length) {
    throw makeHttpError('Không tìm thấy nhân sự chuyên môn Account để gửi thông báo.', 422, 'QUOTE_ACCOUNT_NOT_FOUND')
  }

  let notificationResponse
  try {
    notificationResponse = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildQuoteSurveyNotificationPayload(quote, response, accountEmployeeIds)),
    })
  } catch (error) {
    throw makeHttpError(
      `Không kết nối được Nhân sự API để gửi thông báo tới Account: ${error?.message || 'request failed'}.`,
      502,
      'QUOTE_SURVEY_NOTIFICATION_FAILED',
    )
  }

  if (!notificationResponse.ok) {
    const text = await notificationResponse.text().catch(() => '')
    throw makeHttpError(
      `Không gửi được thông báo tới Account qua Nhân sự API${text ? `: ${getTruncatedText(text, 160)}` : '.'}`,
      502,
      'QUOTE_SURVEY_NOTIFICATION_FAILED',
    )
  }

  return { sent: true, recipients: accountEmployeeIds }
}

async function createQuoteSurveyResponse(body = {}, userAgent) {
  const shareToken = getTruncatedText(body.share_token || body.token, 32)
  const responseType = getTruncatedText(body.response_type, 60)
  const selectedTag = getTruncatedText(body.selected_tag, 1000)

  if (!shareToken) {
    const error = new Error('Thieu share token.')
    error.statusCode = 400
    throw error
  }

  if (!SURVEY_RESPONSE_TYPES.has(responseType)) {
    const error = new Error('Loai survey response khong hop le.')
    error.statusCode = 400
    throw error
  }

  if (responseType === 'optimize_cost' && !selectedTag) {
    const error = new Error('Thieu tag toi uu chi phi.')
    error.statusCode = 400
    throw error
  }

  const rows = await query(
    `select id, client_name, created_at from ${tables.quotes} where share_token = ? and deleted_at is null limit 1`,
    [shareToken],
  )
  const quote = rows?.[0]
  if (!quote?.id) {
    const error = new Error('Khong tim thay bao gia.')
    error.statusCode = 404
    throw error
  }

  const responseLabel = getTruncatedText(body.response_label, 255) || SURVEY_RESPONSE_LABELS[responseType]
  const responseId = makeId('survey')

  await query(
    `insert into ${tables.quoteSurveyResponses}
       (id, quote_id, response_type, response_label, selected_tag, user_agent, created_at)
     values (?, ?, ?, ?, ?, ?, current_timestamp(3))`,
    [responseId, quote.id, responseType, responseLabel, selectedTag || null, userAgent || null],
  )

  const response = await getSurveyResponseById(responseId)
  if (response) await notifyQuoteSurveyResponse(quote, response)
  return response
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
        return res.status(200).json({ quote: await duplicateQuote(body.id, getAuthenticatedActorPayload(req)) })
      }

      if (body.action === 'view') {
        if (!body.quote_id) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json(await logQuoteView(body.quote_id, req.headers?.['user-agent']))
      }

      if (body.action === 'survey_response') {
        return res.status(200).json({
          response: await createQuoteSurveyResponse(body, req.headers?.['user-agent']),
        })
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

export const __quotesTestInternals = Object.freeze({
  buildDuplicatedQuotePayload,
  buildQuoteSurveyNotificationContent,
  buildQuoteSurveyNotificationPayload,
  formatQuoteNotificationDate,
})
