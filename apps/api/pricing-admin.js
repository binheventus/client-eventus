import { query } from './lib/mysql.js'
import { requireEventusAuth } from './lib/eventus-auth.js'
import { invalidatePricingContextCache } from './lib/pricing-context.js'

function makeHttpError(message, statusCode = 400, code = 'BAD_REQUEST') {
  const error = new Error(message)
  error.statusCode = statusCode
  error.code = code
  return error
}

function sendError(res, error, fallback = 'Không xử lý được dữ liệu bảng giá.') {
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

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeCode(value = '') {
  return normalizeText(value).toUpperCase()
}

function normalizeNullableText(value) {
  const text = normalizeText(value)
  return text || null
}

function normalizeNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (value === true || value === 1) return true
  return ['1', 'true', 'yes', 'co', 'có'].includes(String(value).trim().toLowerCase())
}

function parseJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function getPrefixListFromText(value = '') {
  return String(value || '')
    .split(/[,\n;]/)
    .map(normalizeCode)
    .filter(Boolean)
}

function makeTravelFeeSourceKey(record = {}) {
  return [
    normalizeText(record.location).toLowerCase(),
    normalizeText(record.condition).toLowerCase(),
  ].join('::')
}

const DATASETS = {
  services: {
    resource: 'services',
    label: 'Dịch vụ',
    tableName: 'pricing_services',
    keyColumn: 'service_code',
    searchColumns: ['service_code', 'service_name', 'quote_display_name', 'equipment_group', 'unit'],
    orderBy: '`sort_order` asc, `service_code` asc',
    fields: {
      service_code: { required: true, normalize: normalizeCode },
      equipment_group: { normalize: normalizeNullableText },
      service_name: { required: true, normalize: normalizeText },
      quote_display_name: { normalize: normalizeNullableText },
      duration_tier: { normalize: normalizeNullableText },
      unit: { normalize: normalizeNullableText },
      price_tier_1: { normalize: normalizeNumber },
      price_tier_2: { normalize: normalizeNumber },
      price_tier_3: { normalize: normalizeNumber },
      price_tier_4: { normalize: normalizeNumber },
      price_tier_5: { normalize: normalizeNumber },
      price_tier_6: { normalize: normalizeNumber },
      description: { normalize: normalizeNullableText },
      internal_note: { normalize: normalizeNullableText },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
  },
  travel_fees: {
    resource: 'travel_fees',
    label: 'Phí di chuyển',
    tableName: 'pricing_travel_fees',
    keyColumn: 'location',
    searchColumns: ['location', 'condition', 'note'],
    orderBy: '`sort_order` asc, `location` asc',
    fields: {
      source_key: { normalize: normalizeText },
      location: { required: true, normalize: normalizeText },
      fee_per_person_per_day: { normalize: value => normalizeNumber(value, 0) },
      condition: { normalize: normalizeNullableText },
      includes_accommodation: { normalize: value => normalizeBoolean(value) ? 1 : 0 },
      includes_transport: { normalize: value => normalizeBoolean(value) ? 1 : 0 },
      note: { normalize: normalizeNullableText },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
    beforeSave(record) {
      if (record.location === undefined && record.condition === undefined) return record
      return {
        ...record,
        source_key: makeTravelFeeSourceKey(record),
      }
    },
  },
  customer_tiers: {
    resource: 'customer_tiers',
    label: 'Nhóm khách',
    tableName: 'pricing_customer_tiers',
    keyColumn: 'tier_code',
    searchColumns: ['tier_code', 'tier_name', 'description', 'price_column_used', 'payment_terms', 'special_note'],
    orderBy: '`sort_order` asc, `tier_code` asc',
    fields: {
      tier_code: { required: true, normalize: normalizeCode },
      tier_name: { required: true, normalize: normalizeText },
      description: { normalize: normalizeNullableText },
      price_column_used: { normalize: normalizeNullableText },
      payment_terms: { normalize: normalizeNullableText },
      default_discount: { normalize: value => normalizeNumber(value, 0) },
      special_note: { normalize: normalizeNullableText },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
  },
  business_rules: {
    resource: 'business_rules',
    label: 'Quy tắc',
    tableName: 'pricing_business_rules',
    keyColumn: 'rule_code',
    searchColumns: ['rule_code', 'category', 'rule_name', 'value', 'rule_value', 'description'],
    orderBy: '`category` asc, `sort_order` asc, `rule_code` asc',
    fields: {
      rule_code: { required: true, normalize: normalizeCode },
      category: { normalize: normalizeNullableText },
      rule_name: { normalize: normalizeNullableText },
      value: { normalize: normalizeNullableText },
      rule_value: { normalize: normalizeNullableText },
      description: { normalize: normalizeNullableText },
      derived: { normalize: value => normalizeBoolean(value) ? 1 : 0 },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
  },
  legal_entities: {
    resource: 'legal_entities',
    label: 'Pháp nhân',
    tableName: 'pricing_legal_entities',
    keyColumn: 'entity_code',
    searchColumns: ['entity_code', 'entity_name_full', 'display_name', 'tax_code', 'address', 'bank_name'],
    orderBy: '`sort_order` asc, `entity_code` asc',
    fields: {
      entity_code: { required: true, normalize: normalizeCode },
      entity_name_full: { required: true, normalize: normalizeText },
      tax_code: { normalize: normalizeNullableText },
      address: { normalize: normalizeNullableText },
      representative: { normalize: normalizeNullableText },
      position: { normalize: normalizeNullableText },
      email: { normalize: normalizeNullableText },
      hotline: { normalize: normalizeNullableText },
      website: { normalize: normalizeNullableText },
      bank_account: { normalize: normalizeNullableText },
      bank_name: { normalize: normalizeNullableText },
      logo_file: { normalize: normalizeNullableText },
      is_default: { normalize: value => normalizeBoolean(value) ? 1 : 0 },
      display_name: { normalize: normalizeNullableText },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
  },
  equipment_rules: {
    resource: 'equipment_rules',
    label: 'Thiết bị',
    tableName: 'pricing_equipment_rules',
    keyColumn: 'match_prefixes',
    searchColumns: ['match_prefixes', 'equipment_title', 'equipment_description', 'internal_note'],
    orderBy: '`sort_order` asc, `match_prefixes` asc',
    fields: {
      match_prefixes: { required: true, normalize: value => getPrefixListFromText(value).join(', ') || normalizeText(value) },
      equipment_title: { required: true, normalize: normalizeText },
      equipment_description: { normalize: normalizeNullableText },
      internal_note: { normalize: normalizeNullableText },
      match_prefix_list: { normalize: value => JSON.stringify(Array.isArray(value) ? value.map(normalizeCode).filter(Boolean) : getPrefixListFromText(value)) },
      sort_order: { normalize: value => normalizeNumber(value, 100) },
    },
    beforeSave(record) {
      if (record.match_prefixes === undefined) return record
      return {
        ...record,
        match_prefix_list: JSON.stringify(getPrefixListFromText(record.match_prefixes)),
      }
    },
  },
}

function getDataset(resource) {
  const key = normalizeText(resource)
  const dataset = DATASETS[key]
  if (!dataset) throw makeHttpError('Dataset bảng giá không hợp lệ.', 400, 'INVALID_RESOURCE')
  return dataset
}

function getPublicDatasetMeta(dataset) {
  return {
    resource: dataset.resource,
    label: dataset.label,
    key_column: dataset.keyColumn,
    fields: Object.entries(dataset.fields).map(([name, config]) => ({
      name,
      required: Boolean(config.required),
    })),
  }
}

function publicRow(row = {}) {
  return {
    ...row,
    is_default: row.is_default === 1 || row.is_default === true,
    derived: row.derived === 1 || row.derived === true,
    includes_accommodation: row.includes_accommodation === 1 || row.includes_accommodation === true,
    includes_transport: row.includes_transport === 1 || row.includes_transport === true,
    match_prefix_list: parseJson(row.match_prefix_list, row.match_prefix_list),
    source_json: parseJson(row.source_json, null),
  }
}

function getSelectColumns(dataset) {
  return ['id', ...Object.keys(dataset.fields), 'source_json', 'created_at', 'updated_at']
    .map(column => `\`${column}\``)
    .join(', ')
}

function getSearchWhere(dataset, search) {
  const text = normalizeText(search)
  if (!text) return { sql: '', params: [] }

  const clauses = dataset.searchColumns.map(column => `cast(\`${column}\` as char) like ?`)
  return {
    sql: ` and (${clauses.join(' or ')})`,
    params: clauses.map(() => `%${text}%`),
  }
}

async function listDatasets() {
  const rows = []
  for (const dataset of Object.values(DATASETS)) {
    const countRows = await query(`select count(*) as count from \`${dataset.tableName}\``)
    rows.push({
      ...getPublicDatasetMeta(dataset),
      count: Number(countRows?.[0]?.count || 0),
    })
  }
  return rows
}

async function listRecords({ resource, search = '' } = {}) {
  const dataset = getDataset(resource)
  const where = ['1 = 1']
  const params = []

  const searchWhere = getSearchWhere(dataset, search)
  const sql = `select ${getSelectColumns(dataset)} from \`${dataset.tableName}\` where ${where.join(' and ')}${searchWhere.sql} order by ${dataset.orderBy}`
  const rows = await query(sql, [...params, ...searchWhere.params])
  return {
    dataset: getPublicDatasetMeta(dataset),
    records: rows.map(publicRow),
  }
}

async function getRecordById(dataset, id) {
  const rows = await query(`select ${getSelectColumns(dataset)} from \`${dataset.tableName}\` where id = ? limit 1`, [id])
  return rows?.[0] || null
}

function sanitizeRecord(dataset, input = {}, { partial = false } = {}) {
  const output = {}
  for (const [fieldName, fieldConfig] of Object.entries(dataset.fields)) {
    if (partial && input[fieldName] === undefined) continue
    output[fieldName] = fieldConfig.normalize ? fieldConfig.normalize(input[fieldName]) : input[fieldName]
  }
  return dataset.beforeSave ? dataset.beforeSave(output, input) : output
}

function validateRecord(dataset, record = {}) {
  for (const [fieldName, fieldConfig] of Object.entries(dataset.fields)) {
    if (!fieldConfig.required) continue
    if (record[fieldName] === undefined || record[fieldName] === null || String(record[fieldName]).trim() === '') {
      throw makeHttpError(`Thiếu trường bắt buộc: ${fieldName}.`, 400, 'VALIDATION_ERROR')
    }
  }
}

function makeSourceJson(record = {}) {
  const clean = { ...record }
  delete clean.id
  delete clean.source_json
  delete clean.created_at
  delete clean.updated_at
  return JSON.stringify(clean)
}

async function createRecord(resource, input = {}) {
  const dataset = getDataset(resource)
  const record = sanitizeRecord(dataset, input)
  validateRecord(dataset, record)
  record.source_json = makeSourceJson(record)

  const columns = [...Object.keys(dataset.fields), 'source_json']
  const columnSql = columns.map(column => `\`${column}\``).join(', ')
  const placeholders = columns.map(() => '?').join(', ')
  const values = columns.map(column => record[column] ?? null)

  try {
    const result = await query(
      `insert into \`${dataset.tableName}\` (${columnSql}) values (${placeholders})`,
      values,
    )
    const saved = await getRecordById(dataset, result.insertId)
    invalidatePricingContextCache(`pricing-admin:create:${resource}`)
    return publicRow(saved)
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw makeHttpError('Mã dữ liệu này đã tồn tại.', 409, 'DUPLICATE_RECORD')
    }
    throw error
  }
}

async function updateRecord(resource, id, input = {}) {
  const dataset = getDataset(resource)
  if (!id) throw makeHttpError('Thiếu id record cần cập nhật.', 400, 'MISSING_ID')

  const existing = await getRecordById(dataset, id)
  if (!existing) throw makeHttpError('Không tìm thấy record bảng giá.', 404, 'NOT_FOUND')

  const patch = sanitizeRecord(dataset, input, { partial: true })
  const merged = {
    ...existing,
    ...patch,
  }
  validateRecord(dataset, merged)

  const updateColumns = Object.keys(patch)
  if (!updateColumns.length) return publicRow(existing)
  const sourceJson = makeSourceJson(merged)
  const assignments = [...updateColumns, 'source_json'].map(column => `\`${column}\` = ?`).join(', ')
  const values = [...updateColumns.map(column => patch[column] ?? null), sourceJson, id]

  try {
    await query(
      `update \`${dataset.tableName}\` set ${assignments}, updated_at = current_timestamp(3) where id = ?`,
      values,
    )
    const saved = await getRecordById(dataset, id)
    invalidatePricingContextCache(`pricing-admin:update:${resource}`)
    return publicRow(saved)
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw makeHttpError('Mã dữ liệu này đã tồn tại.', 409, 'DUPLICATE_RECORD')
    }
    throw error
  }
}

async function deleteRecord(resource, id) {
  const dataset = getDataset(resource)
  if (!id) throw makeHttpError('Thiếu id record cần xóa.', 400, 'MISSING_ID')

  await query(`delete from \`${dataset.tableName}\` where id = ?`, [id])
  invalidatePricingContextCache(`pricing-admin:delete:${resource}`)
  return { ok: true }
}

export default async function handler(req, res) {
  try {
    const user = await requireEventusAuth(req, res)
    if (!user) return null

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, '')
      if (!resource) return res.status(200).json({ datasets: await listDatasets() })
      const result = await listRecords({
        resource,
        search: getQueryValue(req.query?.search, ''),
      })
      return res.status(200).json(result)
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      const record = await createRecord(body.resource, body.record || body.data || {})
      return res.status(201).json({ record })
    }

    if (req.method === 'PATCH') {
      const body = getRequestBody(req)
      const record = await updateRecord(body.resource, body.id || body.record?.id, body.patch || body.record || {})
      return res.status(200).json({ record })
    }

    if (req.method === 'DELETE') {
      const body = getRequestBody(req)
      const resource = body.resource || getQueryValue(req.query?.resource, '')
      const id = body.id || getQueryValue(req.query?.id, '')
      return res.status(200).json(await deleteRecord(resource, id))
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
