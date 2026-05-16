import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import parseQuoteHandler from './api/parse-quote.js'

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
  const env = loadEnv(mode, process.cwd(), '')
  Object.entries(env).forEach(([key, value]) => {
    if (process.env[key] === undefined) process.env[key] = value
  })

  return {
    plugins: [react(), localApiPlugin()],
  }
})
