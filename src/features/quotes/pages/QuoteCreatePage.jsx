import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EntitySelector from '../components/EntitySelector'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import QuoteChatInput from '../components/QuoteChatInput'
import QuoteItemsTable from '../components/QuoteItemsTable'
import QuotePreview from '../components/QuotePreview'
import { useBusinessRules } from '../hooks/useBusinessRules'
import { useCustomerTiers } from '../hooks/useCustomerTiers'
import { useLegalEntities } from '../hooks/useLegalEntities'
import { createQuote, getQuote, updateQuote } from '../hooks/useQuotes'
import { useServices } from '../hooks/useServices'
import { useTravelFees } from '../hooks/useTravelFees'
import { parseQuoteInput } from '../lib/aiParser'
import { calculateQuotePricing, findServiceForQuoteItem } from '../lib/pricingCalculator'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'

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
}

const FIELD_LABELS = {
  location: 'Địa điểm',
  duration_hours: 'Thời lượng',
  items: 'Hạng mục',
  editing_service: 'Dựng',
}

const OPTIONAL_PARSE_FIELDS = new Set(['event_date', 'event_name'])

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

function getClientDisplayName(client = {}) {
  return String(client.name || client.client_name || '').trim()
}

function makeLocalId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
      const rankDiff = getQuoteItemSortRank(a.item) - getQuoteItemSortRank(b.item)
      return rankDiff || a.index - b.index
    })
    .map(entry => entry.item)
}

function calculateQuoteItemTotal(item = {}) {
  return (Number(item.quantity) || 0) * (Number(item.num_sessions) || 1) * (Number(item.unit_price) || 0)
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

function isClientInsertBlocked(error) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === '42501' || message.includes('row-level security') || message.includes('permission denied')
}

function normalizeParsedItem(item, quote, services) {
  const service = findServiceForQuoteItem(services, item, quote.location, Number(quote.duration_hours) || 0)
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
    unit_price: unitPrice,
    original_unit_price: unitPrice,
    total_price: quantity * numSessions * unitPrice,
    is_overridden: false,
    override_reason: '',
    service,
  }
}

function calculateDisplayItems(items, quote, services, businessRules) {
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
    service_name: items[index]?.service_name || getServiceName(calculated.service),
    original_unit_price: items[index]?.original_unit_price ?? calculated.unit_price,
  }))
}

function ServicePickerModal({ services, tierCode, onClose, onSelect }) {
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

function OverrideReasonModal({ onCancel, onConfirm }) {
  useEscapeToClose(onCancel)

  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-[16px] font-semibold text-slate-900">Lý do sửa đơn giá</h3>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">Giá sửa tay sẽ được lưu với thông tin override để audit.</p>
        <textarea
          value={reason}
          onChange={event => setReason(event.target.value)}
          rows={4}
          className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
          placeholder="VD: Giảm theo deal đã duyệt..."
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50">Huỷ</button>
          <button
            type="button"
            disabled={!reason.trim()}
            onClick={() => onConfirm(reason.trim())}
            className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Lưu lý do
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomItemModal({ onCancel, onConfirm }) {
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
          <div className="grid gap-3 md:grid-cols-[170px_104px_76px_76px_116px]">
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

function hydrateSavedQuoteItem(item = {}, index = 0) {
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
    unit_price: unitPrice,
    original_unit_price: item.original_unit_price ?? unitPrice,
    total_price: Number(item.total_price) || quantity * numSessions * unitPrice,
    is_custom: Boolean(isCustom),
    custom_sort_rank: Number.isFinite(Number(item.custom_sort_rank)) ? Number(item.custom_sort_rank) : undefined,
    is_overridden: Boolean(item.is_overridden || isCustom),
    override_reason: item.override_reason || '',
    sort_order: item.sort_order ?? index + 1,
  }
}

export default function QuoteCreatePage({ mode = 'create', quoteId = '' }) {
  const navigate = useNavigate()
  const isEditMode = mode === 'edit' && Boolean(quoteId)
  const { services, loading: servicesLoading } = useServices()
  const { travelFees } = useTravelFees()
  const { businessRules, rulesMap } = useBusinessRules()
  const { legalEntities, getDefaultEntity } = useLegalEntities()
  const { customerTiers } = useCustomerTiers()
  const [quote, setQuote] = useState(DEFAULT_QUOTE)
  const [items, setItems] = useState([])
  const [clients, setClients] = useState([])
  const [clientQuery, setClientQuery] = useState(DEFAULT_QUOTE.client_name)
  const [inputText, setInputText] = useState('')
  const [parseResult, setParseResult] = useState(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [initialLoading, setInitialLoading] = useState(isEditMode)
  const [showServicePicker, setShowServicePicker] = useState(false)
  const [showCustomItemModal, setShowCustomItemModal] = useState(false)
  const [overrideDraft, setOverrideDraft] = useState(null)
  const [clientInputFocused, setClientInputFocused] = useState(false)

  useEffect(() => {
    if (!isEditMode) return
    let mounted = true

    async function loadExistingQuote() {
      setInitialLoading(true)
      setValidationError('')

      try {
        const existingQuote = await getQuote(quoteId)
        if (!mounted) return

        setQuote({
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
        })
        setClientQuery(existingQuote.client_name || DEFAULT_QUOTE.client_name)
        setInputText(existingQuote.ai_input || '')
        setItems((existingQuote.items || []).map(hydrateSavedQuoteItem))
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
    if (!hasSupabaseConfig) return
    fromQuoteTable('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setClients(data || []))
  }, [])

  const displayItems = useMemo(() => calculateDisplayItems(items, quote, services, rulesMap), [items, quote, services, rulesMap])
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
      const parsedItems = (parsed.items || []).map(item => normalizeParsedItem(item, nextQuote, services))
      const pricedParsedItems = calculateDisplayItems(parsedItems, nextQuote, services, rulesMap)
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
          setOverrideDraft({ index, patch })
          return item
        }

        shouldSort = Boolean(patch.service_name || patch.service_name_raw || patch.service_code)
        return next
      })
      return shouldSort ? sortQuoteItems(nextItems) : nextItems
    })
  }

  function confirmOverride(reason) {
    if (!overrideDraft) return
    setItems(prev => sortQuoteItems(prev.map((item, index) => {
      if (index !== overrideDraft.index) return item
      const next = { ...item, ...overrideDraft.patch }
      next.is_overridden = true
      next.original_unit_price = item.original_unit_price ?? item.unit_price
      next.override_reason = reason
      next.total_price = (Number(next.quantity) || 0) * (Number(next.num_sessions) || 1) * (Number(next.unit_price) || 0)
      return next
    })))
    setOverrideDraft(null)
  }

  function addServiceItem(service) {
    const serviceCode = getServiceCode(service)
    const normalizedServiceCode = normalizeQuoteText(serviceCode)
    const unitPrice = Number(service?.[getTierPriceColumn(quote.tier_code)] || service?.price_tier_2 || 0)
    setItems(prev => {
      const existingIndex = normalizedServiceCode
        ? prev.findIndex(item => getQuoteItemCode(item) === normalizedServiceCode)
        : -1

      if (existingIndex >= 0) {
        return sortQuoteItems(prev.map((item, index) => {
          if (index !== existingIndex) return item
          const next = {
            ...item,
            quantity: (Number(item.quantity) || 0) + 1,
            service_code: item.service_code || serviceCode,
            service_name: item.service_name || getServiceName(service),
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
        unit_price: unitPrice,
        original_unit_price: unitPrice,
        total_price: unitPrice,
        is_overridden: false,
        override_reason: '',
        service,
      }])
    })
    setShowServicePicker(false)
  }

  function addCustomItem({ serviceName, placement, unit, quantity, numSessions, unitPrice }) {
    const selectedPlacement = placement || getCustomItemPlacement()
    const safeQuantity = Math.max(Number(quantity) || 0, 0)
    const safeNumSessions = Math.max(Number(numSessions) || 1, 1)
    const safeUnitPrice = Math.max(Number(unitPrice) || 0, 0)
    setItems(prev => sortQuoteItems([...prev, {
      local_id: makeLocalId(),
      service_code: 'CUSTOM',
      service_name: serviceName,
      service_name_raw: '',
      unit: unit || CUSTOM_ITEM_UNIT_OPTIONS[0],
      quantity: safeQuantity,
      num_sessions: safeNumSessions,
      unit_price: safeUnitPrice,
      original_unit_price: safeUnitPrice,
      total_price: safeQuantity * safeNumSessions * safeUnitPrice,
      is_custom: true,
      custom_sort_rank: selectedPlacement.sortRank,
      is_overridden: true,
      override_reason: '',
    }]))
    setShowCustomItemModal(false)
  }

  function validateBeforeSave() {
    if (!quote.entity_code) return 'Phải chọn pháp nhân.'
    if (!quote.tier_code) return 'Phải chọn loại khách.'
    if (!Number(quote.duration_hours)) return 'Phải nhập thời lượng.'
    if (!displayItems.length) return 'Phải có ít nhất 1 hạng mục.'
    if (displayItems.some(item => item.is_custom && !String(item.service_name || '').trim())) return 'Custom item cần có tên hạng mục.'
    return ''
  }

  async function ensureClientId() {
    if (quote.client_id) return quote.client_id

    const name = String(quote.client_name || clientQuery || '').trim()
    if (!name) return null
    if (!hasSupabaseConfig) {
      setQuote(prev => ({ ...prev, client_name: name }))
      return null
    }

    let response = await fromQuoteTable('clients')
      .insert({ name })
      .select()
      .single()

    if (isClientInsertBlocked(response.error)) {
      setQuote(prev => ({ ...prev, client_name: name }))
      return null
    }

    if (response.error?.message?.includes('name')) {
      response = await fromQuoteTable('clients')
        .insert({ client_name: name })
        .select()
        .single()
    }

    if (isClientInsertBlocked(response.error)) {
      setQuote(prev => ({ ...prev, client_name: name }))
      return null
    }

    if (response.error) throw response.error

    setClients(prev => [response.data, ...prev])
    setQuote(prev => ({ ...prev, client_id: response.data.id, client_name: name }))
    return response.data.id
  }

  async function saveQuote(status) {
    const error = validateBeforeSave()
    if (error) {
      setValidationError(error)
      return
    }

    setSaveState(status)
    setValidationError('')

    try {
      const now = new Date().toISOString()
      const clientName = String(quote.client_name || clientQuery || '').trim()
      const clientId = await ensureClientId()
      const quotePayload = {
        ai_input: inputText,
        entity_code: quote.entity_code,
        client_id: clientId,
        client_name: clientName || null,
        tier_code: quote.tier_code,
        event_name: quote.event_name,
        event_date: quote.event_date || null,
        location: quote.location,
        duration_hours: Number(quote.duration_hours),
        validity_days: normalizeQuoteValidityDays(quote.validity_days),
        has_vat: Boolean(quote.has_vat),
        status,
        sent_at: status === 'sent' ? now : null,
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
          unit_price: Number(item.unit_price),
          total_price: Number(item.total_price),
          is_overridden: Boolean(item.is_overridden),
          original_unit_price: item.original_unit_price ?? item.unit_price,
          override_reason: item.override_reason || null,
          custom_sort_rank: item.custom_sort_rank,
          sort_order: index + 1,
        })),
      }
      const saved = isEditMode ? await updateQuote(quoteId, quotePayload) : await createQuote(quotePayload)

      if (isEditMode) {
        navigate(`/quotes/${saved.id || quoteId}`)
        return
      }

      if (status === 'sent') {
        const shareToken = saved.share_token
        if (shareToken) {
          await navigator.clipboard?.writeText(`${window.location.origin}/q/${shareToken}`).catch(() => {})
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
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-[#f8981d]">{isEditMode ? 'Sửa báo giá Eventus AI' : 'Trợ lý báo giá Eventus AI'}</h1>
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
            <h2 className="mb-4 text-[16px] font-semibold text-slate-900">Thông tin chi tiết</h2>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px]">
              <label className="block">
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Loại khách</span>
                <select value={quote.tier_code} onChange={event => setQuote(prev => ({ ...prev, tier_code: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100">
                  {(customerTiers.length ? customerTiers : [{ tier_code: 'TIER_1' }, { tier_code: 'TIER_2' }, { tier_code: 'TIER_3' }]).map(tier => (
                    <option key={tier.tier_code || tier.code} value={tier.tier_code || tier.code}>{tier.tier_name || tier.name || tier.tier_code || tier.code}</option>
                  ))}
                </select>
              </label>
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
                <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Thời lượng</span>
                <input type="number" min="0" step="0.5" value={quote.duration_hours} onChange={event => setQuote(prev => ({ ...prev, duration_hours: event.target.value }))} className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-3 text-right text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </label>
            </div>
          </section>

          <QuoteItemsTable
            items={displayItems}
            onChangeItem={updateItem}
            onRemoveItem={index => setItems(prev => prev.filter((_, itemIndex) => itemIndex !== index))}
            onAddService={() => setShowServicePicker(true)}
            onAddCustomItem={() => setShowCustomItemModal(true)}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(180px,0.75fr)_minmax(280px,1.25fr)]">
              <div className="space-y-3">
                <div className="flex max-w-[260px] gap-2">
                  <label className="flex w-[92px] items-center justify-between rounded-lg border border-slate-200 px-2.5 py-2">
                    <span className="text-[11px] font-semibold text-slate-700">VAT 8%</span>
                    <input type="checkbox" checked={quote.has_vat} onChange={event => setQuote(prev => ({ ...prev, has_vat: event.target.checked }))} className="h-3.5 w-3.5 accent-[#f8981d]" />
                  </label>
                  <label className="block w-[130px]">
                    <span className="sr-only">Hiệu lực báo giá</span>
                    <select value={quote.validity_days} aria-label="Hiệu lực báo giá" onChange={event => setQuote(prev => ({ ...prev, validity_days: Number(event.target.value) }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[11px] font-semibold text-slate-700 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100">
                      <option value={7}>Hiệu lực 7 ngày</option>
                      <option value={15}>Hiệu lực 15 ngày</option>
                      <option value={30}>Hiệu lực 30 ngày</option>
                    </select>
                  </label>
                </div>
                <EntitySelector
                  compact
                  entities={legalEntities}
                  value={quote.entity_code}
                  onChange={entity_code => setQuote(prev => ({ ...prev, entity_code }))}
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
                  <div className="flex justify-end gap-5 text-slate-600"><span className="text-right">VAT</span><span className="min-w-[132px] text-right">{formatCurrency(totals.vat_amount)}đ</span></div>
                ) : null}
                <div className="flex justify-end gap-5 border-t border-slate-200 pt-3 text-[20px] font-bold text-slate-950"><span className="text-right">Total</span><span className="min-w-[132px] text-right">{formatCurrency(totals.total_amount)}đ</span></div>
              </div>
            </div>

            {validationError && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{validationError}</p>}
            <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saveState !== 'idle'}
                  onClick={() => saveQuote('draft')}
                  className={`rounded-xl px-5 py-3 text-[13px] font-semibold shadow-sm disabled:opacity-50 ${isEditMode ? 'bg-[#f8981d] text-white hover:bg-orange-500' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {saveState === 'draft' ? 'Đang lưu...' : (isEditMode ? 'Lưu thay đổi' : 'Lưu nháp')}
                </button>
                {!isEditMode && (
                  <button type="button" disabled={saveState !== 'idle'} onClick={() => saveQuote('sent')} className="rounded-xl bg-[#f8981d] px-5 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50">
                    {saveState === 'sent' ? 'Đang tạo link...' : 'Lưu & Tạo link gửi khách'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        <QuotePreview quote={quote} items={displayItems} totals={totals} entities={legalEntities} client={selectedClient} sticky={false} />
      </div>

      {showServicePicker && (
        <ServicePickerModal
          services={services}
          tierCode={quote.tier_code}
          onClose={() => setShowServicePicker(false)}
          onSelect={addServiceItem}
        />
      )}

      {showCustomItemModal && (
        <CustomItemModal
          onCancel={() => setShowCustomItemModal(false)}
          onConfirm={addCustomItem}
        />
      )}

      {overrideDraft && (
        <OverrideReasonModal
          onCancel={() => setOverrideDraft(null)}
          onConfirm={confirmOverride}
        />
      )}
    </div>
  )
}
