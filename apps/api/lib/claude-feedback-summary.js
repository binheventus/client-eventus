// Server-side Claude AI client cho trợ lý feedback của Editor.
// Mirror khuôn claude-quote-parser.js: gọi /v1/messages qua proxy ANTHROPIC_BASE_URL
// (mặc định https://api.coffeevibeai.com), ép tool-call theo JSON schema, prompt cache
// ephemeral, timeout, retry khi sai schema, telemetry KHÔNG log nội dung.
// Đây là tầng THUẦN AI: không biết gì về HTTP/DB/auth.

import { loadServerEnv } from './server-env.js'

const DEFAULT_BASE_URL = 'https://api.coffeevibeai.com'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const DEFAULT_TIMEOUT_MS = 20000
const DEFAULT_MAX_TOKENS = 4096
const ANTHROPIC_VERSION = '2023-06-01'
const SUMMARY_TOOL_NAME = 'submit_feedback_summary'
const REWRITE_TOOL_NAME = 'submit_rewritten_reply'

export const FEEDBACK_CATEGORIES = ['audio', 'color', 'cut', 'text', 'branding', 'content', 'other']

export const FEEDBACK_SUMMARY_TOOL_SCHEMA = {
  name: SUMMARY_TOOL_NAME,
  description: 'Trả về checklist việc cần sửa sau khi đọc các comment chưa sửa của khách.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: {
        type: 'string',
        description: 'Một câu tóm tắt tiếng Việt tổng thể các việc cần sửa.',
      },
      task_count: {
        type: 'integer',
        minimum: 0,
        description: 'Tổng số việc cần sửa rút ra được.',
      },
      groups: {
        type: 'array',
        description: 'Các nhóm việc theo loại việc dựng.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            category: {
              type: 'string',
              enum: FEEDBACK_CATEGORIES,
              description: 'Loại việc dựng: audio (âm thanh), color (màu), cut (cắt dựng), text (chữ), branding (nhận diện), content (nội dung), other (khác).',
            },
            label: {
              type: 'string',
              description: 'Nhãn tiếng Việt ngắn gọn của nhóm.',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  task: { type: 'string', description: 'Mô tả việc cần làm bằng tiếng Việt.' },
                  timecodes: {
                    type: 'array',
                    items: { type: 'number' },
                    description: 'Các mốc thời gian (giây) liên quan tới việc này.',
                  },
                  comment_ids: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'comment_id nguồn của việc này.',
                  },
                },
                required: ['task'],
              },
            },
          },
          required: ['category', 'label', 'items'],
        },
      },
      conflicts: {
        type: 'array',
        description: 'Các comment trùng / mâu thuẫn nhau.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            description: { type: 'string' },
            comment_ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['description'],
        },
      },
      unclear: {
        type: 'array',
        description: 'Các comment quá mơ hồ để hành động.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            timecode: { type: 'number' },
            original: { type: 'string' },
            why: { type: 'string' },
            comment_ids: { type: 'array', items: { type: 'string' } },
          },
          required: ['original', 'why'],
        },
      },
    },
    required: ['summary', 'task_count', 'groups'],
  },
}

export const FEEDBACK_REWRITE_TOOL_SCHEMA = {
  name: REWRITE_TOOL_NAME,
  description: 'Trả về 1–3 phiên bản lời nhắn tiếng Việt lịch sự gửi khách.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      replies: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
        description: 'Một đến ba phiên bản lời nhắn tiếng Việt đã viết lại.',
        items: { type: 'string' },
      },
    },
    required: ['replies'],
  },
}

export const SYSTEM_PROMPT_SUMMARY = `Bạn là trợ lý nội bộ cho Editor video của Eventus, đọc các comment khách hàng để lại theo mốc thời gian trên một bản dựng và gom thành checklist việc cần sửa.

# Vai trò
- Output duy nhất là một tool call \`${SUMMARY_TOOL_NAME}\` theo schema đã khai báo. KHÔNG trả lời tự do bằng văn bản.
- CHỈ dùng đúng các comment được cung cấp trong input. KHÔNG bịa thêm yêu cầu, KHÔNG suy diễn việc không có trong comment.

# Phân loại (bắt buộc dùng đúng các category này)
- audio: âm thanh, nhạc nền, tiếng, lồng tiếng, mix.
- color: màu sắc, color grading, độ sáng, tương phản.
- cut: cắt dựng, nhịp, độ dài, chuyển cảnh, thứ tự cảnh.
- text: chữ, phụ đề, lower-third, typo, font.
- branding: logo, nhận diện thương hiệu, intro/outro, watermark.
- content: nội dung, thông điệp, cảnh được/không được dùng, thông tin sai.
- other: mọi thứ còn lại không thuộc các nhóm trên.

# Quy tắc
1. Mỗi việc trong \`items\` kèm \`timecodes\` (giây) và \`comment_ids\` lấy đúng từ comment nguồn.
2. Gộp các comment cùng ý thành một việc; mỗi nhóm chỉ chứa việc đúng category của nó.
3. \`conflicts\`: liệt kê các comment yêu cầu trái ngược nhau hoặc trùng lặp, kèm \`comment_ids\`.
4. \`unclear\`: comment quá chung chung để hành động (ví dụ "thấy chưa ổn") → ghi \`original\`, \`why\`, \`comment_ids\`.
5. \`task_count\` = tổng số việc trong tất cả các nhóm.
6. \`summary\`: một câu tiếng Việt nêu bật khối lượng việc chính.
7. Toàn bộ nội dung mô tả viết bằng tiếng Việt.`

export const SYSTEM_PROMPT_REWRITE = `Bạn là trợ lý nội bộ cho Editor video của Eventus, giúp viết lại một ghi chú/lý do thô (thường là lý do KHÔNG sửa được một yêu cầu) thành lời nhắn tiếng Việt lịch sự, thuyết phục để gửi khách hàng.

# Vai trò
- Output duy nhất là một tool call \`${REWRITE_TOOL_NAME}\` theo schema đã khai báo. KHÔNG trả lời tự do bằng văn bản.

# Quy tắc
1. CHỈ diễn giải đúng lý do Editor cung cấp cho lịch sự, rõ ràng, thuyết phục. ĐƯỢC PHÉP gợi ý phương án thay thế hợp lý nhưng KHÔNG bịa thông tin mới (không hứa hẹn mốc thời gian, chi phí, cam kết kỹ thuật không có trong lý do).
2. Giữ giọng chuyên nghiệp, tôn trọng, ngắn gọn; xưng hô phù hợp khách hàng (anh/chị).
3. Trả về 1–3 phiên bản tiếng Việt khác nhau về cách diễn đạt.
4. Nếu có ngữ cảnh việc liên quan, bám sát ngữ cảnh đó; tuyệt đối không thêm thông tin ngoài lý do và ngữ cảnh.`

export function getAiBaseUrl() {
  loadServerEnv()
  const raw = String(process.env.ANTHROPIC_BASE_URL || DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '') || DEFAULT_BASE_URL
}

export function getAiModelName() {
  loadServerEnv()
  return String(process.env.FEEDBACK_SUMMARY_AI_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL
}

export function getAiTimeoutMs() {
  loadServerEnv()
  const value = Number(process.env.FEEDBACK_SUMMARY_AI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
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

function readJsonResponse(response) {
  return response.json().catch(() => null)
}

function findToolCall(payload, toolName) {
  const blocks = Array.isArray(payload?.content) ? payload.content : []
  return blocks.find(block => block?.type === 'tool_use' && block?.name === toolName) || null
}

function validateSummaryInput(input) {
  if (!input || typeof input !== 'object') return false
  if (typeof input.summary !== 'string') return false
  if (!Number.isFinite(Number(input.task_count))) return false
  if (!Array.isArray(input.groups)) return false
  return input.groups.every(group => group
    && typeof group.category === 'string'
    && FEEDBACK_CATEGORIES.includes(group.category)
    && Array.isArray(group.items))
}

function validateRewriteInput(input) {
  if (!input || typeof input !== 'object') return false
  if (!Array.isArray(input.replies) || !input.replies.length) return false
  return input.replies.every(reply => typeof reply === 'string' && reply.trim())
}

async function callAnthropicOnce({ system, userInput, model, timeoutMs, tool, validate }) {
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
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
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

    const toolCall = findToolCall(payload, tool.name)
    if (!toolCall || !validate(toolCall.input)) {
      const error = new Error(`Tool call không khớp schema ${tool.name}.`)
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

function logTelemetry({ tool, model, usage = {}, latencyMs, attempt, status }) {
  const tokensIn = usage?.input_tokens ?? usage?.prompt_tokens ?? 0
  const tokensOut = usage?.output_tokens ?? usage?.completion_tokens ?? 0
  const cacheRead = usage?.cache_read_input_tokens ?? 0
  // Cố tình KHÔNG log nội dung comment / lý do Editor. Chỉ số đo.
  console.log(
    `[claude-feedback] tool=${tool} model=${model} status=${status} attempt=${attempt} `
    + `tokens_in=${tokensIn} tokens_out=${tokensOut} cache_read_tokens=${cacheRead} latency_ms=${latencyMs}`,
  )
}

async function runWithRetry({ tool, validate, system, userInput, model, timeoutMs }) {
  let lastError = null
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await callAnthropicOnce({ system, userInput, model, timeoutMs, tool, validate })
      logTelemetry({ tool: tool.name, model, usage: result.usage, latencyMs: result.latencyMs, attempt, status: 'ok' })
      return result.input
    } catch (error) {
      lastError = error
      logTelemetry({
        tool: tool.name,
        model,
        usage: error?.payload?.usage || {},
        latencyMs: error?.latencyMs || 0,
        attempt,
        status: error?.code || error?.status || 'error',
      })
      // Chỉ retry khi schema mismatch — network/timeout/5xx đẩy lên caller fallback ngay.
      if (error?.code !== 'SCHEMA_MISMATCH') break
    }
  }
  throw lastError || new Error('Claude AI feedback thất bại không rõ lý do.')
}

function buildSummaryUserInput(comments = []) {
  const rows = (Array.isArray(comments) ? comments : []).map(comment => ({
    comment_id: String(comment?.comment_id ?? comment?.id ?? '').trim(),
    timecode: Number.isFinite(Number(comment?.time_comment_1)) ? Number(comment.time_comment_1) : null,
    text: String(comment?.comment_1 ?? comment?.text ?? '').trim(),
    author: String(comment?.author_name ?? '').trim() || null,
  })).filter(row => row.comment_id && row.text)

  return [
    'Dưới đây là danh sách comment CHƯA sửa (JSON). Mỗi comment có comment_id, timecode (giây), text và author.',
    'Hãy gom thành checklist việc cần sửa, chỉ dùng đúng các comment này.',
    '```json',
    JSON.stringify(rows, null, 2),
    '```',
  ].join('\n')
}

function buildRewriteUserInput(rawText, { context, tone } = {}) {
  const lines = ['Lý do/ghi chú thô của Editor cần viết lại thành lời nhắn gửi khách:', String(rawText || '').trim()]
  if (context) {
    lines.push('', 'Ngữ cảnh việc liên quan:', String(context).trim())
  }
  if (tone) {
    lines.push('', `Yêu cầu cách nói / giọng điệu: ${String(tone).trim()}`)
  }
  return lines.join('\n')
}

// Ép cờ trống đúng khuôn parser: thiếu key ném NO_API_KEY, sai schema ném SCHEMA_MISMATCH.
function assertApiKey() {
  if (!hasAnthropicKey()) {
    const error = new Error('Thiếu ANTHROPIC_API_KEY.')
    error.code = 'NO_API_KEY'
    throw error
  }
}

export async function summarizeFeedbackComments(comments = [], options = {}) {
  assertApiKey()
  const model = options.model || getAiModelName()
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : getAiTimeoutMs()
  const userInput = buildSummaryUserInput(comments)

  const input = await runWithRetry({
    tool: FEEDBACK_SUMMARY_TOOL_SCHEMA,
    validate: validateSummaryInput,
    system: SYSTEM_PROMPT_SUMMARY,
    userInput,
    model,
    timeoutMs,
  })
  return normalizeSummaryResult(input)
}

export async function rewriteReply(rawText = '', options = {}) {
  assertApiKey()
  const model = options.model || getAiModelName()
  const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : getAiTimeoutMs()
  const userInput = buildRewriteUserInput(rawText, options)

  const input = await runWithRetry({
    tool: FEEDBACK_REWRITE_TOOL_SCHEMA,
    validate: validateRewriteInput,
    system: SYSTEM_PROMPT_REWRITE,
    userInput,
    model,
    timeoutMs,
  })
  return {
    replies: (Array.isArray(input.replies) ? input.replies : [])
      .map(reply => String(reply || '').trim())
      .filter(Boolean),
  }
}

function normalizeStringArray(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
}

function normalizeNumberArray(value) {
  return (Array.isArray(value) ? value : [])
    .map(item => Number(item))
    .filter(item => Number.isFinite(item))
}

function normalizeSummaryResult(input = {}) {
  const groups = (Array.isArray(input.groups) ? input.groups : [])
    .map(group => ({
      category: FEEDBACK_CATEGORIES.includes(group?.category) ? group.category : 'other',
      label: String(group?.label || '').trim() || 'Khác',
      items: (Array.isArray(group?.items) ? group.items : [])
        .map(item => ({
          task: String(item?.task || '').trim(),
          timecodes: normalizeNumberArray(item?.timecodes),
          comment_ids: normalizeStringArray(item?.comment_ids),
        }))
        .filter(item => item.task),
    }))
    .filter(group => group.items.length)

  const taskCount = groups.reduce((sum, group) => sum + group.items.length, 0)

  return {
    summary: String(input?.summary || '').trim(),
    task_count: Number.isFinite(Number(input?.task_count)) ? Number(input.task_count) : taskCount,
    groups,
    conflicts: (Array.isArray(input?.conflicts) ? input.conflicts : [])
      .map(conflict => ({
        description: String(conflict?.description || '').trim(),
        comment_ids: normalizeStringArray(conflict?.comment_ids),
      }))
      .filter(conflict => conflict.description),
    unclear: (Array.isArray(input?.unclear) ? input.unclear : [])
      .map(item => ({
        timecode: Number.isFinite(Number(item?.timecode)) ? Number(item.timecode) : null,
        original: String(item?.original || '').trim(),
        why: String(item?.why || '').trim(),
        comment_ids: normalizeStringArray(item?.comment_ids),
      }))
      .filter(item => item.original),
  }
}
