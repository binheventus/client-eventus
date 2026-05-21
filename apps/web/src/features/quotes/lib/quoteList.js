export const QUOTE_LIST_PAGE_SIZE = 20

export const DEFAULT_QUOTE_LIST_FILTERS = {
  search: '',
  status: '',
  tier_code: '',
  entity_code: '',
  date_from: '',
  date_to: '',
}

export const QUOTE_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
]

export const QUOTE_TIER_OPTIONS = [
  { value: '', label: 'Tất cả tier' },
  { value: 'TIER_1', label: 'TIER_1' },
  { value: 'TIER_2', label: 'TIER_2' },
  { value: 'TIER_3', label: 'TIER_3' },
]

export const QUOTE_ENTITY_OPTIONS = [
  { value: '', label: 'Tất cả pháp nhân' },
  { value: 'EVENTUS', label: 'Eventus' },
  { value: 'MEDIAMONSTER', label: 'Mediamonster' },
]

const STATUS_TONES = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

export function formatQuoteCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

export function formatQuoteDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

export function getQuoteClientName(quote = {}) {
  return quote.client_name || quote.customer_name || quote.client?.name || '-'
}

export function getQuoteCreatorName(quote = {}, userContext = {}) {
  const currentUserName = userContext.name
  return quote.created_by_name || quote.sales_name || currentUserName || quote.created_by || '-'
}

export function getQuoteStatusLabel(status) {
  return status || 'draft'
}

export function getQuoteStatusTone(status) {
  return STATUS_TONES[String(status || 'draft').toLowerCase()] || STATUS_TONES.draft
}

export function canCreateContractFromQuote(quote = {}) {
  return Boolean(quote?.id) && !quote.deleted_at && String(quote.status || 'draft').toLowerCase() !== 'draft'
}

export function hasSavedContract(quote = {}) {
  return Boolean(quote?.has_saved_contract || quote?.contract_id)
}

export function canOpenContractFromQuote(quote = {}) {
  return Boolean(quote?.id) && !quote.deleted_at && (hasSavedContract(quote) || canCreateContractFromQuote(quote))
}

export function getTotalQuotePages(count, pageSize = QUOTE_LIST_PAGE_SIZE) {
  return Math.max(1, Math.ceil((Number(count) || 0) / Math.max(Number(pageSize) || 1, 1)))
}

export function buildAccessibleQuoteFilters(filters = {}) {
  return { ...filters }
}

export function getAutoLoadFilterKey(filters = {}) {
  const { search: _search, ...autoLoadFilters } = filters
  return JSON.stringify(autoLoadFilters)
}
