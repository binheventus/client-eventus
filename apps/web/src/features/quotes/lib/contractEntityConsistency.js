import {
  findLegalEntityByCode,
  getLegalEntityCode,
  getLegalEntityLabel,
} from './contractDefaults.js'
import { formatContractDocumentNumberForDisplay } from './contractDocumentEditor.js'
import { CONTRACT_DOCUMENT_TYPES } from './contractDocumentTemplates.js'
import { normalizeLegalEntityCode } from './entityCodes.js'

function resolveComparableEntityCode(value = '', legalEntities = []) {
  const entity = findLegalEntityByCode(value, legalEntities)
  return normalizeLegalEntityCode(getLegalEntityCode(entity || {}) || value)
}

function getEntityDisplayName(value = '', legalEntities = []) {
  const entity = findLegalEntityByCode(value, legalEntities)
  return getLegalEntityLabel(entity || {}) || value || 'Chưa xác định'
}

function getDocumentWarningName(document = {}) {
  const typeLabel = CONTRACT_DOCUMENT_TYPES[document.document_type]?.label || document.document_type || 'Chứng từ'
  const number = formatContractDocumentNumberForDisplay(document.document_number).trim()
  return number ? `${typeLabel} ${number}` : typeLabel
}

function getQuoteWarningName(quote = {}) {
  const number = String(quote.quote_number || '').trim()
  return number ? `Báo giá ${number}` : 'Báo giá'
}

function shouldCompareQuoteEntity(contract = {}, quote = null) {
  if (!quote) return false
  if (quote?.id || contract?.quote_id) return true
  return String(contract?.source_type || '').toLowerCase() === 'quote'
}

export function getContractEntityMismatchWarning({
  contract = {},
  quote = null,
  documents = [],
  currentDocument = null,
  legalEntities = [],
} = {}) {
  const contractEntityCode = resolveComparableEntityCode(contract?.seller_entity_code, legalEntities)
  if (!contractEntityCode) return null

  const rows = Array.isArray(documents) ? [...documents] : []
  if (currentDocument?.document_type && currentDocument?.seller_entity_code) {
    const currentIndex = currentDocument.id
      ? rows.findIndex(row => row.id === currentDocument.id)
      : -1
    if (currentIndex >= 0) rows[currentIndex] = currentDocument
    else rows.push(currentDocument)
  }

  const documentMismatches = rows
    .filter(document => document?.document_type && document?.seller_entity_code)
    .map(document => ({
      id: document.id || `${document.document_type}:${document.document_number || 'draft'}`,
      name: getDocumentWarningName(document),
      entityCode: resolveComparableEntityCode(document.seller_entity_code, legalEntities),
      entityLabel: getEntityDisplayName(document.seller_entity_code, legalEntities),
    }))
    .filter(document => document.entityCode && document.entityCode !== contractEntityCode)

  const quoteEntityCode = shouldCompareQuoteEntity(contract, quote)
    ? resolveComparableEntityCode(quote?.entity_code, legalEntities)
    : ''
  const quoteMismatch = quoteEntityCode && quoteEntityCode !== contractEntityCode
    ? {
        id: quote.id || contract.quote_id || 'linked-quote',
        name: getQuoteWarningName(quote),
        entityCode: quoteEntityCode,
        entityLabel: getEntityDisplayName(quote.entity_code, legalEntities),
      }
    : null
  const mismatches = [
    ...(quoteMismatch ? [quoteMismatch] : []),
    ...documentMismatches,
  ]

  if (!mismatches.length) return null

  const contractEntityLabel = getEntityDisplayName(contract?.seller_entity_code, legalEntities)
  return {
    title: 'Cảnh báo pháp nhân không đồng nhất',
    description: `Hợp đồng đang dùng pháp nhân ${contractEntityLabel}, nhưng các file sau đang dùng pháp nhân khác:`,
    items: mismatches.map(document => (
      `${document.name} đang dùng pháp nhân ${document.entityLabel}`
    )),
    signature: [
      contractEntityCode,
      ...mismatches.map(document => `${document.id}:${document.entityCode}`).sort(),
    ].join('|'),
  }
}
