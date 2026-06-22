import assert from 'node:assert/strict'
import test from 'node:test'
import { __pricingAdminTestInternals } from './pricing-admin.js'

const { normalizeExpectedOutput } = __pricingAdminTestInternals

test('normalizeExpectedOutput chấp nhận JSON object string', () => {
  const value = '{"items":[{"service_code":"CHUP_IN_4H","quantity":2}]}'
  const result = normalizeExpectedOutput(value)
  const parsed = JSON.parse(result)
  assert.equal(parsed.items[0].service_code, 'CHUP_IN_4H')
})

test('normalizeExpectedOutput chấp nhận object trực tiếp và serialize lại', () => {
  const result = normalizeExpectedOutput({ items: [], location: 'Hà Nội' })
  const parsed = JSON.parse(result)
  assert.equal(parsed.location, 'Hà Nội')
})

test('normalizeExpectedOutput từ chối JSON sai cú pháp với mã VALIDATION_ERROR', () => {
  assert.throws(
    () => normalizeExpectedOutput('{invalid json'),
    error => error?.statusCode === 400 && error?.code === 'VALIDATION_ERROR' && /JSON hợp lệ/.test(error.message),
  )
})

test('normalizeExpectedOutput từ chối giá trị rỗng', () => {
  assert.throws(
    () => normalizeExpectedOutput(''),
    error => error?.statusCode === 400 && error?.code === 'VALIDATION_ERROR',
  )
  assert.throws(
    () => normalizeExpectedOutput(null),
    error => error?.statusCode === 400 && error?.code === 'VALIDATION_ERROR',
  )
})

test('normalizeExpectedOutput từ chối primitive (string không phải JSON object)', () => {
  // JSON.parse("123") → 123 — số không phải object/array
  assert.throws(
    () => normalizeExpectedOutput('"chỉ là một string"'),
    error => error?.statusCode === 400 && error?.code === 'VALIDATION_ERROR',
  )
  assert.throws(
    () => normalizeExpectedOutput('123'),
    error => error?.statusCode === 400 && error?.code === 'VALIDATION_ERROR',
  )
})
