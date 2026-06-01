import { getPool, tables } from '../apps/api/lib/mysql.js'

const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const includePhysicalFiles = args.has('--include-physical-files')
const pool = getPool()

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const match = process.argv.slice(2).find(arg => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

function assertIdentifier(name) {
  if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error(`Ten bang/cot khong hop le: ${name}`)
  return `\`${name}\``
}

function formatMysqlLocalDate(date) {
  const pad = value => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function getCutoffMysql() {
  const before = getArgValue('--before')
  if (before) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(before)) throw new Error(`Ngay --before khong hop le: ${before}`)
    const date = new Date(`${before}T00:00:00`)
    if (Number.isNaN(date.getTime())) throw new Error(`Ngay --before khong hop le: ${before}`)
    return `${before} 00:00:00`
  }

  const months = Number(getArgValue('--months', '6'))
  if (!Number.isFinite(months) || months < 1) throw new Error('--months phai la so duong.')

  const date = new Date()
  date.setMonth(date.getMonth() - months)
  return formatMysqlLocalDate(date)
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

async function countRows(sql, params = []) {
  const [rows] = await pool.query(sql, params)
  return Number(rows?.[0]?.count || 0)
}

async function countTable(tableName) {
  if (!await tableExists(tableName)) return null
  return countRows(`select count(*) as count from ${assertIdentifier(tableName)}`)
}

async function getSummary(cutoffMysql) {
  const oldFeedbackWhere = `f.created_at < ?`
  const oldSurveyWhere = `coalesce(j.job_date, sr.created_at) < ?`

  const counts = {
    cutoff: cutoffMysql,
    force,
    include_physical_files: includePhysicalFiles,
    before: {},
    prune: {},
  }

  for (const tableName of [
    tables.feedbacks,
    tables.feedbackComments,
    tables.feedbackAttachments,
    tables.feedbackSurveyResponses,
    tables.feedbackSurveyResponseAnswers,
  ]) {
    counts.before[tableName] = await countTable(tableName)
  }

  counts.prune.feedbacks = await countRows(
    `select count(*) as count from ${assertIdentifier(tables.feedbacks)} f where ${oldFeedbackWhere}`,
    [cutoffMysql],
  )
  counts.prune.comments = await countRows(
    `select count(*) as count
     from ${assertIdentifier(tables.feedbackComments)} c
     inner join ${assertIdentifier(tables.feedbacks)} f on f.id = c.feedback_id
     where ${oldFeedbackWhere}`,
    [cutoffMysql],
  )
  counts.prune.attachments = await countRows(
    `select count(*) as count
     from ${assertIdentifier(tables.feedbackAttachments)} a
     inner join ${assertIdentifier(tables.feedbackComments)} c on c.id = a.comment_id
     inner join ${assertIdentifier(tables.feedbacks)} f on f.id = c.feedback_id
     where ${oldFeedbackWhere}`,
    [cutoffMysql],
  )
  counts.prune.survey_responses = await countRows(
    `select count(*) as count
     from ${assertIdentifier(tables.feedbackSurveyResponses)} sr
     left join ${assertIdentifier(tables.jobs)} j on j.id = sr.job_id
     where ${oldSurveyWhere}`,
    [cutoffMysql],
  )
  counts.prune.survey_response_answers = await countRows(
    `select count(*) as count
     from ${assertIdentifier(tables.feedbackSurveyResponseAnswers)} sra
     inner join ${assertIdentifier(tables.feedbackSurveyResponses)} sr on sr.id = sra.response_id
     left join ${assertIdentifier(tables.jobs)} j on j.id = sr.job_id
     where ${oldSurveyWhere}`,
    [cutoffMysql],
  )

  return counts
}

async function prune(cutoffMysql) {
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    await connection.query(
      `delete sr
       from ${assertIdentifier(tables.feedbackSurveyResponses)} sr
       left join ${assertIdentifier(tables.jobs)} j on j.id = sr.job_id
       where coalesce(j.job_date, sr.created_at) < ?`,
      [cutoffMysql],
    )
    await connection.query(
      `delete from ${assertIdentifier(tables.feedbacks)}
       where created_at < ?`,
      [cutoffMysql],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

try {
  const cutoff = getCutoffMysql()
  const before = await getSummary(cutoff)

  if (!force) {
    console.log(JSON.stringify({
      ...before,
      dry_run: true,
      next_step: 'Chay lai voi --force neu muon xoa cac dong tren.',
      note: includePhysicalFiles
        ? 'Flag --include-physical-files hien chi duoc ghi nhan; script nay khong xoa file Google Drive/local de tranh pha link ngoai y muon.'
        : 'Script chi xoa DB trong client_feedback_*. Khong xoa bang legacy va khong xoa file Google Drive/local.',
    }, null, 2))
    process.exit(0)
  }

  await prune(cutoff)
  const after = await getSummary(cutoff)
  console.log(JSON.stringify({
    ...before,
    dry_run: false,
    after: after.before,
    remaining_old_rows: after.prune,
    note: 'Da xoa DB trong client_feedback_*. Khong xoa bang legacy va khong xoa file Google Drive/local.',
  }, null, 2))
} finally {
  await pool.end()
}
