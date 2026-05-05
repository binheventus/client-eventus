import { vfxSystemPrompt } from '../src/lib/vfxSystemPrompt.js'

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = 'https://oneai.fridayaix.com'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

function normalizeApiKey(value = '') {
  return String(value)
    .trim()
    .replace(/^(ANTHROPIC_API_KEY|VFX_API_KEY|OPENAI_API_KEY)\s*=\s*/i, '')
    .replace(/^['"]|['"]$/g, '')
    .trim()
}

function normalizeBaseUrl(value = '') {
  return String(value || DEFAULT_OPENAI_COMPATIBLE_BASE_URL).trim().replace(/\/+$/, '')
}

function buildChatCompletionsUrl(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl)
  return normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`
}

function getTextFromOpenAICompatiblePayload(payload) {
  return (
    payload?.choices?.[0]?.message?.content ||
    payload?.choices?.[0]?.text ||
    payload?.output_text ||
    ''
  ).trim()
}

async function callAnthropic({ apiKey, brief }) {
  const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.VFX_MODEL || DEFAULT_MODEL,
      max_tokens: 1800,
      system: vfxSystemPrompt,
      messages: [
        {
          role: 'user',
          content: brief,
        },
      ],
    }),
  })

  const payload = await anthropicResponse.json()
  if (!anthropicResponse.ok) {
    const message = payload?.error?.message || 'Claude API trả về lỗi.'
    if (message.toLowerCase().includes('x-api-key')) {
      throw new Error('Anthropic API key không hợp lệ. Hãy kiểm tra lại ANTHROPIC_API_KEY trên Vercel, chỉ paste phần key bắt đầu bằng sk-ant-, không paste kèm tên biến.')
    }
    throw new Error(message)
  }

  const prompt = payload?.content
    ?.map(block => block?.type === 'text' ? block.text : '')
    .join('')
    .trim()

  if (!prompt) throw new Error('Claude không trả về nội dung prompt.')
  return prompt
}

async function callOpenAICompatible({ apiKey, brief }) {
  const response = await fetch(buildChatCompletionsUrl(process.env.VFX_API_BASE_URL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.VFX_MODEL || DEFAULT_MODEL,
      temperature: 0.4,
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: vfxSystemPrompt,
        },
        {
          role: 'user',
          content: brief,
        },
      ],
    }),
  })

  const payload = await response.json()
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || 'AI provider trả về lỗi.'
    throw new Error(message)
  }

  const prompt = getTextFromOpenAICompatiblePayload(payload)
  if (!prompt) throw new Error('AI provider không trả về nội dung prompt.')
  return prompt
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = normalizeApiKey(process.env.VFX_API_KEY || process.env.ANTHROPIC_API_KEY)
  if (!apiKey) {
    return res.status(500).json({ error: 'Thiếu VFX_API_KEY hoặc ANTHROPIC_API_KEY trên Vercel.' })
  }

  const brief = String(req.body?.brief || '').trim()
  if (!brief) {
    return res.status(400).json({ error: 'Thiếu brief để generate prompt.' })
  }

  try {
    const prompt = apiKey.startsWith('sk-ant-')
      ? await callAnthropic({ apiKey, brief })
      : await callOpenAICompatible({ apiKey, brief })

    return res.status(200).json({ prompt })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Không gọi được AI provider.' })
  }
}
