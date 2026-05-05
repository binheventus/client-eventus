import { vfxSystemPrompt } from '../src/lib/vfxSystemPrompt.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'Thiếu ANTHROPIC_API_KEY trên Vercel.' })
  }

  const brief = String(req.body?.brief || '').trim()
  if (!brief) {
    return res.status(400).json({ error: 'Thiếu brief để generate prompt.' })
  }

  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
      return res.status(anthropicResponse.status).json({ error: message })
    }

    const prompt = payload?.content
      ?.map(block => block?.type === 'text' ? block.text : '')
      .join('')
      .trim()

    if (!prompt) {
      return res.status(502).json({ error: 'Claude không trả về nội dung prompt.' })
    }

    return res.status(200).json({ prompt })
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Không gọi được Claude API.' })
  }
}
