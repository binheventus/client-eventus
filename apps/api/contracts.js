import { randomUUID } from 'node:crypto'
import {
  emptyToNull,
  fromJson,
  insertRow,
  normalizeBoolean,
  query,
  tables,
  toJson,
  updateRow,
  withTransaction,
} from './lib/mysql.js'
import { requireEventusAuth } from './lib/eventus-auth.js'

const PROTECTED_CONTRACT_TEMPLATE_IDS = new Set(['system-mediamonster-service-contract'])
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
  return getQueryValue(req.query?.resource, 'templates') === 'public_contract'
}

function makeId(prefix = '') {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID()
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

function normalizeTemplateRow(row = {}) {
  if (!row) return row
  const normalized = { ...row }
  JSON_TEMPLATE_COLUMNS.forEach(column => {
    const fallback = ['preamble', 'schedule_rows', 'content_sections'].includes(column) ? [] : {}
    normalized[column] = fromJson(normalized[column], fallback)
  })
  normalized.is_default = normalizeBoolean(normalized.is_default)
  normalized.is_active = normalizeBoolean(normalized.is_active)
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
    event_name: job.job_title || '',
    event_date: job.job_date || '',
    location: job.location || '',
    duration_hours: '',
    validity_days: '',
    has_vat: job.has_vat !== false,
    terms_text: '',
    subtotal: total,
    travel_fee_total: 0,
    overtime_fee_total: 0,
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

async function getQuoteById(id) {
  const rows = await query(`select * from ${tables.quotes} where id = ? limit 1`, [id])
  const quote = rows?.[0]
  if (!quote) {
    const error = new Error('Khong tim thay bao gia.')
    error.statusCode = 404
    throw error
  }
  return quote
}

async function getQuoteByShareToken(shareToken) {
  const rows = await query(
    `select id, deleted_at from ${tables.quotes} where share_token = ? limit 1`,
    [shareToken],
  )
  const quote = rows?.[0]
  if (!quote || quote.deleted_at) return null
  return quote
}

async function listTemplates() {
  const rows = await query(
    `select * from ${tables.contractTemplates}
     order by sort_order asc, created_at desc`,
  )
  return rows.map(normalizeTemplateRow)
}

async function listContracts(queryParams = {}) {
  const page = getPositiveInteger(queryParams.page, 1)
  const pageSize = getPositiveInteger(queryParams.pageSize, 20)
  const offset = (page - 1) * pageSize
  const sourceType = getQueryValue(queryParams.source_type, '')
  const search = String(getQueryValue(queryParams.search, '') || '').trim()
  const where = []
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
      or json_unquote(json_extract(c.quote_snapshot, '$.event_name')) like ?
      or json_unquote(json_extract(c.source_snapshot, '$.job_title')) like ?
    )`)
    params.push(...Array(5).fill(`%${search}%`))
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : ''
  const countRows = await query(`select count(*) as count from ${tables.contracts} c ${whereSql}`, params)
  const rows = await query(
    `select c.*
     from ${tables.contracts} c
     ${whereSql}
     order by c.updated_at desc, c.created_at desc
     limit ${pageSize} offset ${offset}`,
    params,
  )

  return {
    contracts: rows.map(normalizeContractRow),
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
  const countRows = await query(`select count(*) as count from ${tables.jobs} j left join ${tables.customers} customers on customers.id = j.customer_id ${whereSql}`, params)
  const rows = await query(
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
     left join ${tables.contracts} c on c.source_type = 'job' and c.external_job_id = j.id
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
  const rows = await query(
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
     left join ${tables.contracts} c on c.source_type = 'job' and c.external_job_id = j.id
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
    seller_entity_code: emptyToNull(template.seller_entity_code || template.entity_code),
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

  const rows = await query(
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

  const rows = await query(
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

  await withTransaction(async connection => {
    await insertRow(connection, tables.customers, payload)
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

  await withTransaction(async connection => {
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

  const rows = await query(`select * from ${tables.contractTemplates} where id = ? limit 1`, [payload.id])
  return normalizeTemplateRow(rows?.[0])
}

async function deleteTemplate(id) {
  await query(`delete from ${tables.contractTemplates} where id = ?`, [id])
  return { ok: true }
}

async function deleteContract({ id, quoteId } = {}) {
  if (!id && !quoteId) {
    const error = new Error('Thieu contract id hoac quote id.')
    error.statusCode = 400
    throw error
  }

  if (id) await query(`delete from ${tables.contracts} where id = ?`, [id])
  else await query(`delete from ${tables.contracts} where quote_id = ?`, [quoteId])
  return { ok: true }
}

async function getContractById(id) {
  const rows = await query(`select * from ${tables.contracts} where id = ? limit 1`, [id])
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
  const rows = await query(`select * from ${tables.contracts} where quote_id = ? limit 1`, [quoteId])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByJobId(jobId) {
  const rows = await query(
    `select * from ${tables.contracts} where source_type = 'job' and external_job_id = ? limit 1`,
    [jobId],
  )
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getContractByShareToken(shareToken) {
  const rows = await query(`select * from ${tables.contracts} where share_token = ? limit 1`, [shareToken])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
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
  if (contract.id) existing = await getContractById(contract.id)
  if (!existing && payload.quote_id) existing = await getContractByQuoteId(payload.quote_id)
  if (!existing && payload.source_type === 'job') existing = await getContractByJobId(payload.external_job_id)

  if (!existing && payload.quote_id) {
    const quote = await getQuoteById(payload.quote_id)
    if (String(quote.status || 'draft').toLowerCase() === 'draft') {
      const error = new Error('Chi bao gia da luu hoan thien moi duoc tao hop dong.')
      error.statusCode = 400
      throw error
    }
  }

  if (existing?.id && contract.id && existing.id !== contract.id) {
    const error = new Error('Hop dong da ton tai voi nguon nay.')
    error.statusCode = 409
    error.code = 'CONTRACT_EXISTS'
    throw error
  }

  if (existing?.id) {
    await withTransaction(async connection => {
      await updateRow(connection, tables.contracts, payload, 'id = ?', [existing.id])
    })
    return getContractById(existing.id)
  }

  const id = contract.id || makeId('contract')
  await withTransaction(async connection => {
    await insertRow(connection, tables.contracts, { id, ...payload })
  })
  return getContractById(id)
}

export default async function handler(req, res) {
  try {
    if (!isPublicContractRequest(req) && !await requireEventusAuth(req, res)) return

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'templates')
      if (resource === 'templates') {
        return res.status(200).json({ templates: await listTemplates() })
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

      if (body.resource === 'contract') {
        return res.status(200).json({ contract: await saveContract(body.contract || {}) })
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

      if (resource === 'contract') {
        const quoteId = getQueryValue(req.query?.quote_id, '')
        return res.status(200).json(await deleteContract({ id, quoteId }))
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
