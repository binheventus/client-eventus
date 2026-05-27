import mysql from 'mysql2/promise'
import { loadServerEnv } from './server-env.js'

let pool

export const tables = {
  customers: 'customers',
  clients: 'client_customers',
  quotes: 'client_quotes',
  quoteItems: 'client_quote_items',
  quoteViews: 'client_quote_views',
  contracts: 'client_contracts',
  contractTemplates: 'client_contract_templates',
  contractDocumentTemplates: 'client_contract_document_templates',
  contractDocuments: 'client_contract_documents',
  contractDocumentNumberCounters: 'client_contract_document_number_counters',
  contractDocumentNumberLedger: 'client_contract_document_number_ledger',
  pages: 'client_pages',
  jobs: 'jobs',
}

function getDbConfig() {
  loadServerEnv()

  if ((process.env.DB_CONNECTION || 'mysql') !== 'mysql') {
    throw new Error('DB_CONNECTION phai la mysql cho che do local.')
  }

  const required = ['DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME']
  const missing = required.filter(key => !process.env[key])
  if (missing.length) {
    throw new Error(`Thieu cau hinh database: ${missing.join(', ')}.`)
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    namedPlaceholders: false,
  }
}

export function getPool() {
  if (!pool) pool = mysql.createPool(getDbConfig())
  return pool
}

function normalizeSqlParams(params = []) {
  return params.map(value => value === undefined ? null : value)
}

function runSql(client, sql, params = []) {
  return client.query(sql, normalizeSqlParams(params))
}

function makeTransactionClient(connection) {
  return {
    ...connection,
    query: (sql, params = []) => runSql(connection, sql, params),
  }
}

export async function query(sql, params = []) {
  const [rows] = await runSql(getPool(), sql, params)
  return rows
}

export async function withTransaction(callback) {
  const connection = await getPool().getConnection()
  try {
    await connection.beginTransaction()
    const result = await callback(makeTransactionClient(connection))
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export function nowMysql() {
  return toMysqlDateTime(new Date())
}

export function toMysqlDateTime(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

export function emptyToNull(value) {
  return value === undefined || value === '' ? null : value
}

export function toJson(value, fallback) {
  if (value === undefined) return JSON.stringify(fallback)
  return JSON.stringify(value ?? fallback)
}

export function fromJson(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === '1'
}

export function normalizeNumber(value) {
  if (value === undefined || value === null || value === '') return value
  const number = Number(value)
  return Number.isFinite(number) ? number : value
}

export async function insertRow(connection, tableName, payload = {}) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined)
  if (!entries.length) throw new Error(`Khong co du lieu de insert vao ${tableName}.`)

  const columns = entries.map(([key]) => `\`${key}\``).join(', ')
  const placeholders = entries.map(() => '?').join(', ')
  const values = entries.map(([, value]) => value)
  await connection.query(`insert into \`${tableName}\` (${columns}) values (${placeholders})`, values)
}

export async function updateRow(connection, tableName, payload = {}, whereSql, whereParams = []) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined)
  if (!entries.length) return

  const assignments = entries.map(([key]) => `\`${key}\` = ?`).join(', ')
  const values = entries.map(([, value]) => value)
  await connection.query(`update \`${tableName}\` set ${assignments} where ${whereSql}`, [...values, ...whereParams])
}
