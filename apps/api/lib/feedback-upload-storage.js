import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadServerEnv } from './server-env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../..')
const DEFAULT_UPLOAD_ROOT = path.join(projectRoot, 'storage', 'feedback-assets', 'uploads')
const DEFAULT_PUBLIC_PREFIX = '/feedback-assets/uploads'

function getNormalizedPublicPrefix() {
  loadServerEnv()
  const configured = String(process.env.FEEDBACK_UPLOAD_PUBLIC_PREFIX || DEFAULT_PUBLIC_PREFIX).trim()
  const normalized = `/${configured.replace(/^\/+|\/+$/g, '')}`
  return normalized === '/' ? DEFAULT_PUBLIC_PREFIX : normalized
}

export function getFeedbackUploadRoot() {
  loadServerEnv()
  return path.resolve(String(process.env.FEEDBACK_UPLOAD_ROOT || DEFAULT_UPLOAD_ROOT).trim() || DEFAULT_UPLOAD_ROOT)
}

export function getFeedbackUploadPublicPrefix() {
  return getNormalizedPublicPrefix()
}

function isPathInsideRoot(filePath, rootPath) {
  const root = path.resolve(rootPath)
  const target = path.resolve(filePath)
  return target === root || target.startsWith(`${root}${path.sep}`)
}

function normalizeRelativePath(relativePath = '') {
  return path.normalize(String(relativePath || '').replace(/^\/+/, '')).replace(/^(\.\.[/\\])+/, '')
}

export async function ensureFeedbackUploadSubdir(subdir = '') {
  const root = getFeedbackUploadRoot()
  const safeSubdir = normalizeRelativePath(subdir)
  const dir = path.join(root, safeSubdir)
  if (!isPathInsideRoot(dir, root)) throw new Error('Feedback upload path is outside upload root.')
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

export function buildFeedbackUploadUrl(relativePath = '') {
  const prefix = getFeedbackUploadPublicPrefix()
  const safePath = normalizeRelativePath(relativePath).split(path.sep).join('/')
  return `${prefix}/${safePath}`.replace(/\/{2,}/g, '/')
}

export function resolveFeedbackUploadRequestPath(url = '/') {
  const pathname = new URL(url, 'http://localhost').pathname
  const prefix = getFeedbackUploadPublicPrefix()
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null

  const relativePath = decodeURIComponent(pathname.slice(prefix.length)).replace(/^\/+/, '')
  const root = getFeedbackUploadRoot()
  const filePath = path.join(root, normalizeRelativePath(relativePath))
  return isPathInsideRoot(filePath, root) ? filePath : null
}

export function resolveFeedbackUploadPublicPath(publicUrl = '') {
  const text = String(publicUrl || '').trim()
  if (!text) return null
  const prefix = getFeedbackUploadPublicPrefix()
  const pathname = new URL(text, 'http://localhost').pathname
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null
  return resolveFeedbackUploadRequestPath(pathname)
}

export function isFeedbackUploadStoragePath(filePath = '') {
  if (!filePath) return false
  return isPathInsideRoot(filePath, getFeedbackUploadRoot())
}

export async function removeFeedbackUploadFile(value = '') {
  const text = String(value || '').trim()
  if (!text) return false

  const filePath = text.startsWith(getFeedbackUploadPublicPrefix())
    ? resolveFeedbackUploadPublicPath(text)
    : path.resolve(text)

  if (!filePath || !isFeedbackUploadStoragePath(filePath)) return false
  await fsp.unlink(filePath).catch(error => {
    if (error?.code !== 'ENOENT') throw error
  })
  return true
}
