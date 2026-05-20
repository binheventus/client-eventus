import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import contractsHandler from './api/contracts.js'
import clientPagesHandler from './api/client-pages.js'
import parseQuoteHandler from './api/parse-quote.js'
import quotesHandler from './api/quotes.js'

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
  function makeApiResponse(res) {
    return {
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
  }

  async function attachBodyAndQuery(req) {
    const url = new URL(req.url || '/', 'http://localhost')
    const query = {}
    url.searchParams.forEach((value, key) => {
      if (query[key] === undefined) {
        query[key] = value
        return
      }
      query[key] = Array.isArray(query[key]) ? [...query[key], value] : [query[key], value]
    })
    req.query = query

    if (['GET', 'HEAD'].includes(req.method || 'GET')) {
      req.body = {}
      return
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const rawBody = Buffer.concat(chunks).toString('utf8')
    req.body = rawBody ? JSON.parse(rawBody) : {}
  }

  function useApi(server, pathPrefix, handler, allowedMethods) {
    server.middlewares.use(pathPrefix, async (req, res) => {
      if (!allowedMethods.includes(req.method)) {
        res.statusCode = 405
        res.setHeader('Allow', allowedMethods.join(', '))
        res.end(JSON.stringify({ error: 'Method not allowed' }))
        return
      }

      try {
        await attachBodyAndQuery(req)
        await handler(req, makeApiResponse(res))
      } catch (error) {
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: error?.message || 'Local API error' }))
      }
    })
  }

  return {
    name: 'eventus-local-api',
    configureServer(server) {
      useApi(server, '/api/parse-quote', parseQuoteHandler, ['POST'])
      useApi(server, '/api/quotes', quotesHandler, ['GET', 'POST', 'PATCH', 'DELETE'])
      useApi(server, '/api/contracts', contractsHandler, ['GET', 'POST', 'DELETE'])
      useApi(server, '/api/client-pages', clientPagesHandler, ['GET', 'POST', 'PATCH', 'DELETE'])
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
