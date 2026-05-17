import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeQuoteValidityDays } from './quoteValidity.js'

test('normalizes numeric quote validity values', () => {
  assert.equal(normalizeQuoteValidityDays(7), 7)
  assert.equal(normalizeQuoteValidityDays('15'), 15)
  assert.equal(normalizeQuoteValidityDays('30 days'), 30)
})

test('normalizes legacy enum-like quote validity values', () => {
  assert.equal(normalizeQuoteValidityDays('VALID_7_DAYS'), 7)
  assert.equal(normalizeQuoteValidityDays('fifteen_days'), 15)
  assert.equal(normalizeQuoteValidityDays('one_week'), 7)
  assert.equal(normalizeQuoteValidityDays('one_month'), 30)
})

test('falls back to default validity when value is unknown', () => {
  assert.equal(normalizeQuoteValidityDays(null), 15)
  assert.equal(normalizeQuoteValidityDays('custom'), 15)
  assert.equal(normalizeQuoteValidityDays('custom', 30), 30)
})
