import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NestFactory } from '@nestjs/core'
import { protectQuotePage } from './lib/eventus-auth.js'
import { resolveFeedbackUploadRequestPath } from './lib/feedback-upload-storage.js'
import { loadServerEnv } from './lib/server-env.js'
import { getPublicFeedbackOpenGraphData } from './feedback.js'
import { ApiModule } from './nest-app.js'

loadServerEnv()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const distDir = path.join(projectRoot, 'apps/web/dist')
const publicDir = path.join(projectRoot, 'apps/web/public')
const indexHtml = path.join(distDir, 'index.html')
const port = Number(process.env.PORT || 3000)
const host = process.env.HOST || '0.0.0.0'
const apiBodyLimit = process.env.API_JSON_BODY_LIMIT || '12mb'
const surveyPageTitle = 'Chia sẻ ý kiến của bạn - Eventus CSS'
const quotePublicPageTitle = 'Báo giá chi tiết - Eventus Production'

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
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

function sendHtml(res, html) {
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.setHeader('cache-control', 'no-cache')
  res.setHeader('vary', 'Accept-Encoding')
  res.end(html)
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim()
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim()
  const proto = forwardedProto || (req.secure ? 'https' : 'http')
  const hostHeader = forwardedHost || req.headers?.host || 'localhost'
  return `${proto}://${hostHeader}`
}

function absolutizeUrl(req, value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    return new URL(text).toString()
  } catch {
    return new URL(text.startsWith('/') ? text : `/${text}`, getRequestOrigin(req)).toString()
  }
}

function getFeedbackIdentifier(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  const match = pathname.match(/^\/feedbacks\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ''
}

function getGalleryIdentifier(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  const match = pathname.match(/^\/gallery\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : ''
}

function isSurveyPageUrl(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  return pathname === '/survey' || pathname === '/survey/'
}

function isQuotePublicPageUrl(url = '') {
  const pathname = new URL(url, 'http://localhost').pathname
  return /^\/q\/[^/]+\/?$/.test(pathname)
}

function stripManagedOpenGraphTags(html = '') {
  return html.replace(
    /\s*<meta\s+(?:property|name)=["'](?:og:title|og:description|og:type|og:url|og:image|og:site_name|twitter:card|twitter:title|twitter:description|twitter:image)["'][^>]*>\s*/gi,
    '\n',
  )
}

function renderOpenGraphIndexHtml(req, metadata = {}) {
  const rawHtml = stripManagedOpenGraphTags(fs.readFileSync(indexHtml, 'utf8'))
  const title = metadata.title || 'Eventus Client Portal'
  const pageTitle = `${title} | Eventus Client Portal`
  const description = metadata.description || 'Eventus Client Portal'
  const pageUrl = absolutizeUrl(req, metadata.path || new URL(req.url || '/', 'http://localhost').pathname)
  const tags = [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', pageUrl],
    ['property', 'og:site_name', 'Eventus Client Portal'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
  ].map(([attribute, name, content]) => (
    `    <meta ${attribute}="${escapeHtml(name)}" content="${escapeHtml(content)}" />`
  )).join('\n')

  return rawHtml
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`)
    .replace('</head>', `${tags}\n  </head>`)
}

function renderTitledIndexHtml(title) {
  return fs.readFileSync(indexHtml, 'utf8')
    .replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
}

function resolveStaticPath(url = '/') {
  const pathname = new URL(url, 'http://localhost').pathname
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(distDir, safePath === '/' ? 'index.html' : safePath)
  return filePath.startsWith(distDir) ? filePath : indexHtml
}

function resolvePublicPath(url = '/') {
  const pathname = new URL(url, 'http://localhost').pathname
  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(publicDir, safePath)
  return filePath.startsWith(publicDir) ? filePath : null
}

async function handleStaticRequest(req, res, next) {
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

  const publicPath = resolvePublicPath(req.url)
  if (publicPath && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
    sendFile(res, publicPath)
    return
  }

  const uploadPath = resolveFeedbackUploadRequestPath(req.url)
  if (uploadPath && fs.existsSync(uploadPath) && fs.statSync(uploadPath).isFile()) {
    sendFile(res, uploadPath)
    return
  }

  const filePath = resolveStaticPath(req.url)
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath)
    return
  }

  if (req.method === 'GET' && isSurveyPageUrl(req.url)) {
    sendHtml(res, renderTitledIndexHtml(surveyPageTitle))
    return
  }

  if (req.method === 'GET' && isQuotePublicPageUrl(req.url)) {
    sendHtml(res, renderTitledIndexHtml(quotePublicPageTitle))
    return
  }

  const feedbackIdentifier = req.method === 'GET' ? getFeedbackIdentifier(req.url) : ''
  if (feedbackIdentifier) {
    const metadata = await getPublicFeedbackOpenGraphData(feedbackIdentifier).catch(() => null)
    if (metadata) {
      sendHtml(res, renderOpenGraphIndexHtml(req, metadata))
      return
    }
  }

  const galleryIdentifier = req.method === 'GET' ? getGalleryIdentifier(req.url) : ''
  if (galleryIdentifier) {
    const metadata = await getPublicFeedbackOpenGraphData(galleryIdentifier).catch(() => null)
    if (metadata) {
      sendHtml(res, renderOpenGraphIndexHtml(req, {
        ...metadata,
        path: new URL(req.url || '/', 'http://localhost').pathname,
      }))
      return
    }
  }

  sendFile(res, indexHtml)
}

function registerStaticFallback(server) {
  server.use((req, res, next) => {
    handleStaticRequest(req, res, next).catch(() => {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'Internal Server Error' }))
    })
  })
}

const app = await NestFactory.create(ApiModule, { bodyParser: false, logger: ['error', 'warn'] })
app.enableCors()
app.useBodyParser('json', { limit: apiBodyLimit })
app.useBodyParser('urlencoded', { extended: true, limit: apiBodyLimit })
const server = app.getHttpAdapter().getInstance()
server.use(protectQuotePage)
registerStaticFallback(server)
await app.init()
await app.listen(port, host)

console.log(`Eventus Nest server listening on http://${host}:${port}`)
