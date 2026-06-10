import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildContractValueRows,
  calculateAdvanceAmount,
  calculateAdvanceDocumentsTotal,
  calculateAdvancePercent,
  calculatePaymentSummary,
  calculateTableTotals,
  getContractAdvanceDocumentLinks,
  getContractDocumentCustomerCode,
  getCustomerValidationWarnings,
  getContractTotal,
  getContractVatConfig,
  formatContractDocumentNumberForDisplay,
  renderContractDocumentNumber,
  summarizeContractAdvanceDocuments,
} from './contractDocumentEditor.js'

test('renderContractDocumentNumber updates seller token while preserving allocated sequence', () => {
  const contract = {
    customer_snapshot: {
      customer_code: 'ACME',
    },
  }

  assert.equal(
    renderContractDocumentNumber('{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}', {
      sequence: '0007',
      document_type: 'payment_request',
      document_type_code: 'DNTT',
      seller: 'MEDIAMONSTER',
      customer: getContractDocumentCustomerCode(contract),
      year: '2026',
    }),
    '0007/DNTT-MMT/ACME/2026',
  )
})

test('renderContractDocumentNumber uses EVT for Eventus seller code', () => {
  assert.equal(
    renderContractDocumentNumber('{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}', {
      sequence: '0002',
      document_type_code: 'DNTU',
      seller: 'EVENTUS',
      customer: 'C.S.Q',
      year: '2026',
    }),
    '0002/DNTU-EVT/C.S.Q/2026',
  )

  assert.equal(
    formatContractDocumentNumberForDisplay('0002/DNTU-EVENTUS/C.S.Q/2026'),
    '0002/DNTU-EVT/C.S.Q/2026',
  )
})

test('buildContractValueRows uses contract quote rows as pre-VAT values', () => {
  const contract = {
    quote_snapshot: {
      has_vat: true,
      subtotal: 10_000_000,
      vat_amount: 800_000,
      total_amount: 10_800_000,
      items: [
        { service_code: 'PHOTO', service_name: 'Chụp ảnh sự kiện', unit: 'Buổi', quantity: 2, unit_price: 3_000_000, total_price: 6_000_000 },
        { service_code: 'VIDEO', service_name: 'Quay phim sự kiện', unit: 'Buổi', quantity: 1, unit_price: 4_000_000, total_price: 4_000_000 },
      ],
    },
  }

  const rows = buildContractValueRows(contract)
  const totals = calculateTableTotals(rows, getContractVatConfig(contract))

  assert.equal(rows.length, 2)
  assert.equal(totals.subtotal, 10_000_000)
  assert.equal(totals.vat_amount, 800_000)
  assert.equal(totals.total_amount, 10_800_000)
  assert.equal(getContractTotal(contract), 10_800_000)
})

test('calculateTableTotals supports negative acceptance adjustment rows', () => {
  const totals = calculateTableTotals([
    { amount: 10_000_000 },
    { amount: -1_000_000 },
  ], { has_vat: true, vat_rate: 0.08 })

  assert.equal(totals.subtotal, 9_000_000)
  assert.equal(totals.vat_amount, 720_000)
  assert.equal(totals.total_amount, 9_720_000)
})

test('acceptance total includes negative actual rows before VAT', () => {
  const totals = calculateTableTotals([
    { description: 'Gia tri hop dong', amount: 20_000_000 },
    { description: 'Giam tru phat sinh', amount: -2_500_000 },
    { description: 'Bo sung phat sinh', amount: 1_000_000 },
  ], { has_vat: true, vat_rate: 0.08 })

  assert.equal(totals.subtotal, 18_500_000)
  assert.equal(totals.vat_amount, 1_480_000)
  assert.equal(totals.total_amount, 19_980_000)
})

test('advance helpers round amount and reverse percent', () => {
  assert.equal(calculateAdvanceAmount(10_800_000, 30), 3_240_000)
  assert.equal(calculateAdvancePercent(10_800_000, 3_240_000), 30)
})

test('advance document helpers collect and total related advance requests', () => {
  const documents = [
    {
      id: 'advance-1',
      document_type: 'advance_request',
      document_number: '0001/DNTU-EVT/ACME/2026',
      issued_date: '2026-06-01',
      document_data: {
        amount_config: {
          advance_amount: 3_240_000,
        },
      },
    },
    {
      id: 'acceptance-1',
      document_type: 'acceptance_liquidation',
      document_data: {
        amount_config: {
          acceptance_amount: 10_800_000,
        },
      },
    },
    {
      id: 'advance-2',
      document_type: 'advance_request',
      document_number: '0002/DNTU-EVT/ACME/2026',
      document_data: {
        advance_amount: 1_000_000,
      },
    },
  ]

  const links = getContractAdvanceDocumentLinks(documents, 'acceptance-1')
  const summary = summarizeContractAdvanceDocuments(documents, 'acceptance-1')

  assert.deepEqual(links.map(document => document.document_id), ['advance-1', 'advance-2'])
  assert.equal(calculateAdvanceDocumentsTotal(links), 4_240_000)
  assert.equal(summary.advance_paid, 4_240_000)
})

test('advance document helpers exclude unpaid requests from acceptance totals', () => {
  const documents = [
    {
      id: 'advance-1',
      document_type: 'advance_request',
      document_number: '0001/DNTU-EVT/ACME/2026',
      document_data: {
        amount_config: {
          advance_amount: 3_240_000,
        },
      },
    },
    {
      id: 'advance-2',
      document_type: 'advance_request',
      document_number: '0002/DNTU-EVT/ACME/2026',
      document_data: {
        amount_config: {
          advance_amount: 1_000_000,
        },
      },
    },
  ]

  const links = getContractAdvanceDocumentLinks(documents, 'acceptance-1', ['advance-2'])
  const summary = summarizeContractAdvanceDocuments(documents, 'acceptance-1', ['advance-2'])

  assert.deepEqual(links.map(document => document.document_id), ['advance-1'])
  assert.equal(calculateAdvanceDocumentsTotal(links), 3_240_000)
  assert.equal(summary.advance_paid, 3_240_000)
})

test('calculatePaymentSummary deducts only selected advance requests', () => {
  const selectedDeductions = [
    { document_id: 'advance-1', deduction_amount: 3_000_000 },
    { document_id: 'advance-3', deduction_amount: 2_500_000 },
  ]
  const summary = calculatePaymentSummary(12_000_000, selectedDeductions)

  assert.equal(summary.acceptance_total, 12_000_000)
  assert.equal(summary.advance_deduction_total, 5_500_000)
  assert.equal(summary.remaining_amount, 6_500_000)
  assert.equal(summary.payment_amount, 6_500_000)
})

test('calculatePaymentSummary keeps over-deduction visible while payable amount is zero', () => {
  const summary = calculatePaymentSummary(5_000_000, [
    { deduction_amount: 4_000_000 },
    { deduction_amount: 2_000_000 },
  ])

  assert.equal(summary.advance_deduction_total, 6_000_000)
  assert.equal(summary.remaining_amount, -1_000_000)
  assert.equal(summary.payment_amount, 0)
  assert.equal(summary.over_deduction_amount, 1_000_000)
})

test('getCustomerValidationWarnings reports missing export-critical customer fields', () => {
  const warnings = getCustomerValidationWarnings({
    customer_snapshot: {
      company_name: 'Công ty Test',
      tax_code: '',
      address: 'Hà Nội',
      representative: '',
    },
  })

  assert.deepEqual(warnings, ['MST khách hàng', 'Người đại diện khách hàng'])
})
