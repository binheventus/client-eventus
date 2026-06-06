import { getPool, tables } from '../apps/api/lib/mysql.js'
import {
  removeFeedbackUploadFile,
  resolveFeedbackUploadPublicPath,
} from '../apps/api/lib/feedback-upload-storage.js'

const args = new Set(process.argv.slice(2))
const force = args.has('--force')
const pool = getPool()

function getArgValue(name, fallback = '') {
  const prefix = `${name}=`
  const match = process.argv.slice(2).find(arg => arg.startsWith(prefix))
  return match ? match.slice(prefix.length) : fallback
}

function getLimit() {
  const limit = Number(getArgValue('--limit', '500'))
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 5000) : 500
}

async function getExpiredAttachments(limit) {
  const [rows] = await pool.query(
    `select id, file_name, url, storage_path, preview_url, delete_at
     from ${tables.feedbackAttachments}
     where delete_at is not null and delete_at <= current_timestamp(3)
     order by delete_at asc, created_at asc
     limit ?`,
    [limit],
  )
  return rows
}

async function deleteAttachmentFiles(attachment) {
  const deleted = []
  const storageDeleted = await removeFeedbackUploadFile(attachment.storage_path).catch(() => false)
  if (storageDeleted) deleted.push(attachment.storage_path)

  const previewPath = resolveFeedbackUploadPublicPath(attachment.preview_url)
  if (previewPath && previewPath !== attachment.storage_path) {
    const previewDeleted = await removeFeedbackUploadFile(previewPath).catch(() => false)
    if (previewDeleted) deleted.push(previewPath)
  }

  return deleted
}

async function cleanupExpiredAttachments(limit) {
  let totalRows = 0
  let totalFiles = 0

  while (true) {
    const rows = await getExpiredAttachments(limit)
    if (!rows.length) break

    for (const row of rows) {
      const deletedFiles = await deleteAttachmentFiles(row)
      await pool.query(`delete from ${tables.feedbackAttachments} where id = ?`, [row.id])
      totalRows += 1
      totalFiles += deletedFiles.length
    }

    if (rows.length < limit) break
  }

  return { deleted_rows: totalRows, deleted_files: totalFiles }
}

try {
  const limit = getLimit()
  const rows = await getExpiredAttachments(limit)

  if (!force) {
    console.log(JSON.stringify({
      dry_run: true,
      expired_count_in_first_batch: rows.length,
      limit,
      sample: rows.slice(0, 10).map(row => ({
        id: row.id,
        file_name: row.file_name,
        delete_at: row.delete_at,
        storage_path: row.storage_path,
      })),
      next_step: 'Chay lai voi --force de xoa file local va DB record da het han.',
    }, null, 2))
    process.exit(0)
  }

  const result = await cleanupExpiredAttachments(limit)
  console.log(JSON.stringify({
    dry_run: false,
    ...result,
  }, null, 2))
} finally {
  await pool.end()
}
