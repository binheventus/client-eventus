import { randomBytes, randomUUID } from 'node:crypto'
import {
  emptyToNull,
  fromJson,
  insertRow as mysqlInsertRow,
  normalizeBoolean,
  query as mysqlQuery,
  tables,
  toJson,
  toMysqlDateTime,
  updateRow as mysqlUpdateRow,
  withTransaction as mysqlWithTransaction,
} from './lib/mysql.js'
import { requireEventusAuth as defaultRequireEventusAuth } from './lib/eventus-auth.js'
import { normalizeDocumentSellerEntityCode } from './lib/entity-codes.js'

const SHORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const defaultContractsApiDeps = {
  insertRow: mysqlInsertRow,
  query: mysqlQuery,
  requireEventusAuth: defaultRequireEventusAuth,
  updateRow: mysqlUpdateRow,
  withTransaction: mysqlWithTransaction,
}
let contractsApiDeps = defaultContractsApiDeps

export function configureContractsApiForTest(overrides = {}) {
  contractsApiDeps = { ...defaultContractsApiDeps, ...overrides }
  return () => {
    contractsApiDeps = defaultContractsApiDeps
  }
}

function runQuery(sql, params = []) {
  return contractsApiDeps.query(sql, params)
}

function runTransaction(callback) {
  return contractsApiDeps.withTransaction(callback)
}

function insertDataRow(connection, tableName, payload = {}) {
  return contractsApiDeps.insertRow(connection, tableName, payload)
}

function updateDataRow(connection, tableName, payload = {}, whereSql, whereParams = []) {
  return contractsApiDeps.updateRow(connection, tableName, payload, whereSql, whereParams)
}

const PROTECTED_CONTRACT_TEMPLATE_IDS = new Set(['system-mediamonster-service-contract'])
const CONTRACT_DOCUMENT_TYPES = new Set([
  'advance_request',
  'acceptance_liquidation',
  'payment_request',
])
const CONTRACT_DOCUMENT_TYPE_CODES = {
  advance_request: 'DNTU',
  acceptance_liquidation: 'BBNTTL',
  payment_request: 'DNTT',
}
const CONTRACT_DOCUMENT_TYPE_ORDER = [
  'advance_request',
  'acceptance_liquidation',
  'payment_request',
]
const CONTRACT_DOCUMENT_BADGE_LABELS = {
  advance_request: 'Đề nghị tạm ứng',
  acceptance_liquidation: 'Biên bản nghiệm thu',
  payment_request: 'Đề nghị thanh toán',
}
const DEFAULT_DOCUMENT_NUMBER_PATTERN = '{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}'
const DEFAULT_CONTRACT_DOCUMENT_TEMPLATES = [
  {
    id: 'system-advance-request-template',
    document_type: 'advance_request',
    name: 'Mau de nghi tam ung mac dinh',
    description: 'Mau co ban de de nghi khach hang thanh toan tam ung theo hop dong.',
    title: 'De nghi tam ung',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'advance_amount',
      required_fields: ['amount', 'issued_date'],
      suggested_amount_source: 'contract.payment_config.deposit_percent',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'advance-summary',
        title: 'Noi dung de nghi',
        body: 'Can cu Hop dong da ky, Ben B kinh de nghi Ben A thanh toan khoan tam ung theo gia tri va tien do da thoa thuan.',
      },
      {
        id: 'advance-payment-info',
        title: 'Thong tin thanh toan',
        body: 'So tien tam ung, thoi han thanh toan va thong tin chuyen khoan duoc ghi nhan theo du lieu chung tu khi lap.',
      },
    ],
    terms_text: 'Ben A thanh toan khoan tam ung theo hop dong sau khi nhan duoc de nghi tam ung hop le tu Ben B.',
    is_default: true,
    sort_order: 10,
  },
  {
    id: 'system-acceptance-liquidation-template',
    document_type: 'acceptance_liquidation',
    name: 'Mau BBNT kiem thanh ly mac dinh',
    description: 'Mau nghiem thu ket qua dich vu va xac nhan thanh ly nghia vu theo hop dong.',
    title: 'Bien ban nghiem thu kiem thanh ly',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'acceptance_amount',
      required_fields: ['amount', 'issued_date'],
      suggested_amount_source: 'contract.total_amount',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'acceptance-scope',
        title: 'Noi dung nghiem thu',
        body: 'Hai ben xac nhan Ben B da hoan thanh pham vi dich vu theo hop dong va cac phu luc/thoa thuan lien quan.',
      },
      {
        id: 'liquidation-confirmation',
        title: 'Xac nhan thanh ly',
        body: 'Sau khi hoan tat cac nghia vu thanh toan con lai, hai ben thong nhat thanh ly hop dong theo noi dung bien ban nay.',
      },
    ],
    terms_text: 'Hai ben thong nhat nghiem thu khoi luong dich vu da hoan thanh va lam co so thanh toan/thanh ly hop dong.',
    is_default: true,
    sort_order: 20,
  },
  {
    id: 'system-payment-request-template',
    document_type: 'payment_request',
    name: 'Mau de nghi thanh toan mac dinh',
    description: 'Mau de nghi thanh toan phan gia tri con lai, bat buoc lien ket voi BBNT.',
    title: 'De nghi thanh toan',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'payment_amount',
      required_fields: ['amount', 'issued_date', 'acceptance_document_id'],
      related_document_type: 'acceptance_liquidation',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'payment-basis',
        title: 'Co so thanh toan',
        body: 'Can cu hop dong va bien ban nghiem thu da duoc hai ben xac nhan, Ben B de nghi Ben A thanh toan gia tri con lai.',
      },
      {
        id: 'payment-request-detail',
        title: 'Chi tiet de nghi',
        body: 'Gia tri thanh toan, chung tu lien quan va ghi chu bo sung duoc lay tu du lieu chung tu khi lap.',
      },
    ],
    terms_text: 'De nghi thanh toan nay duoc lap tren co so BBNT da lien ket va cac dieu khoan thanh toan trong hop dong.',
    is_default: true,
    sort_order: 30,
  },
]
const OPEN_DOCUMENT_STATUSES = new Set(['draft', 'open'])
const JSON_TEMPLATE_COLUMNS = [
  'party_role_config',
  'preamble',
  'schedule_rows',
  'quote_table_config',
  'payment_config',
  'content_sections',
]
const JSON_CONTRACT_COLUMNS = [
  'seller_snapshot',
  'customer_snapshot',
  'party_role_config',
  'preamble',
  'schedule_rows',
  'quote_table_config',
  'payment_config',
  'content_sections',
  'quote_snapshot',
  'source_snapshot',
]
const JSON_DOCUMENT_TEMPLATE_COLUMNS = [
  'fields_config',
  'numbering_config',
  'content_sections',
]
const JSON_DOCUMENT_COLUMNS = [
  'template_snapshot',
  'contract_snapshot',
  'document_data',
  'content_sections',
]
const CUSTOMER_COLUMNS = [
  'customer_code',
  'company_name',
  'tax_code',
  'address',
  'representative',
  'position',
  'authorization_number',
  'authorization_date',
  'phone_number',
  'contact_name',
  'email',
  'entry_date',
  'note',
]

function sendError(res, error, fallback = 'Khong xu ly duoc hop dong.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

function isMissingQuoteDocumentColumnError(error) {
  return error?.code === 'ER_BAD_FIELD_ERROR' && /quote_id/i.test(String(error?.message || ''))
}

function makeHttpError(message, statusCode = 400, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (code) error.code = code
  return error
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

function isPublicContractRequest(req) {
  if (req.method !== 'GET') return false
  return ['public_contract', 'public_document'].includes(getQueryValue(req.query?.resource, 'templates'))
}

function makeId(prefix = '') {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID()
}

function makeShortId(prefix = '') {
  const suffix = randomBytes(8).toString('hex')
  return prefix ? `${prefix}_${suffix}` : suffix
}

function makeReadableShortId(prefix = '', length = 12) {
  const bytes = randomBytes(length)
  const suffix = Array.from(bytes, byte => SHORT_ID_ALPHABET[byte % SHORT_ID_ALPHABET.length]).join('')
  return prefix ? `${prefix}_${suffix}` : suffix
}

function makeShareToken() {
  return randomUUID().replace(/-/g, '').slice(0, 16)
}

function getPositiveInteger(value, fallback = 1) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : fallback
}

function normalizeDateText(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function stripHtml(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeSourceType(value = 'quote') {
  const sourceType = String(value || 'quote').toLowerCase()
  return ['quote', 'job', 'manual'].includes(sourceType) ? sourceType : 'quote'
}

function normalizeDocumentType(value = '') {
  const documentType = String(value || '').trim().toLowerCase()
  if (CONTRACT_DOCUMENT_TYPES.has(documentType)) return documentType

  const aliases = {
    advance: 'advance_request',
    advance_payment: 'advance_request',
    tam_ung: 'advance_request',
    de_nghi_tam_ung: 'advance_request',
    acceptance: 'acceptance_liquidation',
    liquidation: 'acceptance_liquidation',
    bbnt: 'acceptance_liquidation',
    nghiem_thu_thanh_ly: 'acceptance_liquidation',
    payment: 'payment_request',
    final_payment: 'payment_request',
    dntt: 'payment_request',
    de_nghi_thanh_toan: 'payment_request',
  }
  return aliases[documentType] || ''
}

function normalizeDocumentStatus(value = 'draft') {
  const status = String(value || 'draft').trim().toLowerCase()
  return ['draft', 'open', 'finalized', 'cancelled'].includes(status) ? status : 'draft'
}

function normalizeSequenceYear(value) {
  const number = Number(value)
  if (Number.isInteger(number) && number >= 2000 && number <= 9999) return number
  const date = value ? new Date(value) : new Date()
  return Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear()
}

function formatSequenceNumber(value) {
  return String(Number(value || 0)).padStart(4, '0')
}

function getContractCustomerCode(contract = {}) {
  return String(
    contract.customer_snapshot?.customer_code
      || contract.customer_snapshot?.company_name
      || contract.quote_snapshot?.client_name
      || 'CUSTOMER',
  ).trim().replace(/\s+/g, '-').toUpperCase().slice(0, 48)
}

function getDocumentNumberPattern(documentType) {
  return DEFAULT_DOCUMENT_NUMBER_PATTERN
}

function renderDocumentNumber(pattern, values = {}) {
  const seller = normalizeDocumentSellerEntityCode(values.seller)
  return String(pattern || getDocumentNumberPattern(values.document_type || ''))
    .replace(/\{\{\s*sequence\s*\}\}/gi, values.sequence || '')
    .replace(/\{\{\s*document_type\s*\}\}/gi, values.document_type || '')
    .replace(/\{\{\s*document_type_code\s*\}\}/gi, values.document_type_code || '')
    .replace(/\{\{\s*seller\s*\}\}/gi, seller)
    .replace(/\{\{\s*seller_entity_code\s*\}\}/gi, seller)
    .replace(/\{\{\s*customer\s*\}\}/gi, values.customer || '')
    .replace(/\{\{\s*year\s*\}\}/gi, values.year || '')
}

function normalizeTemplateRow(row = {}) {
  if (!row) return row
  const normalized = { ...row }
  JSON_TEMPLATE_COLUMNS.forEach(column => {
    const fallback = ['preamble', 'schedule_rows', 'content_sections'].includes(column) ? [] : {}
    normalized[column] = fromJson(normalized[column], fallback)
  })
  normalized.is_default = normalizeBoolean(normalized.is_default)
  return normalized
}

function normalizeContractRow(row = {}) {
  if (!row) return row
  const normalized = { ...row }
  JSON_CONTRACT_COLUMNS.forEach(column => {
    const fallback = ['preamble', 'schedule_rows', 'content_sections'].includes(column) ? [] : {}
    normalized[column] = fromJson(normalized[column], fallback)
  })
  normalized.signing_date = normalized.signing_date || normalized.quote_table_config?.signing_date || ''
  return normalized
}

function normalizeDocumentTemplateRow(row = {}) {
  if (!row) return row
  const normalized = { ...row }
  JSON_DOCUMENT_TEMPLATE_COLUMNS.forEach(column => {
    const fallback = column === 'content_sections' ? [] : {}
    normalized[column] = fromJson(normalized[column], fallback)
  })
  normalized.is_default = normalizeBoolean(normalized.is_default)
  return normalized
}

function mergeDefaultDocumentTemplates(rows = []) {
  const byId = new Map(rows.map(row => [row.id, normalizeDocumentTemplateRow(row)]))
  DEFAULT_CONTRACT_DOCUMENT_TEMPLATES.forEach(template => {
    const existing = byId.get(template.id)
    byId.set(template.id, normalizeDocumentTemplateRow({
      ...template,
      ...(existing || {}),
      is_system_default: true,
    }))
  })

  return Array.from(byId.values()).sort((left, right) => {
    if (left.document_type !== right.document_type) return left.document_type.localeCompare(right.document_type)
    return Number(left.sort_order || 100) - Number(right.sort_order || 100)
  })
}

function normalizeDocumentRow(row = {}) {
  if (!row) return row
  const normalized = { ...row }
  JSON_DOCUMENT_COLUMNS.forEach(column => {
    const fallback = column === 'content_sections' ? [] : {}
    normalized[column] = fromJson(normalized[column], fallback)
  })
  normalized.auto_sync_contract = normalizeBoolean(normalized.auto_sync_contract)
  normalized.sequence_number = Number(normalized.sequence_number || 0)
  normalized.sequence_year = Number(normalized.sequence_year || 0)
  return normalized
}

function normalizeContractDocumentBadge(row = {}) {
  const type = row.document_type || ''
  const shareToken = row.share_token || ''

  return {
    type,
    label: CONTRACT_DOCUMENT_BADGE_LABELS[type] || type,
    id: row.id || '',
    contract_id: row.contract_id || '',
    quote_id: row.quote_id || '',
    share_token: shareToken,
    number: row.document_number || '',
    url: shareToken ? `/d/${encodeURIComponent(shareToken)}` : '',
  }
}

async function attachContractDocuments(contracts = []) {
  const contractIds = [...new Set(contracts.map(contract => contract.id).filter(Boolean))]
  if (!contractIds.length) {
    return contracts.map(contract => ({ ...contract, contract_documents: [] }))
  }

  const placeholders = contractIds.map(() => '?').join(', ')
  const documentRows = await runQuery(
    `select id, contract_id, document_type, document_number, share_token, issued_date, created_at
     from ${tables.contractDocuments}
     where deleted_at is null
       and contract_id in (${placeholders})
       and document_type in (${CONTRACT_DOCUMENT_TYPE_ORDER.map(() => '?').join(', ')})
     order by contract_id asc,
       field(document_type, ${CONTRACT_DOCUMENT_TYPE_ORDER.map(() => '?').join(', ')}),
       issued_date desc,
       created_at desc`,
    [...contractIds, ...CONTRACT_DOCUMENT_TYPE_ORDER, ...CONTRACT_DOCUMENT_TYPE_ORDER],
  )

  const documentsByContract = new Map()
  for (const row of documentRows) {
    if (!documentsByContract.has(row.contract_id)) documentsByContract.set(row.contract_id, new Map())
    const documentsByType = documentsByContract.get(row.contract_id)
    if (!documentsByType.has(row.document_type)) {
      documentsByType.set(row.document_type, normalizeContractDocumentBadge(row))
    }
  }

  return contracts.map(contract => {
    const documentsByType = documentsByContract.get(contract.id) || new Map()
    return {
      ...contract,
      contract_documents: CONTRACT_DOCUMENT_TYPE_ORDER.map(type => documentsByType.get(type)).filter(Boolean),
    }
  })
}

function normalizeJobRow(row = {}) {
  if (!row) return row
  const locationText = stripHtml(row.job_description)
  const timeRange = [row.start_time, row.end_time].filter(Boolean).join(' - ')
  const dateText = normalizeDateText(row.job_date)
  const title = stripHtml(row.job_title)
  const customerName = row.customer_company_name || row.customer_name || row.customer_name_snapshot || ''

  return {
    id: row.id,
    job_title: title,
    job_date: row.job_date || '',
    date_text: dateText,
    start_time: row.start_time || '',
    end_time: row.end_time || '',
    time_range: timeRange,
    job_description: locationText,
    location: locationText,
    ekip: stripHtml(row.ekip),
    price: Number(row.price || 0),
    has_vat: true,
    customer_id: row.customer_id || null,
    customer_name: customerName,
    customer_snapshot: {
      customer_id: row.customer_id || '',
      customer_code: row.customer_code || '',
      company_name: customerName,
      tax_code: row.customer_tax_code || '',
      address: row.customer_address || '',
      representative: row.customer_representative || '',
      position: row.customer_position || '',
      authorization_number: row.customer_authorization_number || '',
      authorization_date: row.customer_authorization_date || '',
      email: row.customer_email || '',
      phone_number: row.customer_phone_number || '',
    },
    has_saved_contract: normalizeBoolean(row.has_saved_contract),
    contract_id: row.contract_id || null,
    contract_share_token: row.contract_share_token || '',
    contract_number: row.contract_number || '',
  }
}

function buildJobSourceSnapshot(job = {}) {
  return {
    source_type: 'job',
    external_job_id: job.id,
    job_title: job.job_title,
    job_date: job.job_date,
    date_text: job.date_text,
    start_time: job.start_time,
    end_time: job.end_time,
    time_range: job.time_range,
    job_description: job.job_description,
    location: job.location,
    ekip: job.ekip,
    price: job.price,
    has_vat: job.has_vat !== false,
    customer_snapshot: job.customer_snapshot || {},
  }
}

function buildJobQuoteSnapshot(job = {}) {
  const itemName = job.job_title
    ? `Dịch vụ media theo job ${job.job_title}`
    : 'Dịch vụ media theo job'
  const total = Number(job.price || 0)

  return {
    id: '',
    quote_number: '',
    share_token: '',
    entity_code: '',
    client_name: job.customer_name || job.customer_snapshot?.company_name || '',
    event_name: '',
    event_date: job.job_date || '',
    location: job.location || '',
    duration_hours: '',
    validity_days: '',
    has_vat: job.has_vat !== false,
    terms_text: '',
    subtotal: total,
    travel_fee_total: 0,
    overtime_fee_total: 0,
    discount_amount: 0,
    vat_amount: 0,
    total_amount: total,
    items: [
      {
        service_code: 'JOB_TOTAL',
        service_name: itemName,
        unit: 'Gói',
        quantity: 1,
        num_sessions: 1,
        billable_duration_hours: '',
        unit_price: total,
        total_price: total,
        sort_order: 1,
        group_label: '',
      },
    ],
  }
}

function buildQuoteSnapshot(quote = {}, items = []) {
  return {
    id: quote.id || '',
    quote_number: quote.quote_number || '',
    share_token: quote.share_token || '',
    entity_code: quote.entity_code || '',
    client_name: quote.client_name || quote.customer_name || '',
    event_name: quote.event_name || '',
    event_date: quote.event_date || '',
    location: quote.location || '',
    duration_hours: quote.duration_hours || '',
    validity_days: quote.validity_days || '',
    has_vat: quote.has_vat !== false,
    terms_text: quote.terms_text || '',
    subtotal: Number(quote.subtotal || 0),
    travel_fee_total: Number(quote.travel_fee_total || 0),
    overtime_fee_total: Number(quote.overtime_fee_total || 0),
    discount_amount: Number(quote.discount_amount || 0),
    discount_note: quote.discount_note || '',
    vat_amount: Number(quote.vat_amount || 0),
    total_amount: Number(quote.total_amount || 0),
    items: (Array.isArray(items) ? items : []).map((item, index) => ({
      service_code: item.service_code || '',
      service_name: item.service_name || item.service_name_raw || '',
      unit: item.unit || 'Gói',
      quantity: Number(item.quantity || 0),
      num_sessions: Number(item.num_sessions || 1),
      billable_duration_hours: item.billable_duration_hours ?? '',
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      sort_order: item.sort_order ?? index + 1,
      group_code: item.group_code || '',
      group_label: item.group_label || '',
      group_sort_order: item.group_sort_order ?? null,
    })),
  }
}

function buildCustomerSnapshotFromQuote(quote = {}) {
  return {
    customer_code: quote.customer_code || '',
    company_name: quote.company_name || quote.client_name || quote.customer_name || '',
    tax_code: quote.client_tax_code || '',
    address: quote.client_address || '',
    representative: quote.client_representative || '',
    position: quote.client_position || '',
    authorization_number: quote.client_authorization_number || '',
    authorization_date: quote.client_authorization_date || '',
    email: quote.client_email || '',
    phone_number: quote.client_phone || '',
  }
}

function buildQuoteBackedContractSnapshot({ quote = {}, items = [], inputSnapshot = {} } = {}) {
  const sellerEntityCode = inputSnapshot.seller_entity_code || quote.entity_code || 'EVT'
  const quoteSnapshot = buildQuoteSnapshot(quote, items)

  return {
    id: '',
    quote_id: quote.id || inputSnapshot.quote_id || null,
    quote_number: quote.quote_number || inputSnapshot.quote_number || null,
    source_type: 'quote',
    external_job_id: null,
    contract_number: inputSnapshot.contract_number || quote.quote_number || '',
    status: inputSnapshot.status || 'draft',
    title: inputSnapshot.title || (quote.quote_number ? `Chung tu theo bao gia ${quote.quote_number}` : 'Chung tu theo bao gia'),
    seller_entity_code: sellerEntityCode,
    seller_snapshot: inputSnapshot.seller_snapshot || {},
    customer_snapshot: inputSnapshot.customer_snapshot || buildCustomerSnapshotFromQuote(quote),
    party_role_config: inputSnapshot.party_role_config || {},
    signing_date: inputSnapshot.signing_date || quote.created_at || null,
    service_scope: inputSnapshot.service_scope || 'cung cap dich vu theo bao gia',
    schedule_rows: Array.isArray(inputSnapshot.schedule_rows) && inputSnapshot.schedule_rows.length
      ? inputSnapshot.schedule_rows
      : [{ time_range: quote.duration_hours ? `${quote.duration_hours} gio` : '', date_text: quote.event_date || '', location: quote.location || '' }],
    quote_table_config: inputSnapshot.quote_table_config || {},
    payment_config: inputSnapshot.payment_config || {},
    quote_snapshot: {
      ...quoteSnapshot,
      ...(inputSnapshot.quote_snapshot || {}),
      items: Array.isArray(inputSnapshot.quote_snapshot?.items) && inputSnapshot.quote_snapshot.items.length
        ? inputSnapshot.quote_snapshot.items
        : quoteSnapshot.items,
    },
    source_snapshot: inputSnapshot.source_snapshot || {
      source_type: 'quote',
      quote_id: quote.id || '',
      quote_number: quote.quote_number || '',
    },
    updated_at: quote.updated_at || null,
  }
}

async function getQuoteById(id) {
  const rows = await runQuery(`select * from ${tables.quotes} where id = ? limit 1`, [id])
  const quote = rows?.[0]
  if (!quote) {
    const error = new Error('Khong tim thay bao gia.')
    error.statusCode = 404
    throw error
  }
  return quote
}

async function getQuoteItems(quoteId) {
  if (!quoteId) return []
  return runQuery(
    `select *
     from ${tables.quoteItems}
     where quote_id = ?
     order by sort_order asc, created_at asc`,
    [quoteId],
  )
}

async function getQuoteByShareToken(shareToken) {
  const rows = await runQuery(
    `select id, deleted_at from ${tables.quotes} where share_token = ? limit 1`,
    [shareToken],
  )
  const quote = rows?.[0]
  if (!quote || quote.deleted_at) return null
  return quote
}

async function listTemplates() {
  const rows = await runQuery(
    `select * from ${tables.contractTemplates}
     order by sort_order asc, created_at desc`,
  )
  return rows.map(normalizeTemplateRow)
}

async function listDocumentTemplates(queryParams = {}) {
  const documentType = normalizeDocumentType(getQueryValue(queryParams.document_type, ''))
  const where = ['deleted_at is null']
  const params = []

  if (documentType) {
    where.push('document_type = ?')
    params.push(documentType)
  }

  const rows = await runQuery(
    `select * from ${tables.contractDocumentTemplates}
     where ${where.join(' and ')}
     order by document_type asc, sort_order asc, created_at desc`,
    params,
  )
  const mergedRows = mergeDefaultDocumentTemplates(rows)
  return documentType ? mergedRows.filter(row => row.document_type === documentType) : mergedRows
}

async function getDocumentTemplateById(id, { includeDeleted = false } = {}) {
  const where = includeDeleted ? 'id = ?' : 'id = ? and deleted_at is null'
  const rows = await runQuery(`select * from ${tables.contractDocumentTemplates} where ${where} limit 1`, [id])
  if (rows?.[0]) return normalizeDocumentTemplateRow(rows[0])
  const defaultTemplate = DEFAULT_CONTRACT_DOCUMENT_TEMPLATES.find(template => template.id === id)
  return defaultTemplate ? normalizeDocumentTemplateRow({ ...defaultTemplate, is_system_default: true }) : null
}

async function listContracts(queryParams = {}) {
  const page = getPositiveInteger(queryParams.page, 1)
  const pageSize = getPositiveInteger(queryParams.pageSize, 20)
  const offset = (page - 1) * pageSize
  const sourceType = getQueryValue(queryParams.source_type, '')
  const search = String(getQueryValue(queryParams.search, '') || '').trim()
  const where = ['c.deleted_at is null']
  const params = []

  if (sourceType) {
    where.push('c.source_type = ?')
    params.push(sourceType)
  }

  if (search) {
    where.push(`(
      c.contract_number like ?
      or c.quote_number like ?
      or json_unquote(json_extract(c.customer_snapshot, '$.company_name')) like ?
      or json_unquote(json_extract(c.source_snapshot, '$.job_title')) like ?
    )`)
    params.push(...Array(4).fill(`%${search}%`))
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const countRows = await runQuery(`select count(*) as count from ${tables.contracts} c ${whereSql}`, params)
  const rows = await runQuery(
    `select c.*
     from ${tables.contracts} c
     ${whereSql}
     order by c.updated_at desc, c.created_at desc
     limit ${pageSize} offset ${offset}`,
    params,
  )

  const contracts = await attachContractDocuments(rows.map(normalizeContractRow))

  return {
    contracts,
    count: Number(countRows?.[0]?.count || 0),
    page,
    pageSize,
  }
}

async function listContractJobs(queryParams = {}) {
  const page = getPositiveInteger(queryParams.page, 1)
  const pageSize = getPositiveInteger(queryParams.pageSize, 20)
  const offset = (page - 1) * pageSize
  const search = String(getQueryValue(queryParams.search, '') || '').trim()
  const where = ['j.deleted_at is null']
  const params = []

  if (search) {
    where.push(`(
      j.job_title like ?
      or j.job_description like ?
      or j.customer_name like ?
      or customers.company_name like ?
      or customers.customer_code like ?
    )`)
    params.push(...Array(5).fill(`%${search}%`))
  }

  const whereSql = `where ${where.join(' and ')}`
  const countRows = await runQuery(`select count(*) as count from ${tables.jobs} j left join ${tables.customers} customers on customers.id = j.customer_id ${whereSql}`, params)
  const rows = await runQuery(
    `select
       j.id, j.job_title, j.job_date, j.start_time, j.end_time, j.job_description,
       j.ekip, j.price, j.customer_id, j.customer_name as customer_name_snapshot,
       customers.customer_code, customers.company_name as customer_company_name,
       customers.tax_code as customer_tax_code,
       customers.address as customer_address, customers.representative as customer_representative,
       customers.position as customer_position,
       customers.authorization_number as customer_authorization_number,
       customers.authorization_date as customer_authorization_date,
       customers.phone_number as customer_phone_number,
       customers.email as customer_email,
       c.id as contract_id, c.share_token as contract_share_token, c.contract_number,
       case when c.id is null then 0 else 1 end as has_saved_contract
     from ${tables.jobs} j
     left join ${tables.customers} customers on customers.id = j.customer_id
     left join ${tables.contracts} c on c.source_type = 'job' and c.external_job_id = j.id and c.deleted_at is null
     ${whereSql}
     order by j.job_date desc, j.id desc
     limit ${pageSize} offset ${offset}`,
    params,
  )

  return {
    jobs: rows.map(normalizeJobRow),
    count: Number(countRows?.[0]?.count || 0),
    page,
    pageSize,
  }
}

async function getContractJobById(jobId) {
  const rows = await runQuery(
    `select
       j.id, j.job_title, j.job_date, j.start_time, j.end_time, j.job_description,
       j.ekip, j.price, j.customer_id, j.customer_name as customer_name_snapshot,
       customers.customer_code, customers.company_name as customer_company_name,
       customers.tax_code as customer_tax_code,
       customers.address as customer_address, customers.representative as customer_representative,
       customers.position as customer_position,
       customers.authorization_number as customer_authorization_number,
       customers.authorization_date as customer_authorization_date,
       customers.phone_number as customer_phone_number,
       customers.email as customer_email,
       c.id as contract_id, c.share_token as contract_share_token, c.contract_number,
       case when c.id is null then 0 else 1 end as has_saved_contract
     from ${tables.jobs} j
     left join ${tables.customers} customers on customers.id = j.customer_id
     left join ${tables.contracts} c on c.source_type = 'job' and c.external_job_id = j.id and c.deleted_at is null
     where j.id = ? and j.deleted_at is null
     limit 1`,
    [jobId],
  )

  const job = rows?.[0] ? normalizeJobRow(rows[0]) : null
  if (!job) {
    const error = new Error('Khong tim thay job.')
    error.statusCode = 404
    throw error
  }
  return {
    ...job,
    source_snapshot: buildJobSourceSnapshot(job),
    quote_snapshot: buildJobQuoteSnapshot(job),
    schedule_rows: [{
      time_range: job.time_range,
      date_text: job.date_text,
      location: job.location,
    }],
  }
}

function cleanTemplatePayload(template = {}) {
  const isProtectedTemplate = PROTECTED_CONTRACT_TEMPLATE_IDS.has(template.id)
  return {
    id: template.id || makeId('template'),
    name: String(template.name || '').trim(),
    description: String(template.description || '').trim() || null,
    title: String(template.title || '').trim() || 'HOP DONG CUNG CAP DICH VU',
    seller_entity_code: emptyToNull(normalizeDocumentSellerEntityCode(template.seller_entity_code || template.entity_code)),
    party_role_config: toJson(template.party_role_config || {}, {}),
    contract_number_pattern: template.contract_number_pattern || 'HD-{{quote_code}}',
    preamble: toJson(Array.isArray(template.preamble) ? template.preamble : [], []),
    service_scope: template.service_scope || '',
    schedule_rows: toJson(Array.isArray(template.schedule_rows) ? template.schedule_rows : [], []),
    quote_table_config: toJson(template.quote_table_config || {}, {}),
    payment_config: toJson(template.payment_config || {}, {}),
    content_sections: toJson(Array.isArray(template.content_sections) ? template.content_sections : [], []),
    terms_text: String(template.terms_text || '').trim(),
    is_default: isProtectedTemplate ? false : Boolean(template.is_default),
    is_active: template.is_active !== false,
    sort_order: Number(template.sort_order || 100),
  }
}

function cleanDocumentTemplatePayload(template = {}) {
  const documentType = normalizeDocumentType(template.document_type)
  return {
    id: template.id || makeId('doc_template'),
    document_type: documentType,
    name: String(template.name || '').trim(),
    description: String(template.description || '').trim() || null,
    title: String(template.title || '').trim() || '',
    seller_entity_code: emptyToNull(normalizeDocumentSellerEntityCode(template.seller_entity_code || template.entity_code)),
    document_number_pattern: template.document_number_pattern || getDocumentNumberPattern(documentType),
    fields_config: toJson(template.fields_config || {}, {}),
    numbering_config: toJson(template.numbering_config || {}, {}),
    content_sections: toJson(Array.isArray(template.content_sections) ? template.content_sections : [], []),
    terms_text: String(template.terms_text || '').trim(),
    is_default: Boolean(template.is_default),
    sort_order: Number(template.sort_order || 100),
  }
}

function buildDocumentTemplateSnapshot(template = null) {
  if (!template) return {}
  const {
    deleted_at: _deletedAt,
    created_at,
    updated_at,
    ...snapshot
  } = normalizeDocumentTemplateRow(template)
  return {
    ...snapshot,
    snapshot_created_at: new Date().toISOString(),
    template_created_at: created_at || null,
    template_updated_at: updated_at || null,
  }
}

function buildDocumentContractSnapshot(contract = {}) {
  if (!contract) return {}
  return {
    id: contract.id,
    quote_id: contract.quote_id || null,
    quote_number: contract.quote_number || null,
    source_type: contract.source_type || 'manual',
    external_job_id: contract.external_job_id || null,
    contract_number: contract.contract_number || '',
    status: contract.status || 'draft',
    title: contract.title || '',
    seller_entity_code: contract.seller_entity_code || '',
    seller_snapshot: contract.seller_snapshot || {},
    customer_snapshot: contract.customer_snapshot || {},
    party_role_config: contract.party_role_config || {},
    service_scope: contract.service_scope || '',
    schedule_rows: contract.schedule_rows || [],
    quote_table_config: contract.quote_table_config || {},
    payment_config: contract.payment_config || {},
    quote_snapshot: contract.quote_snapshot || {},
    source_snapshot: contract.source_snapshot || {},
    updated_at: contract.updated_at || null,
  }
}

const PUBLIC_PROFILE_FIELDS = [
  'customer_code',
  'company_name',
  'entity_name_full',
  'legal_name',
  'name',
  'tax_code',
  'address',
  'representative',
  'position',
  'authorization_number',
  'authorization_date',
  'bank_account',
  'account_number',
  'bank_name',
  'account_holder',
]

function pickPublicProfile(profile = {}) {
  return PUBLIC_PROFILE_FIELDS.reduce((payload, key) => {
    if (profile?.[key] !== undefined && profile?.[key] !== null) payload[key] = profile[key]
    return payload
  }, {})
}

function buildPublicQuoteSnapshot(snapshot = {}) {
  return {
    has_vat: snapshot.has_vat !== false,
    vat_mode: snapshot.vat_mode || '',
    vat_rate: snapshot.vat_rate ?? null,
    subtotal: Number(snapshot.subtotal || 0),
    discount_amount: Number(snapshot.discount_amount || 0),
    vat_amount: Number(snapshot.vat_amount || 0),
    total_amount: Number(snapshot.total_amount || 0),
  }
}

function buildPublicContractSnapshot(snapshot = {}) {
  return {
    contract_number: snapshot.contract_number || '',
    status: snapshot.status || '',
    title: snapshot.title || '',
    seller_entity_code: snapshot.seller_entity_code || '',
    seller_snapshot: pickPublicProfile(snapshot.seller_snapshot || {}),
    customer_snapshot: pickPublicProfile(snapshot.customer_snapshot || {}),
    party_role_config: snapshot.party_role_config || {},
    service_scope: snapshot.service_scope || '',
    schedule_rows: Array.isArray(snapshot.schedule_rows) ? snapshot.schedule_rows : [],
    quote_table_config: snapshot.quote_table_config || {},
    payment_config: snapshot.payment_config || {},
    quote_snapshot: buildPublicQuoteSnapshot(snapshot.quote_snapshot || {}),
    updated_at: snapshot.updated_at || null,
  }
}

function sanitizePublicDeductionRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    document_number: row.document_number || '',
    document_title: row.document_title || row.title || '',
    original_amount: Number(row.original_amount ?? row.advance_amount ?? 0),
    deduction_amount: Number(row.deduction_amount ?? row.original_amount ?? row.advance_amount ?? 0),
  }))
}

function sanitizePublicDocumentData(data = {}) {
  const formData = { ...(data.form_data || {}) }
  const amountConfig = { ...(data.amount_config || {}) }
  delete formData.acceptance_document_id
  delete amountConfig.acceptance_document_id
  if (formData.advance_deductions) formData.advance_deductions = sanitizePublicDeductionRows(formData.advance_deductions)
  if (data.advance_deductions) formData.advance_deductions = sanitizePublicDeductionRows(data.advance_deductions)
  if (amountConfig.linked_advance_documents) {
    amountConfig.linked_advance_documents = sanitizePublicDeductionRows(amountConfig.linked_advance_documents)
  }

  return {
    form_data: formData,
    amount_config: amountConfig,
    amount: Number(data.amount || 0),
    advance_amount: Number(data.advance_amount || 0),
    acceptance_amount: Number(data.acceptance_amount || 0),
    payment_amount: Number(data.payment_amount || 0),
    note: data.note || '',
    bank_account: data.bank_account || '',
    advance_deductions: sanitizePublicDeductionRows(data.advance_deductions || formData.advance_deductions || []),
  }
}

function buildPublicTemplateSnapshot(snapshot = {}) {
  return {
    document_type: snapshot.document_type || '',
    name: snapshot.name || '',
    title: snapshot.title || '',
  }
}

function buildPublicDocumentDto(document = {}) {
  if (!document) return null
  const normalized = normalizeDocumentRow(document)
  return {
    document_type: normalized.document_type,
    document_number: normalized.document_number,
    title: normalized.title,
    issued_date: normalized.issued_date,
    created_at: normalized.created_at,
    updated_at: normalized.updated_at,
    template_snapshot: buildPublicTemplateSnapshot(normalized.template_snapshot || {}),
    contract_snapshot: buildPublicContractSnapshot(normalized.contract_snapshot || {}),
    document_data: sanitizePublicDocumentData(normalized.document_data || {}),
    content_sections: Array.isArray(normalized.content_sections) ? normalized.content_sections : [],
    terms_text: normalized.terms_text || '',
  }
}

function normalizeCustomerRow(row = {}) {
  if (!row) return row
  return {
    id: row.id,
    customer_code: row.customer_code || '',
    company_name: row.company_name || '',
    tax_code: row.tax_code || '',
    address: row.address || '',
    representative: row.representative || '',
    position: row.position || '',
    authorization_number: row.authorization_number || '',
    authorization_date: row.authorization_date || '',
    phone_number: row.phone_number || '',
    contact_name: row.contact_name || '',
    email: row.email || '',
    entry_date: row.entry_date || '',
    note: row.note || '',
  }
}

function cleanCustomerPayload(customer = {}) {
  return CUSTOMER_COLUMNS.reduce((payload, column) => {
    const value = customer[column]
    payload[column] = column === 'customer_code'
      ? String(value || '').trim()
      : emptyToNull(typeof value === 'string' ? value.trim() : value)
    return payload
  }, {})
}

async function listCustomers(search = '') {
  const value = String(search || '').trim()
  const params = []
  let whereSql = ''

  if (value) {
    whereSql = `where customer_code like ? or company_name like ? or tax_code like ?`
    params.push(`%${value}%`, `%${value}%`, `%${value}%`)
  }

  const rows = await runQuery(
    `select id, ${CUSTOMER_COLUMNS.join(', ')}
     from ${tables.customers}
     ${whereSql}
     order by updated_at desc, id desc
     limit 50`,
    params,
  )
  return rows.map(normalizeCustomerRow)
}

async function getCustomerByCode(customerCode = '') {
  const code = String(customerCode || '').trim()
  if (!code) return null

  const rows = await runQuery(
    `select id, ${CUSTOMER_COLUMNS.join(', ')}
     from ${tables.customers}
     where customer_code = ?
     limit 1`,
    [code],
  )
  return rows?.[0] ? normalizeCustomerRow(rows[0]) : null
}

async function createCustomer(customer = {}) {
  const payload = cleanCustomerPayload(customer)
  if (!payload.customer_code) {
    const error = new Error('Ma khach hang khong duoc de trong.')
    error.statusCode = 400
    throw error
  }

  const existing = await getCustomerByCode(payload.customer_code)
  if (existing?.id) {
    const error = new Error('Ma khach hang nay da ton tai trong he thong.')
    error.statusCode = 409
    error.code = 'CUSTOMER_EXISTS'
    throw error
  }

  await runTransaction(async connection => {
    await insertDataRow(connection, tables.customers, payload)
  })

  return getCustomerByCode(payload.customer_code)
}

async function saveTemplate(template = {}) {
  const payload = cleanTemplatePayload(template)

  if (!payload.name) {
    const error = new Error('Thieu ten mau hop dong.')
    error.statusCode = 400
    throw error
  }

  if (!payload.terms_text) {
    const error = new Error('Thieu noi dung dieu khoan hop dong.')
    error.statusCode = 400
    throw error
  }

  await runTransaction(async connection => {
    if (payload.is_default) {
      await connection.query(
        `update ${tables.contractTemplates} set is_default = 0 where is_default = 1 and id <> ?`,
        [payload.id],
      )
    }

    await connection.query(
      `insert into ${tables.contractTemplates}
       (id, name, description, title, seller_entity_code, party_role_config, contract_number_pattern,
        preamble, service_scope, schedule_rows, quote_table_config, payment_config, content_sections,
        terms_text, is_default, is_active, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on duplicate key update
        name = values(name),
        description = values(description),
        title = values(title),
        seller_entity_code = values(seller_entity_code),
        party_role_config = values(party_role_config),
        contract_number_pattern = values(contract_number_pattern),
        preamble = values(preamble),
        service_scope = values(service_scope),
        schedule_rows = values(schedule_rows),
        quote_table_config = values(quote_table_config),
        payment_config = values(payment_config),
        content_sections = values(content_sections),
        terms_text = values(terms_text),
        is_default = values(is_default),
        is_active = values(is_active),
        sort_order = values(sort_order),
        updated_at = current_timestamp(3)`,
      [
        payload.id,
        payload.name,
        payload.description,
        payload.title,
        payload.seller_entity_code,
        payload.party_role_config,
        payload.contract_number_pattern,
        payload.preamble,
        payload.service_scope,
        payload.schedule_rows,
        payload.quote_table_config,
        payload.payment_config,
        payload.content_sections,
        payload.terms_text,
        payload.is_default,
        payload.is_active,
        payload.sort_order,
      ],
    )
  })

  const rows = await runQuery(`select * from ${tables.contractTemplates} where id = ? limit 1`, [payload.id])
  return normalizeTemplateRow(rows?.[0])
}

async function saveDocumentTemplate(template = {}) {
  const payload = cleanDocumentTemplatePayload(template)

  if (!payload.document_type) {
    const error = new Error('Loai chung tu khong hop le.')
    error.statusCode = 400
    throw error
  }

  if (!payload.name) {
    const error = new Error('Thieu ten mau chung tu.')
    error.statusCode = 400
    throw error
  }

  await runTransaction(async connection => {
    if (payload.is_default) {
      await connection.query(
        `update ${tables.contractDocumentTemplates}
         set is_default = 0
         where deleted_at is null and document_type = ? and is_default = 1 and id <> ?`,
        [payload.document_type, payload.id],
      )
    }

    await connection.query(
      `insert into ${tables.contractDocumentTemplates}
       (id, document_type, name, description, title, seller_entity_code, document_number_pattern,
        fields_config, numbering_config, content_sections, terms_text, is_default, sort_order)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on duplicate key update
        document_type = values(document_type),
        name = values(name),
        description = values(description),
        title = values(title),
        seller_entity_code = values(seller_entity_code),
        document_number_pattern = values(document_number_pattern),
        fields_config = values(fields_config),
        numbering_config = values(numbering_config),
        content_sections = values(content_sections),
        terms_text = values(terms_text),
        is_default = values(is_default),
        sort_order = values(sort_order),
        deleted_at = null,
        updated_at = current_timestamp(3)`,
      [
        payload.id,
        payload.document_type,
        payload.name,
        payload.description,
        payload.title,
        payload.seller_entity_code,
        payload.document_number_pattern,
        payload.fields_config,
        payload.numbering_config,
        payload.content_sections,
        payload.terms_text,
        payload.is_default,
        payload.sort_order,
      ],
    )
  })

  return getDocumentTemplateById(payload.id)
}

async function deleteTemplate(id) {
  await runQuery(`delete from ${tables.contractTemplates} where id = ?`, [id])
  return { ok: true }
}

async function deleteDocumentTemplate(id) {
  await runQuery(
    `update ${tables.contractDocumentTemplates}
     set deleted_at = current_timestamp(3)
     where id = ? and deleted_at is null`,
    [id],
  )
  return { ok: true }
}

async function getContractForDocument(contractId) {
  const contract = await getContractById(contractId)
  if (!contract?.id) {
    const error = new Error('Khong tim thay hop dong.')
    error.statusCode = 404
    throw error
  }
  return contract
}

async function getDocumentById(id, { includeDeleted = false } = {}) {
  const where = includeDeleted ? 'id = ?' : 'id = ? and deleted_at is null'
  const rows = await runQuery(`select * from ${tables.contractDocuments} where ${where} limit 1`, [id])
  return rows?.[0] ? normalizeDocumentRow(rows[0]) : null
}

async function getDocumentByShareToken(shareToken) {
  let rows = []
  try {
    rows = await runQuery(
      `select d.*
       from ${tables.contractDocuments} d
       left join ${tables.contracts} c on c.id = d.contract_id and c.deleted_at is null
       left join ${tables.quotes} q on q.id = d.quote_id and q.deleted_at is null
       where d.share_token = ?
         and d.deleted_at is null
         and (c.id is not null or q.id is not null)
       limit 1`,
      [shareToken],
    )
  } catch (error) {
    if (!isMissingQuoteDocumentColumnError(error)) throw error
    rows = await runQuery(
      `select d.*
       from ${tables.contractDocuments} d
       inner join ${tables.contracts} c on c.id = d.contract_id and c.deleted_at is null
       where d.share_token = ? and d.deleted_at is null
       limit 1`,
      [shareToken],
    )
  }
  return rows?.[0] ? buildPublicDocumentDto(rows[0]) : null
}

async function getActiveDocumentReference(id) {
  if (!id) return null
  const rows = await runQuery(
    `select id, contract_id, document_type, document_number, title
     from ${tables.contractDocuments}
     where id = ? and deleted_at is null
     limit 1`,
    [id],
  )
  return rows?.[0] || null
}

function getPaymentDocumentLinks(documentData = {}) {
  const formData = documentData.form_data || {}
  const amountConfig = documentData.amount_config || {}
  const acceptanceDocumentId = formData.acceptance_document_id
    || documentData.acceptance_document_id
    || amountConfig.acceptance_document_id
    || ''
  const advanceDeductions = Array.isArray(formData.advance_deductions)
    ? formData.advance_deductions
    : Array.isArray(documentData.advance_deductions)
      ? documentData.advance_deductions
      : Array.isArray(amountConfig.linked_advance_documents)
        ? amountConfig.linked_advance_documents
        : []

  return {
    acceptanceDocumentId,
    advanceDocumentIds: [...new Set(advanceDeductions.map(row => row.document_id || row.id).filter(Boolean))],
  }
}

async function validatePaymentDocumentLinks({ contractId, documentData, currentDocumentId }) {
  const { acceptanceDocumentId, advanceDocumentIds } = getPaymentDocumentLinks(documentData)
  if (!acceptanceDocumentId) {
    throw makeHttpError('De nghi thanh toan can lien ket voi mot BBNT.', 400, 'PAYMENT_ACCEPTANCE_REQUIRED')
  }

  const acceptance = await getActiveDocumentReference(acceptanceDocumentId)
  if (
    !acceptance
    || acceptance.id === currentDocumentId
    || acceptance.contract_id !== contractId
    || acceptance.document_type !== 'acceptance_liquidation'
  ) {
    throw makeHttpError('BBNT lien ket khong hop le hoac da bi xoa.', 400, 'PAYMENT_ACCEPTANCE_INVALID')
  }

  for (const advanceDocumentId of advanceDocumentIds) {
    const advance = await getActiveDocumentReference(advanceDocumentId)
    if (
      !advance
      || advance.id === currentDocumentId
      || advance.contract_id !== contractId
      || advance.document_type !== 'advance_request'
    ) {
      throw makeHttpError('De nghi tam ung khau tru khong hop le hoac da bi xoa.', 400, 'PAYMENT_ADVANCE_INVALID')
    }
  }
}

async function listDocumentsByContract(queryParams = {}) {
  const contractId = getQueryValue(queryParams.contract_id, '')
  const quoteId = getQueryValue(queryParams.quote_id, '')
  if (!contractId && !quoteId) {
    const error = new Error('Thieu contract id hoac quote id.')
    error.statusCode = 400
    throw error
  }

  const documentType = normalizeDocumentType(getQueryValue(queryParams.document_type, ''))
  const where = [contractId ? 'contract_id = ?' : 'quote_id = ?', 'deleted_at is null']
  const params = [contractId || quoteId]
  if (documentType) {
    where.push('document_type = ?')
    params.push(documentType)
  }

  const rows = await runQuery(
    `select * from ${tables.contractDocuments}
     where ${where.join(' and ')}
     order by issued_date desc, created_at desc`,
    params,
  )
  return rows.map(normalizeDocumentRow)
}

async function takeNextDocumentNumber(connection, {
  documentType,
  sellerEntityCode,
  customerCode,
  sequenceYear,
  pattern,
}) {
  const counterId = `${sellerEntityCode}:${documentType}:${sequenceYear}`
  await connection.query(
    `insert into ${tables.contractDocumentNumberCounters}
     (id, seller_entity_code, document_type, sequence_year, last_sequence)
     values (?, ?, ?, ?, 1)
     on duplicate key update last_sequence = last_sequence + 1, updated_at = current_timestamp(3)`,
    [counterId, sellerEntityCode, documentType, sequenceYear],
  )
  const [counterRows] = await connection.query(
    `select last_sequence from ${tables.contractDocumentNumberCounters} where id = ? limit 1`,
    [counterId],
  )
  const sequenceNumber = Number(counterRows?.[0]?.last_sequence || 1)
  const documentNumber = renderDocumentNumber(pattern, {
    sequence: formatSequenceNumber(sequenceNumber),
    document_type: documentType,
    document_type_code: CONTRACT_DOCUMENT_TYPE_CODES[documentType] || documentType.toUpperCase(),
    seller: sellerEntityCode,
    customer: customerCode,
    year: String(sequenceYear),
  })
  return { sequenceNumber, documentNumber }
}

async function allocateDocumentNumber(connection, {
  documentId,
  ...numberConfig
}) {
  const { sequenceNumber, documentNumber } = await takeNextDocumentNumber(connection, numberConfig)
  const {
    documentType,
    sellerEntityCode,
    sequenceYear,
  } = numberConfig
  const ledgerId = makeId('doc_no')
  await insertDataRow(connection, tables.contractDocumentNumberLedger, {
    id: ledgerId,
    document_id: documentId,
    seller_entity_code: sellerEntityCode,
    document_type: documentType,
    sequence_year: sequenceYear,
    sequence_number: sequenceNumber,
    document_number: documentNumber,
  })
  return { sequenceNumber, documentNumber }
}

async function reassignDocumentNumber(connection, {
  documentId,
  ...numberConfig
}) {
  const { sequenceNumber, documentNumber } = await takeNextDocumentNumber(connection, numberConfig)
  const {
    documentType,
    sellerEntityCode,
    sequenceYear,
  } = numberConfig
  const [ledgerRows] = await connection.query(
    `select id from ${tables.contractDocumentNumberLedger} where document_id = ? limit 1`,
    [documentId],
  )
  const ledgerPayload = {
    document_id: documentId,
    seller_entity_code: sellerEntityCode,
    document_type: documentType,
    sequence_year: sequenceYear,
    sequence_number: sequenceNumber,
    document_number: documentNumber,
  }

  if (ledgerRows?.[0]?.id) {
    await updateDataRow(connection, tables.contractDocumentNumberLedger, ledgerPayload, 'id = ?', [ledgerRows[0].id])
  } else {
    await insertDataRow(connection, tables.contractDocumentNumberLedger, {
      id: makeId('doc_no'),
      ...ledgerPayload,
    })
  }

  return { sequenceNumber, documentNumber }
}

async function cleanDocumentPayload(document = {}, existing = null) {
  const documentType = normalizeDocumentType(document.document_type || existing?.document_type)
  const status = normalizeDocumentStatus(document.status || existing?.status || 'draft')
  const documentData = document.document_data || document.data || existing?.document_data || {}
  const contractId = document.contract_id || existing?.contract_id || ''
  const quoteId = document.quote_id || existing?.quote_id || ''

  if (!documentType) {
    const error = new Error('Loai chung tu khong hop le.')
    error.statusCode = 400
    throw error
  }

  let contract = null
  let sourceQuoteId = ''
  if (contractId) {
    contract = await getContractForDocument(contractId)
  } else {
    if (documentType !== 'acceptance_liquidation') {
      throw makeHttpError('Chi BBNT duoc tao truc tiep tu bao gia.', 400, 'QUOTE_DOCUMENT_TYPE_INVALID')
    }
    if (!quoteId) {
      throw makeHttpError('Thieu quote id de tao BBNT.', 400, 'QUOTE_DOCUMENT_REQUIRED')
    }
    const quote = await getQuoteById(quoteId)
    const quoteItems = await getQuoteItems(quoteId)
    sourceQuoteId = quote.id
    contract = buildQuoteBackedContractSnapshot({
      quote,
      items: quoteItems,
      inputSnapshot: document.contract_snapshot || existing?.contract_snapshot || {},
    })
  }

  if (existing?.id && existing.document_type !== documentType) {
    const error = new Error('Khong doi loai chung tu sau khi da tao so.')
    error.statusCode = 400
    throw error
  }

  if (
    existing?.id
    && document.refresh_template_snapshot
    && [existing.status, status].some(value => normalizeDocumentStatus(value) === 'finalized')
  ) {
    const error = new Error('Khong doi mau chung tu da finalized.')
    error.statusCode = 400
    throw error
  }

  const explicitTemplateSnapshot = document.template_snapshot && Object.keys(document.template_snapshot).length
    ? document.template_snapshot
    : null
  const templateId = document.template_id || existing?.template_id || null
  const template = templateId ? await getDocumentTemplateById(templateId) : null
  const templateSnapshot = existing?.template_snapshot && !document.refresh_template_snapshot
    ? existing.template_snapshot
    : explicitTemplateSnapshot || buildDocumentTemplateSnapshot(template)
  const autoSyncContract = document.auto_sync_contract ?? existing?.auto_sync_contract ?? true
  const canAutoSyncContract = Boolean(contract.id)
  const contractSnapshot = canAutoSyncContract && autoSyncContract && OPEN_DOCUMENT_STATUSES.has(status)
    ? buildDocumentContractSnapshot(contract)
    : document.contract_snapshot || existing?.contract_snapshot || (contract.id ? buildDocumentContractSnapshot(contract) : contract)
  const requestedSellerEntityCode = normalizeDocumentSellerEntityCode(
    document.seller_entity_code
      || existing?.seller_entity_code
      || template?.seller_entity_code
      || contract.seller_entity_code
      || 'EVT',
  )
  const sellerEntityChanged = Boolean(
    existing?.id
    && requestedSellerEntityCode
    && requestedSellerEntityCode !== existing.seller_entity_code,
  )
  if (sellerEntityChanged && [existing.status, status].some(value => normalizeDocumentStatus(value) === 'finalized')) {
    const error = new Error('Khong doi phap nhan cua chung tu da finalized.')
    error.statusCode = 400
    throw error
  }
  const sellerEntityCode = sellerEntityChanged
    ? requestedSellerEntityCode
    : String(existing?.seller_entity_code || requestedSellerEntityCode).trim()
  const sequenceYear = existing?.sequence_year || normalizeSequenceYear(document.sequence_year || document.issued_date)
  const documentNumberPattern = existing?.document_number_pattern
    || document.document_number_pattern
    || template?.document_number_pattern
    || getDocumentNumberPattern(documentType)

  if (documentType === 'payment_request') {
    await validatePaymentDocumentLinks({
      contractId: contract.id,
      documentData,
      currentDocumentId: existing?.id || document.id || '',
    })
  }

  return {
    contract,
    payload: {
      contract_id: contract.id || null,
      quote_id: contract.id ? null : sourceQuoteId,
      document_type: documentType,
      status,
      template_id: templateId,
      title: String(document.title || existing?.title || template?.title || '').trim(),
      seller_entity_code: sellerEntityCode,
      document_number_pattern: documentNumberPattern,
      sequence_year: sequenceYear,
      issued_date: emptyToNull(document.issued_date || existing?.issued_date),
      finalized_at: status === 'finalized'
        ? toMysqlDateTime(document.finalized_at || existing?.finalized_at || new Date())
        : toMysqlDateTime(document.finalized_at || existing?.finalized_at),
      share_token: document.share_token || existing?.share_token || makeShareToken(),
      template_snapshot: toJson(templateSnapshot, {}),
      contract_snapshot: toJson(contractSnapshot, {}),
      document_data: toJson(documentData, {}),
      content_sections: toJson(
        Array.isArray(document.content_sections)
          ? document.content_sections
          : existing?.content_sections || template?.content_sections || [],
        [],
      ),
      terms_text: document.terms_text ?? existing?.terms_text ?? template?.terms_text ?? '',
      auto_sync_contract: Boolean(autoSyncContract),
    },
    customerCode: getContractCustomerCode(contract),
  }
}

async function saveDocument(document = {}) {
  let existing = null
  if (document.id) existing = await getDocumentById(document.id)
  const id = existing?.id || document.id || makeReadableShortId('doc', 12)
  const { payload, customerCode } = await cleanDocumentPayload(document, existing)

  await runTransaction(async connection => {
    let sequenceNumber = existing?.sequence_number || Number(document.sequence_number || 0)
    let documentNumber = existing?.document_number || document.document_number || ''

    if (!existing?.id) {
      const allocated = await allocateDocumentNumber(connection, {
        documentId: id,
        documentType: payload.document_type,
        sellerEntityCode: payload.seller_entity_code,
        customerCode,
        sequenceYear: payload.sequence_year,
        pattern: payload.document_number_pattern,
      })
      sequenceNumber = allocated.sequenceNumber
      documentNumber = allocated.documentNumber
    } else if (payload.seller_entity_code !== existing.seller_entity_code) {
      const reassigned = await reassignDocumentNumber(connection, {
        documentId: existing.id,
        documentType: payload.document_type,
        sellerEntityCode: payload.seller_entity_code,
        customerCode,
        sequenceYear: payload.sequence_year,
        pattern: payload.document_number_pattern,
      })
      sequenceNumber = reassigned.sequenceNumber
      documentNumber = reassigned.documentNumber
    }

    const rowPayload = {
      ...payload,
      sequence_number: sequenceNumber,
      document_number: documentNumber,
    }

    if (existing?.id) {
      await updateDataRow(connection, tables.contractDocuments, rowPayload, 'id = ?', [existing.id])
    } else {
      await insertDataRow(connection, tables.contractDocuments, { id, ...rowPayload })
    }
  })

  return getDocumentById(id)
}

async function deleteDocument(id) {
  await runQuery(
    `update ${tables.contractDocuments}
     set deleted_at = current_timestamp(3)
     where id = ? and deleted_at is null`,
    [id],
  )
  return { ok: true }
}

async function syncOpenContractDocuments(connection, contract = {}) {
  if (!contract?.id) return
  await connection.query(
    `update ${tables.contractDocuments}
     set contract_snapshot = ?, updated_at = current_timestamp(3)
     where contract_id = ?
       and deleted_at is null
       and auto_sync_contract = 1
       and status in ('draft', 'open')`,
    [toJson(buildDocumentContractSnapshot(contract), {}), contract.id],
  )
}

async function deleteContract({ id, quoteId } = {}) {
  if (!id && !quoteId) {
    const error = new Error('Thieu contract id hoac quote id.')
    error.statusCode = 400
    throw error
  }

  await runTransaction(async connection => {
    const whereSql = id ? 'id = ?' : 'quote_id = ?'
    const params = [id || quoteId]
    const [rows] = await connection.query(
      `select id from ${tables.contracts} where ${whereSql} and deleted_at is null`,
      params,
    )
    const contractIds = rows.map(row => row.id)
    if (!contractIds.length) return

    await connection.query(
      `update ${tables.contracts}
       set deleted_at = current_timestamp(3), updated_at = current_timestamp(3)
       where ${whereSql}`,
      params,
    )
    await connection.query(
      `update ${tables.contractDocuments}
       set deleted_at = current_timestamp(3), updated_at = current_timestamp(3)
       where contract_id in (${contractIds.map(() => '?').join(', ')}) and deleted_at is null`,
      contractIds,
    )
  })
  return { ok: true }
}

async function getContractById(id) {
  const rows = await runQuery(`select * from ${tables.contracts} where id = ? and deleted_at is null limit 1`, [id])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByIdIncludingDeleted(id) {
  const rows = await runQuery(`select * from ${tables.contracts} where id = ? limit 1`, [id])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByIdOrShareToken(identifier) {
  const id = String(identifier || '').trim()
  if (!id) return null

  const byId = await getContractById(id)
  if (byId?.id) return byId

  return getContractByShareToken(id)
}

async function getContractByQuoteId(quoteId) {
  const rows = await runQuery(`select * from ${tables.contracts} where quote_id = ? and deleted_at is null limit 1`, [quoteId])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByJobId(jobId) {
  const rows = await runQuery(
    `select * from ${tables.contracts}
     where source_type = 'job' and external_job_id = ? and deleted_at is null
     limit 1`,
    [jobId],
  )
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByShareToken(shareToken) {
  const rows = await runQuery(
    `select * from ${tables.contracts} where share_token = ? and deleted_at is null limit 1`,
    [shareToken],
  )
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getDeletedContractBySource({ id, quoteId, sourceType, externalJobId } = {}) {
  if (id) return getContractByIdIncludingDeleted(id)
  if (quoteId) {
    const rows = await runQuery(
      `select * from ${tables.contracts} where quote_id = ? and deleted_at is not null limit 1`,
      [quoteId],
    )
    return rows?.[0] ? normalizeContractRow(rows[0]) : null
  }
  if (sourceType === 'job' && externalJobId) {
    const rows = await runQuery(
      `select * from ${tables.contracts}
       where source_type = 'job' and external_job_id = ? and deleted_at is not null
       limit 1`,
      [externalJobId],
    )
    return rows?.[0] ? normalizeContractRow(rows[0]) : null
  }
  return null
}

async function getPublicContractByToken(shareToken) {
  const directContract = await getContractByShareToken(shareToken)
  if (directContract?.id) return directContract

  const quote = await getQuoteByShareToken(shareToken)
  if (!quote?.id) return null
  return getContractByQuoteId(quote.id)
}

function cleanContractPayload(contract = {}) {
  const { email, phone, ...sellerSnapshot } = contract.seller_snapshot || {}
  const sourceType = normalizeSourceType(contract.source_type || (contract.quote_id ? 'quote' : 'manual'))
  const quoteTableConfig = {
    ...(contract.quote_table_config || {}),
    signing_date: contract.signing_date || contract.quote_table_config?.signing_date || '',
  }

  return {
    quote_id: emptyToNull(contract.quote_id),
    quote_number: contract.quote_number || null,
    source_type: sourceType,
    external_job_id: sourceType === 'job' ? emptyToNull(contract.external_job_id) : null,
    share_token: contract.share_token || makeShareToken(),
    contract_number: contract.contract_number,
    status: contract.status || 'draft',
    template_id: contract.template_id || null,
    title: contract.title || 'HOP DONG CUNG CAP DICH VU',
    seller_entity_code: contract.seller_entity_code || null,
    seller_snapshot: toJson(sellerSnapshot, {}),
    customer_snapshot: toJson(contract.customer_snapshot || {}, {}),
    party_role_config: toJson(contract.party_role_config || {}, {}),
    contract_number_pattern: contract.contract_number_pattern || 'HD-{{quote_code}}',
    preamble: toJson(Array.isArray(contract.preamble) ? contract.preamble : [], []),
    service_scope: contract.service_scope || '',
    schedule_rows: toJson(Array.isArray(contract.schedule_rows) ? contract.schedule_rows : [], []),
    quote_table_config: toJson(quoteTableConfig, {}),
    payment_config: toJson(contract.payment_config || {}, {}),
    content_sections: toJson(Array.isArray(contract.content_sections) ? contract.content_sections : [], []),
    terms_text: contract.terms_text || '',
    quote_snapshot: toJson(contract.quote_snapshot || {}, {}),
    source_snapshot: toJson(contract.source_snapshot || {}, {}),
    deleted_at: null,
  }
}

async function saveContract(contract = {}) {
  const payload = cleanContractPayload(contract)

  if (!payload.contract_number || !payload.terms_text) {
    const error = new Error('Thieu so hop dong hoac noi dung hop dong.')
    error.statusCode = 400
    throw error
  }

  if (payload.source_type === 'quote' && !payload.quote_id) {
    const error = new Error('Thieu quote id.')
    error.statusCode = 400
    throw error
  }

  if (payload.source_type === 'job' && !payload.external_job_id) {
    const error = new Error('Thieu job id.')
    error.statusCode = 400
    throw error
  }

  let existing = null
  if (contract.id) existing = await getContractByIdIncludingDeleted(contract.id)
  if (!existing && payload.quote_id) existing = await getContractByQuoteId(payload.quote_id)
  if (!existing && payload.source_type === 'job') existing = await getContractByJobId(payload.external_job_id)
  if (!existing) {
    existing = await getDeletedContractBySource({
      quoteId: payload.quote_id,
      sourceType: payload.source_type,
      externalJobId: payload.external_job_id,
    })
  }

  if (!existing && payload.quote_id) await getQuoteById(payload.quote_id)

  if (existing?.id && contract.id && existing.id !== contract.id) {
    const error = new Error('Hop dong da ton tai voi nguon nay.')
    error.statusCode = 409
    error.code = 'CONTRACT_EXISTS'
    throw error
  }

  if (existing?.id) {
    await runTransaction(async connection => {
      await updateDataRow(connection, tables.contracts, payload, 'id = ?', [existing.id])
    })
    const saved = await getContractById(existing.id)
    await runTransaction(async connection => {
      await syncOpenContractDocuments(connection, saved)
    })
    return saved
  }

  const id = contract.id || makeShortId('ct')
  await runTransaction(async connection => {
    await insertDataRow(connection, tables.contracts, { id, ...payload })
  })
  return getContractById(id)
}

export const __contractsTestInternals = Object.freeze({
  deleteContract,
  deleteDocument,
  getDocumentById,
  getDocumentByShareToken,
  listContracts,
  listDocumentsByContract,
  saveContract,
  saveDocument,
})

export default async function handler(req, res) {
  try {
    if (!isPublicContractRequest(req) && !await contractsApiDeps.requireEventusAuth(req, res)) return

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'templates')
      if (resource === 'templates') {
        return res.status(200).json({ templates: await listTemplates() })
      }

      if (resource === 'document_templates') {
        return res.status(200).json({ templates: await listDocumentTemplates(req.query || {}) })
      }

      if (resource === 'document_template') {
        const id = getQueryValue(req.query?.id, '')
        if (!id) return res.status(400).json({ error: 'Thieu template id.' })
        return res.status(200).json({ template: await getDocumentTemplateById(id) })
      }

      if (resource === 'contracts') {
        return res.status(200).json(await listContracts(req.query || {}))
      }

      if (resource === 'contract') {
        const id = getQueryValue(req.query?.id, '')
        const quoteId = getQueryValue(req.query?.quote_id, '')
        const jobId = getQueryValue(req.query?.job_id || req.query?.external_job_id, '')
        if (id) return res.status(200).json({ contract: await getContractByIdOrShareToken(id) })
        if (quoteId) return res.status(200).json({ contract: await getContractByQuoteId(quoteId) })
        if (jobId) return res.status(200).json({ contract: await getContractByJobId(jobId) })
        return res.status(400).json({ error: 'Thieu contract id, quote id hoac job id.' })
      }

      if (resource === 'jobs') {
        return res.status(200).json(await listContractJobs(req.query || {}))
      }

      if (resource === 'job') {
        const jobId = getQueryValue(req.query?.id || req.query?.job_id, '')
        if (!jobId) return res.status(400).json({ error: 'Thieu job id.' })
        return res.status(200).json({ job: await getContractJobById(jobId) })
      }

      if (resource === 'public_contract') {
        const token = getQueryValue(req.query?.token || req.query?.share_token, '')
        if (!token) return res.status(400).json({ error: 'Thieu share token.' })
        return res.status(200).json({ contract: await getPublicContractByToken(token) })
      }

      if (resource === 'documents' || resource === 'contract_documents') {
        return res.status(200).json({ documents: await listDocumentsByContract(req.query || {}) })
      }

      if (resource === 'document' || resource === 'contract_document') {
        const id = getQueryValue(req.query?.id, '')
        if (!id) return res.status(400).json({ error: 'Thieu document id.' })
        return res.status(200).json({ document: await getDocumentById(id) })
      }

      if (resource === 'public_document') {
        const token = getQueryValue(req.query?.token || req.query?.share_token, '')
        if (!token) return res.status(400).json({ error: 'Thieu share token.' })
        return res.status(200).json({ document: await getDocumentByShareToken(token) })
      }

      if (resource === 'customers') {
        const search = getQueryValue(req.query?.search, '')
        return res.status(200).json({ customers: await listCustomers(search) })
      }

      if (resource === 'customer') {
        const customerCode = getQueryValue(req.query?.customer_code, '')
        if (!customerCode) return res.status(400).json({ error: 'Thieu ma khach hang.' })
        return res.status(200).json({ customer: await getCustomerByCode(customerCode) })
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      if (body.resource === 'template') {
        return res.status(200).json({ template: await saveTemplate(body.template || {}) })
      }

      if (body.resource === 'document_template') {
        return res.status(200).json({ template: await saveDocumentTemplate(body.template || {}) })
      }

      if (body.resource === 'contract') {
        return res.status(200).json({ contract: await saveContract(body.contract || {}) })
      }

      if (body.resource === 'document' || body.resource === 'contract_document') {
        return res.status(200).json({ document: await saveDocument(body.document || {}) })
      }

      if (body.resource === 'customer') {
        return res.status(201).json({ customer: await createCustomer(body.customer || {}) })
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    if (req.method === 'DELETE') {
      const resource = getQueryValue(req.query?.resource, '')
      const id = getQueryValue(req.query?.id, '')
      if (resource === 'template') {
        if (!id) return res.status(400).json({ error: 'Thieu template id.' })
        return res.status(200).json(await deleteTemplate(id))
      }

      if (resource === 'document_template') {
        if (!id) return res.status(400).json({ error: 'Thieu template id.' })
        return res.status(200).json(await deleteDocumentTemplate(id))
      }

      if (resource === 'contract') {
        const quoteId = getQueryValue(req.query?.quote_id, '')
        return res.status(200).json(await deleteContract({ id, quoteId }))
      }

      if (resource === 'document' || resource === 'contract_document') {
        if (!id) return res.status(400).json({ error: 'Thieu document id.' })
        return res.status(200).json(await deleteDocument(id))
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
