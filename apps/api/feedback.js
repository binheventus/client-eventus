import { randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  emptyToNull,
  fromJson,
  insertRow,
  normalizeBoolean,
  nowMysql,
  query,
  tables,
  toJson,
  toMysqlDateTime,
  updateRow,
  withTransaction,
} from './lib/mysql.js'
import { getEventusAuthUser, requireEventusAuth } from './lib/eventus-auth.js'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const webRoot = path.join(projectRoot, 'apps/web')
const publicRoot = path.join(webRoot, 'public')
const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DEFAULT_PAGE_SIZE = 20
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const DEFAULT_RCLONE_REMOTE = 'eventus'
const DEFAULT_RCLONE_FEEDBACK_DIR = 'feedback'
const EDITABLE_COMMENT_COLUMNS = new Set([
  'comment_1',
  'image_comment_1',
  'reply_1',
  'image_reply_1',
  'time_comment_1',
  'time_reply_1',
  'is_done_1',
  'comment_2',
  'image_comment_2',
  'reply_2',
  'image_reply_2',
  'time_comment_2',
  'time_reply_2',
  'is_done_2',
])

const DEFAULT_SURVEY_QUESTIONS = [
  {
    id: 'default-video-quality',
    question: 'Anh/chị đánh giá chất lượng video nhận được như thế nào?',
    type: 'video',
    star: 5,
    text_left: 'Chưa hài lòng',
    text_right: 'Rất hài lòng',
    sort_order: 10,
    answers: ['1', '2', '3', '4', '5'].map((answer, index) => ({
      id: `default-video-quality-${answer}`,
      answer,
      is_star: true,
      sort_order: index + 1,
    })),
  },
  {
    id: 'default-video-service',
    question: 'Điều gì khiến anh/chị hài lòng nhất trong quá trình làm việc với Eventus?',
    type: 'video',
    star: null,
    sort_order: 20,
    answers: [
      'Tư vấn rõ ràng',
      'Tác phong chuyên nghiệp',
      'Chất lượng hình ảnh',
      'Tiến độ phản hồi',
      'Dễ góp ý chỉnh sửa',
    ].map((answer, index) => ({
      id: `default-video-service-${index + 1}`,
      answer,
      is_star: false,
      sort_order: index + 1,
    })),
  },
  {
    id: 'default-video-improve',
    question: 'Eventus nên cải thiện điều gì để phục vụ anh/chị tốt hơn?',
    type: 'video',
    star: null,
    sort_order: 30,
    answers: [
      'Tốc độ gửi bản dựng',
      'Cách trao đổi brief',
      'Chất lượng hậu kỳ',
      'Link xem và feedback',
      'Không có góp ý thêm',
    ].map((answer, index) => ({
      id: `default-video-improve-${index + 1}`,
      answer,
      is_star: false,
      sort_order: index + 1,
    })),
  },
  {
    id: 'default-image-quality',
    question: 'Anh/chị đánh giá bộ ảnh nhận được như thế nào?',
    type: 'image',
    star: 5,
    text_left: 'Chưa hài lòng',
    text_right: 'Rất hài lòng',
    sort_order: 10,
    answers: ['1', '2', '3', '4', '5'].map((answer, index) => ({
      id: `default-image-quality-${answer}`,
      answer,
      is_star: true,
      sort_order: index + 1,
    })),
  },
  {
    id: 'default-image-service',
    question: 'Điều gì khiến anh/chị hài lòng nhất về dịch vụ chụp ảnh?',
    type: 'image',
    star: null,
    sort_order: 20,
    answers: [
      'Góc chụp đẹp',
      'Khoảnh khắc đầy đủ',
      'Màu ảnh phù hợp',
      'Tác phong ekip',
      'Tốc độ gửi file',
    ].map((answer, index) => ({
      id: `default-image-service-${index + 1}`,
      answer,
      is_star: false,
      sort_order: index + 1,
    })),
  },
]

function sendError(res, error, fallback = 'Khong xu ly duoc module feedback.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

function makeHttpError(message, statusCode = 400, code) {
  const error = new Error(message)
  error.statusCode = statusCode
  if (code) error.code = code
  return error
}

function getRequestBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function getPositiveInteger(value, fallback = 1) {
  const number = Number(getQueryValue(value))
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function makeId(prefix = '') {
  return prefix ? `${prefix}_${randomUUID()}` : randomUUID()
}

function makeReadableToken(length = 14) {
  return Array.from(randomBytes(length), value => (
    SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]
  )).join('')
}

function trimText(value = '', maxLength = 500) {
  const text = String(value || '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function parseAccess(payload = {}, queryParams = {}) {
  const access = payload.access || {}
  return {
    zalo: trimText(access.zalo || payload.zalo || queryParams.zalo, 120),
    token: trimText(access.token || payload.token || payload.share_token || queryParams.token || queryParams.share_token, 80),
  }
}

function normalizeOverallFeedback(value) {
  const parsed = fromJson(value, [])
  if (Array.isArray(parsed)) return parsed.filter(item => String(item || '').trim())
  if (typeof parsed === 'string') return [parsed].filter(Boolean)
  return []
}

function normalizeFeedbackRow(row = {}) {
  if (!row) return null
  return {
    ...row,
    overall_feedback: normalizeOverallFeedback(row.overall_feedback),
    more_column: normalizeBoolean(row.more_column),
    done_feedback: normalizeBoolean(row.done_feedback),
    job: normalizeJobRow(row.job || {
      id: row.job_id,
      job_title: row.job_title,
      customer_name: row.customer_name,
      customer_id: row.customer_id,
      job_date: row.job_date,
      zalo_id: row.zalo_id,
      drive_feedback: row.job_drive_feedback,
      gallery_drive: row.gallery_drive,
      editor_name: row.job_editor_name,
      editor_phone: row.job_editor_phone,
    }),
  }
}

function normalizeCommentRow(row = {}) {
  if (!row) return null
  return {
    ...row,
    is_done_1: normalizeBoolean(row.is_done_1),
    is_done_2: normalizeBoolean(row.is_done_2),
    attachments: [],
  }
}

function normalizeJobRow(row = {}) {
  if (!row) return null
  return {
    ...row,
    id: row.id,
    title: row.job_title || row.title || '',
    customer_name: row.customer_name || row.customer_company_name || row.company_name || '',
    zalo_id: row.zalo_id || '',
    job_date: row.job_date || null,
    drive_feedback: row.drive_feedback || '',
    gallery_drive: row.gallery_drive || '',
    editor_name: row.editor_name || '',
    editor_phone: row.editor_phone || '',
  }
}

function normalizeEmployeeRow(row = {}) {
  if (!row) return null
  return {
    id: row.id,
    name: row.zalo_name || row.name || row.full_name || '',
    phone: row.phone || '',
    zalo_name: row.zalo_name || row.name || '',
  }
}

function getFeedbackListSelect() {
  return `
    f.*,
    j.job_title,
    j.customer_name,
    j.customer_id,
    j.job_date,
    j.zalo_id,
    j.drive_feedback as job_drive_feedback,
    j.gallery_drive,
    j.editor_name as job_editor_name,
    j.editor_phone as job_editor_phone
  `
}

async function getJobById(id) {
  if (!id) return null
  const rows = await query(`select * from ${tables.jobs} where id = ? limit 1`, [id])
  return normalizeJobRow(rows?.[0])
}

async function getJobByZaloId(zaloId) {
  if (!zaloId) return null
  const rows = await query(`select * from ${tables.jobs} where zalo_id = ? limit 1`, [zaloId])
  return normalizeJobRow(rows?.[0])
}

async function listJobEmployees(jobId) {
  if (!jobId) return []
  try {
    const rows = await query(
      `select e.*
       from ${tables.employeeJobs} ej
       inner join ${tables.employees} e on e.id = ej.employee_id
       where ej.job_id = ?
       order by coalesce(e.zalo_name, e.name) asc`,
      [jobId],
    )
    return rows.map(normalizeEmployeeRow).filter(Boolean)
  } catch {
    return []
  }
}

async function listFeedbackJobs({ search = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const params = []
  const where = ['j.deleted_at is null']

  if (search) {
    const like = `%${search}%`
    where.push('(j.job_title like ? or j.customer_name like ? or j.zalo_id like ?)')
    params.push(like, like, like)
  }

  const whereSql = `where ${where.join(' and ')}`
  const countRows = await query(`select count(*) as count from ${tables.jobs} j ${whereSql}`, params)
  const rows = await query(
    `select j.*,
      latest.id as feedback_id,
      latest.share_token as feedback_share_token,
      latest.name as feedback_name,
      latest.done_feedback as feedback_done
     from ${tables.jobs} j
     left join (
       select f1.*
       from ${tables.feedbacks} f1
       inner join (
         select job_id, max(created_at) as latest_created_at
         from ${tables.feedbacks}
         where deleted_at is null
         group by job_id
       ) f2 on f2.job_id = f1.job_id and f2.latest_created_at = f1.created_at
       where f1.deleted_at is null
     ) latest on latest.job_id = j.id
     ${whereSql}
     order by coalesce(j.job_date, j.created_at) desc, j.id desc
     limit ? offset ?`,
    [...params, limit, offset],
  )

  return {
    jobs: rows.map(row => ({
      ...normalizeJobRow(row),
      feedback_id: row.feedback_id || null,
      feedback_share_token: row.feedback_share_token || null,
      feedback_name: row.feedback_name || null,
      feedback_done: normalizeBoolean(row.feedback_done),
    })),
    page: Number(page) || 1,
    pageSize: limit,
    total: Number(countRows?.[0]?.count || 0),
  }
}

async function listFeedbacks({ search = '', jobId = '', page = 1, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const params = []
  const where = ['f.deleted_at is null']

  if (jobId) {
    where.push('f.job_id = ?')
    params.push(jobId)
  }

  if (search) {
    const like = `%${search}%`
    where.push('(f.name like ? or f.video_title like ? or j.job_title like ? or j.customer_name like ? or j.zalo_id like ?)')
    params.push(like, like, like, like, like)
  }

  const whereSql = `where ${where.join(' and ')}`
  const countRows = await query(
    `select count(*) as count
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     ${whereSql}`,
    params,
  )
  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     ${whereSql}
     order by f.created_at desc
     limit ? offset ?`,
    [...params, limit, offset],
  )

  return {
    feedbacks: rows.map(normalizeFeedbackRow),
    page: Number(page) || 1,
    pageSize: limit,
    total: Number(countRows?.[0]?.count || 0),
  }
}

async function getFeedbackByIdentifier(identifier) {
  if (!identifier) return null
  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     where (f.id = ? or f.legacy_id = ? or f.share_token = ?) and f.deleted_at is null
     limit 1`,
    [identifier, Number(identifier) || 0, identifier],
  )
  return normalizeFeedbackRow(rows?.[0])
}

async function listFeedbacksForJob(jobId) {
  if (!jobId) return []
  const result = await listFeedbacks({ jobId, pageSize: 100 })
  return result.feedbacks
}

async function ensureFeedbackForJob(jobId, patch = {}) {
  const job = await getJobById(jobId)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     where f.job_id = ? and f.deleted_at is null
     order by f.created_at asc
     limit 1`,
    [job.id],
  )
  if (rows?.[0]) return normalizeFeedbackRow(rows[0])

  const id = makeId('fb')
  await query(
    `insert into ${tables.feedbacks}
       (id, job_id, share_token, name, drive_url, editor_name, editor_phone, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
    [
      id,
      job.id,
      makeReadableToken(),
      patch.name || 'Feedback 1',
      patch.drive_url || job.drive_feedback || null,
      patch.editor_name || job.editor_name || null,
      patch.editor_phone || job.editor_phone || null,
    ],
  )
  return getFeedbackByIdentifier(id)
}

async function createFeedback(jobId, payload = {}) {
  const job = await getJobById(jobId)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const rows = await query(`select count(*) as count from ${tables.feedbacks} where job_id = ? and deleted_at is null`, [job.id])
  const count = Number(rows?.[0]?.count || 0)
  const id = makeId('fb')
  const shareToken = makeReadableToken()

  await query(
    `insert into ${tables.feedbacks}
       (id, job_id, share_token, name, video_url, video_title, direct_video_url, drive_url,
        editor_employee_id, editor_name, editor_phone, started_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
    [
      id,
      job.id,
      shareToken,
      trimText(payload.name, 255) || `Feedback ${count + 1}`,
      emptyToNull(payload.video_url),
      emptyToNull(payload.video_title),
      emptyToNull(payload.direct_video_url),
      emptyToNull(payload.drive_url || job.drive_feedback),
      emptyToNull(payload.editor_employee_id),
      emptyToNull(payload.editor_name || job.editor_name),
      emptyToNull(payload.editor_phone || job.editor_phone),
      payload.video_url ? nowMysql() : null,
    ],
  )

  return getFeedbackByIdentifier(id)
}

async function getFeedbackComments(feedbackId) {
  if (!feedbackId) return []
  const comments = (await query(
    `select * from ${tables.feedbackComments}
     where feedback_id = ?
     order by coalesce(time_comment_1, time_comment_2, 999999), created_at asc`,
    [feedbackId],
  )).map(normalizeCommentRow)

  if (!comments.length) return []

  const ids = comments.map(comment => comment.id)
  const placeholders = ids.map(() => '?').join(', ')
  const attachments = await query(
    `select * from ${tables.feedbackAttachments}
     where comment_id in (${placeholders})
     order by created_at asc`,
    ids,
  )
  const attachmentMap = attachments.reduce((acc, row) => {
    const item = {
      id: row.id,
      comment_id: row.comment_id,
      file_name: row.file_name,
      url: row.url,
      storage_path: row.storage_path,
      preview_url: row.preview_url,
      field_name: row.field_name,
      file_type: row.file_type,
      delete_at: row.delete_at,
      created_at: row.created_at,
    }
    if (!acc.has(row.comment_id)) acc.set(row.comment_id, [])
    acc.get(row.comment_id).push(item)
    return acc
  }, new Map())

  return comments.map(comment => ({
    ...comment,
    attachments: attachmentMap.get(comment.id) || [],
  }))
}

async function assertFeedbackAccess(req, feedback, access = {}) {
  if (!feedback?.id) throw makeHttpError('Không tìm thấy feedback.', 404, 'FEEDBACK_NOT_FOUND')
  if (req.eventusUser) return true

  const token = access.token || ''
  const zalo = access.zalo || ''
  const jobZalo = feedback.job?.zalo_id || ''
  if (token && token === feedback.share_token) return true
  if (zalo && jobZalo && zalo === jobZalo) return true

  const user = await getEventusAuthUser(req)
  if (user) {
    req.eventusUser = user
    return true
  }

  throw makeHttpError('Link feedback không hợp lệ hoặc đã thiếu mã xác thực.', 403, 'FEEDBACK_ACCESS_DENIED')
}

async function getFeedbackDetail(req, identifier, access = {}) {
  const feedback = await getFeedbackByIdentifier(identifier)
  await assertFeedbackAccess(req, feedback, access)

  const [comments, feedbacks, employees] = await Promise.all([
    getFeedbackComments(feedback.id),
    listFeedbacksForJob(feedback.job_id),
    listJobEmployees(feedback.job_id),
  ])

  return {
    feedback,
    comments,
    feedbacks,
    employees,
    public_url: `/feedbacks/${encodeURIComponent(feedback.id)}?token=${encodeURIComponent(feedback.share_token)}`,
  }
}

function getYoutubeVideoId(url = '') {
  const text = String(url || '').trim()
  if (!text) return ''

  try {
    const parsed = new URL(text)
    if (parsed.hostname === 'youtu.be') return parsed.pathname.replace(/^\//, '')
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || ''
    return parsed.searchParams.get('v') || ''
  } catch {
    const match = text.match(/(?:youtu\.be\/|v=|shorts\/)([A-Za-z0-9_-]{6,})/)
    return match?.[1] || ''
  }
}

function getRuntimePublicRoot() {
  return publicRoot
}

async function ensurePublicSubdir(subdir) {
  const root = getRuntimePublicRoot()
  const dir = path.join(root, subdir)
  await fsp.mkdir(dir, { recursive: true })
  return dir
}

function sanitizeFileName(fileName = 'file') {
  const ext = path.extname(fileName).slice(0, 12)
  const base = path.basename(fileName, ext)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'file'
  return `${base}${ext}`
}

function getRcloneConfig() {
  return {
    binary: process.env.RCLONE_BIN || 'rclone',
    remote: String(process.env.RCLONE_REMOTE || DEFAULT_RCLONE_REMOTE).replace(/:+$/, ''),
    baseDir: String(process.env.RCLONE_FEEDBACK_DIR || DEFAULT_RCLONE_FEEDBACK_DIR).replace(/^\/+|\/+$/g, ''),
  }
}

function getFeedbackStorageKey(feedback) {
  return sanitizeFileName(String(feedback?.legacy_id || feedback?.id || 'feedback')).replace(/\./g, '-')
}

function getPublicFilePath(publicUrl = '') {
  const normalized = String(publicUrl || '').replace(/^\/+/, '')
  if (!normalized) return ''
  const filePath = path.join(publicRoot, normalized)
  return filePath.startsWith(publicRoot) ? filePath : ''
}

async function saveLocalFeedbackFile(buffer, feedback, fileName) {
  const dir = await ensurePublicSubdir(`feedback-assets/uploads/${getFeedbackStorageKey(feedback)}`)
  const filePath = path.join(dir, fileName)
  await fsp.writeFile(filePath, buffer)
  return {
    url: `/feedback-assets/uploads/${getFeedbackStorageKey(feedback)}/${fileName}`,
    storagePath: filePath,
  }
}

async function uploadFeedbackFileToDrive(buffer, feedback, fileName) {
  const { binary, remote, baseDir } = getRcloneConfig()
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'eventus-feedback-'))
  const tempPath = path.join(tempDir, fileName)
  const remotePath = `${remote}:${baseDir}/feedback-${getFeedbackStorageKey(feedback)}/${fileName}`

  try {
    await fsp.writeFile(tempPath, buffer)
    await execFileAsync(binary, ['copyto', tempPath, remotePath], { timeout: 60000, maxBuffer: 1024 * 1024 * 3 })
    const result = await execFileAsync(binary, [
      'link',
      remotePath,
      '--drive-use-shared-date',
      '--drive-acknowledge-abuse',
    ], { timeout: 30000, maxBuffer: 1024 * 1024 })
    const driveUrl = String(result.stdout || '').trim().split(/\r?\n/).find(Boolean)
    if (!driveUrl) throw makeHttpError('Không lấy được link Google Drive sau khi upload.', 502, 'RCLONE_LINK_FAILED')
    return { url: driveUrl, storagePath: remotePath }
  } catch (error) {
    if (error?.statusCode) throw error
    throw makeHttpError('Không upload được file lên Google Drive qua rclone.', 502, 'RCLONE_UPLOAD_FAILED')
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function storeFeedbackAttachmentFile(buffer, feedback, fileName, fileType) {
  if (process.env.FEEDBACK_UPLOAD_STORAGE === 'local') {
    const local = await saveLocalFeedbackFile(buffer, feedback, fileName)
    return {
      url: local.url,
      storagePath: local.storagePath,
      previewUrl: fileType === 'image' ? local.url : null,
    }
  }

  const [drive, preview] = await Promise.all([
    uploadFeedbackFileToDrive(buffer, feedback, fileName),
    fileType === 'image' ? saveLocalFeedbackFile(buffer, feedback, fileName) : Promise.resolve(null),
  ])

  return {
    url: drive.url,
    storagePath: drive.storagePath,
    previewUrl: preview?.url || null,
  }
}

async function deleteStoredAttachment(attachment = {}) {
  const storagePath = String(attachment.storage_path || '')
  if (storagePath.startsWith(getRuntimePublicRoot())) {
    await fsp.unlink(storagePath).catch(() => {})
  } else if (storagePath.includes(':')) {
    const { binary } = getRcloneConfig()
    await execFileAsync(binary, ['delete', storagePath, '--drive-use-trash=false'], {
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    }).catch(() => {})
  }

  const previewPath = getPublicFilePath(attachment.preview_url)
  if (previewPath) await fsp.unlink(previewPath).catch(() => {})
}

async function runOptionalBinary(command, args = [], { timeout = 12000 } = {}) {
  if (!command) return ''
  try {
    const result = await execFileAsync(command, args, { timeout, maxBuffer: 1024 * 1024 * 3 })
    return String(result.stdout || '').trim()
  } catch {
    return ''
  }
}

async function resolveVideoMetadata(videoUrl) {
  const binary = process.env.YOUTUBE_DL || process.env.YT_DLP_BIN
  if (!binary || !videoUrl) return { title: '', directUrl: '' }

  const [title, directUrl] = await Promise.all([
    runOptionalBinary(binary, ['--get-title', videoUrl]),
    runOptionalBinary(binary, ['-f', 'bestvideo[ext=mp4][protocol^=http]/best[ext=mp4]/best', videoUrl, '-g']),
  ])

  return {
    title: trimText(title.split(/\r?\n/)[0] || '', 500),
    directUrl: directUrl.split(/\r?\n/).find(Boolean) || '',
  }
}

async function captureScreenshot(videoUrl, seconds = 0) {
  const source = String(videoUrl || '').trim()
  if (!source) return ''

  const dir = await ensurePublicSubdir('feedback-assets/screenshots')
  const fileName = `${makeReadableToken(10)}.jpg`
  const outputPath = path.join(dir, fileName)
  const ffmpeg = process.env.FFMPEG_BINARIES || 'ffmpeg'
  const timestamp = Math.max(Number(seconds) || 0, 0)

  try {
    await execFileAsync(ffmpeg, [
      '-y',
      '-ss',
      String(timestamp),
      '-i',
      source,
      '-frames:v',
      '1',
      '-q:v',
      '3',
      outputPath,
    ], { timeout: 15000, maxBuffer: 1024 * 1024 * 2 })
    return `/feedback-assets/screenshots/${fileName}`
  } catch {
    return ''
  }
}

async function saveFeedbackSetup(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const patch = body.feedback || body.patch || body
  let editorPayload = {}
  if (patch.editor_employee_id || patch.editor_id) {
    const employeeRows = await query(`select * from ${tables.employees} where id = ? limit 1`, [patch.editor_employee_id || patch.editor_id])
    const employee = normalizeEmployeeRow(employeeRows?.[0])
    if (employee?.id) {
      editorPayload = {
        editor_employee_id: employee.id,
        editor_name: employee.zalo_name || employee.name,
        editor_phone: employee.phone || null,
      }
    }
  }

  const metadata = patch.video_url
    ? await resolveVideoMetadata(patch.video_url)
    : { title: '', directUrl: '' }

  const payload = {
    name: patch.name === undefined ? undefined : emptyToNull(trimText(patch.name, 255)),
    video_url: patch.video_url === undefined ? undefined : emptyToNull(patch.video_url),
    video_title: patch.video_title === undefined && !metadata.title ? undefined : emptyToNull(patch.video_title || metadata.title),
    direct_video_url: patch.direct_video_url === undefined && !metadata.directUrl ? undefined : emptyToNull(patch.direct_video_url || metadata.directUrl),
    drive_url: patch.drive_url === undefined ? undefined : emptyToNull(patch.drive_url),
    video_preview_url: patch.video_preview_url === undefined ? undefined : emptyToNull(patch.video_preview_url),
    audio_preview_url: patch.audio_preview_url === undefined ? undefined : emptyToNull(patch.audio_preview_url),
    started_at: patch.video_url ? (feedback.started_at || nowMysql()) : undefined,
    update_preview_at: patch.video_url ? toMysqlDateTime(new Date(Date.now() + 2 * 60 * 60 * 1000)) : undefined,
    ...editorPayload,
  }

  await withTransaction(async connection => {
    await updateRow(connection, tables.feedbacks, payload, 'id = ?', [feedback.id])
    const jobPatch = {
      editor_name: editorPayload.editor_name,
      editor_phone: editorPayload.editor_phone,
      drive_feedback: patch.drive_url === undefined ? undefined : emptyToNull(patch.drive_url),
      start_feedback: patch.video_url ? nowMysql() : undefined,
    }
    await updateRow(connection, tables.jobs, jobPatch, 'id = ?', [feedback.job_id])
  })

  return getFeedbackDetail(req, feedback.id, parseAccess(body))
}

async function createFeedbackComment(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const time = Number(body.time ?? body.time_comment_1 ?? 0)
  if (time === 0) {
    const duplicate = await query(
      `select id from ${tables.feedbackComments} where feedback_id = ? and time_comment_1 = 0 limit 1`,
      [feedback.id],
    )
    if (duplicate.length) throw makeHttpError('Mốc 00:00 đã có feedback.', 400, 'DUPLICATE_ZERO_TIME')
  }

  const image = body.image_comment_1 || await captureScreenshot(feedback.direct_video_url || feedback.video_preview_url, time)
  const id = makeId('fbc')
  await insertRow({
    query: (sql, params) => query(sql, params),
  }, tables.feedbackComments, {
    id,
    feedback_id: feedback.id,
    comment_1: emptyToNull(body.text || body.comment_1),
    image_comment_1: emptyToNull(image),
    time_comment_1: Number.isFinite(time) ? time : null,
  })

  const comments = await getFeedbackComments(feedback.id)
  return { comment: comments.find(comment => comment.id === id) || null, comments }
}

async function updateFeedbackComment(req, body = {}) {
  const commentRows = await query(`select * from ${tables.feedbackComments} where id = ? limit 1`, [body.id || body.comment_id])
  const comment = commentRows?.[0]
  if (!comment) throw makeHttpError('Không tìm thấy comment.', 404, 'COMMENT_NOT_FOUND')

  const feedback = await getFeedbackByIdentifier(comment.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const column = trimText(body.column, 80)
  if (!EDITABLE_COMMENT_COLUMNS.has(column)) throw makeHttpError('Cột comment không hợp lệ.', 400)

  const value = column.startsWith('time_')
    ? (body.value === '' || body.value === null ? null : Number(body.value))
    : column.startsWith('is_done_')
      ? (normalizeBoolean(body.value) ? 1 : 0)
      : emptyToNull(body.value)

  await query(`update ${tables.feedbackComments} set \`${column}\` = ?, updated_at = current_timestamp(3) where id = ?`, [value, comment.id])
  const comments = await getFeedbackComments(feedback.id)
  return { comment: comments.find(item => item.id === comment.id) || null, comments }
}

async function deleteFeedbackComment(req, body = {}) {
  const commentRows = await query(`select * from ${tables.feedbackComments} where id = ? limit 1`, [body.id || body.comment_id])
  const comment = commentRows?.[0]
  if (!comment) throw makeHttpError('Không tìm thấy comment.', 404, 'COMMENT_NOT_FOUND')

  const feedback = await getFeedbackByIdentifier(comment.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))
  await query(`delete from ${tables.feedbackComments} where id = ?`, [comment.id])
  return { ok: true, comments: await getFeedbackComments(feedback.id) }
}

async function saveAttachment(req, body = {}) {
  const commentRows = await query(`select * from ${tables.feedbackComments} where id = ? limit 1`, [body.comment_id])
  const comment = commentRows?.[0]
  if (!comment) throw makeHttpError('Không tìm thấy comment.', 404, 'COMMENT_NOT_FOUND')

  const feedback = await getFeedbackByIdentifier(comment.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const dataUrl = String(body.data_url || '')
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) throw makeHttpError('File upload không hợp lệ.', 400)

  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length > MAX_UPLOAD_BYTES) throw makeHttpError('File vượt quá dung lượng cho phép 8MB.', 400)

  const fileName = `${Date.now()}-${sanitizeFileName(body.file_name || 'feedback-file')}`
  const attachmentId = makeId('fba')
  const fileType = /^image\//.test(match[1]) ? 'image' : 'file'
  const storedFile = await storeFeedbackAttachmentFile(buffer, feedback, fileName, fileType)
  await query(
    `insert into ${tables.feedbackAttachments}
       (id, comment_id, file_name, url, storage_path, preview_url, field_name, file_type, delete_at, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
    [
      attachmentId,
      comment.id,
      fileName,
      storedFile.url,
      storedFile.storagePath,
      storedFile.previewUrl,
      trimText(body.field_name || body.for_comment, 80) || null,
      fileType,
      toMysqlDateTime(new Date(Date.now() + 1000 * 60 * 60 * 24 * 62)),
    ],
  )

  return { ok: true, comments: await getFeedbackComments(feedback.id) }
}

async function deleteAttachment(req, body = {}) {
  const rows = await query(
    `select a.*, c.feedback_id
     from ${tables.feedbackAttachments} a
     inner join ${tables.feedbackComments} c on c.id = a.comment_id
     where a.id = ?
     limit 1`,
    [body.id || body.attachment_id],
  )
  const attachment = rows?.[0]
  if (!attachment) throw makeHttpError('Không tìm thấy file.', 404, 'ATTACHMENT_NOT_FOUND')

  const feedback = await getFeedbackByIdentifier(attachment.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  await query(`delete from ${tables.feedbackAttachments} where id = ?`, [attachment.id])
  deleteStoredAttachment(attachment).catch(() => {})
  return { ok: true, comments: await getFeedbackComments(feedback.id) }
}

async function toggleMoreColumn(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))
  const nextValue = body.value === undefined ? !feedback.more_column : normalizeBoolean(body.value)
  await query(`update ${tables.feedbacks} set more_column = ?, updated_at = current_timestamp(3) where id = ?`, [nextValue ? 1 : 0, feedback.id])
  return getFeedbackDetail(req, feedback.id, parseAccess(body))
}

async function updateOverallFeedback(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const current = [...normalizeOverallFeedback(feedback.overall_feedback)]
  const type = body.type || body.operation || 'create'
  if (type === 'create') current.push(trimText(body.value, 2000))
  if (type === 'edit') current[Number(body.index)] = trimText(body.value, 2000)
  if (type === 'delete') current.splice(Number(body.index), 1)

  const clean = current.filter(item => String(item || '').trim())
  await query(`update ${tables.feedbacks} set overall_feedback = ?, updated_at = current_timestamp(3) where id = ?`, [toJson(clean, []), feedback.id])
  return getFeedbackDetail(req, feedback.id, parseAccess(body))
}

async function clearColumn(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const number = String(body.number || '1') === '2' ? '2' : '1'
  const type = body.type === 'editor' ? 'editor' : 'customer'
  const columns = type === 'editor'
    ? [`reply_${number}`, `image_reply_${number}`, `time_reply_${number}`]
    : [`comment_${number}`, `image_comment_${number}`, `time_comment_${number}`]
  const assignments = columns.map(column => `\`${column}\` = null`).join(', ')
  await query(`update ${tables.feedbackComments} set ${assignments}, updated_at = current_timestamp(3) where feedback_id = ?`, [feedback.id])
  return { ok: true, comments: await getFeedbackComments(feedback.id) }
}

async function markFeedbackDone(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  await query(
    `update ${tables.feedbacks}
     set done_feedback = 1, completed_at = current_timestamp(3), updated_at = current_timestamp(3)
     where id = ?`,
    [feedback.id],
  )
  notifyFeedbackDone(feedback).catch(() => {})
  return getFeedbackDetail(req, feedback.id, parseAccess(body))
}

async function notifyFeedbackDone(feedback) {
  const baseUrl = String(process.env.NHANSU_URL || '').replace(/\/+$/, '')
  if (!baseUrl || !feedback.editor_phone) return

  const employeeRows = await query(`select id from ${tables.employees} where phone = ? limit 1`, [feedback.editor_phone]).catch(() => [])
  const adminRows = await query(`select id from ${tables.employees} where phone = ? limit 1`, ['0972554172']).catch(() => [])
  const recipients = [employeeRows?.[0]?.id, adminRows?.[0]?.id].filter(Boolean)
  if (!recipients.length) return

  await fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 1,
      need_to_send: recipients,
      title: 'Khách đã hoàn thành Feedback!',
      content: `Khách hàng đã hoàn thành ${feedback.name || 'Feedback'} của job ${feedback.job?.title || feedback.job_id}.\nBạn hãy check và confirm thời gian gửi bản tiếp theo cho khách nhé.`,
    }),
  }).catch(() => {})
}

async function getSurveyQuestions(type = 'video') {
  const rows = await query(
    `select q.*, a.id as answer_id, a.answer, a.is_star, a.sort_order as answer_sort_order
     from ${tables.feedbackSurveyQuestions} q
     left join ${tables.feedbackSurveyAnswers} a on a.question_id = q.id
     where q.type = ? and q.is_active = 1
     order by q.sort_order asc, a.sort_order asc`,
    [type],
  )

  if (!rows.length) return DEFAULT_SURVEY_QUESTIONS.filter(question => question.type === type)

  const map = new Map()
  rows.forEach(row => {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        question: row.question,
        type: row.type,
        star: row.star,
        text_left: row.text_left,
        text_right: row.text_right,
        sort_order: row.sort_order,
        answers: [],
      })
    }
    if (row.answer_id) {
      map.get(row.id).answers.push({
        id: row.answer_id,
        answer: row.answer,
        is_star: normalizeBoolean(row.is_star),
        sort_order: row.answer_sort_order,
      })
    }
  })
  return [...map.values()]
}

async function getSurvey(req) {
  const jobId = getQueryValue(req.query?.job || req.query?.job_id, '')
  const type = getQueryValue(req.query?.type, 'video') === 'image' ? 'image' : 'video'
  const job = await getJobById(jobId)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const responseRows = await query(
    `select count(*) as count from ${tables.feedbackSurveyResponses} where job_id = ? and survey_type = ?`,
    [job.id, type],
  )
  return {
    job,
    type,
    already_submitted: Number(responseRows?.[0]?.count || 0) > 0,
    questions: await getSurveyQuestions(type),
  }
}

async function submitSurvey(req, body = {}) {
  const jobId = body.job || body.job_id
  const type = body.type === 'image' ? 'image' : 'video'
  const job = await getJobById(jobId)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const existingRows = await query(
    `select id from ${tables.feedbackSurveyResponses} where job_id = ? and survey_type = ? limit 1`,
    [job.id, type],
  )
  if (existingRows.length) {
    throw makeHttpError('Job này đã gửi khảo sát trước đó.', 409, 'SURVEY_ALREADY_SUBMITTED')
  }

  const answers = body.answers || {}
  const responseId = makeId('fbsr')
  try {
    await withTransaction(async connection => {
      await insertRow(connection, tables.feedbackSurveyResponses, {
        id: responseId,
        job_id: job.id,
        feedback_id: emptyToNull(body.feedback_id),
        survey_type: type,
        respondent_name: emptyToNull(body.respondent_name),
        user_agent: req.headers?.['user-agent'] || null,
      })

      for (const [questionId, answerValues] of Object.entries(answers)) {
        const values = Array.isArray(answerValues) ? answerValues : [answerValues]
        for (const answerId of values.filter(value => value !== undefined && value !== null && value !== '')) {
          await insertRow(connection, tables.feedbackSurveyResponseAnswers, {
            id: makeId('fbsra'),
            response_id: responseId,
            question_id: questionId,
            answer_id: String(answerId),
            answer_text: null,
          })
        }
      }
    })
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      throw makeHttpError('Job này đã gửi khảo sát trước đó.', 409, 'SURVEY_ALREADY_SUBMITTED')
    }
    throw error
  }

  notifySurveySubmitted(job, answers).catch(() => {})
  return { ok: true, response_id: responseId }
}

async function notifySurveySubmitted(job, answers = {}) {
  const baseUrl = String(process.env.NHANSU_URL || '').replace(/\/+$/, '')
  if (!baseUrl) return

  const recipients = await query(`select id from ${tables.employees} where is_bod = 1`).catch(() => [])
  const needToSend = recipients.map(row => row.id).filter(Boolean)
  if (!needToSend.length) return

  await fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 5,
      need_to_send: needToSend,
      title: 'Eventus Customer Satisfaction Survey',
      content: `Thông báo CSS mới từ job ${job.job_date || ''} ${job.title || job.id}.\n\nTên khách hàng: ${job.customer_name || '-'}\n\nSố câu trả lời: ${Object.keys(answers).length}`,
    }),
  }).catch(() => {})
}

async function getGallery(req) {
  const zaloId = getQueryValue(req.query?.zalo_id || req.query?.zalo, '')
  const job = await getJobByZaloId(zaloId)
  if (!job?.id) throw makeHttpError('Không tìm thấy gallery.', 404, 'GALLERY_NOT_FOUND')
  return {
    job,
    drive_link: job.gallery_drive || job.drive_feedback || '',
    survey_link: `/survey?type=image&job=${encodeURIComponent(job.id)}`,
  }
}

async function markJobDone(req, body = {}) {
  const feedback = body.feedback_id ? await getFeedbackByIdentifier(body.feedback_id) : null
  if (feedback) await assertFeedbackAccess(req, feedback, parseAccess(body))
  return { ok: true }
}

function isPublicRequest(req) {
  if (req.method === 'GET') {
    const resource = getQueryValue(req.query?.resource, '')
    if (resource === 'survey' || resource === 'gallery') return true
    if (resource === 'feedback') {
      const id = getQueryValue(req.query?.id, '')
      const access = parseAccess({}, req.query || {})
      return Boolean(id && (access.zalo || access.token))
    }
    return false
  }

  if (req.method === 'POST') {
    const body = getRequestBody(req)
    const action = body.action || body.resource
    return [
      'lookup_job',
      'save_feedback_setup',
      'create_feedback',
      'create_comment',
      'update_comment',
      'delete_comment',
      'upload_attachment',
      'delete_attachment',
      'toggle_more_column',
      'overall_feedback',
      'feedback_done',
      'clear_column',
      'job_done',
      'submit_survey',
    ].includes(action)
  }

  return false
}

export default async function handler(req, res) {
  try {
    if (!isPublicRequest(req) && !await requireEventusAuth(req, res)) return

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'feedbacks')

      if (resource === 'jobs') {
        return res.status(200).json(await listFeedbackJobs({
          search: getQueryValue(req.query?.search, ''),
          page: getPositiveInteger(req.query?.page, 1),
          pageSize: getPositiveInteger(req.query?.pageSize, DEFAULT_PAGE_SIZE),
        }))
      }

      if (resource === 'feedbacks') {
        return res.status(200).json(await listFeedbacks({
          search: getQueryValue(req.query?.search, ''),
          jobId: getQueryValue(req.query?.job_id, ''),
          page: getPositiveInteger(req.query?.page, 1),
          pageSize: getPositiveInteger(req.query?.pageSize, DEFAULT_PAGE_SIZE),
        }))
      }

      if (resource === 'feedback') {
        const id = getQueryValue(req.query?.id, '')
        return res.status(200).json(await getFeedbackDetail(req, id, parseAccess({}, req.query || {})))
      }

      if (resource === 'survey') return res.status(200).json(await getSurvey(req))
      if (resource === 'gallery') return res.status(200).json(await getGallery(req))

      return res.status(400).json({ error: 'Resource không hợp lệ.' })
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      const action = body.action || body.resource

      if (action === 'lookup_job') {
        const zaloId = trimText(body.zalo_id || body.zalo || body.job, 120)
        const job = await getJobByZaloId(zaloId)
        if (!job?.id) throw makeHttpError('Mã Job không chính xác.', 404, 'JOB_NOT_FOUND')
        const feedback = await ensureFeedbackForJob(job.id)
        return res.status(200).json({ job, feedback })
      }

      if (action === 'ensure_feedback') {
        const feedback = await ensureFeedbackForJob(body.job_id)
        return res.status(200).json({ feedback })
      }

      if (action === 'create_feedback') {
        const current = body.feedback_id ? await getFeedbackByIdentifier(body.feedback_id) : null
        if (current) await assertFeedbackAccess(req, current, parseAccess(body))
        if (!current && !req.eventusUser) req.eventusUser = await getEventusAuthUser(req)
        if (!current && !req.eventusUser) throw makeHttpError('Bạn cần đăng nhập để tạo feedback trực tiếp từ job.', 401, 'AUTH_REQUIRED')
        const feedback = await createFeedback(body.job_id || current?.job_id, body.feedback || body)
        return res.status(201).json({ feedback })
      }

      if (action === 'save_feedback_setup') return res.status(200).json(await saveFeedbackSetup(req, body))
      if (action === 'create_comment') return res.status(201).json(await createFeedbackComment(req, body))
      if (action === 'update_comment') return res.status(200).json(await updateFeedbackComment(req, body))
      if (action === 'delete_comment') return res.status(200).json(await deleteFeedbackComment(req, body))
      if (action === 'upload_attachment') return res.status(200).json(await saveAttachment(req, body))
      if (action === 'delete_attachment') return res.status(200).json(await deleteAttachment(req, body))
      if (action === 'toggle_more_column') return res.status(200).json(await toggleMoreColumn(req, body))
      if (action === 'overall_feedback') return res.status(200).json(await updateOverallFeedback(req, body))
      if (action === 'feedback_done') return res.status(200).json(await markFeedbackDone(req, body))
      if (action === 'clear_column') return res.status(200).json(await clearColumn(req, body))
      if (action === 'job_done') return res.status(200).json(await markJobDone(req, body))
      if (action === 'submit_survey') return res.status(201).json(await submitSurvey(req, body))

      return res.status(400).json({ error: 'Action không hợp lệ.' })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
