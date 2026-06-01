import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { protectQuotePage } from '../api/lib/eventus-auth.js'
import { createNestApiMiddleware } from '../api/nest-app.js'

const webRoot = path.dirname(fileURLToPath(import.meta.url))

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
  let nestMiddlewarePromise

  return {
    name: 'eventus-local-api',
    configureServer(server) {
      server.middlewares.use(protectQuotePage)
      server.middlewares.use(async (req, res, next) => {
        if (!String(req.url || '').startsWith('/api/')) {
          next()
          return
        }

        try {
          nestMiddlewarePromise ||= createNestApiMiddleware()
          const nestMiddleware = await nestMiddlewarePromise
          nestMiddleware(req, res, next)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: error?.message || 'Local Nest API error' }))
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
    root: webRoot,
    plugins: [react(), localApiPlugin()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: ['client-eventus.test'],
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  }
})
