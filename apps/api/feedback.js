import { randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  buildFeedbackUploadUrl,
  ensureFeedbackUploadSubdir,
  removeFeedbackUploadFile,
  resolveFeedbackUploadPublicPath,
  isFeedbackUploadStoragePath,
} from './lib/feedback-upload-storage.js'
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
import { extractDriveFolderId, listDriveFolderPhotosDetailed } from './lib/gallery-drive.js'
import * as feedbackAi from './lib/feedback-ai-assist.js'

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
const VIDEO_REVIEW_TASKS_TABLE = 'video_review_tasks'
const JOB_TYPES_REQUIRING_FEEDBACK = [2, 3]
const MISSING_FEEDBACK_JOB_LOOKBACK_DAYS = 90
const COMPLETED_VIDEO_EMPLOYEE_STATUS_ID = 4
const VIDEO_EMPLOYEE_STATUS_LABELS = {
  1: 'Chưa làm',
  2: 'Đang làm',
  3: 'Đang feedback',
  4: 'Đã feedback',
}
const DEFAULT_FEEDBACK_IMAGE_MAX_BYTES = 3 * 1024 * 1024
const DEFAULT_FEEDBACK_IMAGE_MAX_COUNT = 4
const DEFAULT_FEEDBACK_ATTACHMENT_TTL_DAYS = 20
const SURVEY_DOUBLE_SUBMIT_WINDOW_SECONDS = 15
const DEFAULT_NHANSU_URL = 'https://nhansu.eventusproduction.com'
const DEFAULT_SURVEY_DASHBOARD_URL = 'https://lichlamviec.eventusproduction.com/admin/survey/dashboard'
const EVENTUS_AUTH_HOST = 'lichlamviec.eventusproduction.com'
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

function isMultipartRequest(req) {
  return /^multipart\/form-data/i.test(String(req.headers?.['content-type'] || ''))
}

function getMultipartBoundary(req) {
  const contentType = String(req.headers?.['content-type'] || '')
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  return match?.[1] || match?.[2] || ''
}

async function readRequestBuffer(req, maxBytes) {
  const chunks = []
  let total = 0

  for await (const chunk of req) {
    total += chunk.length
    if (total > maxBytes) throw makeHttpError('Ảnh vượt quá dung lượng cho phép.', 413, 'FEEDBACK_UPLOAD_TOO_LARGE')
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}

function parseContentDisposition(value = '') {
  return String(value || '').split(';').reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split('=')
    const key = rawKey.trim().toLowerCase()
    if (!key) return acc
    const rawValue = rest.join('=').trim().replace(/^"|"$/g, '')
    acc[key] = rawValue
    return acc
  }, {})
}

function parseMultipartBuffer(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`)
  const headerDelimiter = Buffer.from('\r\n\r\n')
  const fields = {}
  const files = {}
  let position = buffer.indexOf(delimiter)

  while (position >= 0) {
    position += delimiter.length
    const marker = buffer.slice(position, position + 2).toString('latin1')
    if (marker === '--') break
    if (marker === '\r\n') position += 2

    const headerEnd = buffer.indexOf(headerDelimiter, position)
    if (headerEnd < 0) break

    const headers = buffer.slice(position, headerEnd).toString('utf8')
      .split(/\r?\n/)
      .reduce((acc, line) => {
        const separatorIndex = line.indexOf(':')
        if (separatorIndex < 0) return acc
        acc[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim()
        return acc
      }, {})

    const dataStart = headerEnd + headerDelimiter.length
    const nextDelimiter = buffer.indexOf(delimiter, dataStart)
    if (nextDelimiter < 0) break

    let dataEnd = nextDelimiter
    if (dataEnd >= 2 && buffer[dataEnd - 2] === 13 && buffer[dataEnd - 1] === 10) dataEnd -= 2
    const data = buffer.slice(dataStart, dataEnd)
    const disposition = parseContentDisposition(headers['content-disposition'])
    const name = disposition.name

    if (name) {
      if (disposition.filename !== undefined) {
        files[name] = {
          buffer: data,
          fileName: disposition.filename || 'feedback-image',
          mimeType: headers['content-type'] || 'application/octet-stream',
        }
      } else {
        fields[name] = data.toString('utf8')
      }
    }

    position = nextDelimiter
  }

  return { fields, files }
}

async function parseMultipartRequest(req) {
  if (!isMultipartRequest(req) || req.body) return
  const boundary = getMultipartBoundary(req)
  if (!boundary) throw makeHttpError('Multipart upload thiếu boundary.', 400, 'MULTIPART_BOUNDARY_MISSING')

  const maxBytes = getFeedbackImageMaxBytes() + 512 * 1024
  const buffer = await readRequestBuffer(req, maxBytes)
  const { fields, files } = parseMultipartBuffer(buffer, boundary)
  req.body = {
    ...fields,
    file: files.image || files.file || Object.values(files)[0] || null,
  }
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function getPositiveInteger(value, fallback = 1) {
  const number = Number(getQueryValue(value))
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
}

function getPositiveEnvInteger(name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  loadServerEnv()
  const number = Number(process.env[name])
  if (!Number.isFinite(number)) return fallback
  return Math.min(max, Math.max(min, Math.floor(number)))
}

function getFeedbackImageMaxBytes() {
  return getPositiveEnvInteger('FEEDBACK_IMAGE_MAX_BYTES', DEFAULT_FEEDBACK_IMAGE_MAX_BYTES, {
    min: 128 * 1024,
    max: 20 * 1024 * 1024,
  })
}

function getFeedbackImageMaxCount() {
  return getPositiveEnvInteger('FEEDBACK_IMAGE_MAX_COUNT', DEFAULT_FEEDBACK_IMAGE_MAX_COUNT, {
    min: 1,
    max: 12,
  })
}

function getFeedbackAttachmentTtlDays() {
  return getPositiveEnvInteger('FEEDBACK_ATTACHMENT_TTL_DAYS', DEFAULT_FEEDBACK_ATTACHMENT_TTL_DAYS, {
    min: 1,
    max: 365,
  })
}

function getFeedbackAttachmentDeleteAt() {
  return new Date(Date.now() + getFeedbackAttachmentTtlDays() * 24 * 60 * 60 * 1000)
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

function getSurveyType(value = 'general') {
  const normalized = String(value || 'general').trim().toLowerCase()
  return ['general', 'image', 'video'].includes(normalized) ? normalized : 'general'
}

export function buildSurveyResponseName(type = 'general', submissionNo = 1) {
  const safeNo = Math.max(1, Math.floor(Number(submissionNo) || 1))
  return `Khảo sát #${safeNo}`
}

function trimText(value = '', maxLength = 500) {
  const text = String(value || '').trim()
  return text.length > maxLength ? text.slice(0, maxLength) : text
}

function normalizeHtmlText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|#160|#x[aA]0);/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

function getFeedbackNotificationEditorEmployeeId(feedback = {}) {
  return String(feedback.editor_employee_id || feedback.job?.editor_employee_id || '').trim()
}

function getFeedbackNotificationEditorName(feedback = {}) {
  return trimText(feedback.job?.editor_name || feedback.editor_name, 255)
}

function getFeedbackDoneName(feedback = {}) {
  const name = trimText(feedback.name, 255) || 'Feedback'
  return name.toLowerCase().includes('feedback') ? name : `Feedback ${name}`
}

function buildFeedbackDoneNotificationPayload(feedback = {}, editorEmployeeId = null) {
  const feedbackName = getFeedbackDoneName(feedback)
  const jobTitle = feedback.job?.job_title || feedback.job?.title || feedback.job_id || ''
  return {
    type: 1,
    need_to_send: [editorEmployeeId].filter(Boolean),
    title: 'Khách đã hoàn thành Feedback!',
    content: `Khách hàng đã hoàn thành ${feedbackName} của job ${jobTitle}\nBạn hãy check và confirm thời gian gửi bản tiếp theo cho khách nhé. \n`,
  }
}

function getSurveyDashboardUrl() {
  loadServerEnv()
  return trimText(process.env.SURVEY_DASHBOARD_URL || DEFAULT_SURVEY_DASHBOARD_URL, 500)
}

function escapeNotificationText(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function getSurveyAnswerDisplayText(answer = {}) {
  const freeText = trimText(answer.answer_text, 4000)
  if (freeText) return freeText

  const optionText = trimText(answer.option_answer_text, 1000)
  if (optionText && optionText !== '__free_text__') return optionText

  return ''
}

function formatSurveyAnswerBadgeText(answerText = '') {
  const text = trimText(answerText, 1000)
  const numericScore = Number(text)

  if (text && Number.isFinite(numericScore) && /^-?\d+(\.\d+)?$/.test(text)) {
    return `${Number.isInteger(numericScore) ? numericScore : text}/10`
  }

  return text || 'N/A'
}

function isSurveyAnswerBadge(answerText = '') {
  const text = trimText(answerText, 1000)
  return !text || (!text.includes('\n') && text.length <= 48)
}

function isSurveyFreeTextAnswer(answer = {}) {
  return Boolean(trimText(answer.answer_text, 4000))
}

function renderSurveyAnswerBadge(answerText = '') {
  return `<span style="display:inline-flex;align-items:center;min-height:24px;padding:3px 10px;border-radius:999px;background:#fff7ed;border:1px solid #fdba74;color:#ea580c;font-size:12px;font-weight:700;line-height:1.2;white-space:nowrap;">${escapeNotificationText(formatSurveyAnswerBadgeText(answerText))}</span>`
}

function renderSurveyTextAnswer(answerText = '') {
  return `<div style="margin-top:8px;padding:9px 10px;border-radius:8px;background:#f8fafc;color:#ea580c;font-size:13px;font-weight:700;line-height:1.5;white-space:pre-wrap;">${escapeNotificationText(answerText)}</div>`
}

function formatSurveySubmittedNotificationDetails(answerRows = []) {
  if (!Array.isArray(answerRows) || !answerRows.length) return ''

  const questionGroups = []
  const questionIndex = new Map()

  for (const answer of answerRows) {
    const questionId = String(answer.question_id || '')
    const questionText = trimText(answer.question_text, 1000) || `Câu hỏi ${questionGroups.length + 1}`
    const key = questionId || questionText

    if (!questionIndex.has(key)) {
      questionIndex.set(key, questionGroups.length)
      questionGroups.push({
        question: questionText,
        answers: [],
      })
    }

    const displayAnswer = getSurveyAnswerDisplayText(answer)
    if (displayAnswer) {
      questionGroups[questionIndex.get(key)].answers.push({
        text: displayAnswer,
        isFreeText: isSurveyFreeTextAnswer(answer),
      })
    }
  }

  if (!questionGroups.length) return ''

  const questionHtml = questionGroups.map((group, index) => {
    const answers = group.answers.length ? group.answers : [{ text: '', isFreeText: false }]
    const badgeAnswers = answers.filter(answer => !answer.isFreeText && isSurveyAnswerBadge(answer.text))
    const textAnswers = answers.filter(answer => answer.isFreeText || !isSurveyAnswerBadge(answer.text))
    const questionNumber = String(index + 1).padStart(2, '0')

    return [
      '<div style="padding:12px 0;border-top:1px solid #e2e8f0;">',
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">',
      `<div style="flex:1;min-width:0;color:#0f172a;font-size:14px;font-weight:400;line-height:1.45;">${questionNumber}.${escapeNotificationText(group.question)}</div>`,
      badgeAnswers.length ? `<div style="display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;">${badgeAnswers.map(answer => renderSurveyAnswerBadge(answer.text)).join('')}</div>` : '',
      '</div>',
      textAnswers.map(answer => renderSurveyTextAnswer(answer.text)).join(''),
      '</div>',
    ].join('')
  }).join('')

  return `<div style="margin-top:12px;">${questionHtml}</div>`
}

function buildSurveySubmittedNotificationContent({
  job = {},
  response = {},
  answerCount = 0,
  dashboardUrl = DEFAULT_SURVEY_DASHBOARD_URL,
  answerRows = [],
} = {}) {
  const jobId = job.id || response.job_id || null
  const jobTitle = trimText([job.job_date, job.title || job.job_title || jobId].filter(Boolean).join(' '), 255)
  const summary = `${response.display_name || 'Khảo sát mới'} từ job ${jobTitle || '-'}.\n\nTên khách hàng: ${job.customer_name || '-'}`
  const escapedSummary = [
    `<div style="color:#ea580c;font-size:14px;font-weight:700;line-height:1.45;">${escapeNotificationText(response.display_name || 'Khảo sát mới')} từ job ${escapeNotificationText(jobTitle || '-')}.</div>`,
    `<div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.4;">Tên khách hàng: <strong>${escapeNotificationText(job.customer_name || '-')}</strong></div>`,
  ].join('')

  return {
    summary,
    detail: `${escapedSummary}${formatSurveySubmittedNotificationDetails(answerRows)}`,
  }
}

function buildSurveySubmittedNotificationPayload({
  job = {},
  response = {},
  recipients = [],
  answerCount = 0,
  dashboardUrl = DEFAULT_SURVEY_DASHBOARD_URL,
  answerRows = [],
} = {}) {
  const jobId = job.id || response.job_id || null
  const submissionNo = Number(response.submission_no || 0) || null
  const surveyType = getSurveyType(response.survey_type)
  const notificationContent = buildSurveySubmittedNotificationContent({
    job,
    response,
    answerCount,
    dashboardUrl,
    answerRows,
  })

  return {
    type: 5,
    need_to_send: recipients.filter(Boolean),
    title: 'Khách vừa hoàn thành khảo sát CSS',
    content: notificationContent.summary,
    markdown_content: notificationContent.detail,
    target: jobId,
    data: {
      survey_response_id: response.id || null,
      job_id: jobId,
      submission_no: submissionNo,
      survey_type: surveyType,
    },
  }
}


function getBaseUrlHost(value = '') {
  const text = String(value || '').trim()
  if (!text) return ''
  try {
    return new URL(text).hostname.toLowerCase()
  } catch {
    try {
      return new URL(`https://${text}`).hostname.toLowerCase()
    } catch {
      return ''
    }
  }
}

function normalizeNhansuBaseUrl(value = '') {
  const baseUrl = String(value || '').trim().replace(/\/+$/, '')
  if (!baseUrl) return ''
  const host = getBaseUrlHost(baseUrl)
  if (host === EVENTUS_AUTH_HOST) return ''
  return /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`
}

function getNhansuBaseUrl() {
  loadServerEnv()
  return normalizeNhansuBaseUrl(process.env.BASE_NHANSU_URL)
    || normalizeNhansuBaseUrl(process.env.NHANSU_URL)
    || DEFAULT_NHANSU_URL
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
    created_at: row.job_created_at,
    drive_feedback: row.job_drive_feedback,
    gallery_drive: row.gallery_drive,
    start_feedback: row.job_start_feedback,
    end_feedback: row.job_end_feedback,
    customer_appointment_at: row.job_customer_appointment_at,
    video_employee_status_id: row.job_video_employee_status_id,
    video_employee_status_name: row.job_video_employee_status_name,
    editor_name: row.job_editor_name,
    editor_phone: row.job_editor_phone,
  })

  return {
    ...row,
    job_title: job?.job_title || '',
    drive_url: job?.drive_feedback || row.drive_url || '',
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
  const title = normalizeHtmlText(row.job_title || row.title)
  const hasCustomerAppointment = Object.prototype.hasOwnProperty.call(row, 'customer_appointment_at')
    || Object.prototype.hasOwnProperty.call(row, 'job_customer_appointment_at')
  const customerAppointmentAt = row.customer_appointment_at || row.job_customer_appointment_at || null
  const videoEmployeeStatusId = Number(row.video_employee_status_id || row.job_video_employee_status_id || 1)
  return {
    ...row,
    id: row.id,
    public_token: row.public_token || row.job_public_token || '',
    job_title: title,
    title,
    customer_name: row.customer_name || row.customer_company_name || row.company_name || '',
    job_date: row.job_date || null,
    drive_feedback: row.drive_feedback || '',
    gallery_drive: row.gallery_drive || '',
    editor_name: row.editor_name || '',
    editor_phone: row.editor_phone || '',
    start_feedback: row.start_feedback || null,
    customer_appointment_at: customerAppointmentAt,
    end_feedback: hasCustomerAppointment ? customerAppointmentAt : (row.end_feedback || null),
    video_employee_status_id: videoEmployeeStatusId,
    video_employee_status_name: row.video_employee_status_name
      || row.job_video_employee_status_name
      || VIDEO_EMPLOYEE_STATUS_LABELS[videoEmployeeStatusId]
      || VIDEO_EMPLOYEE_STATUS_LABELS[1],
  }
}

function normalizeEmployeeRow(row = {}) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name || row.full_name || '',
    phone: row.phone || '',
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
    f.editor_employee_id,
    j.job_title,
    j.customer_name,
    j.customer_id,
    j.job_date,
    j.created_at as job_created_at,
    j.public_token as job_public_token,
    j.drive_feedback as job_drive_feedback,
    j.gallery_drive,
    j.start_feedback as job_start_feedback,
    j.end_feedback as job_end_feedback,
    j.video_employee_status_id as job_video_employee_status_id,
    ves.name as job_video_employee_status_name,
    ${getCustomerAppointmentAtSql('f.editor_employee_id')} as job_customer_appointment_at,
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

async function listJobEmployees(jobId) {
  if (!jobId) return []
  try {
    const rows = await query(
      `select e.*
       from ${tables.employeeJobs} ej
       inner join ${tables.employees} e on e.id = ej.employee_id
       where ej.job_id = ?
       order by e.name asc`,
      [jobId],
    )
    return rows.map(normalizeEmployeeRow).filter(Boolean)
  } catch {
    return []
  }
}

function groupEmployeeNamesByJob(rows = []) {
  return rows.reduce((map, row) => {
    const jobId = String(row.job_id || '').trim()
    const name = trimText(row.name || row.full_name, 255)
    if (!jobId || !name) return map
    const names = map.get(jobId) || []
    if (!names.includes(name)) names.push(name)
    map.set(jobId, names)
    return map
  }, new Map())
}

async function listJobCameraCrewByJobIds(jobIds = []) {
  const ids = [...new Set(jobIds.map(id => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return new Map()

  const placeholders = ids.map(() => '?').join(', ')
  try {
    const rows = await query(
      `select distinct ej.job_id, e.name
       from ${tables.employeeJobs} ej
       inner join ${tables.employees} e on e.id = ej.employee_id
       inner join employee_skill es on es.employee_id = e.id
       inner join skills s on s.id = es.skill_id
       where ej.job_id in (${placeholders})
         and ej.status = 'accepted'
         and lower(s.name) like ?
       order by e.name asc`,
      [...ids, '%quay%'],
    )
    return groupEmployeeNamesByJob(rows)
  } catch {
    return new Map()
  }
}

async function listJobVideoReviewersByJobIds(jobIds = []) {
  const ids = [...new Set(jobIds.map(id => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return new Map()

  const placeholders = ids.map(() => '?').join(', ')
  try {
    const rows = await query(
      `select distinct vrt.job_id, coalesce(e.zalo_name, e.name) as name
       from ${VIDEO_REVIEW_TASKS_TABLE} vrt
       inner join ${tables.employees} e on e.id = vrt.reviewer_id
       where vrt.job_id in (${placeholders})
         and vrt.revoked_at is null
       order by name asc`,
      ids,
    )
    return groupEmployeeNamesByJob(rows)
  } catch {
    return new Map()
  }
}

async function attachCameraCrewToJobs(jobs = []) {
  const crewByJobId = await listJobCameraCrewByJobIds(jobs.map(job => job.id))
  return jobs.map(job => ({
    ...job,
    camera_staff_names: crewByJobId.get(String(job.id || '')) || [],
  }))
}

async function attachVideoReviewersToJobs(jobs = []) {
  const reviewersByJobId = await listJobVideoReviewersByJobIds(jobs.map(job => job.id))
  return jobs.map(job => ({
    ...job,
    video_reviewer_names: reviewersByJobId.get(String(job.id || '')) || [],
  }))
}

function addFeedbackRequiredJobTypeFilter(where = [], params = []) {
  const placeholders = JOB_TYPES_REQUIRING_FEEDBACK.map(() => '?').join(', ')
  where.push(`j.job_type in (${placeholders})`)
  params.push(...JOB_TYPES_REQUIRING_FEEDBACK)
}

function addRecentJobDateFilter(where = [], params = []) {
  where.push(`j.job_date is not null and j.job_date >= date_sub(current_date(), interval ? day)`)
  params.push(MISSING_FEEDBACK_JOB_LOOKBACK_DAYS)
}

function addIncompleteVideoJobStatusFilter(where = []) {
  where.push(`(j.video_employee_status_id is null or j.video_employee_status_id <> ${COMPLETED_VIDEO_EMPLOYEE_STATUS_ID})`)
}

function getVideoEmployeeStatusJoinSql() {
  return `left join ${tables.videoEmployeeStatuses} ves on ves.id = j.video_employee_status_id`
}

function getCustomerAppointmentAtSql(editorEmployeeIdSql = 'null') {
  return `(
    select ej.customer_appointment_at
    from ${tables.employeeJobs} ej
    left join ${tables.employees} e on e.id = ej.employee_id
    where ej.job_id = j.id
      and ej.status = 'accepted'
      and ej.customer_appointment_at is not null
    order by
      case
        when ${editorEmployeeIdSql} is not null and ej.employee_id = ${editorEmployeeIdSql} then 0
        when nullif(trim(coalesce(j.editor_name, '')), '') is not null
          and (
            lower(trim(coalesce(e.zalo_name, ''))) = lower(trim(j.editor_name))
            or lower(trim(coalesce(e.name, ''))) = lower(trim(j.editor_name))
          ) then 1
        else 2
      end asc,
      ej.customer_appointment_at asc
    limit 1
  )`
}

async function listFeedbackJobs({ search = '', page = 1, pageSize = DEFAULT_PAGE_SIZE, feedbackStatus = '' } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const params = []
  const where = ['j.deleted_at is null']

  if (search) {
    const like = `%${search}%`
    where.push('(j.job_title like ? or j.customer_name like ?)')
    params.push(like, like)
  }

  const normalizedFeedbackStatus = String(feedbackStatus || '').trim().toLowerCase()
  if (['missing', 'none', 'not_created'].includes(normalizedFeedbackStatus)) {
    where.push('latest.id is null')
    addFeedbackRequiredJobTypeFilter(where, params)
    addRecentJobDateFilter(where, params)
    addIncompleteVideoJobStatusFilter(where)
  }
  if (['exists', 'created'].includes(normalizedFeedbackStatus)) where.push('latest.id is not null')

  const latestFeedbackJoinSql = `
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
     ) latest on latest.job_id = j.id`
  const customerAppointmentAtSql = getCustomerAppointmentAtSql('latest.editor_employee_id')
  const whereSql = `where ${where.join(' and ')}`
  const countRows = await query(`select count(distinct j.id) as count from ${tables.jobs} j ${latestFeedbackJoinSql} ${whereSql}`, params)
  const rows = await query(
    `select j.*,
      latest.id as feedback_id,
      latest.public_code as feedback_public_code,
      latest.share_token as feedback_share_token,
      latest.name as feedback_name,
      latest.done_feedback as feedback_done,
      ves.name as video_employee_status_name,
      ${customerAppointmentAtSql} as customer_appointment_at
     from ${tables.jobs} j
     ${latestFeedbackJoinSql}
     ${getVideoEmployeeStatusJoinSql()}
     ${whereSql}
     order by coalesce(j.job_date, j.created_at) desc, j.id desc
     limit ? offset ?`,
    [...params, limit, offset],
  )

  const jobs = rows.map(row => ({
    ...normalizeJobRow(row),
    feedback_id: row.feedback_id || null,
    feedback_public_code: row.feedback_public_code || null,
    feedback_share_token: row.feedback_share_token || null,
    feedback_name: row.feedback_name || null,
    feedback_done: normalizeBoolean(row.feedback_done),
  }))

  return {
    jobs: await attachCameraCrewToJobs(jobs),
    page: Number(page) || 1,
    pageSize: limit,
    total: Number(countRows?.[0]?.count || 0),
  }
}

async function getFeedbackDashboardSummary({ search = '' } = {}) {
  const latestFeedbackJoinSql = `
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
     ) latest on latest.job_id = j.id`

  const jobWhere = ['j.deleted_at is null']
  const jobParams = []
  const feedbackWhere = ['f.deleted_at is null']
  const feedbackParams = []

  if (search) {
    const like = `%${search}%`
    jobWhere.push('(j.job_title like ? or j.customer_name like ?)')
    jobParams.push(like, like)
    feedbackWhere.push('(f.name like ? or f.public_code like ? or f.video_title like ? or j.job_title like ? or j.customer_name like ?)')
    feedbackParams.push(like, like, like, like, like)
  }
  addFeedbackRequiredJobTypeFilter(jobWhere, jobParams)
  addRecentJobDateFilter(jobWhere, jobParams)
  addIncompleteVideoJobStatusFilter(jobWhere)
  addFeedbackRequiredJobTypeFilter(feedbackWhere, feedbackParams)
  addIncompleteVideoJobStatusFilter(feedbackWhere)

  const missingWhereSql = `where ${[...jobWhere, 'latest.id is null'].join(' and ')}`
  const feedbackWhereSql = `where ${feedbackWhere.join(' and ')}`

  const missingRows = await query(
    `select
       count(distinct j.id) as total
     from ${tables.jobs} j
     ${latestFeedbackJoinSql}
     ${missingWhereSql}`,
    jobParams,
  )
  const feedbackRows = await query(
    `select
       count(*) as total,
       count(case when coalesce(f.done_feedback, 0) = 0 then 1 end) as open_count
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     ${feedbackWhereSql}`,
    feedbackParams,
  )

  const missing = missingRows?.[0] || {}
  const feedback = feedbackRows?.[0] || {}

  return {
    missing_feedback_jobs: {
      total: Number(missing.total || 0),
    },
    feedbacks: {
      total: Number(feedback.total || 0),
      open: Number(feedback.open_count || 0),
    },
  }
}

async function listFeedbacks({ search = '', jobId = '', page = 1, pageSize = DEFAULT_PAGE_SIZE, feedbackStatus = '' } = {}) {
  const limit = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), 100)
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit
  const params = []
  const where = ['f.deleted_at is null']

  if (jobId) {
    where.push('f.job_id = ?')
    params.push(jobId)
  }

  const normalizedFeedbackStatus = String(feedbackStatus || '').trim().toLowerCase()
  if (['open', 'active'].includes(normalizedFeedbackStatus)) {
    where.push('coalesce(f.done_feedback, 0) = 0')
    addFeedbackRequiredJobTypeFilter(where, params)
    addIncompleteVideoJobStatusFilter(where)
  }
  if (['done', 'completed'].includes(normalizedFeedbackStatus)) where.push('coalesce(f.done_feedback, 0) = 1')

  if (search) {
    const like = `%${search}%`
    where.push('(f.name like ? or f.public_code like ? or f.video_title like ? or j.job_title like ? or j.customer_name like ?)')
    params.push(like, like, like, like, like)
  }

  const whereSql = `where ${where.join(' and ')}`
  const feedbackDeadlineSql = getCustomerAppointmentAtSql('f.editor_employee_id')
  const orderSql = ['open', 'active'].includes(normalizedFeedbackStatus)
    ? `order by
        case
          when ${feedbackDeadlineSql} is not null and ${feedbackDeadlineSql} < current_timestamp(3) then 0
          when ${feedbackDeadlineSql} is not null then 1
          else 2
        end asc,
        ${feedbackDeadlineSql} asc,
        f.created_at desc`
    : 'order by f.created_at desc'
  const countRows = await query(
    `select count(*) as count
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     ${whereSql}`,
    params,
  )
  const rows = await query(
    `select ${getFeedbackListSelect()},
       coalesce(comment_stats.comment_count, 0) as comment_count,
       coalesce(comment_stats.unresolved_comment_count, 0) as unresolved_comment_count
     from ${tables.feedbacks} f
     left join ${tables.jobs} j on j.id = f.job_id
     ${getVideoEmployeeStatusJoinSql()}
     left join (
       select
         feedback_id,
         count(*) as comment_count,
         sum(case when coalesce(is_done_1, 0) = 0 then 1 else 0 end) as unresolved_comment_count
       from ${tables.feedbackComments}
       group by feedback_id
     ) comment_stats on comment_stats.feedback_id = f.id
     ${whereSql}
     ${orderSql}
     limit ? offset ?`,
    [...params, limit, offset],
  )

  const feedbacks = rows.map(normalizeFeedbackRow)
  const jobsWithCrew = await attachCameraCrewToJobs(feedbacks.map(feedback => feedback.job).filter(Boolean))
  const jobsWithReviewers = await attachVideoReviewersToJobs(jobsWithCrew)
  const crewByJobId = new Map(jobsWithCrew.map(job => [String(job.id || ''), job.camera_staff_names || []]))
  const reviewersByJobId = new Map(jobsWithReviewers.map(job => [String(job.id || ''), job.video_reviewer_names || []]))

  return {
    feedbacks: feedbacks.map(feedback => ({
      ...feedback,
      job: feedback.job
        ? {
            ...feedback.job,
            camera_staff_names: crewByJobId.get(String(feedback.job.id || '')) || [],
            video_reviewer_names: reviewersByJobId.get(String(feedback.job.id || '')) || [],
          }
        : feedback.job,
    })),
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
     ${getVideoEmployeeStatusJoinSql()}
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
     ${getVideoEmployeeStatusJoinSql()}
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
     ${getVideoEmployeeStatusJoinSql()}
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
     ${getVideoEmployeeStatusJoinSql()}
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
             (id, public_code, job_id, share_token, name, video_url, video_title, direct_video_url,
              editor_employee_id, editor_name, editor_phone, started_at, created_at, updated_at)
           values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, current_timestamp(3), current_timestamp(3))`,
          [
            id,
            publicCode,
            job.id,
            shareToken,
            sanitizeFeedbackName(payload.name) || buildDefaultFeedbackName(count + 1),
            emptyToNull(payload.video_url),
            emptyToNull(payload.video_title),
            emptyToNull(payload.direct_video_url),
            emptyToNull(payload.editor_employee_id),
            emptyToNull(payload.editor_name || job.editor_name),
            emptyToNull(payload.editor_phone || job.editor_phone),
            payload.video_url ? nowMysql() : null,
          ],
        )
        await updateRow(connection, tables.jobs, {
          drive_feedback: payload.drive_url === undefined ? undefined : emptyToNull(payload.drive_url),
        }, 'id = ?', [job.id])
        if (payload.drive_url !== undefined) {
          await updateRow(connection, tables.feedbacks, { drive_url: null }, 'job_id = ?', [job.id])
        }

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
       and (delete_at is null or delete_at > current_timestamp(3))
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
  if (token && token === feedback.share_token) return true

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

  const [comments, feedbacks, employees, cloneSuggestion] = await Promise.all([
    getFeedbackComments(feedback.id),
    listFeedbacksForJob(feedback.job_id),
    listJobEmployees(feedback.job_id),
    getFeedbackCloneSuggestion(feedback.job_id),
  ])
  const sharedDriveUrl = feedback.job?.drive_feedback
    || feedbacks.find(item => item.job?.drive_feedback)?.job?.drive_feedback
    || feedbacks.find(item => item.drive_url)?.drive_url
    || feedback.drive_url
    || ''

  if (sharedDriveUrl) {
    feedback.drive_url = sharedDriveUrl
    feedback.job.drive_feedback = sharedDriveUrl
    feedbacks.forEach(item => {
      item.drive_url = sharedDriveUrl
      if (item.job) item.job.drive_feedback = sharedDriveUrl
    })
  }

  return {
    feedback,
    comments,
    feedbacks,
    employees,
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

function getFeedbackStorageKey(feedback) {
  return sanitizeFileName(String(feedback?.legacy_id || feedback?.id || 'feedback')).replace(/\./g, '-')
}

function makeStorageSegment(value = '', fallback = 'item') {
  return sanitizeFileName(String(value || fallback)).replace(/\./g, '-')
}

function getPublicFilePath(publicUrl = '') {
  const normalized = String(publicUrl || '').replace(/^\/+/, '')
  if (!normalized) return ''
  const filePath = path.join(publicRoot, normalized)
  return filePath.startsWith(publicRoot) ? filePath : ''
}

function detectImageMime(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return ''
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  return ''
}

function getImageExtension(mimeType = '') {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[mimeType] || ''
}

function normalizeImageUpload(file = {}) {
  const buffer = Buffer.isBuffer(file.buffer) ? file.buffer : null
  if (!buffer?.length) throw makeHttpError('Ảnh upload không hợp lệ.', 400, 'FEEDBACK_IMAGE_INVALID')
  if (buffer.length > getFeedbackImageMaxBytes()) {
    throw makeHttpError(`Ảnh vượt quá dung lượng cho phép ${Math.round(getFeedbackImageMaxBytes() / 1024 / 1024)}MB.`, 400, 'FEEDBACK_IMAGE_TOO_LARGE')
  }

  const detectedMime = detectImageMime(buffer)
  const declaredMime = String(file.mimeType || '').toLowerCase()
  const mimeType = detectedMime || declaredMime
  const extension = getImageExtension(mimeType)
  if (!extension) throw makeHttpError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.', 400, 'FEEDBACK_IMAGE_TYPE_INVALID')

  return { buffer, mimeType, extension }
}

function getUploadDateSegments(date = new Date()) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return { year, month }
}

async function saveLocalFeedbackFile(buffer, feedback, comment, fileName) {
  const { year, month } = getUploadDateSegments()
  const relativeDir = [
    year,
    month,
    `feedback-${getFeedbackStorageKey(feedback)}`,
    `comment-${makeStorageSegment(comment?.id, 'comment')}`,
  ].join('/')
  const dir = await ensureFeedbackUploadSubdir(relativeDir)
  const filePath = path.join(dir, fileName)
  await fsp.writeFile(filePath, buffer)
  const relativePath = `${relativeDir}/${fileName}`
  return {
    url: buildFeedbackUploadUrl(relativePath),
    storagePath: filePath,
  }
}

async function storeFeedbackAttachmentFile(buffer, feedback, comment, fileName) {
  const local = await saveLocalFeedbackFile(buffer, feedback, comment, fileName)
  return {
    url: local.url,
    storagePath: local.storagePath,
    previewUrl: local.url,
  }
}

async function deleteStoredAttachment(attachment = {}) {
  const storagePath = String(attachment.storage_path || attachment.storagePath || '')
  if (storagePath && isFeedbackUploadStoragePath(storagePath)) {
    await removeFeedbackUploadFile(storagePath).catch(() => {})
  } else if (storagePath.startsWith(getRuntimePublicRoot())) {
    await fsp.unlink(storagePath).catch(() => {})
  }

  const previewPath = resolveFeedbackUploadPublicPath(attachment.preview_url || attachment.previewUrl)
    || getPublicFilePath(attachment.preview_url || attachment.previewUrl)
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
        editor_name: employee.name,
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
    if (patch.drive_url !== undefined) {
      await updateRow(connection, tables.feedbacks, { drive_url: null }, 'job_id = ?', [feedback.job_id])
    }
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
  const attachments = await query(`select * from ${tables.feedbackAttachments} where comment_id = ?`, [comment.id])
  await query(`delete from ${tables.feedbackComments} where id = ?`, [comment.id])
  await Promise.all(attachments.map(attachment => deleteStoredAttachment(attachment)))
  return { ok: true, comments: await getFeedbackComments(feedback.id) }
}

async function saveAttachment(req, body = {}) {
  const commentRows = await query(`select * from ${tables.feedbackComments} where id = ? limit 1`, [body.comment_id])
  const comment = commentRows?.[0]
  if (!comment) throw makeHttpError('Không tìm thấy comment.', 404, 'COMMENT_NOT_FOUND')

  const feedback = await getFeedbackByIdentifier(comment.feedback_id)
  await assertFeedbackAccess(req, feedback, parseAccess(body))

  const currentCountRows = await query(
    `select count(*) as count
     from ${tables.feedbackAttachments}
     where comment_id = ? and file_type = 'image' and (delete_at is null or delete_at > current_timestamp(3))`,
    [comment.id],
  )
  if (Number(currentCountRows?.[0]?.count || 0) >= getFeedbackImageMaxCount()) {
    throw makeHttpError(`Mỗi comment chỉ được upload tối đa ${getFeedbackImageMaxCount()} ảnh.`, 400, 'FEEDBACK_IMAGE_LIMIT_REACHED')
  }

  const upload = normalizeImageUpload(body.file)
  const fileName = `${Date.now()}-${makeReadableToken(10).toLowerCase()}.${upload.extension}`
  const attachmentId = makeId('fba')
  let storedFile = null

  try {
    storedFile = await storeFeedbackAttachmentFile(upload.buffer, feedback, comment, fileName)
    await withTransaction(async db => {
      const [lockedComments] = await db.query(
        `select id from ${tables.feedbackComments} where id = ? for update`,
        [comment.id],
      )
      if (!lockedComments?.length) throw makeHttpError('Không tìm thấy comment.', 404, 'COMMENT_NOT_FOUND')

      const [countRows] = await db.query(
        `select count(*) as count
         from ${tables.feedbackAttachments}
         where comment_id = ? and file_type = 'image' and (delete_at is null or delete_at > current_timestamp(3))`,
        [comment.id],
      )
      if (Number(countRows?.[0]?.count || 0) >= getFeedbackImageMaxCount()) {
        throw makeHttpError(`Mỗi comment chỉ được upload tối đa ${getFeedbackImageMaxCount()} ảnh.`, 400, 'FEEDBACK_IMAGE_LIMIT_REACHED')
      }

      await db.query(
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
          trimText(body.field_name || body.for_comment, 80) || 'comment_1',
          'image',
          toMysqlDateTime(getFeedbackAttachmentDeleteAt()),
        ],
      )
    })
  } catch (error) {
    if (storedFile) await deleteStoredAttachment(storedFile)
    throw error
  }

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
  await deleteStoredAttachment(attachment)
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
     ${getVideoEmployeeStatusJoinSql()}
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

async function findEmployeeIdByName(name) {
  const editorName = trimText(name, 255)
  if (!editorName) return null

  const rows = await query(
    `select id, name
     from ${tables.employees}
     where lower(trim(name)) = lower(trim(?))
     limit 1`,
    [editorName],
  )

  return rows?.[0]?.id || null
}

async function findFeedbackJobEditorEmployeeId(feedback = {}) {
  const jobId = feedback.job_id || feedback.job?.id
  if (!jobId) return null

  const rows = await query(
    `select e.id
     from ${tables.employeeJobs} ej
     inner join ${tables.employees} e on e.id = ej.employee_id
     inner join employee_skill es on es.employee_id = e.id
     inner join skills s on s.id = es.skill_id
     where ej.job_id = ?
       and ej.status = 'accepted'
       and s.name = 'Dựng'
     order by e.id asc
     limit 1`,
    [jobId],
  )

  return rows?.[0]?.id || null
}

async function findFeedbackEditorEmployeeId(feedback) {
  return getFeedbackNotificationEditorEmployeeId(feedback)
    || await findEmployeeIdByPhone(getFeedbackNotificationEditorPhone(feedback))
    || await findEmployeeIdByName(getFeedbackNotificationEditorName(feedback))
    || await findFeedbackJobEditorEmployeeId(feedback)
}

async function notifyFeedbackDone(feedback) {
  const baseUrl = getNhansuBaseUrl()
  if (!baseUrl) throw makeHttpError('Chưa cấu hình BASE_NHANSU_URL để gửi thông báo tới Editor.', 500, 'NHANSU_URL_MISSING')

  const editorEmployeeId = await findFeedbackEditorEmployeeId(feedback)
  if (!editorEmployeeId) {
    throw makeHttpError('Không tìm thấy Editor trong danh sách nhân sự để gửi thông báo.', 422, 'FEEDBACK_EDITOR_NOT_FOUND')
  }

  let response
  try {
    response = await fetch(`${baseUrl}/api/notifications/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFeedbackDoneNotificationPayload(feedback, editorEmployeeId)),
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

  return { sent: true, recipients: [editorEmployeeId] }
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

async function getSurveyQuestions(type = 'general') {
  const activeSurvey = await getActiveSurveyQuestions(type)
  if (activeSurvey.questions.length) return activeSurvey

  const fallbackType = type === 'general' ? 'video' : type
  return {
    version: null,
    questions: DEFAULT_SURVEY_QUESTIONS.filter(question => question.type === fallbackType),
  }
}

async function getSurvey(req) {
  const jobIdentifier = getQueryValue(req.query?.job || req.query?.job_id, '')
  const type = getSurveyType(req.query?.survey_type || req.query?.type)
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

function countSurveySubmittedAnswers(answers = {}, freeText = {}) {
  const choiceCount = Object.values(answers).reduce((count, value) => {
    const values = Array.isArray(value) ? value : [value]
    return count + values.filter(item => item !== undefined && item !== null && String(item).trim() !== '').length
  }, 0)
  const freeTextCount = Object.values(freeText).filter(value => trimText(value, 4000)).length
  return choiceCount + freeTextCount
}

async function getSurveyAnswerContext(connection, questionId, answerId) {
  const safeQuestionId = String(questionId || '').trim()
  const safeAnswerId = String(answerId || '').trim()
  if (!/^\d+$/.test(safeQuestionId) || !/^\d+$/.test(safeAnswerId)) return null

  const [rows] = await connection.query(
    `select
       q.id as question_id,
       q.survey_version_id,
       q.question,
       q.sort_order as question_order,
       a.id as answer_id,
       a.answer,
       a.sort_order as answer_order,
       a.is_star
     from ${tables.surveyQuestions} q
     inner join ${tables.surveyAnswers} a on a.question_id = q.id and a.id = ?
     where q.id = ?
     limit 1`,
    [safeAnswerId, safeQuestionId],
  )
  return rows?.[0] || null
}

async function getFreeTextAnswerContext(connection, questionId) {
  const safeQuestionId = String(questionId || '').trim()
  if (!/^\d+$/.test(safeQuestionId)) return null

  const [rows] = await connection.query(
    `select
       q.id as question_id,
       q.survey_version_id,
       q.question,
       q.sort_order as question_order,
       a.id as answer_id,
       a.answer,
       a.sort_order as answer_order,
       a.is_star
     from ${tables.surveyQuestions} q
     inner join ${tables.surveyAnswers} a on a.question_id = q.id
     where q.id = ? and a.answer = ? and a.is_star = 0
     order by a.sort_order asc, a.id asc
     limit 1`,
    [safeQuestionId, '__free_text__'],
  )
  if (rows?.[0]) return rows[0]

  const [questionRows] = await connection.query(
    `select id, survey_version_id, question, sort_order
     from ${tables.surveyQuestions}
     where id = ?
     limit 1`,
    [safeQuestionId],
  )
  const question = questionRows?.[0]
  if (!question) return null

  const [sortRows] = await connection.query(
    `select coalesce(max(sort_order), 0) + 1 as next_sort_order
     from ${tables.surveyAnswers}
     where question_id = ?`,
    [safeQuestionId],
  )
  const now = nowMysql()
  const [result] = await connection.query(
    `insert into ${tables.surveyAnswers}
       (question_id, answer, is_star, sort_order, created_at, updated_at)
     values (?, ?, 0, ?, ?, ?)`,
    [safeQuestionId, '__free_text__', Number(sortRows?.[0]?.next_sort_order || 1), now, now],
  )

  return {
    question_id: question.id,
    survey_version_id: question.survey_version_id,
    question: question.question,
    question_order: question.sort_order,
    answer_id: result.insertId,
    answer: '__free_text__',
    answer_order: Number(sortRows?.[0]?.next_sort_order || 1),
    is_star: 0,
  }
}

async function getSurveyResponseAnswerCount(responseId) {
  if (!responseId) return 0
  const rows = await query(
    `select count(*) as count
     from ${tables.feedbackSurveyResponseAnswers}
     where response_id = ?`,
    [responseId],
  )
  return Number(rows?.[0]?.count || 0)
}

async function getSurveyResponseAnswerDetails(responseId) {
  if (!responseId) return []

  return query(
    `select
       q.id as question_id,
       response_answers.answer_id,
       response_answers.answer_text,
       q.question as question_text,
       q.sort_order as question_order,
       answers.answer as option_answer_text,
       answers.sort_order as answer_order,
       answers.is_star
     from ${tables.surveyQuestions} q
     left join ${tables.feedbackSurveyResponseAnswers} response_answers
       on response_answers.response_id = ?
      and q.id = cast(response_answers.question_id as unsigned)
     left join ${tables.surveyAnswers} answers
       on answers.id = cast(response_answers.answer_id as unsigned)
     where q.survey_version_id = (
       select q2.survey_version_id
       from ${tables.feedbackSurveyResponseAnswers} response_answers2
       inner join ${tables.surveyQuestions} q2
         on q2.id = cast(response_answers2.question_id as unsigned)
       where response_answers2.response_id = ?
       order by q2.survey_version_id desc
       limit 1
     )
     order by
       q.sort_order asc,
       q.id asc,
       answers.sort_order asc,
       response_answers.created_at asc,
       response_answers.id asc`,
    [responseId, responseId],
  ).catch(() => [])
}

async function submitSurvey(req, body = {}) {
  const jobIdentifier = body.job || body.job_id
  const type = getSurveyType(body.survey_type || body.type)
  const job = await getJobBySurveyIdentifier(jobIdentifier)
  if (!job?.id) throw makeHttpError('Không tìm thấy job.', 404, 'JOB_NOT_FOUND')

  const answers = body.answers || {}
  const freeText = body.free_text || body.freeText || {}
  const providedSubmissionKey = trimText(body.submission_key || body.submissionKey, 80)
  const submissionKey = providedSubmissionKey || randomUUID()
  const userAgent = req.headers?.['user-agent'] || null
  let result = null

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      result = await withTransaction(async connection => {
        if (providedSubmissionKey) {
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
        const createdAt = nowMysql()

        await insertRow(connection, tables.feedbackSurveyResponses, {
          id: responseId,
          job_id: job.id,
          feedback_id: emptyToNull(body.feedback_id),
          survey_type: type,
          submission_no: submissionNo,
          submission_key: submissionKey,
          respondent_name: emptyToNull(body.respondent_name),
          user_agent: userAgent,
          created_at: createdAt,
        })

        for (const [questionId, answerValues] of Object.entries(answers)) {
          const values = Array.isArray(answerValues) ? answerValues : [answerValues]
          for (const answerId of values.filter(value => value !== undefined && value !== null && value !== '')) {
            const answerContext = await getSurveyAnswerContext(connection, questionId, answerId)
            if (!answerContext) continue

            await insertRow(connection, tables.feedbackSurveyResponseAnswers, {
              id: makeId('fbsra'),
              response_id: responseId,
              question_id: String(answerContext.question_id),
              answer_id: String(answerContext.answer_id),
              answer_text: null,
              created_at: createdAt,
            })
          }
        }

        for (const [questionId, answerTextValue] of Object.entries(freeText)) {
          const answerText = trimText(answerTextValue, 4000)
          if (!answerText) continue

          const freeTextAnswer = await getFreeTextAnswerContext(connection, questionId)
          if (!freeTextAnswer) continue

          await insertRow(connection, tables.feedbackSurveyResponseAnswers, {
            id: makeId('fbsra'),
            response_id: responseId,
            question_id: String(freeTextAnswer.question_id),
            answer_id: String(freeTextAnswer.answer_id),
            answer_text: answerText,
            created_at: createdAt,
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
            created_at: createdAt,
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

  const [answerCount, answerRows] = await Promise.all([
    getSurveyResponseAnswerCount(result.response.id),
    getSurveyResponseAnswerDetails(result.response.id),
  ])
  const response = { ...result.response, answer_count: answerCount }
  if (!result.duplicate) notifySurveySubmitted(job, answerCount, response, answerRows).catch(() => {})
  return {
    ok: true,
    response_id: response.id,
    submission_no: response.submission_no,
    display_name: response.display_name,
    answer_count: answerCount,
    duplicate: Boolean(result.duplicate),
  }
}

async function notifySurveySubmitted(job, answerCount = 0, response = {}, answerRows = []) {
  const baseUrl = getNhansuBaseUrl()
  if (!baseUrl) return

  const recipients = await query(`select id from ${tables.employees} where is_bod = 1`).catch(() => [])
  const needToSend = recipients.map(row => row.id).filter(Boolean)
  if (!needToSend.length) return

  await fetch(`${baseUrl}/api/notifications/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildSurveySubmittedNotificationPayload({
      job,
      response,
      recipients: needToSend,
      answerCount,
      dashboardUrl: getSurveyDashboardUrl(),
      answerRows,
    })),
  }).catch(() => {})
}

async function getGallery(req) {
  const shareToken = trimText(getQueryValue(req.query?.token || req.query?.share_token, ''), 80)
  const feedback = await getFeedbackByShareToken(shareToken)
  const job = feedback?.job_id ? await ensureJobPublicToken(await getJobById(feedback.job_id)) : null
  if (!job?.id) throw makeHttpError('Không tìm thấy gallery.', 404, 'GALLERY_NOT_FOUND')
  return buildGalleryResponse(feedback, job)
}

// Fast path: the page payload WITHOUT photos so the gallery page renders
// immediately (Drive button + survey). Listing Drive photos can take 20-30s
// for deeply nested folders, so it is fetched separately via gallery_photos.
function buildGalleryResponse(feedback, job) {
  return {
    feedback,
    job,
    drive_link: job.gallery_drive || job.drive_feedback || '',
    survey_link: getSurveyPublicPath(job),
  }
}

// Separate (often slow) endpoint that lists the Drive photos. The server
// derives the folder ID itself from the token-scoped drive link; the client
// never sends folderId. Any failure yields photos:[] so the page keeps the
// legacy Drive button. Results are cached per folder in listDriveFolderPhotos.
async function getGalleryPhotos(req) {
  const shareToken = trimText(getQueryValue(req.query?.token || req.query?.share_token, ''), 80)
  const feedback = await getFeedbackByShareToken(shareToken)
  const job = feedback?.job_id ? await ensureJobPublicToken(await getJobById(feedback.job_id)) : null
  if (!job?.id) throw makeHttpError('Không tìm thấy gallery.', 404, 'GALLERY_NOT_FOUND')
  return await resolveGalleryPhotosResult(job)
}

async function resolveGalleryPhotos(job) {
  return (await resolveGalleryPhotosResult(job)).photos
}

async function resolveGalleryPhotosResult(job) {
  const driveLink = job.gallery_drive || job.drive_feedback || ''
  const folderId = extractDriveFolderId(driveLink)
  if (!driveLink) return { photos: [], photo_status: 'no_drive_link' }
  if (!folderId) return { photos: [], photo_status: 'no_folder' }

  const result = await listDriveFolderPhotosDetailed(folderId)
  return {
    photos: result.photos,
    photo_status: result.status,
    photo_error: result.reason,
    photo_http_status: result.http_status,
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
    if (resource === 'survey' || resource === 'gallery' || resource === 'gallery_photos' || resource === 'ai_probe') return true
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
      'summarize_comments',
      'rewrite_reply',
    ].includes(action)
  }

  return false
}

export const __feedbackTestInternals = Object.freeze({
  buildFeedbackDoneNotificationPayload,
  buildGalleryResponse,
  resolveGalleryPhotos,
  resolveGalleryPhotosResult,
  buildSurveySubmittedNotificationContent,
  buildSurveySubmittedNotificationPayload,
  countSurveySubmittedAnswers,
  formatSurveySubmittedNotificationDetails,
  getEmployeePhoneLookupValues,
  getFeedbackNotificationEditorEmployeeId,
  getFeedbackNotificationEditorName,
  getFeedbackNotificationEditorPhone,
  getNhansuBaseUrl,
  getSurveyType,
  normalizeJobRow,
  normalizeVietnamPhone,
})

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') await parseMultipartRequest(req)

    if (!isPublicFeedbackRequest(req) && !await requireEventusAuth(req, res)) return

    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'feedbacks')

      if (resource === 'jobs') {
        return res.status(200).json(await listFeedbackJobs({
          search: getQueryValue(req.query?.search, ''),
          page: getPositiveInteger(req.query?.page, 1),
          pageSize: getPositiveInteger(req.query?.pageSize, DEFAULT_PAGE_SIZE),
          feedbackStatus: getQueryValue(req.query?.feedback_status, ''),
        }))
      }

      if (resource === 'summary') {
        return res.status(200).json(await getFeedbackDashboardSummary({
          search: getQueryValue(req.query?.search, ''),
        }))
      }

      if (resource === 'feedbacks') {
        return res.status(200).json(await listFeedbacks({
          search: getQueryValue(req.query?.search, ''),
          jobId: getQueryValue(req.query?.job_id, ''),
          page: getPositiveInteger(req.query?.page, 1),
          pageSize: getPositiveInteger(req.query?.pageSize, DEFAULT_PAGE_SIZE),
          feedbackStatus: getQueryValue(req.query?.feedback_status, ''),
        }))
      }

      if (resource === 'feedback') {
        const id = getQueryValue(req.query?.id, '')
        return res.status(200).json(await getFeedbackDetail(req, id, parseAccess({}, req.query || {})))
      }

      if (resource === 'survey') return res.status(200).json(await getSurvey(req))
      if (resource === 'gallery') return res.status(200).json(await getGallery(req))
      if (resource === 'gallery_photos') return res.status(200).json(await getGalleryPhotos(req))

      // Trợ lý feedback AI: probe khả dụng, KHÔNG gọi mô hình.
      if (resource === 'ai_probe') return res.status(200).json(feedbackAi.probe())

      return res.status(400).json({ error: 'Resource không hợp lệ.' })
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      const action = body.action || body.resource

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

      // Trợ lý feedback AI — cấp quyền qua assertFeedbackAccess như mọi action feedback.
      if (action === 'summarize_comments') {
        const feedback = await getFeedbackByIdentifier(body.feedback_id || body.id)
        await assertFeedbackAccess(req, feedback, parseAccess(body))
        return res.status(200).json(await feedbackAi.summarizeComments(feedback))
      }

      if (action === 'rewrite_reply') {
        const feedback = await getFeedbackByIdentifier(body.feedback_id || body.id)
        await assertFeedbackAccess(req, feedback, parseAccess(body))
        return res.status(200).json(await feedbackAi.rewriteReply({
          rawText: body.raw_text ?? body.rawText,
          context: body.context,
          tone: body.tone,
        }))
      }

      return res.status(400).json({ error: 'Action không hợp lệ.' })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
