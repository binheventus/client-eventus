import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateQuotePricing,
  convertItemsGrossToNet,
  convertItemsNetToGross,
  formatVatLabel,
  resolveVatRate,
} from './pricingCalculator.js'

const services = [
  { service_code: 'CHUP_IN_4H', price_tier_1: 1800000, price_tier_2: 1500000, price_tier_3: 1300000 },
  { service_code: 'CHUP_IN_8H', price_tier_1: 2800000, price_tier_2: 2400000, price_tier_3: 2200000 },
  { service_code: 'CHUP_OUT_4H', price_tier_1: 2500000, price_tier_2: 2500000, price_tier_3: 2250000 },
  { service_code: 'CHUP_OUT_8H', price_tier_1: 3000000, price_tier_2: 2500000, price_tier_3: 2200000 },
  { service_code: 'QUAY_RECAP_IN_4H', price_tier_1: 2600000, price_tier_2: 2200000, price_tier_3: 2000000 },
  { service_code: 'QUAY_RECAP_OUT_4H', price_tier_1: 3000000, price_tier_2: 3000000, price_tier_3: 2700000 },
  { service_code: 'QUAY_RECAP_IN_8H', price_tier_1: 3600000, price_tier_2: 3000000, price_tier_3: 2700000 },
  { service_code: 'QUAY_RECAP_OUT_8H', price_tier_1: 4200000, price_tier_2: 3500000, price_tier_3: 3200000 },
  { service_code: 'QUAY_FULL_IN_4H', price_tier_1: 3000000, price_tier_2: 2500000, price_tier_3: 2250000 },
  { service_code: 'QUAY_FULL_IN_8H', price_tier_1: 5000000, price_tier_2: 4500000, price_tier_3: 4000000 },
  { service_code: 'FLYCAM_OUT_4H', price_tier_1: 3000000, price_tier_2: 3000000, price_tier_3: 2700000 },
  { service_code: 'FLYCAM_OUT_8H', price_tier_1: 2400000, price_tier_2: 2000000, price_tier_3: 1800000 },
]

const travelFees = [
  { location: 'Hải Phòng', fee_per_person_per_day: 500000 },
]

const businessRules = {
  HALF_DAY_THRESHOLD: 4.5,
  FULL_DAY_THRESHOLD: 8,
  OVERTIME_HOURLY_FEE: 500000,
  VAT_RATE: 0.08,
}

test('case 1: 2 chụp 4 tiếng nội thành Hà Nội, tier_2, có VAT', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: 'PHOTO', quantity: 2, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: true,
    duration_hours: 4,
  })

  assert.equal(result.subtotal, 3000000)
  assert.equal(result.travel_fee_total, 0)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.vat_amount, 240000)
  assert.equal(result.total_amount, 3240000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CHUP_IN_4H')
})

test('case 2: 2 chụp 1 quay 2 flycam, 5 tiếng, Hải Phòng, tier_2, có VAT', () => {
  const result = calculateQuotePricing({
    items: [
      { service_code: 'PHOTO', quantity: 2, num_sessions: 1 },
      { service_code: 'VIDEO', quantity: 1, num_sessions: 1 },
      { service_code: 'FLYCAM', quantity: 2, num_sessions: 1 },
    ],
    services,
    travelFees,
    businessRules,
    location: 'Hải Phòng',
    customer_tier: 'TIER_2',
    has_vat: true,
    duration_hours: 5,
  })

  assert.equal(result.subtotal, 16500000)
  assert.equal(result.travel_fee_total, 2500000)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.vat_amount, 1520000)
  assert.equal(result.total_amount, 20520000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CHUP_OUT_4H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 3000000)
  assert.equal(result.items_with_calculated_price[1].resolved_service_code, 'QUAY_RECAP_OUT_4H')
  assert.equal(result.items_with_calculated_price[1].unit_price, 3500000)
  assert.equal(result.items_with_calculated_price[2].resolved_service_code, 'FLYCAM_OUT_4H')
  assert.equal(result.items_with_calculated_price[2].unit_price, 3500000)
})

test('discount is applied before VAT and is capped at the pre-discount total', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: 'PHOTO', quantity: 2, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: true,
    discount_amount: 500000,
    duration_hours: 4,
  })
  const capped = calculateQuotePricing({
    items: [{ service_code: 'PHOTO', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: true,
    discount_amount: 5000000,
    duration_hours: 4,
  })

  assert.equal(result.subtotal, 3000000)
  assert.equal(result.pre_discount_total, 3000000)
  assert.equal(result.discount_amount, 500000)
  assert.equal(result.taxable_amount, 2500000)
  assert.equal(result.vat_amount, 200000)
  assert.equal(result.total_amount, 2700000)
  assert.equal(capped.discount_amount, 1500000)
  assert.equal(capped.taxable_amount, 0)
  assert.equal(capped.total_amount, 0)
})

test('case 3: 1 quay, 10 tiếng nội thành, tier_2, có VAT', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: 'VIDEO', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: true,
    duration_hours: 10,
  })

  assert.equal(result.subtotal, 4000000)
  assert.equal(result.travel_fee_total, 0)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.vat_amount, 320000)
  assert.equal(result.total_amount, 4320000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'QUAY_RECAP_IN_8H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 4000000)
})

test('quay raw text defaults to recap/highlight', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: null, service_name_raw: 'quay', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 5,
  })

  assert.equal(result.subtotal, 2700000)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'QUAY_RECAP_IN_4H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 2700000)
})

test('embedded overtime is not added twice when calculated items are reused', () => {
  const firstPass = calculateQuotePricing({
    items: [{ service_code: 'VIDEO', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 5,
  })

  const secondPass = calculateQuotePricing({
    items: firstPass.items_with_calculated_price,
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 5,
  })

  assert.equal(secondPass.subtotal, firstPass.subtotal)
  assert.equal(secondPass.items_with_calculated_price[0].unit_price, 2700000)
})

test('manual price override is treated as the final displayed unit price', () => {
  const result = calculateQuotePricing({
    items: [{
      service_code: 'VIDEO',
      quantity: 1,
      num_sessions: 1,
      unit_price: 2500000,
      original_unit_price: 2200000,
      is_overridden: true,
    }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 5,
  })

  assert.equal(result.subtotal, 2500000)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.items_with_calculated_price[0].unit_price, 2500000)
})

test('non-overridden snapshot items reprice when customer tier changes', () => {
  const result = calculateQuotePricing({
    items: [{
      service_code: 'CHUP_IN_4H',
      quantity: 1,
      num_sessions: 1,
      unit_price: 1500000,
      original_unit_price: 1500000,
      is_overridden: false,
    }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_1',
    has_vat: false,
    duration_hours: 4,
  })

  assert.equal(result.subtotal, 1800000)
  assert.equal(result.items_with_calculated_price[0].unit_price, 1800000)
})

test('explicitly selected service code is preserved when quote duration differs', () => {
  const result = calculateQuotePricing({
    items: [{
      service_code: 'CHUP_IN_8H',
      quantity: 1,
      num_sessions: 1,
      unit_price: 2400000,
      original_unit_price: 2400000,
      is_overridden: false,
    }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 4,
  })

  assert.equal(result.subtotal, 2400000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CHUP_IN_8H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 2400000)
})

test('explicit 8H items only get overtime after the included 8 hours', () => {
  const input = {
    items: [{
      service_code: 'CHUP_IN_8H',
      quantity: 1,
      num_sessions: 1,
      is_overridden: false,
    }],
    services,
    travelFees,
    businessRules: {
      ...businessRules,
      FULL_DAY_THRESHOLD: 7,
    },
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
  }

  const fiveHours = calculateQuotePricing({ ...input, duration_hours: 5 })
  const eightHours = calculateQuotePricing({ ...input, duration_hours: 8 })
  const nineHours = calculateQuotePricing({ ...input, duration_hours: 9 })

  assert.equal(fiveHours.items_with_calculated_price[0].unit_price, 2400000)
  assert.equal(fiveHours.items_with_calculated_price[0].overtime_unit_add_on, 0)
  assert.equal(eightHours.items_with_calculated_price[0].unit_price, 2400000)
  assert.equal(eightHours.items_with_calculated_price[0].overtime_unit_add_on, 0)
  assert.equal(nineHours.items_with_calculated_price[0].unit_price, 2900000)
  assert.equal(nineHours.items_with_calculated_price[0].overtime_unit_add_on, 500000)
})

test('explicit 4H items keep half-day overtime even when full-day threshold is 7', () => {
  const result = calculateQuotePricing({
    items: [{
      service_code: 'CHUP_IN_4H',
      quantity: 1,
      num_sessions: 1,
      is_overridden: false,
    }],
    services,
    travelFees,
    businessRules: {
      ...businessRules,
      FULL_DAY_THRESHOLD: 7,
    },
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 8,
  })

  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CHUP_IN_4H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 3500000)
  assert.equal(result.items_with_calculated_price[0].overtime_unit_add_on, 2000000)
})

test('mixed 4H and 8H items use each item billable duration for overtime', () => {
  const result = calculateQuotePricing({
    items: [
      {
        service_code: 'CHUP_IN_8H',
        quantity: 1,
        num_sessions: 1,
        billable_duration_hours: 9,
        is_overridden: false,
      },
      {
        service_code: 'CHUP_IN_4H',
        quantity: 1,
        num_sessions: 1,
        billable_duration_hours: 4,
        is_overridden: false,
      },
    ],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 9,
  })

  assert.equal(result.items_with_calculated_price[0].unit_price, 2900000)
  assert.equal(result.items_with_calculated_price[0].overtime_unit_add_on, 500000)
  assert.equal(result.items_with_calculated_price[1].unit_price, 1500000)
  assert.equal(result.items_with_calculated_price[1].overtime_unit_add_on, 0)
  assert.equal(result.subtotal, 4400000)
})

test('custom items keep their manual unit price across tiers', () => {
  const result = calculateQuotePricing({
    items: [{
      service_code: 'CUSTOM',
      service_name: 'Chi phí phát sinh',
      quantity: 2,
      num_sessions: 1,
      unit_price: 750000,
      original_unit_price: 0,
      is_custom: true,
      is_overridden: true,
    }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_1',
    has_vat: false,
    duration_hours: 4,
  })

  assert.equal(result.subtotal, 1500000)
  assert.equal(result.items_with_calculated_price[0].unit_price, 750000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CUSTOM')
})

test('quay full raw text maps to full video', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: null, service_name_raw: 'quay full', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: false,
    duration_hours: 5,
  })

  assert.equal(result.subtotal, 3000000)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'QUAY_FULL_IN_4H')
  assert.equal(result.items_with_calculated_price[0].unit_price, 3000000)
})

test('missing location and duration default to local 4H', () => {
  const result = calculateQuotePricing({
    items: [
      { service_code: 'PHOTO', quantity: 1, num_sessions: 1 },
      { service_code: 'VIDEO', quantity: 1, num_sessions: 1 },
    ],
    services,
    travelFees,
    businessRules,
    customer_tier: 'TIER_2',
    has_vat: false,
  })

  assert.equal(result.subtotal, 3700000)
  assert.equal(result.travel_fee_total, 0)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'CHUP_IN_4H')
  assert.equal(result.items_with_calculated_price[1].resolved_service_code, 'QUAY_RECAP_IN_4H')
})

test('default duration and location come from business rules', () => {
  const result = calculateQuotePricing({
    items: [{ service_code: 'VIDEO', quantity: 1, num_sessions: 1 }],
    services,
    travelFees,
    businessRules: {
      ...businessRules,
      DEFAULT_DURATION_HOURS: 8,
      DEFAULT_LOCATION: 'Hà Nội',
    },
    customer_tier: 'TIER_2',
    has_vat: false,
  })

  assert.equal(result.subtotal, 3000000)
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'QUAY_RECAP_IN_8H')
})

test('convertItemsGrossToNet quy đổi đơn giá gross về net, round về bội 1000', () => {
  const items = [
    { service_code: 'CHUP_IN_8H', quantity: 2, num_sessions: 1, unit_price: 5000000, is_overridden: true },
    { service_code: 'QUAY_RECAP_IN_8H', quantity: 2, num_sessions: 1, unit_price: 6000000, is_overridden: true },
  ]

  const netItems = convertItemsGrossToNet(items, { vatRate: 0.08 })

  // 5,000,000 / 1.08 = 4,629,629.6 → round về bội 1000 = 4,630,000
  assert.equal(netItems[0].unit_price, 4630000)
  assert.equal(netItems[0].total_price, 9260000)
  // 6,000,000 / 1.08 = 5,555,555.5 → round về bội 1000 = 5,556,000
  assert.equal(netItems[1].unit_price, 5556000)
  assert.equal(netItems[1].total_price, 11112000)

  // Khi tính lại pricing với has_vat=true thì total ≈ 22tr (drift vài nghìn do round)
  const result = calculateQuotePricing({
    items: netItems,
    services,
    travelFees,
    businessRules,
    location: 'nội thành Hà Nội',
    customer_tier: 'TIER_2',
    has_vat: true,
    duration_hours: 8,
  })
  assert.equal(result.subtotal, 20372000)
  assert.equal(result.vat_amount, 1629760)
  assert.equal(result.total_amount, 22001760)
})

test('convertItemsNetToGross đảo ngược net về gross, round về bội 1000', () => {
  const items = [
    { service_code: 'CHUP_IN_8H', quantity: 2, num_sessions: 1, unit_price: 4630000, is_overridden: true },
  ]
  const grossItems = convertItemsNetToGross(items, { vatRate: 0.08 })
  // 4,630,000 * 1.08 = 5,000,400 → round về bội 1000 = 5,000,000
  assert.equal(grossItems[0].unit_price, 5000000)
  assert.equal(grossItems[0].total_price, 10000000)
})

test('convertItemsGrossToNet trả về mảng rỗng khi input rỗng', () => {
  assert.deepEqual(convertItemsGrossToNet([]), [])
  assert.deepEqual(convertItemsGrossToNet(null), [])
})

test('convertItemsGrossToNet không đổi gì khi vatRate=0', () => {
  const items = [{ service_code: 'CHUP_IN_4H', quantity: 1, num_sessions: 1, unit_price: 1500000 }]
  const result = convertItemsGrossToNet(items, { vatRate: 0 })
  assert.equal(result[0].unit_price, 1500000)
})

test('resolveVatRate suy ngược tỷ lệ từ số tiền đã lưu trên quote', () => {
  // vat 240k trên taxable 3tr = 8%
  assert.equal(resolveVatRate({ vat_amount: 240000, total_amount: 3240000 }), 0.08)
  // vat 300k trên taxable 3tr = 10%
  assert.equal(resolveVatRate({ vat_amount: 300000, total_amount: 3300000 }), 0.1)
})

test('resolveVatRate fallback về business rule rồi default khi quote chưa có số', () => {
  assert.equal(resolveVatRate({}, { VAT_RATE: 0.1 }), 0.1)
  assert.equal(resolveVatRate({}), 0.08)
  assert.equal(resolveVatRate({ vat_amount: 0, total_amount: 0 }, { VAT_RATE: 0.05 }), 0.05)
})

test('formatVatLabel hiển thị đúng % theo số tiền thực tế', () => {
  assert.equal(formatVatLabel({ vat_amount: 240000, total_amount: 3240000 }), 'Thuế GTGT 8%')
  assert.equal(formatVatLabel({ vat_amount: 300000, total_amount: 3300000 }), 'Thuế GTGT 10%')
  assert.equal(formatVatLabel({}, { VAT_RATE: 0.1 }), 'Thuế GTGT 10%')
  assert.equal(formatVatLabel({ vat_amount: 240000, total_amount: 3240000 }, null, { prefix: 'VAT' }), 'VAT 8%')
})
