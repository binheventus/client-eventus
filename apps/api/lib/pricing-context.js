import { createRequire } from 'node:module'
import { query } from './mysql.js'

const require = createRequire(import.meta.url)

const jsonFallbackData = {
  services: require('../../web/src/data/pricing/services.json'),
  travel_fees: require('../../web/src/data/pricing/travel_fees.json'),
  customer_tiers: require('../../web/src/data/pricing/customer_tiers.json'),
  business_rules: require('../../web/src/data/pricing/business_rules.json'),
  legal_entities: require('../../web/src/data/pricing/legal_entities.json'),
  equipment_rules: require('../../web/src/data/pricing/equipment_rules.json'),
}

const CACHE_TTL_MS = Number(process.env.PRICING_CONTEXT_CACHE_TTL_MS || 5 * 60 * 1000)

const DATASETS = {
  services: {
    tableName: 'pricing_services',
    columns: [
      'id',
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
      'sort_order',
      'source_json',
    ],
    orderBy: '`sort_order` asc, `service_code` asc',
  },
  travel_fees: {
    tableName: 'pricing_travel_fees',
    columns: [
      'id',
      'source_key',
      'location',
      'fee_per_person_per_day',
      'condition',
      'includes_accommodation',
      'includes_transport',
      'note',
      'sort_order',
      'source_json',
    ],
    orderBy: '`sort_order` asc, `location` asc',
  },
  customer_tiers: {
    tableName: 'pricing_customer_tiers',
    columns: [
      'id',
      'tier_code',
      'tier_name',
      'description',
      'price_column_used',
      'payment_terms',
      'default_discount',
      'special_note',
      'sort_order',
      'source_json',
    ],
    orderBy: '`sort_order` asc, `tier_code` asc',
  },
  business_rules: {
    tableName: 'pricing_business_rules',
    columns: [
      'id',
      'rule_code',
      'category',
      'rule_name',
      'value',
      'rule_value',
      'description',
      'derived',
      'sort_order',
      'source_json',
    ],
    orderBy: '`category` asc, `sort_order` asc, `rule_code` asc',
  },
  legal_entities: {
    tableName: 'pricing_legal_entities',
    columns: [
      'id',
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
      'sort_order',
      'source_json',
    ],
    orderBy: '`sort_order` asc, `entity_code` asc',
  },
  equipment_rules: {
    tableName: 'pricing_equipment_rules',
    columns: [
      'id',
      'match_prefixes',
      'equipment_title',
      'equipment_description',
      'internal_note',
      'match_prefix_list',
      'sort_order',
      'source_json',
    ],
    orderBy: '`sort_order` asc, `match_prefixes` asc',
  },
}

const REQUIRED_DATASETS = Object.keys(DATASETS)
const NUMBER_FIELDS = new Set([
  'id',
  'price_tier_1',
  'price_tier_2',
  'price_tier_3',
  'price_tier_4',
  'price_tier_5',
  'price_tier_6',
  'fee_per_person_per_day',
  'default_discount',
  'sort_order',
])
const BOOLEAN_FIELDS = new Set([
  'is_default',
  'derived',
  'includes_accommodation',
  'includes_transport',
])
const JSON_FIELDS = new Set(['source_json', 'match_prefix_list'])

let pricingContextCache = null
let pricingContextCacheAt = 0
let lastFallbackWarning = ''
let aiParseExamplesCache = null
let aiParseExamplesCacheAt = 0

function parseJson(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return value
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return true
  if (value === false || value === 0) return false
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return false
  return ['1', 'true', 'yes', 'co', 'có'].includes(text)
}

function normalizePricingRow(row = {}) {
  return Object.entries(row || {}).reduce((acc, [key, value]) => {
    if (NUMBER_FIELDS.has(key)) {
      acc[key] = normalizeNumber(value)
    } else if (BOOLEAN_FIELDS.has(key)) {
      acc[key] = normalizeBoolean(value)
    } else if (JSON_FIELDS.has(key)) {
      acc[key] = parseJson(value, key === 'match_prefix_list' ? [] : null)
    } else {
      acc[key] = value
    }
    return acc
  }, {})
}

function getPricingRows(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])]
    .map(normalizePricingRow)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

function getRuleCode(row = {}) {
  return row?.rule_code || row?.code || row?.key
}

function getRuleValue(row = {}) {
  return row?.rule_value ?? row?.value ?? row?.config_value ?? null
}

export function getBusinessRulesMap(rows = []) {
  return (rows || []).reduce((acc, row) => {
    const code = getRuleCode(row)
    if (code) acc[code] = getRuleValue(row)
    return acc
  }, {})
}

function buildContext(rowsByResource, meta) {
  const rows = Object.fromEntries(Object.keys(DATASETS).map(resource => [
    resource,
    getPricingRows(rowsByResource[resource]),
  ]))
  const businessRules = getBusinessRulesMap(rows.business_rules)

  return {
    services: rows.services,
    travel_fees: rows.travel_fees,
    travelFees: rows.travel_fees,
    customer_tiers: rows.customer_tiers,
    customerTiers: rows.customer_tiers,
    business_rules: rows.business_rules,
    businessRulesRows: rows.business_rules,
    businessRules,
    legal_entities: rows.legal_entities,
    legalEntities: rows.legal_entities,
    equipment_rules: rows.equipment_rules,
    equipmentRules: rows.equipment_rules,
    meta,
  }
}

function getEmptyDatasets(rowsByResource = {}) {
  return REQUIRED_DATASETS.filter(resource => !Array.isArray(rowsByResource[resource]) || rowsByResource[resource].length === 0)
}

function warnFallback(meta = {}) {
  const warning = (meta.warnings || []).join(' ')
  if (!warning || warning === lastFallbackWarning) return
  lastFallbackWarning = warning
  console.warn(`[Eventus pricing] ${warning}`)
}

function buildJsonFallbackContext(reason) {
  const warnings = [
    `Đang dùng fallback JSON cho pricing runtime: ${reason}`,
    'Hãy kiểm tra dữ liệu MySQL pricing/admin trước khi tạo báo giá chính thức.',
  ]
  const context = buildContext(jsonFallbackData, {
    source: 'json_fallback',
    loaded_at: new Date().toISOString(),
    warnings,
  })
  warnFallback(context.meta)
  return context
}

async function loadMysqlPricingRows() {
  const entries = await Promise.all(Object.entries(DATASETS).map(async ([resource, config]) => {
    const columns = config.columns.map(column => `\`${column}\``).join(', ')
    const rows = await query(
      `select ${columns} from \`${config.tableName}\` order by ${config.orderBy}`,
    )
    return [resource, rows || []]
  }))
  return Object.fromEntries(entries)
}

async function buildRuntimeContext() {
  try {
    const rowsByResource = await loadMysqlPricingRows()
    const emptyDatasets = getEmptyDatasets(rowsByResource)
    if (emptyDatasets.length) {
      return buildJsonFallbackContext(`MySQL thiếu dữ liệu ở dataset: ${emptyDatasets.join(', ')}.`)
    }

    return buildContext(rowsByResource, {
      source: 'mysql',
      loaded_at: new Date().toISOString(),
      warnings: [],
    })
  } catch (error) {
    return buildJsonFallbackContext(`không đọc được MySQL (${error?.message || 'unknown error'}).`)
  }
}

function withCacheMeta(context, cacheState) {
  return {
    ...context,
    meta: {
      ...context.meta,
      cache: cacheState,
      cache_ttl_ms: CACHE_TTL_MS,
    },
  }
}

export function invalidatePricingContextCache(reason = 'manual') {
  pricingContextCache = null
  pricingContextCacheAt = 0
  aiParseExamplesCache = null
  aiParseExamplesCacheAt = 0
  return {
    ok: true,
    reason,
    invalidated_at: new Date().toISOString(),
  }
}

export async function getActiveAiParseExamples({ force = false } = {}) {
  const now = Date.now()
  const cacheFresh = aiParseExamplesCache && (CACHE_TTL_MS <= 0 || now - aiParseExamplesCacheAt < CACHE_TTL_MS)
  if (!force && cacheFresh) return aiParseExamplesCache

  try {
    const rows = await query(
      'select `id`, `name`, `input_text`, `expected_output`, `notes`, `is_active`, `sort_order`'
      + ' from `pricing_ai_parse_examples`'
      + ' where `is_active` = 1'
      + ' order by `sort_order` asc, `id` asc',
    )
    const normalized = (Array.isArray(rows) ? rows : []).map(row => {
      let expectedOutput = row?.expected_output
      if (typeof expectedOutput === 'string') {
        try {
          expectedOutput = JSON.parse(expectedOutput)
        } catch {
          expectedOutput = null
        }
      }
      return {
        id: row?.id,
        name: row?.name,
        input_text: row?.input_text,
        expected_output: expectedOutput,
        notes: row?.notes,
        sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 100,
      }
    }).filter(example => example.input_text && example.expected_output)

    aiParseExamplesCache = normalized
    aiParseExamplesCacheAt = now
    return normalized
  } catch (error) {
    console.warn(`[Eventus pricing] Không đọc được pricing_ai_parse_examples: ${error?.message || error}`)
    aiParseExamplesCache = []
    aiParseExamplesCacheAt = now
    return []
  }
}

export async function getPricingContext({ force = false } = {}) {
  const now = Date.now()
  const cacheFresh = pricingContextCache && (CACHE_TTL_MS <= 0 || now - pricingContextCacheAt < CACHE_TTL_MS)
  if (!force && cacheFresh) return withCacheMeta(pricingContextCache, 'hit')

  pricingContextCache = await buildRuntimeContext()
  pricingContextCacheAt = now
  return withCacheMeta(pricingContextCache, 'miss')
}

export function getJsonFallbackQuotePricingContext() {
  const context = buildContext(jsonFallbackData, {
    source: 'json_fallback',
    loaded_at: new Date().toISOString(),
    warnings: ['Đang dùng fallback JSON cho pricing runtime trong test/helper sync.'],
  })
  return {
    services: context.services,
    travelFees: context.travelFees,
    businessRules: context.businessRules,
  }
}

export function toPricingApiPayload(context = {}) {
  return {
    pricing: {
      services: context.services || [],
      travel_fees: context.travel_fees || context.travelFees || [],
      customer_tiers: context.customer_tiers || context.customerTiers || [],
      business_rules: context.business_rules || context.businessRulesRows || [],
      legal_entities: context.legal_entities || context.legalEntities || [],
      equipment_rules: context.equipment_rules || context.equipmentRules || [],
    },
    business_rules_map: context.businessRules || getBusinessRulesMap(context.business_rules || context.businessRulesRows || []),
    meta: context.meta || {},
  }
}

export const __pricingContextTestInternals = Object.freeze({
  buildContext,
  buildJsonFallbackContext,
  getPricingRows,
})
