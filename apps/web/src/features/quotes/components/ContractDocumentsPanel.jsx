import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Copy, ExternalLink, FileText, Link, Plus, RefreshCw, Trash2 } from 'lucide-react'
import ContractDocumentDocxDownloadButton from './ContractDocumentDocxDownloadButton'
import ContractDocumentPDFDownloadButton from './ContractDocumentPDFDownloadButton'
import ContractEntityMismatchPopup from './ContractEntityMismatchPopup'
import NoticePopup from './NoticePopup'
import {
  deleteContractDocument,
  listContractDocuments,
} from '../hooks/useContracts'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import { useLegalEntities } from '../hooks/useLegalEntities'
import {
  getContractDocumentsRoute,
  getContractDocumentEditRoute,
  getNewContractDocumentRoute,
} from '../lib/contractRouting'
import {
  findLegalEntityByCode,
  formatEntityBankDetails,
  getEntityBankDetails,
  getEntityProfile,
  getLegalEntityCode,
  getLegalEntityLabel,
} from '../lib/contractDefaults'
import {
  buildDocumentTemplateSnapshot,
  CONTRACT_DOCUMENT_TYPES as DOCUMENT_TYPES,
  getDefaultDocumentTemplate,
} from '../lib/contractDocumentTemplates'
import {
  buildContractValueRows,
  calculateAdvanceAmount,
  calculateAdvancePercent,
  calculateAdvanceDocumentsTotal,
  calculatePaymentSummary,
  calculateTableTotals,
  getAdvanceDocumentAmount,
  getContractAdvanceDocumentLinks,
  getContractDocumentCustomerCode,
  getContractTotal,
  getContractVatConfig,
  getCustomerValidationWarnings,
  formatContractDocumentNumberForDisplay,
  normalizeDocumentIdList,
  normalizeAmountRows,
  renderContractDocumentNumber,
  roundDocumentCurrency,
  summarizeContractAdvanceDocuments,
  toDocumentNumber,
} from '../lib/contractDocumentEditor'
import { getContractDocumentValidationWarnings, hasAcceptanceCostDifference } from '../lib/contractDocumentRender'
import { formatQuoteCurrency, formatQuoteDate } from '../lib/quoteList'

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition placeholder:text-slate-300 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 ${props.className || ''}`}
    />
  )
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] leading-6 outline-none transition placeholder:text-slate-300 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 ${props.className || ''}`}
    />
  )
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 ${props.className || ''}`}
    />
  )
}

function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

function toDateInputValue(value) {
  if (!value) return ''
  const text = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function parseCurrencyInput(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function parseSignedCurrencyInput(value) {
  const text = String(value || '').trim()
  const clean = text.replace(/[^\d]/g, '')
  if (!clean) return 0
  const negative = text.startsWith('-') || /^\(.*\)$/.test(text)
  return negative ? -Number(clean) : Number(clean)
}

function formatCurrencyInput(value) {
  const number = Number(value || 0)
  if (!number) return ''
  return formatQuoteCurrency(number)
}

function splitBankAccountText(value = '') {
  const parts = String(value || '').split(/\s+-\s+/).map(part => part.trim()).filter(Boolean)
  return {
    account_number: parts[0] || '',
    bank_name: parts[1] || '',
    account_holder: parts[2] || '',
  }
}

function getSellerProfileForCode(entityCode = '', legalEntities = []) {
  const entity = findLegalEntityByCode(entityCode, legalEntities)
  const fallback = getEntityProfile(entityCode || 'EVT')
  const source = entity || fallback
  const label = getLegalEntityLabel(source)

  return {
    ...fallback,
    ...source,
    entity_code: getLegalEntityCode(source) || entityCode || fallback.entity_code || 'EVT',
    company_name: label,
    legal_name: source.legal_name || fallback.legal_name || label,
    account_holder: source.account_holder || fallback.account_holder || label,
  }
}

function getDefaultBankDetails(contract = {}, sellerEntityCode = '', legalEntities = []) {
  const sellerProfile = getSellerProfileForCode(sellerEntityCode || contract.seller_entity_code, legalEntities)
  const seller = contract.seller_snapshot || {}
  const profileBank = getEntityBankDetails(sellerProfile)

  return {
    account_number: profileBank.account_number || seller.bank_account || seller.account_number || '',
    bank_name: profileBank.bank_name || seller.bank_name || '',
    account_holder: profileBank.account_holder || seller.account_holder || seller.entity_name_full || seller.legal_name || seller.name || '',
  }
}

function getDefaultBankAccount(contract = {}, sellerEntityCode = '', legalEntities = []) {
  const details = getDefaultBankDetails(contract, sellerEntityCode, legalEntities)
  if (details.account_number || details.bank_name || details.account_holder) return formatEntityBankDetails(details)

  const seller = contract.seller_snapshot || {}
  const accountNumber = seller.bank_account || seller.account_number || ''
  const bankName = seller.bank_name || ''
  const accountHolder = seller.account_holder || seller.entity_name_full || seller.legal_name || seller.name || ''
  return [accountNumber, bankName, accountHolder].filter(Boolean).join(' - ')
}

function getBankDetailsFromFormData(formData = {}, seller = {}) {
  const fallback = splitBankAccountText(formData.bank_account || '')
  return {
    account_number: formData.bank_account_number || fallback.account_number || seller.bank_account || seller.account_number || '',
    bank_name: formData.bank_name || fallback.bank_name || seller.bank_name || '',
    account_holder: formData.account_holder || fallback.account_holder || seller.account_holder || seller.company_name || seller.legal_name || seller.entity_name_full || seller.name || '',
  }
}

function getOpenSyncedContract(document = null, contract = {}) {
  const status = String(document?.status || 'draft')
  const canSync = !document?.id || (document?.auto_sync_contract !== false && ['draft', 'open'].includes(status))
  return canSync ? contract || document?.contract_snapshot || {} : document?.contract_snapshot || contract || {}
}

function makeAmountRow(prefix = 'row') {
  return {
    id: `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    description: '',
    unit: 'Gói',
    quantity: 1,
    unit_price: 0,
    amount: 0,
  }
}

function getDocumentAmount(document = {}) {
  const data = document?.document_data || {}
  const amountConfig = data.amount_config || {}
  return Number(
    amountConfig.payment_amount ??
    amountConfig.acceptance_actual_total ??
    amountConfig.advance_amount ??
    data.payment_amount ??
    data.acceptance_amount ??
    data.advance_amount ??
    data.amount ??
    0
  )
}

function getAcceptanceDocumentTotal(document = {}) {
  const data = document?.document_data || {}
  const amountConfig = data.amount_config || {}
  return Number(
    amountConfig.acceptance_actual_total ??
    amountConfig.acceptance_amount ??
    data.acceptance_amount ??
    data.amount ??
    0
  )
}

function getDocumentDisplayName(document = {}) {
  return formatContractDocumentNumberForDisplay(document.document_number) || document.title || document.id || 'Chứng từ'
}

function getPublicDocumentUrl(document = {}) {
  if (!document.share_token) return ''
  return `${window.location.origin}/d/${encodeURIComponent(document.share_token)}`
}

function normalizePaymentDeductions(rows = [], advanceDocuments = []) {
  const byId = new Map(advanceDocuments.map(row => [row.id, row]))
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const documentId = row.document_id || row.id || ''
      const linkedDocument = byId.get(documentId)
      const originalAmount = linkedDocument ? getAdvanceDocumentAmount(linkedDocument) : Number(row.original_amount || row.advance_amount || 0)
      return {
        document_id: documentId,
        document_number: formatContractDocumentNumberForDisplay(linkedDocument?.document_number || row.document_number || ''),
        document_title: linkedDocument?.title || row.document_title || row.title || '',
        original_amount: originalAmount,
        deduction_amount: Number(row.deduction_amount ?? originalAmount),
      }
    })
    .filter(row => row.document_id)
}

function buildAdvanceFormData(document = null, contract = {}, sellerEntityCode = '', legalEntities = []) {
  const data = document?.document_data || {}
  const savedFormData = data.form_data || {}
  const amountConfig = data.amount_config || {}
  const bankDetails = getDefaultBankDetails(contract, sellerEntityCode || document?.seller_entity_code || contract.seller_entity_code, legalEntities)
  const syncContractValue = savedFormData.sync_contract_value ?? amountConfig.sync_contract_value ?? true
  const liveContractValue = getContractTotal(contract)
  const contractValue = syncContractValue
    ? liveContractValue
    : roundDocumentCurrency(savedFormData.contract_value ?? amountConfig.contract_value ?? liveContractValue)
  const defaultPercent = Number(contract.payment_config?.deposit_percent ?? 0)
  const savedAmount = savedFormData.advance_amount ?? amountConfig.advance_amount ?? data.advance_amount ?? data.amount
  const advancePercent = Number(savedFormData.advance_percent ?? amountConfig.advance_percent ?? (savedAmount ? calculateAdvancePercent(contractValue, savedAmount) : defaultPercent))
  const advanceAmount = roundDocumentCurrency(savedAmount ?? calculateAdvanceAmount(contractValue, advancePercent))

  return {
    contract_value: contractValue,
    sync_contract_value: syncContractValue,
    advance_percent: advancePercent,
    advance_amount: advanceAmount,
    request_content: savedFormData.request_content || data.note || '',
    bank_account: savedFormData.bank_account || data.bank_account || formatEntityBankDetails(bankDetails),
    bank_account_number: savedFormData.bank_account_number || data.bank_account_number || bankDetails.account_number,
    bank_name: savedFormData.bank_name || data.bank_name || bankDetails.bank_name,
    account_holder: savedFormData.account_holder || data.account_holder || bankDetails.account_holder,
  }
}

function buildAcceptanceFormData(document = null, contract = {}, documents = []) {
  const data = document?.document_data || {}
  const savedFormData = data.form_data || {}
  const amountConfig = data.amount_config || {}
  const fallbackRows = buildContractValueRows(contract)
  const syncContractRows = savedFormData.sync_contract_rows ?? amountConfig.sync_contract_rows ?? true
  const contractRows = syncContractRows
    ? normalizeAmountRows(fallbackRows)
    : normalizeAmountRows(savedFormData.contract_rows || data.contract_rows, fallbackRows)
  const syncActualRows = savedFormData.sync_actual_rows ?? amountConfig.sync_actual_rows ?? true
  const actualRows = syncActualRows
    ? normalizeAmountRows(contractRows)
    : normalizeAmountRows(savedFormData.actual_rows || data.actual_rows, contractRows)
  const excludedAdvanceDocumentIds = normalizeDocumentIdList(
    savedFormData.excluded_advance_document_ids || data.excluded_advance_document_ids || amountConfig.excluded_advance_document_ids || [],
  )
  const hasLiveAdvanceDocuments = (Array.isArray(documents) ? documents : []).some(row => row.document_type === 'advance_request' && row.id !== document?.id)
  const advanceSummary = summarizeContractAdvanceDocuments(documents, document?.id || '', excludedAdvanceDocumentIds)
  const excludedIds = new Set(excludedAdvanceDocumentIds)
  const savedLinkedAdvanceSource = savedFormData.linked_advance_documents || data.linked_advance_documents || amountConfig.linked_advance_documents || []
  const savedLinkedAdvanceDocuments = (Array.isArray(savedLinkedAdvanceSource) ? savedLinkedAdvanceSource : [])
    .filter(row => !excludedIds.has(String(row.document_id || row.id || '')))
  const linkedAdvanceDocuments = hasLiveAdvanceDocuments
    ? advanceSummary.linked_advance_documents
    : savedLinkedAdvanceDocuments
  const advancePaid = linkedAdvanceDocuments.length
    ? calculateAdvanceDocumentsTotal(linkedAdvanceDocuments)
    : excludedAdvanceDocumentIds.length
      ? 0
      : roundDocumentCurrency(savedFormData.advance_paid ?? amountConfig.advance_paid ?? 0)

  return {
    contract_rows: contractRows,
    actual_rows: actualRows,
    sync_contract_rows: syncContractRows,
    sync_actual_rows: syncActualRows,
    excluded_advance_document_ids: excludedAdvanceDocumentIds,
    linked_advance_documents: linkedAdvanceDocuments,
    advance_paid: advancePaid,
  }
}

function buildPaymentFormData(document = null, contract = {}, documents = [], sellerEntityCode = '', legalEntities = []) {
  const data = document?.document_data || {}
  const savedFormData = data.form_data || {}
  const amountConfig = data.amount_config || {}
  const bankDetails = getDefaultBankDetails(contract, sellerEntityCode || document?.seller_entity_code || contract.seller_entity_code, legalEntities)
  const acceptanceDocuments = documents.filter(row => row.document_type === 'acceptance_liquidation' && row.id !== document?.id)
  const advanceDocuments = documents.filter(row => row.document_type === 'advance_request' && row.id !== document?.id)
  const defaultAcceptanceId = acceptanceDocuments.length === 1 ? acceptanceDocuments[0].id : ''
  const acceptanceDocumentId = savedFormData.acceptance_document_id || data.acceptance_document_id || amountConfig.acceptance_document_id || defaultAcceptanceId
  const selectedAcceptance = acceptanceDocuments.find(row => row.id === acceptanceDocumentId)
  const acceptanceTotal = selectedAcceptance
    ? getAcceptanceDocumentTotal(selectedAcceptance)
    : Number(savedFormData.acceptance_total ?? amountConfig.acceptance_total ?? 0)
  const acceptanceIssuedDate = selectedAcceptance?.issued_date || savedFormData.acceptance_issued_date || data.acceptance_issued_date || amountConfig.acceptance_issued_date || ''

  return {
    acceptance_document_id: acceptanceDocumentId,
    acceptance_document_number: selectedAcceptance?.document_number || savedFormData.acceptance_document_number || data.acceptance_document_number || amountConfig.acceptance_document_number || '',
    acceptance_issued_date: acceptanceIssuedDate,
    acceptance_total: acceptanceTotal,
    advance_deductions: normalizePaymentDeductions(
      savedFormData.advance_deductions || data.advance_deductions || amountConfig.linked_advance_documents || [],
      advanceDocuments,
    ),
    request_content: savedFormData.request_content || data.note || '',
    bank_account: savedFormData.bank_account || data.bank_account || formatEntityBankDetails(bankDetails),
    bank_account_number: savedFormData.bank_account_number || data.bank_account_number || bankDetails.account_number,
    bank_name: savedFormData.bank_name || data.bank_name || bankDetails.bank_name,
    account_holder: savedFormData.account_holder || data.account_holder || bankDetails.account_holder,
  }
}

function buildDocumentFormData(document = null, documentType = 'advance_request', contract = {}, documents = [], sellerEntityCode = '', legalEntities = []) {
  if (documentType === 'acceptance_liquidation') return buildAcceptanceFormData(document, contract, documents)
  if (documentType === 'payment_request') return buildPaymentFormData(document, contract, documents, sellerEntityCode, legalEntities)
  return buildAdvanceFormData(document, contract, sellerEntityCode, legalEntities)
}

function buildDocumentAmountConfig(draft = {}, documents = []) {
  const contractSource = draft.contract_source || {}
  const vatConfig = getContractVatConfig(contractSource)
  const formData = draft.form_data || {}

  if (draft.document_type === 'acceptance_liquidation') {
    const contractTotals = calculateTableTotals(formData.contract_rows || [], vatConfig)
    const actualTotals = calculateTableTotals(formData.actual_rows || [], vatConfig)
    const excludedAdvanceDocumentIds = normalizeDocumentIdList(formData.excluded_advance_document_ids || [])
    const hasLiveAdvanceDocuments = (Array.isArray(documents) ? documents : []).some(row => row.document_type === 'advance_request' && row.id !== draft.id)
    const advanceSummary = summarizeContractAdvanceDocuments(documents, draft.id || '', excludedAdvanceDocumentIds)
    const excludedIds = new Set(excludedAdvanceDocumentIds)
    const savedLinkedAdvanceDocuments = (Array.isArray(formData.linked_advance_documents) ? formData.linked_advance_documents : [])
      .filter(row => !excludedIds.has(String(row.document_id || row.id || '')))
    const linkedAdvanceDocuments = hasLiveAdvanceDocuments
      ? advanceSummary.linked_advance_documents
      : savedLinkedAdvanceDocuments
    const advancePaid = linkedAdvanceDocuments.length
      ? calculateAdvanceDocumentsTotal(linkedAdvanceDocuments)
      : excludedAdvanceDocumentIds.length
        ? 0
        : roundDocumentCurrency(formData.advance_paid ?? 0)
    const remainingAmount = Math.max(0, roundDocumentCurrency(actualTotals.total_amount - advancePaid))
    return {
      ...vatConfig,
      sync_contract_rows: formData.sync_contract_rows !== false,
      sync_actual_rows: formData.sync_actual_rows !== false,
      contract_subtotal: contractTotals.subtotal,
      contract_vat_amount: contractTotals.vat_amount,
      contract_total: contractTotals.total_amount,
      acceptance_subtotal: actualTotals.subtotal,
      acceptance_vat_amount: actualTotals.vat_amount,
      acceptance_actual_total: actualTotals.total_amount,
      acceptance_amount: actualTotals.total_amount,
      excluded_advance_document_ids: excludedAdvanceDocumentIds,
      linked_advance_documents: linkedAdvanceDocuments,
      advance_paid: advancePaid,
      remaining_amount: remainingAmount,
      amount: actualTotals.total_amount,
    }
  }

  if (draft.document_type === 'payment_request') {
    const selectedAcceptance = documents.find(row => row.id === formData.acceptance_document_id)
    const acceptanceTotal = selectedAcceptance
      ? getAcceptanceDocumentTotal(selectedAcceptance)
      : Number(formData.acceptance_total || 0)
    const summary = calculatePaymentSummary(acceptanceTotal, formData.advance_deductions || [])
    return {
      ...vatConfig,
      acceptance_document_id: formData.acceptance_document_id || '',
      acceptance_document_number: selectedAcceptance?.document_number || formData.acceptance_document_number || '',
      acceptance_issued_date: selectedAcceptance?.issued_date || formData.acceptance_issued_date || '',
      linked_advance_documents: formData.advance_deductions || [],
      ...summary,
      amount: summary.payment_amount,
    }
  }

  const contractValue = roundDocumentCurrency(formData.contract_value ?? getContractTotal(contractSource))
  const advancePercent = Number(formData.advance_percent || 0)
  const advanceAmount = roundDocumentCurrency(formData.advance_amount ?? calculateAdvanceAmount(contractValue, advancePercent))
  return {
    ...vatConfig,
    sync_contract_value: formData.sync_contract_value !== false,
    contract_value: contractValue,
    advance_percent: advancePercent,
    advance_amount: advanceAmount,
    amount: advanceAmount,
  }
}

function buildDocumentData(draft = {}, documents = []) {
  const amountConfig = buildDocumentAmountConfig(draft, documents)
  const formData = { ...(draft.form_data || {}) }

  if (draft.document_type === 'payment_request') {
    formData.acceptance_total = amountConfig.acceptance_total
  }

  const baseData = {
    form_data: formData,
    amount_config: amountConfig,
    amount: amountConfig.amount || 0,
  }

  if (draft.document_type === 'acceptance_liquidation') {
    return {
      ...baseData,
      form_data: {
        ...formData,
        excluded_advance_document_ids: amountConfig.excluded_advance_document_ids || [],
        linked_advance_documents: amountConfig.linked_advance_documents || [],
        advance_paid: amountConfig.advance_paid || 0,
        remaining_amount: amountConfig.remaining_amount || 0,
      },
      acceptance_amount: amountConfig.acceptance_actual_total || 0,
      note: '',
    }
  }

  if (draft.document_type === 'payment_request') {
    const bank = getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {})
    return {
      ...baseData,
      payment_amount: amountConfig.payment_amount || 0,
      acceptance_document_id: formData.acceptance_document_id || '',
      acceptance_document_number: amountConfig.acceptance_document_number || formData.acceptance_document_number || '',
      acceptance_issued_date: amountConfig.acceptance_issued_date || formData.acceptance_issued_date || '',
      advance_deductions: formData.advance_deductions || [],
      note: String(formData.request_content || '').trim(),
      bank_account: formData.bank_account || formatEntityBankDetails(bank),
      bank_account_number: bank.account_number || '',
      bank_name: bank.bank_name || '',
      account_holder: bank.account_holder || '',
    }
  }

  return {
    ...baseData,
    form_data: {
      ...formData,
      bank_account: formData.bank_account || formatEntityBankDetails(getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {})),
    },
    advance_amount: amountConfig.advance_amount || 0,
    note: String(formData.request_content || '').trim(),
    bank_account: formData.bank_account || formatEntityBankDetails(getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {})),
    bank_account_number: getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {}).account_number || '',
    bank_name: getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {}).bank_name || '',
    account_holder: getBankDetailsFromFormData(formData, draft.contract_source?.seller_snapshot || {}).account_holder || '',
  }
}

function buildEditorDraft(document = null, documentType = 'advance_request', contract = {}, templates = [], documents = [], legalEntities = []) {
  const config = DOCUMENT_TYPES[document?.document_type || documentType] || DOCUMENT_TYPES.advance_request
  const template = document?.id
    ? null
    : getDefaultDocumentTemplate(templates, documentType)
  const resolvedDocumentType = document?.document_type || documentType
  const sellerEntityCode = document?.seller_entity_code || contract.seller_entity_code || template?.seller_entity_code || 'EVT'
  const sellerProfile = getSellerProfileForCode(sellerEntityCode, legalEntities)
  const sourceContract = {
    ...getOpenSyncedContract(document, contract),
    seller_entity_code: sellerProfile.entity_code || sellerEntityCode,
    seller_snapshot: sellerProfile,
  }
  const formData = buildDocumentFormData(document, resolvedDocumentType, sourceContract, documents, sellerProfile.entity_code || sellerEntityCode, legalEntities)
  if (!document?.id && resolvedDocumentType === 'acceptance_liquidation') {
    formData.hide_issued_date = true
  }
  const hideIssuedDate = Boolean(formData.hide_issued_date)
  return {
    id: document?.id || '',
    contract_id: document?.contract_id || contract.id || '',
    document_type: resolvedDocumentType,
    status: document?.status || 'draft',
    template_id: document?.template_id || template?.id || '',
    title: document?.title || template?.title || config.defaultTitle,
    seller_entity_code: sellerProfile.entity_code || sellerEntityCode,
    document_number_pattern: document?.document_number_pattern || template?.document_number_pattern || '',
    document_number: document?.document_number || '',
    sequence_number: Number(document?.sequence_number || 0),
    sequence_year: Number(document?.sequence_year || 0),
    issued_date: hideIssuedDate ? '' : toDateInputValue(document?.issued_date) || getTodayInputDate(),
    form_data: formData,
    contract_source: sourceContract,
    content_sections: Array.isArray(document?.content_sections) ? document.content_sections : template?.content_sections || [],
    terms_text: document?.terms_text ?? template?.terms_text ?? '',
    auto_sync_contract: document?.auto_sync_contract !== false,
    share_token: document?.share_token || '',
  }
}

export function buildDocumentPayload(draft = {}, templates = [], documents = []) {
  const selectedTemplate = templates.find(template => template.id === draft.template_id)
  const shouldRefreshTemplateSnapshot = Boolean(draft.id && draft.refresh_template_snapshot && selectedTemplate)
  return {
    id: draft.id || undefined,
    contract_id: draft.contract_id,
    document_type: draft.document_type,
    status: draft.status || 'draft',
    template_id: draft.template_id || undefined,
    title: draft.title,
    seller_entity_code: draft.seller_entity_code || undefined,
    document_number_pattern: draft.document_number_pattern || undefined,
    issued_date: draft.issued_date || null,
    auto_sync_contract: draft.auto_sync_contract,
    share_token: draft.share_token || undefined,
    refresh_template_snapshot: shouldRefreshTemplateSnapshot || undefined,
    template_snapshot: (!draft.id || shouldRefreshTemplateSnapshot) && selectedTemplate ? buildDocumentTemplateSnapshot(selectedTemplate) : undefined,
    content_sections: Array.isArray(draft.content_sections) ? draft.content_sections : undefined,
    terms_text: draft.terms_text,
    document_data: buildDocumentData(draft, documents),
  }
}

function CustomerValidationBanner({ contract }) {
  const warnings = getCustomerValidationWarnings(contract)
  if (!warnings.length) return null

  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="font-semibold">Thiếu thông tin khách hàng: </span>
        <span>{warnings.join(', ')}.</span>
        <span> Vẫn có thể lưu, phần export sẽ cảnh báo kỹ hơn.</span>
      </div>
    </div>
  )
}

function VatModeNotice({ vatConfig }) {
  const vatRate = Math.round(Number(vatConfig.vat_rate || 0) * 100)
  const label = vatConfig.has_vat === false
    ? 'Không áp VAT theo cấu hình hợp đồng.'
    : `VAT ${vatRate}% áp dụng chung cho toàn bảng theo hợp đồng.`
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
      {label}
    </div>
  )
}

function MoneySummary({ rows = [], vatConfig = {}, totalLabel = 'Tổng cộng' }) {
  const totals = calculateTableTotals(rows, vatConfig)
  return (
    <div className="grid gap-2 text-[13px] sm:grid-cols-3">
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Trước VAT</p>
        <p className="mt-1 font-bold text-slate-900">{formatQuoteCurrency(totals.subtotal)}đ</p>
      </div>
      <div className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">VAT</p>
        <p className="mt-1 font-bold text-slate-900">{formatQuoteCurrency(totals.vat_amount)}đ</p>
      </div>
      <div className="rounded-xl bg-orange-50 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-500">{totalLabel}</p>
        <p className="mt-1 font-bold text-orange-700">{formatQuoteCurrency(totals.total_amount)}đ</p>
      </div>
    </div>
  )
}

function AmountRowsEditor({
  title,
  rows,
  vatConfig,
  allowNegative = false,
  addLabel = 'Thêm dòng',
  resetLabel = '',
  onReset,
  onChange,
}) {
  const safeRows = Array.isArray(rows) ? rows : []

  function updateRow(index, patch) {
    onChange(safeRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  }

  function updateQuantity(index, value) {
    const row = safeRows[index] || {}
    const quantity = Math.max(0, Number(value || 0))
    const unitPrice = toDocumentNumber(row.unit_price, 0)
    updateRow(index, {
      quantity,
      amount: roundDocumentCurrency(quantity * unitPrice),
    })
  }

  function updateUnitPrice(index, value) {
    const row = safeRows[index] || {}
    const unitPrice = allowNegative ? parseSignedCurrencyInput(value) : parseCurrencyInput(value)
    const quantity = toDocumentNumber(row.quantity, 0) || 1
    updateRow(index, {
      unit_price: unitPrice,
      amount: roundDocumentCurrency(quantity * unitPrice),
    })
  }

  function updateAmount(index, value) {
    const amount = allowNegative ? parseSignedCurrencyInput(value) : parseCurrencyInput(value)
    updateRow(index, { amount })
  }

  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          {allowNegative ? <p className="mt-1 text-[12px] text-slate-500">Dòng phát sinh có thể nhập số âm ở cột thành tiền.</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {resetLabel && onReset ? (
            <button type="button" onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-3.5 w-3.5" />
              {resetLabel}
            </button>
          ) : null}
          <button type="button" onClick={() => onChange([...safeRows, makeAmountRow('line')])} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full table-fixed text-left text-[12px]">
          <colgroup>
            <col className="w-[39%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[6%]" />
          </colgroup>
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.06em] text-slate-500">
            <tr>
              <th className="break-words px-2 py-3">Nội dung</th>
              <th className="break-words px-2 py-3">ĐVT</th>
              <th className="break-words px-2 py-3 text-right">SL</th>
              <th className="break-words px-2 py-3 text-right">Đơn giá</th>
              <th className="break-words px-2 py-3 text-right">Thành tiền</th>
              <th className="px-0.5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {safeRows.length ? safeRows.map((row, index) => (
              <tr key={row.id || index} className="align-top">
                <td className="min-w-0 px-1.5 py-2">
                  <Textarea rows={1} value={row.description || ''} onChange={event => updateRow(index, { description: event.target.value })} placeholder="Tên hạng mục" className="min-h-10 resize-y break-words px-2 py-2 text-[12px] leading-5" />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <TextInput value={row.unit || ''} onChange={event => updateRow(index, { unit: event.target.value })} className="min-w-0 px-2 py-2 text-[12px]" />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <TextInput type="number" min="0" value={row.quantity ?? 1} onChange={event => updateQuantity(index, event.target.value)} className="min-w-0 px-2 py-2 text-right text-[12px]" />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <TextInput inputMode="numeric" value={formatCurrencyInput(row.unit_price)} onChange={event => updateUnitPrice(index, event.target.value)} className="min-w-0 px-2 py-2 text-right text-[12px]" />
                </td>
                <td className="min-w-0 px-1.5 py-2">
                  <TextInput inputMode="numeric" value={formatCurrencyInput(row.amount)} onChange={event => updateAmount(index, event.target.value)} className={`min-w-0 px-2 py-2 text-right text-[12px] font-semibold ${Number(row.amount || 0) < 0 ? 'text-red-600' : 'text-slate-900'}`} />
                </td>
                <td className="px-0.5 py-2 text-center">
                  <button type="button" onClick={() => onChange(safeRows.filter((_, rowIndex) => rowIndex !== index))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Xóa dòng">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có dòng giá trị.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <MoneySummary rows={safeRows} vatConfig={vatConfig} totalLabel={allowNegative ? 'Tổng nghiệm thu' : 'Tổng theo hợp đồng'} />
    </section>
  )
}

function AdvanceRequestEditor({ draft, updateFormData }) {
  const formData = draft.form_data || {}
  const contractValue = Number(formData.contract_value || 0)
  const advanceAmount = Number(formData.advance_amount || 0)

  function updateContractValue(value) {
    const nextValue = parseCurrencyInput(value)
    const percent = Number(formData.advance_percent || 0)
    updateFormData({
      contract_value: nextValue,
      sync_contract_value: false,
      advance_amount: calculateAdvanceAmount(nextValue, percent),
    })
  }

  function updateAdvancePercent(value) {
    const percent = Number(value || 0)
    updateFormData({
      advance_percent: percent,
      advance_amount: calculateAdvanceAmount(contractValue, percent),
    })
  }

  function updateAdvanceAmount(value) {
    const amount = parseCurrencyInput(value)
    updateFormData({
      advance_amount: amount,
      advance_percent: calculateAdvancePercent(contractValue, amount),
    })
  }

  function resetContractValue() {
    const value = getContractTotal(draft.contract_source || {})
    const percent = Number(formData.advance_percent || draft.contract_source?.payment_config?.deposit_percent || 0)
    updateFormData({
      contract_value: value,
      sync_contract_value: true,
      advance_percent: percent,
      advance_amount: calculateAdvanceAmount(value, percent),
    })
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)]">
        <Field label="Giá trị hợp đồng">
          <div className="relative">
            <TextInput inputMode="numeric" value={formatCurrencyInput(contractValue)} onChange={event => updateContractValue(event.target.value)} className="pr-20" />
            <button type="button" onClick={resetContractValue} className="absolute right-2 top-1/2 inline-flex h-7 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-orange-50 hover:text-orange-700" aria-label="Reset giá trị hợp đồng">
              Reset
            </button>
          </div>
        </Field>
        <Field label="Tỷ lệ tạm ứng (%)">
          <TextInput type="number" min="0" step="0.01" value={formData.advance_percent ?? 0} onChange={event => updateAdvancePercent(event.target.value)} />
        </Field>
        <Field label="Số tiền tạm ứng">
          <TextInput inputMode="numeric" value={formatCurrencyInput(advanceAmount)} onChange={event => updateAdvanceAmount(event.target.value)} className="font-semibold text-slate-900" />
        </Field>
      </div>

      <div className="grid gap-3 rounded-xl bg-slate-50 px-3 py-3 text-[13px] sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Giá trị hợp đồng</p>
          <p className="mt-1 font-bold text-slate-900">{formatQuoteCurrency(contractValue)}đ</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-500">Đề nghị tạm ứng</p>
          <p className="mt-1 font-bold text-orange-700">{formatQuoteCurrency(advanceAmount)}đ</p>
        </div>
      </div>
    </section>
  )
}

function AcceptanceLiquidationEditor({ draft, documents = [], showCostDifferenceFields = false, updateFormData }) {
  const formData = draft.form_data || {}
  const vatConfig = getContractVatConfig(draft.contract_source || {})

  function resetContractRows() {
    updateFormData({
      contract_rows: normalizeAmountRows(buildContractValueRows(draft.contract_source || {})),
      sync_contract_rows: true,
    })
  }

  function resetActualRows() {
    updateFormData({
      actual_rows: normalizeAmountRows(formData.contract_rows || buildContractValueRows(draft.contract_source || {})),
      sync_actual_rows: true,
    })
  }

  return (
    <section className="space-y-4">
      <VatModeNotice vatConfig={vatConfig} />
      <AcceptanceAdvanceReference draft={draft} documents={documents} updateFormData={updateFormData} />
      {showCostDifferenceFields ? (
        <>
          <AmountRowsEditor
            title="Bảng giá trị theo hợp đồng"
            rows={formData.contract_rows || []}
            vatConfig={vatConfig}
            resetLabel="Lấy lại từ hợp đồng"
            onReset={resetContractRows}
            onChange={rows => updateFormData({ contract_rows: rows, sync_contract_rows: false })}
          />
          <AmountRowsEditor
            title="Bảng giá trị nghiệm thu/thực tế"
            rows={formData.actual_rows || []}
            vatConfig={vatConfig}
            allowNegative
            addLabel="Thêm phát sinh"
            resetLabel="Copy bảng hợp đồng"
            onReset={resetActualRows}
            onChange={rows => updateFormData({ actual_rows: rows, sync_actual_rows: false })}
          />
        </>
      ) : null}
    </section>
  )
}

function AcceptanceAdvanceReference({ draft, documents = [], updateFormData }) {
  const formData = draft.form_data || {}
  const excludedAdvanceDocumentIds = normalizeDocumentIdList(formData.excluded_advance_document_ids || [])
  const excludedAdvanceDocumentIdSet = new Set(excludedAdvanceDocumentIds)
  const advanceDocuments = getContractAdvanceDocumentLinks(documents, draft.id || '')
  const selectedAdvanceDocuments = advanceDocuments.filter(document => !excludedAdvanceDocumentIdSet.has(String(document.document_id || '')))
  if (!advanceDocuments.length) return null

  const advanceTotal = calculateAdvanceDocumentsTotal(selectedAdvanceDocuments)

  function toggleAdvanceDocument(document) {
    const documentId = String(document.document_id || '')
    if (!documentId) return
    const isSelected = !excludedAdvanceDocumentIdSet.has(documentId)
    const nextExcludedAdvanceDocumentIds = isSelected
      ? normalizeDocumentIdList([...excludedAdvanceDocumentIds, documentId])
      : excludedAdvanceDocumentIds.filter(id => id !== documentId)
    const nextLinkedAdvanceDocuments = getContractAdvanceDocumentLinks(documents, draft.id || '', nextExcludedAdvanceDocumentIds)
    updateFormData({
      excluded_advance_document_ids: nextExcludedAdvanceDocumentIds,
      linked_advance_documents: nextLinkedAdvanceDocuments,
      advance_paid: calculateAdvanceDocumentsTotal(nextLinkedAdvanceDocuments),
    })
  }

  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/50 px-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold text-slate-700">Đề nghị tạm ứng liên quan</p>
        <p className="pr-2.5 text-[13px] font-bold tabular-nums text-blue-700">{formatQuoteCurrency(advanceTotal)}đ</p>
      </div>
      <div className="mt-2 space-y-1.5">
        {advanceDocuments.map(document => {
          const editUrl = getContractDocumentEditRoute(draft.contract_id, document)
          const label = formatContractDocumentNumberForDisplay(document.document_number) || document.document_title || document.document_id || 'Đề nghị tạm ứng'
          const documentId = String(document.document_id || '')
          const isSelected = !excludedAdvanceDocumentIdSet.has(documentId)
          return (
            <div
              key={document.document_id || label}
              className={`flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-[12px] font-semibold ${
                isSelected
                  ? 'border-orange-100 bg-white'
                  : 'border-slate-200 bg-white/70 text-slate-500'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleAdvanceDocument(document)}
                title={isSelected ? 'Đã tính khoản tạm ứng này vào BBNT' : 'Tính khoản tạm ứng này vào BBNT'}
                aria-label={`${isSelected ? 'Bỏ chọn' : 'Chọn'} đề nghị tạm ứng ${label}`}
                aria-pressed={isSelected}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-transparent transition ${
                  isSelected
                    ? 'border-blue-600 text-blue-600'
                    : 'border-blue-600 text-transparent hover:border-blue-700'
                }`}
              >
                {isSelected ? <Check className="h-4 w-4" /> : null}
              </button>
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className={`flex min-w-0 flex-1 items-center justify-between gap-3 ${
                  isSelected ? 'text-blue-700 hover:text-blue-800' : 'text-slate-500 hover:text-blue-700'
                }`}
              >
                <span className="min-w-0 flex items-center gap-1.5">
                  <span className="truncate">Đề nghị tạm ứng: {label}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </span>
                <span className="shrink-0 tabular-nums text-slate-700">{formatQuoteCurrency(document.advance_amount)}đ</span>
              </a>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function PaymentRequestEditor({ draft, documents, updateFormData }) {
  const formData = draft.form_data || {}
  const acceptanceDocuments = documents.filter(row => row.document_type === 'acceptance_liquidation' && row.id !== draft.id)
  const advanceDocuments = documents.filter(row => row.document_type === 'advance_request' && row.id !== draft.id)
  const amountConfig = buildDocumentAmountConfig(draft, documents)
  const selectedDeductions = new Map((formData.advance_deductions || []).map(row => [row.document_id, row]))
  const hasAdvanceDeduction = selectedDeductions.size > 0

  function selectAcceptance(documentId) {
    const selected = acceptanceDocuments.find(row => row.id === documentId)
    updateFormData({
      acceptance_document_id: documentId,
      acceptance_document_number: formatContractDocumentNumberForDisplay(selected?.document_number) || '',
      acceptance_issued_date: selected?.issued_date || '',
      acceptance_total: selected ? getAcceptanceDocumentTotal(selected) : 0,
    })
  }

  function toggleAdvance(document, checked) {
    const currentRows = formData.advance_deductions || []
    if (!checked) {
      updateFormData({ advance_deductions: currentRows.filter(row => row.document_id !== document.id) })
      return
    }

    const amount = getAdvanceDocumentAmount(document)
    updateFormData({
      advance_deductions: [
        ...currentRows.filter(row => row.document_id !== document.id),
        {
          document_id: document.id,
          document_number: formatContractDocumentNumberForDisplay(document.document_number) || '',
          document_title: document.title || '',
          original_amount: amount,
          deduction_amount: amount,
        },
      ],
    })
  }

  function selectNoAdvance() {
    updateFormData({ advance_deductions: [] })
  }

  function updateDeduction(documentId, value) {
    const amount = parseCurrencyInput(value)
    updateFormData({
      advance_deductions: (formData.advance_deductions || []).map(row => (
        row.document_id === documentId ? { ...row, deduction_amount: amount } : row
      )),
    })
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="BBNT liên quan">
          <Select value={formData.acceptance_document_id || ''} onChange={event => selectAcceptance(event.target.value)} disabled={!acceptanceDocuments.length}>
            <option value="">{acceptanceDocuments.length ? 'Chọn BBNT' : 'Chưa có BBNT để liên kết'}</option>
            {acceptanceDocuments.map(row => (
              <option key={row.id} value={row.id}>
                {getDocumentDisplayName(row)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tổng nghiệm thu từ BBNT">
          <TextInput readOnly value={formatCurrencyInput(amountConfig.acceptance_total)} className="bg-slate-50 font-semibold text-slate-900" />
        </Field>
      </div>

      {!acceptanceDocuments.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-800">
          Cần tạo BBNT trước khi lập đề nghị thanh toán.
        </div>
      ) : null}

      <section className="space-y-3 border-t border-slate-100 pt-4">
        <div>
          <h3 className="text-[14px] font-semibold text-slate-900">Khấu trừ tạm ứng</h3>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-hidden">
            <table className="w-full table-fixed text-left text-[12px]">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.1em] text-slate-500">
                <tr>
                  <th className="w-[36px] px-2 py-3" />
                  <th className="px-2 py-3">Đề nghị tạm ứng</th>
                  <th className="w-[148px] whitespace-nowrap px-2 py-3 text-right">Số tiền tạm ứng</th>
                  <th className="w-[154px] whitespace-nowrap px-2 py-3 text-right">Số tiền khấu trừ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="px-2 py-3 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={!hasAdvanceDeduction}
                      onChange={event => {
                        if (event.target.checked) selectNoAdvance()
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-[#f8981d] focus:ring-orange-100"
                    />
                  </td>
                  <td className="px-2 py-3 font-semibold text-slate-800">Khách chưa tạm ứng</td>
                  <td className="px-2 py-3 text-right tabular-nums text-slate-600">0đ</td>
                  <td className="px-2 py-2">
                    <TextInput readOnly value="0" className="bg-slate-50 text-right font-semibold text-slate-500" />
                  </td>
                </tr>
                {advanceDocuments.length ? advanceDocuments.map(row => {
                  const deduction = selectedDeductions.get(row.id)
                  const checked = Boolean(deduction)
                  return (
                    <tr key={row.id}>
                      <td className="px-2 py-3 text-center align-middle">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={event => toggleAdvance(row, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-[#f8981d] focus:ring-orange-100"
                        />
                      </td>
                      <td className="break-words px-2 py-3 font-semibold leading-5 text-slate-800">{getDocumentDisplayName(row)}</td>
                      <td className="px-2 py-3 text-right tabular-nums text-slate-600">{formatQuoteCurrency(getAdvanceDocumentAmount(row))}đ</td>
                      <td className="px-2 py-2">
                        <TextInput
                          inputMode="numeric"
                          value={checked ? formatCurrencyInput(deduction?.deduction_amount) : ''}
                          onChange={event => updateDeduction(row.id, event.target.value)}
                          disabled={!checked}
                          className="text-right font-semibold text-slate-900"
                        />
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-center text-slate-400">Chưa có đề nghị tạm ứng để khấu trừ.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid gap-2 text-[13px] sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Tổng nghiệm thu</p>
          <p className="mt-1 font-bold text-slate-900">{formatQuoteCurrency(amountConfig.acceptance_total)}đ</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Khấu trừ tạm ứng</p>
          <p className="mt-1 font-bold text-slate-900">{formatQuoteCurrency(amountConfig.advance_deduction_total)}đ</p>
        </div>
        <div className="rounded-xl bg-orange-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-orange-500">Còn thanh toán</p>
          <p className="mt-1 font-bold text-orange-700">{formatQuoteCurrency(amountConfig.payment_amount)}đ</p>
        </div>
      </div>

      {amountConfig.over_deduction_amount ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-700">
          Số khấu trừ đang vượt tổng nghiệm thu {formatQuoteCurrency(amountConfig.over_deduction_amount)}đ. Số tiền đề nghị thanh toán được tạm tính bằng 0đ.
        </div>
      ) : null}

    </section>
  )
}

export function ContractDocumentEditorForm({
  contract,
  documents,
  templates,
  document,
  documentType,
  saving,
  error,
  onCancel,
  onSave,
  onDraftChange,
  footerActions = null,
  variant = 'page',
}) {
  const { legalEntities } = useLegalEntities()
  const [draft, setDraft] = useState(() => buildEditorDraft(document, documentType, contract, templates, documents, legalEntities))
  const [pendingTemplateId, setPendingTemplateId] = useState('')
  const availableTemplates = templates.filter(template => template.document_type === draft.document_type)
  const isExistingDocument = Boolean(document?.id)
  const isFinalizedDocument = isExistingDocument && String(document?.status || draft.status || '').toLowerCase() === 'finalized'
  const dateLabel = draft.document_type === 'acceptance_liquidation' ? 'Ngày nghiệm thu' : 'Ngày lập'
  const isPage = variant === 'page'

  function updateDraft(patch) {
    setDraft(prev => ({ ...prev, ...patch }))
  }

  function updateFormData(patch) {
    setDraft(prev => ({ ...prev, form_data: { ...(prev.form_data || {}), ...patch } }))
  }

  useEffect(() => {
    if (onDraftChange) onDraftChange(draft)
  }, [draft])

  function buildSellerEntityPatch(entityCode) {
    const sellerProfile = getSellerProfileForCode(entityCode, legalEntities)
    const bank = getEntityBankDetails(sellerProfile)
    return {
      seller_entity_code: sellerProfile.entity_code || entityCode,
      contract_source: {
        ...(draft.contract_source || {}),
        seller_entity_code: sellerProfile.entity_code || entityCode,
        seller_snapshot: sellerProfile,
      },
      form_data: {
        ...(draft.form_data || {}),
        bank_account: formatEntityBankDetails(bank),
        bank_account_number: bank.account_number,
        bank_name: bank.bank_name,
        account_holder: bank.account_holder,
      },
    }
  }

  function handleSellerEntityChange(entityCode) {
    const sellerPatch = buildSellerEntityPatch(entityCode)
    const resolvedSellerCode = sellerPatch.seller_entity_code || entityCode
    const nextDocumentNumber = draft.id && draft.document_number_pattern && draft.sequence_number
      ? renderContractDocumentNumber(draft.document_number_pattern, {
          sequence: String(draft.sequence_number).padStart(4, '0'),
          document_type: draft.document_type,
          document_type_code: DOCUMENT_TYPES[draft.document_type]?.code || String(draft.document_type || '').toUpperCase(),
          seller: resolvedSellerCode,
          customer: getContractDocumentCustomerCode(draft.contract_source || contract),
          year: String(draft.sequence_year || new Date().getFullYear()),
        })
      : draft.document_number
    updateDraft({
      ...sellerPatch,
      document_number: nextDocumentNumber,
    })
  }

  function applyTemplate(templateId) {
    const template = availableTemplates.find(row => row.id === templateId)
    if (!template) {
      if (isExistingDocument) return
      updateDraft({ template_id: '' })
      return
    }

    if (isExistingDocument) {
      const sellerProfile = getSellerProfileForCode(draft.seller_entity_code, legalEntities)
      const sourceContract = {
        ...(draft.contract_source || {}),
        seller_entity_code: sellerProfile.entity_code || draft.seller_entity_code,
        seller_snapshot: sellerProfile,
      }
      updateDraft({
        template_id: template.id,
        title: template.title || DOCUMENT_TYPES[draft.document_type]?.defaultTitle || draft.title,
        contract_source: sourceContract,
        form_data: buildDocumentFormData(null, draft.document_type, sourceContract, documents, sellerProfile.entity_code || draft.seller_entity_code, legalEntities),
        content_sections: Array.isArray(template.content_sections) ? template.content_sections : [],
        terms_text: template.terms_text || '',
        refresh_template_snapshot: true,
      })
      return
    }

    const sellerPatch = buildSellerEntityPatch(template.seller_entity_code || draft.seller_entity_code)
    updateDraft({
      template_id: template.id,
      title: template.title || draft.title,
      ...sellerPatch,
      document_number_pattern: template.document_number_pattern || draft.document_number_pattern,
      content_sections: Array.isArray(template.content_sections) ? template.content_sections : [],
      terms_text: template.terms_text || '',
    })
  }

  function handleTemplateSelect(templateId) {
    if (!templateId && isExistingDocument) return
    if (templateId === (draft.template_id || '')) return
    if (isExistingDocument) {
      setPendingTemplateId(templateId)
      return
    }
    applyTemplate(templateId)
  }

  function confirmTemplateReset() {
    applyTemplate(pendingTemplateId)
    setPendingTemplateId('')
  }

  function renderTypeEditor() {
    if (draft.document_type === 'acceptance_liquidation') {
      const selectedTemplate = availableTemplates.find(template => template.id === draft.template_id)
      const showCostDifferenceFields = hasAcceptanceCostDifference({
        ...draft,
        fields_config: selectedTemplate?.fields_config,
        template_snapshot: selectedTemplate ? { fields_config: selectedTemplate.fields_config } : undefined,
      })
      return <AcceptanceLiquidationEditor draft={draft} documents={documents} showCostDifferenceFields={showCostDifferenceFields} updateFormData={updateFormData} />
    }
    if (draft.document_type === 'payment_request') {
      return <PaymentRequestEditor draft={draft} documents={documents} updateFormData={updateFormData} />
    }
    return <AdvanceRequestEditor draft={draft} updateFormData={updateFormData} />
  }

  function submit(event) {
    event.preventDefault()
    onSave(draft)
  }

  function handleHideIssuedDateChange(checked) {
    updateDraft({
      issued_date: checked ? '' : getTodayInputDate(),
      form_data: {
        ...(draft.form_data || {}),
        hide_issued_date: checked,
      },
    })
  }

  const title = document?.id
    ? `Sửa ${DOCUMENT_TYPES[draft.document_type]?.label || 'chứng từ'}`
    : DOCUMENT_TYPES[draft.document_type]?.actionLabel || 'Tạo chứng từ'

  const pendingTemplate = availableTemplates.find(template => template.id === pendingTemplateId)

  return (
    <>
    <form onSubmit={submit} className={isPage ? 'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm' : 'flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-950">
              {title}
              {draft.document_number ? (
                <span className="ml-2 text-[#f8981d]">{formatContractDocumentNumberForDisplay(draft.document_number)}</span>
              ) : null}
            </h2>
            {!draft.document_number ? (
              <p className="mt-1 text-[12px] font-semibold text-slate-500">Số chứng từ sẽ được cấp khi lưu lần đầu.</p>
            ) : null}
          </div>
          <button type="button" onClick={onCancel} className="inline-flex h-8 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
        </header>

        <div className={isPage ? 'space-y-4 p-5' : 'min-h-0 flex-1 space-y-4 overflow-y-auto p-5'}>
          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mẫu chứng từ">
                <Select
                  value={draft.template_id || ''}
                  onChange={event => handleTemplateSelect(event.target.value)}
                  disabled={isFinalizedDocument || !availableTemplates.length}
                >
                  <option value="" disabled={isExistingDocument}>{availableTemplates.length ? 'Không dùng mẫu' : 'Chưa có mẫu đang bật'}</option>
                  {availableTemplates.map(template => (
                    <option key={template.id} value={template.id}>
                      {template.name}{template.is_default ? ' (Default)' : ''}
                    </option>
                  ))}
                </Select>
                {isFinalizedDocument ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Chứng từ đã finalized nên không thể đổi mẫu.</p>
                ) : isExistingDocument ? (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-600">Đổi mẫu sẽ reset nội dung chứng từ sau khi xác nhận.</p>
                ) : null}
              </Field>
              <Field label="Số chứng từ">
                <TextInput value={formatContractDocumentNumberForDisplay(draft.document_number) || 'Tự cấp khi lưu'} readOnly className="bg-slate-50 font-semibold text-slate-700" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pattern số chứng từ">
                <TextInput value={draft.document_number_pattern || ''} onChange={event => updateDraft({ document_number_pattern: event.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-[116px_minmax(0,1fr)]">
                <Field label="Pháp nhân">
                  <Select
                    value={draft.seller_entity_code || ''}
                    onChange={event => handleSellerEntityChange(event.target.value)}
                    disabled={isFinalizedDocument}
                    className="appearance-none px-2 pr-2"
                    style={{ appearance: 'none', WebkitAppearance: 'none', backgroundImage: 'none' }}
                  >
                    {!legalEntities.length ? <option value={draft.seller_entity_code || ''}>{draft.seller_entity_code || 'EVT'}</option> : null}
                    {legalEntities.map(entity => {
                      const code = getLegalEntityCode(entity)
                      return (
                        <option key={code} value={code}>
                          {getLegalEntityLabel(entity)}
                        </option>
                      )
                    })}
                  </Select>
                </Field>
                <div>
                  <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">{dateLabel}</span>
                  <div className={`flex h-10 overflow-hidden rounded-xl border border-slate-200 transition focus-within:border-[#f8981d] focus-within:ring-2 focus-within:ring-orange-100 ${
                    draft.form_data?.hide_issued_date ? 'bg-slate-50' : 'bg-white'
                  }`}>
                    <input
                      type="date"
                      value={draft.issued_date || ''}
                      onChange={event => updateDraft({ issued_date: event.target.value })}
                      disabled={Boolean(draft.form_data?.hide_issued_date)}
                      aria-label={dateLabel}
                      className="min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] outline-none disabled:text-slate-400"
                    />
                    <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 border-l border-slate-200 px-2.5 text-[12px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.form_data?.hide_issued_date)}
                        onChange={event => handleHideIssuedDateChange(event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#f8981d] focus:ring-orange-100"
                      />
                      Ẩn
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CustomerValidationBanner contract={draft.contract_source || contract} />
          {renderTypeEditor()}

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={draft.auto_sync_contract}
              onChange={event => updateDraft({
                auto_sync_contract: event.target.checked,
                contract_source: event.target.checked
                  ? {
                    ...getOpenSyncedContract(document, contract),
                    seller_entity_code: draft.seller_entity_code,
                    seller_snapshot: getSellerProfileForCode(draft.seller_entity_code, legalEntities),
                  }
                  : draft.contract_source,
              })}
              className="h-4 w-4 rounded border-slate-300 text-[#f8981d] focus:ring-orange-100"
            />
            Tự đồng bộ thông tin hợp đồng khi cập nhật chứng từ
          </label>

          {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
        </div>

        <footer className="flex flex-wrap justify-end gap-1.5 border-t border-slate-200 bg-white px-5 py-3.5">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          {footerActions}
          <button type="submit" disabled={saving} className="inline-flex min-w-[88px] items-center justify-center gap-1.5 rounded-lg bg-[#f8981d] px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50">
            <FileText className="h-4 w-4" />
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </footer>
    </form>
    {pendingTemplate ? (
      <TemplateResetConfirmModal
        templateName={pendingTemplate.name}
        onCancel={() => setPendingTemplateId('')}
        onConfirm={confirmTemplateReset}
      />
    ) : null}
    </>
  )
}

function TemplateResetConfirmModal({ templateName, onCancel, onConfirm }) {
  useEscapeToClose(onCancel)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Thay đổi mẫu chứng từ</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Áp mẫu <span className="font-semibold text-slate-950">{templateName || 'mới'}</span> sẽ xóa toàn bộ nội dung đã chỉnh trong chứng từ hiện tại và tạo lại nội dung theo mẫu mới. Số chứng từ đã cấp vẫn được giữ nguyên.
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            Hủy
          </button>
          <button type="button" onClick={onConfirm} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-amber-700">
            <RefreshCw className="h-4 w-4" />
            Áp mẫu mới
          </button>
        </div>
      </section>
    </div>
  )
}

export function DeleteDocumentConfirmModal({ document, deleting, error, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!deleting) onCancel?.()
  }, Boolean(document) && !deleting)

  if (!document) return null
  const documentLabel = DOCUMENT_TYPES[document.document_type]?.label || document.document_type || 'Chứng từ'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Kiểm tra lại thông tin trước khi xóa</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Chứng từ này sẽ bị xóa khỏi hợp đồng, Số chứng từ đã cấp sẽ không được dùng lại.
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px]">
          <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
            <dt className="font-semibold text-slate-500">Loại</dt>
            <dd className="font-semibold text-slate-950">{documentLabel}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
            <dt className="font-semibold text-slate-500">Số</dt>
            <dd className="font-semibold text-slate-950">{formatContractDocumentNumberForDisplay(document.document_number) || '-'}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
            <dt className="font-semibold text-slate-500">Tiêu đề</dt>
            <dd className="min-w-0 break-words text-slate-700">{document.title || '-'}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[96px_minmax(0,1fr)]">
            <dt className="font-semibold text-slate-500">Ngày lập</dt>
            <dd className="text-slate-700">{formatQuoteDate(document.issued_date) || '-'}</dd>
          </div>
        </dl>
        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={deleting} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="button" onClick={onConfirm} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Đang xóa...' : 'Xóa chứng từ'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function ContractDocumentsSidebarCard({ contract, comparisonContract = null, quote = null }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const canManageDocuments = Boolean(contract?.id)
  const linkedDocuments = useMemo(() => documents.filter(document => Boolean(document?.id)), [documents])

  useEffect(() => {
    let mounted = true
    if (!contract?.id) {
      setDocuments([])
      setLoading(false)
      return
    }

    async function load() {
      setLoading(true)
      setError('')
      try {
        const rows = await listContractDocuments(contract.id)
        if (mounted) setDocuments(rows)
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được chứng từ hợp đồng.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [contract?.id])

  function openNewDocument(documentType) {
    setMenuOpen(false)
    setNotice('')
    navigate(getNewContractDocumentRoute(contract, documentType))
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <ContractEntityMismatchPopup
        contract={comparisonContract || contract}
        quote={quote}
        documents={documents}
      />
      <NoticePopup message={notice} onClose={() => setNotice('')} />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#d97706]">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[14px] font-semibold text-slate-900">Chứng từ liên quan</h2>
              {linkedDocuments.length ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {linkedDocuments.length}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={!canManageDocuments}
            onClick={() => navigate(getContractDocumentsRoute(contract))}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            aria-label="Mở danh sách chứng từ"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              disabled={!canManageDocuments}
              onClick={() => setMenuOpen(prev => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#f8981d] text-white shadow-sm hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              aria-label="Tạo chứng từ"
            >
              <Plus className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-30 mt-2 w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {Object.entries(DOCUMENT_TYPES).map(([documentType, config]) => (
                  <button
                    key={documentType}
                    type="button"
                    onClick={() => openNewDocument(documentType)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                  >
                    <FileText className="h-4 w-4 text-slate-400" />
                    {config.actionLabel}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {!canManageDocuments ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
          Bạn cần lưu hợp đồng trước khi tạo chứng từ.
        </p>
      ) : null}

      {error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p> : null}

      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-500">Đang tải chứng từ...</p>
        ) : linkedDocuments.length ? linkedDocuments.map(document => {
          const editUrl = getContractDocumentEditRoute(contract, document)
          return (
            <a
              key={document.id}
              href={editUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-slate-100 px-3 py-2.5 hover:border-orange-200 hover:bg-orange-50/60"
            >
              <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-blue-700 group-hover:text-blue-800">
                <span className="truncate">{DOCUMENT_TYPES[document.document_type]?.label || document.document_type}</span>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-500">
                  {formatQuoteDate(document.issued_date) || '-'}
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </span>
            </a>
          )
        }) : (
          <p className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-500">
            Chưa có chứng từ.
          </p>
        )}
      </div>

    </section>
  )
}

export default function ContractDocumentsPanel({ contract }) {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState(null)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')

  const canManageDocuments = Boolean(contract?.id)
  const acceptanceDocumentCount = useMemo(
    () => documents.filter(row => row.document_type === 'acceptance_liquidation').length,
    [documents],
  )

  async function loadDocuments() {
    if (!contract?.id) return
    setLoading(true)
    setError('')
    try {
      const rows = await listContractDocuments(contract.id)
      setDocuments(rows)
    } catch (err) {
      setError(err?.message || 'Không tải được chứng từ hợp đồng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    if (!contract?.id) {
      setDocuments([])
      return
    }

    async function load() {
      setLoading(true)
      setError('')
      try {
        const rows = await listContractDocuments(contract.id)
        if (mounted) setDocuments(rows)
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được chứng từ hợp đồng.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [contract?.id])

  function openNewDocument(documentType) {
    setMenuOpen(false)
    setNotice('')
    navigate(getNewContractDocumentRoute(contract, documentType))
  }

  function openEditDocument(document) {
    setNotice('')
    navigate(getContractDocumentEditRoute(contract, document))
  }

  async function handleCopyLink(document) {
    const url = getPublicDocumentUrl(document)
    if (!url) return
    try {
      await navigator.clipboard?.writeText(url)
      setNotice('Đã copy public link chứng từ.')
    } catch {
      setNotice('Không copy tự động được, bạn có thể mở link từ dòng chứng từ.')
    }
  }

  async function confirmDeleteDocument() {
    if (!documentToDelete?.id) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteContractDocument(documentToDelete.id)
      setDocumentToDelete(null)
      await loadDocuments()
      setNotice('Đã xóa chứng từ.')
    } catch (err) {
      setDeleteError(err?.message || 'Không xóa được chứng từ.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <ContractEntityMismatchPopup contract={contract} documents={documents} />
      <NoticePopup message={notice} onClose={() => setNotice('')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#d97706]">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Chứng từ</h2>
            <p className="mt-1 text-[12px] text-slate-500">Quản lý chứng từ phát sinh theo hợp đồng.</p>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            disabled={!canManageDocuments}
            onClick={() => setMenuOpen(prev => !prev)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <Plus className="h-4 w-4" />
            Tạo chứng từ
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {Object.entries(DOCUMENT_TYPES).map(([documentType, config]) => (
                <button
                  key={documentType}
                  type="button"
                  onClick={() => openNewDocument(documentType)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                >
                  <FileText className="h-4 w-4 text-slate-400" />
                  {config.actionLabel}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {!canManageDocuments ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
          Bạn cần lưu hợp đồng trước khi tạo chứng từ.
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Loại chứng từ</th>
                <th className="px-4 py-3">Số chứng từ</th>
                <th className="px-4 py-3 text-right">Giá trị</th>
                <th className="px-4 py-3">Link gửi khách hàng</th>
                <th className="px-4 py-3">Ngày lập</th>
                <th className="px-4 py-3">Cập nhật</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Đang tải chứng từ...</td></tr>
              ) : documents.length ? documents.map(document => {
                const publicUrl = getPublicDocumentUrl(document)
                const amount = getDocumentAmount(document)
                const exportWarnings = getContractDocumentValidationWarnings(document)
                return (
                  <tr key={document.id} className="hover:bg-orange-50/40">
                    <td className="px-4 py-3 font-semibold text-slate-800">{DOCUMENT_TYPES[document.document_type]?.label || document.document_type}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEditDocument(document)}
                        className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                      >
                        {formatContractDocumentNumberForDisplay(document.document_number) || '-'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-800">{amount ? `${formatQuoteCurrency(amount)}đ` : '-'}</td>
                    <td className="px-4 py-3">
                      {publicUrl ? (
                        <div className="flex min-w-0 items-center gap-2">
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-blue-50 px-3 text-[12px] font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800" aria-label="Mở link gửi khách hàng">
                            <Link className="h-3.5 w-3.5 shrink-0" />
                            Mở link
                          </a>
                          <button type="button" onClick={() => handleCopyLink(document)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700" aria-label="Copy public link">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatQuoteDate(document.issued_date)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatQuoteDate(document.updated_at || document.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <ContractDocumentPDFDownloadButton
                          document={document}
                          warnBeforeDownload
                          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold shadow-sm ${exportWarnings.length ? 'text-amber-600 hover:border-amber-200 hover:bg-amber-50' : 'text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'}`}
                          aria-label="Tải PDF chứng từ"
                          title={exportWarnings.length ? `Thiếu trước export: ${exportWarnings.join(', ')}` : 'Tải PDF'}
                        >
                          Tải PDF
                        </ContractDocumentPDFDownloadButton>
                        <ContractDocumentDocxDownloadButton
                          document={document}
                          warnBeforeDownload
                          className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-semibold shadow-sm ${exportWarnings.length ? 'text-amber-600 hover:border-amber-200 hover:bg-amber-50' : 'text-slate-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700'}`}
                          aria-label="Tải DOCX chứng từ"
                          title={exportWarnings.length ? `Thiếu trước export: ${exportWarnings.join(', ')}` : 'Tải DOCX'}
                        >
                          Tải Docx
                        </ContractDocumentDocxDownloadButton>
                        <button type="button" onClick={() => {
                          setDeleteError('')
                          setDocumentToDelete(document)
                        }} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label="Xóa chứng từ">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    {canManageDocuments ? 'Chưa có chứng từ cho hợp đồng này.' : 'Chứng từ sẽ hiển thị sau khi hợp đồng được lưu.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
          <Check className="h-3.5 w-3.5" />
          Public link riêng cho từng chứng từ
        </span>
        <span>{acceptanceDocumentCount ? `${acceptanceDocumentCount} BBNT có thể liên kết với đề nghị thanh toán.` : 'Tạo BBNT trước khi tạo đề nghị thanh toán.'}</span>
      </div>

      {documentToDelete ? (
        <DeleteDocumentConfirmModal
          document={documentToDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setDocumentToDelete(null)
            setDeleteError('')
          }}
          onConfirm={confirmDeleteDocument}
        />
      ) : null}
    </section>
  )
}
