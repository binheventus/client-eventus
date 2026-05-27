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

  if (await ensureContractQuoteNullable(pool)) createdColumns.push('client_contracts.quote_id nullable')

  for (const indexConfig of contractIndexes) {
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
    dropped_legacy_tables: shouldDropLegacyTables ? legacyAiLabTables.length : 0,
  }, null, 2))
} finally {
  await pool.end()
}
