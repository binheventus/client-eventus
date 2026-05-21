import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NestFactory } from '@nestjs/core'
import { protectQuotePage } from './lib/eventus-auth.js'
import { ApiModule } from './nest-app.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const distDir = path.join(projectRoot, 'apps/web/dist')
const indexHtml = path.join(distDir, 'index.html')
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '0.0.0.0'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath)
  res.setHeader('content-type', contentTypes[ext] || 'application/octet-stream')
  if (filePath === indexHtml || ext === '.html') {
    res.setHeader('cache-control', 'no-cache')
  } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('cache-control', 'public, max-age=31536000, immutable')
  } else {
    res.setHeader('cache-control', 'public, max-age=86400')
  }
  res.setHeader('vary', 'Accept-Encoding')
  fs.createReadStream(filePath)
    .on('error', () => {
      res.statusCode = 500
      res.end('Internal Server Error')
    })
    .pipe(res)
}

function resolveStaticPath(url = '/') {
  const pathname = new URL(url, 'http://localhost').pathname
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath)
  return filePath.startsWith(distDir) ? filePath : indexHtml
}

function registerStaticFallback(server) {
  server.use((req, res, next) => {
    if (String(req.url || '').startsWith('/api/')) {
      next()
      return
    }

    if (!fs.existsSync(indexHtml)) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Missing dist/index.html. Run npm run build first.' }))
      return
    }

    const filePath = resolveStaticPath(req.url)
    sendFile(res, fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : indexHtml)
  })
}

const app = await NestFactory.create(ApiModule, { logger: ['error', 'warn'] })
app.enableCors()
const server = app.getHttpAdapter().getInstance()
server.use(protectQuotePage)
registerStaticFallback(server)
await app.init()
await app.listen(port, host)

console.log(`Eventus Nest server listening on http://${host}:${port}`)
