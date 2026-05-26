import assert from 'node:assert/strict'
import test from 'node:test'
import handler, { applyBriefBusinessRules, deterministicParseQuoteInput } from './parse-quote.js'

const recapServices = [
  { service_code: 'QUAY_RECAP_IN_4H' },
  { service_code: 'RECAP_1_2_CAM' },
  { service_code: 'RECAP_3_4_CAM' },
  { service_code: 'RECAP_5_6_CAM' },
  { service_code: 'RECAP_7_CAM' },
]

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
  const result = deterministicParseQuoteInput('4 quay', { services: recapServices })
  const codes = result.parsed.items.map(item => item.service_code)

  assert.deepEqual(codes, ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
  assert.equal(result.parsed.items[0].quantity, 4)
})

test('business rules replace an AI-provided wrong recap edit bracket', () => {
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
  }, '4 quay', { services: recapServices })

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
})

test('explicit no-edit brief does not add default recap edit', () => {
  const result = deterministicParseQuoteInput('4 quay không dựng', { services: recapServices })

  assert.deepEqual(result.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H'])
})

test('seven or more cameras use the highest recap edit bracket', () => {
  const result = deterministicParseQuoteInput('9 quay', { services: recapServices })

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

test('multi-day briefs keep shooting items grouped by day and post-production separate', () => {
  const result = deterministicParseQuoteInput(`Ngày 1:
2 quay 2 chụp 3 tiếng Hà Nội
Ngày 2:
2 quay 2 chụp 5 tiếng Hà Nội`, { services: recapServices })

  assert.equal(result.parsed.num_days, 2)
  assert.equal(result.parsed.duration_hours, 5)
  assert.deepEqual(result.parsed.items.map(item => item.service_code), [
    'CHUP_IN_4H',
    'QUAY_RECAP_IN_4H',
    'CHUP_IN_4H',
    'QUAY_RECAP_IN_4H',
    'RECAP_3_4_CAM',
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
2 chụp 5 tiếng Hà Nội`, { services: recapServices })

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

test('handler falls back to deterministic parser when AI keys are missing', async () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY
  const originalAuthDisabled = process.env.EVENTUS_AUTH_DISABLED
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  process.env.EVENTUS_AUTH_DISABLED = '1'

  try {
    const response = makeJsonResponse()

    await handler({
      method: 'POST',
      body: {
        input_text: '4 quay',
        context: { services: recapServices },
      },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
    assert.match(response.payload.ai_reasoning, /Thiếu OPENAI_API_KEY hoặc ANTHROPIC_API_KEY/)
  } finally {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAiKey

    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey

    if (originalAuthDisabled === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuthDisabled
  }
})

test('handler falls back quickly when AI provider times out', async () => {
  const originalFetch = globalThis.fetch
  const originalOpenAiKey = process.env.OPENAI_API_KEY
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY
  const originalAuthDisabled = process.env.EVENTUS_AUTH_DISABLED
  const originalTimeout = process.env.QUOTE_PARSE_TIMEOUT_MS
  const originalModel = process.env.QUOTE_PARSE_MODEL

  process.env.OPENAI_API_KEY = 'test-openai-key'
  delete process.env.ANTHROPIC_API_KEY
  process.env.EVENTUS_AUTH_DISABLED = '1'
  process.env.QUOTE_PARSE_TIMEOUT_MS = '5'
  process.env.QUOTE_PARSE_MODEL = 'gpt-test'
  globalThis.fetch = (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => {
      const error = new Error('Aborted')
      error.name = 'AbortError'
      reject(error)
    })
  })

  try {
    const response = makeJsonResponse()

    await handler({
      method: 'POST',
      body: {
        input_text: '4 quay',
        context: { services: recapServices },
      },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
    assert.match(response.payload.ai_reasoning, /quá thời gian phản hồi/)
  } finally {
    globalThis.fetch = originalFetch

    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalOpenAiKey

    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey

    if (originalAuthDisabled === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuthDisabled

    if (originalTimeout === undefined) delete process.env.QUOTE_PARSE_TIMEOUT_MS
    else process.env.QUOTE_PARSE_TIMEOUT_MS = originalTimeout

    if (originalModel === undefined) delete process.env.QUOTE_PARSE_MODEL
    else process.env.QUOTE_PARSE_MODEL = originalModel
  }
})
