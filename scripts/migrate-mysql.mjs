import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getPool } from '../apps/api/lib/mysql.js'

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map(statement => statement.trim())
    .filter(Boolean)
}

const schemaPath = path.join(process.cwd(), 'docs/mysql-schema.sql')
const schemaSql = await fs.readFile(schemaPath, 'utf8')
const pool = getPool()
const PUBLIC_CODE_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const PUBLIC_CODE_LENGTH = 4
const legacyPrefix = ['ai', 'lab'].join('_')
const legacyAiLabTables = [
  'quote_views',
  'quote_items',
  'contracts',
  'quotes',
  'contract_templates',
  'pages',
  'clients',
].map(tableName => `${legacyPrefix}_${tableName}`)
const quoteListIndexes = [
  {
    tableName: 'client_quotes',
    indexName: 'client_quotes_deleted_created_idx',
    columns: ['deleted_at', 'created_at'],
  },
  {
    tableName: 'client_quotes',
    indexName: 'client_quotes_deleted_status_created_idx',
    columns: ['deleted_at', 'status', 'created_at'],
  },
  {
    tableName: 'client_quotes',
    indexName: 'client_quotes_deleted_created_by_created_idx',
    columns: ['deleted_at', 'created_by', 'created_at'],
  },
  {
    tableName: 'client_quotes',
    indexName: 'client_quotes_deleted_entity_created_idx',
    columns: ['deleted_at', 'entity_code', 'created_at'],
  },
  {
    tableName: 'client_quotes',
    indexName: 'client_quotes_deleted_tier_created_idx',
    columns: ['deleted_at', 'tier_code', 'created_at'],
  },
]

const quoteItemColumns = [
  {
    tableName: 'client_quote_items',
    columnName: 'billable_duration_hours',
    definition: 'decimal(10,2) null after `num_sessions`',
  },
  {
    tableName: 'client_quote_items',
    columnName: 'group_code',
    definition: 'varchar(80) null after `override_reason`',
  },
  {
    tableName: 'client_quote_items',
    columnName: 'group_label',
    definition: 'varchar(255) null after `group_code`',
  },
  {
    tableName: 'client_quote_items',
    columnName: 'group_sort_order',
    definition: 'int null after `group_label`',
  },
]

const quoteColumns = [
  {
    tableName: 'client_quotes',
    columnName: 'terms_text',
    definition: 'longtext null after `has_vat`',
  },
  {
    tableName: 'client_quotes',
    columnName: 'show_stamp',
    definition: 'tinyint(1) not null default 1 after `has_vat`',
  },
]

const contractColumns = [
  {
    tableName: 'client_contracts',
    columnName: 'source_type',
    definition: `varchar(40) not null default 'quote' after \`quote_number\``,
  },
  {
    tableName: 'client_contracts',
    columnName: 'external_job_id',
    definition: 'bigint unsigned null after `source_type`',
  },
  {
    tableName: 'client_contracts',
    columnName: 'share_token',
    definition: 'varchar(32) null after `external_job_id`',
  },
  {
    tableName: 'client_contracts',
    columnName: 'source_snapshot',
    definition: 'json null after `quote_snapshot`',
  },
  {
    tableName: 'client_contracts',
    columnName: 'deleted_at',
    definition: 'datetime(3) null after `source_snapshot`',
  },
]

const contractIndexes = [
  {
    tableName: 'client_contracts',
    indexName: 'client_contracts_deleted_at_idx',
    columns: ['deleted_at'],
  },
  {
    tableName: 'client_contracts',
    indexName: 'client_contracts_deleted_updated_idx',
    columns: ['deleted_at', 'updated_at'],
  },
  {
    tableName: 'client_contracts',
    indexName: 'client_contracts_share_token_unique',
    columns: ['share_token'],
    unique: true,
  },
  {
    tableName: 'client_contracts',
    indexName: 'client_contracts_source_job_unique',
    columns: ['source_type', 'external_job_id'],
    unique: true,
  },
]

const feedbackJobColumns = [
  {
    tableName: 'jobs',
    columnName: 'zalo_id',
    definition: 'varchar(120) null',
  },
  {
    tableName: 'jobs',
    columnName: 'editor_name',
    definition: 'varchar(255) null',
  },
  {
    tableName: 'jobs',
    columnName: 'editor_phone',
    definition: 'varchar(80) null',
  },
  {
    tableName: 'jobs',
    columnName: 'drive_feedback',
    definition: 'longtext null',
  },
  {
    tableName: 'jobs',
    columnName: 'gallery_drive',
    definition: 'longtext null',
  },
  {
    tableName: 'jobs',
    columnName: 'start_feedback',
    definition: 'datetime(3) null',
  },
  {
    tableName: 'jobs',
    columnName: 'end_feedback',
    definition: 'datetime(3) null',
  },
]

const feedbackEmployeeColumns = [
  {
    tableName: 'employees',
    columnName: 'zalo_name',
    definition: 'varchar(255) null',
  },
  {
    tableName: 'employees',
    columnName: 'is_bod',
    definition: 'tinyint(1) not null default 0',
  },
]

const feedbackAttachmentColumns = [
  {
    tableName: 'client_feedback_attachments',
    columnName: 'preview_url',
    definition: 'longtext null after `storage_path`',
  },
]

const feedbackCommentColumns = [
  {
    tableName: 'client_feedback_comments',
    columnName: 'author_name',
    definition: 'varchar(255) null after `image_comment_1`',
  },
]

const feedbackColumns = [
  {
    tableName: 'client_feedbacks',
    columnName: 'public_code',
    definition: 'varchar(4) null after `legacy_id`',
  },
]

const feedbackIndexes = [
  {
    tableName: 'client_feedbacks',
    indexName: 'client_feedbacks_public_code_unique',
    columns: ['public_code'],
    unique: true,
    skipIfDuplicateRows: true,
  },
  {
    tableName: 'client_feedback_survey_responses',
    indexName: 'client_feedback_survey_responses_job_type_unique',
    columns: ['job_id', 'survey_type'],
    unique: true,
    skipIfDuplicateRows: true,
  },
]

async function ensureColumn(pool, { tableName, columnName, definition }) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = database()
       and table_name = ?
       and column_name = ?
     limit 1`,
    [tableName, columnName],
  )

  if (rows.length) return false

  await pool.query(`alter table \`${tableName}\` add column \`${columnName}\` ${definition}`)
  return true
}

async function ensureColumnIfTableExists(pool, config) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = ?
     limit 1`,
    [config.tableName],
  )

  if (!tables.length) return false
  return ensureColumn(pool, config)
}

async function ensureIndex(pool, { tableName, indexName, columns }) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.statistics
     where table_schema = database()
       and table_name = ?
       and index_name = ?
     limit 1`,
    [tableName, indexName],
  )

  if (rows.length) return false

  const columnSql = columns.map(column => `\`${column}\``).join(', ')
  await pool.query(`alter table \`${tableName}\` add index \`${indexName}\` (${columnSql})`)
  return true
}

async function ensureConfiguredIndex(pool, { tableName, indexName, columns, unique = false }) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.statistics
     where table_schema = database()
       and table_name = ?
       and index_name = ?
     limit 1`,
    [tableName, indexName],
  )

  if (rows.length) return false

  const columnSql = columns.map(column => `\`${column}\``).join(', ')
  await pool.query(`alter table \`${tableName}\` add ${unique ? 'unique ' : ''}index \`${indexName}\` (${columnSql})`)
  return true
}

async function hasDuplicateRowsForIndex(pool, { tableName, columns }) {
  const columnSql = columns.map(column => `\`${column}\``).join(', ')
  const presentSql = columns.map(column => `\`${column}\` is not null`).join(' and ')
  const [rows] = await pool.query(
    `select ${columnSql}, count(*) as count
     from \`${tableName}\`
     where ${presentSql}
     group by ${columnSql}
     having count(*) > 1
     limit 1`,
  )
  return rows.length > 0
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

async function makeUniquePublicCode(pool, usedCodes) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const code = makePublicCode()
    if (usedCodes.has(code)) continue
    const [rows] = await pool.query('select 1 from `client_feedbacks` where `public_code` = ? limit 1', [code])
    if (!rows.length) {
      usedCodes.add(code)
      return code
    }
  }
  throw new Error('Khong tao duoc public_code khong trung.')
}

async function backfillFeedbackPublicCodes(pool) {
  const [existingRows] = await pool.query(
    'select `public_code` from `client_feedbacks` where `public_code` is not null and `public_code` <> ""',
  )
  const usedCodes = new Set(existingRows.map(row => String(row.public_code || '').trim()).filter(Boolean))
  const [rows] = await pool.query(
    'select `id` from `client_feedbacks` where `public_code` is null or `public_code` = "" order by `created_at` asc, `id` asc',
  )

  for (const row of rows) {
    const publicCode = await makeUniquePublicCode(pool, usedCodes)
    await pool.query(
      'update `client_feedbacks` set `public_code` = ? where `id` = ? and (`public_code` is null or `public_code` = "")',
      [publicCode, row.id],
    )
  }

  return rows.length
}

async function ensureContractQuoteNullable(pool) {
  const [columns] = await pool.query(
    `select is_nullable
     from information_schema.columns
     where table_schema = database()
       and table_name = 'client_contracts'
       and column_name = 'quote_id'
     limit 1`,
  )

  if (columns?.[0]?.is_nullable === 'YES') return false

  const [constraints] = await pool.query(
    `select constraint_name as constraintName
     from information_schema.key_column_usage
     where table_schema = database()
       and table_name = 'client_contracts'
       and column_name = 'quote_id'
       and referenced_table_name = 'client_quotes'`,
  )

  for (const row of constraints) {
    if (row.constraintName) {
      await pool.query(`alter table \`client_contracts\` drop foreign key \`${row.constraintName}\``)
    }
  }

  await pool.query('alter table `client_contracts` modify column `quote_id` varchar(32) null')
  await pool.query(
    `alter table \`client_contracts\`
     add constraint \`client_contracts_quote_id_fk\`
     foreign key (\`quote_id\`) references \`client_quotes\`(\`id\`) on delete set null`,
  )
  return true
}

async function removeQuoteDraftMode(pool) {
  const [draftRows] = await pool.query('select id from `client_quotes` where lower(`status`) = ?', ['draft'])
  if (draftRows.length) {
    await pool.query('delete from `client_quotes` where lower(`status`) = ?', ['draft'])
  }

  const [columns] = await pool.query(
    `select column_default as columnDefault
     from information_schema.columns
     where table_schema = database()
       and table_name = 'client_quotes'
       and column_name = 'status'
     limit 1`,
  )
  const defaultChanged = columns?.[0]?.columnDefault !== 'sent'
  if (defaultChanged) {
    await pool.query("alter table `client_quotes` modify column `status` varchar(40) not null default 'sent'")
  }

  return {
    deletedDraftQuotes: draftRows.length,
    defaultChanged,
  }
}

try {
  for (const statement of splitSqlStatements(schemaSql)) {
    await pool.query(statement)
  }

  const createdIndexes = []
  for (const indexConfig of quoteListIndexes) {
    if (await ensureIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const createdColumns = []
  for (const columnConfig of quoteColumns) {
    if (await ensureColumn(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of quoteItemColumns) {
    if (await ensureColumn(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of contractColumns) {
    if (await ensureColumn(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of feedbackJobColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of feedbackEmployeeColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of feedbackAttachmentColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of feedbackCommentColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of feedbackColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  const backfilledFeedbackPublicCodes = await backfillFeedbackPublicCodes(pool)

  if (await ensureContractQuoteNullable(pool)) createdColumns.push('client_contracts.quote_id nullable')
  const quoteDraftModeCleanup = await removeQuoteDraftMode(pool)

  for (const indexConfig of contractIndexes) {
    if (await ensureConfiguredIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const skippedIndexes = []
  for (const indexConfig of feedbackIndexes) {
    if (indexConfig.skipIfDuplicateRows && await hasDuplicateRowsForIndex(pool, indexConfig)) {
      skippedIndexes.push(`${indexConfig.indexName}: duplicate rows exist`)
      continue
    }
    if (await ensureConfiguredIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const shouldDropLegacyTables = process.env.DROP_LEGACY_AI_LAB_TABLES === '1'
  if (shouldDropLegacyTables) {
    await pool.query('set foreign_key_checks = 0')
    try {
      for (const tableName of legacyAiLabTables) {
        await pool.query(`drop table if exists \`${tableName}\``)
      }
    } finally {
      await pool.query('set foreign_key_checks = 1')
    }
  }

  console.log(JSON.stringify({
    ok: true,
    schema: schemaPath,
    statements: splitSqlStatements(schemaSql).length,
    created_columns: createdColumns,
    created_indexes: createdIndexes,
    skipped_indexes: skippedIndexes,
    backfilled_feedback_public_codes: backfilledFeedbackPublicCodes,
    quote_draft_mode_cleanup: quoteDraftModeCleanup,
    dropped_legacy_tables: shouldDropLegacyTables ? legacyAiLabTables.length : 0,
  }, null, 2))
} finally {
  await pool.end()
}
