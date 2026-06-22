import { requireEventusAuth } from './lib/eventus-auth.js'
import { getActiveAiParseExamples, getPricingContext } from './lib/pricing-context.js'
import {
  getAiModelName,
  hasAnthropicKey,
  parseQuoteWithClaude,
} from './lib/claude-quote-parser.js'

function getQuoteParsePricingContext(context = {}) {
  return {
    services: context.services || [],
    travel_fees: context.travel_fees || context.travelFees || [],
    customer_tiers: context.customer_tiers || context.customerTiers || [],
    business_rules: context.business_rules || context.businessRulesRows || [],
    pricing_meta: context.meta || {},
  }
}

function withPricingMeta(result = {}, context = {}) {
  return {
    ...result,
    pricing_meta: context.pricing_meta || context.meta || {},
  }
}

function normalizeVietnameseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function briefHasExplicitNoEdit(inputText = '') {
  const normalized = normalizeVietnameseText(inputText)
  return /\b(khong dung|ko dung|khong edit|ko edit|no edit|raw|file tho)\b/.test(normalized)
}

function briefHasExplicitRecapEdit(inputText = '') {
  const normalized = normalizeVietnameseText(inputText)
  return /\b(dung|edit|hau ky)\b.*\b(recap|highlight|clip)\b/.test(normalized)
    || /\b(recap|highlight|clip)\b.*\b(dung|edit|hau ky)\b/.test(normalized)
}

function briefHasFullVideoIntent(inputText = '') {
  const normalized = normalizeVietnameseText(inputText)
  return /\b(quay full|full video|video full|full khong cat)\b/.test(normalized)
}

function briefNeedsDefaultRecapEdit(inputText = '', items = []) {
  const normalized = normalizeVietnameseText(inputText)
  const hasVideo = /\b(quay|video|videographer)\b/.test(normalized)
  const hasEditingDecision = briefHasExplicitNoEdit(inputText)
    || briefHasExplicitRecapEdit(inputText)
    || briefHasFullVideoIntent(inputText)
  if (hasEditingDecision) return false

  const parsedItems = Array.isArray(items) ? items : []
  if (parsedItems.length) return parsedItems.some(item => itemLooksLikeVideoShoot(item))
  return hasVideo && !/\b(live|livestream)\b/.test(normalized)
}

function getContextServiceCode(row = {}) {
  return String(row?.service_code || row?.code || '').trim().toUpperCase()
}

function serviceExists(context = {}, serviceCode) {
  return (context.services || []).some(row => {
    const code = getContextServiceCode(row)
    return code === serviceCode
  })
}

function getRuleValue(context = {}, code, fallback = null) {
  const rules = context.business_rules || context.businessRules || {}
  if (!Array.isArray(rules)) return rules?.[code] ?? fallback

  const row = rules.find(rule => rule?.rule_code === code || rule?.code === code || rule?.key === code)
  return row?.rule_value ?? row?.value ?? row?.config_value ?? fallback
}

function getDefaultDurationHours(context = {}) {
  const value = Number(getRuleValue(context, 'DEFAULT_DURATION_HOURS', 4))
  return Number.isFinite(value) && value > 0 ? value : 4
}

function getDefaultLocation(context = {}) {
  return String(getRuleValue(context, 'DEFAULT_LOCATION', 'Hà Nội') || 'Hà Nội').trim()
}

function getDefaultVideoEditService(context = {}) {
  return String(getRuleValue(context, 'DEFAULT_VIDEO_EDIT_SERVICE', 'RECAP_1_2_CAM') || '').trim().toUpperCase()
}

function getRuleNumber(context = {}, code, fallback) {
  const value = Number(String(getRuleValue(context, code, fallback)).replace(',', '.').match(/\d+(?:\.\d+)?/)?.[0] ?? fallback)
  return Number.isFinite(value) ? value : fallback
}

function getBriefDurationUnit(context = {}, durationHours) {
  const fullDayThreshold = getRuleNumber(context, 'FULL_DAY_THRESHOLD', 8)
  return Number(durationHours) >= fullDayThreshold ? '8H' : '4H'
}

function isLocalBriefLocation(location = '') {
  const normalized = normalizeVietnameseText(location)
  if (!normalized) return true
  if (normalized.includes('noi thanh')) return true
  if (normalized.includes('ha noi') && (normalized.includes('ngoai thanh') || normalized.includes('<30') || normalized.includes('30km'))) return true
  return normalized === 'ha noi' || normalized === 'hanoi' || normalized === 'hn'
}

function getBriefLocationUnit(location = '') {
  return isLocalBriefLocation(location) ? 'IN' : 'OUT'
}

const SERVICE_BASE_FALLBACK_CODES = {
  CHUP: 'PHOTO',
  QUAY_RECAP: 'VIDEO',
  QUAY_FULL: 'VIDEO_FULL',
}

function findContextServiceCode(context = {}, candidates = []) {
  const availableCodes = new Set((context.services || []).map(getContextServiceCode).filter(Boolean))
  return candidates.find(candidate => availableCodes.has(candidate)) || ''
}

function resolveBriefServiceCode(context = {}, baseCode = '', { location, durationHours } = {}) {
  const normalizedBase = String(baseCode || '').trim().toUpperCase()
  if (!normalizedBase) return null

  const locationUnit = getBriefLocationUnit(location || getDefaultLocation(context))
  const durationUnit = getBriefDurationUnit(context, durationHours || getDefaultDurationHours(context))
  const candidates = [
    `${normalizedBase}_${locationUnit}_${durationUnit}`,
    `${normalizedBase}_${durationUnit}`,
    `${normalizedBase}_${locationUnit}`,
    normalizedBase,
  ]
  const matched = findContextServiceCode(context, candidates)
  return matched || SERVICE_BASE_FALLBACK_CODES[normalizedBase] || normalizedBase
}

function getServiceCodeFromItem(item = {}) {
  return String(item?.service_code || item?.service?.service_code || item?.service?.code || '').trim().toUpperCase()
}

function itemLooksLikeVideoShoot(item = {}) {
  const serviceCode = getServiceCodeFromItem(item)
  if (/^(QUAY_LIVE|LIVE|LIVE_|FLYCAM|FPV)(?:_|$)/.test(serviceCode)) return false
  if (/^(VIDEO|VIDEO_FULL|QUAY_RECAP|QUAY_FULL)(?:_|$)/.test(serviceCode)) return true
  if (/^RECAP(?:_|$)/.test(serviceCode)) return false

  const rawText = normalizeVietnameseText([
    item?.service_name_raw,
    item?.service_name,
    item?.service?.service_name,
    item?.service?.quote_display_name,
    item?.service?.name,
  ].filter(Boolean).join(' '))

  if (/\b(dung|edit|hau ky)\b/.test(rawText)) return false
  if (/\b(live|livestream)\b/.test(rawText)) return false
  return /\b(quay|quay phim|video|videographer)\b/.test(rawText)
}

function getHalfDayCameraMultiplier(durationHours) {
  const duration = Number(durationHours)
  if (!Number.isFinite(duration) || duration <= 0) return 1
  return duration > 4.5 ? 2 : 1
}

function getVideoShootCameraCount(items = [], inputText = '', durationHours = null) {
  const defaultMultiplier = getHalfDayCameraMultiplier(durationHours)
  const parsedCount = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!itemLooksLikeVideoShoot(item)) return sum
    const quantity = Number(item?.quantity)
    const multiplier = getHalfDayCameraMultiplier(item?.billable_duration_hours ?? durationHours) || defaultMultiplier
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1) * multiplier
  }, 0)

  if (parsedCount > 0) return parsedCount
  return parseVideoQuantityFromText(normalizeVietnameseText(inputText)) * defaultMultiplier
}

function getRecapEditServiceForCameraCount(context = {}, cameraCount = 1) {
  const count = Number(cameraCount) || 1
  const candidates = [
    { max: 2, codes: ['RECAP_1_2_CAM'] },
    { max: 4, codes: ['RECAP_3_4_CAM'] },
    { max: 6, codes: ['RECAP_5_6_CAM'] },
    { max: Infinity, codes: ['RECAP_7_CAM', 'RECAP_7_8_CAM'] },
  ]
  const matched = candidates.find(candidate => count <= candidate.max)
    ?.codes
    .find(code => serviceExists(context, code))
  if (matched) return matched

  const fallback = getDefaultVideoEditService(context)
  return fallback && serviceExists(context, fallback) ? fallback : ''
}

function getRecapEditRawName(serviceCode = '') {
  const normalized = String(serviceCode || '').toUpperCase()
  if (normalized === 'RECAP_3_4_CAM') return 'dựng recap 3-4 cam'
  if (normalized === 'RECAP_5_6_CAM') return 'dựng recap 5-6 cam'
  if (normalized === 'RECAP_7_CAM' || normalized === 'RECAP_7_8_CAM') return 'dựng recap từ 7 cam'
  return 'dựng recap 1-2 cam'
}

function itemLooksLikeRecapEdit(item = {}) {
  return /^RECAP_(?:1_2|3_4|5_6|7|7_8)_CAM$/.test(getServiceCodeFromItem(item))
}

function getPostProductionGroup() {
  return {
    group_code: 'POST',
    group_label: 'Hạng mục hậu kỳ',
    group_sort_order: 4,
  }
}

function getSingleBriefGroup() {
  return {
    group_code: 'CUSTOM_DEFAULT',
    group_label: 'Nhóm 1',
    group_sort_order: 1,
  }
}

function applyPostProductionGroup(item = {}) {
  return {
    ...item,
    ...getPostProductionGroup(),
  }
}

function getOnsiteBriefItemKind(item = {}) {
  const serviceCode = getServiceCodeFromItem(item)
  const rawText = normalizeVietnameseText([
    item?.service_name_raw,
    item?.service_name,
    item?.service?.service_name,
    item?.service?.quote_display_name,
    item?.service?.name,
  ].filter(Boolean).join(' '))

  if (/^CHUP(?:_|$)/.test(serviceCode) || /\b(chup|photo|photographer)\b/.test(rawText)) return 'photo'
  if (/^(FLYCAM|FPV)(?:_|$)/.test(serviceCode) || /\b(flycam|drone|fpv)\b/.test(rawText)) return 'aerial'
  if (/^(QUAY_LIVE|LIVE|LIVE_)/.test(serviceCode) || /\b(live|livestream)\b/.test(rawText)) return 'live'
  if (itemLooksLikeVideoShoot(item)) return 'video'
  return ''
}

function hasExplicitBriefGrouping(inputText = '') {
  if (parseDaySections(inputText).length) return true
  const normalized = normalizeVietnameseText(inputText)
  return /\b(hang muc|nhom|group|tach rieng|rieng tung|separate)\b/.test(normalized)
}

function briefLooksLikeSingleMixedWorkPackage(inputText = '', items = []) {
  if (hasExplicitBriefGrouping(inputText)) return false

  const onsiteKinds = new Set(
    (Array.isArray(items) ? items : [])
      .map(getOnsiteBriefItemKind)
      .filter(Boolean)
  )

  return onsiteKinds.size >= 2
}

function applySingleBriefGroup(result, inputText = '') {
  const items = Array.isArray(result?.parsed?.items) ? result.parsed.items : []
  if (!briefLooksLikeSingleMixedWorkPackage(inputText, items)) return result

  const singleGroup = getSingleBriefGroup()
  const reasoningLine = 'Đã giữ các dịch vụ trong brief combo một dòng thành một nhóm hạng mục chung.'
  const existingReasoning = String(result?.ai_reasoning || '').trim()

  return {
    ...result,
    parsed: {
      ...result.parsed,
      items: items.map(item => ({
        ...item,
        ...singleGroup,
      })),
    },
    ai_reasoning: existingReasoning.includes(reasoningLine)
      ? existingReasoning
      : [existingReasoning, reasoningLine].filter(Boolean).join('\n'),
  }
}

export function applyBriefBusinessRules(result, inputText = '', context = {}) {
  const groupedResult = applyMultiDayBriefGroups(result, inputText, context)
  const items = Array.isArray(groupedResult?.parsed?.items) ? groupedResult.parsed.items : []
  if (!briefNeedsDefaultRecapEdit(inputText, items)) return applySingleBriefGroup(groupedResult, inputText)
  const cameraCount = getVideoShootCameraCount(items, inputText, groupedResult?.parsed?.duration_hours)
  const defaultEditService = getRecapEditServiceForCameraCount(context, cameraCount)
  if (!defaultEditService || !serviceExists(context, defaultEditService)) return applySingleBriefGroup(groupedResult, inputText)

  if (items.some(item => itemLooksLikeRecapEdit(item))) {
    let replaced = false
    return applySingleBriefGroup({
      ...groupedResult,
      parsed: {
        ...groupedResult.parsed,
        items: items.flatMap(item => {
          if (!itemLooksLikeRecapEdit(item)) return [item]
          if (replaced) return []
          replaced = true
          return [applyPostProductionGroup({
            ...item,
            service_code: defaultEditService,
            quantity: Number(item?.quantity) || 1,
            service_name_raw: getRecapEditRawName(defaultEditService),
          })]
        }),
      },
    }, inputText)
  }

  return applySingleBriefGroup({
    ...groupedResult,
    parsed: {
      ...groupedResult.parsed,
      items: [
        ...items,
        applyPostProductionGroup(makeFallbackItem(defaultEditService, 1, getRecapEditRawName(defaultEditService))),
      ],
    },
  }, inputText)
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function makeKeywordPattern(keyword = '') {
  return String(keyword || '')
    .trim()
    .split(/\s+/)
    .map(escapeRegExp)
    .join('\\s+')
}

function parseNumberBeforeKeyword(normalizedText, keywords = []) {
  for (const keyword of keywords) {
    const keywordPattern = makeKeywordPattern(keyword)
    const pattern = new RegExp(`(?:^|[\\s,;:/()])(?:x\\s*)?(\\d+(?:[,.]\\d+)?)\\s*(?:x\\s*)?(?:(?:nguoi|may|cam|camera)\\s+)?${keywordPattern}\\b`)
    const match = normalizedText.match(pattern)
    if (match) return Number(String(match[1]).replace(',', '.')) || 1
  }
  return keywords.some(keyword => new RegExp(`\\b${makeKeywordPattern(keyword)}\\b`).test(normalizedText)) ? 1 : 0
}

function parseNumberAfterKeyword(normalizedText, keywords = []) {
  for (const keyword of keywords) {
    const keywordPattern = makeKeywordPattern(keyword)
    const pattern = new RegExp(`\\b${keywordPattern}\\b\\s*(?:x\\s*)?(\\d+(?:[,.]\\d+)?)\\s*(?:nguoi|may|cam|camera|may quay)?\\b`)
    const match = normalizedText.match(pattern)
    if (match) return Number(String(match[1]).replace(',', '.')) || 1
  }
  return 0
}

function removeQuantityKeywordSegments(normalizedText = '', keywords = []) {
  return keywords.reduce((text, keyword) => {
    const keywordPattern = makeKeywordPattern(keyword)
    return text
      .replace(new RegExp(`(?:^|[\\s,;:/()])(?:x\\s*)?\\d+(?:[,.]\\d+)?\\s*(?:x\\s*)?(?:(?:nguoi|may|cam|camera)\\s+)?${keywordPattern}\\b`, 'g'), ' ')
      .replace(new RegExp(`\\b${keywordPattern}\\b\\s*(?:x\\s*)?\\d+(?:[,.]\\d+)?\\s*(?:nguoi|may|cam|camera|may quay)?\\b`, 'g'), ' ')
      .replace(new RegExp(`\\b${keywordPattern}\\b`, 'g'), ' ')
  }, normalizedText)
    .replace(/\s+/g, ' ')
    .trim()
}

function parseVideoQuantityFromText(normalizedText = '') {
  const beforeKeyword = parseNumberBeforeKeyword(normalizedText, ['quay', 'video', 'videographer'])
  if (beforeKeyword) return beforeKeyword

  const afterKeyword = normalizedText.match(/\b(?:quay|video|videographer)\b\s*(\d+(?:[,.]\d+)?)\s*(?:nguoi|may|cam|camera|may quay)?\b/)
  if (afterKeyword) return Number(String(afterKeyword[1]).replace(',', '.')) || 1

  const cameraMatch = normalizedText.match(/(?:^|\s)(\d+(?:[,.]\d+)?)\s*(?:may quay|cam|camera)\b/)
  if (cameraMatch && /\b(quay|video)\b/.test(normalizedText)) return Number(String(cameraMatch[1]).replace(',', '.')) || 1

  return /\b(quay|video|videographer)\b/.test(normalizedText) ? 1 : 0
}

function parseLiveQuantityFromText(normalizedText = '') {
  return parseNumberBeforeKeyword(normalizedText, ['quay live', 'live stream', 'livestream', 'live'])
    || parseNumberAfterKeyword(normalizedText, ['quay live', 'live stream', 'livestream', 'live'])
}

function parseDaySections(inputText = '') {
  const source = String(inputText || '')
  const markers = Array.from(source.matchAll(/(?:^|\n)\s*(?:ngày|ngay|day)\s*((?:\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?)|\d+)\s*[:.-]?\s*/gi))
  if (!markers.length) return []

  return markers.map((marker, index) => {
    const dayToken = String(marker[1] || index + 1).trim()
    const groupCode = `DAY_${dayToken.replace(/\D+/g, '_').replace(/^_+|_+$/g, '') || index + 1}`
    const start = marker.index + marker[0].length
    const end = markers[index + 1]?.index ?? source.length
    return {
      dayNumber: Number(dayToken) || index + 1,
      group: {
        group_code: groupCode,
        group_label: `Ngày ${dayToken}`,
        group_sort_order: index + 1,
      },
      text: source.slice(start, end).trim(),
    }
  }).filter(section => section.text)
}

function parseDurationHours(normalizedText, context = {}) {
  const hourMatch = normalizedText.match(/(\d+(?:[,.]\d+)?)\s*(?:tieng|h|gio)\b/)
  if (hourMatch) return Number(String(hourMatch[1]).replace(',', '.')) || null
  if (/\b(nua ngay|half day|4h)\b/.test(normalizedText)) return 4
  if (/\b(ca ngay|full day|8h)\b/.test(normalizedText)) return 8
  return getDefaultDurationHours(context)
}

function parseTierCode(normalizedText) {
  if (/\b(vingroup|vinhomes|vinpearl|jmb)\b/.test(normalizedText)) return 'TIER_1'
  if (/\b(khach quen|giam gia)\b/.test(normalizedText)) return 'TIER_3'
  return 'TIER_2'
}

function parseLocation(inputText, normalizedText, context = {}) {
  const defaultLocation = getDefaultLocation(context)
  if (/\b(noi thanh|ha noi|hanoi|hn)\b/.test(normalizedText)) return defaultLocation

  const travelLocations = (context.travel_fees || [])
    .map(row => row?.location || row?.location_name || row?.province || row?.city)
    .filter(Boolean)

  return travelLocations.find(location => normalizedText.includes(normalizeVietnameseText(location))) || defaultLocation
}

function makeFallbackItem(serviceCode, quantity, raw) {
  return {
    service_code: serviceCode,
    quantity,
    service_name_raw: raw,
  }
}

function makeFallbackItemWithMeta(serviceCode, quantity, raw, meta = {}) {
  return {
    ...makeFallbackItem(serviceCode, quantity, raw),
    ...meta,
  }
}

function buildDeterministicBriefItems(inputText = '', context = {}, itemMeta = {}) {
  const normalizedText = normalizeVietnameseText(inputText)
  const durationHours = parseDurationHours(normalizedText, context)
  const location = parseLocation(inputText, normalizedText, context)
  const meta = {
    ...itemMeta,
    billable_duration_hours: durationHours,
  }
  const items = []
  const resolveService = baseCode => resolveBriefServiceCode(context, baseCode, { location, durationHours })
  const liveAerialKeywords = ['flycam live', 'drone live', 'fpv live']
  const flycamLiveQty = parseNumberBeforeKeyword(normalizedText, ['flycam live', 'drone live'])
    || parseNumberAfterKeyword(normalizedText, ['flycam live', 'drone live'])
  const fpvLiveQty = parseNumberBeforeKeyword(normalizedText, ['fpv live'])
    || parseNumberAfterKeyword(normalizedText, ['fpv live'])
  const textWithoutAerialLive = removeQuantityKeywordSegments(normalizedText, liveAerialKeywords)
  const liveQty = parseLiveQuantityFromText(textWithoutAerialLive)
  const textWithoutLive = removeQuantityKeywordSegments(textWithoutAerialLive, ['quay live', 'live stream', 'livestream', 'live'])
  const photoQty = parseNumberBeforeKeyword(textWithoutLive, ['chup', 'photo', 'photographer'])
  const videoQty = parseVideoQuantityFromText(textWithoutLive)
  const flycamQty = parseNumberBeforeKeyword(textWithoutLive, ['flycam', 'drone'])
  const fpvQty = parseNumberBeforeKeyword(textWithoutLive, ['fpv'])
  const videoBaseCode = briefHasFullVideoIntent(textWithoutLive) ? 'QUAY_FULL' : 'QUAY_RECAP'

  if (photoQty) items.push(makeFallbackItemWithMeta(resolveService('CHUP'), photoQty, 'chụp ảnh', meta))
  if (videoQty) items.push(makeFallbackItemWithMeta(resolveService(videoBaseCode), videoQty, videoBaseCode === 'QUAY_FULL' ? 'quay full' : 'quay', meta))
  if (flycamQty) items.push(makeFallbackItemWithMeta(resolveService('FLYCAM'), flycamQty, 'flycam', meta))
  if (fpvQty) items.push(makeFallbackItemWithMeta(resolveService('FPV'), fpvQty, 'FPV', meta))
  if (flycamLiveQty) items.push(makeFallbackItemWithMeta(resolveService('FLYCAM_LIVE'), flycamLiveQty, 'flycam live', meta))
  if (fpvLiveQty) items.push(makeFallbackItemWithMeta(resolveService('FPV_LIVE'), fpvLiveQty, 'FPV live', meta))
  if (liveQty) items.push(makeFallbackItemWithMeta(resolveService('QUAY_LIVE'), liveQty, 'quay live', meta))

  if (briefHasExplicitRecapEdit(inputText) && !items.some(item => itemLooksLikeRecapEdit(item))) {
    const cameraCount = getVideoShootCameraCount(items, inputText, durationHours)
    const recapService = getRecapEditServiceForCameraCount(context, cameraCount)
    if (recapService) items.push(applyPostProductionGroup(makeFallbackItem(recapService, 1, getRecapEditRawName(recapService))))
  }

  return {
    items,
    location,
    duration_hours: durationHours,
    tier_code: parseTierCode(normalizedText),
    num_days: Number(normalizedText.match(/(\d+)\s*ngay/)?.[1]) || 1,
  }
}

function buildMultiDayBriefParse(inputText = '', context = {}) {
  const sections = parseDaySections(inputText)
  if (!sections.length) return null

  const parsedSections = sections.map(section => ({
    ...section,
    parsed: buildDeterministicBriefItems(section.text, context, section.group),
  }))
  const items = parsedSections.flatMap(section => section.parsed.items)
  if (!items.length) return null

  const durations = parsedSections
    .map(section => Number(section.parsed.duration_hours))
    .filter(duration => Number.isFinite(duration) && duration > 0)
  const locations = parsedSections.map(section => section.parsed.location).filter(Boolean)
  const tierCode = parsedSections.find(section => section.parsed.tier_code)?.parsed.tier_code || 'TIER_2'

  return {
    items,
    location: locations[0] || getDefaultLocation(context),
    duration_hours: durations.length ? Math.max(...durations) : getDefaultDurationHours(context),
    tier_code: tierCode,
    num_days: sections.length,
  }
}

function applyMultiDayBriefGroups(result, inputText = '', context = {}) {
  const multiDayParse = buildMultiDayBriefParse(inputText, context)
  if (!multiDayParse) return result
  const multiDayReasoningLine = 'Đã tách hạng mục theo từng ngày trong sales brief.'
  const existingReasoning = String(result?.ai_reasoning || '').trim()

  const existingPostItems = (Array.isArray(result?.parsed?.items) ? result.parsed.items : [])
    .filter(item => itemLooksLikeRecapEdit(item))
    .map(applyPostProductionGroup)
  const multiDayHasPostItems = multiDayParse.items.some(item => itemLooksLikeRecapEdit(item))

  return {
    ...result,
    parsed: {
      ...result.parsed,
      ...multiDayParse,
      event_date: result?.parsed?.event_date ?? null,
      event_name: null,
      items: [
        ...multiDayParse.items,
        ...(multiDayHasPostItems ? [] : existingPostItems),
      ],
    },
    ai_reasoning: existingReasoning.includes(multiDayReasoningLine)
      ? existingReasoning
      : [existingReasoning, multiDayReasoningLine].filter(Boolean).join('\n'),
  }
}

export function deterministicParseQuoteInput(inputText = '', context = {}) {
  const parseResult = buildMultiDayBriefParse(inputText, context) || buildDeterministicBriefItems(inputText, context)
  const items = parseResult.items

  const parsed = {
    items,
    location: parseResult.location,
    duration_hours: parseResult.duration_hours,
    tier_code: parseResult.tier_code,
    event_date: null,
    event_name: null,
    num_days: parseResult.num_days,
  }

  const missingFields = []
  if (!items.length) missingFields.push('items')

  return applyBriefBusinessRules({
    parsed,
    missing_fields: missingFields,
    ambiguous_fields: [],
    confidence: items.length ? 'medium' : 'low',
    ai_reasoning: 'Đã dùng parser nội bộ để phân tích brief.',
  }, inputText, context)
}

function withSourceMeta(result = {}, source = 'regex') {
  return { ...result, source }
}

function prependReasoningLine(result = {}, line = '') {
  if (!line) return result
  const existing = String(result?.ai_reasoning || '').trim()
  if (existing.includes(line)) return result
  return {
    ...result,
    ai_reasoning: [line, existing].filter(Boolean).join('\n'),
  }
}

function getRequestQuery(req = {}) {
  if (req?.query && typeof req.query === 'object') return req.query
  try {
    const url = new URL(req?.originalUrl || req?.url || '/', 'http://localhost')
    return Object.fromEntries(url.searchParams.entries())
  } catch {
    return {}
  }
}

function getQueryFlag(value) {
  if (Array.isArray(value)) return getQueryFlag(value[0])
  if (value === undefined || value === null) return false
  const text = String(value).trim().toLowerCase()
  return Boolean(text) && text !== '0' && text !== 'false'
}

const RESULT_CACHE_TTL_MS = 60 * 1000
const resultCache = new Map()

function pruneResultCache(now = Date.now()) {
  for (const [key, entry] of resultCache) {
    if (entry.expiresAt <= now) resultCache.delete(key)
  }
}

function getCachedResult(key) {
  if (!key) return null
  const entry = resultCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    resultCache.delete(key)
    return null
  }
  return entry.value
}

function setCachedResult(key, value) {
  if (!key) return
  pruneResultCache()
  resultCache.set(key, {
    value,
    expiresAt: Date.now() + RESULT_CACHE_TTL_MS,
  })
}

function buildResultCacheKey(inputText, mode) {
  return `${mode || 'regex'}::${inputText}`
}

export function clearParseQuoteResultCache() {
  resultCache.clear()
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (!await requireEventusAuth(req, res)) return
    const query = getRequestQuery(req)
    if (getQueryFlag(query?.probe)) {
      const aiAvailable = hasAnthropicKey()
      return res.status(200).json({
        ai_available: aiAvailable,
        model: aiAvailable ? getAiModelName() : null,
      })
    }
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireEventusAuth(req, res)) return

  const inputText = String(req.body?.input_text || '').trim()
  if (!inputText) return res.status(400).json({ error: 'Thiếu input_text.' })

  const mode = String(req.body?.mode || '').trim().toLowerCase()
  const context = getQuoteParsePricingContext(await getPricingContext())
  const cacheKey = buildResultCacheKey(inputText, mode)

  const cached = getCachedResult(cacheKey)
  if (cached) return res.status(200).json(cached)

  if (mode === 'ai' && hasAnthropicKey()) {
    try {
      const customExamples = await getActiveAiParseExamples()
      const aiResult = await parseQuoteWithClaude(inputText, context, { customExamples })
      const wrapped = applyBriefBusinessRules(aiResult, inputText, context)
      const payload = withPricingMeta(withSourceMeta(wrapped, 'ai'), context)
      setCachedResult(cacheKey, payload)
      return res.status(200).json(payload)
    } catch (error) {
      console.warn(`[claude-parser] fallback to regex: ${error?.message || error}`)
      const regexResult = deterministicParseQuoteInput(inputText, context)
      const explained = prependReasoningLine(
        regexResult,
        `AI tạm lỗi (${error?.message || 'unknown'}); đã rớt về parser cơ bản.`,
      )
      const payload = withPricingMeta(withSourceMeta(explained, 'ai_fallback'), context)
      setCachedResult(cacheKey, payload)
      return res.status(200).json(payload)
    }
  }

  if (mode === 'ai' && !hasAnthropicKey()) {
    const regexResult = deterministicParseQuoteInput(inputText, context)
    const explained = prependReasoningLine(
      regexResult,
      'Chưa cấu hình ANTHROPIC_API_KEY trên server; đã dùng parser cơ bản.',
    )
    const payload = withPricingMeta(withSourceMeta(explained, 'ai_fallback'), context)
    setCachedResult(cacheKey, payload)
    return res.status(200).json(payload)
  }

  const payload = withPricingMeta(
    withSourceMeta(deterministicParseQuoteInput(inputText, context), 'regex'),
    context,
  )
  setCachedResult(cacheKey, payload)
  return res.status(200).json(payload)
}
