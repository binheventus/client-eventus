import assert from 'node:assert/strict'
import test from 'node:test'
import { __quotesTestInternals } from './quotes.js'

const {
  buildDuplicatedQuotePayload,
  buildQuoteSurveyNotificationContent,
  buildQuoteSurveyNotificationPayload,
  formatQuoteNotificationDate,
  normalizePricedQuoteItemForSave,
} = __quotesTestInternals

test('duplicated quote payload resets identity, ownership, status, and reprices service items', () => {
  const payload = buildDuplicatedQuotePayload({
    id: 'quote-old',
    quote_number: 'BG-0001',
    share_token: 'OLDTOKEN',
    event_name: 'Gala Dinner',
    client_name: 'Client A',
    entity_code: 'EVT',
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
  assert.equal(payload.event_name, null)
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

  assert.equal(payload.event_name, null)
  assert.equal(payload.subtotal, 1_600_000)
  assert.equal(payload.total_amount, 1_600_000)
  assert.equal(payload.items[0].service_code, 'CUSTOM')
  assert.equal(payload.items[0].unit_price, 800_000)
  assert.equal(payload.items[0].is_overridden, true)
})

test('duplicated quote payload preserves quote-level discount and recalculates VAT', () => {
  const payload = buildDuplicatedQuotePayload({
    tier_code: 'TIER_2',
    location: 'Nội thành Hà Nội',
    duration_hours: 4,
    has_vat: true,
    discount_amount: 500_000,
    items: [{
      service_code: 'CHUP_IN_4H',
      service_name: 'Chụp ảnh sự kiện',
      quantity: 2,
      num_sessions: 1,
      unit_price: 1_500_000,
      original_unit_price: 1_500_000,
      is_overridden: false,
    }],
  }, {}, {
    services: [{
      service_code: 'CHUP_IN_4H',
      quote_display_name: 'Chụp ảnh sự kiện',
      unit: 'Người',
      price_tier_2: 1_500_000,
    }],
    travelFees: [],
    businessRules: {
      VAT_RATE: 0.08,
    },
  })

  assert.equal(payload.subtotal, 3_000_000)
  assert.equal(payload.discount_amount, 500_000)
  assert.equal(payload.vat_amount, 200_000)
  assert.equal(payload.total_amount, 2_700_000)
})

test('saving a repriced quote item keeps the edited display service name', () => {
  const item = normalizePricedQuoteItemForSave({
    service_code: 'CHUP_IN_4H',
    resolved_service_code: 'CHUP_IN_4H',
    service_name: 'Chụp ảnh booth check-in theo concept riêng',
    service_name_raw: 'Chụp ảnh booth check-in theo concept riêng',
    unit: 'Người',
    quantity: 1,
    num_sessions: 1,
    unit_price: 2_200_000,
    total_price: 2_200_000,
    is_overridden: false,
    service: {
      service_code: 'CHUP_IN_4H',
      quote_display_name: 'Chụp ảnh sự kiện',
      service_name: 'Chụp ảnh sự kiện tại nội thành',
      unit: 'Người',
    },
  })

  assert.equal(item.service_code, 'CHUP_IN_4H')
  assert.equal(item.service_name, 'Chụp ảnh booth check-in theo concept riêng')
  assert.equal(item.service_name_raw, 'Chụp ảnh sự kiện')
  assert.equal(item.unit_price, 2_200_000)
  assert.equal(item.is_overridden, false)
})

test('quote survey notification title uses customer name and quote created date', () => {
  const payload = buildQuoteSurveyNotificationPayload({
    client_name: 'Công ty ABC',
    created_at: '2026-06-06 09:30:00.000',
  }, {
    response_type: 'budget_fit',
    response_label: 'Khá hợp lý, tôi cần tư vấn thêm',
    selected_tag: '',
  }, [3, 5])

  assert.deepEqual(payload, {
    type: 1,
    need_to_send: [3, 5],
    title: 'Khách Công ty ABC đã phản hồi báo giá ngày 06/06/2026',
    content: 'Khá hợp lý, tôi cần tư vấn thêm\n\nGợi ý tư vấn: Dạ em thấy mình vừa duyệt gói chi phí trên web rồi ạ. Để bên em sớm chuẩn bị mọi thứ cho sự kiện, mình có cần em soạn hợp đồng trước không ạ? Nếu anh/chị sẵn sàng, em xin phép gửi thông tin chuyển khoản tạm ứng để mình kịp giữ lịch nhé.',
  })
})

test('quote survey notification content includes optimize answer details', () => {
  assert.equal(
    buildQuoteSurveyNotificationContent({
      response_type: 'optimize_cost',
      response_label: 'Giá hơi cao, tôi muốn tối ưu chi phí',
      selected_tag: 'Giảm bớt số lượng máy quay / máy chụp',
    }),
    'Giá hơi cao, tôi muốn tối ưu chi phí\nGiảm bớt số lượng máy quay / máy chụp\n\nGợi ý tư vấn: Em nhận được yêu cầu tối ưu chi phí của mình rồi ạ. Nếu sự kiện này mình bớt 1 máy quay phụ đi thì giá sẽ giảm được [X] triệu, anh/chị thấy phương án này ổn hơn không ạ?',
  )
})

test('quote survey notification date formats mysql date strings', () => {
  assert.equal(formatQuoteNotificationDate('2026-06-06 09:30:00'), '06/06/2026')
})
