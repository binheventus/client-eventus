export const DEFAULT_HALF_DAY_THRESHOLD = 4.5
export const DEFAULT_HALF_DAY_INCLUDED_HOURS = 4
export const DEFAULT_FULL_DAY_THRESHOLD = 8
export const DEFAULT_FULL_DAY_INCLUDED_HOURS = 8
export const DEFAULT_OVERTIME_HOURLY_FEE = 500000
export const DEFAULT_VAT_RATE = 0.08
export const DEFAULT_DURATION_HOURS = 4
export const DEFAULT_LOCATION = 'Hà Nội'

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
    .replace(/_(IN|OUT)_(4H|8H)$/, '')
    .replace(/_(IN|OUT)$/, '')
    .replace(/_(4H|8H)$/, '')
}

function normalizeServiceAlias(serviceCode = '') {
  const normalized = normalizeServiceBase(serviceCode)
  const aliases = {
    PHOTO: 'CHUP',
    VIDEO: 'QUAY_RECAP',
    VIDEO_HL: 'QUAY_RECAP',
    VIDEO_FULL: 'QUAY_FULL',
  }
  return aliases[normalized] || normalized
}

function inferServiceBaseFromItem(item = {}) {
  const explicitCode = normalizeServiceAlias(item.service_code)
  if (explicitCode) return explicitCode

  const rawText = normalizeText([
    item.service_name_raw,
    item.service_name,
    item.service?.service_name,
    item.service?.name,
  ].filter(Boolean).join(' '))

  if (rawText.includes('CHUP') || rawText.includes('PHOTO') || rawText.includes('PHOTOGRAPHER')) return 'CHUP'
  if (rawText.includes('QUAY FULL') || rawText.includes('VIDEO FULL') || rawText.includes('FULL KHONG CAT')) return 'QUAY_FULL'
  if (rawText.includes('QUAY') || rawText.includes('VIDEO')) return 'QUAY_RECAP'
  return ''
}

function isNoTravelLocation(location = '') {
  const normalized = normalizeText(location)
  if (!normalized) return true
  if (normalized.includes('NOI THANH')) return true
  if (normalized.includes('HA NOI') && (normalized.includes('NGOAI THANH') || normalized.includes('<30') || normalized.includes('30KM'))) return true
  return normalized === 'HA NOI' || normalized === 'HN'
}

function getDurationUnit(durationHours, rules = {}) {
  const fullDayThreshold = toNumber(rules.FULL_DAY_THRESHOLD, DEFAULT_FULL_DAY_THRESHOLD)
  return toNumber(durationHours) >= fullDayThreshold ? '8H' : '4H'
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

function getSelectedServiceCode(item = {}) {
  return normalizeText(item.resolved_service_code || item.service_code || item.service?.service_code || item.service?.code)
}

function itemHasOvertimePricing(item = {}, service = null) {
  const serviceCode = getServiceCode(service) || normalizeText(item.service_code || item.resolved_service_code)
  return /(?:_(?:IN|OUT))?_(?:4H|8H)$/.test(serviceCode)
}

function getServiceDurationUnit(item = {}, service = null) {
  const serviceCode = getServiceCode(service) || getSelectedServiceCode(item)
  return serviceCode.match(/(?:^|_)(4H|8H)$/)?.[1] || ''
}

function getBaseUnitPrice(item = {}, service = null, priceColumn = 'price_tier_2') {
  if (item.is_overridden) return toNumber(item.unit_price ?? service?.[priceColumn] ?? service?.price_tier_2)
  return toNumber(service?.[priceColumn] ?? item.unit_price ?? item.original_unit_price ?? service?.price_tier_2)
}

function getItemDurationHours(item = {}, fallbackDuration = DEFAULT_DURATION_HOURS) {
  return toNumber(item.billable_duration_hours ?? item.item_duration_hours ?? item.duration_hours, fallbackDuration)
}

export function findServiceForQuoteItem(services = [], item = {}, location, durationHours, businessRules = {}) {
  const baseCode = inferServiceBaseFromItem(item)
  const locationUnit = getLocationUnit(location)
  const durationUnit = getDurationUnit(durationHours, businessRules)
  const selectedServiceCode = getSelectedServiceCode(item)
  const candidates = [
    selectedServiceCode,
    `${baseCode}_${locationUnit}_${durationUnit}`,
    `${baseCode}_${locationUnit}`,
    `${baseCode}_${durationUnit}`,
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

function getDefaultDurationHours(businessRules) {
  return toNumber(getRuleValue(businessRules, 'DEFAULT_DURATION_HOURS', DEFAULT_DURATION_HOURS), DEFAULT_DURATION_HOURS)
}

function getItemOvertimeHours(duration, item = {}, service = null, businessRules = {}) {
  if (!itemHasOvertimePricing(item, service)) return 0

  const durationUnit = getServiceDurationUnit(item, service)
  const halfDayThreshold = toNumber(getRuleValue(businessRules, 'HALF_DAY_THRESHOLD', DEFAULT_HALF_DAY_THRESHOLD), DEFAULT_HALF_DAY_THRESHOLD)
  const halfDayIncludedHours = toNumber(getRuleValue(businessRules, 'HALF_DAY_INCLUDED_HOURS', DEFAULT_HALF_DAY_INCLUDED_HOURS), DEFAULT_HALF_DAY_INCLUDED_HOURS)
  const fullDayThreshold = toNumber(getRuleValue(businessRules, 'FULL_DAY_THRESHOLD', DEFAULT_FULL_DAY_THRESHOLD), DEFAULT_FULL_DAY_THRESHOLD)

  if (durationUnit === '8H') return Math.max(0, Math.ceil(duration - DEFAULT_FULL_DAY_INCLUDED_HOURS))
  if (durationUnit === '4H' && duration > halfDayThreshold) return Math.max(0, Math.ceil(duration - halfDayIncludedHours))

  if (duration > fullDayThreshold) return Math.ceil(duration - fullDayThreshold)
  if (duration > halfDayThreshold && duration < fullDayThreshold) return Math.ceil(duration - halfDayIncludedHours)
  return 0
}

function getDefaultLocation(businessRules) {
  return String(getRuleValue(businessRules, 'DEFAULT_LOCATION', DEFAULT_LOCATION) || DEFAULT_LOCATION)
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
    location,
    customer_tier,
    customerTier,
    has_vat = false,
    duration_hours,
    durationHours,
    event_days,
    eventDays,
    discount_amount,
    discountAmount,
  } = input

  const duration = toNumber(duration_hours ?? durationHours, getDefaultDurationHours(businessRules))
  const effectiveLocation = location || getDefaultLocation(businessRules)
  const tier = customer_tier || customerTier || 'TIER_2'
  const priceColumn = getTierPriceColumn(tier)
  const overtimeHourlyFee = toNumber(getRuleValue(businessRules, 'OVERTIME_HOURLY_FEE', DEFAULT_OVERTIME_HOURLY_FEE), DEFAULT_OVERTIME_HOURLY_FEE)
  const vatRate = toNumber(getRuleValue(businessRules, 'VAT_RATE', DEFAULT_VAT_RATE), DEFAULT_VAT_RATE)

  const itemsWithCalculatedPrice = items.map((item) => {
    const itemDuration = getItemDurationHours(item, duration)
    const service = findServiceForQuoteItem(services, item, effectiveLocation, itemDuration, businessRules)
    const quantity = toNumber(item.quantity, 1)
    const numSessions = toNumber(item.num_sessions, 1)
    const baseUnitPrice = getBaseUnitPrice(item, service, priceColumn)
    const overtimeHours = getItemOvertimeHours(itemDuration, item, service, businessRules)
    const itemOvertimeAddOn = !item.is_overridden ? overtimeHours * overtimeHourlyFee : 0
    const unitPrice = baseUnitPrice + itemOvertimeAddOn
    const totalPrice = quantity * numSessions * unitPrice

    return {
      ...item,
      service,
      resolved_service_code: service?.service_code || service?.code || item.service_code,
      unit_price: unitPrice,
      original_unit_price: item.original_unit_price ?? baseUnitPrice,
      total_price: totalPrice,
      billable_duration_hours: itemDuration,
      overtime_unit_add_on: itemOvertimeAddOn,
    }
  })

  const subtotal = itemsWithCalculatedPrice.reduce((sum, item) => sum + toNumber(item.total_price), 0)
  const totalStaff = items.reduce((sum, item) => sum + toNumber(item.quantity, 1), 0)
  const totalDays = toNumber(event_days ?? eventDays, Math.max(1, ...items.map(item => toNumber(item.num_sessions, 1))))

  const travelFeeRow = isNoTravelLocation(effectiveLocation) ? null : getTravelFeeRow(travelFees, effectiveLocation)
  const feePerPersonPerDay = toNumber(travelFeeRow?.fee_per_person_per_day ?? travelFeeRow?.fee ?? travelFeeRow?.amount)
  const travelFeeTotal = feePerPersonPerDay * totalStaff * totalDays

  const overtimeFeeTotal = 0
  const preDiscountTotal = subtotal + travelFeeTotal + overtimeFeeTotal
  const requestedDiscountAmount = Math.max(0, toNumber(discount_amount ?? discountAmount, 0))
  const discountAmountValue = Math.min(requestedDiscountAmount, preDiscountTotal)
  const taxableAmount = Math.max(0, preDiscountTotal - discountAmountValue)
  const vatAmount = has_vat ? Math.round(taxableAmount * vatRate) : 0
  const totalAmount = taxableAmount + vatAmount

  return {
    subtotal,
    travel_fee_total: travelFeeTotal,
    overtime_fee_total: overtimeFeeTotal,
    pre_discount_total: preDiscountTotal,
    discount_amount: discountAmountValue,
    taxable_amount: taxableAmount,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    items_with_calculated_price: itemsWithCalculatedPrice,
  }
}
