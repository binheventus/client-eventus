import assert from 'node:assert/strict'
import test from 'node:test'
import { __pricingContextTestInternals, toPricingApiPayload } from './lib/pricing-context.js'

const { buildContext } = __pricingContextTestInternals

test('pricing context normalizes MySQL rows and exposes quote aliases', () => {
  const context = buildContext({
    services: [{
      service_code: 'CHUP_IN_4H',
      service_name: 'Chụp ảnh',
      price_tier_2: '2200000.00',
      is_active: 1,
      sort_order: 2,
    }],
    travel_fees: [{
      location: 'Hải Phòng',
      fee_per_person_per_day: '500000.00',
      includes_transport: 1,
      is_active: 1,
      sort_order: 1,
    }],
    customer_tiers: [{
      tier_code: 'TIER_2',
      tier_name: 'Khách thường',
      is_active: 1,
      sort_order: 1,
    }],
    business_rules: [{
      rule_code: 'VAT_RATE',
      rule_value: '0.08',
      is_active: 1,
      sort_order: 1,
    }],
    legal_entities: [{
      entity_code: 'EVT',
      entity_name_full: 'Công ty TNHH Eventus Việt Nam',
      is_default: 1,
      is_active: 1,
      sort_order: 1,
    }],
    equipment_rules: [{
      match_prefixes: 'CHUP',
      match_prefix_list: '["CHUP"]',
      equipment_title: 'Thiết bị chụp',
      is_active: 1,
      sort_order: 1,
    }],
  }, {
    source: 'mysql',
    warnings: [],
  })

  assert.equal(context.services[0].price_tier_2, 2200000)
  assert.equal(context.travelFees[0].fee_per_person_per_day, 500000)
  assert.equal(context.travelFees[0].includes_transport, true)
  assert.equal(context.businessRules.VAT_RATE, '0.08')
  assert.equal(context.legalEntities[0].is_default, true)
  assert.deepEqual(context.equipmentRules[0].match_prefix_list, ['CHUP'])
})

test('pricing API payload includes all quote pricing datasets', () => {
  const context = buildContext({
    services: [{ service_code: 'SVC', service_name: 'Service', is_active: 1 }],
    travel_fees: [{ location: 'Hà Nội', is_active: 1 }],
    customer_tiers: [{ tier_code: 'TIER_2', tier_name: 'Tier 2', is_active: 1 }],
    business_rules: [{ rule_code: 'DEFAULT_LOCATION', rule_value: 'Hà Nội', is_active: 1 }],
    legal_entities: [{ entity_code: 'EVT', entity_name_full: 'Eventus', is_active: 1 }],
    equipment_rules: [{ match_prefixes: 'SVC', equipment_title: 'Gear', is_active: 1 }],
  }, {
    source: 'mysql',
    warnings: [],
  })

  const payload = toPricingApiPayload(context)

  assert.deepEqual(Object.keys(payload.pricing).sort(), [
    'business_rules',
    'customer_tiers',
    'equipment_rules',
    'legal_entities',
    'services',
    'travel_fees',
  ])
  assert.equal(payload.business_rules_map.DEFAULT_LOCATION, 'Hà Nội')
  assert.equal(payload.meta.source, 'mysql')
})
