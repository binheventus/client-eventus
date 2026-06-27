// Server-side Claude AI parser cho /api/parse-quote.
// Gọi qua proxy / endpoint Anthropic-compatible (mặc định https://api.coffeevibeai.com)
// — admin có thể đổi sang api.anthropic.com qua env ANTHROPIC_BASE_URL.

import { loadServerEnv } from './server-env.js'
import { FOUNDATIONAL_EXAMPLES } from './claude-quote-examples.js'
import { SYSTEM_PROMPT_LAYER_1_2 } from './claude-quote-prompt.js'

const DEFAULT_BASE_URL = 'https://api.coffeevibeai.com'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_MAX_TOKENS = 4096
const ANTHROPIC_VERSION = '2023-06-01'
const TOOL_NAME = 'submit_parsed_quote'
const MAX_EXAMPLES = 20
// Số slot tối thiểu LUÔN dành cho ví dụ custom (do người dùng lưu). Ví dụ nền chỉ được
// lấp các slot còn lại — tránh trường hợp 10 ví dụ nền chiếm hết cap rồi cắt mất ví dụ
// vừa lưu khiến AI không học theo bản sửa tay.
const MAX_CUSTOM_EXAMPLES = 12

export const QUOTE_PARSE_TOOL_SCHEMA = {
  name: TOOL_NAME,
  description: 'Trả về cấu trúc parsed quote sau khi đọc xong brief / chat.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      items: {
        type: 'array',
        description: 'Danh sách hạng mục bóc ra từ brief.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            service_code: {
              type: 'string',
              description: 'Mã dịch vụ trong catalog hoặc "CUSTOM" cho hạng mục ngoài khung.',
            },
            quantity: { type: 'number', minimum: 0 },
            service_name: { type: 'string' },
            service_name_raw: { type: 'string' },
            is_custom: { type: 'boolean' },
            is_overridden: { type: 'boolean' },
            unit_price: { type: 'number', minimum: 0 },
            override_reason: { type: 'string' },
            group_code: { type: 'string' },
            group_label: { type: 'string' },
          },
          required: ['service_code', 'quantity'],
        },
      },
      location: { type: 'string' },
      duration_hours: { type: 'number', minimum: 0 },
      tier_code: { type: 'string' },
      num_days: { type: 'integer', minimum: 1 },
      has_vat: {
        type: 'boolean',
        description: 'true nếu brief cần xuất VAT; false nếu nói rõ không xuất VAT / không hoá đơn. Bỏ qua nếu brief không nhắc.',
      },
      prices_include_vat: {
        type: 'boolean',
        description: 'true nếu brief nói các đơn giá ĐÃ bao gồm VAT (all-in, gross); false nếu nói chưa gồm VAT (+VAT, net). Bỏ qua nếu brief không nhắc.',
      },
      missing_fields: { type: 'array', items: { type: 'string' } },
      ambiguous_fields: { type: 'array', items: { type: 'string' } },
      ai_reasoning: { type: 'string' },
    },
    required: ['items', 'location', 'duration_hours', 'tier_code', 'ai_reasoning'],
  },
}

export function getAiBaseUrl() {
  loadServerEnv()
  const raw = String(process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '') || DEFAULT_BASE_URL
}

export function getAiModelName() {
  loadServerEnv()
  return String(process.env.QUOTE_PARSE_AI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
}

export function getAiTimeoutMs() {
  loadServerEnv()
  const value = Number(process.env.QUOTE_PARSE_AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT_MS
}

export function hasAnthropicKey() {
  loadServerEnv()
  return Boolean(String(process.env.ANTHROPIC_API_KEY || '').trim())
}

function getAnthropicKey() {
  loadServerEnv()
  return String(process.env.ANTHROPIC_API_KEY || '').trim()
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function compactServicesCatalog(services = []) {
  return (Array.isArray(services) ? services : [])
    .map(row => {
      const code = String(row?.service_code || row?.code || '').trim()
      if (!code) return null
      return {
        code,
        name: String(row?.quote_display_name || row?.service_name || row?.name || code).trim(),
        unit: String(row?.unit || '').trim() || 'Người',
        price_tier_2: safeNumber(row?.price_tier_2 ?? row?.priceTier2 ?? 0),
        duration_tier: String(row?.duration_tier || row?.durationTier || '').trim(),
        group: String(row?.equipment_group || row?.group || '').trim(),
      }
    })
    .filter(Boolean)
}

function formatExampleBlock(example, index) {
  const title = example?.name ? `[${index + 1}] ${example.name}` : `[${index + 1}]`
  const inputText = String(example?.input || '').trim()
  let outputText = ''
  try {
    outputText = JSON.stringify(example?.output ?? {}, null, 2)
  } catch {
    outputText = '{}'
  }
  return `### Ví dụ ${title}\nINPUT:\n${inputText}\n\nOUTPUT (tool call ${TOOL_NAME}):\n${outputText}`
}

function normalizeCustomExample(row = {}) {
  if (!row) return null
  let output = row.expected_output ?? row.output
  if (typeof output === 'string') {
    try {
      output = JSON.parse(output)
    } catch {
      return null
    }
  }
  if (!output || typeof output !== 'object') return null

  return {
    id: Number.isFinite(Number(row.id)) ? Number(row.id) : 0,
    name: String(row.name || row.id || '').trim() || 'custom',
    input: String(row.input_text || row.input || '').trim(),
    output,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 1000,
  }
}

function mergeExamples(foundational = [], customRows = []) {
  const normalizedCustom = (Array.isArray(customRows) ? customRows : [])
    .map(normalizeCustomExample)
    .filter(example => example && example.input && example.output)
    // Ưu tiên sort_order nhỏ; cùng sort_order thì ví dụ id lớn (mới lưu) lên trước.
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(b.id || 0) - Number(a.id || 0))
    .slice(0, MAX_CUSTOM_EXAMPLES)

  const normalizedFoundational = (Array.isArray(foundational) ? foundational : [])
    .filter(example => example && example.input && example.output)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))

  // Custom luôn được giữ chỗ trước, foundational chỉ lấp phần slot còn lại.
  const remaining = Math.max(0, MAX_EXAMPLES - normalizedCustom.length)
  const keptFoundational = normalizedFoundational.slice(0, remaining)

  // Đặt foundational trước, custom sau cùng (gần input của người dùng nhất) để AI ưu
  // tiên bám theo các bản sửa tay gần đây hơn là ví dụ nền.
  return [...keptFoundational, ...normalizedCustom]
}

export function buildSystemPromptBlock(context = {}, customExamples = []) {
  const catalog = compactServicesCatalog(context?.services || [])
  const examples = mergeExamples(FOUNDATIONAL_EXAMPLES, customExamples)
  const catalogJson = JSON.stringify(catalog, null, 2)
  const examplesText = examples.map((example, index) => formatExampleBlock(example, index)).join('\n\n')

  return [
    SYSTEM_PROMPT_LAYER_1_2,
    '',
    '# CATALOG dịch vụ hiện tại (compact)',
    'Mỗi entry: { code, name, unit, price_tier_2, duration_tier, group }. Dùng để map service_code khi đọc brief.',
    '```json',
    catalogJson,
    '```',
    '',
    '# EXAMPLES',
    'QUAN TRỌNG — ƯU TIÊN VÍ DỤ: Mỗi ví dụ dưới đây là một cặp INPUT → OUTPUT đã được con người DUYỆT TAY và chốt là đúng.',
    '- Nếu brief của người dùng TRÙNG KHÍT hoặc GẦN GIỐNG phần INPUT của một ví dụ (cùng dịch vụ, cùng số lượng, cùng cách nói giá), hãy TÁI TẠO LẠI phần OUTPUT của ví dụ đó càng sát càng tốt — kể cả khi điều đó MÂU THUẪN với "Luật biên dịch" ở trên. Ví dụ đã duyệt tay có quyền ưu tiên CAO HƠN luật biên dịch.',
    '- Khi brief chỉ giống MỘT PHẦN ví dụ, áp dụng cách xử lý của ví dụ cho phần giống đó, phần còn lại mới theo luật biên dịch.',
    '- "Luật biên dịch" chỉ là mặc định dùng khi KHÔNG có ví dụ nào khớp.',
    '',
    examplesText || '(Chưa có ví dụ huấn luyện.)',
  ].join('\n')
}

function readJsonResponse(response) {
  return response.json().catch(() => null)
}

function findToolCall(payload) {
  const blocks = Array.isArray(payload?.content) ? payload.content : []
  return blocks.find(block => block?.type === 'tool_use' && block?.name === TOOL_NAME) || null
}

function validateToolInput(input) {
  if (!input || typeof input !== 'object') return false
  if (!Array.isArray(input.items)) return false
  return input.items.every(item => item && typeof item.service_code === 'string' && Number.isFinite(Number(item.quantity)))
}

async function callAnthropicOnce({ system, userInput, model, timeoutMs }) {
  const baseUrl = getAiBaseUrl()
  const apiKey = getAnthropicKey()
  if (!apiKey) throw new Error('Thiếu ANTHROPIC_API_KEY.')

  const url = `${baseUrl}/v1/messages`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: system,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: String(userInput || '') }],
          },
        ],
        tools: [QUOTE_PARSE_TOOL_SCHEMA],
        tool_choice: { type: 'tool', name: TOOL_NAME },
      }),
      signal: controller.signal,
    })

    const latencyMs = Date.now() - startedAt
    const payload = await readJsonResponse(response)

    if (!response.ok) {
      const error = new Error(`Anthropic ${response.status}: ${payload?.error?.message || response.statusText}`)
      error.status = response.status
      error.latencyMs = latencyMs
      throw error
    }

    const toolCall = findToolCall(payload)
    if (!toolCall || !validateToolInput(toolCall.input)) {
      const error = new Error('Tool call không khớp schema submit_parsed_quote.')
      error.code = 'SCHEMA_MISMATCH'
      error.latencyMs = latencyMs
      error.payload = payload
      throw error
    }

    return {
      input: toolCall.input,
      usage: payload?.usage || {},
      latencyMs,
    }
  } finally {
    clearTimeout(timer)
  }
}

function logTelemetry({ model, usage = {}, latencyMs, attempt, status }) {
  const tokensIn = usage?.input_tokens ?? usage?.prompt_tokens ?? 0
  const tokensOut = usage?.output_tokens ?? usage?.completion_tokens ?? 0
  const cacheRead = usage?.cache_read_input_tokens ?? 0
  // Cố tình KHÔNG log nội dung chat. Telemetry phải gọn để tail log dễ đọc.
  console.log(
    `[claude-parser] model=${model} status=${status} attempt=${attempt} `
    + `tokens_in=${tokensIn} tokens_out=${tokensOut} cache_read_tokens=${cacheRead} latency_ms=${latencyMs}`,
  )
}

function normalizeAiResultForResponse(input = {}) {
  const items = (Array.isArray(input.items) ? input.items : []).map(item => {
    const isCustom = Boolean(item?.is_custom)
    const isOverridden = Boolean(item?.is_overridden)
    const unitPrice = safeNumber(item?.unit_price, 0)
    return {
      service_code: String(item?.service_code || '').trim() || (isCustom ? 'CUSTOM' : ''),
      quantity: safeNumber(item?.quantity, 0) || 1,
      service_name: String(item?.service_name || '').trim() || undefined,
      service_name_raw: String(item?.service_name_raw || item?.service_name || '').trim() || undefined,
      is_custom: isCustom,
      is_overridden: isOverridden,
      unit_price: unitPrice,
      override_reason: String(item?.override_reason || '').trim() || undefined,
      group_code: String(item?.group_code || '').trim() || undefined,
      group_label: String(item?.group_label || '').trim() || undefined,
    }
  })

  return {
    parsed: {
      items,
      location: String(input?.location || '').trim() || 'Hà Nội',
      duration_hours: safeNumber(input?.duration_hours, 4) || 4,
      tier_code: String(input?.tier_code || 'TIER_2').trim() || 'TIER_2',
      num_days: safeNumber(input?.num_days, 1) || 1,
      has_vat: typeof input?.has_vat === 'boolean' ? input.has_vat : null,
      prices_include_vat: typeof input?.prices_include_vat === 'boolean' ? input.prices_include_vat : null,
      event_date: null,
      event_name: null,
    },
    missing_fields: Array.isArray(input?.missing_fields) ? input.missing_fields : [],
    ambiguous_fields: Array.isArray(input?.ambiguous_fields) ? input.ambiguous_fields : [],
    confidence: items.length ? 'high' : 'low',
    ai_reasoning: String(input?.ai_reasoning || '').trim() || 'Đã dùng Claude AI để phân tích brief.',
  }
}

export async function parseQuoteWithClaude(inputText, context = {}, options = {}) {
  if (!hasAnthropicKey()) {
    const error = new Error('Thiếu ANTHROPIC_API_KEY.')
    error.code = 'NO_API_KEY'
    throw error
  }

  const model = options.model || getAiModelName()
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : getAiTimeoutMs()
  const foundational = options.foundationalExamples || FOUNDATIONAL_EXAMPLES
  const customExamples = options.customExamples || []
  const system = buildSystemPromptBlock({ ...context, foundationalExamples: foundational }, customExamples)

  let lastError = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await callAnthropicOnce({ system, userInput: inputText, model, timeoutMs })
      logTelemetry({ model, usage: result.usage, latencyMs: result.latencyMs, attempt, status: 'ok' })
      return normalizeAiResultForResponse(result.input)
    } catch (error) {
      lastError = error
      logTelemetry({
        model,
        usage: error?.payload?.usage || {},
        latencyMs: error?.latencyMs || 0,
        attempt,
        status: error?.code || error?.status || 'error',
      })
      // Chỉ retry khi schema mismatch — lỗi network/timeout/5xx đẩy lên caller fallback ngay.
      if (error?.code !== 'SCHEMA_MISMATCH') break
    }
  }

  throw lastError || new Error('Claude AI parser thất bại không rõ lý do.')
}
