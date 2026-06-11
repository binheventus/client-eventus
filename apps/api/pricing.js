import { requireEventusAuth } from './lib/eventus-auth.js'
import {
  getPricingContext,
  invalidatePricingContextCache,
  toPricingApiPayload,
} from './lib/pricing-context.js'

function getRequestBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function sendError(res, error, fallback = 'Không tải được dữ liệu pricing.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const force = ['1', 'true', 'yes'].includes(String(getQueryValue(req.query?.force, '')).toLowerCase())
      const context = await getPricingContext({ force })
      return res.status(200).json(toPricingApiPayload(context))
    }

    if (req.method === 'POST') {
      if (!await requireEventusAuth(req, res)) return null

      const body = getRequestBody(req)
      if (body.action !== 'invalidate') {
        return res.status(400).json({ error: 'Action pricing không hợp lệ.', code: 'INVALID_ACTION' })
      }

      const invalidation = invalidatePricingContextCache('api')
      const context = await getPricingContext({ force: true })
      return res.status(200).json({
        ...toPricingApiPayload(context),
        invalidation,
      })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
