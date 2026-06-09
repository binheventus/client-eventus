import { requireEventusAuth } from './lib/eventus-auth.js'

const DEFAULT_OPENAI_MODEL = 'gpt-5.4'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com'
const DEFAULT_QUOTE_PARSE_TIMEOUT_MS = 12000
const MANUAL_ADD_INSTRUCTION = 'Bạn hãy thêm thủ công ở ô bên dưới nhé.'
const EMPTY_QUOTE_PARSE_RESULT = {
  parsed: {
    items: [],
    location: 'Hà Nội',
    duration_hours: 4,
    tier_code: null,
    event_date: null,
    event_name: null,
    num_days: 1,
  },
  missing_fields: ['items'],
  ambiguous_fields: [],
  confidence: 'low',
  ai_reasoning: '',
}

export const quoteParseSystemPrompt = `Bạn là AI parser cho module Báo giá tự động của Eventus.

Nhiệm vụ của bạn: đọc một câu tự nhiên do sales Eventus nhập bằng tiếng Việt hoặc Việt-Anh lẫn lộn, rồi trả về DUY NHẤT một JSON object hợp lệ theo schema được yêu cầu. Không trả Markdown, không giải thích ngoài JSON.

Bối cảnh Eventus:
- Eventus cung cấp dịch vụ quay, chụp, flycam, live sự kiện, profile, wedding và video highlight/full.
- Sales thường viết tắt: "chụp" = photographer/chụp ảnh, "quay" = videographer/quay phim, "flycam" = flycam, "live" = quay live, "highlight" = video highlight, "full" = quay full không cắt.
- Nếu sales không nói thời gian, mặc định là 4 tiếng/gói 4H.
- Nếu sales không nói địa điểm, mặc định là nội thành Hà Nội.
- "nửa ngày", "4H" hoặc thời lượng dưới 8 tiếng là gói 4H; nếu thời lượng > 4.5 tiếng và < 8 tiếng thì vẫn chọn service_code 4H và giữ duration_hours thực tế để hệ thống tính giờ phát sinh. Ví dụ 5 tiếng = gói 4H + 1 giờ phát sinh, không phải gói 8H.
- "cả ngày", "8H" hoặc thời lượng >= 8 tiếng là gói 8H.
- Thời lượng > 8 tiếng vẫn là full-day/gói 8H và cần giữ duration_hours để hệ thống tính giờ vượt.
- Nội thành Hà Nội hoặc ngoại thành Hà Nội dưới 30km là local/in-city. Các tỉnh/thành khác là out-city/đi tỉnh.
- Tier khách: "khách lạ", "khách mới", "khách thường", "thông thường" = TIER_2. "khách quen", "giảm giá" = TIER_3. "VinGroup", "Vingroup", "VinHomes", "Vinhomes", "VinPearl", "Vinpearl", "JMB" = TIER_1.

Quy tắc bắt buộc:
- Chỉ dùng service_code có trong context.services. TUYỆT ĐỐI không tự bịa service_code.
- Nếu thiếu thông tin bắt buộc: items thì thêm tên field vào missing_fields.
- Nếu có thông tin mơ hồ thì thêm vào ambiguous_fields và không đoán bừa, trừ các mặc định đã nêu ở trên.
- Nếu sales chỉ ghi "chụp" hoặc "1 chụp" mà không nói gì thêm, mặc định chọn CHUP_IN_4H nếu service_code này có trong context.services.
- Nếu sales chỉ ghi "quay", "1 quay" hoặc "quay phim" mà không ghi rõ "full", mặc định hiểu là quay recap và chọn QUAY_RECAP_IN_4H nếu service_code này có trong context.services.
- Chỉ chọn service_code nhóm QUAY_FULL khi sales ghi rõ "quay full", "full video", "full không cắt" hoặc ý tương đương.
- Nếu brief có hạng mục quay/quay phim/video nhưng sales không nói dựng gì, mặc định vẫn thêm hạng mục dựng recap, nhưng phải chọn theo tổng số máy quay quy đổi nửa ngày: 1 máy quay ≤4.5h = 1, 1 máy quay cả ngày/8H = 2. 1-2 máy quy đổi = RECAP_1_2_CAM, 3-4 máy quy đổi = RECAP_3_4_CAM, 5-6 máy quy đổi = RECAP_5_6_CAM, từ 7 máy quy đổi trở lên = RECAP_7_CAM nếu có trong context.services, nếu không thì dùng RECAP_7_8_CAM. Ví dụ "4 quay" nửa ngày phải thêm RECAP_3_4_CAM; "3 quay cả ngày" phải hiểu là 6 máy nửa ngày và thêm RECAP_5_6_CAM; "4 quay cả ngày" phải hiểu là 8 máy nửa ngày và thêm RECAP_7_CAM.
- Khi đã tự thêm dựng recap theo quy tắc mặc định, KHÔNG thêm editing_service vào missing_fields hoặc ambiguous_fields.
- Nếu một dịch vụ có thể map chắc chắn theo từ khóa rõ ràng thì chọn service_code phù hợp nhất từ context.services, có xét location IN/OUT và 4H/8H theo duration_hours. Với duration_hours > 4.5 và < 8, vẫn chọn service_code 4H.
- Nếu không có service_code phù hợp trong context.services thì vẫn giữ service_name_raw và KHÔNG điền service_code bịa; có thể để service_code null và thêm ambiguous_fields.
- event_date trả null nếu không thấy ngày.
- event_date là thông tin phụ, KHÔNG thêm vào missing_fields nếu thiếu.
- num_days mặc định là 1 nếu không nói nhiều ngày; nếu "2 ngày", "2 ngày liên tiếp" thì num_days = 2.
- confidence = high nếu đủ chắc chắn, medium nếu thiếu field nhưng item/location/duration/tier tương đối rõ, low nếu nhiều mơ hồ.
- ai_reasoning viết ngắn gọn, mỗi ý trên một dòng trong cùng chuỗi JSON, không dùng Markdown bullet.

Schema output bắt buộc:
{
  "parsed": {
    "items": [
      { "service_code": "CHUP_IN_4H", "quantity": 2, "service_name_raw": "chụp ảnh" }
    ],
    "location": "Hải Phòng",
    "duration_hours": 5,
    "tier_code": "TIER_2",
    "event_date": null,
    "num_days": 1
  },
  "missing_fields": [],
  "ambiguous_fields": [],
  "confidence": "high",
  "ai_reasoning": "Sales nhập 2 chụp 4 quay.\n2 photographer -> CHUP_IN_4H.\n4 videographer -> QUAY_RECAP_IN_4H.\nTự thêm dựng recap RECAP_3_4_CAM theo số máy quay."
}`

function normalizeApiKey(value = '') {
  return String(value)
    .trim()
    .replace(/^OPENAI_API_KEY\s*=\s*/i, '')
    .replace(/^ANTHROPIC_API_KEY\s*=\s*/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

function normalizeBaseUrl(value = '') {
  return String(value || DEFAULT_OPENAI_BASE_URL)
    .trim()
    .replace(/^OPENAI_BASE_URL\s*=\s*/i, '')
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/+$/, '')
}

function compactRows(rows = [], fields = []) {
  return (Array.isArray(rows) ? rows : []).slice(0, 300).map(row => {
    if (!fields.length) return row
    return fields.reduce((acc, field) => {
      if (row?.[field] !== undefined && row?.[field] !== null) acc[field] = row[field]
      return acc
    }, {})
  })
}

function buildQuoteParseUserMessage(inputText, context = {}) {
  const compactContext = {
    services: compactRows(context.services, ['service_code', 'code', 'service_name', 'quote_display_name', 'name', 'category', 'price_tier_1', 'price_tier_2', 'price_tier_3']),
    travel_fees: compactRows(context.travel_fees, ['location', 'location_name', 'province', 'city', 'condition', 'fee_per_person_per_day']),
    customer_tiers: compactRows(context.customer_tiers, ['tier_code', 'code', 'tier_name', 'name']),
    business_rules: compactRows(context.business_rules, ['rule_code', 'code', 'rule_value', 'value', 'category']),
  }

  return `Input sales cần parse:
${inputText}

Context bảng giá rút gọn:
${JSON.stringify(compactContext, null, 2)}

Hãy trả về đúng một JSON object theo schema trong system prompt.`
}

function buildJsonRepairMessage(rawText, parseError) {
  return `Nội dung dưới đây đáng lẽ là JSON cho module báo giá nhưng chưa parse được.

Lỗi parse:
${parseError?.message || parseError || 'Unknown parse error'}

Nội dung cần sửa:
${String(rawText || '').slice(0, 6000)}

Hãy trả về DUY NHẤT một JSON object hợp lệ đúng schema trong system prompt.
Không markdown, không giải thích, không bọc trong code fence.`
}

function extractTextFromAnthropic(payload) {
  return payload?.content
    ?.map(block => block?.type === 'text' ? block.text : '')
    .join('')
    .trim() || ''
}

function extractTextFromOpenAI(payload) {
  if (payload?.output_text) return String(payload.output_text).trim()

  return (payload?.output || [])
    .flatMap(item => item?.content || [])
    .map(content => content?.text || '')
    .join('')
    .trim()
}

function stripCodeFence(text = '') {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function findBalancedJsonObject(text = '') {
  const source = String(text || '')
  const start = source.indexOf('{')
  if (start < 0) return ''

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) return source.slice(start, index + 1)
  }

  return ''
}

function parseJsonObject(text = '') {
  const clean = stripCodeFence(text)
  try {
    return JSON.parse(clean)
  } catch {
    const balanced = findBalancedJsonObject(clean)
    if (!balanced) throw new Error('AI không trả về JSON hợp lệ.')
    return JSON.parse(balanced)
  }
}

function parseAndNormalizeJson(text) {
  return normalizeParsedPayload(parseJsonObject(text))
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

function normalizeParsedPayload(payload) {
  return {
    parsed: {
      items: Array.isArray(payload?.parsed?.items) ? payload.parsed.items : [],
      location: payload?.parsed?.location ?? null,
      duration_hours: payload?.parsed?.duration_hours ?? null,
      tier_code: payload?.parsed?.tier_code ?? null,
      event_date: payload?.parsed?.event_date ?? null,
      event_name: null,
      num_days: payload?.parsed?.num_days ?? 1,
    },
    missing_fields: Array.isArray(payload?.missing_fields) ? payload.missing_fields : [],
    ambiguous_fields: Array.isArray(payload?.ambiguous_fields) ? payload.ambiguous_fields : [],
    confidence: ['high', 'medium', 'low'].includes(payload?.confidence) ? payload.confidence : 'low',
    ai_reasoning: String(payload?.ai_reasoning || '').trim(),
  }
}

function withRepairNotice(result) {
  return {
    ...result,
    ai_reasoning: result.ai_reasoning
      ? `${result.ai_reasoning} (Đã tự chuẩn hóa lại JSON từ phản hồi AI.)`
      : 'Đã tự chuẩn hóa lại JSON từ phản hồi AI.',
  }
}

function fallbackParseResult(reason) {
  return {
    ...EMPTY_QUOTE_PARSE_RESULT,
    ai_reasoning: appendManualAddInstruction(reason || 'AI chưa trả về JSON hợp lệ, vui lòng nhập thủ công hoặc thử lại với brief ngắn hơn.'),
  }
}

function appendManualAddInstruction(message = '') {
  const text = String(message || '').trim()
  if (!text) return MANUAL_ADD_INSTRUCTION
  if (text.includes(MANUAL_ADD_INSTRUCTION)) return text
  return `${text} ${MANUAL_ADD_INSTRUCTION}`
}

function extractApiError(payload, fallback) {
  if (typeof payload === 'string') {
    const title = payload.match(/<title>(.*?)<\/title>/i)?.[1]
    const heading = payload.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return title || heading || fallback
  }

  return payload?.error?.message
    || payload?.message
    || payload?.error_description
    || payload?.error
    || fallback
}

function parseMaybeJson(text = '') {
  try {
    return JSON.parse(text || '{}')
  } catch {
    return null
  }
}

function getQuoteParseTimeoutMs() {
  const value = Number(process.env.QUOTE_PARSE_TIMEOUT_MS || DEFAULT_QUOTE_PARSE_TIMEOUT_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_QUOTE_PARSE_TIMEOUT_MS
}

async function fetchAiProvider(url, options = {}) {
  const timeoutMs = getQuoteParseTimeoutMs()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`AI provider quá thời gian phản hồi sau ${Math.round(timeoutMs / 1000)} giây.`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
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

export function deterministicParseQuoteInput(inputText = '', context = {}, reason = '') {
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
    ai_reasoning: reason
      ? appendManualAddInstruction(`AI provider đang lỗi (${reason}). Đã dùng parser nội bộ để phân tích brief.`)
      : 'Đã dùng parser nội bộ để phân tích brief.',
  }, inputText, context)
}

function isUsableDeterministicParse(result = {}) {
  const items = Array.isArray(result?.parsed?.items) ? result.parsed.items : []
  return items.length > 0 && !(result?.missing_fields || []).includes('items')
}

async function callOpenAI({ apiKey, inputText, context }) {
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL)
  const model = process.env.QUOTE_PARSE_MODEL || DEFAULT_OPENAI_MODEL
  const userMessage = buildQuoteParseUserMessage(inputText, context)

  if (/^claude/i.test(model)) {
    return callOpenAIChatCompletions({ apiKey, inputText, context, baseUrl, model, userMessage })
  }

  const response = await fetchAiProvider(`${baseUrl}/v1/responses`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      instructions: quoteParseSystemPrompt,
      input: userMessage,
      max_output_tokens: 1600,
      text: {
        format: {
          type: 'json_schema',
          name: 'quote_parse_result',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              parsed: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        service_code: { type: ['string', 'null'] },
                        quantity: { type: 'number' },
                        service_name_raw: { type: 'string' },
                      },
                      required: ['service_code', 'quantity', 'service_name_raw'],
                    },
                  },
                  location: { type: ['string', 'null'] },
                  duration_hours: { type: ['number', 'null'] },
                  tier_code: { type: ['string', 'null'] },
                  event_date: { type: ['string', 'null'] },
                  num_days: { type: 'number' },
                },
                required: ['items', 'location', 'duration_hours', 'tier_code', 'event_date', 'num_days'],
              },
              missing_fields: {
                type: 'array',
                items: { type: 'string' },
              },
              ambiguous_fields: {
                type: 'array',
                items: { type: 'string' },
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low'],
              },
              ai_reasoning: { type: 'string' },
            },
            required: ['parsed', 'missing_fields', 'ambiguous_fields', 'confidence', 'ai_reasoning'],
          },
        },
      },
    }),
  })

  const rawPayload = await response.text()
  const payload = parseMaybeJson(rawPayload)
  if (!response.ok) {
    const message = extractApiError(payload || rawPayload, `OpenAI API trả về HTTP ${response.status}.`)
    const maybeUnsupportedResponses = [404, 405].includes(response.status) || /responses|not found|unsupported|unknown/i.test(message)
    const maybeTransientGateway = [502, 503, 504].includes(response.status) || /bad gateway|gateway|cloudflare|temporar/i.test(message)
    if (maybeUnsupportedResponses || maybeTransientGateway) {
      return callOpenAIChatCompletions({ apiKey, inputText, context, baseUrl, model, userMessage, previousError: message })
    }
    throw new Error(message || 'OpenAI API trả về lỗi khi parse báo giá.')
  }

  const normalizedPayload = payload || {}
  const text = extractTextFromOpenAI(normalizedPayload)
  if (!text) {
    return callOpenAIChatCompletions({ apiKey, inputText, context, baseUrl, model, userMessage })
  }

  try {
    return applyBriefBusinessRules(parseAndNormalizeJson(text), inputText, context)
  } catch (error) {
    return repairOpenAIJson({ apiKey, baseUrl, model, rawText: text, parseError: error })
  }
}

async function callOpenAIChatCompletions({ apiKey, inputText, context, baseUrl, model, userMessage, previousError }) {
  const message = userMessage || buildQuoteParseUserMessage(inputText, context)
  const response = await fetchAiProvider(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: quoteParseSystemPrompt },
        { role: 'user', content: message },
      ],
    }),
  })

  const rawPayload = await response.text()
  const payload = parseMaybeJson(rawPayload)
  if (!response.ok) {
    const detail = extractApiError(payload || rawPayload, previousError || `OpenAI-compatible API trả về HTTP ${response.status}.`)
    throw new Error(detail || 'OpenAI-compatible API trả về lỗi khi parse báo giá.')
  }

  const text = payload?.choices?.[0]?.message?.content || ''
  try {
    return applyBriefBusinessRules(parseAndNormalizeJson(text), inputText, context)
  } catch (error) {
    return repairOpenAIJson({ apiKey, baseUrl, model, rawText: text, parseError: error })
  }
}

async function repairOpenAIJson({ apiKey, baseUrl, model, rawText, parseError }) {
  if (!rawText) return fallbackParseResult('AI chưa trả về nội dung để phân tích.')

  const response = await fetchAiProvider(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: quoteParseSystemPrompt },
        { role: 'user', content: buildJsonRepairMessage(rawText, parseError) },
      ],
    }),
  })

  const rawPayload = await response.text()
  const payload = parseMaybeJson(rawPayload)
  if (!response.ok) {
    return fallbackParseResult(extractApiError(payload || rawPayload, 'AI chưa trả về JSON hợp lệ sau khi thử sửa.'))
  }

  try {
    return withRepairNotice(parseAndNormalizeJson(payload?.choices?.[0]?.message?.content || ''))
  } catch {
    return fallbackParseResult('AI chưa trả về JSON hợp lệ sau khi thử lại. Vui lòng nhập thủ công hoặc viết brief ngắn hơn.')
  }
}

async function callAnthropic({ apiKey, inputText, context }) {
  const response = await fetchAiProvider('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.QUOTE_PARSE_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 1600,
      temperature: 0,
      system: quoteParseSystemPrompt,
      messages: [
        {
          role: 'user',
          content: buildQuoteParseUserMessage(inputText, context),
        },
      ],
    }),
  })

  const rawPayload = await response.text()
  const payload = parseMaybeJson(rawPayload)
  if (!response.ok) {
    throw new Error(extractApiError(payload || rawPayload, 'Claude API trả về lỗi khi parse báo giá.'))
  }

  try {
    return parseAndNormalizeJson(extractTextFromAnthropic(payload))
  } catch {
    return fallbackParseResult('AI chưa trả về JSON hợp lệ. Vui lòng nhập thủ công hoặc thử lại với brief ngắn hơn.')
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!await requireEventusAuth(req, res)) return

  const inputText = String(req.body?.input_text || '').trim()
  if (!inputText) return res.status(400).json({ error: 'Thiếu input_text.' })

  const context = req.body?.context || {}
  const deterministicResult = deterministicParseQuoteInput(inputText, context)
  if (isUsableDeterministicParse(deterministicResult)) {
    return res.status(200).json(deterministicResult)
  }

  const openAiKey = normalizeApiKey(process.env.OPENAI_API_KEY)
  const anthropicKey = normalizeApiKey(process.env.ANTHROPIC_API_KEY)
  if (!openAiKey && !anthropicKey) {
    return res.status(200).json(deterministicParseQuoteInput(
      inputText,
      context,
      'Thiếu OPENAI_API_KEY hoặc ANTHROPIC_API_KEY trên môi trường backend.'
    ))
  }

  try {
    let result
    let aiError = null

    if (openAiKey) {
      try {
        result = await callOpenAI({
          apiKey: openAiKey,
          inputText,
          context,
        })
      } catch (error) {
        aiError = error
      }
    }

    if (!result && anthropicKey) {
      try {
        result = await callAnthropic({
          apiKey: anthropicKey,
          inputText,
          context,
        })
      } catch (error) {
        aiError = error
      }
    }

    result ||= deterministicParseQuoteInput(inputText, context, aiError?.message || 'AI provider không khả dụng')

    return res.status(200).json(applyBriefBusinessRules(result, inputText, context))
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Không parse được input báo giá.' })
  }
}
