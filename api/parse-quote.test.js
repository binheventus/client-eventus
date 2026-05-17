import assert from 'node:assert/strict'
import test from 'node:test'
import { applyBriefBusinessRules, deterministicParseQuoteInput } from './parse-quote.js'

const recapServices = [
  { service_code: 'QUAY_RECAP_IN_4H' },
  { service_code: 'RECAP_1_2_CAM' },
  { service_code: 'RECAP_3_4_CAM' },
  { service_code: 'RECAP_5_6_CAM' },
  { service_code: 'RECAP_7_CAM' },
]

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
