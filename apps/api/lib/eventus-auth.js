import { loadServerEnv } from './server-env.js'

const DEFAULT_AUTH_BASE_URL = 'https://lichlamviec.eventusproduction.com'
const DEFAULT_AUTH_ME_PATH = '/api/auth/me'
const DEFAULT_TIMEOUT_MS = 5000
const AUTH_DISABLED_USER = {
  id: 'eventus-auth-disabled',
  name: 'Eventus Local',
  email: null,
  role: 'admin',
}

function isEventusAuthDisabled() {
  return ['1', 'true', 'yes'].includes(String(process.env.EVENTUS_AUTH_DISABLED || '').toLowerCase())
}

function getAuthConfig() {
  loadServerEnv()

  const baseUrl = String(process.env.EVENTUS_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL).replace(/\/+$/, '')
  const mePath = process.env.EVENTUS_AUTH_ME_PATH || DEFAULT_AUTH_ME_PATH
  const loginUrl = process.env.EVENTUS_AUTH_LOGIN_URL || `${baseUrl}/login`
  const timeoutMs = Number(process.env.EVENTUS_AUTH_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)

  return {
    baseUrl,
    meUrl: `${baseUrl}${mePath.startsWith('/') ? mePath : `/${mePath}`}`,
    loginUrl,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  }
}

function getHeader(req, name) {
  const value = req?.headers?.[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

function getRequestUrl(req) {
  const host = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || 'client.eventusproduction.com'
  const inferredProto = /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/.test(host) ? 'http' : 'https'
  const proto = getHeader(req, 'x-forwarded-proto') || req?.protocol || inferredProto
  return new URL(req?.originalUrl || req?.url || '/', `${proto}://${host}`).toString()
}

export function getEventusLoginUrl(req) {
  const { loginUrl } = getAuthConfig()
  const url = new URL(loginUrl)
  url.searchParams.set('redirect', getRequestUrl(req))
  return url.toString()
}

export function isProtectedQuotePageRequest(req) {
  const pathname = new URL(req?.url || '/', 'http://client.local').pathname
  return pathname === '/quotes' || pathname.startsWith('/quotes/')
}

export async function getEventusAuthUser(req) {
  if (isEventusAuthDisabled()) return AUTH_DISABLED_USER

  const cookie = getHeader(req, 'cookie')
  if (!cookie) return null

  const { meUrl, timeoutMs } = getAuthConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(meUrl, {
      headers: {
        accept: 'application/json',
        cookie,
      },
      signal: controller.signal,
    })

    if (!response.ok) return null

    const payload = await response.json().catch(() => null)
    return payload?.user || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function requireEventusAuth(req, res) {
  const user = await getEventusAuthUser(req)
  if (user) {
    req.eventusUser = user
    return user
  }

  res.status(401).json({
    error: 'Vui lòng đăng nhập bằng tài khoản Eventus để truy cập báo giá.',
    code: 'AUTH_REQUIRED',
    login_url: getEventusLoginUrl(req),
  })
  return null
}

export async function protectQuotePage(req, res, next) {
  if (!isProtectedQuotePageRequest(req)) {
    next()
    return
  }

  const user = await getEventusAuthUser(req)
  if (user) {
    req.eventusUser = user
    next()
    return
  }

  const loginUrl = getEventusLoginUrl(req)
  if (typeof res.redirect === 'function') {
    res.redirect(302, loginUrl)
    return
  }

  res.statusCode = 302
  res.setHeader('location', loginUrl)
  res.end()
}
