import { numberToVietnameseWords, sanitizeFilenamePart } from './contractDefaults'
import {
  calculatePaymentSummary,
  calculateTableTotals,
  getContractVatConfig,
  roundDocumentCurrency,
  toDocumentNumber,
} from './contractDocumentEditor'
import { CONTRACT_DOCUMENT_TYPES } from './contractDocumentTemplates'

export function hasDocumentText(value) {
  return String(value ?? '').trim().length > 0
}

export function formatDocumentCurrency(value, suffix = ' VNĐ') {
  return `${new Intl.NumberFormat('vi-VN').format(roundDocumentCurrency(value))}${suffix}`
}

export function formatDocumentDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

export function getDocumentTypeLabel(documentType = '') {
  return CONTRACT_DOCUMENT_TYPES[documentType]?.label || documentType || 'Chứng từ'
}

export function getContractFromDocument(document = {}) {
  return document.contract_snapshot || {}
}

export function getDocumentData(document = {}) {
  return document.document_data || {}
}

export function getDocumentFormData(document = {}) {
  return getDocumentData(document).form_data || {}
}

export function getDocumentAmountConfig(document = {}) {
  return getDocumentData(document).amount_config || {}
}

export function getDocumentTitle(document = {}) {
  return document.title || document.template_snapshot?.title || getDocumentTypeLabel(document.document_type)
}

export function getPartyRole(contract = {}, partyKey = 'party_a') {
  return contract.party_role_config?.[partyKey] || (partyKey === 'party_a' ? 'customer' : 'seller')
}

export function getPartyProfile(contract = {}, partyKey = 'party_a') {
  const role = getPartyRole(contract, partyKey)
  return role === 'seller' ? contract.seller_snapshot || {} : contract.customer_snapshot || {}
}

export function getCustomerProfile(documentOrContract = {}) {
  const contract = documentOrContract.document_type ? getContractFromDocument(documentOrContract) : documentOrContract
  return getPartyRole(contract, 'party_a') === 'customer'
    ? getPartyProfile(contract, 'party_a')
    : getPartyProfile(contract, 'party_b')
}

export function getSellerProfile(documentOrContract = {}) {
  const contract = documentOrContract.document_type ? getContractFromDocument(documentOrContract) : documentOrContract
  return getPartyRole(contract, 'party_a') === 'seller'
    ? getPartyProfile(contract, 'party_a')
    : getPartyProfile(contract, 'party_b')
}

export function getProfileName(profile = {}) {
  return profile.company_name || profile.entity_name_full || profile.legal_name || profile.name || ''
}

export function getBankAccountText(document = {}) {
  const formData = getDocumentFormData(document)
  const data = getDocumentData(document)
  const seller = getSellerProfile(document)
  return formData.bank_account
    || data.bank_account
    || [seller.bank_account || seller.account_number, seller.bank_name, seller.account_holder || getProfileName(seller)].filter(Boolean).join(' - ')
}

function normalizeRows(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row, index) => {
    const quantity = toDocumentNumber(row.quantity, 0) || 1
    const amount = roundDocumentCurrency(row.amount ?? row.total_price ?? (quantity * toDocumentNumber(row.unit_price, 0)))
    return {
      id: row.id || `row-${index + 1}`,
      description: String(row.description || row.service_name || row.name || `Hạng mục ${index + 1}`).trim(),
      unit: String(row.unit || 'Gói').trim(),
      quantity,
      unit_price: toDocumentNumber(row.unit_price, 0) || roundDocumentCurrency(amount / Math.max(1, quantity)),
      amount,
    }
  })
}

export function getVatLabel(vatConfig = {}) {
  if (vatConfig.has_vat === false) return 'VAT'
  return `VAT ${Math.round(Number(vatConfig.vat_rate || 0) * 100)}%`
}

export function getAdvanceSummary(document = {}) {
  const formData = getDocumentFormData(document)
  const amountConfig = getDocumentAmountConfig(document)
  const contractValue = roundDocumentCurrency(formData.contract_value ?? amountConfig.contract_value ?? 0)
  const advancePercent = Number(formData.advance_percent ?? amountConfig.advance_percent ?? 0)
  const advanceAmount = roundDocumentCurrency(formData.advance_amount ?? amountConfig.advance_amount ?? getDocumentData(document).advance_amount ?? 0)
  return {
    contract_value: contractValue,
    advance_percent: advancePercent,
    advance_amount: advanceAmount,
    request_content: formData.request_content || getDocumentData(document).note || '',
    bank_account: getBankAccountText(document),
    amount_words: advanceAmount > 0 ? numberToVietnameseWords(advanceAmount) : '',
  }
}

export function getAcceptanceSummary(document = {}) {
  const formData = getDocumentFormData(document)
  const amountConfig = getDocumentAmountConfig(document)
  const contract = getContractFromDocument(document)
  const vatConfig = {
    ...getContractVatConfig(contract),
    ...amountConfig,
  }
  const contractRows = normalizeRows(formData.contract_rows || getDocumentData(document).contract_rows || [])
  const actualRows = normalizeRows(formData.actual_rows || getDocumentData(document).actual_rows || [])
  const contractTotals = contractRows.length
    ? calculateTableTotals(contractRows, vatConfig)
    : {
        subtotal: roundDocumentCurrency(amountConfig.contract_subtotal || 0),
        vat_amount: roundDocumentCurrency(amountConfig.contract_vat_amount || 0),
        total_amount: roundDocumentCurrency(amountConfig.contract_total || 0),
      }
  const actualTotals = actualRows.length
    ? calculateTableTotals(actualRows, vatConfig)
    : {
        subtotal: roundDocumentCurrency(amountConfig.acceptance_subtotal || 0),
        vat_amount: roundDocumentCurrency(amountConfig.acceptance_vat_amount || 0),
        total_amount: roundDocumentCurrency(amountConfig.acceptance_actual_total || amountConfig.acceptance_amount || 0),
      }

  return {
    vat_config: vatConfig,
    contract_rows: contractRows,
    actual_rows: actualRows,
    contract_totals: contractTotals,
    actual_totals: actualTotals,
    acceptance_note: formData.acceptance_note || getDocumentData(document).note || '',
    acceptance_result: formData.acceptance_result || 'accepted',
    amount_words: actualTotals.total_amount > 0 ? numberToVietnameseWords(actualTotals.total_amount) : '',
  }
}

export function getPaymentSummary(document = {}) {
  const formData = getDocumentFormData(document)
  const amountConfig = getDocumentAmountConfig(document)
  const deductions = Array.isArray(formData.advance_deductions)
    ? formData.advance_deductions
    : Array.isArray(getDocumentData(document).advance_deductions)
      ? getDocumentData(document).advance_deductions
      : Array.isArray(amountConfig.linked_advance_documents)
        ? amountConfig.linked_advance_documents
        : []
  const acceptanceTotal = roundDocumentCurrency(formData.acceptance_total ?? amountConfig.acceptance_total ?? 0)
  const summary = {
    ...calculatePaymentSummary(acceptanceTotal, deductions),
    ...amountConfig,
  }
  const paymentAmount = roundDocumentCurrency(summary.payment_amount ?? getDocumentData(document).payment_amount ?? 0)

  return {
    acceptance_document_id: formData.acceptance_document_id || getDocumentData(document).acceptance_document_id || amountConfig.acceptance_document_id || '',
    acceptance_total: acceptanceTotal,
    advance_deductions: deductions.map((row, index) => ({
      document_id: row.document_id || row.id || `advance-${index + 1}`,
      document_number: row.document_number || '',
      document_title: row.document_title || row.title || 'Đề nghị tạm ứng',
      original_amount: roundDocumentCurrency(row.original_amount ?? row.advance_amount ?? 0),
      deduction_amount: roundDocumentCurrency(row.deduction_amount ?? row.original_amount ?? row.advance_amount ?? 0),
    })),
    advance_deduction_total: roundDocumentCurrency(summary.advance_deduction_total || 0),
    remaining_amount: roundDocumentCurrency(summary.remaining_amount ?? paymentAmount),
    payment_amount: paymentAmount,
    over_deduction_amount: roundDocumentCurrency(summary.over_deduction_amount || 0),
    request_content: formData.request_content || getDocumentData(document).note || '',
    bank_account: getBankAccountText(document),
    amount_words: paymentAmount > 0 ? numberToVietnameseWords(paymentAmount) : '',
  }
}

export function getContractDocumentFilename(document = {}, extension = 'pdf') {
  const rawName = document.document_number || getDocumentTitle(document) || document.id || 'Chung-tu'
  return `${sanitizeFilenamePart(rawName)}.${extension}`
}

export function getContractDocumentValidationWarnings(document = {}) {
  const customer = getCustomerProfile(document)
  const warnings = []
  if (!hasDocumentText(customer.tax_code)) warnings.push('MST khách hàng')
  if (!hasDocumentText(customer.address)) warnings.push('Địa chỉ khách hàng')
  if (!hasDocumentText(customer.representative)) warnings.push('Người đại diện khách hàng')
  if (!hasDocumentText(customer.position)) warnings.push('Chức vụ người đại diện')

  if (['advance_request', 'payment_request'].includes(document.document_type) && !hasDocumentText(getBankAccountText(document))) {
    warnings.push('Tài khoản nhận tiền')
  }

  if (document.document_type === 'payment_request' && !hasDocumentText(getPaymentSummary(document).acceptance_document_id)) {
    warnings.push('BBNT liên kết')
  }

  return warnings
}
