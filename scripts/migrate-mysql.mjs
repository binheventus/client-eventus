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
const PUBLIC_TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const JOB_PUBLIC_TOKEN_LENGTH = 18
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
    columnName: 'public_token',
    definition: 'varchar(40) null after `zalo_id`',
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

const feedbackSurveyResponseColumns = [
  {
    tableName: 'client_feedback_survey_responses',
    columnName: 'submission_no',
    definition: 'int not null default 1 after `survey_type`',
  },
  {
    tableName: 'client_feedback_survey_responses',
    columnName: 'submission_key',
    definition: 'varchar(80) null after `submission_no`',
  },
]

const legacyFeedbackIndexes = [
  {
    tableName: 'client_feedback_survey_responses',
    indexName: 'client_feedback_survey_responses_job_type_unique',
  },
]

const feedbackJobIndexes = [
  {
    tableName: 'jobs',
    indexName: 'jobs_public_token_unique',
    columns: ['public_token'],
    unique: true,
    skipIfDuplicateRows: true,
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
    indexName: 'client_feedback_survey_responses_job_type_no_unique',
    columns: ['job_id', 'survey_type', 'submission_no'],
    unique: true,
    skipIfDuplicateRows: true,
  },
  {
    tableName: 'client_feedback_survey_responses',
    indexName: 'client_feedback_survey_responses_submission_key_unique',
    columns: ['submission_key'],
    unique: true,
    skipIfDuplicateRows: true,
  },
]

const pricingTravelFeeColumns = [
  {
    tableName: 'pricing_travel_fees',
    columnName: 'source_key',
    definition: 'varchar(600) null after `id`',
  },
]

const legacyPricingIndexes = [
  {
    tableName: 'pricing_travel_fees',
    indexName: 'pricing_travel_fees_location_unique',
  },
]

const pricingIndexes = [
  {
    tableName: 'pricing_travel_fees',
    indexName: 'pricing_travel_fees_source_key_unique',
    columns: ['source_key'],
    unique: true,
    skipIfDuplicateRows: true,
  },
]

const eventusEntityCodeColumns = [
  { tableName: 'pricing_legal_entities', columnName: 'entity_code' },
  { tableName: 'client_quotes', columnName: 'entity_code' },
  { tableName: 'client_contracts', columnName: 'seller_entity_code' },
  { tableName: 'client_contract_templates', columnName: 'seller_entity_code' },
  { tableName: 'client_contract_document_templates', columnName: 'seller_entity_code' },
  { tableName: 'client_contract_documents', columnName: 'seller_entity_code' },
]

const pricingLegalEntityDuplicateColumns = ['source_entity_code', 'code', 'name', 'legal_name']
const contractDocumentNumberCountersTable = 'client_contract_document_number_counters'
const contractDocumentNumberLedgerTable = 'client_contract_document_number_ledger'

function formatSequenceNumber(value) {
  return String(Number(value || 0)).padStart(4, '0')
}

function normalizeLegacyEventusDocumentNumber(documentNumber, sequenceNumber) {
  const sequenceText = formatSequenceNumber(sequenceNumber)
  return String(documentNumber || '')
    .replace(/^\d+(?=\/)/, sequenceText)
    .replace(/\/DNT([A-Z]+)-EVENTUS\//gi, '/DNT$1-EVT/')
    .replace(/(^|[-/])EVENTUS(?=\/|-|$)/gi, '$1EVT')
}

async function hasTable(pool, tableName) {
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

async function hasColumn(pool, tableName, columnName) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = database()
       and table_name = ?
       and column_name = ?
     limit 1`,
    [tableName, columnName],
  )

  return rows.length > 0
}

async function normalizeEventusDocumentNumberLedger(pool) {
  if (!await hasTable(pool, contractDocumentNumberLedgerTable)) return { updated: 0 }

  const hasDocumentsTable = await hasTable(pool, 'client_contract_documents')
  const [legacyRows] = await pool.query(
    `select id, document_id, document_type, sequence_year, sequence_number, document_number
     from \`${contractDocumentNumberLedgerTable}\`
     where upper(trim(seller_entity_code)) = 'EVENTUS'
     order by sequence_year asc, document_type asc, sequence_number asc, created_at asc, id asc`,
  )

  let updated = 0
  for (const row of legacyRows) {
    const [maxRows] = await pool.query(
      `select coalesce(max(sequence_number), 0) as max_sequence
       from \`${contractDocumentNumberLedgerTable}\`
       where seller_entity_code = 'EVT'
         and document_type = ?
         and sequence_year = ?`,
      [row.document_type, row.sequence_year],
    )
    const nextSequence = Number(maxRows?.[0]?.max_sequence || 0) + 1
    const documentNumber = normalizeLegacyEventusDocumentNumber(row.document_number, nextSequence)

    await pool.query(
      `update \`${contractDocumentNumberLedgerTable}\`
       set seller_entity_code = 'EVT',
           sequence_number = ?,
           document_number = ?
       where id = ?`,
      [nextSequence, documentNumber, row.id],
    )

    if (hasDocumentsTable && row.document_id) {
      await pool.query(
        `update \`client_contract_documents\`
         set seller_entity_code = 'EVT',
             sequence_number = ?,
             document_number = ?
         where id = ?`,
        [nextSequence, documentNumber, row.document_id],
      )
    }

    updated += 1
  }

  return { updated }
}

async function normalizeEventusDocumentNumberCounters(pool) {
  if (!await hasTable(pool, contractDocumentNumberCountersTable)) return { merged: 0, renamed: 0, synced: 0 }

  const [legacyRows] = await pool.query(
    `select id, document_type, sequence_year, last_sequence
     from \`${contractDocumentNumberCountersTable}\`
     where upper(trim(seller_entity_code)) = 'EVENTUS'
        or id like 'EVENTUS:%'
     order by sequence_year asc, document_type asc, id asc`,
  )

  let merged = 0
  let renamed = 0
  for (const row of legacyRows) {
    const targetId = `EVT:${row.document_type}:${row.sequence_year}`
    const [targetRows] = await pool.query(
      `select id, last_sequence
       from \`${contractDocumentNumberCountersTable}\`
       where id = ?
          or (seller_entity_code = 'EVT' and document_type = ? and sequence_year = ?)
       order by id = ? desc
       limit 1`,
      [targetId, row.document_type, row.sequence_year, targetId],
    )
    const target = targetRows?.[0]

    if (target && target.id !== row.id) {
      await pool.query(
        `update \`${contractDocumentNumberCountersTable}\`
         set last_sequence = greatest(last_sequence, ?),
             updated_at = current_timestamp(3)
         where id = ?`,
        [row.last_sequence || 0, target.id],
      )
      await pool.query(`delete from \`${contractDocumentNumberCountersTable}\` where id = ?`, [row.id])
      merged += 1
      continue
    }

    await pool.query(
      `update \`${contractDocumentNumberCountersTable}\`
       set id = ?,
           seller_entity_code = 'EVT',
           updated_at = current_timestamp(3)
       where id = ?`,
      [targetId, row.id],
    )
    renamed += 1
  }

  let synced = 0
  if (await hasTable(pool, contractDocumentNumberLedgerTable)) {
    const [result] = await pool.query(
      `update \`${contractDocumentNumberCountersTable}\` counters
       join (
         select seller_entity_code, document_type, sequence_year, max(sequence_number) as max_sequence
         from \`${contractDocumentNumberLedgerTable}\`
         group by seller_entity_code, document_type, sequence_year
       ) ledger
         on ledger.seller_entity_code = counters.seller_entity_code
        and ledger.document_type = counters.document_type
        and ledger.sequence_year = counters.sequence_year
       set counters.last_sequence = greatest(counters.last_sequence, ledger.max_sequence),
           counters.updated_at = current_timestamp(3)
       where counters.seller_entity_code = 'EVT'
         and counters.last_sequence < ledger.max_sequence`,
    )
    synced = Number(result?.affectedRows || 0)
  }

  return { merged, renamed, synced }
}

async function normalizeEventusEntityCodes(pool) {
  const updates = {}

  for (const { tableName, columnName } of eventusEntityCodeColumns) {
    if (!await hasColumn(pool, tableName, columnName)) continue

    const [result] = await pool.query(
      `update \`${tableName}\`
       set \`${columnName}\` = 'EVT'
       where upper(trim(\`${columnName}\`)) = 'EVENTUS'`,
    )
    const changed = Number(result?.affectedRows || 0)
    if (changed) updates[`${tableName}.${columnName}`] = changed
  }

  return updates
}

async function clearPricingLegalEntityDuplicateFields(pool) {
  const updates = {}

  for (const columnName of pricingLegalEntityDuplicateColumns) {
    if (!await hasColumn(pool, 'pricing_legal_entities', columnName)) continue

    const [result] = await pool.query(
      `update \`pricing_legal_entities\`
       set \`${columnName}\` = null
       where \`${columnName}\` is not null`,
    )
    const changed = Number(result?.affectedRows || 0)
    if (changed) updates[`pricing_legal_entities.${columnName}`] = changed
  }

  return updates
}

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

async function ensureConfiguredIndexIfTableExists(pool, config) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = ?
     limit 1`,
    [config.tableName],
  )

  if (!tables.length) return false
  return ensureConfiguredIndex(pool, config)
}

async function dropIndexIfExists(pool, { tableName, indexName }) {
  const [rows] = await pool.query(
    `select 1
     from information_schema.statistics
     where table_schema = database()
       and table_name = ?
       and index_name = ?
     limit 1`,
    [tableName, indexName],
  )

  if (!rows.length) return false

  await pool.query(`alter table \`${tableName}\` drop index \`${indexName}\``)
  return true
}

async function hasDuplicateRowsForIndex(pool, { tableName, columns }) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = ?
     limit 1`,
    [tableName],
  )
  if (!tables.length) return false

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

function makePublicToken(length = JOB_PUBLIC_TOKEN_LENGTH) {
  return Array.from(randomBytes(length), value => (
    PUBLIC_TOKEN_ALPHABET[value % PUBLIC_TOKEN_ALPHABET.length]
  )).join('')
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

async function makeUniqueJobPublicToken(pool, usedTokens) {
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const token = makePublicToken()
    if (usedTokens.has(token)) continue
    const [rows] = await pool.query('select 1 from `jobs` where `public_token` = ? limit 1', [token])
    if (!rows.length) {
      usedTokens.add(token)
      return token
    }
  }
  throw new Error('Khong tao duoc public_token job khong trung.')
}

async function backfillJobPublicTokens(pool) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = 'jobs'
     limit 1`,
  )
  if (!tables.length) return 0

  const [columns] = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = database()
       and table_name = 'jobs'
       and column_name = 'public_token'
     limit 1`,
  )
  if (!columns.length) return 0

  const [existingRows] = await pool.query(
    'select `public_token` from `jobs` where `public_token` is not null and `public_token` <> ""',
  )
  const usedTokens = new Set(existingRows.map(row => String(row.public_token || '').trim()).filter(Boolean))
  const [rows] = await pool.query(
    'select `id` from `jobs` where `public_token` is null or `public_token` = "" order by `id` asc',
  )

  for (const row of rows) {
    const publicToken = await makeUniqueJobPublicToken(pool, usedTokens)
    await pool.query(
      'update `jobs` set `public_token` = ? where `id` = ? and (`public_token` is null or `public_token` = "")',
      [publicToken, row.id],
    )
  }

  return rows.length
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

async function backfillFeedbackSurveySubmissionNumbers(pool) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = 'client_feedback_survey_responses'
     limit 1`,
  )
  if (!tables.length) return 0

  const [columns] = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = database()
       and table_name = 'client_feedback_survey_responses'
       and column_name = 'submission_no'
     limit 1`,
  )
  if (!columns.length) return 0

  const [rows] = await pool.query(
    `select id, job_id, survey_type, submission_no
     from \`client_feedback_survey_responses\`
     order by job_id asc, survey_type asc, created_at asc, id asc`,
  )

  const counters = new Map()
  let updated = 0
  for (const row of rows) {
    const key = `${row.job_id}:${row.survey_type || 'video'}`
    const nextNo = (counters.get(key) || 0) + 1
    counters.set(key, nextNo)

    if (Number(row.submission_no || 0) === nextNo) continue
    await pool.query(
      'update `client_feedback_survey_responses` set `submission_no` = ? where `id` = ?',
      [nextNo, row.id],
    )
    updated += 1
  }

  return updated
}

async function ensureFeedbackSurveyTypeDefault(pool) {
  const [columns] = await pool.query(
    `select column_default as columnDefault
     from information_schema.columns
     where table_schema = database()
       and table_name = 'client_feedback_survey_responses'
       and column_name = 'survey_type'
     limit 1`,
  )
  if (!columns.length || columns?.[0]?.columnDefault === 'general') return false

  await pool.query("alter table `client_feedback_survey_responses` modify column `survey_type` varchar(40) not null default 'general'")
  return true
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

function makePricingTravelFeeSourceKey(row = {}) {
  return [
    String(row.location || '').trim().toLowerCase(),
    String(row.condition || '').trim().toLowerCase(),
  ].join('::')
}

async function backfillPricingTravelFeeSourceKeys(pool) {
  const [tables] = await pool.query(
    `select 1
     from information_schema.tables
     where table_schema = database()
       and table_name = 'pricing_travel_fees'
     limit 1`,
  )
  if (!tables.length) return 0

  const [columns] = await pool.query(
    `select 1
     from information_schema.columns
     where table_schema = database()
       and table_name = 'pricing_travel_fees'
       and column_name = 'source_key'
     limit 1`,
  )
  if (!columns.length) return 0

  const [rows] = await pool.query(
    'select `id`, `location`, `condition`, `source_key` from `pricing_travel_fees` order by `id` asc',
  )

  let updated = 0
  for (const row of rows) {
    const sourceKey = makePricingTravelFeeSourceKey(row)
    if (row.source_key === sourceKey) continue
    await pool.query('update `pricing_travel_fees` set `source_key` = ? where `id` = ?', [sourceKey, row.id])
    updated += 1
  }

  return updated
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

  for (const columnConfig of feedbackSurveyResponseColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  for (const columnConfig of pricingTravelFeeColumns) {
    if (await ensureColumnIfTableExists(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  const backfilledJobPublicTokens = await backfillJobPublicTokens(pool)
  const backfilledFeedbackPublicCodes = await backfillFeedbackPublicCodes(pool)
  const backfilledFeedbackSurveySubmissionNumbers = await backfillFeedbackSurveySubmissionNumbers(pool)
  const backfilledPricingTravelFeeSourceKeys = await backfillPricingTravelFeeSourceKeys(pool)
  const normalizedEventusDocumentNumberLedger = await normalizeEventusDocumentNumberLedger(pool)
  const normalizedEventusDocumentNumberCounters = await normalizeEventusDocumentNumberCounters(pool)
  const normalizedEventusEntityCodes = await normalizeEventusEntityCodes(pool)
  const clearedPricingLegalEntityDuplicateFields = await clearPricingLegalEntityDuplicateFields(pool)
  if (await ensureFeedbackSurveyTypeDefault(pool)) createdColumns.push('client_feedback_survey_responses.survey_type default general')

  if (await ensureContractQuoteNullable(pool)) createdColumns.push('client_contracts.quote_id nullable')
  const quoteDraftModeCleanup = await removeQuoteDraftMode(pool)

  for (const indexConfig of contractIndexes) {
    if (await ensureConfiguredIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const skippedIndexes = []
  for (const indexConfig of feedbackJobIndexes) {
    if (indexConfig.skipIfDuplicateRows && await hasDuplicateRowsForIndex(pool, indexConfig)) {
      skippedIndexes.push(`${indexConfig.indexName}: duplicate rows exist`)
      continue
    }
    if (await ensureConfiguredIndexIfTableExists(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const droppedIndexes = []
  for (const indexConfig of legacyFeedbackIndexes) {
    if (await dropIndexIfExists(pool, indexConfig)) droppedIndexes.push(indexConfig.indexName)
  }

  for (const indexConfig of legacyPricingIndexes) {
    if (await dropIndexIfExists(pool, indexConfig)) droppedIndexes.push(indexConfig.indexName)
  }

  for (const indexConfig of feedbackIndexes) {
    if (indexConfig.skipIfDuplicateRows && await hasDuplicateRowsForIndex(pool, indexConfig)) {
      skippedIndexes.push(`${indexConfig.indexName}: duplicate rows exist`)
      continue
    }
    if (await ensureConfiguredIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  for (const indexConfig of pricingIndexes) {
    if (indexConfig.skipIfDuplicateRows && await hasDuplicateRowsForIndex(pool, indexConfig)) {
      skippedIndexes.push(`${indexConfig.indexName}: duplicate rows exist`)
      continue
    }
    if (await ensureConfiguredIndexIfTableExists(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
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
    dropped_indexes: droppedIndexes,
    skipped_indexes: skippedIndexes,
    backfilled_job_public_tokens: backfilledJobPublicTokens,
    backfilled_feedback_public_codes: backfilledFeedbackPublicCodes,
    backfilled_feedback_survey_submission_numbers: backfilledFeedbackSurveySubmissionNumbers,
    backfilled_pricing_travel_fee_source_keys: backfilledPricingTravelFeeSourceKeys,
    normalized_eventus_document_number_ledger: normalizedEventusDocumentNumberLedger,
    normalized_eventus_document_number_counters: normalizedEventusDocumentNumberCounters,
    normalized_eventus_entity_codes: normalizedEventusEntityCodes,
    cleared_pricing_legal_entity_duplicate_fields: clearedPricingLegalEntityDuplicateFields,
    quote_draft_mode_cleanup: quoteDraftModeCleanup,
    dropped_legacy_tables: shouldDropLegacyTables ? legacyAiLabTables.length : 0,
  }, null, 2))
} finally {
  await pool.end()
}
