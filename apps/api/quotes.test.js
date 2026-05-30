import assert from 'node:assert/strict'
import test from 'node:test'
import { __quotesTestInternals } from './quotes.js'

const { buildDuplicatedQuotePayload } = __quotesTestInternals

test('duplicated quote payload resets identity, ownership, status, and reprices service items', () => {
  const payload = buildDuplicatedQuotePayload({
    id: 'quote-old',
    quote_number: 'BG-0001',
    share_token: 'OLDTOKEN',
    event_name: 'Gala Dinner',
    client_name: 'Client A',
    entity_code: 'EVENTUS',
    tier_code: 'TIER_2',
    location: 'Nội thành Hà Nội',
    duration_hours: 4,
    has_vat: false,
    status: 'sent',
    sent_at: '2026-05-20 10:00:00',
    created_by: 'old-user',
    created_by_name: 'Old Sales',
    sales_name: 'Old Sales',
    contract_id: 'contract-1',
    has_saved_contract: true,
    items: [{
      id: 'item-old',
      quote_id: 'quote-old',
      service_code: 'CHUP_IN_4H',
      service_name: 'Tên dịch vụ cũ',
      quantity: 1,
      num_sessions: 1,
      unit_price: 1_500_000,
      original_unit_price: 1_500_000,
      is_overridden: true,
      sort_order: 1,
    }],
  }, {
    created_by: 'new-user',
    created_by_name: 'New Sales',
    sales_name: 'New Sales',
  }, {
    services: [{
      service_code: 'CHUP_IN_4H',
      quote_display_name: 'Chụp ảnh sự kiện mới',
      unit: 'Người',
      price_tier_2: 2_200_000,
    }],
    travelFees: [],
    businessRules: {},
  })

  assert.equal(payload.id, undefined)
  assert.equal(payload.quote_number, undefined)
  assert.equal(payload.share_token, undefined)
  assert.equal(payload.contract_id, undefined)
  assert.equal(payload.has_saved_contract, undefined)
  assert.equal(payload.event_name, 'Bản sao của Gala Dinner')
  assert.equal(payload.status, 'sent')
  assert.match(payload.sent_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  assert.equal(payload.created_by, 'new-user')
  assert.equal(payload.created_by_name, 'New Sales')
  assert.equal(payload.sales_name, 'New Sales')
  assert.equal(payload.subtotal, 2_200_000)
  assert.equal(payload.total_amount, 2_200_000)
  assert.equal(payload.items[0].id, undefined)
  assert.equal(payload.items[0].quote_id, undefined)
  assert.equal(payload.items[0].service_code, 'CHUP_IN_4H')
  assert.equal(payload.items[0].service_name, 'Chụp ảnh sự kiện mới')
  assert.equal(payload.items[0].unit_price, 2_200_000)
  assert.equal(payload.items[0].original_unit_price, 2_200_000)
  assert.equal(payload.items[0].is_overridden, false)
})

test('duplicated quote payload keeps custom item manual pricing', () => {
  const payload = buildDuplicatedQuotePayload({
    quote_number: 'BG-0002',
    event_name: '',
    tier_code: 'TIER_2',
    location: 'Nội thành Hà Nội',
    duration_hours: 4,
    has_vat: false,
    items: [{
      service_code: 'CUSTOM',
      service_name: 'Chi phí setup riêng',
      unit: 'Gói',
      quantity: 2,
      num_sessions: 1,
      unit_price: 800_000,
      original_unit_price: 800_000,
      is_custom: true,
      is_overridden: true,
    }],
  }, {}, {
    services: [],
    travelFees: [],
    businessRules: {},
  })

  assert.equal(payload.event_name, 'Bản sao của BG-0002')
  assert.equal(payload.subtotal, 1_600_000)
  assert.equal(payload.total_amount, 1_600_000)
  assert.equal(payload.items[0].service_code, 'CUSTOM')
  assert.equal(payload.items[0].unit_price, 800_000)
  assert.equal(payload.items[0].is_overridden, true)
})
