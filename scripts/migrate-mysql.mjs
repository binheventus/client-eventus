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

try {
  for (const statement of splitSqlStatements(schemaSql)) {
    await pool.query(statement)
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
    dropped_legacy_tables: legacyAiLabTables.length,
  }, null, 2))
} finally {
  await pool.end()
}
