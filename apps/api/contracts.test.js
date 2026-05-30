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

test('document number metadata is immutable after a document has been numbered', () => withFakeContractsApi(async () => {
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

  assert.equal(updated.document_number, saved.document_number)
  assert.equal(updated.sequence_number, saved.sequence_number)
  assert.equal(updated.sequence_year, saved.sequence_year)
  assert.equal(updated.document_number_pattern, saved.document_number_pattern)
  assert.equal(updated.seller_entity_code, saved.seller_entity_code)
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
