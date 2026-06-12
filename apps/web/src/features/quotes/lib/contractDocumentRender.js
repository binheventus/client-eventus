import { numberToVietnameseWords, sanitizeFilenamePart } from './contractDefaults.js'
import {
  calculateAdvanceDocumentsTotal,
  calculatePaymentSummary,
  calculateTableTotals,
  formatContractDocumentNumberForDisplay,
  getContractDocumentCustomerCode,
  getContractVatConfig,
  getDocumentNumberSellerCode,
  roundDocumentCurrency,
  toDocumentNumber,
} from './contractDocumentEditor.js'
import {
  ADVANCE_REQUEST_TEMPLATE_BLOCKS,
  ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS,
  ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS,
  CONTRACT_DOCUMENT_TYPES,
  PAYMENT_REQUEST_TEMPLATE_BLOCKS,
} from './contractDocumentTemplates.js'

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

export function isDocumentIssuedDateHidden(document = {}) {
  return Boolean(getDocumentFormData(document).hide_issued_date)
}

const HANDWRITTEN_DATE_PLACEHOLDER = '\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'

export function getDisplayDocumentIssuedDate(document = {}) {
  if (isDocumentIssuedDateHidden(document)) return ''
  return formatDocumentDate(document.issued_date || document.created_at)
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

export function getProfileLegalName(profile = {}) {
  return profile.entity_name_full || profile.legal_name || profile.company_name || profile.name || ''
}

export function getBankAccountText(document = {}) {
  const formData = getDocumentFormData(document)
  const data = getDocumentData(document)
  const seller = getSellerProfile(document)
  return formData.bank_account
    || data.bank_account
    || [seller.bank_account || seller.account_number, seller.bank_name, seller.account_holder || getProfileName(seller)].filter(Boolean).join(' - ')
}

function splitBankAccountText(value = '') {
  const parts = String(value || '').split(/\s+-\s+/).map(part => part.trim()).filter(Boolean)
  return {
    account_number: parts[0] || '',
    bank_name: parts[1] || '',
    account_holder: parts[2] || '',
  }
}

export function getBankAccountDetails(document = {}) {
  const formData = getDocumentFormData(document)
  const data = getDocumentData(document)
  const seller = getSellerProfile(document)
  const fallback = splitBankAccountText(formData.bank_account || data.bank_account || '')

  return {
    account_number: formData.bank_account_number
      || data.bank_account_number
      || fallback.account_number
      || seller.bank_account
      || seller.account_number
      || '',
    bank_name: formData.bank_name
      || data.bank_name
      || fallback.bank_name
      || seller.bank_name
      || '',
    account_holder: formData.account_holder
      || data.account_holder
      || fallback.account_holder
      || seller.account_holder
      || getProfileName(seller)
      || '',
  }
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

function getContractProjectEventName(contract = {}) {
  return String(
    contract.source_snapshot?.job_title
      || contract.service_scope
      || '',
  ).trim()
}

function getContractDocumentJobDatePart(contract = {}) {
  const rows = Array.isArray(contract.schedule_rows) ? contract.schedule_rows : []
  const rawDate = rows.map(row => String(row?.date_text || '').trim()).find(Boolean) || ''
  if (!rawDate) return ''

  const isoMatch = rawDate.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/)
  if (isoMatch) return `${isoMatch[3].padStart(2, '0')}.${isoMatch[2].padStart(2, '0')}`

  const displayMatch = rawDate.match(/\b(\d{1,2})[./-](\d{1,2})(?:[./-]\d{2,4})?\b/)
  if (displayMatch) return `${displayMatch[1].padStart(2, '0')}.${displayMatch[2].padStart(2, '0')}`

  return ''
}

function getContractDocumentDownloadEventName(document = {}) {
  const contract = getContractFromDocument(document)
  return String(
    contract.source_snapshot?.job_title
      || contract.quote_snapshot?.event_name
      || contract.event_name
      || contract.source_snapshot?.event_name
      || contract.title
      || getDocumentTitle(document)
      || '',
  ).trim()
}

function getContractDocumentDownloadBaseName(document = {}) {
  const contract = getContractFromDocument(document)
  const jobDatePart = getContractDocumentJobDatePart(contract)
  const documentTypeCode = CONTRACT_DOCUMENT_TYPES[document.document_type]?.code || String(document.document_type || 'Chung-tu').toUpperCase()
  const sellerCode = getDocumentNumberSellerCode(
    document.seller_entity_code
      || contract.seller_entity_code
      || getSellerProfile(document).entity_code
      || 'EVT',
  )
  const customerCode = getContractDocumentCustomerCode(contract)
  const eventName = getContractDocumentDownloadEventName(document)

  const filenameParts = [
    jobDatePart,
    `${documentTypeCode}-${sellerCode}`,
    customerCode,
    eventName,
  ].filter(Boolean)

  return filenameParts
    .map(part => (part === jobDatePart ? part : sanitizeFilenamePart(part)))
    .filter(Boolean)
    .join('-')
}

function getAdvanceTemplateSection(document = {}, sectionId = '') {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  const section = sections.find(row => row.id === sectionId)
  const fallback = ADVANCE_REQUEST_TEMPLATE_BLOCKS.find(row => row.id === sectionId)
  return String(section?.body ?? fallback?.body ?? '').trim()
}

function getAdvanceTemplateTokenValues(document = {}) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const summary = getAdvanceSummary(document)
  const bank = getBankAccountDetails(document)
  const issuedDate = getDisplayDocumentIssuedDate(document)
  const signingDate = formatDocumentDate(contract.signing_date || contract.quote_table_config?.signing_date)

  return {
    '{{issued_date}}': issuedDate || '-',
    '{{customer_name}}': getProfileName(customer) || '-',
    '{{project_event_name}}': getContractProjectEventName(contract) || '-',
    '{{service_scope}}': contract.service_scope || '-',
    '{{contract_number}}': contract.contract_number || '-',
    '{{contract_signing_date}}': signingDate || '-',
    '{{advance_percent}}': Number.isFinite(summary.advance_percent) ? String(summary.advance_percent) : '-',
    '{{advance_amount}}': formatDocumentCurrency(summary.advance_amount, ''),
    '{{advance_amount_words}}': summary.amount_words || '-',
    '{{seller_bank_account}}': bank.account_number || '-',
    '{{seller_bank_name}}': bank.bank_name || '-',
    '{{seller_account_holder}}': bank.account_holder || '-',
  }
}

export function renderAdvanceRequestTemplateText(value = '', document = {}) {
  const tokens = getAdvanceTemplateTokenValues(document)
  return Object.entries(tokens).reduce(
    (text, [token, replacement]) => text.split(token).join(replacement),
    String(value || ''),
  )
}

export function getAdvanceRequestContent(document = {}) {
  return {
    greeting: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-greeting'), document),
    basis: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-basis'), document),
    request: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-request'), document),
    amount_words: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-amount-words'), document),
    method: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-method'), document),
    bank_intro: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-bank-intro'), document),
    closing: renderAdvanceRequestTemplateText(getAdvanceTemplateSection(document, 'advance-closing'), document),
  }
}

export function getAcceptanceSummary(document = {}) {
  const formData = getDocumentFormData(document)
  const data = getDocumentData(document)
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
  const linkedAdvanceDocuments = Array.isArray(formData.linked_advance_documents)
    ? formData.linked_advance_documents
    : Array.isArray(data.linked_advance_documents)
      ? data.linked_advance_documents
      : Array.isArray(amountConfig.linked_advance_documents)
        ? amountConfig.linked_advance_documents
        : []
  const linkedAdvancePaid = calculateAdvanceDocumentsTotal(linkedAdvanceDocuments)
  const advancePaid = linkedAdvancePaid > 0
    ? linkedAdvancePaid
    : roundDocumentCurrency(formData.advance_paid ?? amountConfig.advance_paid ?? 0)
  const remainingAmount = linkedAdvancePaid > 0
    ? Math.max(0, roundDocumentCurrency(actualTotals.total_amount - advancePaid))
    : roundDocumentCurrency(
        formData.remaining_amount ??
        amountConfig.remaining_amount ??
        Math.max(0, actualTotals.total_amount - advancePaid),
      )

  return {
    vat_config: vatConfig,
    contract_rows: contractRows,
    actual_rows: actualRows,
    contract_totals: contractTotals,
    actual_totals: actualTotals,
    acceptance_note: formData.acceptance_note || getDocumentData(document).note || '',
    acceptance_result: formData.acceptance_result || 'accepted',
    linked_advance_documents: linkedAdvanceDocuments,
    advance_paid: advancePaid,
    remaining_amount: remainingAmount,
    payment_due_days: formData.payment_due_days || amountConfig.payment_due_days || '07 ngày',
    amount_words: actualTotals.total_amount > 0 ? numberToVietnameseWords(actualTotals.total_amount) : '',
  }
}

function getAcceptanceTemplateSection(document = {}, sectionId = '') {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  const section = sections.find(row => row.id === sectionId)
  const fallbackSections = hasAcceptanceCostDifference(document)
    ? ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS
    : ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS
  const fallback = fallbackSections.find(row => row.id === sectionId)
  return String(section?.body ?? fallback?.body ?? '').trim()
}

function getAcceptanceTemplateSections(document = {}) {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  if (sections.length) return sections
  return hasAcceptanceCostDifference(document)
    ? ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS
    : ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS
}

export function hasAcceptanceCostDifference(document = {}) {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  return Boolean(
    document.template_snapshot?.fields_config?.acceptance_cost_difference ||
    document.fields_config?.acceptance_cost_difference ||
    sections.some(section => section.id === 'acceptance-cost-difference-note')
  )
}

export function shouldShowAcceptanceAmountTables(document = {}, summary = getAcceptanceSummary(document)) {
  void summary
  return hasAcceptanceCostDifference(document)
}

function getAcceptanceTemplateTokenValues(document = {}) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const summary = getAcceptanceSummary(document)
  const bank = getBankAccountDetails(document)
  const issuedDate = isDocumentIssuedDateHidden(document)
    ? HANDWRITTEN_DATE_PLACEHOLDER
    : getDisplayDocumentIssuedDate(document)
  const signingDate = formatDocumentDate(contract.signing_date || contract.quote_table_config?.signing_date)

  return {
    '{{issued_date}}': issuedDate || '-',
    '{{contract_number}}': contract.contract_number || '-',
    '{{contract_signing_date}}': signingDate || '-',
    '{{customer_name}}': getProfileName(customer) || '-',
    '{{customer_representative}}': customer.representative || '-',
    '{{customer_position}}': customer.position || '-',
    '{{customer_address}}': customer.address || '-',
    '{{customer_tax_code}}': customer.tax_code || '-',
    '{{seller_name}}': getProfileLegalName(seller) || '-',
    '{{seller_entity_name_full}}': getProfileLegalName(seller) || '-',
    '{{seller_representative}}': seller.representative || '-',
    '{{seller_position}}': seller.position || '-',
    '{{seller_address}}': seller.address || '-',
    '{{seller_tax_code}}': seller.tax_code || '-',
    '{{seller_bank_account}}': bank.account_number || '-',
    '{{seller_bank_name}}': bank.bank_name || '-',
    '{{seller_account_holder}}': bank.account_holder || '-',
    '{{contract_total}}': formatDocumentCurrency(summary.contract_totals.total_amount, ''),
    '{{acceptance_total}}': formatDocumentCurrency(summary.actual_totals.total_amount, ''),
    '{{advance_paid}}': formatDocumentCurrency(summary.advance_paid, ''),
    '{{remaining_amount}}': formatDocumentCurrency(summary.remaining_amount, ''),
    '{{payment_due_days}}': summary.payment_due_days || '07 ngày',
  }
}

export function renderAcceptanceLiquidationTemplateText(value = '', document = {}) {
  const tokens = getAcceptanceTemplateTokenValues(document)
  return Object.entries(tokens).reduce(
    (text, [token, replacement]) => text.split(token).join(replacement),
    String(value || ''),
  )
}

export function getAcceptanceLiquidationContent(document = {}) {
  const sections = getAcceptanceTemplateSections(document)
  const costDifferenceNote = sections.find(section => section.id === 'acceptance-cost-difference-note')
  return {
    basis_contract: renderAcceptanceLiquidationTemplateText(getAcceptanceTemplateSection(document, 'acceptance-basis-contract'), document),
    basis_completed: renderAcceptanceLiquidationTemplateText(getAcceptanceTemplateSection(document, 'acceptance-basis-completed'), document),
    party_intro: renderAcceptanceLiquidationTemplateText(getAcceptanceTemplateSection(document, 'acceptance-party-intro'), document),
    signing_intro: renderAcceptanceLiquidationTemplateText(getAcceptanceTemplateSection(document, 'acceptance-signing-intro'), document),
    has_cost_difference: hasAcceptanceCostDifference(document),
    cost_difference_note: renderAcceptanceLiquidationTemplateText(costDifferenceNote?.body || '', document),
    articles: sections
      .filter(section => section.id.startsWith('acceptance-article-'))
      .map(section => ({
        id: section.id,
        title: section.title,
        body: renderAcceptanceLiquidationTemplateText(getAcceptanceTemplateSection(document, section.id), document),
      })),
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
    acceptance_document_number: formatContractDocumentNumberForDisplay(formData.acceptance_document_number || getDocumentData(document).acceptance_document_number || amountConfig.acceptance_document_number || ''),
    acceptance_issued_date: formData.acceptance_issued_date || getDocumentData(document).acceptance_issued_date || amountConfig.acceptance_issued_date || '',
    acceptance_total: acceptanceTotal,
    advance_deductions: deductions.map((row, index) => ({
      document_id: row.document_id || row.id || `advance-${index + 1}`,
      document_number: formatContractDocumentNumberForDisplay(row.document_number) || '',
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

function getPaymentTemplateSection(document = {}, sectionId = '') {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  const section = sections.find(row => row.id === sectionId)
  const fallback = PAYMENT_REQUEST_TEMPLATE_BLOCKS.find(row => row.id === sectionId)
  return String(section?.body ?? fallback?.body ?? '').trim()
}

function getPaymentTemplateTokenValues(document = {}) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const summary = getPaymentSummary(document)
  const bank = getBankAccountDetails(document)
  const issuedDate = getDisplayDocumentIssuedDate(document)
  const signingDate = formatDocumentDate(contract.signing_date || contract.quote_table_config?.signing_date)
  const acceptanceDate = formatDocumentDate(summary.acceptance_issued_date)

  return {
    '{{issued_date}}': issuedDate || '-',
    '{{customer_name}}': getProfileName(customer) || '-',
    '{{service_scope}}': contract.service_scope || '-',
    '{{contract_number}}': contract.contract_number || '-',
    '{{contract_signing_date}}': signingDate || '-',
    '{{acceptance_document_number}}': summary.acceptance_document_number || '-',
    '{{acceptance_issued_date}}': acceptanceDate || '-',
    '{{payment_amount}}': formatDocumentCurrency(summary.payment_amount, ''),
    '{{payment_amount_words}}': summary.amount_words || '-',
    '{{seller_bank_account}}': bank.account_number || '-',
    '{{seller_bank_name}}': bank.bank_name || '-',
    '{{seller_account_holder}}': bank.account_holder || '-',
  }
}

export function renderPaymentRequestTemplateText(value = '', document = {}) {
  const tokens = getPaymentTemplateTokenValues(document)
  return Object.entries(tokens).reduce(
    (text, [token, replacement]) => text.split(token).join(replacement),
    String(value || ''),
  )
}

export function getPaymentRequestContent(document = {}) {
  return {
    greeting: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-greeting'), document),
    basis: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-basis'), document),
    request: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-request'), document),
    amount_words: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-amount-words'), document),
    method: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-method'), document),
    bank_intro: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-bank-intro'), document),
    closing: renderPaymentRequestTemplateText(getPaymentTemplateSection(document, 'payment-closing'), document),
  }
}

export function getContractDocumentFilename(document = {}, extension = 'pdf') {
  const downloadName = getContractDocumentDownloadBaseName(document)
  if (downloadName) return `${downloadName}.${extension}`

  const rawName = formatContractDocumentNumberForDisplay(document.document_number)
    || getDocumentTitle(document)
    || document.id
    || 'Chung-tu'
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
