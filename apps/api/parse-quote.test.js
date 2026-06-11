import assert from 'node:assert/strict'
import test from 'node:test'
import handler, { applyBriefBusinessRules, deterministicParseQuoteInput } from './parse-quote.js'

const recapServices = [
  { service_code: 'CHUP_IN_4H' },
  { service_code: 'CHUP_OUT_4H' },
  { service_code: 'CHUP_IN_8H' },
  { service_code: 'CHUP_OUT_8H' },
  { service_code: 'QUAY_RECAP_IN_4H' },
  { service_code: 'QUAY_RECAP_OUT_4H' },
  { service_code: 'QUAY_RECAP_IN_8H' },
  { service_code: 'QUAY_RECAP_OUT_8H' },
  { service_code: 'QUAY_FULL_IN_4H' },
  { service_code: 'QUAY_FULL_OUT_4H' },
  { service_code: 'QUAY_FULL_IN_8H' },
  { service_code: 'QUAY_FULL_OUT_8H' },
  { service_code: 'FLYCAM_IN_4H' },
  { service_code: 'FLYCAM_OUT_4H' },
  { service_code: 'FLYCAM_IN_8H' },
  { service_code: 'FLYCAM_OUT_8H' },
  { service_code: 'FPV_4H' },
  { service_code: 'FPV_8H' },
  { service_code: 'QUAY_LIVE_4H' },
  { service_code: 'QUAY_LIVE_8H' },
  { service_code: 'FLYCAM_LIVE_4H' },
  { service_code: 'FLYCAM_LIVE_8H' },
  { service_code: 'FPV_LIVE_4H' },
  { service_code: 'FPV_LIVE_8H' },
  { service_code: 'RECAP_1_2_CAM' },
  { service_code: 'RECAP_3_4_CAM' },
  { service_code: 'RECAP_5_6_CAM' },
  { service_code: 'RECAP_7_CAM' },
]

const parseContext = {
  services: recapServices,
  travel_fees: [
    { location: 'Nội thành Hà Nội' },
    { location: 'Hải Phòng' },
    { location: 'Bắc Ninh' },
  ],
}

function makeJsonResponse() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return this
    },
  }
}

test('default recap edit is selected from parsed video camera count', () => {
  const result = deterministicParseQuoteInput('4 quay', parseContext)
  const codes = result.parsed.items.map(item => item.service_code)

  assert.deepEqual(codes, ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
  assert.equal(result.parsed.items[0].quantity, 4)
})

test('business rules replace a wrong recap edit bracket', () => {
  const result = applyBriefBusinessRules({
    parsed: {
      items: [
        { service_code: 'QUAY_RECAP_IN_4H', quantity: 4, service_name_raw: 'quay' },
        { service_code: 'RECAP_1_2_CAM', quantity: 1, service_name_raw: 'dựng recap 1-2 cam' },
      ],
    },
    missing_fields: [],
    ambiguous_fields: [],
    confidence: 'high',
    ai_reasoning: '',
  }, '4 quay', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
})

test('full-day video shoots use half-day equivalent camera count for recap edit', () => {
  const result = deterministicParseQuoteInput('3 quay cả ngày', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_8H', 'RECAP_5_6_CAM'])
  assert.equal(result.parsed.items[0].quantity, 3)
  assert.equal(result.parsed.duration_hours, 8)
})

test('business rules replace full-day recap edit using half-day equivalent cameras', () => {
  const result = applyBriefBusinessRules({
    parsed: {
      duration_hours: 8,
      items: [
        { service_code: 'QUAY_RECAP_IN_4H', quantity: 4, service_name_raw: 'quay' },
        { service_code: 'RECAP_3_4_CAM', quantity: 1, service_name_raw: 'dựng recap 3-4 cam' },
      ],
    },
    missing_fields: [],
    ambiguous_fields: [],
    confidence: 'high',
    ai_reasoning: '',
  }, '4 quay cả ngày', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_7_CAM'])
})

test('explicit no-edit brief does not add default recap edit', () => {
  const result = deterministicParseQuoteInput('4 quay không dựng', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H'])
})

test('out-city and full-day briefs resolve concrete service codes', () => {
  const result = deterministicParseQuoteInput('2 chụp 1 quay 5 tiếng Hải Phòng', parseContext)

  assert.equal(result.parsed.location, 'Hải Phòng')
  assert.equal(result.parsed.duration_hours, 5)
  assert.deepEqual(result.parsed.items.map(item => item.service_code), [
    'CHUP_OUT_4H',
    'QUAY_RECAP_OUT_4H',
    'RECAP_1_2_CAM',
  ])
})

test('full-day out-city photo resolves 8H out-city service', () => {
  const result = deterministicParseQuoteInput('1 chụp 8 tiếng Hải Phòng', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['CHUP_OUT_8H'])
})

test('live briefs do not add default recap edit', () => {
  const result = deterministicParseQuoteInput('1 quay live 4 tiếng Hà Nội', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_LIVE_4H'])
})

test('full video briefs do not add default recap edit', () => {
  const result = deterministicParseQuoteInput('1 quay full 4 tiếng Hà Nội', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_FULL_IN_4H'])
})

test('fpv briefs resolve FPV service by duration', () => {
  const result = deterministicParseQuoteInput('1 fpv 8 tiếng Hà Nội', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['FPV_8H'])
})

test('seven or more cameras use the highest recap edit bracket', () => {
  const result = deterministicParseQuoteInput('9 quay', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_7_CAM'])
  assert.equal(result.parsed.items.at(-1).service_name_raw, 'dựng recap từ 7 cam')
})

test('highest recap edit bracket supports the previous 7-8 cam service code', () => {
  const legacyServices = [
    { service_code: 'QUAY_RECAP_IN_4H' },
    { service_code: 'RECAP_1_2_CAM' },
    { service_code: 'RECAP_3_4_CAM' },
    { service_code: 'RECAP_5_6_CAM' },
    { service_code: 'RECAP_7_8_CAM' },
  ]
  const result = deterministicParseQuoteInput('9 quay', { services: legacyServices })

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_7_8_CAM'])
})

test('single-line mixed crew brief keeps all services in one quote group', () => {
  const result = deterministicParseQuoteInput('2 quay 2 chụp 1 flycam nội thành', parseContext)

  assert.deepEqual(result.parsed.items.map(item => item.service_code), [
    'CHUP_IN_4H',
    'QUAY_RECAP_IN_4H',
    'FLYCAM_IN_4H',
    'RECAP_1_2_CAM',
  ])
  assert.deepEqual([...new Set(result.parsed.items.map(item => item.group_code))], ['CUSTOM_DEFAULT'])
  assert.deepEqual([...new Set(result.parsed.items.map(item => item.group_label))], ['Nhóm 1'])
})

test('multi-day briefs keep shooting items grouped by day and post-production separate', () => {
  const result = deterministicParseQuoteInput(`Ngày 1:
2 quay 2 chụp 3 tiếng Hà Nội
Ngày 2:
2 quay 2 chụp 5 tiếng Hà Nội`, parseContext)

  assert.equal(result.parsed.num_days, 2)
  assert.equal(result.parsed.duration_hours, 5)
  assert.deepEqual(result.parsed.items.map(item => item.service_code), [
    'CHUP_IN_4H',
    'QUAY_RECAP_IN_4H',
    'CHUP_IN_4H',
    'QUAY_RECAP_IN_4H',
    'RECAP_5_6_CAM',
  ])
  assert.deepEqual(result.parsed.items.map(item => item.group_label), [
    'Ngày 1',
    'Ngày 1',
    'Ngày 2',
    'Ngày 2',
    'Hạng mục hậu kỳ',
  ])
  assert.deepEqual(result.parsed.items.map(item => item.billable_duration_hours || null), [3, 3, 5, 5, null])
})

test('date-style day markers become separate quote groups', () => {
  const result = deterministicParseQuoteInput(`Ngày 15/07:
2 quay 3 tiếng Hà Nội
ngày 15.07.2026:
2 chụp 5 tiếng Hà Nội`, parseContext)

  assert.equal(result.parsed.num_days, 2)
  assert.deepEqual(result.parsed.items.map(item => item.group_code), [
    'DAY_15_07',
    'DAY_15_07_2026',
    'POST',
  ])
  assert.deepEqual(result.parsed.items.map(item => item.group_label), [
    'Ngày 15/07',
    'Ngày 15.07.2026',
    'Hạng mục hậu kỳ',
  ])
  assert.deepEqual(result.parsed.items.map(item => item.billable_duration_hours || null), [3, 5, null])
})

test('handler uses deterministic parser without provider credentials', async () => {
  const originalAuthDisabled = process.env.EVENTUS_AUTH_DISABLED
  process.env.EVENTUS_AUTH_DISABLED = '1'

  try {
    const response = makeJsonResponse()

    await handler({
      method: 'POST',
      body: {
        input_text: '4 quay',
        context: parseContext,
      },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
    assert.match(response.payload.ai_reasoning, /Đã dùng parser nội bộ/)
  } finally {
    if (originalAuthDisabled === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuthDisabled
  }
})

test('handler never calls external fetch when parsing succeeds', async () => {
  const originalFetch = globalThis.fetch
  const originalAuthDisabled = process.env.EVENTUS_AUTH_DISABLED

  process.env.EVENTUS_AUTH_DISABLED = '1'
  globalThis.fetch = () => {
    throw new Error('External fetch should not be called for quote briefs.')
  }

  try {
    const response = makeJsonResponse()

    await handler({
      method: 'POST',
      body: {
        input_text: '2 chụp 1 quay 5 tiếng Hải Phòng',
        context: parseContext,
      },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), [
      'CHUP_OUT_4H',
      'QUAY_RECAP_OUT_4H',
      'RECAP_1_2_CAM',
    ])
  } finally {
    globalThis.fetch = originalFetch

    if (originalAuthDisabled === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuthDisabled
  }
})

test('handler never calls external fetch when parsing cannot resolve items', async () => {
  const originalFetch = globalThis.fetch
  const originalAuthDisabled = process.env.EVENTUS_AUTH_DISABLED
  let fetchCalled = false

  process.env.EVENTUS_AUTH_DISABLED = '1'
  globalThis.fetch = () => {
    fetchCalled = true
    throw new Error('External fetch should not be called for quote briefs.')
  }

  try {
    const response = makeJsonResponse()

    await handler({
      method: 'POST',
      body: {
        input_text: 'gói media tổng hợp theo brief cũ',
        context: parseContext,
      },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.payload.parsed.items, [])
    assert.deepEqual(response.payload.missing_fields, ['items'])
    assert.equal(fetchCalled, false)
    assert.match(response.payload.ai_reasoning, /Đã dùng parser nội bộ/)
  } finally {
    globalThis.fetch = originalFetch

    if (originalAuthDisabled === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuthDisabled
  }
})
