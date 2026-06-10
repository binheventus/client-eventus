import { normalizeDocumentSellerCode } from './entityCodes.js'

export const DEFAULT_DOCUMENT_VAT_RATE = 0.08

export function toDocumentNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function roundDocumentCurrency(value) {
  return Math.round(toDocumentNumber(value, 0))
}

export function getDocumentNumberSellerCode(value = '') {
  return normalizeDocumentSellerCode(value)
}

export function formatContractDocumentNumberForDisplay(value = '') {
  return String(value || '')
    .replace(/(^|-)(?:EVENTUS)(?=\/|$)/gi, '$1EVT')
    .replace(/(^|[-/])(?:MEDIAMONSTER|MEDIA_MONSTER)(?=\/|$)/gi, '$1MMT')
    .replace(/(-)MMS(?=\/|$)/gi, '$1MMT')
}

export function getContractDocumentCustomerCode(contract = {}) {
  return String(
    contract.customer_snapshot?.customer_code
      || contract.customer_snapshot?.company_name
      || contract.quote_snapshot?.client_name
      || 'CUSTOMER',
  ).trim().replace(/\s+/g, '-').toUpperCase().slice(0, 48)
}

export function renderContractDocumentNumber(pattern, values = {}) {
  const seller = getDocumentNumberSellerCode(values.seller)
  return String(pattern || '')
    .replace(/\{\{\s*sequence\s*\}\}/gi, String(values.sequence || ''))
    .replace(/\{\{\s*document_type\s*\}\}/gi, String(values.document_type || ''))
    .replace(/\{\{\s*document_type_code\s*\}\}/gi, String(values.document_type_code || ''))
    .replace(/\{\{\s*seller\s*\}\}/gi, seller)
    .replace(/\{\{\s*seller_entity_code\s*\}\}/gi, seller)
    .replace(/\{\{\s*customer\s*\}\}/gi, String(values.customer || ''))
    .replace(/\{\{\s*year\s*\}\}/gi, String(values.year || ''))
}

export function getContractVatConfig(contract = {}) {
  const quote = contract.quote_snapshot || {}
  const vatRate = toDocumentNumber(quote.vat_rate ?? contract.quote_table_config?.vat_rate, DEFAULT_DOCUMENT_VAT_RATE)
  const hasVat = quote.has_vat !== false
  const vatMode = quote.vat_mode || (hasVat ? 'included' : 'excluded')

  return {
    has_vat: hasVat,
    vat_rate: vatRate > 0 ? vatRate : DEFAULT_DOCUMENT_VAT_RATE,
    vat_mode: vatMode,
  }
}

export function getContractSubtotal(contract = {}) {
  const quote = contract.quote_snapshot || {}
  const itemSubtotal = Array.isArray(quote.items)
    ? quote.items.reduce((sum, item) => sum + toDocumentNumber(item.total_price, 0), 0)
    : 0

  if (toDocumentNumber(quote.subtotal, 0)) return roundDocumentCurrency(quote.subtotal)
  if (itemSubtotal) return roundDocumentCurrency(itemSubtotal)

  const total = getContractTotal(contract)
  const vatConfig = getContractVatConfig(contract)
  if (!vatConfig.has_vat) return total

  return roundDocumentCurrency(total / (1 + vatConfig.vat_rate))
}

export function getContractTotal(contract = {}) {
  const quote = contract.quote_snapshot || {}
  const source = contract.source_snapshot || {}
  const total = toDocumentNumber(quote.total_amount, 0)
  if (total) return roundDocumentCurrency(total)

  const subtotal = toDocumentNumber(quote.subtotal, 0)
  if (subtotal) {
    const vatConfig = getContractVatConfig(contract)
    return vatConfig.has_vat
      ? roundDocumentCurrency(subtotal * (1 + vatConfig.vat_rate))
      : roundDocumentCurrency(subtotal)
  }

  return roundDocumentCurrency(source.price || 0)
}

export function buildContractValueRows(contract = {}) {
  const quote = contract.quote_snapshot || {}
  const items = Array.isArray(quote.items) ? quote.items : []
  const rows = items
    .filter(item => item && (item.service_name || item.total_price || item.unit_price))
    .map((item, index) => {
      const quantity = toDocumentNumber(item.quantity, 0) || 1
      const amount = roundDocumentCurrency(item.total_price || (quantity * toDocumentNumber(item.unit_price, 0)))
      return {
        id: item.id || `${item.service_code || 'contract-row'}-${index + 1}`,
        description: item.service_name || item.service_code || `Hạng mục ${index + 1}`,
        unit: item.unit || 'Gói',
        quantity,
        unit_price: toDocumentNumber(item.unit_price, 0) || roundDocumentCurrency(amount / Math.max(1, quantity)),
        amount,
      }
    })

  if (rows.length) return rows

  const subtotal = getContractSubtotal(contract)
  return [{
    id: 'contract-row-1',
    description: contract.service_scope || contract.title || 'Giá trị dịch vụ theo hợp đồng',
    unit: 'Gói',
    quantity: 1,
    unit_price: subtotal,
    amount: subtotal,
  }]
}

export function normalizeAmountRows(rows = [], fallbackRows = []) {
  const sourceRows = Array.isArray(rows) && rows.length ? rows : fallbackRows
  return (Array.isArray(sourceRows) ? sourceRows : []).map((row, index) => {
    const quantity = toDocumentNumber(row.quantity, 0) || 1
    const amount = roundDocumentCurrency(row.amount ?? row.total_price ?? (quantity * toDocumentNumber(row.unit_price, 0)))
    return {
      id: row.id || `amount-row-${index + 1}`,
      description: String(row.description || row.service_name || row.name || '').trim(),
      unit: String(row.unit || 'Gói').trim(),
      quantity,
      unit_price: toDocumentNumber(row.unit_price, 0) || roundDocumentCurrency(amount / Math.max(1, quantity)),
      amount,
    }
  })
}

export function calculateAmountRowsTotal(rows = []) {
  return roundDocumentCurrency((Array.isArray(rows) ? rows : []).reduce((sum, row) => (
    sum + toDocumentNumber(row.amount, 0)
  ), 0))
}

export function calculateTableTotals(rows = [], vatConfig = {}) {
  const subtotal = calculateAmountRowsTotal(rows)
  const hasVat = vatConfig.has_vat !== false
  const vatRate = toDocumentNumber(vatConfig.vat_rate, DEFAULT_DOCUMENT_VAT_RATE)
  const vatAmount = hasVat ? roundDocumentCurrency(subtotal * vatRate) : 0

  return {
    subtotal,
    vat_amount: vatAmount,
    total_amount: subtotal + vatAmount,
  }
}

export function calculateAdvanceAmount(contractValue = 0, advancePercent = 0) {
  return roundDocumentCurrency(toDocumentNumber(contractValue, 0) * toDocumentNumber(advancePercent, 0) / 100)
}

export function calculateAdvancePercent(contractValue = 0, advanceAmount = 0) {
  const total = toDocumentNumber(contractValue, 0)
  if (!total) return 0
  return Math.round((toDocumentNumber(advanceAmount, 0) / total) * 10000) / 100
}

export function getAdvanceDocumentAmount(document = {}) {
  const data = document?.document_data || {}
  const amountConfig = data.amount_config || {}
  return roundDocumentCurrency(
    amountConfig.advance_amount ??
    data.advance_amount ??
    data.amount ??
    0,
  )
}

export function normalizeDocumentIdList(values = []) {
  const source = Array.isArray(values) ? values : [values]
  return [...new Set(source.map(value => String(value || '').trim()).filter(Boolean))]
}

export function getContractAdvanceDocumentLinks(documents = [], currentDocumentId = '', excludedDocumentIds = []) {
  const excludedIds = new Set(normalizeDocumentIdList(excludedDocumentIds))
  return (Array.isArray(documents) ? documents : [])
    .filter(document => (
      document?.document_type === 'advance_request' &&
      (!currentDocumentId || document.id !== currentDocumentId) &&
      !excludedIds.has(String(document.id || ''))
    ))
    .map(document => {
      const advanceAmount = getAdvanceDocumentAmount(document)
      return {
        document_id: document.id || '',
        document_number: document.document_number || '',
        document_title: document.title || '',
        issued_date: document.issued_date || '',
        original_amount: advanceAmount,
        advance_amount: advanceAmount,
      }
    })
    .filter(document => document.document_id || document.document_number || document.advance_amount)
}

export function calculateAdvanceDocumentsTotal(documents = []) {
  return roundDocumentCurrency((Array.isArray(documents) ? documents : []).reduce((sum, document) => (
    sum + toDocumentNumber(
      document.original_amount ??
      document.advance_amount ??
      document.amount ??
      document.deduction_amount,
      0,
    )
  ), 0))
}

export function summarizeContractAdvanceDocuments(documents = [], currentDocumentId = '', excludedDocumentIds = []) {
  const linkedAdvanceDocuments = getContractAdvanceDocumentLinks(documents, currentDocumentId, excludedDocumentIds)
  return {
    linked_advance_documents: linkedAdvanceDocuments,
    advance_paid: calculateAdvanceDocumentsTotal(linkedAdvanceDocuments),
  }
}

export function calculatePaymentSummary(acceptanceTotal = 0, deductions = []) {
  const deductionTotal = roundDocumentCurrency((Array.isArray(deductions) ? deductions : []).reduce((sum, row) => (
    sum + toDocumentNumber(row.deduction_amount, 0)
  ), 0))
  const remainingAmount = roundDocumentCurrency(toDocumentNumber(acceptanceTotal, 0) - deductionTotal)

  return {
    acceptance_total: roundDocumentCurrency(acceptanceTotal),
    advance_deduction_total: deductionTotal,
    remaining_amount: remainingAmount,
    payment_amount: Math.max(0, remainingAmount),
    over_deduction_amount: Math.max(0, -remainingAmount),
  }
}

export function getCustomerValidationWarnings(contract = {}) {
  const customer = contract.customer_snapshot || {}
  const warnings = []
  if (!String(customer.tax_code || '').trim()) warnings.push('MST khách hàng')
  if (!String(customer.address || '').trim()) warnings.push('Địa chỉ khách hàng')
  if (!String(customer.representative || '').trim()) warnings.push('Người đại diện khách hàng')
  return warnings
}
