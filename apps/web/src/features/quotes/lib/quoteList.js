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
  { value: 'sent', label: 'Đã lấy link gửi khách' },
]

export const QUOTE_TIER_OPTIONS = [
  { value: '', label: 'Tất cả tier' },
  { value: 'TIER_1', label: 'TIER_1' },
  { value: 'TIER_2', label: 'TIER_2' },
  { value: 'TIER_3', label: 'TIER_3' },
]

export const QUOTE_ENTITY_OPTIONS = [
  { value: '', label: 'Tất cả pháp nhân' },
  { value: 'EVT', label: 'Eventus' },
  { value: 'MMT', label: 'Mediamonster' },
]

const MUTED_STATUS_TONE = 'bg-slate-100 text-slate-500'

const STATUS_TONES = {
  sent: MUTED_STATUS_TONE,
  accepted: MUTED_STATUS_TONE,
  rejected: MUTED_STATUS_TONE,
}

const STATUS_LABELS = {
  sent: 'Đã lấy link gửi khách',
  accepted: 'Accepted',
  rejected: 'Rejected',
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
  const normalized = String(status || 'sent').toLowerCase()
  return STATUS_LABELS[normalized] || status || STATUS_LABELS.sent
}

export function getQuoteStatusTone(status) {
  return STATUS_TONES[String(status || 'sent').toLowerCase()] || MUTED_STATUS_TONE
}

export function canCreateContractFromQuote(quote = {}) {
  return Boolean(quote?.id) && !quote.deleted_at
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
