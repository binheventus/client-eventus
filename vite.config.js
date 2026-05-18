import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import parseQuoteHandler from './api/parse-quote.js'

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  return fs.readFileSync(filePath, 'utf8')
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

function loadLocalEnv(mode, cwd) {
  return [
    '.env',
    '.env.local',
    `.env.${mode}`,
    `.env.${mode}.local`,
  ].reduce((env, fileName) => ({
    ...env,
    ...parseEnvFile(path.join(cwd, fileName)),
  }), {})
}

function localApiPlugin() {
  return {
    name: 'eventus-local-api',
    configureServer(server) {
      server.middlewares.use('/api/parse-quote', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('Allow', 'POST')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const rawBody = Buffer.concat(chunks).toString('utf8')
          req.body = rawBody ? JSON.parse(rawBody) : {}

          const apiRes = {
            statusCode: 200,
            setHeader: (key, value) => res.setHeader(key, value),
            status(code) {
              this.statusCode = code
              return this
            },
            json(payload) {
              res.statusCode = this.statusCode
              res.setHeader('content-type', 'application/json')
              res.end(JSON.stringify(payload))
              return this
            },
          }

          await parseQuoteHandler(req, apiRes)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: error?.message || 'Local API error' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const localEnv = loadLocalEnv(mode, process.cwd())
  const env = loadEnv(mode, process.cwd(), '')

  Object.entries({ ...env, ...localEnv }).forEach(([key, value]) => {
    if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value
  })

  return {
    plugins: [react(), localApiPlugin()],
  }
})
