export const DEFAULT_HALF_DAY_THRESHOLD = 4.5
export const DEFAULT_FULL_DAY_THRESHOLD = 8
export const DEFAULT_OVERTIME_HOURLY_FEE = 500000
export const DEFAULT_VAT_RATE = 0.08

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

function toNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function normalizeServiceBase(serviceCode = '') {
  return normalizeText(serviceCode)
    .replace(/_(IN|OUT)_(HD|FD)$/, '')
    .replace(/_(IN|OUT)$/, '')
    .replace(/_(HD|FD)$/, '')
}

function isNoTravelLocation(location = '') {
  const normalized = normalizeText(location)
  if (!normalized) return true
  if (normalized.includes('NOI THANH')) return true
  if (normalized.includes('HA NOI') && (normalized.includes('NGOAI THANH') || normalized.includes('<30') || normalized.includes('30KM'))) return true
  return normalized === 'HA NOI' || normalized === 'HN'
}

function getDurationUnit(durationHours, rules = {}) {
  const halfDayThreshold = toNumber(rules.HALF_DAY_THRESHOLD, DEFAULT_HALF_DAY_THRESHOLD)
  return toNumber(durationHours) <= halfDayThreshold ? 'HD' : 'FD'
}

function getLocationUnit(location) {
  return isNoTravelLocation(location) ? 'IN' : 'OUT'
}

function getTierPriceColumn(customerTier) {
  const normalized = normalizeText(customerTier || 'TIER_2')
  const tierNumber = normalized.match(/\d+/)?.[0] || '2'
  return `price_tier_${tierNumber}`
}

function getServiceCode(row) {
  return normalizeText(row?.service_code || row?.code)
}

export function findServiceForQuoteItem(services = [], item = {}, location, durationHours, businessRules = {}) {
  const baseCode = normalizeServiceBase(item.service_code)
  const locationUnit = getLocationUnit(location)
  const durationUnit = getDurationUnit(durationHours, businessRules)
  const candidates = [
    `${baseCode}_${locationUnit}_${durationUnit}`,
    `${baseCode}_${locationUnit}`,
    `${baseCode}_${durationUnit}`,
    normalizeText(item.service_code),
    baseCode,
  ]

  return candidates.reduce((matched, candidate) => (
    matched || services.find(service => getServiceCode(service) === candidate)
  ), null)
}

function getRuleValue(businessRules, code, fallback) {
  if (!businessRules) return fallback
  if (!Array.isArray(businessRules)) return businessRules[code] ?? fallback

  const row = businessRules.find(rule => rule?.rule_code === code || rule?.code === code || rule?.key === code)
  return row?.rule_value ?? row?.value ?? row?.config_value ?? fallback
}

function getTravelFeeRow(travelFees = [], location) {
  const normalizedLocation = normalizeText(location)
  return (travelFees || []).find(row => {
    const rowText = normalizeText([
      row?.location,
      row?.location_name,
      row?.province,
      row?.city,
      row?.area,
    ].filter(Boolean).join(' '))
    return rowText && (rowText.includes(normalizedLocation) || normalizedLocation.includes(rowText))
  }) || null
}

export function calculateQuotePricing(input = {}) {
  const {
    items = [],
    services = [],
    travelFees = [],
    businessRules = {},
    location = '',
    customer_tier,
    customerTier,
    has_vat = false,
    duration_hours,
    durationHours,
    event_days,
    eventDays,
  } = input

  const duration = toNumber(duration_hours ?? durationHours)
  const tier = customer_tier || customerTier || 'TIER_2'
  const priceColumn = getTierPriceColumn(tier)
  const overtimeHourlyFee = toNumber(getRuleValue(businessRules, 'OVERTIME_HOURLY_FEE', DEFAULT_OVERTIME_HOURLY_FEE), DEFAULT_OVERTIME_HOURLY_FEE)
  const fullDayThreshold = toNumber(getRuleValue(businessRules, 'FULL_DAY_THRESHOLD', DEFAULT_FULL_DAY_THRESHOLD), DEFAULT_FULL_DAY_THRESHOLD)
  const vatRate = toNumber(getRuleValue(businessRules, 'VAT_RATE', DEFAULT_VAT_RATE), DEFAULT_VAT_RATE)

  const itemsWithCalculatedPrice = items.map((item) => {
    const service = findServiceForQuoteItem(services, item, location, duration, businessRules)
    const quantity = toNumber(item.quantity, 1)
    const numSessions = toNumber(item.num_sessions, 1)
    const unitPrice = toNumber(item.unit_price ?? service?.[priceColumn] ?? service?.price_tier_2)
    const totalPrice = quantity * numSessions * unitPrice

    return {
      ...item,
      service,
      resolved_service_code: service?.service_code || service?.code || item.service_code,
      unit_price: unitPrice,
      total_price: totalPrice,
    }
  })

  const subtotal = itemsWithCalculatedPrice.reduce((sum, item) => sum + toNumber(item.total_price), 0)
  const totalStaff = items.reduce((sum, item) => sum + toNumber(item.quantity, 1), 0)
  const totalDays = toNumber(event_days ?? eventDays, Math.max(1, ...items.map(item => toNumber(item.num_sessions, 1))))

  const travelFeeRow = isNoTravelLocation(location) ? null : getTravelFeeRow(travelFees, location)
  const feePerPersonPerDay = toNumber(travelFeeRow?.fee_per_person_per_day ?? travelFeeRow?.fee ?? travelFeeRow?.amount)
  const travelFeeTotal = feePerPersonPerDay * totalStaff * totalDays

  const overtimeHours = duration > fullDayThreshold ? Math.ceil(duration - fullDayThreshold) : 0
  const overtimeFeeTotal = overtimeHours * overtimeHourlyFee * totalStaff

  const preVatAmount = subtotal + travelFeeTotal + overtimeFeeTotal
  const vatAmount = has_vat ? Math.round(preVatAmount * vatRate) : 0
  const totalAmount = preVatAmount + vatAmount

  return {
    subtotal,
    travel_fee_total: travelFeeTotal,
    overtime_fee_total: overtimeFeeTotal,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    items_with_calculated_price: itemsWithCalculatedPrice,
  }
}
