import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateQuotePricing } from './pricingCalculator.js'

const services = [
  { service_code: 'PHOTO_IN_HD', price_tier_1: 1800000, price_tier_2: 1500000, price_tier_3: 1300000 },
  { service_code: 'PHOTO_OUT_FD', price_tier_1: 3000000, price_tier_2: 2500000, price_tier_3: 2200000 },
  { service_code: 'VIDEO_IN_FD', price_tier_1: 3600000, price_tier_2: 3000000, price_tier_3: 2700000 },
  { service_code: 'VIDEO_OUT_FD', price_tier_1: 4200000, price_tier_2: 3500000, price_tier_3: 3200000 },
  { service_code: 'FLYCAM_OUT_FD', price_tier_1: 2400000, price_tier_2: 2000000, price_tier_3: 1800000 },
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
  assert.equal(result.items_with_calculated_price[0].resolved_service_code, 'PHOTO_IN_HD')
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

  assert.equal(result.subtotal, 12500000)
  assert.equal(result.travel_fee_total, 2500000)
  assert.equal(result.overtime_fee_total, 0)
  assert.equal(result.vat_amount, 1200000)
  assert.equal(result.total_amount, 16200000)
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

  assert.equal(result.subtotal, 3000000)
  assert.equal(result.travel_fee_total, 0)
  assert.equal(result.overtime_fee_total, 1000000)
  assert.equal(result.vat_amount, 320000)
  assert.equal(result.total_amount, 4320000)
})
