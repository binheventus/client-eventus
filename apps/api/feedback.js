import { randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
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
import { loadServerEnv } from './lib/server-env.js'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')
const webRoot = path.join(projectRoot, 'apps/web')
const publicRoot = path.join(webRoot, 'public')
const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const SHARE_TOKEN_LENGTH = 14
const SHARE_TOKEN_PUBLIC_PATTERN = /^[A-Z2-9]{12,40}$/
const JOB_PUBLIC_TOKEN_LENGTH = 18
const PUBLIC_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const PUBLIC_CODE_LENGTH = 4
const DEFAULT_PAGE_SIZE = 20
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const SURVEY_DOUBLE_SUBMIT_WINDOW_SECONDS = 15
const DEFAULT_RCLONE_REMOTE = 'eventus'
const DEFAULT_RCLONE_FEEDBACK_DIR = 'feedback'
const DEFAULT_NHANSU_URL = 'https://lichlamviec.eventusproduction.com'
const FEEDBACK_NOTIFICATION_ADMIN_PHONE = '0972554172'
const CSS_SINCE_062026_VERSION_NAME = 'CSS Since 06.2026'
const CSS_SURVEY_COPY = {
  title: 'Chia sẻ trải nghiệm của Anh/Chị cùng Eventus',
  description: 'Cảm ơn anh/chị đã tin tưởng lựa chọn Eventus. Khảo sát này chỉ mất khoảng 2 phút để hoàn\u00a0thành. Những chia sẻ của anh/chị sẽ giúp chúng tôi tiếp tục nâng cao chất lượng dịch vụ và mang đến trải nghiệm tốt hơn trong các dự án sắp tới.',
  thank_you: 'Cảm ơn anh/chị đã chia sẻ ý kiến\n\nMỗi phản hồi đều là nguồn thông tin quý giá giúp Eventus Production tiếp tục\nhoàn thiện chất lượng dịch vụ và mang đến những trải nghiệm tốt hơn.\n\nChúng tôi trân trọng sự đồng hành và tin tưởng của anh/chị.\nHẹn gặp lại trong những dự án tiếp theo!',
}
const DEFAULT_SURVEY_COPY = {
  title: 'Form khảo sát sự hài lòng',
  description: 'Hãy để cho chúng tôi biết nhiều hơn về bạn!',
  thank_you: 'Eventus thực sự biết ơn bạn vì đã chọn chúng tôi làm nhà cung cấp dịch vụ và cho chúng tôi cơ hội phát triển. Ý kiến đóng góp của bạn rất có giá trị và quan trọng đối với chúng tôi. Những thông tin bạn đã cung cấp sẽ giúp Eventus tiếp tục phát triển và hoàn thiện hơn nữa.',
}
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
const CLONED_COMMENT_COLUMNS = [
  'comment_1',
  'image_comment_1',
  'author_name',
  'reply_1',
  'image_reply_1',
  'time_comment_1',
  'time_reply_1',
  'comment_2',
  'image_comment_2',
  'reply_2',
  'image_reply_2',
  'time_comment_2',
  'time_reply_2',
]
const CLONED_ATTACHMENT_COLUMNS = [
  'file_name',
  'url',
  'storage_path',
  'preview_url',
  'field_name',
  'file_type',
  'delete_at',
]

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

function makeReadableToken(length = SHARE_TOKEN_LENGTH) {
  return Array.from(randomBytes(length), value => (
    SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]
  )).join('')
}

function isFeedbackShareToken(value = '') {
  return SHARE_TOKEN_PUBLIC_PATTERN.test(String(value || '').trim())
}

function makePublicCode(length = PUBLIC_CODE_LENGTH) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = Array.from(randomBytes(length), value => (
      PUBLIC_CODE_ALPHABET[value % PUBLIC_CODE_ALPHABET.length]
    )).join('')
    if (/[a-z]/.test(code)) return code
  }
  throw new Error('Khong tao duoc ma feedback ngan.')
}

async function makeUniquePublicCode() {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = makePublicCode()
    const rows = await query(`select 1 from ${tables.feedbacks} where public_code = ? limit 1`, [code])
    if (!rows.length) return code
  }
  throw makeHttpError('Không tạo được mã feedback ngắn.', 500, 'PUBLIC_CODE_UNAVAILABLE')
}

async function makeUniqueShareToken() {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const token = makeReadableToken()
    const rows = await query(`select 1 from ${tables.feedbacks} where share_token = ? limit 1`, [token])
    if (!rows.length) return token
  }
  throw makeHttpError('Không tạo được mã chia sẻ feedback.', 500, 'SHARE_TOKEN_UNAVAILABLE')
}

async function makeUniqueJobPublicToken() {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const token = makeReadableToken(JOB_PUBLIC_TOKEN_LENGTH)
    const rows = await query(`select 1 from ${tables.jobs} where public_token = ? limit 1`, [token])
    if (!rows.length) return token
  }
  throw makeHttpError('Không tạo được mã public cho job.', 500, 'JOB_PUBLIC_TOKEN_UNAVAILABLE')
}

function isPublicCodeDuplicate(error) {
  return (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062)
    && String(error?.sqlMessage || error?.message || '').includes('public_code')
}

function isShareTokenDuplicate(error) {
  return (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062)
    && String(error?.sqlMessage || error?.message || '').includes('share_token')
}

function isPublicTokenDuplicate(error) {
  return (error?.code === 'ER_DUP_ENTRY' || error?.errno === 1062)
    && String(error?.sqlMessage || error?.message || '').includes('public_token')
}

function getFeedbackPublicPath(feedback = {}) {
  const identifier = feedback.share_token
  if (!identifier) return '/feedbacks'
  return `/feedbacks/${encodeURIComponent(identifier)}`
}

function getSurveyPublicPath(job = {}) {
  const identifier = job.public_token || job.id
  if (!identifier) return '/survey'
  return `/survey?job=${encodeURIComponent(identifier)}`
}

export function buildFeedbackOpenGraphText(feedback = {}) {
  const title = trimText(
    feedback.job?.title || feedback.video_title || feedback.name || 'Eventus Feedback',
    255,
  )

  return {
    title,
    description: trimText(feedback.name, 255) || 'Feedback',
  }
}

export function buildDefaultFeedbackName(sequence = 1) {
  const safeSequence = Math.max(1, Math.floor(Number(sequence) || 1))
  return `Feedback #${safeSequence}`
}

function stripFeedbackDateSuffix(value = '') {
  return String(value || '').trim().replace(/\s+\d{1,2}[\s./-]+\d{1,2}(?:[\s./-]+\d{2,4})?$/, '').trim()
}

function sanitizeFeedbackName(value = '') {
  return trimText(stripFeedbackDateSuffix(value), 255)
}

function getSurveyType(value = 'video') {
  return 'general'
}

export function buildSurveyResponseName(type = 'general', submissionNo = 1) {
  const safeNo = Math.max(1, Math.floor(Number(submissionNo) || 1))
  return `Khảo sát #${safeNo}`
}

function trimText(value = '', maxLength = 500) {
  const text = String(value || '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function normalizePhone(value = '') {
  return String(value || '').replace(/\D+/g, '')
}

function normalizeVietnamPhone(value = '') {
  const digits = normalizePhone(value)
  if (digits.startsWith('84') && digits.length >= 10) return `0${digits.slice(2)}`
  return digits
}

function getEmployeePhoneLookupValues(value = '') {
  const raw = String(value || '').trim()
  const digits = normalizePhone(raw)
  const localDigits = normalizeVietnamPhone(raw)
  const internationalDigits = localDigits.startsWith('0') ? `84${localDigits.slice(1)}` : ''
  return [...new Set([
    raw,
    digits,
    localDigits,
    internationalDigits,
  ].filter(Boolean))]
}

function getFeedbackNotificationEditorPhone(feedback = {}) {
  return trimText(feedback.job?.editor_phone || feedback.editor_phone, 80)
}

function getFeedbackDoneName(feedback = {}) {
  const name = trimText(feedback.name, 255) || 'Feedback'
  return name.toLowerCase().includes('feedback') ? name : `Feedback ${name}`
}

function buildFeedbackDoneNotificationPayload(feedback = {}, recipients = []) {
  const feedbackName = getFeedbackDoneName(feedback)
  const jobTitle = feedback.job?.title || feedback.job?.job_title || feedback.job_id || ''
  return {
    type: 1,
    need_to_send: recipients,
    title: 'Khách đã hoàn thành Feedback!',
    content: `Khách hàng đã hoàn thành ${feedbackName} của job ${jobTitle}.\nBạn hãy check và confirm thời gian gửi bản tiếp theo cho khách nhé.`,
  }
}

function getNhansuBaseUrl() {
  loadServerEnv()
  const baseUrl = [
    process.env.NHANSU_URL,
    process.env.EVENTUS_AUTH_BASE_URL,
    DEFAULT_NHANSU_URL,
  ].map(value => String(value || '').trim()).find(Boolean) || ''
  return baseUrl.replace(/\/+$/, '')
}

function getAuthUserRole(user = {}) {
  return String(user.role || user.user_role || user.permission || '').toLowerCase()
}

function isFeedbackAdminUser(user = {}) {
  const role = getAuthUserRole(user)
  return role === 'admin' || role === 'administrator' || role === 'super_admin' || user.is_admin || user.is_bod
}

function getAuthUserIds(user = {}) {
  return [
    user.id,
    user.user_id,
    user.employee_id,
    user.employee?.id,
    user.staff_id,
    user.nhansu_id,
  ].map(value => String(value || '').trim()).filter(Boolean)
}

function getAuthUserPhones(user = {}) {
  return [
    user.phone,
    user.phone_number,
    user.mobile,
    user.zalo_phone,
    user.employee?.phone,
  ].map(normalizePhone).filter(Boolean)
}

function userMatchesFeedbackEditor(user = {}, feedback = {}) {
  const editorId = String(feedback.editor_employee_id || '').trim()
  if (editorId && getAuthUserIds(user).includes(editorId)) return true

  const editorPhone = normalizePhone(feedback.editor_phone || feedback.job?.editor_phone)
  if (editorPhone && getAuthUserPhones(user).includes(editorPhone)) return true

  return false
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
  const job = normalizeJobRow(row.job || {
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
  })

  return {
    ...row,
    editor_name: row.editor_name || job?.editor_name || '',
    editor_phone: row.editor_phone || job?.editor_phone || '',
    overall_feedback: normalizeOverallFeedback(row.overall_feedback),
    more_column: normalizeBoolean(row.more_column),
    done_feedback: normalizeBoolean(row.done_feedback),
    job,
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

function pickColumns(row = {}, columns = []) {
  return columns.reduce((payload, column) => {
    payload[column] = row[column] ?? null
    return payload
  }, {})
}

function summarizeFeedbackCloneSource(feedback = null) {
  if (!feedback?.id) return null
  return {
    id: feedback.id,
    share_token: feedback.share_token || null,
    public_code: feedback.public_code || null,
    name: feedback.name || null,
    created_at: feedback.created_at || null,
  }
}

function normalizeJobRow(row = {}) {
  if (!row) return null
  return {
    ...row,
    id: row.id,
    public_token: row.public_token || row.job_public_token || '',
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

function normalizeSurveyResponseRow(row = {}) {
  if (!row) return null
  const submissionNo = Math.max(1, Math.floor(Number(row.submission_no) || 1))
  const surveyType = getSurveyType(row.survey_type)
  return {
    id: row.id,
    job_id: row.job_id,
    feedback_id: row.feedback_id || null,
    survey_type: surveyType,
    submission_no: submissionNo,
    display_name: buildSurveyResponseName(surveyType, submissionNo),
    respondent_name: row.respondent_name || '',
    created_at: row.created_at,
    answer_count: Number(row.answer_count || 0),
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
    j.public_token as job_public_token,
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

async function getJobByPublicToken(token) {
  if (!token) return null
  const rows = await query(`select * from ${tables.jobs} where public_token = ? limit 1`, [token])
  return normalizeJobRow(rows?.[0])
}

async function getJobBySurveyIdentifier(identifier) {
  const value = trimText(identifier, 80)
  if (!value) return null
  const byToken = SHARE_TOKEN_PUBLIC_PATTERN.test(value) ? await getJobByPublicToken(value) : null
  if (byToken?.id) return byToken
  if (/^\d+$/.test(value)) return getJobById(value)
  return null
}

async function ensureJobPublicToken(job = null) {
  if (!job?.id || job.public_token) return job

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicToken = await makeUniqueJobPublicToken()
    try {
      const result = await query(
        `update ${tables.jobs}
         set public_token = ?
         where id = ? and (public_token is null or public_token = '')`,
        [publicToken, job.id],
      )
      if (!result?.affectedRows) return getJobById(job.id)
      return {
        ...job,
        public_token: publicToken,
      }
    } catch (error) {
      if (!isPublicTokenDuplicate(error) || attempt === 7) throw error
    }
  }

  return getJobById(job.id)
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
      latest.public_code as feedback_public_code,
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
      feedback_public_code: row.feedback_public_code || null,
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
    where.push('(f.name like ? or f.public_code like ? or f.video_title like ? or j.job_title like ? or j.customer_name like ? or j.zalo_id like ?)')
    params.push(like, like, like, like, like, like)
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
     where (f.id = ? or f.legacy_id = ? or f.public_code = ? or f.share_token = ?) and f.deleted_at is null
     limit 1`,
    [identifier, Number(identifier) || 0, identifier, identifier],
  )
  return normalizeFeedbackRow(rows?.[0])
}

async function getFeedbackByShareToken(shareToken) {
  if (!shareToken) return null
  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     where f.share_token = ? and f.deleted_at is null
     limit 1`,
    [shareToken],
  )
  return normalizeFeedbackRow(rows?.[0])
}

async function getLatestFeedbackForJob(jobId) {
  if (!jobId) return null
  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     where f.job_id = ? and f.deleted_at is null
     order by f.created_at desc, f.id desc
     limit 1`,
    [jobId],
  )
  return normalizeFeedbackRow(rows?.[0])
}

async function countUnresolvedFeedbackComments(feedbackId) {
  if (!feedbackId) return 0
  const rows = await query(
    `select count(*) as count
     from ${tables.feedbackComments}
     where feedback_id = ? and coalesce(is_done_1, 0) = 0`,
    [feedbackId],
  )
  return Number(rows?.[0]?.count || 0)
}

async function getFeedbackCloneSuggestion(jobId) {
  const sourceFeedback = await getLatestFeedbackForJob(jobId)
  const unresolvedCount = sourceFeedback?.id ? await countUnresolvedFeedbackComments(sourceFeedback.id) : 0
  return {
    source_feedback: summarizeFeedbackCloneSource(sourceFeedback),
    unresolved_count: unresolvedCount,
  }
}

async function resolveFeedbackCloneSource(jobId, sourceIdentifier = '') {
  const requestedSource = trimText(sourceIdentifier, 80)
  const sourceFeedback = requestedSource
    ? await getFeedbackByIdentifier(requestedSource)
    : await getLatestFeedbackForJob(jobId)

  if (!sourceFeedback?.id) return null
  if (String(sourceFeedback.job_id) !== String(jobId)) {
    throw makeHttpError('Bản feedback nguồn không cùng job.', 400, 'FEEDBACK_CLONE_SOURCE_INVALID')
  }
  return sourceFeedback
}

export async function getPublicFeedbackOpenGraphData(identifier) {
  const shareToken = trimText(identifier, 80)
  if (!isFeedbackShareToken(shareToken)) return null

  const feedback = await getFeedbackByShareToken(shareToken)
  if (!feedback?.id) return null

  return {
    ...buildFeedbackOpenGraphText(feedback),
    image: feedback.video_preview_url || '',
    path: getFeedbackPublicPath(feedback),
  }
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

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = makeId('fb')
    try {
      await query(
        `insert into ${tables.feedbacks}
           (id, public_code, job_id, share_token, name, drive_url, editor_name, editor_phone, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
        [
          id,
          await makeUniquePublicCode(),
          job.id,
          await makeUniqueShareToken(),
          sanitizeFeedbackName(patch.name) || buildDefaultFeedbackName(1),
          patch.drive_url || null,
          patch.editor_name || job.editor_name || null,
          patch.editor_phone || job.editor_phone || null,
        ],
      )
      return getFeedbackByIdentifier(id)
    } catch (error) {
      if ((!isPublicCodeDuplicate(error) && !isShareTokenDuplicate(error)) || attempt === 7) throw error
    }
  }

  throw makeHttpError('Không tạo được feedback.', 500, 'FEEDBACK_CREATE_FAILED')
}

async function createFeedback(jobId, payload = {}) {
  const job = await getJobById(jobId)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const rows = await query(`select count(*) as count from ${tables.feedbacks} where job_id = ? and deleted_at is null`, [job.id])
  const count = Number(rows?.[0]?.count || 0)
  const cloneSource = normalizeBoolean(payload.clone_unresolved_feedbacks)
    ? await resolveFeedbackCloneSource(job.id, payload.clone_unresolved_from_feedback_id || payload.clone_source_feedback_id)
    : null

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = makeId('fb')
    const shareToken = await makeUniqueShareToken()
    let clonedUnresolvedCount = 0
    try {
      const publicCode = await makeUniquePublicCode()
      await withTransaction(async connection => {
        await connection.query(
          `insert into ${tables.feedbacks}
             (id, public_code, job_id, share_token, name, video_url, video_title, direct_video_url, drive_url,
              editor_employee_id, editor_name, editor_phone, started_at, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
          [
            id,
            publicCode,
            job.id,
            shareToken,
            sanitizeFeedbackName(payload.name) || buildDefaultFeedbackName(count + 1),
            emptyToNull(payload.video_url),
            emptyToNull(payload.video_title),
            emptyToNull(payload.direct_video_url),
            emptyToNull(payload.drive_url),
            emptyToNull(payload.editor_employee_id),
            emptyToNull(payload.editor_name || job.editor_name),
            emptyToNull(payload.editor_phone || job.editor_phone),
            payload.video_url ? nowMysql() : null,
          ],
        )

        if (cloneSource?.id) {
          clonedUnresolvedCount = await cloneUnresolvedFeedbackComments(connection, cloneSource.id, id)
        }
      })
      const feedback = await getFeedbackByIdentifier(id)
      return {
        ...feedback,
        cloned_unresolved_count: clonedUnresolvedCount,
        cloned_unresolved_from_feedback_id: cloneSource?.id || null,
      }
    } catch (error) {
      if ((!isPublicCodeDuplicate(error) && !isShareTokenDuplicate(error)) || attempt === 7) throw error
    }
  }

  throw makeHttpError('Không tạo được feedback.', 500, 'FEEDBACK_CREATE_FAILED')
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

async function cloneUnresolvedFeedbackComments(connection, sourceFeedbackId, targetFeedbackId) {
  if (!sourceFeedbackId || !targetFeedbackId) return 0

  const [sourceComments] = await connection.query(
    `select *
     from ${tables.feedbackComments}
     where feedback_id = ? and coalesce(is_done_1, 0) = 0
     order by coalesce(time_comment_1, time_comment_2, 999999), created_at asc`,
    [sourceFeedbackId],
  )
  if (!sourceComments.length) return 0

  const sourceCommentIds = sourceComments.map(comment => comment.id)
  const placeholders = sourceCommentIds.map(() => '?').join(', ')
  const [sourceAttachments] = await connection.query(
    `select *
     from ${tables.feedbackAttachments}
     where comment_id in (${placeholders})
     order by created_at asc`,
    sourceCommentIds,
  )
  const attachmentMap = sourceAttachments.reduce((map, attachment) => {
    if (!map.has(attachment.comment_id)) map.set(attachment.comment_id, [])
    map.get(attachment.comment_id).push(attachment)
    return map
  }, new Map())

  for (const sourceComment of sourceComments) {
    const nextCommentId = makeId('fbc')
    await insertRow(connection, tables.feedbackComments, {
      id: nextCommentId,
      feedback_id: targetFeedbackId,
      ...pickColumns(sourceComment, CLONED_COMMENT_COLUMNS),
      is_done_1: 0,
      is_done_2: 0,
    })

    for (const sourceAttachment of attachmentMap.get(sourceComment.id) || []) {
      await insertRow(connection, tables.feedbackAttachments, {
        id: makeId('fba'),
        comment_id: nextCommentId,
        ...pickColumns(sourceAttachment, CLONED_ATTACHMENT_COLUMNS),
      })
    }
  }

  return sourceComments.length
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

async function getAuthenticatedFeedbackUser(req) {
  if (req.eventusUser) return req.eventusUser
  const user = await getEventusAuthUser(req)
  if (user) req.eventusUser = user
  return user
}

async function assertFeedbackEditorAccess(req, feedback) {
  if (!feedback?.id) throw makeHttpError('Không tìm thấy feedback.', 404, 'FEEDBACK_NOT_FOUND')
  const user = await getAuthenticatedFeedbackUser(req)
  if (user && (isFeedbackAdminUser(user) || userMatchesFeedbackEditor(user, feedback))) return user
  throw makeHttpError('Chỉ Editor phụ trách feedback này mới có quyền xóa bản feedback.', 403, 'FEEDBACK_EDITOR_REQUIRED')
}

async function getFeedbackPermissions(req, feedback) {
  return {
    can_rename_feedback: true,
    can_delete_feedback: true,
  }
}

async function getFeedbackDetail(req, identifier, access = {}) {
  const feedback = await getFeedbackByIdentifier(identifier)
  const detailAccess = feedback?.share_token && String(identifier || '') === String(feedback.share_token)
    ? { ...access, token: access.token || feedback.share_token }
    : access
  await assertFeedbackAccess(req, feedback, detailAccess)
  feedback.job = await ensureJobPublicToken(feedback.job)

  const [comments, feedbacks, employees, surveyResponses, cloneSuggestion] = await Promise.all([
    getFeedbackComments(feedback.id),
    listFeedbacksForJob(feedback.job_id),
    listJobEmployees(feedback.job_id),
    listSurveyResponsesForJob(feedback.job_id),
    getFeedbackCloneSuggestion(feedback.job_id),
  ])

  return {
    feedback,
    comments,
    feedbacks,
    employees,
    survey_responses: surveyResponses,
    clone_suggestion: cloneSuggestion,
    permissions: await getFeedbackPermissions(req, feedback),
    public_url: getFeedbackPublicPath(feedback),
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
  const configuredBinary = String(process.env.RCLONE_BIN || '').trim()
  const defaultBinary = [
    '/usr/bin/rclone',
    '/usr/local/bin/rclone',
    '/snap/bin/rclone',
  ].find(binaryPath => fs.existsSync(binaryPath)) || 'rclone'

  return {
    binary: configuredBinary || defaultBinary,
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
  const remotePath = `${remote}:/${baseDir}/feedback-${getFeedbackStorageKey(feedback)}/${fileName}`

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
    name: patch.name === undefined ? undefined : emptyToNull(sanitizeFeedbackName(patch.name)),
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
    author_name: emptyToNull(trimText(body.author_name || body.feedback_author_name, 255)),
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
  if (type === 'replace') current.splice(0, current.length, trimText(body.value, 2000))
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

async function deleteFeedback(req, body = {}) {
  const feedback = await getFeedbackByIdentifier(body.id || body.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  await query(
    `update ${tables.feedbacks}
     set deleted_at = current_timestamp(3), status = 'deleted', updated_at = current_timestamp(3)
     where id = ? and deleted_at is null`,
    [feedback.id],
  )

  const rows = await query(
    `select ${getFeedbackListSelect()}
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     where f.job_id = ? and f.deleted_at is null
     order by f.created_at desc
     limit 1`,
    [feedback.job_id],
  )
  const nextFeedback = normalizeFeedbackRow(rows?.[0])

  return {
    ok: true,
    feedback: nextFeedback,
    public_url: nextFeedback ? getFeedbackPublicPath(nextFeedback) : '/feedbacks',
  }
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
  const notification = await notifyFeedbackDone(feedback)
  const detail = await getFeedbackDetail(req, feedback.id, parseAccess(body))
  return { ...detail, notification }
}

async function findEmployeeIdByPhone(phone) {
  const lookupValues = getEmployeePhoneLookupValues(phone)
  if (!lookupValues.length) return null

  const placeholders = lookupValues.map(() => '?').join(', ')
  const exactRows = await query(
    `select id, phone from ${tables.employees} where phone in (${placeholders}) limit 1`,
    lookupValues,
  )
  if (exactRows?.[0]?.id) return exactRows[0].id

  const normalizedPhone = normalizeVietnamPhone(phone)
  if (!normalizedPhone) return null

  const rows = await query(`select id, phone from ${tables.employees} where phone is not null`)
  return rows.find(row => normalizeVietnamPhone(row.phone) === normalizedPhone)?.id || null
}

async function notifyFeedbackDone(feedback) {
  const baseUrl = getNhansuBaseUrl()
  if (!baseUrl) throw makeHttpError('Chưa cấu hình NHANSU_URL để gửi thông báo tới Editor.', 500, 'NHANSU_URL_MISSING')

  const editorEmployeeId = await findEmployeeIdByPhone(getFeedbackNotificationEditorPhone(feedback)) || feedback.editor_employee_id
  if (!editorEmployeeId) {
    throw makeHttpError('Không tìm thấy Editor trong danh sách nhân sự để gửi thông báo.', 422, 'FEEDBACK_EDITOR_NOT_FOUND')
  }

  const adminEmployeeId = await findEmployeeIdByPhone(FEEDBACK_NOTIFICATION_ADMIN_PHONE)
  const recipients = [...new Set([editorEmployeeId, adminEmployeeId].filter(Boolean))]

  let response
  try {
    response = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFeedbackDoneNotificationPayload(feedback, recipients)),
    })
  } catch (error) {
    throw makeHttpError(
      `Không kết nối được Nhân sự API để gửi thông báo tới Editor: ${error?.message || 'request failed'}.`,
      502,
      'FEEDBACK_NOTIFICATION_FAILED',
    )
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw makeHttpError(
      `Không gửi được thông báo tới Editor qua Nhân sự API${text ? `: ${trimText(text, 160)}` : '.'}`,
      502,
      'FEEDBACK_NOTIFICATION_FAILED',
    )
  }

  return { sent: true, recipients }
}

function normalizeSurveyQuestionRows(rows = [], type = 'video') {
  const map = new Map()
  rows.forEach(row => {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        question: row.question,
        type: row.type || type,
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

function getSurveyCopy(version = null) {
  if (version?.name === CSS_SINCE_062026_VERSION_NAME) return CSS_SURVEY_COPY
  return DEFAULT_SURVEY_COPY
}

async function getActiveSurveyVersion() {
  const rows = await query(
    `select *
     from ${tables.surveyVersions}
     order by case when status = 'active' then 0 else 1 end, id desc
     limit 1`,
  )
  return rows?.[0] || null
}

async function getActiveSurveyQuestions(type = 'video') {
  try {
    const version = await getActiveSurveyVersion()
    if (!version?.id) return { version: null, questions: [] }

    const rows = await query(
      `select q.*, a.id as answer_id, a.answer, a.is_star, a.sort_order as answer_sort_order
       from ${tables.surveyQuestions} q
       left join ${tables.surveyAnswers} a on a.question_id = q.id
       where q.survey_version_id = ?
       order by q.sort_order asc, q.id asc, a.sort_order asc, a.id asc`,
      [version.id],
    )

    return {
      version,
      questions: normalizeSurveyQuestionRows(rows, type),
    }
  } catch {
    return { version: null, questions: [] }
  }
}

async function getLegacyFeedbackSurveyQuestions(type = 'video') {
  const rows = await query(
    `select q.*, a.id as answer_id, a.answer, a.is_star, a.sort_order as answer_sort_order
     from ${tables.feedbackSurveyQuestions} q
     left join ${tables.feedbackSurveyAnswers} a on a.question_id = q.id
     where q.type = ? and q.is_active = 1
     order by q.sort_order asc, a.sort_order asc`,
    [type],
  )

  return normalizeSurveyQuestionRows(rows, type)
}

async function getSurveyQuestions(type = 'video') {
  const activeSurvey = await getActiveSurveyQuestions(type)
  if (activeSurvey.questions.length) return activeSurvey

  const fallbackType = type === 'general' ? 'video' : type
  const legacyQuestions = await getLegacyFeedbackSurveyQuestions(fallbackType)
  return {
    version: null,
    questions: legacyQuestions.length ? legacyQuestions : DEFAULT_SURVEY_QUESTIONS.filter(question => question.type === fallbackType),
  }
}

async function listSurveyResponsesForJob(jobId) {
  if (!jobId) return []

  const rows = await query(
    `select sr.*,
       sra.id as response_answer_id,
       sra.question_id,
       sra.answer_id,
       sra.answer_text,
       coalesce(q.question, lq.question, sra.question_id) as question_text,
       coalesce(q.sort_order, lq.sort_order, 999999) as question_sort_order,
       coalesce(a.answer, la.answer, '') as answer_label,
       coalesce(a.sort_order, la.sort_order, 999999) as answer_sort_order
     from ${tables.feedbackSurveyResponses} sr
     left join ${tables.feedbackSurveyResponseAnswers} sra on sra.response_id = sr.id
     left join ${tables.surveyQuestions} q on q.id = sra.question_id
     left join ${tables.feedbackSurveyQuestions} lq on lq.id = sra.question_id
     left join ${tables.surveyAnswers} a on a.id = sra.answer_id
     left join ${tables.feedbackSurveyAnswers} la on la.id = sra.answer_id
     where sr.job_id = ?
     order by sr.created_at desc, sr.submission_no desc, question_sort_order asc, sra.created_at asc, answer_sort_order asc`,
    [jobId],
  )

  const responses = new Map()
  rows.forEach(row => {
    if (!responses.has(row.id)) {
      responses.set(row.id, {
        ...normalizeSurveyResponseRow(row),
        answers: [],
      })
    }

    if (!row.response_answer_id) return
    const answerLabel = String(row.answer_label || '').trim()
    responses.get(row.id).answers.push({
      id: row.response_answer_id,
      question_id: row.question_id,
      question: row.question_text || row.question_id,
      answer_id: row.answer_id || null,
      answer: row.answer_text || (answerLabel === '__free_text__' ? '' : answerLabel),
      answer_text: row.answer_text || '',
    })
  })

  return [...responses.values()].map(response => ({
    ...response,
    answer_count: response.answers.length,
  }))
}

async function getSurvey(req) {
  const jobIdentifier = getQueryValue(req.query?.job || req.query?.job_id, '')
  const type = getSurveyType()
  const job = await getJobBySurveyIdentifier(jobIdentifier)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')
  const publicJob = await ensureJobPublicToken(job)

  const responseRows = await query(
    `select count(*) as count, coalesce(max(submission_no), 0) as max_submission_no
     from ${tables.feedbackSurveyResponses}
     where job_id = ?`,
    [publicJob.id],
  )
  const submissionCount = Number(responseRows?.[0]?.count || 0)
  const nextSubmissionNo = Number(responseRows?.[0]?.max_submission_no || 0) + 1
  const survey = await getSurveyQuestions(type)
  return {
    job: publicJob,
    type,
    already_submitted: false,
    submission_count: submissionCount,
    next_submission_no: nextSubmissionNo,
    next_display_name: buildSurveyResponseName(type, nextSubmissionNo),
    copy: getSurveyCopy(survey.version),
    survey_version: survey.version ? {
      id: survey.version.id,
      name: survey.version.name,
      status: survey.version.status,
    } : null,
    questions: survey.questions,
  }
}

async function getSurveyResponseBySubmissionKey(submissionKey) {
  if (!submissionKey) return null
  const rows = await query(
    `select * from ${tables.feedbackSurveyResponses} where submission_key = ? limit 1`,
    [submissionKey],
  )
  return normalizeSurveyResponseRow(rows?.[0])
}

async function submitSurvey(req, body = {}) {
  const jobIdentifier = body.job || body.job_id
  const type = getSurveyType()
  const job = await getJobBySurveyIdentifier(jobIdentifier)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const answers = body.answers || {}
  const freeText = body.free_text || body.freeText || {}
  const submissionKey = trimText(body.submission_key || body.submissionKey, 80)
  const userAgent = req.headers?.['user-agent'] || null
  let result = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      result = await withTransaction(async connection => {
        if (submissionKey) {
          const [existingKeyRows] = await connection.query(
            `select * from ${tables.feedbackSurveyResponses} where submission_key = ? limit 1 for update`,
            [submissionKey],
          )
          if (existingKeyRows.length) {
            return {
              response: normalizeSurveyResponseRow(existingKeyRows[0]),
              duplicate: true,
            }
          }
        } else if (userAgent) {
          const [recentRows] = await connection.query(
            `select *
             from ${tables.feedbackSurveyResponses}
             where job_id = ?
               and user_agent = ?
               and created_at >= date_sub(current_timestamp(3), interval ? second)
             order by created_at desc
             limit 1
             for update`,
            [job.id, userAgent, SURVEY_DOUBLE_SUBMIT_WINDOW_SECONDS],
          )
          if (recentRows.length) {
            return {
              response: normalizeSurveyResponseRow(recentRows[0]),
              duplicate: true,
            }
          }
        }

        const [latestRows] = await connection.query(
          `select submission_no
           from ${tables.feedbackSurveyResponses}
           where job_id = ?
           order by submission_no desc
           limit 1
           for update`,
          [job.id],
        )
        const submissionNo = Number(latestRows?.[0]?.submission_no || 0) + 1
        const responseId = makeId('fbsr')

        await insertRow(connection, tables.feedbackSurveyResponses, {
          id: responseId,
          job_id: job.id,
          feedback_id: emptyToNull(body.feedback_id),
          survey_type: type,
          submission_no: submissionNo,
          submission_key: emptyToNull(submissionKey),
          respondent_name: emptyToNull(body.respondent_name),
          user_agent: userAgent,
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

        for (const [questionId, answerTextValue] of Object.entries(freeText)) {
          const answerText = trimText(answerTextValue, 4000)
          if (!answerText) continue

          const [answerRows] = await connection.query(
            `select id from ${tables.surveyAnswers}
             where question_id = ? and answer = ? and is_star = 0
             order by sort_order asc, id asc
             limit 1`,
            [questionId, '__free_text__'],
          )
          const [legacyAnswerRows] = answerRows.length ? [[]] : await connection.query(
            `select id from ${tables.feedbackSurveyAnswers}
             where question_id = ? and answer = ? and is_star = 0
             order by sort_order asc, id asc
             limit 1`,
            [questionId, '__free_text__'],
          )
          const freeTextAnswer = answerRows?.[0] || legacyAnswerRows?.[0]

          await insertRow(connection, tables.feedbackSurveyResponseAnswers, {
            id: makeId('fbsra'),
            response_id: responseId,
            question_id: questionId,
            answer_id: emptyToNull(freeTextAnswer?.id),
            answer_text: answerText,
          })
        }

        return {
          response: normalizeSurveyResponseRow({
            id: responseId,
            job_id: job.id,
            feedback_id: emptyToNull(body.feedback_id),
            survey_type: type,
            submission_no: submissionNo,
            respondent_name: emptyToNull(body.respondent_name),
            created_at: nowMysql(),
          }),
          duplicate: false,
        }
      })
      break
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY' && submissionKey) {
        const existing = await getSurveyResponseBySubmissionKey(submissionKey)
        if (existing) {
          result = { response: existing, duplicate: true }
          break
        }
      }
      if (error?.code === 'ER_DUP_ENTRY' && attempt < 4) continue
      if (error?.code === 'ER_DUP_ENTRY') {
        throw makeHttpError('Không tạo được số lượt khảo sát mới. Anh/chị thử gửi lại sau ít giây.', 409, 'SURVEY_SUBMISSION_CONFLICT')
      }
      throw error
    }
  }

  if (!result?.response) throw makeHttpError('Không tạo được khảo sát.', 500, 'SURVEY_CREATE_FAILED')
  if (!result.duplicate) notifySurveySubmitted(job, answers, result.response).catch(() => {})
  return {
    ok: true,
    response_id: result.response.id,
    submission_no: result.response.submission_no,
    display_name: result.response.display_name,
    duplicate: Boolean(result.duplicate),
  }
}

async function notifySurveySubmitted(job, answers = {}, response = {}) {
  const baseUrl = getNhansuBaseUrl()
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
      content: `Thông báo ${response.display_name || 'CSS mới'} từ job ${job.job_date || ''} ${job.title || job.id}.\n\nTên khách hàng: ${job.customer_name || '-'}\n\nSố câu trả lời: ${Object.keys(answers).length}`,
    }),
  }).catch(() => {})
}

async function getGallery(req) {
  const shareToken = trimText(getQueryValue(req.query?.token || req.query?.share_token, ''), 80)
  const feedback = await getFeedbackByShareToken(shareToken)
  const job = feedback?.job_id ? await ensureJobPublicToken(await getJobById(feedback.job_id)) : null
  if (!job?.id) throw makeHttpError('Không tìm thấy gallery.', 404, 'GALLERY_NOT_FOUND')
  return {
    feedback,
    job,
    drive_link: job.gallery_drive || job.drive_feedback || '',
    survey_link: getSurveyPublicPath(job),
  }
}

async function markJobDone(req, body = {}) {
  const feedbackIdentifier = body.feedback_id || body.id || body.share_token || body.token
  const feedback = feedbackIdentifier ? await getFeedbackByIdentifier(feedbackIdentifier) : null
  if (feedback) {
    const access = parseAccess(body)
    if (body.share_token || body.token) access.token ||= body.share_token || body.token
    await assertFeedbackAccess(req, feedback, access)
  }
  return { ok: true }
}

export function isPublicFeedbackRequest(req) {
  if (req.method === 'GET') {
    const resource = getQueryValue(req.query?.resource, '')
    if (resource === 'survey' || resource === 'gallery') return true
    if (resource === 'feedback') {
      const id = getQueryValue(req.query?.id, '')
      return isFeedbackShareToken(id)
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
      'delete_feedback',
      'clear_column',
      'job_done',
      'submit_survey',
    ].includes(action)
  }

  return false
}

export const __feedbackTestInternals = Object.freeze({
  buildFeedbackDoneNotificationPayload,
  getEmployeePhoneLookupValues,
  getFeedbackNotificationEditorPhone,
  getNhansuBaseUrl,
  normalizeVietnamPhone,
})

export default async function handler(req, res) {
  try {
    if (!isPublicFeedbackRequest(req) && !await requireEventusAuth(req, res)) return

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
        const feedbackPayload = body.feedback || body
        const feedback = await createFeedback(body.job_id || current?.job_id, {
          ...feedbackPayload,
          clone_unresolved_feedbacks: body.clone_unresolved_feedbacks ?? body.cloneUnresolved ?? feedbackPayload.clone_unresolved_feedbacks,
          clone_unresolved_from_feedback_id: body.clone_unresolved_from_feedback_id ?? body.cloneUnresolvedFromFeedbackId ?? feedbackPayload.clone_unresolved_from_feedback_id,
        })
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
      if (action === 'delete_feedback') return res.status(200).json(await deleteFeedback(req, body))
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
