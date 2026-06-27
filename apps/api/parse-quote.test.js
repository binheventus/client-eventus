import assert from 'node:assert/strict'
import test from 'node:test'
import handler, {
  applyBriefBusinessRules,
  clearParseQuoteResultCache,
  detectVatFromBrief,
  deterministicParseQuoteInput,
} from './parse-quote.js'
import { buildSystemPromptBlock } from './lib/claude-quote-parser.js'

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

function makeAiToolResponse(input) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      content: [
        {
          type: 'tool_use',
          id: 'toolu_test',
          name: 'submit_parsed_quote',
          input,
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 200,
        cache_read_input_tokens: 50,
      },
    }),
  }
}

function makeAiInvalidResponse() {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      content: [{ type: 'text', text: 'not a tool call' }],
      usage: { input_tokens: 10, output_tokens: 0 },
    }),
  }
}

async function withMockedAiEnv(fn) {
  const originalAuth = process.env.EVENTUS_AUTH_DISABLED
  const originalKey = process.env.ANTHROPIC_API_KEY
  const originalBase = process.env.ANTHROPIC_BASE_URL
  const originalModel = process.env.QUOTE_PARSE_AI_MODEL
  const originalFetch = globalThis.fetch

  process.env.EVENTUS_AUTH_DISABLED = '1'
  process.env.ANTHROPIC_API_KEY = 'sk-test-key'
  process.env.ANTHROPIC_BASE_URL = 'https://api.coffeevibeai.com'
  process.env.QUOTE_PARSE_AI_MODEL = 'claude-haiku-4-5-20251001'

  clearParseQuoteResultCache()

  try {
    await fn()
  } finally {
    if (originalAuth === undefined) delete process.env.EVENTUS_AUTH_DISABLED
    else process.env.EVENTUS_AUTH_DISABLED = originalAuth
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = originalKey
    if (originalBase === undefined) delete process.env.ANTHROPIC_BASE_URL
    else process.env.ANTHROPIC_BASE_URL = originalBase
    if (originalModel === undefined) delete process.env.QUOTE_PARSE_AI_MODEL
    else process.env.QUOTE_PARSE_AI_MODEL = originalModel
    globalThis.fetch = originalFetch
    clearParseQuoteResultCache()
  }
}

test('mode=ai returns structured response and source=ai', async () => {
  await withMockedAiEnv(async () => {
    let capturedRequest = null
    globalThis.fetch = async (url, init) => {
      capturedRequest = { url: String(url), init }
      return makeAiToolResponse({
        items: [
          { service_code: 'CHUP_OUT_4H', quantity: 2, service_name_raw: 'chụp ảnh', is_custom: false, is_overridden: false, unit_price: 0 },
          { service_code: 'QUAY_RECAP_OUT_4H', quantity: 1, service_name_raw: 'quay', is_custom: false, is_overridden: false, unit_price: 0 },
        ],
        location: 'Hải Phòng',
        duration_hours: 5,
        tier_code: 'TIER_2',
        num_days: 1,
        missing_fields: [],
        ambiguous_fields: [],
        ai_reasoning: 'Test response',
      })
    }

    const response = makeJsonResponse()
    await handler({
      method: 'POST',
      body: { input_text: '2 chụp 1 quay 5 tiếng Hải Phòng', mode: 'ai', context: parseContext },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.source, 'ai')
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), [
      'CHUP_OUT_4H',
      'QUAY_RECAP_OUT_4H',
      'RECAP_1_2_CAM',
    ])
    assert.equal(response.payload.parsed.location, 'Hải Phòng')
    assert.ok(capturedRequest, 'fetch should be called')
    assert.match(capturedRequest.url, /api\.coffeevibeai\.com\/v1\/messages$/)
    assert.equal(capturedRequest.init.headers['x-api-key'], 'sk-test-key')

    const body = JSON.parse(capturedRequest.init.body)
    assert.equal(body.tool_choice.name, 'submit_parsed_quote')
    assert.equal(body.system[0].cache_control.type, 'ephemeral')
  })
})

test('mode=ai without ANTHROPIC_API_KEY falls back to regex with source=ai_fallback', async () => {
  await withMockedAiEnv(async () => {
    delete process.env.ANTHROPIC_API_KEY
    let fetchCalled = false
    globalThis.fetch = async () => {
      fetchCalled = true
      throw new Error('fetch should not be called when key is missing')
    }

    const response = makeJsonResponse()
    await handler({
      method: 'POST',
      body: { input_text: '4 quay', mode: 'ai', context: parseContext },
    }, response)

    assert.equal(fetchCalled, false)
    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.source, 'ai_fallback')
    assert.deepEqual(response.payload.parsed.items.map(item => item.service_code), ['QUAY_RECAP_IN_4H', 'RECAP_3_4_CAM'])
    assert.match(response.payload.ai_reasoning, /Chưa cấu hình ANTHROPIC_API_KEY/)
  })
})

test('mode=ai falls back when fetch rejects', async () => {
  await withMockedAiEnv(async () => {
    globalThis.fetch = async () => { throw new Error('network down') }

    const response = makeJsonResponse()
    await handler({
      method: 'POST',
      body: { input_text: '4 quay', mode: 'ai', context: parseContext },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.source, 'ai_fallback')
    assert.match(response.payload.ai_reasoning, /AI tạm lỗi/)
    assert.match(response.payload.ai_reasoning, /network down/)
  })
})

test('mode=ai retries once on schema mismatch then falls back', async () => {
  await withMockedAiEnv(async () => {
    let calls = 0
    globalThis.fetch = async () => {
      calls += 1
      return makeAiInvalidResponse()
    }

    const response = makeJsonResponse()
    await handler({
      method: 'POST',
      body: { input_text: '4 quay', mode: 'ai', context: parseContext },
    }, response)

    assert.equal(calls, 2, 'should retry once on schema mismatch')
    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.source, 'ai_fallback')
    assert.match(response.payload.ai_reasoning, /AI tạm lỗi/)
  })
})

test('mode=ai preserves is_overridden + unit_price through business rules', async () => {
  await withMockedAiEnv(async () => {
    globalThis.fetch = async () => makeAiToolResponse({
      items: [
        {
          service_code: 'CHUP_IN_4H',
          quantity: 2,
          service_name_raw: 'chụp ảnh',
          is_custom: false,
          is_overridden: true,
          unit_price: 1800000,
          override_reason: 'Đã chốt với khách: 1tr8/người',
        },
      ],
      location: 'Hà Nội',
      duration_hours: 4,
      tier_code: 'TIER_3',
      num_days: 1,
      missing_fields: [],
      ambiguous_fields: [],
      ai_reasoning: 'Override test',
    })

    const response = makeJsonResponse()
    await handler({
      method: 'POST',
      body: { input_text: '2 chụp 1tr8/người 4 tiếng nội thành khách quen', mode: 'ai', context: parseContext },
    }, response)

    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.source, 'ai')
    const overriddenItem = response.payload.parsed.items.find(item => item.service_code === 'CHUP_IN_4H')
    assert.ok(overriddenItem, 'CHUP_IN_4H item should exist')
    assert.equal(overriddenItem.is_overridden, true)
    assert.equal(overriddenItem.unit_price, 1800000)
    assert.match(overriddenItem.override_reason, /1tr8/)
  })
})

test('GET /api/parse-quote?probe=1 reflects ANTHROPIC_API_KEY presence', async () => {
  await withMockedAiEnv(async () => {
    let response = makeJsonResponse()
    await handler({ method: 'GET', url: '/api/parse-quote?probe=1', query: { probe: '1' } }, response)
    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.ai_available, true)
    assert.equal(response.payload.model, 'claude-haiku-4-5-20251001')

    delete process.env.ANTHROPIC_API_KEY
    response = makeJsonResponse()
    await handler({ method: 'GET', url: '/api/parse-quote?probe=1', query: { probe: '1' } }, response)
    assert.equal(response.statusCode, 200)
    assert.equal(response.payload.ai_available, false)
    assert.equal(response.payload.model, null)
  })
})

test('buildSystemPromptBlock merges custom examples vào EXAMPLES section', () => {
  const customExamples = [
    {
      name: 'mc-ngoai-khung',
      input_text: 'Khách báo có 1 MC, riêng 5tr',
      expected_output: {
        items: [
          { service_code: 'CUSTOM', quantity: 1, service_name: 'MC', is_custom: true, unit_price: 5000000 },
        ],
        location: 'Hà Nội',
        duration_hours: 4,
        tier_code: 'TIER_2',
      },
      sort_order: 50,
    },
  ]
  const prompt = buildSystemPromptBlock({ services: [{ service_code: 'CHUP_IN_4H', service_name: 'Chụp 4h', price_tier_2: 1000000 }] }, customExamples)

  assert.match(prompt, /EXAMPLES/i)
  assert.match(prompt, /mc-ngoai-khung/)
  assert.match(prompt, /Khách báo có 1 MC/)
  assert.match(prompt, /5000000/)
})

test('buildSystemPromptBlock cap số example tối đa MAX_EXAMPLES (20)', () => {
  const customExamples = Array.from({ length: 30 }, (_, index) => ({
    name: `custom-${index}`,
    input_text: `brief ${index}`,
    expected_output: {
      items: [{ service_code: 'CHUP_IN_4H', quantity: 1 }],
      location: 'Hà Nội',
      duration_hours: 4,
      tier_code: 'TIER_2',
    },
    sort_order: 1000 + index,
  }))
  const prompt = buildSystemPromptBlock({ services: [] }, customExamples)
  const matches = prompt.match(/### Ví dụ \[\d+\]/g) || []
  assert.ok(matches.length <= 20, `expected ≤ 20 example blocks, got ${matches.length}`)
})

test('buildSystemPromptBlock luôn dành slot cho custom dù sort_order lớn', () => {
  // Custom đặt sort_order rất lớn (mặc định modal = 500) vẫn phải vào prompt,
  // không bị 10 ví dụ nền chiếm hết cap rồi cắt mất.
  const customExamples = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    name: `recent-${index}`,
    input_text: `brief moi ${index}`,
    expected_output: {
      items: [{ service_code: 'CHUP_IN_4H', quantity: 1 }],
      location: 'Hà Nội',
      duration_hours: 4,
      tier_code: 'TIER_2',
    },
    sort_order: 500,
  }))
  const prompt = buildSystemPromptBlock({ services: [] }, customExamples)
  for (let index = 0; index < 6; index += 1) {
    assert.match(prompt, new RegExp(`recent-${index}`), `custom recent-${index} phải có trong prompt`)
  }
})

test('buildSystemPromptBlock đặt custom example sau cùng (gần input nhất)', () => {
  const customExamples = [
    {
      id: 99,
      name: 'sua-tay-moi-nhat',
      input_text: 'brief vua sua tay',
      expected_output: {
        items: [{ service_code: 'CHUP_IN_4H', quantity: 2 }],
        location: 'Hà Nội',
        duration_hours: 4,
        tier_code: 'TIER_2',
      },
      sort_order: 500,
    },
  ]
  const prompt = buildSystemPromptBlock({ services: [] }, customExamples)
  const blocks = prompt.match(/### Ví dụ \[\d+\] [^\n]+/g) || []
  assert.ok(blocks.length > 1, 'cần có cả foundational lẫn custom')
  assert.match(blocks[blocks.length - 1], /sua-tay-moi-nhat/, 'custom phải đứng cuối danh sách example')
})

test('buildSystemPromptBlock dạy AI ưu tiên EXAMPLES hơn luật biên dịch', () => {
  const prompt = buildSystemPromptBlock({ services: [] }, [])
  assert.match(prompt, /ƯU TIÊN VÍ DỤ/i)
  assert.match(prompt, /ưu tiên CAO HƠN luật biên dịch/i)
})

test('buildSystemPromptBlock bỏ qua custom example có expected_output không hợp lệ', () => {
  const customExamples = [
    {
      name: 'broken',
      input_text: 'something',
      expected_output: 'not-a-json-string',
      sort_order: 10,
    },
  ]
  const prompt = buildSystemPromptBlock({ services: [] }, customExamples)
  assert.doesNotMatch(prompt, /broken/)
})

test('detectVatFromBrief: brief im lặng → cả 2 cờ null', () => {
  const result = detectVatFromBrief('2 chụp 4 tiếng Hà Nội')
  assert.equal(result.has_vat, null)
  assert.equal(result.prices_include_vat, null)
})

test('detectVatFromBrief: "đã gồm VAT" → has_vat=true, prices_include_vat=true', () => {
  const result = detectVatFromBrief('Vingroup, all-in 22tr đã gồm VAT')
  assert.equal(result.has_vat, true)
  assert.equal(result.prices_include_vat, true)
})

test('detectVatFromBrief: "đã bao gồm VAT" → prices_include_vat=true', () => {
  const result = detectVatFromBrief('Giá 5tr đã bao gồm VAT')
  assert.equal(result.has_vat, true)
  assert.equal(result.prices_include_vat, true)
})

test('detectVatFromBrief: "chưa gồm VAT" → has_vat=true, prices_include_vat=false', () => {
  const result = detectVatFromBrief('Báo giá 2tr chưa gồm VAT')
  assert.equal(result.has_vat, true)
  assert.equal(result.prices_include_vat, false)
})

test('detectVatFromBrief: "+VAT" → has_vat=true, prices_include_vat=false', () => {
  const result = detectVatFromBrief('Giá 2tr +VAT 8%')
  assert.equal(result.has_vat, true)
  assert.equal(result.prices_include_vat, false)
})

test('detectVatFromBrief: "không xuất VAT" → has_vat=false', () => {
  const result = detectVatFromBrief('Khách không xuất VAT, giá 2tr')
  assert.equal(result.has_vat, false)
  assert.equal(result.prices_include_vat, null)
})

test('detectVatFromBrief: "xuất VAT" chung chung → has_vat=true, prices_include_vat=null', () => {
  const result = detectVatFromBrief('2 chụp 4 tiếng, có xuất VAT')
  assert.equal(result.has_vat, true)
  assert.equal(result.prices_include_vat, null)
})

test('deterministicParseQuoteInput truyền cờ VAT về kết quả parsed', () => {
  const result = deterministicParseQuoteInput('2 chụp 4 tiếng Hà Nội, đã gồm VAT', parseContext)
  assert.equal(result.parsed.has_vat, true)
  assert.equal(result.parsed.prices_include_vat, true)
})

