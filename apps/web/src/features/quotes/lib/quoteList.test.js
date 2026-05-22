import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAccessibleQuoteFilters,
  canCreateContractFromQuote,
  canOpenContractFromQuote,
  getAutoLoadFilterKey,
  getQuoteClientName,
  getQuoteCreatorName,
  getQuoteStatusLabel,
  getQuoteStatusTone,
  hasSavedContract,
  getTotalQuotePages,
} from './quoteList.js'

test('buildAccessibleQuoteFilters keeps sales filters unchanged', () => {
  assert.deepEqual(
    buildAccessibleQuoteFilters({ status: 'sent' }, { role: 'sales', userId: 'user-1' }),
    { status: 'sent' },
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
  assert.equal(getQuoteCreatorName({ created_by_name: 'Binh' }, { role: 'admin', name: 'Logged In' }), 'Binh')
  assert.equal(getQuoteCreatorName({ created_by_name: 'Sales Eventus' }, { role: 'sales', name: 'Logged In' }), 'Sales Eventus')
  assert.equal(getQuoteCreatorName({}, { name: 'Logged In' }), 'Logged In')
  assert.equal(getQuoteStatusLabel(''), 'Nháp')
  assert.equal(getQuoteStatusLabel('sent'), 'Đã lấy link gửi khách')
  assert.equal(getQuoteStatusTone('unknown'), 'bg-slate-100 text-slate-500')
  assert.equal(getTotalQuotePages(0, 20), 1)
  assert.equal(getTotalQuotePages(41, 20), 3)
})

test('auto-load filter key intentionally ignores search text', () => {
  const withoutSearch = getAutoLoadFilterKey({ search: 'abc', status: 'sent' })
  const withDifferentSearch = getAutoLoadFilterKey({ search: 'xyz', status: 'sent' })
  assert.equal(withoutSearch, withDifferentSearch)
})
