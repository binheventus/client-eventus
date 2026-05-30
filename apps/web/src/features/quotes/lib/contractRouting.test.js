import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getContractDocumentEditRoute,
  getContractDocumentsRoute,
  getLegacyNewContractRedirect,
  getNewContractDocumentRoute,
  getNewContractRoute,
} from './contractRouting.js'

test('getNewContractRoute returns canonical manual creation route', () => {
  assert.equal(getNewContractRoute({ source: 'manual' }), '/contracts/new/manual')
})

test('getNewContractRoute returns canonical job creation route and preserves prefill query', () => {
  assert.equal(
    getNewContractRoute({ source: 'job', jobId: 'JOB 42', job_title: 'Year End Party' }),
    '/contracts/from-job/JOB%2042?job_title=Year+End+Party',
  )
})

test('getNewContractRoute returns canonical quote creation route', () => {
  assert.equal(
    getNewContractRoute({ source: 'quote', quoteId: 'Q-1' }),
    '/contracts/from-quote/Q-1',
  )
})

test('getNewContractRoute maps lichlamviec legacy source to job route with origin marker', () => {
  const params = new URLSearchParams('source=lichlamviec&job_id=88&job_date=30.05.2026')

  assert.equal(
    getNewContractRoute(params),
    '/contracts/from-job/88?job_date=30.05.2026&origin_source=lichlamviec',
  )
})

test('getLegacyNewContractRedirect redirects complete legacy creation URLs only', () => {
  assert.equal(
    getLegacyNewContractRedirect(new URLSearchParams('source=quote&quoteId=Q1')),
    '/contracts/from-quote/Q1',
  )
  assert.equal(getLegacyNewContractRedirect(new URLSearchParams('source=job')), '')
})

test('contract document route helpers build canonical document URLs', () => {
  assert.equal(
    getContractDocumentsRoute({ id: 'C 1' }),
    '/contracts/C%201/documents',
  )
  assert.equal(
    getNewContractDocumentRoute('C 1', 'payment_request'),
    '/contracts/C%201/documents/new/payment_request',
  )
  assert.equal(
    getContractDocumentEditRoute({ id: 'C 1' }, { id: 'D 9' }),
    '/documents/D%209/edit',
  )
})
