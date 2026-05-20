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

function makeId(prefix = '') {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID()
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
  return normalized
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
      await connection.execute(
        `update ${tables.contractTemplates} set is_default = 0 where is_default = 1 and id <> ?`,
        [payload.id],
      )
    }

    await connection.execute(
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

async function getContractByQuoteId(quoteId) {
  const rows = await query(`select * from ${tables.contracts} where quote_id = ? limit 1`, [quoteId])
  return rows?.[0] ? normalizeContractRow(rows[0]) : null
}

async function getPublicContractByToken(shareToken) {
  const quote = await getQuoteByShareToken(shareToken)
  if (!quote?.id) return null
  return getContractByQuoteId(quote.id)
}

function cleanContractPayload(contract = {}) {
  const { email, phone, ...sellerSnapshot } = contract.seller_snapshot || {}

  return {
    quote_id: contract.quote_id,
    quote_number: contract.quote_number || null,
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
    quote_table_config: toJson(contract.quote_table_config || {}, {}),
    payment_config: toJson(contract.payment_config || {}, {}),
    content_sections: toJson(Array.isArray(contract.content_sections) ? contract.content_sections : [], []),
    terms_text: contract.terms_text || '',
    quote_snapshot: toJson(contract.quote_snapshot || {}, {}),
  }
}

async function saveContract(contract = {}) {
  const payload = cleanContractPayload(contract)
  if (!payload.quote_id) {
    const error = new Error('Thieu quote id.')
    error.statusCode = 400
    throw error
  }

  if (!payload.contract_number || !payload.terms_text) {
    const error = new Error('Thieu so hop dong hoac noi dung hop dong.')
    error.statusCode = 400
    throw error
  }

  const existing = await getContractByQuoteId(payload.quote_id)
  if (!existing) {
    const quote = await getQuoteById(payload.quote_id)
    if (String(quote.status || 'draft').toLowerCase() === 'draft') {
      const error = new Error('Chi bao gia da luu hoan thien moi duoc tao hop dong.')
      error.statusCode = 400
      throw error
    }
  }

  if (existing?.id) {
    await withTransaction(async connection => {
      await updateRow(connection, tables.contracts, payload, 'id = ?', [existing.id])
    })
    return getContractByQuoteId(payload.quote_id)
  }

  const id = contract.id || makeId('contract')
  await withTransaction(async connection => {
    await insertRow(connection, tables.contracts, { id, ...payload })
  })
  return getContractByQuoteId(payload.quote_id)
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'templates')
      if (resource === 'templates') {
        return res.status(200).json({ templates: await listTemplates() })
      }

      if (resource === 'contract') {
        const quoteId = getQueryValue(req.query?.quote_id, '')
        if (!quoteId) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json({ contract: await getContractByQuoteId(quoteId) })
      }

      if (resource === 'public_contract') {
        const token = getQueryValue(req.query?.token || req.query?.share_token, '')
        if (!token) return res.status(400).json({ error: 'Thieu share token.' })
        return res.status(200).json({ contract: await getPublicContractByToken(token) })
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
