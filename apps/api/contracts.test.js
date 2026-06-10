import assert from 'node:assert/strict'
import test from 'node:test'
import { __contractsTestInternals, configureContractsApiForTest } from './contracts.js'
import { tables } from './lib/mysql.js'

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

function nowText() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function createFakeContractsApi() {
  const state = {
    [tables.contracts]: new Map(),
    [tables.contractTemplates]: new Map(),
    [tables.contractDocumentTemplates]: new Map(),
    [tables.contractDocuments]: new Map(),
    [tables.contractDocumentNumberCounters]: new Map(),
    [tables.contractDocumentNumberLedger]: new Map(),
    [tables.quotes]: new Map(),
  }

  const rowsFor = tableName => Array.from(state[tableName].values())
  const active = row => !row.deleted_at

  function selectFirst(tableName, predicate) {
    const row = rowsFor(tableName).find(predicate)
    return row ? [clone(row)] : []
  }

  async function execute(sql, params = []) {
    const compactSql = String(sql).replace(/\s+/g, ' ').trim().toLowerCase()

    if (compactSql.startsWith(`select * from ${tables.quotes}`)) {
      return selectFirst(tables.quotes, row => row.id === params[0])
    }

    if (compactSql.startsWith(`select * from ${tables.contractDocumentTemplates}`)) {
      const id = params[0]
      const includeDeleted = compactSql.includes('where id = ? limit 1')
      return selectFirst(tables.contractDocumentTemplates, row => (
        row.id === id && (includeDeleted || active(row))
      ))
    }

    if (compactSql.startsWith(`select * from ${tables.contractDocuments} where id = ?`)) {
      const id = params[0]
      const includeDeleted = compactSql.includes('where id = ? limit 1')
      return selectFirst(tables.contractDocuments, row => (
        row.id === id && (includeDeleted || active(row))
      ))
    }

    if (compactSql.startsWith(`select d.* from ${tables.contractDocuments} d inner join ${tables.contracts} c`)) {
      return selectFirst(tables.contractDocuments, row => {
        const contract = state[tables.contracts].get(row.contract_id)
        return row.share_token === params[0] && active(row) && contract && active(contract)
      })
    }

    if (compactSql.startsWith(`select id, contract_id, document_type, document_number, title from ${tables.contractDocuments}`)) {
      return selectFirst(tables.contractDocuments, row => row.id === params[0] && active(row))
    }

    if (compactSql.startsWith(`select id, contract_id, document_type, document_number, share_token, issued_date, created_at from ${tables.contractDocuments}`)) {
      const documentTypes = ['advance_request', 'acceptance_liquidation', 'payment_request']
      const contractIds = new Set(params.slice(0, -documentTypes.length * 2))
      const allowedTypes = new Set(params.slice(contractIds.size, contractIds.size + documentTypes.length))

      return rowsFor(tables.contractDocuments)
        .filter(row => contractIds.has(row.contract_id) && active(row) && allowedTypes.has(row.document_type))
        .sort((left, right) => {
          const contractSort = String(left.contract_id).localeCompare(String(right.contract_id))
          if (contractSort !== 0) return contractSort
          const typeSort = documentTypes.indexOf(left.document_type) - documentTypes.indexOf(right.document_type)
          if (typeSort !== 0) return typeSort
          return String(right.issued_date || '').localeCompare(String(left.issued_date || '')) ||
            String(right.created_at || '').localeCompare(String(left.created_at || ''))
        })
        .map(clone)
    }

    if (compactSql.startsWith(`select * from ${tables.contractDocuments} where contract_id = ?`)) {
      const [contractId, documentType] = params
      return rowsFor(tables.contractDocuments)
        .filter(row => row.contract_id === contractId && active(row))
        .filter(row => !compactSql.includes('document_type = ?') || row.document_type === documentType)
        .map(clone)
    }

    if (compactSql.startsWith(`insert into ${tables.contractDocumentNumberCounters}`)) {
      const [id, sellerEntityCode, documentType, sequenceYear] = params
      const existing = state[tables.contractDocumentNumberCounters].get(id)
      const nextSequence = Number(existing?.last_sequence || 0) + 1
      state[tables.contractDocumentNumberCounters].set(id, {
        id,
        seller_entity_code: sellerEntityCode,
        document_type: documentType,
        sequence_year: sequenceYear,
        last_sequence: nextSequence,
        updated_at: nowText(),
      })
      return []
    }

    if (compactSql.startsWith(`select last_sequence from ${tables.contractDocumentNumberCounters}`)) {
      const row = state[tables.contractDocumentNumberCounters].get(params[0])
      return row ? [{ last_sequence: row.last_sequence }] : []
    }

    if (compactSql.startsWith(`select id from ${tables.contractDocumentNumberLedger} where document_id = ?`)) {
      return selectFirst(tables.contractDocumentNumberLedger, row => row.document_id === params[0])
        .map(row => ({ id: row.id }))
    }

    if (compactSql.startsWith(`update ${tables.contractDocuments} set deleted_at = current_timestamp(3) where id = ?`)) {
      const row = state[tables.contractDocuments].get(params[0])
      if (row && active(row)) row.deleted_at = nowText()
      return []
    }

    if (compactSql.startsWith(`select id from ${tables.contracts} where id = ? and deleted_at is null`)) {
      return rowsFor(tables.contracts)
        .filter(row => row.id === params[0] && active(row))
        .map(row => ({ id: row.id }))
    }

    if (compactSql.startsWith(`select id from ${tables.contracts} where quote_id = ? and deleted_at is null`)) {
      return rowsFor(tables.contracts)
        .filter(row => row.quote_id === params[0] && active(row))
        .map(row => ({ id: row.id }))
    }

    if (compactSql.startsWith(`update ${tables.contracts} set deleted_at = current_timestamp(3), updated_at = current_timestamp(3) where id = ?`)) {
      const row = state[tables.contracts].get(params[0])
      if (row) {
        row.deleted_at = nowText()
        row.updated_at = row.deleted_at
      }
      return []
    }

    if (compactSql.startsWith(`update ${tables.contracts} set deleted_at = current_timestamp(3), updated_at = current_timestamp(3) where quote_id = ?`)) {
      rowsFor(tables.contracts).forEach(row => {
        if (row.quote_id === params[0]) {
          row.deleted_at = nowText()
          row.updated_at = row.deleted_at
        }
      })
      return []
    }

    if (compactSql.startsWith(`update ${tables.contractDocuments} set deleted_at = current_timestamp(3), updated_at = current_timestamp(3) where contract_id in`)) {
      const contractIds = new Set(params)
      rowsFor(tables.contractDocuments).forEach(row => {
        if (contractIds.has(row.contract_id) && active(row)) {
          row.deleted_at = nowText()
          row.updated_at = row.deleted_at
        }
      })
      return []
    }

    if (compactSql.startsWith(`update ${tables.contractDocuments} set contract_snapshot = ?`)) {
      const [contractSnapshot, contractId] = params
      rowsFor(tables.contractDocuments).forEach(row => {
        if (
          row.contract_id === contractId
          && active(row)
          && (row.auto_sync_contract === true || row.auto_sync_contract === 1)
          && ['draft', 'open'].includes(String(row.status || 'draft'))
        ) {
          row.contract_snapshot = contractSnapshot
          row.updated_at = nowText()
        }
      })
      return []
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where id = ? and deleted_at is null`)) {
      return selectFirst(tables.contracts, row => row.id === params[0] && active(row))
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where id = ? limit 1`)) {
      return selectFirst(tables.contracts, row => row.id === params[0])
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where quote_id = ? and deleted_at is null`)) {
      return selectFirst(tables.contracts, row => row.quote_id === params[0] && active(row))
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where source_type = 'job' and external_job_id = ? and deleted_at is null`)) {
      return selectFirst(tables.contracts, row => row.source_type === 'job' && row.external_job_id === params[0] && active(row))
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where quote_id = ? and deleted_at is not null`)) {
      return selectFirst(tables.contracts, row => row.quote_id === params[0] && row.deleted_at)
    }

    if (compactSql.startsWith(`select * from ${tables.contracts} where source_type = 'job' and external_job_id = ? and deleted_at is not null`)) {
      return selectFirst(tables.contracts, row => row.source_type === 'job' && row.external_job_id === params[0] && row.deleted_at)
    }

    if (compactSql.startsWith(`select count(*) as count from ${tables.contracts} c`)) {
      return [{ count: rowsFor(tables.contracts).filter(active).length }]
    }

    if (compactSql.startsWith(`select c.* from ${tables.contracts} c`)) {
      return rowsFor(tables.contracts)
        .filter(active)
        .sort((left, right) => (
          String(right.updated_at || '').localeCompare(String(left.updated_at || '')) ||
          String(right.created_at || '').localeCompare(String(left.created_at || ''))
        ))
        .map(clone)
    }

    throw new Error(`Unhandled fake SQL: ${compactSql}`)
  }

  async function query(sql, params = []) {
    return execute(sql, params)
  }

  async function withTransaction(callback) {
    return callback({
      query: async (sql, params = []) => [await execute(sql, params)],
    })
  }

  async function insertRow(_connection, tableName, payload = {}) {
    const row = {
      ...clone(payload),
      created_at: payload.created_at || nowText(),
      updated_at: payload.updated_at || nowText(),
      deleted_at: payload.deleted_at ?? null,
    }
    state[tableName].set(row.id, row)
  }

  async function updateRow(_connection, tableName, payload = {}, whereSql, whereParams = []) {
    assert.equal(whereSql, 'id = ?')
    const row = state[tableName].get(whereParams[0])
    if (!row) return
    Object.assign(row, clone(payload), { updated_at: nowText() })
  }

  return {
    deps: {
      insertRow,
      query,
      requireEventusAuth: async () => true,
      updateRow,
      withTransaction,
    },
    state,
  }
}

async function withFakeContractsApi(run) {
  const fakeApi = createFakeContractsApi()
  const restore = configureContractsApiForTest(fakeApi.deps)
  try {
    return await run(fakeApi)
  } finally {
    restore()
  }
}

async function createContract(overrides = {}) {
  return __contractsTestInternals.saveContract({
    id: 'contract-1',
    source_type: 'manual',
    contract_number: 'HD-001',
    title: 'Hop dong dich vu',
    seller_entity_code: 'EVT',
    customer_snapshot: {
      customer_code: 'ACME',
      company_name: 'Cong ty ACME',
    },
    quote_snapshot: {
      has_vat: true,
      vat_rate: 0.08,
      subtotal: 10_000_000,
      total_amount: 10_800_000,
      items: [],
    },
    payment_config: {
      deposit_percent: 50,
    },
    terms_text: 'Dieu khoan hop dong',
    ...overrides,
  })
}

function createDocument(contract, documentType = 'advance_request', overrides = {}) {
  return __contractsTestInternals.saveDocument({
    contract_id: contract.id,
    document_type: documentType,
    status: 'draft',
    issued_date: '2026-05-27',
    title: 'Chung tu hop dong',
    document_data: {
      form_data: {},
      amount_config: {},
    },
    ...overrides,
  })
}

test('new contracts get short ct-prefixed ids by default', () => withFakeContractsApi(async () => {
  const contract = await createContract({ id: undefined })

  assert.match(contract.id, /^ct_[0-9a-f]{16}$/)
}))

test('contract list includes related document badges', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  await createDocument(contract, 'advance_request', {
    id: 'advance-old',
    issued_date: '2026-01-01',
  })
  const latestAdvance = await createDocument(contract, 'advance_request', {
    id: 'advance-new',
    issued_date: '2026-06-01',
  })
  const acceptance = await createDocument(contract, 'acceptance_liquidation', {
    id: 'acceptance-1',
    issued_date: '2026-06-02',
  })
  const payment = await createDocument(contract, 'payment_request', {
    id: 'payment-1',
    issued_date: '2026-06-03',
    document_data: {
      form_data: {
        acceptance_document_id: acceptance.id,
      },
      amount_config: {},
    },
  })

  const result = await __contractsTestInternals.listContracts({ pageSize: 50 })
  const row = result.contracts.find(item => item.id === contract.id)

  assert.deepEqual(row.contract_documents.map(document => document.label), [
    'Đề nghị tạm ứng',
    'Biên bản nghiệm thu',
    'Đề nghị thanh toán',
  ])
  assert.deepEqual(row.contract_documents.map(document => document.id), [
    latestAdvance.id,
    acceptance.id,
    payment.id,
  ])
  assert.equal(row.contract_documents[0].contract_id, contract.id)
}))

test('creates multiple documents of the same type in one contract', () => withFakeContractsApi(async () => {
  const contract = await createContract()

  const first = await createDocument(contract, 'advance_request')
  const second = await createDocument(contract, 'advance_request')

  assert.match(first.id, /^doc_[A-HJ-NP-Z2-9]{12}$/)
  assert.match(second.id, /^doc_[A-HJ-NP-Z2-9]{12}$/)
  assert.equal(first.contract_id, contract.id)
  assert.equal(second.contract_id, contract.id)
  assert.equal(first.document_type, 'advance_request')
  assert.equal(second.document_type, 'advance_request')
  assert.equal(first.sequence_number, 1)
  assert.equal(second.sequence_number, 2)
  assert.notEqual(first.document_number, second.document_number)
}))

test('document numbers advance and are not reused after delete', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const first = await createDocument(contract, 'advance_request')
  const second = await createDocument(contract, 'advance_request')

  await __contractsTestInternals.deleteDocument(first.id)
  const third = await createDocument(contract, 'advance_request')

  assert.equal(second.sequence_number, 2)
  assert.equal(third.sequence_number, 3)
  assert.match(third.document_number, /^0003\/DNTU-EVT\/ACME\/2026$/)
}))

test('changing document seller reallocates its number in the new seller sequence', () => withFakeContractsApi(async ({ state }) => {
  const contract = await createContract()
  const saved = await createDocument(contract, 'advance_request')

  const updated = await __contractsTestInternals.saveDocument({
    id: saved.id,
    contract_id: contract.id,
    document_type: 'advance_request',
    status: 'draft',
    issued_date: '2027-01-01',
    document_number: 'MANUAL-CHANGE',
    document_number_pattern: 'BROKEN-{{sequence}}',
    seller_entity_code: 'OTHER',
  })

  assert.match(updated.document_number, /^0001\/DNTU-OTHER\/ACME\/2026$/)
  assert.equal(updated.sequence_number, 1)
  assert.equal(updated.sequence_year, saved.sequence_year)
  assert.equal(updated.document_number_pattern, saved.document_number_pattern)
  assert.equal(updated.seller_entity_code, 'OTHER')

  const ledger = Array.from(state[tables.contractDocumentNumberLedger].values())
    .find(row => row.document_id === saved.id)
  assert.equal(ledger.seller_entity_code, 'OTHER')
  assert.equal(ledger.document_number, updated.document_number)
}))

test('changing seller uses the next available sequence in the target seller scope', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const saved = await createDocument(contract, 'advance_request')
  await createDocument(contract, 'advance_request', { seller_entity_code: 'MEDIAMONSTER' })

  const updated = await __contractsTestInternals.saveDocument({
    id: saved.id,
    contract_id: contract.id,
    document_type: 'advance_request',
    status: 'draft',
    issued_date: '2026-05-27',
    seller_entity_code: 'MEDIAMONSTER',
  })

  assert.equal(updated.sequence_number, 2)
  assert.match(updated.document_number, /^0002\/DNTU-MEDIAMONSTER\/ACME\/2026$/)
}))

test('soft-deleting a contract also soft-deletes its documents', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const advance = await createDocument(contract, 'advance_request')
  const acceptance = await createDocument(contract, 'acceptance_liquidation')

  await __contractsTestInternals.deleteContract({ id: contract.id })

  assert.equal(await __contractsTestInternals.getDocumentById(advance.id), null)
  assert.equal(await __contractsTestInternals.getDocumentById(acceptance.id), null)
  assert.equal((await __contractsTestInternals.listDocumentsByContract({ contract_id: contract.id })).length, 0)
}))

test('public token does not return a soft-deleted document', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const document = await createDocument(contract, 'advance_request')

  assert.equal((await __contractsTestInternals.getDocumentByShareToken(document.share_token)).document_number, document.document_number)

  await __contractsTestInternals.deleteDocument(document.id)

  assert.equal(await __contractsTestInternals.getDocumentByShareToken(document.share_token), null)
}))

test('public token does not return a document when parent contract is soft-deleted', () => withFakeContractsApi(async ({ state }) => {
  const contract = await createContract()
  const document = await createDocument(contract, 'advance_request')

  state[tables.contracts].get(contract.id).deleted_at = nowText()

  assert.equal(await __contractsTestInternals.getDocumentByShareToken(document.share_token), null)
}))

test('public document response omits raw internal contract snapshot fields', () => withFakeContractsApi(async () => {
  const contract = await createContract({
    quote_id: null,
    quote_number: 'Q-PRIVATE',
    source_type: 'manual',
    source_snapshot: {
      internal_job_note: 'do not expose',
    },
    quote_snapshot: {
      share_token: 'quote-token',
      client_name: 'Private Client',
      event_name: 'Private Event',
      has_vat: true,
      vat_rate: 0.08,
      subtotal: 10_000_000,
      total_amount: 10_800_000,
      items: [{ service_name: 'Internal service', total_price: 10_000_000 }],
    },
  })
  const document = await createDocument(contract, 'advance_request')

  const publicDocument = await __contractsTestInternals.getDocumentByShareToken(document.share_token)

  assert.equal(publicDocument.id, undefined)
  assert.equal(publicDocument.contract_id, undefined)
  assert.equal(publicDocument.share_token, undefined)
  assert.equal(publicDocument.contract_snapshot.source_snapshot, undefined)
  assert.equal(publicDocument.contract_snapshot.quote_id, undefined)
  assert.equal(publicDocument.contract_snapshot.quote_snapshot.items, undefined)
  assert.equal(publicDocument.contract_snapshot.quote_snapshot.share_token, undefined)
  assert.equal(publicDocument.contract_snapshot.quote_snapshot.total_amount, 10_800_000)
}))

test('template updates do not rewrite an already-created document snapshot', () => withFakeContractsApi(async ({ state }) => {
  state[tables.contractDocumentTemplates].set('tpl-1', {
    id: 'tpl-1',
    document_type: 'advance_request',
    name: 'Template v1',
    title: 'Title v1',
    seller_entity_code: 'EVT',
    document_number_pattern: '{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}',
    fields_config: '{}',
    numbering_config: '{}',
    content_sections: '[]',
    terms_text: 'Terms v1',
    is_default: 1,
    is_active: 1,
    sort_order: 10,
    deleted_at: null,
    created_at: '2026-05-01 00:00:00',
    updated_at: '2026-05-01 00:00:00',
  })
  const contract = await createContract()
  const document = await createDocument(contract, 'advance_request', { template_id: 'tpl-1' })

  state[tables.contractDocumentTemplates].set('tpl-1', {
    ...state[tables.contractDocumentTemplates].get('tpl-1'),
    name: 'Template v2',
    title: 'Title v2',
    terms_text: 'Terms v2',
    updated_at: '2026-05-02 00:00:00',
  })

  const updated = await __contractsTestInternals.saveDocument({
    id: document.id,
    contract_id: contract.id,
    document_type: 'advance_request',
    status: 'draft',
    document_data: {
      form_data: { note: 'edited' },
    },
  })

  assert.equal(updated.template_snapshot.title, 'Title v1')
  assert.equal(updated.template_snapshot.terms_text, 'Terms v1')
  assert.equal(updated.terms_text, 'Terms v1')
}))

test('explicit document template refresh replaces the snapshot without changing numbering metadata', () => withFakeContractsApi(async ({ state }) => {
  state[tables.contractDocumentTemplates].set('tpl-1', {
    id: 'tpl-1',
    document_type: 'advance_request',
    name: 'Template v1',
    title: 'Title v1',
    seller_entity_code: 'EVT',
    document_number_pattern: '{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}',
    fields_config: '{}',
    numbering_config: '{}',
    content_sections: JSON.stringify([{ id: 'old-section', body: 'Old section' }]),
    terms_text: 'Terms v1',
    is_default: 1,
    is_active: 1,
    sort_order: 10,
    deleted_at: null,
    created_at: '2026-05-01 00:00:00',
    updated_at: '2026-05-01 00:00:00',
  })
  state[tables.contractDocumentTemplates].set('tpl-2', {
    id: 'tpl-2',
    document_type: 'advance_request',
    name: 'Template v2',
    title: 'Title v2',
    seller_entity_code: 'MEDIAMONSTER',
    document_number_pattern: 'DIFF-{{sequence}}/{{seller}}/{{year}}',
    fields_config: '{}',
    numbering_config: '{}',
    content_sections: JSON.stringify([{ id: 'new-section', body: 'New section' }]),
    terms_text: 'Terms v2',
    is_default: 0,
    is_active: 1,
    sort_order: 20,
    deleted_at: null,
    created_at: '2026-05-02 00:00:00',
    updated_at: '2026-05-02 00:00:00',
  })
  const contract = await createContract()
  const document = await createDocument(contract, 'advance_request', { template_id: 'tpl-1' })

  const updated = await __contractsTestInternals.saveDocument({
    id: document.id,
    contract_id: contract.id,
    document_type: 'advance_request',
    status: 'draft',
    template_id: 'tpl-2',
    title: 'Title v2',
    refresh_template_snapshot: true,
    content_sections: [{ id: 'new-section', body: 'New section' }],
    terms_text: 'Terms v2',
    template_snapshot: {
      id: 'tpl-2',
      document_type: 'advance_request',
      name: 'Template v2',
      title: 'Title v2',
      seller_entity_code: 'MEDIAMONSTER',
      document_number_pattern: 'DIFF-{{sequence}}/{{seller}}/{{year}}',
      content_sections: [{ id: 'new-section', body: 'New section' }],
      terms_text: 'Terms v2',
    },
    document_data: {
      form_data: { request_content: '' },
    },
  })

  assert.equal(updated.template_id, 'tpl-2')
  assert.equal(updated.template_snapshot.title, 'Title v2')
  assert.equal(updated.template_snapshot.terms_text, 'Terms v2')
  assert.equal(updated.title, 'Title v2')
  assert.equal(updated.content_sections[0].id, 'new-section')
  assert.equal(updated.terms_text, 'Terms v2')
  assert.equal(updated.document_number, document.document_number)
  assert.equal(updated.sequence_number, document.sequence_number)
  assert.equal(updated.document_number_pattern, document.document_number_pattern)
  assert.equal(updated.seller_entity_code, document.seller_entity_code)
}))

test('finalized documents cannot refresh their template snapshot', () => withFakeContractsApi(async ({ state }) => {
  state[tables.contractDocumentTemplates].set('tpl-1', {
    id: 'tpl-1',
    document_type: 'advance_request',
    name: 'Template v1',
    title: 'Title v1',
    seller_entity_code: 'EVT',
    document_number_pattern: '{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}',
    fields_config: '{}',
    numbering_config: '{}',
    content_sections: '[]',
    terms_text: 'Terms v1',
    is_default: 1,
    is_active: 1,
    sort_order: 10,
    deleted_at: null,
    created_at: '2026-05-01 00:00:00',
    updated_at: '2026-05-01 00:00:00',
  })
  const contract = await createContract()
  const document = await createDocument(contract, 'advance_request', { status: 'finalized', template_id: 'tpl-1' })

  await assert.rejects(
    () => __contractsTestInternals.saveDocument({
      id: document.id,
      contract_id: contract.id,
      document_type: 'advance_request',
      status: 'finalized',
      template_id: 'tpl-1',
      refresh_template_snapshot: true,
      template_snapshot: { id: 'tpl-1', title: 'Changed' },
    }),
    /Khong doi mau chung tu da finalized/,
  )
}))

test('open documents auto-sync contract snapshots when the contract changes', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const openDocument = await createDocument(contract, 'advance_request', { status: 'open' })
  const finalizedDocument = await createDocument(contract, 'acceptance_liquidation', { status: 'finalized' })

  await createContract({
    id: contract.id,
    customer_snapshot: {
      customer_code: 'ACME',
      company_name: 'Cong ty ACME Updated',
    },
  })

  const synced = await __contractsTestInternals.getDocumentById(openDocument.id)
  const untouched = await __contractsTestInternals.getDocumentById(finalizedDocument.id)

  assert.equal(synced.contract_snapshot.customer_snapshot.company_name, 'Cong ty ACME Updated')
  assert.equal(untouched.contract_snapshot.customer_snapshot.company_name, 'Cong ty ACME')
}))

test('payment request must link an active acceptance document from the same contract', () => withFakeContractsApi(async () => {
  const contract = await createContract()

  await assert.rejects(
    () => createDocument(contract, 'payment_request', {
      document_data: {
        form_data: {},
        amount_config: {},
      },
    }),
    /can lien ket voi mot BBNT/,
  )

  const otherContract = await createContract({ id: 'contract-2', contract_number: 'HD-002' })
  const otherAcceptance = await createDocument(otherContract, 'acceptance_liquidation')

  await assert.rejects(
    () => createDocument(contract, 'payment_request', {
      document_data: {
        form_data: {
          acceptance_document_id: otherAcceptance.id,
        },
        amount_config: {},
      },
    }),
    /BBNT lien ket khong hop le/,
  )
}))

test('payment request only accepts active advance deductions from the same contract', () => withFakeContractsApi(async () => {
  const contract = await createContract()
  const acceptance = await createDocument(contract, 'acceptance_liquidation')
  const advance = await createDocument(contract, 'advance_request')
  const otherContract = await createContract({ id: 'contract-2', contract_number: 'HD-002' })
  const otherAdvance = await createDocument(otherContract, 'advance_request')

  await assert.rejects(
    () => createDocument(contract, 'payment_request', {
      document_data: {
        form_data: {
          acceptance_document_id: acceptance.id,
          advance_deductions: [{ document_id: otherAdvance.id, deduction_amount: 1_000_000 }],
        },
        amount_config: {},
      },
    }),
    /De nghi tam ung khau tru khong hop le/,
  )

  const payment = await createDocument(contract, 'payment_request', {
    document_data: {
      form_data: {
        acceptance_document_id: acceptance.id,
        advance_deductions: [{ document_id: advance.id, deduction_amount: 1_000_000 }],
      },
      amount_config: {},
    },
  })

  assert.equal(payment.document_type, 'payment_request')
}))
