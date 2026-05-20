import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyLocalQuoteFilters,
  applyRemoteQuoteFilters,
  buildQuoteApiPath,
  getLocalQuoteSearchText,
} from './quoteQueryFilters.js'

function makeQueryRecorder() {
  const calls = []
  const query = {
    calls,
    or(value) {
      calls.push(['or', value])
      return this
    },
    gte(column, value) {
      calls.push(['gte', column, value])
      return this
    },
    lte(column, value) {
      calls.push(['lte', column, value])
      return this
    },
    in(column, value) {
      calls.push(['in', column, value])
      return this
    },
    eq(column, value) {
      calls.push(['eq', column, value])
      return this
    },
  }

  return query
}

test('applyRemoteQuoteFilters maps supported filters to the existing query operators', () => {
  const query = makeQueryRecorder()
  applyRemoteQuoteFilters(query, {
    search: 'EVT',
    date_from: '2026-05-01',
    date_to: '2026-05-19',
    status: 'sent',
    entity_code: ['EVENTUS', 'MEDIAMONSTER'],
  })

  assert.deepEqual(query.calls, [
    ['or', 'quote_number.ilike.%EVT%,client_name.ilike.%EVT%,event_name.ilike.%EVT%'],
    ['gte', 'created_at', '2026-05-01'],
    ['lte', 'created_at', '2026-05-19'],
    ['eq', 'status', 'sent'],
    ['in', 'entity_code', ['EVENTUS', 'MEDIAMONSTER']],
  ])
})

test('applyLocalQuoteFilters preserves active quote filtering semantics', () => {
  const quotes = [
    { id: '1', quote_number: 'BG-0001', client_name: 'Alpha', event_name: 'Kickoff', status: 'sent', created_at: '2026-05-10' },
    { id: '2', quote_number: 'BG-0002', client_name: 'Beta', event_name: 'Summit', status: 'draft', created_at: '2026-05-12' },
    { id: '3', quote_number: 'BG-0003', client_name: 'Alpha', event_name: 'Deleted', status: 'sent', created_at: '2026-05-12', deleted_at: '2026-05-13' },
  ]

  assert.deepEqual(
    applyLocalQuoteFilters(quotes, { search: 'alpha', status: 'sent', date_from: '2026-05-01', date_to: '2026-05-19' }).map(quote => quote.id),
    ['1'],
  )
})

test('buildQuoteApiPath keeps current query-string behavior', () => {
  assert.equal(
    buildQuoteApiPath({
      filters: { search: 'Alpha', status: 'sent', entity_code: ['EVENTUS', 'MEDIAMONSTER'], tier_code: '' },
      page: 2,
      pageSize: 20,
    }),
    '?search=Alpha&status=sent&entity_code=EVENTUS%2CMEDIAMONSTER&page=2&pageSize=20',
  )
})

test('getLocalQuoteSearchText indexes quote number, client name, and event name', () => {
  assert.equal(getLocalQuoteSearchText({ quote_number: 'BG-1', client_name: 'Client', event_name: 'Event' }), 'bg-1 client event')
})
