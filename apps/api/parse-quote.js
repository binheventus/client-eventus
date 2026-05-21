const DEFAULT_OPENAI_MODEL = 'gpt-5.4'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com'
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
- Nếu brief có hạng mục quay/quay phim/video nhưng sales không nói dựng gì, mặc định vẫn thêm hạng mục dựng recap, nhưng phải chọn theo tổng số máy quay: 1-2 máy = RECAP_1_2_CAM, 3-4 máy = RECAP_3_4_CAM, 5-6 máy = RECAP_5_6_CAM, từ 7 máy trở lên = RECAP_7_CAM nếu có trong context.services, nếu không thì dùng RECAP_7_8_CAM. Ví dụ "4 quay" phải thêm RECAP_3_4_CAM, không được dùng RECAP_1_2_CAM.
- Khi đã tự thêm dựng recap theo quy tắc mặc định, KHÔNG thêm editing_service vào missing_fields hoặc ambiguous_fields.
- Nếu một dịch vụ có thể map chắc chắn theo từ khóa rõ ràng thì chọn service_code phù hợp nhất từ context.services, có xét location IN/OUT và 4H/8H theo duration_hours. Với duration_hours > 4.5 và < 8, vẫn chọn service_code 4H.
- Nếu không có service_code phù hợp trong context.services thì vẫn giữ service_name_raw và KHÔNG điền service_code bịa; có thể để service_code null và thêm ambiguous_fields.
- event_date trả null nếu không thấy ngày.
- event_name trả null nếu không thấy tên event rõ ràng.
- event_date và event_name là thông tin phụ, KHÔNG thêm vào missing_fields nếu thiếu.
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
    "event_name": null,
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

function briefNeedsDefaultRecapEdit(inputText = '') {
  const normalized = normalizeVietnameseText(inputText)
  const hasVideo = /\b(quay|video)\b/.test(normalized)
  const hasEditingDecision = /\b(dung|edit|hau ky|khong dung|ko dung|no edit|raw|file tho)\b/.test(normalized)
  return hasVideo && !hasEditingDecision
}

function serviceExists(context = {}, serviceCode) {
  return (context.services || []).some(row => {
    const code = String(row?.service_code || row?.code || '').trim().toUpperCase()
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

function getServiceCodeFromItem(item = {}) {
  return String(item?.service_code || item?.service?.service_code || item?.service?.code || '').trim().toUpperCase()
}

function itemLooksLikeVideoShoot(item = {}) {
  const serviceCode = getServiceCodeFromItem(item)
  if (/^QUAY_(RECAP|FULL)(?:_|$)/.test(serviceCode)) return true
  if (/^RECAP(?:_|$)/.test(serviceCode)) return false
  if (/^(LIVE|LIVE_|FLYCAM|FPV)/.test(serviceCode)) return false

  const rawText = normalizeVietnameseText([
    item?.service_name_raw,
    item?.service_name,
    item?.service?.service_name,
    item?.service?.quote_display_name,
    item?.service?.name,
  ].filter(Boolean).join(' '))

  if (/\b(dung|edit|hau ky)\b/.test(rawText)) return false
  return /\b(quay|quay phim|video|videographer)\b/.test(rawText)
}

function getVideoShootCameraCount(items = [], inputText = '') {
  const parsedCount = (Array.isArray(items) ? items : []).reduce((sum, item) => {
    if (!itemLooksLikeVideoShoot(item)) return sum
    const quantity = Number(item?.quantity)
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
  }, 0)

  if (parsedCount > 0) return parsedCount
  return parseVideoQuantityFromText(normalizeVietnameseText(inputText))
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

export function applyBriefBusinessRules(result, inputText = '', context = {}) {
  if (!briefNeedsDefaultRecapEdit(inputText)) return result
  const items = Array.isArray(result?.parsed?.items) ? result.parsed.items : []
  const cameraCount = getVideoShootCameraCount(items, inputText)
  const defaultEditService = getRecapEditServiceForCameraCount(context, cameraCount)
  if (!defaultEditService || !serviceExists(context, defaultEditService)) return result

  if (items.some(item => itemLooksLikeRecapEdit(item))) {
    let replaced = false
    return {
      ...result,
      parsed: {
        ...result.parsed,
        items: items.flatMap(item => {
          if (!itemLooksLikeRecapEdit(item)) return [item]
          if (replaced) return []
          replaced = true
          return [{
            ...item,
            service_code: defaultEditService,
            quantity: Number(item?.quantity) || 1,
            service_name_raw: getRecapEditRawName(defaultEditService),
          }]
        }),
      },
    }
  }

  return {
    ...result,
    parsed: {
      ...result.parsed,
      items: [
        ...items,
        makeFallbackItem(defaultEditService, 1, getRecapEditRawName(defaultEditService)),
      ],
    },
  }
}

function normalizeParsedPayload(payload) {
  return {
    parsed: {
      items: Array.isArray(payload?.parsed?.items) ? payload.parsed.items : [],
      location: payload?.parsed?.location ?? null,
      duration_hours: payload?.parsed?.duration_hours ?? null,
      tier_code: payload?.parsed?.tier_code ?? null,
      event_date: payload?.parsed?.event_date ?? null,
      event_name: payload?.parsed?.event_name ?? null,
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
    ai_reasoning: reason || 'AI chưa trả về JSON hợp lệ, vui lòng nhập thủ công hoặc thử lại với brief ngắn hơn.',
  }
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

function parseNumberBeforeKeyword(normalizedText, keywords = []) {
  for (const keyword of keywords) {
    const pattern = new RegExp(`(?:^|\\s)(\\d+(?:[,.]\\d+)?)\\s*(?:(?:nguoi|may)\\s+)?${keyword}\\b`)
    const match = normalizedText.match(pattern)
    if (match) return Number(String(match[1]).replace(',', '.')) || 1
  }
  return keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(normalizedText)) ? 1 : 0
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

export function deterministicParseQuoteInput(inputText = '', context = {}, reason = '') {
  const normalizedText = normalizeVietnameseText(inputText)
  const items = []
  const photoQty = parseNumberBeforeKeyword(normalizedText, ['chup', 'photo', 'photographer'])
  const videoQty = parseVideoQuantityFromText(normalizedText)
  const flycamQty = parseNumberBeforeKeyword(normalizedText, ['flycam', 'drone'])
  const liveQty = parseNumberBeforeKeyword(normalizedText, ['live', 'livestream'])

  if (photoQty) items.push(makeFallbackItem('CHUP_IN_4H', photoQty, 'chụp ảnh'))
  if (videoQty) items.push(makeFallbackItem(normalizedText.includes('quay full') ? 'QUAY_FULL_IN_4H' : 'QUAY_RECAP_IN_4H', videoQty, normalizedText.includes('quay full') ? 'quay full' : 'quay'))
  if (flycamQty) items.push(makeFallbackItem('FLYCAM', flycamQty, 'flycam'))
  if (liveQty) items.push(makeFallbackItem('LIVE_VIDEO', liveQty, 'live'))

  const parsed = {
    items,
    location: parseLocation(inputText, normalizedText, context),
    duration_hours: parseDurationHours(normalizedText, context),
    tier_code: parseTierCode(normalizedText),
    event_date: null,
    event_name: null,
    num_days: Number(normalizedText.match(/(\d+)\s*ngay/)?.[1]) || 1,
  }

  const missingFields = []
  if (!items.length) missingFields.push('items')

  return applyBriefBusinessRules({
    parsed,
    missing_fields: missingFields,
    ambiguous_fields: [],
    confidence: items.length ? 'medium' : 'low',
    ai_reasoning: reason
      ? `AI provider đang lỗi (${reason}). Đã dùng parser nội bộ để phân tích brief.`
      : 'Đã dùng parser nội bộ để phân tích brief.',
  }, inputText, context)
}

async function callOpenAI({ apiKey, inputText, context }) {
  const baseUrl = normalizeBaseUrl(process.env.OPENAI_BASE_URL)
  const model = process.env.QUOTE_PARSE_MODEL || DEFAULT_OPENAI_MODEL
  const userMessage = buildQuoteParseUserMessage(inputText, context)

  if (/^claude/i.test(model)) {
    return callOpenAIChatCompletions({ apiKey, inputText, context, baseUrl, model, userMessage })
  }

  const response = await fetch(`${baseUrl}/v1/responses`, {
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
                  event_name: { type: ['string', 'null'] },
                  num_days: { type: 'number' },
                },
                required: ['items', 'location', 'duration_hours', 'tier_code', 'event_date', 'event_name', 'num_days'],
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
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
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
  const response = await fetch('https://api.anthropic.com/v1/messages', {
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

  const inputText = String(req.body?.input_text || '').trim()
  if (!inputText) return res.status(400).json({ error: 'Thiếu input_text.' })

  const context = req.body?.context || {}
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
