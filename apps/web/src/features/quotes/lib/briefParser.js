import { useCallback, useState } from 'react'
import { redirectToLoginIfAuthRequired } from './authRedirect'

const parseCache = new Map()

function getCacheKey(inputText, context = {}, mode = 'regex') {
  return JSON.stringify({
    mode,
    input_text: String(inputText || '').trim(),
    services: (context.services || []).map(row => row?.service_code || row?.code || row?.id).filter(Boolean),
    travel_fees: (context.travel_fees || []).map(row => row?.location || row?.location_name || row?.province || row?.id).filter(Boolean),
    customer_tiers: (context.customer_tiers || []).map(row => row?.tier_code || row?.code || row?.id).filter(Boolean),
    business_rules: (context.business_rules || []).map(row => row?.rule_code || row?.code || row?.key || row?.id).filter(Boolean),
  })
}

export async function parseQuoteInput(inputText, context = {}, { force = false, mode = 'regex' } = {}) {
  const normalizedInput = String(inputText || '').trim()
  if (!normalizedInput) throw new Error('Vui lòng nhập nội dung cần parse.')

  const cacheKey = getCacheKey(normalizedInput, context, mode)
  if (!force && parseCache.has(cacheKey)) return parseCache.get(cacheKey)

  const body = {
    input_text: normalizedInput,
    context,
  }
  if (mode === 'ai') body.mode = 'ai'

  const response = await fetch('/api/parse-quote', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    redirectToLoginIfAuthRequired(response, payload)
    throw new Error(payload?.error || 'Không parse được input báo giá.')
  }

  parseCache.set(cacheKey, payload)
  return payload
}

export async function parseQuoteInputWithAi(inputText, context = {}, options = {}) {
  return parseQuoteInput(inputText, context, { ...options, mode: 'ai' })
}

export async function parseQuoteBrief(inputText, context, options) {
  return parseQuoteInput(inputText, context, options)
}

export function clearQuoteParseCache() {
  parseCache.clear()
}

export async function probeAiAvailability() {
  try {
    const response = await fetch('/api/parse-quote?probe=1', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return { ai_available: false, model: null }
    const payload = await response.json().catch(() => ({}))
    return {
      ai_available: Boolean(payload?.ai_available),
      model: payload?.model || null,
    }
  } catch {
    return { ai_available: false, model: null }
  }
}

export function useQuoteParser() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const parse = useCallback(async (inputText, context, options) => {
    setLoading(true)
    setError(null)

    try {
      const nextResult = await parseQuoteInput(inputText, context, options)
      setResult(nextResult)
      return nextResult
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { parse, result, loading, error }
}
