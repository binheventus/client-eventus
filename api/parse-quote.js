const DEFAULT_OPENAI_MODEL = 'gpt-5-mini'
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'

export const quoteParseSystemPrompt = `Bạn là AI parser cho module Báo giá tự động của Eventus.

Nhiệm vụ của bạn: đọc một câu tự nhiên do sales Eventus nhập bằng tiếng Việt hoặc Việt-Anh lẫn lộn, rồi trả về DUY NHẤT một JSON object hợp lệ theo schema được yêu cầu. Không trả Markdown, không giải thích ngoài JSON.

Bối cảnh Eventus:
- Eventus cung cấp dịch vụ quay, chụp, flycam, live sự kiện, profile, wedding và video highlight/full.
- Sales thường viết tắt: "chụp" = photographer/chụp ảnh, "quay" = videographer/quay phim, "flycam" = flycam, "live" = quay live, "highlight" = video highlight, "full" = quay full không cắt.
- "nửa ngày", "HD" hoặc thời lượng <= 4.5 tiếng là half-day.
- "cả ngày", "full day", "FD" hoặc thời lượng > 4.5 tiếng và <= 8 tiếng là full-day.
- Thời lượng > 8 tiếng vẫn là full-day và cần giữ duration_hours để hệ thống tính giờ vượt.
- Nội thành Hà Nội hoặc ngoại thành Hà Nội dưới 30km là local/in-city. Các tỉnh/thành khác là out-city/đi tỉnh.
- Tier khách: "khách lạ", "khách mới", "khách thường", "thông thường" = TIER_2. "khách quen", "giảm giá" = TIER_3. "VinGroup", "Vingroup", "VinHomes", "Vinhomes", "VinPearl", "Vinpearl", "JMB" = TIER_1.

Quy tắc bắt buộc:
- Chỉ dùng service_code có trong context.services. TUYỆT ĐỐI không tự bịa service_code.
- Nếu thiếu thông tin bắt buộc: event_date, event_name, location, duration_hours, items thì thêm tên field vào missing_fields.
- Nếu có thông tin mơ hồ thì thêm vào ambiguous_fields và không đoán bừa. Ví dụ: "1 quay" không rõ highlight hay full thì ambiguous_fields phải có mô tả về loại quay.
- Nếu một dịch vụ có thể map chắc chắn theo từ khóa rõ ràng thì chọn service_code phù hợp nhất từ context.services, có xét location IN/OUT và HD/FD theo duration_hours.
- Nếu không có service_code phù hợp trong context.services thì vẫn giữ service_name_raw và KHÔNG điền service_code bịa; có thể để service_code null và thêm ambiguous_fields.
- event_date trả null nếu không thấy ngày.
- event_name trả null nếu không thấy tên event rõ ràng.
- num_days mặc định là 1 nếu không nói nhiều ngày; nếu "2 ngày", "2 ngày liên tiếp" thì num_days = 2.
- confidence = high nếu đủ chắc chắn, medium nếu thiếu field nhưng item/location/duration/tier tương đối rõ, low nếu nhiều mơ hồ.

Schema output bắt buộc:
{
  "parsed": {
    "items": [
      { "service_code": "PHOTO_IN_HD", "quantity": 2, "service_name_raw": "chụp ảnh" }
    ],
    "location": "Hải Phòng",
    "duration_hours": 5,
    "tier_code": "TIER_2",
    "event_date": null,
    "event_name": null,
    "num_days": 1
  },
  "missing_fields": ["event_date", "event_name"],
  "ambiguous_fields": [],
  "confidence": "high",
  "ai_reasoning": "Một câu ngắn giải thích bạn hiểu input như thế nào."
}`

function normalizeApiKey(value = '') {
  return String(value)
    .trim()
    .replace(/^OPENAI_API_KEY\s*=\s*/i, '')
    .replace(/^ANTHROPIC_API_KEY\s*=\s*/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
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
    services: compactRows(context.services, ['service_code', 'code', 'service_name', 'name', 'category', 'price_tier_1', 'price_tier_2', 'price_tier_3']),
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

function parseJsonObject(text = '') {
  const clean = String(text || '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const start = clean.indexOf('{')
    const end = clean.lastIndexOf('}')
    if (start < 0 || end <= start) throw new Error('AI không trả về JSON hợp lệ.')
    return JSON.parse(clean.slice(start, end + 1))
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

async function callOpenAI({ apiKey, inputText, context }) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.QUOTE_PARSE_MODEL || DEFAULT_OPENAI_MODEL,
      instructions: quoteParseSystemPrompt,
      input: buildQuoteParseUserMessage(inputText, context),
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

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'OpenAI API trả về lỗi khi parse báo giá.')
  }

  return normalizeParsedPayload(parseJsonObject(extractTextFromOpenAI(payload)))
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

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Claude API trả về lỗi khi parse báo giá.')
  }

  return normalizeParsedPayload(parseJsonObject(extractTextFromAnthropic(payload)))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const inputText = String(req.body?.input_text || '').trim()
  if (!inputText) return res.status(400).json({ error: 'Thiếu input_text.' })

  const openAiKey = normalizeApiKey(process.env.OPENAI_API_KEY)
  const anthropicKey = normalizeApiKey(process.env.ANTHROPIC_API_KEY)
  if (!openAiKey && !anthropicKey) {
    return res.status(500).json({ error: 'Thiếu OPENAI_API_KEY hoặc ANTHROPIC_API_KEY trên môi trường backend/Vercel.' })
  }

  try {
    const result = openAiKey
      ? await callOpenAI({
          apiKey: openAiKey,
          inputText,
          context: req.body?.context || {},
        })
      : await callAnthropic({
          apiKey: anthropicKey,
          inputText,
          context: req.body?.context || {},
        })

    return res.status(200).json(result)
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Không parse được input báo giá.' })
  }
}
