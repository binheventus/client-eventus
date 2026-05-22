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

try {
  for (const statement of splitSqlStatements(schemaSql)) {
    await pool.query(statement)
  }

  const createdIndexes = []
  for (const indexConfig of quoteListIndexes) {
    if (await ensureIndex(pool, indexConfig)) createdIndexes.push(indexConfig.indexName)
  }

  const createdColumns = []
  for (const columnConfig of quoteItemColumns) {
    if (await ensureColumn(pool, columnConfig)) createdColumns.push(`${columnConfig.tableName}.${columnConfig.columnName}`)
  }

  await pool.query('set foreign_key_checks = 0')
  for (const tableName of legacyAiLabTables) {
    await pool.query(`drop table if exists \`${tableName}\``)
  }
  await pool.query('set foreign_key_checks = 1')

  console.log(JSON.stringify({
    ok: true,
    schema: schemaPath,
    statements: splitSqlStatements(schemaSql).length,
    created_columns: createdColumns,
    created_indexes: createdIndexes,
    dropped_legacy_tables: legacyAiLabTables.length,
  }, null, 2))
} finally {
  await pool.end()
}
