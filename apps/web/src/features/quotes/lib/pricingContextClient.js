import servicesData from '../../../data/pricing/services.json'
import travelFeesData from '../../../data/pricing/travel_fees.json'
import customerTiersData from '../../../data/pricing/customer_tiers.json'
import businessRulesData from '../../../data/pricing/business_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import { redirectToLoginIfAuthRequired } from './authRedirect'

let pricingContextCache = null
let pricingContextRequest = null
let lastFallbackWarning = ''

function getRuleCode(row) {
  return row?.rule_code || row?.code || row?.key
}

function getRuleValue(row) {
  return row?.rule_value ?? row?.value ?? row?.config_value ?? null
}

export function buildBusinessRulesMap(rows = []) {
  return rows.reduce((acc, row) => {
    const code = getRuleCode(row)
    if (code) acc[code] = getRuleValue(row)
    return acc
  }, {})
}

function activeSortedRows(rows = []) {
  return [...(Array.isArray(rows) ? rows : [])]
    .filter(row => row?.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
}

function normalizePricingPayload(payload = {}, fallbackMeta = {}) {
  const pricing = payload.pricing || {}
  const businessRules = activeSortedRows(pricing.business_rules)
  const businessRulesMap = payload.business_rules_map || buildBusinessRulesMap(businessRules)
  const meta = {
    source: 'mysql',
    warnings: [],
    ...fallbackMeta,
    ...(payload.meta || {}),
  }

  return {
    services: activeSortedRows(pricing.services),
    travel_fees: activeSortedRows(pricing.travel_fees),
    travelFees: activeSortedRows(pricing.travel_fees),
    customer_tiers: activeSortedRows(pricing.customer_tiers),
    customerTiers: activeSortedRows(pricing.customer_tiers),
    business_rules: businessRules,
    businessRulesRows: businessRules,
    businessRules: businessRulesMap,
    legal_entities: activeSortedRows(pricing.legal_entities),
    legalEntities: activeSortedRows(pricing.legal_entities),
    equipment_rules: activeSortedRows(pricing.equipment_rules),
    equipmentRules: activeSortedRows(pricing.equipment_rules),
    meta,
  }
}

function buildJsonFallbackPricingContext(reason) {
  return normalizePricingPayload({
    pricing: {
      services: servicesData,
      travel_fees: travelFeesData,
      customer_tiers: customerTiersData,
      business_rules: businessRulesData,
      legal_entities: legalEntitiesData,
      equipment_rules: equipmentRulesData,
    },
    meta: {
      source: 'json_fallback',
      loaded_at: new Date().toISOString(),
      warnings: [
        `Đang dùng fallback JSON cho pricing trên trình duyệt: ${reason}`,
        'Hãy kiểm tra /api/pricing hoặc dữ liệu MySQL pricing trước khi tạo báo giá chính thức.',
      ],
    },
  })
}

function warnPricingFallback(meta = {}) {
  if (meta.source === 'mysql') return
  const warning = (meta.warnings || []).join(' ')
  if (!warning || warning === lastFallbackWarning) return
  lastFallbackWarning = warning
  console.warn(`[Eventus pricing] ${warning}`)
}

export function getPricingWarning(meta = {}) {
  if (!meta || meta.source === 'mysql') return ''
  return (meta.warnings || []).join(' ')
}

export async function fetchPricingContext({ force = false } = {}) {
  if (pricingContextCache && !force) return pricingContextCache
  if (pricingContextRequest && !force) return pricingContextRequest

  pricingContextRequest = (async () => {
    try {
      const response = await fetch(`/api/pricing${force ? '?force=1' : ''}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        redirectToLoginIfAuthRequired(response, payload)
        throw new Error(payload?.error || `Pricing API HTTP ${response.status}`)
      }

      const context = normalizePricingPayload(payload)
      warnPricingFallback(context.meta)
      pricingContextCache = context
      return context
    } catch (error) {
      const context = buildJsonFallbackPricingContext(error?.message || 'API lỗi.')
      warnPricingFallback(context.meta)
      pricingContextCache = context
      return context
    } finally {
      pricingContextRequest = null
    }
  })()

  return pricingContextRequest
}

export function clearPricingContextCache() {
  pricingContextCache = null
  pricingContextRequest = null
}

export function getCachedPricingContext() {
  return pricingContextCache
}
