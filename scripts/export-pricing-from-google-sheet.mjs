import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT_DIR = process.cwd()
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'src/data/pricing')
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

const SHEETS = [
  {
    name: '01_services',
    output: 'services.json',
    required: ['service_code', 'service_name', 'price_tier_1', 'price_tier_2', 'price_tier_3'],
    transform: transformServices,
  },
  {
    name: '02_travel_fees',
    output: 'travel_fees.json',
    required: ['location', 'fee_per_person_per_day'],
    transform: transformTravelFees,
  },
  {
    name: '03_customer_tiers',
    output: 'customer_tiers.json',
    required: ['tier_code', 'tier_name'],
    transform: rows => rows,
  },
  {
    name: '04_business_rules',
    output: 'business_rules.json',
    required: ['rule_code', 'value'],
    transform: transformBusinessRules,
  },
  {
    name: '05_quote_template',
    output: 'quote_template.json',
    required: ['section', 'field_name', 'value'],
    transform: rows => rows,
  },
  {
    name: '06_legal_entities',
    output: 'legal_entities.json',
    required: ['entity_code', 'entity_name_full'],
    transform: transformLegalEntities,
  },
  {
    name: '07_owner_decisions',
    output: 'owner_decisions.json',
    required: ['question_id', 'status', 'category'],
    transform: rows => rows,
  },
]

function getArg(name) {
  const flag = `--${name}`
  const index = process.argv.indexOf(flag)
  return index >= 0 ? process.argv[index + 1] : null
}

function hasArg(name) {
  return process.argv.includes(`--${name}`)
}

function requiredConfig(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}. Set env or pass CLI flag.`)
  }
  return value
}

function base64Url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: serviceAccount.client_email,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(unsigned)
    .sign(serviceAccount.private_key)

  return `${unsigned}.${base64Url(signature)}`
}

async function getAccessToken(credentialsPath) {
  const serviceAccount = JSON.parse(await fs.readFile(credentialsPath, 'utf8'))
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON must include client_email and private_key.')
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signJwt(serviceAccount),
    }),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.error || 'Could not authenticate Google service account.')
  }
  return payload.access_token
}

async function fetchSheetValues({ spreadsheetId, accessToken }) {
  const params = new URLSearchParams({
    majorDimension: 'ROWS',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })
  SHEETS.forEach(sheet => params.append('ranges', `${sheet.name}!A:Z`))

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Could not read Google Sheet.')
  }
  return payload.valueRanges || []
}

function normalizeHeader(value) {
  return String(value || '').trim()
}

function isBlank(value) {
  return value === undefined || value === null || value === ''
}

function cleanValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value ?? null
}

function tableFromValues(sheetName, values, requiredHeaders) {
  const headerIndex = values.findIndex(row => {
    const headers = row.map(normalizeHeader)
    return requiredHeaders.every(header => headers.includes(header))
  })
  if (headerIndex < 0) {
    throw new Error(`Sheet ${sheetName} is missing required headers: ${requiredHeaders.join(', ')}`)
  }

  const headers = values[headerIndex].map(normalizeHeader)
  return values.slice(headerIndex + 1).map(row => {
    const record = {}
    headers.forEach((header, index) => {
      if (header) record[header] = cleanValue(row[index])
    })
    return record
  }).filter(row => Object.values(row).some(value => !isBlank(value)))
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const normalized = String(value || '').trim().replace(',', '.')
  const match = normalized.match(/\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

function toBoolean(value) {
  return ['có', 'yes', 'true', '1'].includes(String(value || '').trim().toLowerCase())
}

function normalizePercent(value) {
  const number = toNumber(value)
  if (number === null) return null
  if (String(value).includes('%')) return number / 100
  return number > 1 ? number / 100 : number
}

function transformServices(rows) {
  return rows.map((row, index) => ({
    ...row,
    service_code: String(row.service_code || '').trim(),
    is_active: row.is_active === undefined || row.is_active === null ? true : toBoolean(row.is_active),
    sort_order: toNumber(row.sort_order) || index + 1,
  }))
}

function transformTravelFees(rows) {
  return rows.map((row, index) => ({
    ...row,
    fee_per_person_per_day: toNumber(row.fee_per_person_per_day) ?? 0,
    includes_accommodation: toBoolean(row.includes_accommodation),
    includes_transport: toBoolean(row.includes_transport),
    is_active: row.is_active === undefined || row.is_active === null ? true : toBoolean(row.is_active),
    sort_order: toNumber(row.sort_order) || index + 1,
  }))
}

function transformBusinessRules(rows) {
  const rules = rows.map(row => ({
    ...row,
    rule_code: String(row.rule_code || '').trim(),
    rule_value: row.rule_value ?? row.value,
  }))

  const ruleMap = Object.fromEntries(rules.map(row => [row.rule_code, row.rule_value]))
  const derived = [
    {
      rule_code: 'VAT_RATE',
      category: 'Pricing',
      rule_name: 'VAT rate normalized',
      value: normalizePercent(ruleMap.VAT),
      description: 'Derived from VAT for app pricing calculator',
    },
    {
      rule_code: 'HALF_DAY_THRESHOLD',
      category: 'Pricing',
      rule_name: 'Half-day threshold normalized',
      value: toNumber(ruleMap.OT_THRESHOLD) || toNumber(ruleMap.HALF_DAY_DEFINITION) || 4.5,
      description: 'Derived from OT_THRESHOLD for app service matching',
    },
    {
      rule_code: 'FULL_DAY_THRESHOLD',
      category: 'Pricing',
      rule_name: 'Full-day threshold normalized',
      value: toNumber(ruleMap.FULL_DAY_DEFINITION) || 8,
      description: 'Derived from FULL_DAY_DEFINITION for overtime calculation',
    },
  ].map(row => ({ ...row, rule_value: row.value, derived: true }))

  return [...rules, ...derived]
}

function transformLegalEntities(rows) {
  const codeMap = {
    EVT: 'EVENTUS',
    MMS: 'MEDIAMONSTER',
  }

  return rows.map((row, index) => {
    const sourceCode = String(row.entity_code || '').trim()
    const code = codeMap[sourceCode] || sourceCode
    const displayName = code === 'EVENTUS' ? 'Eventus' : code === 'MEDIAMONSTER' ? 'Mediamonster' : row.entity_name_full

    return {
      ...row,
      source_entity_code: sourceCode,
      entity_code: code,
      code,
      name: row.entity_name_full,
      legal_name: row.entity_name_full,
      display_name: displayName,
      is_default: toBoolean(row.is_default),
      is_active: row.is_active === undefined || row.is_active === null ? true : toBoolean(row.is_active),
      sort_order: toNumber(row.sort_order) || index + 1,
    }
  })
}

function assertUnique(rows, field, label) {
  const seen = new Set()
  rows.forEach((row, index) => {
    const value = row[field]
    if (!value) throw new Error(`${label} row ${index + 1} is missing ${field}.`)
    if (seen.has(value)) throw new Error(`${label} has duplicated ${field}: ${value}`)
    seen.add(value)
  })
}

function validatePricingData(data) {
  const services = data['services.json'] || []
  const travelFees = data['travel_fees.json'] || []
  const tiers = data['customer_tiers.json'] || []
  const rules = data['business_rules.json'] || []
  const entities = data['legal_entities.json'] || []

  if (services.length < 50 && !hasArg('allow-small-service-catalog')) {
    throw new Error(`Services catalog has only ${services.length} rows. Expected around 53. Pass --allow-small-service-catalog if intentional.`)
  }
  assertUnique(services, 'service_code', 'services')

  services.forEach(service => {
    ;['price_tier_1', 'price_tier_2', 'price_tier_3'].forEach(field => {
      if (!Number.isFinite(Number(service[field]))) {
        throw new Error(`Service ${service.service_code} has invalid ${field}: ${service[field]}`)
      }
    })
  })

  travelFees.forEach(row => {
    if (!row.location) throw new Error('travel_fees has a row without location.')
    if (!Number.isFinite(Number(row.fee_per_person_per_day))) {
      throw new Error(`Travel fee ${row.location} has invalid fee_per_person_per_day.`)
    }
  })

  assertUnique(tiers, 'tier_code', 'customer_tiers')
  assertUnique(rules, 'rule_code', 'business_rules')
  ;['VAT_RATE', 'HALF_DAY_THRESHOLD', 'FULL_DAY_THRESHOLD', 'OVERTIME_HOURLY_FEE'].forEach(code => {
    if (!rules.some(row => row.rule_code === code)) throw new Error(`business_rules is missing ${code}.`)
  })

  assertUnique(entities, 'entity_code', 'legal_entities')
  if (!entities.some(row => row.is_default)) throw new Error('legal_entities must include one default entity.')
}

async function writeJson(outputDir, fileName, data) {
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(path.join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function main() {
  const credentialsPath = requiredConfig(
    'GOOGLE_SERVICE_ACCOUNT_KEY_FILE',
    getArg('credentials') || process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
  )
  const spreadsheetId = requiredConfig(
    'PRICING_SPREADSHEET_ID',
    getArg('spreadsheet-id') || process.env.PRICING_SPREADSHEET_ID,
  )
  const outputDir = path.resolve(getArg('output-dir') || process.env.PRICING_OUTPUT_DIR || DEFAULT_OUTPUT_DIR)
  const dryRun = hasArg('dry-run')

  const accessToken = await getAccessToken(credentialsPath)
  const valueRanges = await fetchSheetValues({ spreadsheetId, accessToken })
  const bySheet = new Map(valueRanges.map((range, index) => [SHEETS[index].name, range.values || []]))
  const output = {}

  SHEETS.forEach(sheet => {
    const rows = tableFromValues(sheet.name, bySheet.get(sheet.name) || [], sheet.required)
    output[sheet.output] = sheet.transform(rows)
  })

  validatePricingData(output)

  const metadata = {
    source: `google-sheet:${spreadsheetId}`,
    generated_at: new Date().toISOString(),
    services_count: output['services.json'].length,
    travel_fees_count: output['travel_fees.json'].length,
    business_rules_count: output['business_rules.json'].length,
  }
  output['metadata.json'] = metadata

  if (!dryRun) {
    await Promise.all(Object.entries(output).map(([fileName, data]) => writeJson(outputDir, fileName, data)))
  }

  console.log(JSON.stringify({
    ok: true,
    dry_run: dryRun,
    output_dir: outputDir,
    ...metadata,
  }, null, 2))
}

main().catch(error => {
  console.error(error?.message || error)
  process.exit(1)
})
