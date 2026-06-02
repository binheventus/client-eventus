import { randomBytes } from 'node:crypto'
import { getPool, tables, toMysqlDateTime } from '../apps/api/lib/mysql.js'

const dryRun = process.argv.includes('--dry-run')
const pool = getPool()

const legacyTables = {
  feedbacks: 'feedback',
  comments: 'comments',
  attachments: 'attached_files',
  questions: 'questions',
  answers: 'answers',
  jobAnswers: 'job_answers',
}

const SHARE_TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PUBLIC_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const PUBLIC_CODE_LENGTH = 4
const usedPublicCodes = new Set()
const feedbackPublicCodeByLegacyId = new Map()

function assertIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Ten bang/cot khong hop le: ${name}`)
  return `\`${name}\``
}

function legacyId(prefix, id) {
  return `${prefix}_legacy_${id}`
}

function makeReadableToken(length = 14) {
  return Array.from(randomBytes(length), value => (
    SHARE_TOKEN_ALPHABET[value % SHARE_TOKEN_ALPHABET.length]
  )).join('')
}

function makePublicCode(length = PUBLIC_CODE_LENGTH) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = Array.from(randomBytes(length), value => (
      PUBLIC_CODE_ALPHABET[value % PUBLIC_CODE_ALPHABET.length]
    )).join('')
    if (/[a-z]/.test(code)) return code
  }
  throw new Error('Khong tao duoc public_code hop le.')
}

function makeUniquePublicCode() {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = makePublicCode()
    if (usedPublicCodes.has(code)) continue
    usedPublicCodes.add(code)
    return code
  }
  throw new Error('Khong tao duoc public_code khong trung.')
}

async function loadExistingPublicCodes() {
  if (!await tableExists(tables.feedbacks)) return
  const columns = await getColumns(tables.feedbacks)
  if (!columns?.has('public_code')) return

  const [rows] = await pool.query(
    `select legacy_id, public_code
     from ${assertIdentifier(tables.feedbacks)}
     where public_code is not null and public_code <> ''`,
  )

  for (const row of rows) {
    const publicCode = String(row.public_code || '').trim()
    if (!publicCode) continue
    usedPublicCodes.add(publicCode)
    if (row.legacy_id !== null && row.legacy_id !== undefined) {
      feedbackPublicCodeByLegacyId.set(String(row.legacy_id), publicCode)
    }
  }
}

function getValue(row, columns, names, fallback = null) {
  for (const name of names) {
    if (columns.has(name) && row[name] !== undefined) return row[name]
  }
  return fallback
}

function toBooleanNumber(value) {
  return value === true || value === 1 || value === '1' ? 1 : 0
}

function normalizeJson(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') return JSON.stringify(value)
  try {
    const parsed = JSON.parse(value)
    return JSON.stringify(parsed)
  } catch {
    return JSON.stringify([value])
  }
}

function normalizeText(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  return String(value)
}

function normalizeDate(value, fallback = null) {
  return toMysqlDateTime(value) || fallback
}

function nowMysql() {
  return toMysqlDateTime(new Date())
}

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = ?
     limit 1`,
    [tableName],
  )
  return rows.length > 0
}

async function getColumns(tableName) {
  if (!await tableExists(tableName)) return null
  const [rows] = await pool.query(
    `select column_name as columnName
     from information_schema.columns
     where table_schema = database()
       and table_name = ?`,
    [tableName],
  )
  return new Set(rows.map(row => row.columnName))
}

async function countRows(tableName) {
  if (!await tableExists(tableName)) return null
  const [rows] = await pool.query(`select count(*) as count from ${assertIdentifier(tableName)}`)
  return Number(rows?.[0]?.count || 0)
}

async function selectAll(tableName, columns) {
  if (!columns) return []
  const orderBy = columns.has('id') ? ' order by `id` asc' : ''
  const [rows] = await pool.query(`select * from ${assertIdentifier(tableName)}${orderBy}`)
  return rows
}

async function upsertRow(connection, tableName, payload, updateKeys = []) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined)
  if (!entries.length) return

  const columns = entries.map(([key]) => assertIdentifier(key)).join(', ')
  const placeholders = entries.map(() => '?').join(', ')
  const values = entries.map(([, value]) => value)
  const updates = updateKeys
    .filter(key => payload[key] !== undefined)
    .map(key => `${assertIdentifier(key)} = values(${assertIdentifier(key)})`)
    .join(', ')
  const updateSql = updates || `${assertIdentifier(entries[0][0])} = ${assertIdentifier(entries[0][0])}`

  await connection.query(
    `insert into ${assertIdentifier(tableName)} (${columns}) values (${placeholders}) on duplicate key update ${updateSql}`,
    values,
  )
}

function makeFeedbackPayload(row, columns) {
  const jobId = getValue(row, columns, ['job_id'])
  if (!jobId) return null

  const done = toBooleanNumber(getValue(row, columns, ['done_feedback', 'is_completed'], 0))
  const updatedAt = normalizeDate(getValue(row, columns, ['updated_at']))
  const createdAt = normalizeDate(getValue(row, columns, ['created_at'])) || updatedAt || nowMysql()

  return {
    id: legacyId('fb', row.id),
    legacy_id: row.id,
    public_code: feedbackPublicCodeByLegacyId.get(String(row.id)) || makeUniquePublicCode(),
    job_id: jobId,
    share_token: makeReadableToken(),
    name: normalizeText(getValue(row, columns, ['name']), `Feedback ${row.id}`),
    status: done ? 'completed' : 'open',
    video_url: normalizeText(getValue(row, columns, ['youtube'])),
    video_title: normalizeText(getValue(row, columns, ['youtube_name'])),
    direct_video_url: normalizeText(getValue(row, columns, ['dlink'])),
    drive_url: normalizeText(getValue(row, columns, ['drive'])),
    video_preview_url: normalizeText(getValue(row, columns, ['video_preview'])),
    audio_preview_url: normalizeText(getValue(row, columns, ['audio_preview'])),
    overall_feedback: normalizeJson(getValue(row, columns, ['overall_feedback'])),
    more_column: toBooleanNumber(getValue(row, columns, ['more_column'], 0)),
    done_feedback: done,
    update_preview_at: normalizeDate(getValue(row, columns, ['update_preview_time'])),
    started_at: normalizeText(getValue(row, columns, ['youtube'])) ? createdAt : null,
    completed_at: done ? updatedAt || createdAt : null,
    created_at: createdAt,
    updated_at: updatedAt || createdAt,
  }
}

function makeCommentPayload(row, columns) {
  const feedbackId = getValue(row, columns, ['feedback_id'])
  if (!feedbackId) return null

  const createdAt = normalizeDate(getValue(row, columns, ['created_at'])) || nowMysql()
  return {
    id: legacyId('fbc', row.id),
    legacy_id: row.id,
    feedback_id: legacyId('fb', feedbackId),
    comment_1: normalizeText(getValue(row, columns, ['comment_1'])),
    image_comment_1: normalizeText(getValue(row, columns, ['image_comment_1'])),
    author_name: normalizeText(getValue(row, columns, ['author_name', 'feedback_author_name', 'comment_author_name'])),
    reply_1: normalizeText(getValue(row, columns, ['reply_1'])),
    image_reply_1: normalizeText(getValue(row, columns, ['image_reply_1'])),
    time_comment_1: getValue(row, columns, ['time_comment_1']),
    time_reply_1: getValue(row, columns, ['time_reply_1']),
    is_done_1: toBooleanNumber(getValue(row, columns, ['is_done_1'], 0)),
    comment_2: normalizeText(getValue(row, columns, ['comment_2'])),
    image_comment_2: normalizeText(getValue(row, columns, ['image_comment_2'])),
    reply_2: normalizeText(getValue(row, columns, ['reply_2'])),
    image_reply_2: normalizeText(getValue(row, columns, ['image_reply_2'])),
    time_comment_2: getValue(row, columns, ['time_comment_2']),
    time_reply_2: getValue(row, columns, ['time_reply_2']),
    is_done_2: toBooleanNumber(getValue(row, columns, ['is_done_2'], 0)),
    created_at: createdAt,
    updated_at: normalizeDate(getValue(row, columns, ['updated_at'])) || createdAt,
  }
}

function makeAttachmentPayload(row, columns) {
  const commentId = getValue(row, columns, ['comment_id'])
  if (!commentId) return null

  const createdAt = normalizeDate(getValue(row, columns, ['created_at'])) || nowMysql()
  return {
    id: legacyId('fba', row.id),
    legacy_id: row.id,
    comment_id: legacyId('fbc', commentId),
    file_name: normalizeText(getValue(row, columns, ['fileName', 'file_name']), `legacy-file-${row.id}`),
    url: normalizeText(getValue(row, columns, ['drive', 'url']), ''),
    storage_path: normalizeText(getValue(row, columns, ['path', 'storage_path'])),
    preview_url: null,
    field_name: normalizeText(getValue(row, columns, ['for_comment', 'field_name'])),
    file_type: normalizeText(getValue(row, columns, ['type', 'file_type']), 'file'),
    delete_at: normalizeDate(getValue(row, columns, ['delete_time', 'delete_at'])),
    created_at: createdAt,
    updated_at: normalizeDate(getValue(row, columns, ['updated_at'])) || createdAt,
  }
}

function makeQuestionPayload(row, columns) {
  const createdAt = normalizeDate(getValue(row, columns, ['created_at'])) || nowMysql()
  return {
    id: legacyId('fbsq', row.id),
    legacy_id: row.id,
    question: normalizeText(getValue(row, columns, ['question']), ''),
    type: normalizeText(getValue(row, columns, ['type']), 'video'),
    star: getValue(row, columns, ['star']),
    text_left: normalizeText(getValue(row, columns, ['text_left'])),
    text_right: normalizeText(getValue(row, columns, ['text_right'])),
    is_active: 1,
    sort_order: Number(getValue(row, columns, ['sort_order', 'order'], row.id)) || 100,
    created_at: createdAt,
    updated_at: normalizeDate(getValue(row, columns, ['updated_at'])) || createdAt,
  }
}

function makeAnswerPayload(row, columns) {
  const questionId = getValue(row, columns, ['question_id'])
  if (!questionId) return null

  const createdAt = normalizeDate(getValue(row, columns, ['created_at'])) || nowMysql()
  return {
    id: legacyId('fbsa', row.id),
    legacy_id: row.id,
    question_id: legacyId('fbsq', questionId),
    answer: normalizeText(getValue(row, columns, ['answer']), ''),
    is_star: toBooleanNumber(getValue(row, columns, ['is_star'], 0)),
    sort_order: Number(getValue(row, columns, ['sort_order', 'order'], row.id)) || 100,
    created_at: createdAt,
    updated_at: normalizeDate(getValue(row, columns, ['updated_at'])) || createdAt,
  }
}

async function importRows(connection, sourceTable, targetTable, makePayload, updateKeys) {
  const columns = await getColumns(sourceTable)
  const rows = await selectAll(sourceTable, columns)
  if (dryRun || !rows.length) return rows.length

  for (const row of rows) {
    const payload = makePayload(row, columns)
    if (!payload?.id) continue
    await upsertRow(connection, targetTable, payload, updateKeys)
  }

  return rows.length
}

async function importJobAnswers(connection) {
  const jobAnswerColumns = await getColumns(legacyTables.jobAnswers)
  const questionColumns = await getColumns(legacyTables.questions)
  if (!jobAnswerColumns || !questionColumns) return 0

  const [rows] = await pool.query(
    `select ja.*, q.type as question_type
     from ${assertIdentifier(legacyTables.jobAnswers)} ja
     left join ${assertIdentifier(legacyTables.questions)} q on q.id = ja.question_id
     order by ja.id asc`,
  )
  if (dryRun || !rows.length) return rows.length

  const responseIds = new Map()
  for (const row of rows) {
    const surveyType = row.question_type === 'image' ? 'image' : 'video'
    const key = `${row.job_id}:${surveyType}`
    if (!responseIds.has(key)) {
      const responseId = legacyId('fbsr', `${row.job_id}_${surveyType}`)
      await upsertRow(connection, tables.feedbackSurveyResponses, {
        id: responseId,
        job_id: row.job_id,
        feedback_id: null,
        survey_type: surveyType,
        submission_no: 1,
        respondent_name: null,
        user_agent: 'legacy-import',
        created_at: normalizeDate(row.created_at) || nowMysql(),
      }, ['submission_no', 'respondent_name', 'user_agent'])
      responseIds.set(key, responseId)
    }

    await upsertRow(connection, tables.feedbackSurveyResponseAnswers, {
      id: legacyId('fbsra', row.id),
      response_id: responseIds.get(key),
      question_id: legacyId('fbsq', row.question_id),
      answer_id: legacyId('fbsa', row.answer_id),
      answer_text: null,
      created_at: normalizeDate(row.created_at) || nowMysql(),
    }, ['response_id', 'question_id', 'answer_id', 'answer_text'])
  }

  return rows.length
}

async function main() {
  await loadExistingPublicCodes()

  const legacyCounts = {}
  const targetCountsBefore = {}

  for (const tableName of Object.values(legacyTables)) {
    legacyCounts[tableName] = await countRows(tableName)
  }
  for (const tableName of [
    tables.feedbacks,
    tables.feedbackComments,
    tables.feedbackAttachments,
    tables.feedbackSurveyQuestions,
    tables.feedbackSurveyAnswers,
    tables.feedbackSurveyResponses,
    tables.feedbackSurveyResponseAnswers,
  ]) {
    targetCountsBefore[tableName] = await countRows(tableName)
  }

  const summary = {
    dry_run: dryRun,
    legacy_counts: legacyCounts,
    target_counts_before: targetCountsBefore,
    imported: {},
  }

  const connection = dryRun ? null : await pool.getConnection()
  try {
    if (connection) await connection.beginTransaction()
    const client = connection || pool

    summary.imported.feedbacks = await importRows(client, legacyTables.feedbacks, tables.feedbacks, makeFeedbackPayload, [
      'job_id',
      'public_code',
      'name',
      'status',
      'video_url',
      'video_title',
      'direct_video_url',
      'drive_url',
      'video_preview_url',
      'audio_preview_url',
      'overall_feedback',
      'more_column',
      'done_feedback',
      'update_preview_at',
      'started_at',
      'completed_at',
      'created_at',
      'updated_at',
    ])
    summary.imported.comments = await importRows(client, legacyTables.comments, tables.feedbackComments, makeCommentPayload, [
      'feedback_id',
      'comment_1',
      'image_comment_1',
      'author_name',
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
      'created_at',
      'updated_at',
    ])
    summary.imported.attachments = await importRows(client, legacyTables.attachments, tables.feedbackAttachments, makeAttachmentPayload, [
      'comment_id',
      'file_name',
      'url',
      'storage_path',
      'preview_url',
      'field_name',
      'file_type',
      'delete_at',
      'created_at',
      'updated_at',
    ])
    summary.imported.questions = await importRows(client, legacyTables.questions, tables.feedbackSurveyQuestions, makeQuestionPayload, [
      'question',
      'type',
      'star',
      'text_left',
      'text_right',
      'is_active',
      'sort_order',
      'created_at',
      'updated_at',
    ])
    summary.imported.answers = await importRows(client, legacyTables.answers, tables.feedbackSurveyAnswers, makeAnswerPayload, [
      'question_id',
      'answer',
      'is_star',
      'sort_order',
      'created_at',
      'updated_at',
    ])
    summary.imported.job_answers = await importJobAnswers(client)

    if (connection) await connection.commit()
  } catch (error) {
    if (connection) await connection.rollback()
    throw error
  } finally {
    if (connection) connection.release()
  }

  const targetCountsAfter = {}
  for (const tableName of Object.keys(targetCountsBefore)) {
    targetCountsAfter[tableName] = await countRows(tableName)
  }
  summary.target_counts_after = targetCountsAfter

  console.log(JSON.stringify(summary, null, 2))
}

try {
  await main()
} finally {
  await pool.end()
}
