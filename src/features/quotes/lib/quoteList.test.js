import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAccessibleQuoteFilters,
  canCreateContractFromQuote,
  canOpenContractFromQuote,
  getAutoLoadFilterKey,
  getQuoteClientName,
  getQuoteStatusLabel,
  getQuoteStatusTone,
  hasSavedContract,
  getTotalQuotePages,
} from './quoteList.js'

test('buildAccessibleQuoteFilters scopes sales users to their own quotes', () => {
  assert.deepEqual(
    buildAccessibleQuoteFilters({ status: 'sent' }, { role: 'sales', userId: 'user-1' }),
    { status: 'sent', created_by: 'user-1' },
  )
})

test('buildAccessibleQuoteFilters keeps admin filters unchanged', () => {
  assert.deepEqual(
    buildAccessibleQuoteFilters({ status: 'sent' }, { role: 'admin', userId: 'user-1' }),
    { status: 'sent' },
  )
})

test('contract creation is blocked for draft, deleted, or missing quotes', () => {
  assert.equal(canCreateContractFromQuote({ id: 'q1', status: 'sent' }), true)
  assert.equal(canCreateContractFromQuote({ id: 'q1', status: 'draft' }), false)
  assert.equal(canCreateContractFromQuote({ id: 'q1', status: 'sent', deleted_at: '2026-05-19' }), false)
  assert.equal(canCreateContractFromQuote({ status: 'sent' }), false)
})

test('saved contracts can be opened even when creation would be blocked', () => {
  assert.equal(hasSavedContract({ contract_id: 'c1' }), true)
  assert.equal(hasSavedContract({ has_saved_contract: true }), true)
  assert.equal(canOpenContractFromQuote({ id: 'q1', status: 'draft', contract_id: 'c1' }), true)
  assert.equal(canOpenContractFromQuote({ id: 'q1', status: 'draft' }), false)
})

test('quote list helpers keep current fallback labels and pagination behavior', () => {
  assert.equal(getQuoteClientName({ client: { name: 'Client A' } }), 'Client A')
  assert.equal(getQuoteClientName({}), '-')
  assert.equal(getQuoteStatusLabel(''), 'draft')
  assert.equal(getQuoteStatusTone('unknown'), 'bg-slate-100 text-slate-700')
  assert.equal(getTotalQuotePages(0, 20), 1)
  assert.equal(getTotalQuotePages(41, 20), 3)
})

test('auto-load filter key intentionally ignores search text', () => {
  const withoutSearch = getAutoLoadFilterKey({ search: 'abc', status: 'sent' })
  const withDifferentSearch = getAutoLoadFilterKey({ search: 'xyz', status: 'sent' })
  assert.equal(withoutSearch, withDifferentSearch)
})
