import fs from 'node:fs/promises'
import path from 'node:path'
import { getPool } from '../apps/api/lib/mysql.js'

const rootDir = process.cwd()
const pricingDir = path.join(rootDir, 'apps/web/src/data/pricing')
const refreshExisting = process.argv.includes('--refresh')

function hasValue(value) {
  return value !== undefined && value !== null && value !== ''
}

function toNumber(value, fallback = null) {
  if (!hasValue(value)) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'co', 'có'].includes(String(value).trim().toLowerCase())
}

function nullableText(value) {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

function sourceJson(row = {}) {
  return JSON.stringify(row)
}

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

function makeTravelFeeSourceKey(row = {}) {
  return [
    String(row.location || '').trim().toLowerCase(),
    String(row.condition || '').trim().toLowerCase(),
  ].join('::')
}

function getPrefixList(row = {}) {
  if (Array.isArray(row.match_prefix_list)) return row.match_prefix_list.map(normalizeCode).filter(Boolean)
  return String(row.match_prefixes || '')
    .split(/[,\n;]/)
    .map(normalizeCode)
    .filter(Boolean)
}

const DATASETS = [
  {
    name: 'services',
    fileName: 'services.json',
    tableName: 'pricing_services',
    keyColumn: 'service_code',
    columns: [
      'service_code',
      'equipment_group',
      'service_name',
      'quote_display_name',
      'duration_tier',
      'unit',
      'price_tier_1',
      'price_tier_2',
      'price_tier_3',
      'price_tier_4',
      'price_tier_5',
      'price_tier_6',
      'description',
      'internal_note',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      service_code: normalizeCode(row.service_code),
      equipment_group: nullableText(row.equipment_group),
      service_name: nullableText(row.service_name),
      quote_display_name: nullableText(row.quote_display_name),
      duration_tier: nullableText(row.duration_tier),
      unit: nullableText(row.unit),
      price_tier_1: toNumber(row.price_tier_1),
      price_tier_2: toNumber(row.price_tier_2),
      price_tier_3: toNumber(row.price_tier_3),
      price_tier_4: toNumber(row.price_tier_4),
      price_tier_5: toNumber(row.price_tier_5),
      price_tier_6: toNumber(row.price_tier_6),
      description: nullableText(row.description),
      internal_note: nullableText(row.internal_note),
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
  {
    name: 'travel_fees',
    fileName: 'travel_fees.json',
    tableName: 'pricing_travel_fees',
    keyColumn: 'source_key',
    columns: [
      'source_key',
      'location',
      'fee_per_person_per_day',
      'condition',
      'includes_accommodation',
      'includes_transport',
      'note',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      source_key: makeTravelFeeSourceKey(row),
      location: nullableText(row.location),
      fee_per_person_per_day: toNumber(row.fee_per_person_per_day, 0),
      condition: nullableText(row.condition),
      includes_accommodation: toBoolean(row.includes_accommodation) ? 1 : 0,
      includes_transport: toBoolean(row.includes_transport) ? 1 : 0,
      note: nullableText(row.note),
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
  {
    name: 'customer_tiers',
    fileName: 'customer_tiers.json',
    tableName: 'pricing_customer_tiers',
    keyColumn: 'tier_code',
    columns: [
      'tier_code',
      'tier_name',
      'description',
      'price_column_used',
      'payment_terms',
      'default_discount',
      'special_note',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      tier_code: normalizeCode(row.tier_code),
      tier_name: nullableText(row.tier_name),
      description: nullableText(row.description),
      price_column_used: nullableText(row.price_column_used),
      payment_terms: nullableText(row.payment_terms),
      default_discount: toNumber(row.default_discount, 0),
      special_note: nullableText(row.special_note),
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
  {
    name: 'business_rules',
    fileName: 'business_rules.json',
    tableName: 'pricing_business_rules',
    keyColumn: 'rule_code',
    columns: [
      'rule_code',
      'category',
      'rule_name',
      'value',
      'rule_value',
      'description',
      'derived',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      rule_code: normalizeCode(row.rule_code),
      category: nullableText(row.category),
      rule_name: nullableText(row.rule_name),
      value: nullableText(row.value),
      rule_value: nullableText(row.rule_value ?? row.value),
      description: nullableText(row.description),
      derived: toBoolean(row.derived) ? 1 : 0,
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
  {
    name: 'legal_entities',
    fileName: 'legal_entities.json',
    tableName: 'pricing_legal_entities',
    keyColumn: 'entity_code',
    columns: [
      'entity_code',
      'entity_name_full',
      'tax_code',
      'address',
      'representative',
      'position',
      'email',
      'hotline',
      'website',
      'bank_account',
      'bank_name',
      'logo_file',
      'is_default',
      'display_name',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      entity_code: normalizeCode(row.entity_code),
      entity_name_full: nullableText(row.entity_name_full),
      tax_code: nullableText(row.tax_code),
      address: nullableText(row.address),
      representative: nullableText(row.representative),
      position: nullableText(row.position),
      email: nullableText(row.email),
      hotline: nullableText(row.hotline),
      website: nullableText(row.website),
      bank_account: nullableText(row.bank_account),
      bank_name: nullableText(row.bank_name),
      logo_file: nullableText(row.logo_file),
      is_default: toBoolean(row.is_default) ? 1 : 0,
      display_name: nullableText(row.display_name),
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
  {
    name: 'equipment_rules',
    fileName: 'equipment_rules.json',
    tableName: 'pricing_equipment_rules',
    keyColumn: 'match_prefixes',
    columns: [
      'match_prefixes',
      'equipment_title',
      'equipment_description',
      'internal_note',
      'match_prefix_list',
      'is_active',
      'sort_order',
      'source_json',
    ],
    normalize: (row, index) => ({
      match_prefixes: nullableText(row.match_prefixes),
      equipment_title: nullableText(row.equipment_title),
      equipment_description: nullableText(row.equipment_description),
      internal_note: nullableText(row.internal_note),
      match_prefix_list: JSON.stringify(getPrefixList(row)),
      is_active: toBoolean(row.is_active, true) ? 1 : 0,
      sort_order: toNumber(row.sort_order, index + 1),
      source_json: sourceJson(row),
    }),
  },
]

async function readJson(fileName) {
  const filePath = path.join(pricingDir, fileName)
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

async function seedDataset(pool, dataset) {
  const sourceRows = await readJson(dataset.fileName)
  if (!Array.isArray(sourceRows)) {
    throw new Error(`${dataset.fileName} must contain a JSON array.`)
  }

  let inserted = 0
  let refreshed = 0
  let skipped = 0

  for (let index = 0; index < sourceRows.length; index += 1) {
    const row = dataset.normalize(sourceRows[index], index)
    if (!row[dataset.keyColumn]) {
      skipped += 1
      continue
    }

    const columnSql = dataset.columns.map(column => `\`${column}\``).join(', ')
    const placeholders = dataset.columns.map(() => '?').join(', ')
    const values = dataset.columns.map(column => row[column] ?? null)

    if (refreshExisting) {
      const assignments = dataset.columns
        .filter(column => column !== dataset.keyColumn)
        .map(column => `\`${column}\` = values(\`${column}\`)`)
        .join(', ')
      const [result] = await pool.query(
        `insert into \`${dataset.tableName}\` (${columnSql})
         values (${placeholders})
         on duplicate key update ${assignments}`,
        values,
      )
      if (result.affectedRows === 1) inserted += 1
      else if (result.affectedRows === 2) refreshed += 1
      continue
    }

    const [result] = await pool.query(
      `insert ignore into \`${dataset.tableName}\` (${columnSql}) values (${placeholders})`,
      values,
    )
    if (result.affectedRows === 1) inserted += 1
    else skipped += 1
  }

  return {
    dataset: dataset.name,
    source_rows: sourceRows.length,
    inserted,
    refreshed,
    skipped,
  }
}

const pool = getPool()

try {
  const results = []
  for (const dataset of DATASETS) {
    results.push(await seedDataset(pool, dataset))
  }

  console.log(JSON.stringify({
    ok: true,
    pricing_dir: pricingDir,
    refresh_existing: refreshExisting,
    results,
  }, null, 2))
} finally {
  await pool.end()
}
