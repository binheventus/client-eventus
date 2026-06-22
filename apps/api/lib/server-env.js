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
