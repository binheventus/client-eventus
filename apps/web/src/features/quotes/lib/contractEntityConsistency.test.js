import assert from 'node:assert/strict'
import test from 'node:test'
import legalEntities from '../../../data/pricing/legal_entities.json' with { type: 'json' }
import { getContractEntityMismatchWarning } from './contractEntityConsistency.js'

test('entity consistency ignores a missing contract while the page is loading', () => {
  const warning = getContractEntityMismatchWarning({
    contract: null,
    documents: [{
      id: 'payment-1',
      document_type: 'payment_request',
      seller_entity_code: 'EVENTUS',
    }],
    legalEntities,
  })

  assert.equal(warning, null)
})

test('entity consistency warning lists documents that differ from the contract', () => {
  const warning = getContractEntityMismatchWarning({
    contract: { seller_entity_code: 'EVENTUS' },
    documents: [
      {
        id: 'advance-1',
        document_type: 'advance_request',
        document_number: '0001/DNTU-EVENTUS/ACME/2026',
        seller_entity_code: 'EVENTUS',
      },
      {
        id: 'acceptance-1',
        document_type: 'acceptance_liquidation',
        document_number: '0001/BBNTTL-MEDIAMONSTER/ACME/2026',
        seller_entity_code: 'MEDIAMONSTER',
      },
    ],
    legalEntities,
  })

  assert.equal(warning.title, 'Cảnh báo pháp nhân không đồng nhất')
  assert.deepEqual(warning.items, [
    'BBNT kiêm thanh lý 0001/BBNTTL-MEDIAMONSTER/ACME/2026 đang dùng pháp nhân Mediamonster',
  ])
})

test('entity consistency warning includes a linked quote that differs from the contract', () => {
  const warning = getContractEntityMismatchWarning({
    contract: {
      quote_id: 'quote-1',
      seller_entity_code: 'EVENTUS',
    },
    quote: {
      id: 'quote-1',
      quote_number: 'BG-2026-001',
      entity_code: 'MEDIAMONSTER',
    },
    documents: [{
      id: 'payment-1',
      document_type: 'payment_request',
      seller_entity_code: 'EVENTUS',
    }],
    legalEntities,
  })

  assert.deepEqual(warning.items, [
    'Báo giá BG-2026-001 đang dùng pháp nhân Mediamonster',
  ])
})

test('entity consistency ignores quote snapshots when the contract has no linked quote', () => {
  const warning = getContractEntityMismatchWarning({
    contract: {
      quote_id: null,
      source_type: 'job',
      seller_entity_code: 'MEDIAMONSTER',
    },
    quote: {
      id: '',
      entity_code: 'EVENTUS',
    },
    legalEntities,
  })

  assert.equal(warning, null)
})

test('entity consistency treats quote and contract entity aliases as the same legal entity', () => {
  const warning = getContractEntityMismatchWarning({
    contract: { seller_entity_code: 'EVENTUS' },
    quote: {
      id: 'quote-1',
      entity_code: 'EVT',
    },
    legalEntities,
  })

  assert.equal(warning, null)
})

test('entity consistency treats source entity aliases as the same legal entity', () => {
  const warning = getContractEntityMismatchWarning({
    contract: { seller_entity_code: 'EVENTUS' },
    documents: [{
      id: 'payment-1',
      document_type: 'payment_request',
      seller_entity_code: 'EVT',
    }],
    legalEntities,
  })

  assert.equal(warning, null)
})

test('current edited document replaces its saved version in the warning', () => {
  const warning = getContractEntityMismatchWarning({
    contract: { seller_entity_code: 'EVENTUS' },
    documents: [{
      id: 'payment-1',
      document_type: 'payment_request',
      document_number: '0001/DNTT-EVENTUS/ACME/2026',
      seller_entity_code: 'EVENTUS',
    }],
    currentDocument: {
      id: 'payment-1',
      document_type: 'payment_request',
      document_number: '0001/DNTT-MEDIAMONSTER/ACME/2026',
      seller_entity_code: 'MEDIAMONSTER',
    },
    legalEntities,
  })

  assert.deepEqual(warning.items, [
    'Đề nghị thanh toán 0001/DNTT-MEDIAMONSTER/ACME/2026 đang dùng pháp nhân Mediamonster',
  ])
})
