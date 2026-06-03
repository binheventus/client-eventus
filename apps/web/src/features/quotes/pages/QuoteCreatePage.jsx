import { useEffect, useMemo, useState } from 'react'
import { PencilLine, Stamp } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import EntitySelector from '../components/EntitySelector'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import QuoteChatInput from '../components/QuoteChatInput'
import QuoteItemsTable from '../components/QuoteItemsTable'
import QuotePreview from '../components/QuotePreview'
import { useBusinessRules } from '../hooks/useBusinessRules'
import { useServiceGroups } from '../hooks/useServiceGroups'
import { useCustomerTiers } from '../hooks/useCustomerTiers'
import { useLegalEntities } from '../hooks/useLegalEntities'
import { createQuote, getQuote, listQuoteClients, updateQuote } from '../hooks/useQuotes'
import { useServices } from '../hooks/useServices'
import { useTravelFees } from '../hooks/useTravelFees'
import { parseQuoteInput } from '../lib/aiParser'
import { calculateQuotePricing, findServiceForQuoteItem } from '../lib/pricingCalculator'
import { getQuoteActorPayload, getQuoteUserContext } from '../lib/quoteAuth'
import { getDefaultQuoteTermsText, getQuoteTerms, normalizeQuoteTermsText } from '../lib/quoteTerms'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'

const DEFAULT_QUOTE = {
  entity_code: 'EVENTUS',
  event_name: '',
  event_date: '',
  location: '',
  duration_hours: '4',
  tier_code: 'TIER_2',
  client_id: '',
  client_name: 'Mr. ',
  validity_days: 15,
  has_vat: true,
  show_stamp: false,
  terms_text: '',
  status: 'sent',
  sent_at: null,
}

const FIELD_LABELS = {
  location: 'Địa điểm',
  duration_hours: 'Thời lượng',
  items: 'Hạng mục',
  editing_service: 'Dựng',
}

const OPTIONAL_PARSE_FIELDS = new Set(['event_date', 'event_name', 'duration_hours'])

const CUSTOM_ITEM_PLACEMENTS = [
  { value: 'after_photo', label: 'Ngay dưới hạng mục chụp ảnh', sortRank: 0.5 },
  { value: 'after_video', label: 'Ngay dưới hạng mục quay', sortRank: 3.5 },
  { value: 'after_mixer', label: 'Ngay dưới hạng mục bàn trộn', sortRank: 6.5 },
  { value: 'after_editing', label: 'Ngay dưới hạng mục dựng', sortRank: 8.5 },
  { value: 'top', label: 'Trên cùng', sortRank: -1 },
  { value: 'bottom', label: 'Dưới cùng', sortRank: 99 },
]

const DEFAULT_CUSTOM_ITEM_PLACEMENT = 'bottom'
const CUSTOM_ITEM_UNIT_OPTIONS = ['Người', 'Gói', 'Video', 'Ảnh', 'Thiết bị']
const FALLBACK_GROUPS = {
  PHOTO: { group_code: 'PHOTO', group_label: 'Hạng mục chụp ảnh', group_sort_order: 1 },
  VIDEO: { group_code: 'VIDEO', group_label: 'Hạng mục quay phim', group_sort_order: 2 },
  LIVESTREAM: { group_code: 'LIVESTREAM', group_label: 'Hạng mục livestream', group_sort_order: 3 },
  POST: { group_code: 'POST', group_label: 'Hạng mục hậu kỳ', group_sort_order: 4 },
  OTHER: { group_code: 'OTHER', group_label: 'Chi phí khác', group_sort_order: 99 },
}

function getInitialSalesBrief(search = '', isEditMode = false) {
  if (isEditMode) return ''
  return new URLSearchParams(search).get('sales_brief') || ''
}

function getCustomItemPlacement(value = DEFAULT_CUSTOM_ITEM_PLACEMENT) {
  return CUSTOM_ITEM_PLACEMENTS.find(placement => placement.value === value) || CUSTOM_ITEM_PLACEMENTS.at(-1)
}

function useEscapeToClose(onClose) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
}

function filterMissingFields(fields = []) {
  return fields.filter(field => !OPTIONAL_PARSE_FIELDS.has(field) && field !== 'editing_service')
}

function filterAmbiguousFields(fields = []) {
  return fields.filter(field => field !== 'editing_service')
}

function normalizeParseResult(result) {
  const missingFields = filterMissingFields(result.missing_fields || [])
  const ambiguousFields = filterAmbiguousFields(result.ambiguous_fields || [])

  return { ...result, missing_fields: missingFields, ambiguous_fields: ambiguousFields }
}

function getAmbiguousFieldLabel(field) {
  if (field === 'editing_service') return 'Dịch vụ dựng'
  return String(field)
}

function getReasoningLines(value = '') {
  const fallback = 'Đã phân tích brief.'
  const text = String(value || fallback)
    .replace(/\r\n?/g, '\n')
    .replace(/\bquantity\b/gi, 'số lượng')
    .replace(/:\s+(?=\d+\s)/g, ':\n')
    .replace(/,\s+(?=\d+\s+(?:photographer|videographer|camera|cam|chụp|quay)\b)/gi, '\n')
    .replace(/\.\s+(?=(?:Vì|Do|Không|Có|Đã|Mặc định|Tự|Sales)\b)/g, '.\n')

  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => !/^sales\s+nh[aậ]p\b/i.test(line))
    .filter(Boolean)
}

function getHighlightedReasoningTerms(services = [], customerTiers = []) {
  const serviceTerms = (services || [])
    .map(service => ({
      code: getServiceCode(service),
      label: service?.service_name || service?.quote_display_name || service?.name || getServiceCode(service),
      type: 'service',
    }))
    .filter(term => term.code && term.label)

  const tierTerms = (customerTiers || [])
    .map(tier => ({
      code: tier?.tier_code || tier?.code,
      label: tier?.tier_name || tier?.name || tier?.tier_code || tier?.code,
      type: 'tier',
    }))
    .filter(term => term.code && term.label)

  return [...serviceTerms, ...tierTerms].sort((a, b) => String(b.code).length - String(a.code).length)
}

function renderReasoningLine(line = '', terms = []) {
  const text = String(line || '')
  const chunks = []
  let cursor = 0

  while (cursor < text.length) {
    const matched = terms
      .map(term => ({ ...term, index: text.indexOf(term.code, cursor) }))
      .filter(term => term.index >= 0)
      .sort((a, b) => a.index - b.index || String(b.code).length - String(a.code).length)[0]

    if (!matched) {
      chunks.push({ text: text.slice(cursor) })
      break
    }

    if (matched.index > cursor) chunks.push({ text: text.slice(cursor, matched.index) })
    chunks.push({ text: matched.label, highlight: true })
    cursor = matched.index + String(matched.code).length
  }

  return chunks.map((chunk, index) => (
    chunk.highlight ? (
      <span key={`${chunk.text}-${index}`} className="font-semibold text-blue-700">{chunk.text}</span>
    ) : (
      <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
    )
  ))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function parseCurrencyInput(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function toRuleNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const match = String(value || '').replace(',', '.').match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : fallback
}

function formatHours(value) {
  const number = Number(value) || 0
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, '')
}

function appendReasoningLine(reasoning = '', line = '') {
  if (!line) return reasoning
  return [reasoning, line].filter(Boolean).join('\n')
}

function getOvertimeItemRole(item = {}) {
  const code = normalizeQuoteText(item.resolved_service_code || item.service_code || item.service?.service_code || item.service?.code)
  if (code.startsWith('CHUP')) return 'chụp ảnh'
  if (code.startsWith('QUAY')) return 'quay phim'
  if (code.startsWith('FLYCAM')) return 'flycam'
  if (code.startsWith('FPV')) return 'FPV'
  return String(item.service_name || item.service?.quote_display_name || item.service?.service_name || 'dịch vụ').toLowerCase()
}

function buildOvertimeReasoningLine(items = [], businessRules = {}) {
  const overtimeItems = items.filter(item => Number(item.overtime_unit_add_on || 0) > 0)
  if (!overtimeItems.length) return ''

  const overtimeHourlyFee = toRuleNumber(businessRules.OVERTIME_HOURLY_FEE, 0)
  const overtimeUnitAddOn = Number(overtimeItems[0]?.overtime_unit_add_on || 0)
  const overtimeHours = overtimeHourlyFee > 0 ? overtimeUnitAddOn / overtimeHourlyFee : 0
  const roles = [...new Set(overtimeItems.map(getOvertimeItemRole).filter(Boolean))]
  const roleText = roles.length ? roles.join(', ') : 'từng hạng mục'

  return `Giờ phát sinh: ${formatHours(overtimeHours)} giờ x ${formatCurrency(overtimeHourlyFee)}đ = ${formatCurrency(overtimeUnitAddOn)}đ/nhân sự, đã cộng ${formatCurrency(overtimeUnitAddOn)}đ vào mỗi nhân sự ${roleText}.`
}

function getServiceCode(service) {
  return service?.service_code || service?.code
}

function getServiceName(service) {
  return service?.quote_display_name || service?.service_name || service?.name || getServiceCode(service)
}

function getServiceRawName(service) {
  return service?.service_name || service?.name || getServiceName(service)
}

function getGroupCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

function getFallbackGroupCodeForService(service = {}) {
  const directCode = getGroupCode(service.group_code)
  if (directCode) return directCode

  const equipmentGroup = normalizeQuoteText(service.equipment_group)
  const serviceCode = normalizeQuoteText(getServiceCode(service))
  const serviceText = normalizeServiceSearchText(`${getServiceName(service)} ${getServiceRawName(service)}`)

  if (equipmentGroup === 'CHUP' || /^CHUP(?:_|$)/.test(serviceCode) || serviceText.includes('CHUP ANH')) return 'PHOTO'
  if (equipmentGroup === 'QUAY' || /^QUAY(?:_|$)/.test(serviceCode)) return serviceCode.includes('LIVE') ? 'LIVESTREAM' : 'VIDEO'
  if (equipmentGroup === 'BANTRON' || serviceCode.includes('LIVE') || serviceText.includes('LIVESTREAM')) return 'LIVESTREAM'
  if (serviceCode.includes('EDIT') || serviceText.includes('DUNG VIDEO') || serviceText.includes('HAU KY') || serviceText.includes('CHINH ANH')) return 'POST'
  return 'OTHER'
}

function getGroupForCode(groupCode = 'OTHER', serviceGroups = []) {
  const code = getGroupCode(groupCode) || 'OTHER'
  const configuredGroup = serviceGroups.find(group => getGroupCode(group.group_code) === code)
  const fallbackGroup = FALLBACK_GROUPS[code] || FALLBACK_GROUPS.OTHER

  return {
    group_code: code,
    group_label: configuredGroup?.group_label || fallbackGroup.group_label,
    group_sort_order: Number(configuredGroup?.group_sort_order ?? fallbackGroup.group_sort_order ?? 99),
  }
}

function getGroupForService(service = {}, serviceGroups = []) {
  const code = getFallbackGroupCodeForService(service)
  const group = getGroupForCode(code, serviceGroups)

  return {
    ...group,
    group_label: service.group_label || group.group_label,
    group_sort_order: Number(service.group_sort_order ?? group.group_sort_order ?? 99),
  }
}

function getGroupForCustomPlacement(placement = DEFAULT_CUSTOM_ITEM_PLACEMENT, serviceGroups = []) {
  const groupCodeByPlacement = {
    after_photo: 'PHOTO',
    after_video: 'VIDEO',
    after_mixer: 'LIVESTREAM',
    after_editing: 'POST',
  }
  return getGroupForCode(groupCodeByPlacement[placement] || 'OTHER', serviceGroups)
}

function getItemGroupSortOrder(item = {}) {
  const sortOrder = Number(item.group_sort_order)
  return Number.isFinite(sortOrder) ? sortOrder : getGroupForCode(item.group_code).group_sort_order
}

function normalizeGroupOption(group = {}, fallbackIndex = 0) {
  const groupCode = getGroupCode(group.group_code) || `GROUP_${fallbackIndex + 1}`
  const hasGroupLabel = Object.prototype.hasOwnProperty.call(group, 'group_label')
  return {
    ...group,
    group_code: groupCode,
    group_label: hasGroupLabel ? String(group.group_label ?? '') : (groupCode || 'Nhóm hạng mục'),
    group_sort_order: Number(group.group_sort_order ?? fallbackIndex + 1),
    is_custom_group: Boolean(group.is_custom_group),
    is_implicit_group: Boolean(group.is_implicit_group),
  }
}

function mergeGroupOptions(...groupLists) {
  const map = new Map()
  groupLists.flat().forEach((group, index) => {
    if (!group) return
    const normalized = normalizeGroupOption(group, index)
    if (!normalized.group_code) return
    map.set(normalized.group_code, {
      ...(map.get(normalized.group_code) || {}),
      ...normalized,
    })
  })

  return Array.from(map.values()).sort((a, b) => {
    const sortDiff = Number(a.group_sort_order || 99) - Number(b.group_sort_order || 99)
    return sortDiff || String(a.group_label).localeCompare(String(b.group_label), 'vi')
  })
}

function getClientDisplayName(client = {}) {
  return String(client.name || client.client_name || '').trim()
}

function hasEnteredClientName(value = '') {
  return String(value || '')
    .trim()
    .replace(/^mr\.?\s*/i, '')
    .trim()
    .length > 0
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function makeImplicitQuoteGroup() {
  return {
    group_code: 'CUSTOM_DEFAULT',
    group_label: 'Nhóm 1',
    group_sort_order: 1,
    is_custom_group: true,
    is_implicit_group: true,
  }
}

function getTierPriceColumn(tierCode = 'TIER_2') {
  const tierNumber = String(tierCode).match(/\d+/)?.[0] || '2'
  return `price_tier_${tierNumber}`
}

function normalizeQuoteText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function normalizeServiceSearchText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function getServiceSearchText(service = {}) {
  return normalizeServiceSearchText([
    getServiceCode(service),
    getServiceName(service),
    getServiceRawName(service),
  ].filter(Boolean).join(' '))
}

function getQuoteItemCode(item = {}) {
  return normalizeQuoteText(item.resolved_service_code || item.service_code || item.service?.service_code || item.service?.code)
}

function getQuoteItemText(item = {}) {
  return normalizeQuoteText([
    item.service_name,
    item.service_name_raw,
    item.service?.quote_display_name,
    item.service?.service_name,
    item.service?.name,
  ].filter(Boolean).join(' '))
}

function isEditingItem(code, text) {
  if (/^RECAP(?:_|$)/.test(code)) return true
  return /\b(DUNG|HAU KY|EDIT|SUB|CHEN SUB)\b/.test(text)
}

function isMixerItem(code, text) {
  return /^LIVE_SWITCHER(?:_|$)/.test(code) || /\b(BANTRON|BAN TRON|MIXER|SWITCHER)\b/.test(text)
}

function getQuoteItemSortRank(item = {}) {
  if (item.is_custom && Number.isFinite(Number(item.custom_sort_rank))) return Number(item.custom_sort_rank)
  if (item.is_custom) return 99

  const code = getQuoteItemCode(item)
  const text = getQuoteItemText(item)

  if (isEditingItem(code, text)) return 8
  if (/^CHUP(?:_|$)/.test(code) || /\b(CHUP|PHOTO|PHOTOGRAPHER)\b/.test(text)) return 0
  if (/^QUAY_RECAP(?:_|$)/.test(code)) return 1
  if (/^QUAY_FULL(?:_|$)/.test(code)) return 2
  if (/^QUAY_LIVE(?:_|$)/.test(code) || code === 'LIVE_VIDEO' || (/\bQUAY\b/.test(text) && /\b(LIVE|LIVESTREAM)\b/.test(text))) return 3
  if (/^FLYCAM(?:_|$)/.test(code) || /\b(FLYCAM|DRONE)\b/.test(text)) return 4
  if (/^FPV(?:_|$)/.test(code) || /\bFPV\b/.test(text)) return 5
  if (isMixerItem(code, text)) return 6
  return 7
}

function sortQuoteItems(items = []) {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const groupDiff = getItemGroupSortOrder(a.item) - getItemGroupSortOrder(b.item)
      if (groupDiff) return groupDiff
      const rankDiff = getQuoteItemSortRank(a.item) - getQuoteItemSortRank(b.item)
      return rankDiff || a.index - b.index
    })
    .map(entry => entry.item)
}

function calculateQuoteItemTotal(item = {}) {
  return (Number(item.quantity) || 0) * (Number(item.num_sessions) || 1) * (Number(item.unit_price) || 0)
}

function getBillableDurationHours(value, fallback = DEFAULT_QUOTE.duration_hours) {
  const number = Number(value)
  if (Number.isFinite(number) && number > 0) return number
  const fallbackNumber = Number(fallback)
  return Number.isFinite(fallbackNumber) && fallbackNumber > 0 ? fallbackNumber : Number(DEFAULT_QUOTE.duration_hours)
}

function getServiceDefaultDurationHours(service, fallback = DEFAULT_QUOTE.duration_hours) {
  const code = normalizeQuoteText(getServiceCode(service))
  if (/(?:^|_)8H$/.test(code)) return 8
  if (/(?:^|_)4H$/.test(code)) return 4
  return getBillableDurationHours(null, fallback)
}

function getDerivedQuoteDurationHours(items = [], fallback = DEFAULT_QUOTE.duration_hours) {
  const durations = items
    .filter(item => !item.is_custom)
    .map(item => Number(item.billable_duration_hours))
    .filter(duration => Number.isFinite(duration) && duration > 0)

  return durations.length ? Math.max(...durations) : getBillableDurationHours(null, fallback)
}

function toTitleCaseName(value = '') {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(part => part ? `${part.charAt(0).toUpperCase()}${part.slice(1)}` : '')
    .join(' ')
}

function extractClientNameFromBrief(inputText = '') {
  const match = String(inputText || '').match(/(?:^|[\s,.;:])(?:[Mm][Rr]\.?|[Aa]|[Aa]nh)\s+([A-ZÀ-ỸĐ][A-Za-zÀ-ỹĐđ'.-]*(?:\s+[A-ZÀ-ỸĐ][A-Za-zÀ-ỹĐđ'.-]*){0,3})/u)
  const name = toTitleCaseName(match?.[1] || '')
  return name ? `Mr. ${name}` : ''
}

function normalizeParsedItem(item, quote, services, serviceGroups = []) {
  const billableDurationHours = getBillableDurationHours(item.billable_duration_hours ?? item.item_duration_hours ?? item.duration_hours, quote.duration_hours)
  const service = findServiceForQuoteItem(services, item, quote.location, billableDurationHours)
  const parsedGroupCode = getGroupCode(item.group_code)
  const parsedGroup = parsedGroupCode ? {
    group_code: parsedGroupCode,
    group_label: item.group_label || parsedGroupCode,
    group_sort_order: Number(item.group_sort_order ?? 99),
  } : null
  const group = parsedGroup || getGroupForService(service || item, serviceGroups)
  const unitPrice = Number(service?.[getTierPriceColumn(quote.tier_code)] || service?.price_tier_2 || 0)
  const quantity = Number(item.quantity) || 1
  const numSessions = Number(item.num_sessions) || 1

  return {
    local_id: makeLocalId(),
    service_code: getServiceCode(service) || item.service_code || null,
    service_name: getServiceName(service) || item.service_name_raw || item.service_code || '',
    service_name_raw: item.service_name_raw || '',
    quantity,
    num_sessions: numSessions,
    billable_duration_hours: billableDurationHours,
    unit_price: unitPrice,
    original_unit_price: unitPrice,
    total_price: quantity * numSessions * unitPrice,
    is_overridden: false,
    override_reason: '',
    ...group,
    service,
  }
}

function calculateDisplayItems(items, quote, services, businessRules, serviceGroups = []) {
  const result = calculateQuotePricing({
    items,
    services,
    businessRules,
    location: quote.location,
    customer_tier: quote.tier_code,
    has_vat: quote.has_vat,
    duration_hours: quote.duration_hours,
  })

  return result.items_with_calculated_price.map((calculated, index) => ({
    ...items[index],
    ...calculated,
    ...(!(items[index]?.group_code && items[index]?.group_label) ? getGroupForService({ ...(calculated.service || {}), ...(items[index] || {}) }, serviceGroups) : {}),
    service_name: items[index]?.service_name || getServiceName(calculated.service),
    original_unit_price: items[index]?.original_unit_price ?? calculated.unit_price,
  }))
}

function ServicePickerModal({ services, tierCode, serviceGroups = [], onClose, onSelect }) {
  useEscapeToClose(onClose)

  const [query, setQuery] = useState('')
  const priceColumn = getTierPriceColumn(tierCode)
  const searchTokens = normalizeServiceSearchText(query).split(/\s+/).filter(Boolean)
  const filtered = services.filter(service => {
    const text = getServiceSearchText(service)
    return searchTokens.every(token => text.includes(token))
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[16px] font-semibold text-slate-900">Chọn dịch vụ</h3>
            <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[13px] text-slate-500 hover:bg-slate-100">Đóng</button>
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Tìm theo mã hoặc tên dịch vụ..."
            className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
            autoFocus
          />
        </div>
        <div className="overflow-y-auto p-3">
          {filtered.map(service => (
            <button
              key={getServiceCode(service)}
              type="button"
              onClick={() => onSelect(service)}
              className="flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left hover:bg-orange-50"
            >
              <div>
                <div className="text-[13px] font-semibold text-slate-900">{getServiceName(service)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
                  <span className="inline-flex w-fit rounded-full border border-orange-100/70 bg-orange-50/60 px-1.5 py-0 text-[9px] font-semibold leading-3 text-orange-300">
                    {getServiceCode(service)}
                  </span>
                  {getServiceRawName(service) ? (
                    <span>{getServiceRawName(service)}</span>
                  ) : null}
                  <span className="font-medium text-orange-300">{getGroupForService(service, serviceGroups).group_label}</span>
                </div>
              </div>
              <div className="text-[13px] font-semibold text-slate-700">{formatCurrency(service?.[priceColumn] || service?.price_tier_2)}đ</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuoteTermsModal({ quote, value, onChange, onValidityDaysChange, onReset, onCancel, onConfirm }) {
  useEscapeToClose(onCancel)

  const canSave = Boolean(normalizeQuoteTermsText(value))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-semibold text-slate-900">Sửa điều khoản và điều kiện</h3>
            <p className="mt-1 text-[13px] leading-5 text-slate-500">Mỗi dòng sẽ hiển thị thành một gạch đầu dòng trong báo giá.</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Khôi phục mặc định
          </button>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">ĐIỀU KHOẢN & ĐIỀU KIỆN</span>
          <textarea
            value={value}
            onChange={event => onChange(event.target.value)}
            rows={9}
            className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[13px] leading-6 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
            autoFocus
          />
        </label>
        <label className="mt-3 block w-[150px]">
          <span className="sr-only">Hiệu lực báo giá</span>
          <select
            value={normalizeQuoteValidityDays(quote.validity_days)}
            aria-label="Hiệu lực báo giá"
            onChange={event => onValidityDaysChange(Number(event.target.value))}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
          >
            <option value={7}>Hiệu lực 7 ngày</option>
            <option value={15}>Hiệu lực 15 ngày</option>
            <option value={30}>Hiệu lực 30 ngày</option>
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            type="button"
            disabled={!canSave}
            onClick={onConfirm}
            className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Lưu điều khoản
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomItemModal({ targetGroup, onCancel, onConfirm }) {
  useEscapeToClose(onCancel)

  const [serviceName, setServiceName] = useState('')
  const [unit, setUnit] = useState(CUSTOM_ITEM_UNIT_OPTIONS[0])
  const [quantity, setQuantity] = useState(1)
  const [numSessions, setNumSessions] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)
  const [placement, setPlacement] = useState(DEFAULT_CUSTOM_ITEM_PLACEMENT)
  const selectedPlacement = getCustomItemPlacement(placement)
  const safeQuantity = Math.max(Number(quantity) || 0, 0)
  const safeNumSessions = Math.max(Number(numSessions) || 1, 1)
  const safeUnitPrice = Math.max(Number(unitPrice) || 0, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-[16px] font-semibold text-slate-900">Thêm custom item</h3>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Tên hạng mục</span>
            <textarea
              value={serviceName}
              onChange={event => setServiceName(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[13px] leading-5 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
              placeholder="VD: Chi phí vận chuyển thiết bị..."
              autoFocus
            />
          </label>
          {targetGroup ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-600">
              Nhóm: {targetGroup.group_label}
            </p>
          ) : null}
          <div className={`grid gap-3 ${targetGroup ? 'md:grid-cols-[104px_76px_76px_116px]' : 'md:grid-cols-[170px_104px_76px_76px_116px]'}`}>
            {!targetGroup ? (
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Thứ tự trong bảng</span>
                <select
                  value={placement}
                  onChange={event => setPlacement(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                >
                  {CUSTOM_ITEM_PLACEMENTS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Đơn vị tính</span>
              <select
                value={unit}
                onChange={event => setUnit(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
              >
                {CUSTOM_ITEM_UNIT_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Số lượng</span>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={event => setQuantity(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-3 text-right text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Số buổi</span>
              <input
                type="number"
                min="1"
                value={numSessions}
                onChange={event => setNumSessions(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-3 text-right text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Đơn giá</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatCurrency(unitPrice)}
                onChange={event => setUnitPrice(parseCurrencyInput(event.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-3 text-right text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            type="button"
            disabled={!serviceName.trim()}
            onClick={() => onConfirm({
              serviceName: serviceName.trim(),
              placement: selectedPlacement,
              unit,
              quantity: safeQuantity,
              numSessions: safeNumSessions,
              unitPrice: safeUnitPrice,
            })}
            className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Thêm hạng mục
          </button>
        </div>
      </div>
    </div>
  )
}

function hydrateSavedQuoteItem(item = {}, index = 0, quoteDurationHours = DEFAULT_QUOTE.duration_hours) {
  const quantity = Number(item.quantity) || 1
  const numSessions = Number(item.num_sessions) || 1
  const unitPrice = Number(item.unit_price) || 0
  const isCustom = item.is_custom || normalizeQuoteText(item.service_code) === 'CUSTOM'

  return {
    local_id: item.id || makeLocalId(),
    service_code: isCustom ? 'CUSTOM' : (item.service_code || null),
    service_name: item.service_name || item.service_name_raw || '',
    service_name_raw: item.service_name_raw || item.service_name || '',
    unit: item.unit || item.pricing_unit || (isCustom ? CUSTOM_ITEM_UNIT_OPTIONS[0] : undefined),
    quantity,
    num_sessions: numSessions,
    billable_duration_hours: item.billable_duration_hours ?? getBillableDurationHours(item.item_duration_hours ?? item.duration_hours, quoteDurationHours),
    unit_price: unitPrice,
    original_unit_price: item.original_unit_price ?? unitPrice,
    total_price: Number(item.total_price) || quantity * numSessions * unitPrice,
    is_custom: Boolean(isCustom),
    custom_sort_rank: Number.isFinite(Number(item.custom_sort_rank)) ? Number(item.custom_sort_rank) : undefined,
    group_code: item.group_code || '',
    group_label: item.group_label || '',
    group_sort_order: item.group_sort_order ?? null,
    is_overridden: Boolean(item.is_overridden || isCustom),
    override_reason: item.override_reason || '',
    sort_order: item.sort_order ?? index + 1,
  }
}

export default function QuoteCreatePage({ mode = 'create', quoteId = '' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isEditMode = mode === 'edit' && Boolean(quoteId)
  const userContext = useMemo(() => getQuoteUserContext(), [])
  const { services, loading: servicesLoading } = useServices()
  const { travelFees } = useTravelFees()
  const { businessRules, rulesMap } = useBusinessRules()
  const { legalEntities, getDefaultEntity } = useLegalEntities()
  const { customerTiers } = useCustomerTiers()
  const { serviceGroups } = useServiceGroups()
  const [quote, setQuote] = useState(DEFAULT_QUOTE)
  const [items, setItems] = useState([])
  const [clients, setClients] = useState([])
  const [clientQuery, setClientQuery] = useState(DEFAULT_QUOTE.client_name)
  const [inputText, setInputText] = useState(() => getInitialSalesBrief(location.search, isEditMode))
  const [parseResult, setParseResult] = useState(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [initialLoading, setInitialLoading] = useState(isEditMode)
  const [showServicePicker, setShowServicePicker] = useState(false)
  const [showCustomItemModal, setShowCustomItemModal] = useState(false)
  const [quoteGroups, setQuoteGroups] = useState(() => isEditMode ? [] : [makeImplicitQuoteGroup()])
  const [removedGroupCodes, setRemovedGroupCodes] = useState([])
  const [targetGroup, setTargetGroup] = useState(null)
  const [clientInputFocused, setClientInputFocused] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [termsDraft, setTermsDraft] = useState('')
  const [showStamp, setShowStamp] = useState(DEFAULT_QUOTE.show_stamp)
  const canPublishQuote = !isEditMode
  const canSaveChanges = isEditMode

  useEffect(() => {
    if (isEditMode) return

    const params = new URLSearchParams(location.search)
    if (!params.has('sales_brief')) return

    params.delete('sales_brief')
    const nextSearch = params.toString()
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
    }, { replace: true })
  }, [isEditMode, location.pathname, location.search, navigate])

  useEffect(() => {
    if (!isEditMode) return
    let mounted = true

    async function loadExistingQuote() {
      setInitialLoading(true)
      setValidationError('')

      try {
        const existingQuote = await getQuote(quoteId)
        if (!mounted) return

        const nextQuote = {
          entity_code: existingQuote.entity_code || DEFAULT_QUOTE.entity_code,
          event_name: existingQuote.event_name || '',
          event_date: existingQuote.event_date || '',
          location: existingQuote.location || '',
          duration_hours: existingQuote.duration_hours || '',
          tier_code: existingQuote.tier_code || DEFAULT_QUOTE.tier_code,
          client_id: existingQuote.client_id || '',
          client_name: existingQuote.client_name || DEFAULT_QUOTE.client_name,
          validity_days: normalizeQuoteValidityDays(existingQuote.validity_days),
          has_vat: existingQuote.has_vat !== false,
          show_stamp: existingQuote.show_stamp !== false,
          terms_text: existingQuote.terms_text || '',
          status: existingQuote.status || 'sent',
          sent_at: existingQuote.sent_at || null,
        }
        setQuote(nextQuote)
        setShowStamp(nextQuote.show_stamp)
        setClientQuery(existingQuote.client_name || DEFAULT_QUOTE.client_name)
        setInputText(existingQuote.ai_input || '')
        setItems((existingQuote.items || []).map((item, index) => hydrateSavedQuoteItem(item, index, nextQuote.duration_hours)))
      } catch (err) {
        if (mounted) setValidationError(err?.message || 'Không tải được báo giá để sửa.')
      } finally {
        if (mounted) setInitialLoading(false)
      }
    }

    loadExistingQuote()
    return () => {
      mounted = false
    }
  }, [isEditMode, quoteId])

  useEffect(() => {
    const defaultEntity = getDefaultEntity()
    const defaultCode = defaultEntity?.entity_code || defaultEntity?.code
    if (!isEditMode && defaultCode && quote.entity_code === DEFAULT_QUOTE.entity_code) {
      setQuote(prev => ({ ...prev, entity_code: defaultCode }))
    }
  }, [getDefaultEntity, quote.entity_code, isEditMode])

  useEffect(() => {
    listQuoteClients().then(setClients).catch(() => setClients([]))
  }, [])

  useEffect(() => {
    const defaults = serviceGroups.length ? serviceGroups : Object.values(FALLBACK_GROUPS)
    setQuoteGroups(prev => mergeGroupOptions(defaults, prev))
  }, [serviceGroups])

  const displayItems = useMemo(() => calculateDisplayItems(items, quote, services, rulesMap, serviceGroups), [items, quote, services, rulesMap, serviceGroups])
  const quoteGroupOptions = useMemo(() => {
    const defaults = serviceGroups.length ? serviceGroups : Object.values(FALLBACK_GROUPS)
    const itemGroupCodes = new Set(displayItems.map(item => getGroupCode(item.group_code) || 'OTHER'))
    const groupsFromItems = displayItems.map(item => ({
      group_code: item.group_code,
      group_label: item.group_label,
      group_sort_order: item.group_sort_order,
    }))
    return mergeGroupOptions(defaults, quoteGroups, groupsFromItems)
      .filter(group => !removedGroupCodes.includes(getGroupCode(group.group_code)) || itemGroupCodes.has(getGroupCode(group.group_code)))
  }, [displayItems, quoteGroups, removedGroupCodes, serviceGroups])
  const highlightedReasoningTerms = useMemo(() => getHighlightedReasoningTerms(services, customerTiers), [services, customerTiers])
  const totals = useMemo(() => calculateQuotePricing({
    items: displayItems,
    services,
    travelFees,
    businessRules: rulesMap,
    location: quote.location,
    customer_tier: quote.tier_code,
    has_vat: quote.has_vat,
    duration_hours: quote.duration_hours,
  }), [displayItems, services, travelFees, rulesMap, quote.location, quote.tier_code, quote.has_vat, quote.duration_hours])

  const selectedClient = clients.find(client => client.id === quote.client_id) || null
  const normalizedClientQuery = clientQuery.trim().toLowerCase()
  const filteredClients = clients.filter(client => {
    const displayName = getClientDisplayName(client)
    if (!displayName || !normalizedClientQuery) return false
    const text = `${displayName} ${client.phone || ''} ${client.email || ''}`.toLowerCase()
    return text.includes(normalizedClientQuery)
  }).slice(0, 6)

  async function analyzeInput() {
    setParseLoading(true)
    setParseError('')
    setValidationError('')

    try {
      const result = await parseQuoteInput(inputText, {
        services,
        travel_fees: travelFees,
        customer_tiers: customerTiers,
        business_rules: businessRules,
      })
      const parsed = result.parsed || {}
      const briefClientName = extractClientNameFromBrief(inputText)
      const nextQuote = {
        ...quote,
        client_id: briefClientName ? '' : quote.client_id,
        client_name: briefClientName || quote.client_name,
        event_name: parsed.event_name || quote.event_name,
        event_date: parsed.event_date || quote.event_date,
        location: parsed.location || quote.location,
        duration_hours: parsed.duration_hours || quote.duration_hours,
        tier_code: parsed.tier_code || quote.tier_code,
      }
      const parsedItems = (parsed.items || []).map(item => normalizeParsedItem(item, nextQuote, services, serviceGroups))
      const pricedParsedItems = calculateDisplayItems(parsedItems, nextQuote, services, rulesMap, serviceGroups)
      const overtimeReasoning = buildOvertimeReasoningLine(pricedParsedItems, rulesMap)
      const normalizedResult = normalizeParseResult({
        ...result,
        ai_reasoning: appendReasoningLine(result.ai_reasoning, overtimeReasoning),
      })
      setQuote(nextQuote)
      if (briefClientName) setClientQuery(briefClientName)
      if (parsedItems.length) setItems(sortQuoteItems(parsedItems))
      setParseResult(normalizedResult)
    } catch (error) {
      setParseError(error?.message || 'Không phân tích được nội dung.')
    } finally {
      setParseLoading(false)
    }
  }

  function updateItem(index, patch, meta = {}) {
    setItems(prev => {
      let shouldSort = false
      const nextItems = prev.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        const next = { ...item, ...patch }
        next.total_price = (Number(next.quantity) || 0) * (Number(next.num_sessions) || 1) * (Number(next.unit_price) || 0)

        if (meta.priceChanged && !item.is_custom && Number(patch.unit_price) !== Number(item.unit_price)) {
          next.is_overridden = true
          next.original_unit_price = item.original_unit_price ?? item.unit_price
          next.override_reason = ''
        }

        shouldSort = Boolean(patch.service_name || patch.service_name_raw || patch.service_code || patch.group_code || patch.group_sort_order)
        return next
      })
      return shouldSort ? sortQuoteItems(nextItems) : nextItems
    })
  }

  function upsertQuoteGroup(group) {
    const groupCode = getGroupCode(group?.group_code)
    if (groupCode) setRemovedGroupCodes(prev => prev.filter(code => code !== groupCode))
    setQuoteGroups(prev => mergeGroupOptions(prev, [group]))
  }

  function addQuoteGroup() {
    const customGroupCount = quoteGroups.filter(group => group.is_custom_group).length
    const maxSortOrder = quoteGroupOptions
      .map(group => Number(group.group_sort_order))
      .filter(sortOrder => Number.isFinite(sortOrder) && sortOrder < 99)
      .reduce((max, sortOrder) => Math.max(max, sortOrder), 0)
    const group = {
      group_code: `CUSTOM_${Date.now()}`,
      group_label: `Nhóm ${customGroupCount + 1}`,
      group_sort_order: maxSortOrder + 1,
      is_custom_group: true,
    }
    upsertQuoteGroup(group)
  }

  function renameQuoteGroup(group, nextLabel) {
    const patch = { ...group, group_label: nextLabel }
    upsertQuoteGroup(patch)
    setItems(prev => prev.map(item => (
      getGroupCode(item.group_code) === getGroupCode(group.group_code)
        ? { ...item, group_label: nextLabel }
        : item
    )))
  }

  function moveQuoteGroup(group, direction) {
    const activeGroupCodes = new Set([
      ...displayItems.map(item => getGroupCode(item.group_code) || 'OTHER'),
      ...quoteGroups.filter(option => option.is_custom_group).map(option => getGroupCode(option.group_code)),
    ])
    const activeGroups = quoteGroupOptions.filter(option => activeGroupCodes.has(getGroupCode(option.group_code)))
    const inactiveGroups = quoteGroupOptions.filter(option => !activeGroupCodes.has(getGroupCode(option.group_code)))
    const currentIndex = activeGroups.findIndex(option => getGroupCode(option.group_code) === getGroupCode(group.group_code))
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= activeGroups.length) return

    const reordered = [...activeGroups]
    const [current] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, current)
    const withSortOrder = [...reordered, ...inactiveGroups].map((option, index) => ({
      ...option,
      group_sort_order: index + 1,
    }))
    const sortMap = new Map(withSortOrder.map(option => [getGroupCode(option.group_code), option]))

    setQuoteGroups(withSortOrder)
    setItems(prev => sortQuoteItems(prev.map(item => {
      const nextGroup = sortMap.get(getGroupCode(item.group_code))
      if (!nextGroup) return item
      return {
        ...item,
        group_label: nextGroup.group_label,
        group_sort_order: nextGroup.group_sort_order,
      }
    })))
  }

  function removeQuoteGroup(group, itemCount = 0) {
    const groupCode = getGroupCode(group?.group_code)
    if (!groupCode) return

    if (itemCount > 0) {
      const confirmed = window.confirm(`Nhóm "${group.group_label || groupCode}" đang có ${itemCount} dịch vụ. Bạn có chắc muốn xóa nhóm này không?`)
      if (!confirmed) return
    }

    setRemovedGroupCodes(prev => prev.includes(groupCode) ? prev : [...prev, groupCode])
    setQuoteGroups(prev => prev.filter(option => getGroupCode(option.group_code) !== groupCode))
    setItems(prev => prev.filter(item => (getGroupCode(item.group_code) || 'OTHER') !== groupCode))
  }

  function openServicePicker(group) {
    setTargetGroup(group || null)
    setShowServicePicker(true)
  }

  function openCustomItemModal(group) {
    setTargetGroup(group || null)
    setShowCustomItemModal(true)
  }

  function addServiceItem(service) {
    const serviceCode = getServiceCode(service)
    const normalizedServiceCode = normalizeQuoteText(serviceCode)
    const group = targetGroup ? normalizeGroupOption(targetGroup) : getGroupForService(service, serviceGroups)
    const normalizedTargetGroupCode = getGroupCode(group.group_code)
    const unitPrice = Number(service?.[getTierPriceColumn(quote.tier_code)] || service?.price_tier_2 || 0)
    const defaultBillableDurationHours = getServiceDefaultDurationHours(service, quote.duration_hours)
    upsertQuoteGroup(group)
    setItems(prev => {
      const existingIndex = normalizedServiceCode
        ? prev.findIndex(item => {
          const itemGroupCode = getGroupCode(item.group_code) || 'OTHER'
          return getQuoteItemCode(item) === normalizedServiceCode && itemGroupCode === normalizedTargetGroupCode
        })
        : -1

      if (existingIndex >= 0) {
        return sortQuoteItems(prev.map((item, index) => {
          if (index !== existingIndex) return item
          const next = {
            ...item,
            quantity: (Number(item.quantity) || 0) + 1,
            service_code: item.service_code || serviceCode,
            service_name: item.service_name || getServiceName(service),
            billable_duration_hours: item.billable_duration_hours ?? defaultBillableDurationHours,
            ...group,
            service,
          }
          next.total_price = calculateQuoteItemTotal(next)
          return next
        }))
      }

      return sortQuoteItems([...prev, {
        local_id: makeLocalId(),
        service_code: serviceCode,
        service_name: getServiceName(service),
        quantity: 1,
        num_sessions: 1,
        billable_duration_hours: defaultBillableDurationHours,
        unit_price: unitPrice,
        original_unit_price: unitPrice,
        total_price: unitPrice,
        ...group,
        is_overridden: false,
        override_reason: '',
        service,
      }])
    })
    setShowServicePicker(false)
    setTargetGroup(null)
  }

  function addCustomItem({ serviceName, placement, unit, quantity, numSessions, unitPrice }) {
    const selectedPlacement = placement || getCustomItemPlacement()
    const group = targetGroup ? normalizeGroupOption(targetGroup) : getGroupForCustomPlacement(selectedPlacement.value, serviceGroups)
    const safeQuantity = Math.max(Number(quantity) || 0, 0)
    const safeNumSessions = Math.max(Number(numSessions) || 1, 1)
    const safeUnitPrice = Math.max(Number(unitPrice) || 0, 0)
    upsertQuoteGroup(group)
    setItems(prev => sortQuoteItems([...prev, {
      local_id: makeLocalId(),
      service_code: 'CUSTOM',
      service_name: serviceName,
      service_name_raw: '',
      unit: unit || CUSTOM_ITEM_UNIT_OPTIONS[0],
      quantity: safeQuantity,
      num_sessions: safeNumSessions,
      billable_duration_hours: null,
      unit_price: safeUnitPrice,
      original_unit_price: safeUnitPrice,
      total_price: safeQuantity * safeNumSessions * safeUnitPrice,
      is_custom: true,
      custom_sort_rank: selectedPlacement.sortRank,
      ...group,
      is_overridden: true,
      override_reason: '',
    }]))
    setShowCustomItemModal(false)
    setTargetGroup(null)
  }

  function validateBeforeSave() {
    if (!quote.entity_code) return 'Phải chọn pháp nhân.'
    if (!quote.tier_code) return 'Phải chọn loại khách.'
    if (!hasEnteredClientName(quote.client_name || clientQuery)) return 'Bạn chưa nhập tên khách hàng.'
    if (!displayItems.length) return 'Phải có ít nhất 1 hạng mục.'
    if (displayItems.some(item => item.is_custom && !String(item.service_name || '').trim())) return 'Custom item cần có tên hạng mục.'
    return ''
  }

  function openTermsModal() {
    const currentTerms = getQuoteTerms(quote)
    setTermsDraft(currentTerms.join('\n'))
    setShowTermsModal(true)
  }

  function confirmTermsEdit() {
    setQuote(prev => ({ ...prev, terms_text: normalizeQuoteTermsText(termsDraft) }))
    setShowTermsModal(false)
  }

  function updateTermsValidityDays(validityDays) {
    const shouldRefreshDefaultTerms = normalizeQuoteTermsText(termsDraft) === normalizeQuoteTermsText(getDefaultQuoteTermsText(quote))
    const nextQuote = { ...quote, validity_days: validityDays }

    setQuote(prev => ({ ...prev, validity_days: validityDays }))
    if (shouldRefreshDefaultTerms) setTermsDraft(getDefaultQuoteTermsText(nextQuote))
  }

  async function saveQuote(action) {
    const error = validateBeforeSave()
    if (error) {
      setValidationError(error)
      return
    }

    setSaveState(action)
    setValidationError('')

    try {
      const now = new Date().toISOString()
      const clientName = String(quote.client_name || clientQuery || '').trim()
      const clientId = quote.client_id || null
      const derivedDurationHours = getDerivedQuoteDurationHours(displayItems, quote.duration_hours)
      const shouldPublishQuote = action === 'sent'
      const quotePayload = {
        ...(!isEditMode ? getQuoteActorPayload(userContext) : {}),
        ai_input: inputText,
        entity_code: quote.entity_code || DEFAULT_QUOTE.entity_code,
        client_id: clientId,
        client_name: clientName || null,
        tier_code: quote.tier_code || DEFAULT_QUOTE.tier_code,
        event_name: quote.event_name,
        event_date: quote.event_date || null,
        location: quote.location,
        duration_hours: derivedDurationHours,
        validity_days: normalizeQuoteValidityDays(quote.validity_days),
        has_vat: Boolean(quote.has_vat),
        show_stamp: Boolean(showStamp),
        terms_text: normalizeQuoteTermsText(quote.terms_text) || null,
        ...((!isEditMode || shouldPublishQuote) ? {
          status: 'sent',
          sent_at: shouldPublishQuote ? (quote.sent_at || now) : null,
        } : {}),
        subtotal: totals.subtotal,
        travel_fee_total: totals.travel_fee_total,
        overtime_fee_total: totals.overtime_fee_total,
        vat_amount: totals.vat_amount,
        total_amount: totals.total_amount,
        items: displayItems.map((item, index) => ({
          service_code: item.is_custom ? 'CUSTOM' : (item.service_code || item.resolved_service_code),
          service_name: item.service_name,
          service_name_raw: item.service_name_raw || item.service_name,
          unit: item.unit || item.pricing_unit || item.service?.unit || 'Người',
          quantity: Number(item.quantity),
          num_sessions: Number(item.num_sessions),
          billable_duration_hours: item.is_custom ? null : getBillableDurationHours(item.billable_duration_hours, derivedDurationHours),
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
          is_overridden: Boolean(item.is_overridden),
          original_unit_price: item.original_unit_price ?? item.unit_price,
          override_reason: null,
          custom_sort_rank: item.custom_sort_rank,
          group_code: item.group_code || null,
          group_label: item.group_label || null,
          group_sort_order: item.group_sort_order ?? null,
          sort_order: index + 1,
        })),
      }
      const saved = isEditMode ? await updateQuote(quoteId, quotePayload) : await createQuote(quotePayload)

      if (shouldPublishQuote) {
        const shareToken = saved.share_token
        if (shareToken) {
          navigator.clipboard?.writeText(`${window.location.origin}/q/${shareToken}`).catch(() => {})
          navigate(`/quotes/${saved.id}`)
          return
        }
        navigate(`/quotes/${saved.id}`)
      } else {
        navigate(`/quotes/${saved.id}`)
      }
    } catch (err) {
      setValidationError(err?.message || 'Không lưu được báo giá.')
    } finally {
      setSaveState('idle')
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1920px] space-y-5">
      <div>
        <QuoteBreadcrumb items={[{ label: isEditMode ? 'Sửa báo giá' : 'Tạo báo giá mới' }]} />
      </div>

      {initialLoading && <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-slate-500">Đang tải báo giá để sửa...</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <QuoteChatInput
              value={inputText}
              onChange={setInputText}
              onAnalyze={analyzeInput}
              loading={parseLoading}
              disabled={servicesLoading}
            />
            {parseError && <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{parseError}</p>}
            {parseResult && (
              <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
                <div className="text-[13px] text-slate-600">
                  <div className="font-semibold text-slate-900">AI hiểu:</div>
                  <div className="mt-1 space-y-1 leading-5">
                    {getReasoningLines(parseResult.ai_reasoning).map((line, index) => (
                      <div key={`${line}-${index}`}>{renderReasoningLine(line, highlightedReasoningTerms)}</div>
                    ))}
                  </div>
                </div>
                {parseResult.missing_fields?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {parseResult.missing_fields.map(field => (
                      <span key={field} className="rounded-full bg-amber-100 px-3 py-1 text-[12px] font-semibold text-amber-800">
                        Thiếu: {FIELD_LABELS[field] || field}
                      </span>
                    ))}
                  </div>
                ) : null}
                {parseResult.ambiguous_fields?.length ? (
                  <div className="space-y-2">
                    {parseResult.ambiguous_fields.map((field, index) => (
                      <label key={`${field}-${index}`} className="block">
                        <span className="mb-1 block text-[12px] font-semibold text-slate-600">Cần làm rõ: {getAmbiguousFieldLabel(field)}</span>
                        <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] outline-none focus:border-[#f8981d]">
                          {field === 'editing_service' ? (
                            <>
                              <option>Chọn sau trong bảng hạng mục</option>
                              <option>Không dựng</option>
                              <option>Dựng video highlight</option>
                              <option>Dựng video full</option>
                              <option>Dựng highlight tại chỗ</option>
                            </>
                          ) : (
                            <>
                              <option>Chọn sau trong bảng hạng mục</option>
                              <option>Highlight</option>
                              <option>Full</option>
                              <option>Live</option>
                            </>
                          )}
                        </select>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Khách hàng</span>
                <div className="relative">
                  <input
                    value={selectedClient ? getClientDisplayName(selectedClient) : clientQuery}
                    onFocus={() => setClientInputFocused(true)}
                    onBlur={() => window.setTimeout(() => setClientInputFocused(false), 120)}
                    onChange={event => {
                      setClientQuery(event.target.value)
                      setQuote(prev => ({ ...prev, client_id: '', client_name: event.target.value }))
                    }}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                    placeholder="Tìm khách hoặc nhập tên mới..."
                  />
                  {clientInputFocused && !selectedClient && normalizedClientQuery && filteredClients.length ? (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {filteredClients.map(client => {
                        const displayName = getClientDisplayName(client)
                        return (
                          <button
                            key={client.id || displayName}
                            type="button"
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => {
                              setQuote(prev => ({ ...prev, client_id: client.id, client_name: displayName }))
                              setClientQuery('')
                              setClientInputFocused(false)
                            }}
                            className="block w-full rounded-lg px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-orange-50"
                          >
                            {displayName}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Nhóm khách hàng</span>
                <select value={quote.tier_code} onChange={event => setQuote(prev => ({ ...prev, tier_code: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100">
                  {(customerTiers.length ? customerTiers : [{ tier_code: 'TIER_1' }, { tier_code: 'TIER_2' }, { tier_code: 'TIER_3' }]).map(tier => (
                    <option key={tier.tier_code || tier.code} value={tier.tier_code || tier.code}>{tier.tier_name || tier.name || tier.tier_code || tier.code}</option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <QuoteItemsTable
            items={displayItems}
            groupOptions={quoteGroupOptions}
            onChangeItem={updateItem}
            onRemoveItem={index => setItems(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
            onAddService={openServicePicker}
            onAddCustomItem={openCustomItemModal}
            onAddGroup={addQuoteGroup}
            onRenameGroup={renameQuoteGroup}
            onMoveGroup={moveQuoteGroup}
            onRemoveGroup={removeQuoteGroup}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(360px,0.85fr)_minmax(280px,1.15fr)]">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <label className="flex w-[132px] items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2">
                    <span className="text-[11px] font-semibold text-slate-700">Thuế GTGT 8%</span>
                    <input type="checkbox" checked={quote.has_vat} onChange={event => setQuote(prev => ({ ...prev, has_vat: event.target.checked }))} className="h-3.5 w-3.5 accent-[#f8981d]" />
                  </label>
                  <button
                    type="button"
                    onClick={openTermsModal}
                    className="inline-flex h-[38px] min-w-[190px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Sửa điều khoản và điều kiện
                  </button>
                </div>
                <EntitySelector
                  compact
                  entities={legalEntities}
                  value={quote.entity_code}
                  onChange={entity_code => setQuote(prev => ({ ...prev, entity_code }))}
                  action={(
                    <button
                      type="button"
                      onClick={() => setShowStamp(prev => !prev)}
                      className={`inline-flex h-[34px] w-[118px] items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold transition ${
                        showStamp
                          ? 'border-orange-300 bg-orange-50 text-slate-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Stamp className="h-3.5 w-3.5" />
                      {showStamp ? 'Ẩn con dấu' : 'Hiện con dấu'}
                    </button>
                  )}
                />
              </div>
              <div className="ml-auto w-full max-w-md space-y-2 text-[14px]">
                <div className="flex justify-end gap-5 text-slate-600"><span className="text-right">Subtotal</span><span className="min-w-[132px] text-right">{formatCurrency(totals.subtotal)}đ</span></div>
                {Number(totals.travel_fee_total || 0) > 0 ? (
                  <div className="flex justify-end gap-5 text-slate-600"><span className="text-right">Phụ phí di chuyển</span><span className="min-w-[132px] text-right">{formatCurrency(totals.travel_fee_total)}đ</span></div>
                ) : null}
                {Number(totals.overtime_fee_total || 0) > 0 ? (
                  <div className="flex justify-end gap-5 text-slate-600"><span className="text-right">Phụ phí giờ vượt</span><span className="min-w-[132px] text-right">{formatCurrency(totals.overtime_fee_total)}đ</span></div>
                ) : null}
                {quote.has_vat ? (
                  <div className="flex justify-end gap-5 text-slate-600"><span className="text-right">Thuế GTGT 8%</span><span className="min-w-[132px] text-right">{formatCurrency(totals.vat_amount)}đ</span></div>
                ) : null}
                <div className="flex justify-end gap-5 border-t border-slate-200 pt-3 text-[20px] font-bold text-slate-950"><span className="text-right">Total</span><span className="min-w-[132px] text-right">{formatCurrency(totals.total_amount)}đ</span></div>
              </div>
            </div>

            {validationError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{validationError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap justify-end gap-3">
                {canSaveChanges && (
                  <button
                    type="button"
                    disabled={saveState !== 'idle'}
                    onClick={() => saveQuote('save')}
                    className={`rounded-xl px-5 py-3 text-[13px] font-semibold shadow-sm disabled:opacity-50 ${isEditMode ? 'bg-[#f8981d] text-white hover:bg-orange-500' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {saveState === 'save' ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                )}
                {canPublishQuote && (
                  <button type="button" disabled={saveState !== 'idle'} onClick={() => saveQuote('sent')} className="rounded-xl bg-[#f8981d] px-5 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50">
                    {saveState === 'sent' ? 'Đang tạo link...' : 'Lưu & tạo link gửi khách'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <QuotePreview quote={quote} items={displayItems} totals={totals} entities={legalEntities} client={selectedClient} sticky={false} showStamp={showStamp} />
      </div>

      {showServicePicker && (
        <ServicePickerModal
          services={services}
          tierCode={quote.tier_code}
          serviceGroups={serviceGroups}
          onClose={() => {
            setShowServicePicker(false)
            setTargetGroup(null)
          }}
          onSelect={addServiceItem}
        />
      )}

      {showCustomItemModal && (
        <CustomItemModal
          targetGroup={targetGroup}
          onCancel={() => {
            setShowCustomItemModal(false)
            setTargetGroup(null)
          }}
          onConfirm={addCustomItem}
        />
      )}

      {showTermsModal && (
        <QuoteTermsModal
          quote={quote}
          value={termsDraft}
          onChange={setTermsDraft}
          onValidityDaysChange={updateTermsValidityDays}
          onReset={() => setTermsDraft(getDefaultQuoteTermsText(quote))}
          onCancel={() => setShowTermsModal(false)}
          onConfirm={confirmTermsEdit}
        />
      )}
    </div>
  )
}
