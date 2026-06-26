import fs from 'node:fs'
import path from 'node:path'

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  let raw = ''
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch {
    return {}
  }

  return raw
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return env

      const normalized = trimmed.replace(/^export\s+/, '')
      const separatorIndex = normalized.indexOf('=')
      if (separatorIndex < 0) return env

      const key = normalized.slice(0, separatorIndex).trim()
      const value = normalized.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key) env[key] = value
      return env
    }, {})
}

export function loadServerEnv(cwd = process.cwd()) {
  ;['.env', '.env.local'].forEach(fileName => {
    const env = parseEnvFile(path.join(cwd, fileName))
    Object.entries(env).forEach(([key, value]) => {
      if (process.env[key] === undefined || process.env[key] === '') {
        process.env[key] = value
      }
    })
  })
}

export function requireEnv(name) {
  loadServerEnv()
  const value = process.env[name]
  if (!value && value !== '') {
    throw new Error(`Missing ${name}.`)
  }
  return value
}

const DEFAULT_GALLERY_GAS_TIMEOUT_MS = 20000

/**
 * URL of the Google Apps Script Web App that lists Drive folder photos
 * (the /exec endpoint). Empty when not configured → gallery falls back to the
 * legacy Drive button. Server-only; never exposed to the browser.
 */
export function getGalleryGasUrl() {
  loadServerEnv()
  return (process.env.GALLERY_GAS_URL || '').trim()
}

/** Timeout (ms) for the server→GAS request. Defaults to 20000. */
export function getGalleryGasTimeoutMs() {
  loadServerEnv()
  const value = Number(process.env.GALLERY_GAS_TIMEOUT_MS || DEFAULT_GALLERY_GAS_TIMEOUT_MS)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_GALLERY_GAS_TIMEOUT_MS
}

const DEFAULT_GALLERY_GAS_CACHE_TTL_MS = 10 * 60 * 1000

/** How long a successful Drive photo listing is cached, keyed by folder ID. Defaults to 10 min. */
export function getGalleryGasCacheTtlMs() {
  loadServerEnv()
  const value = Number(process.env.GALLERY_GAS_CACHE_TTL_MS || DEFAULT_GALLERY_GAS_CACHE_TTL_MS)
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_GALLERY_GAS_CACHE_TTL_MS
}
