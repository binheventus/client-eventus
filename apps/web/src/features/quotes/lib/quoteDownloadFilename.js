import { isMediaMonsterEntityCode } from './entityCodes.js'

function sanitizeQuoteFilenamePart(value = '', fallback = '') {
  const cleaned = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'D')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .slice(0, 64)

  return cleaned || fallback
}

function getQuoteClientName(quote = {}) {
  return quote.client_name || quote.customer_name || quote.client?.name || 'Khach'
}

function getQuoteNumber(quote = {}) {
  return String(quote.quote_number || quote.id || quote.share_token || 'DRAFT').replace(/^#/, '')
}

function getQuoteEntityLabel(quote = {}) {
  return isMediaMonsterEntityCode(quote.entity_code) ? 'Mediamonster' : 'Eventus'
}

export function getQuoteDownloadFilename(quote = {}, extension = 'pdf') {
  const entityLabel = getQuoteEntityLabel(quote)
  const clientName = sanitizeQuoteFilenamePart(getQuoteClientName(quote), 'Khach')
  const quoteNumber = sanitizeQuoteFilenamePart(getQuoteNumber(quote), 'DRAFT')
  const safeExtension = sanitizeQuoteFilenamePart(extension, 'pdf').toLowerCase()

  return `Bao gia - ${entityLabel} - ${clientName} - ${quoteNumber}.${safeExtension}`
}
