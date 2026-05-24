import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInitialContractDraftFromSource,
  generateContractNumber,
} from './contractDefaults.js'

const template = {
  id: 'template-test',
  title: 'HỢP ĐỒNG DỊCH VỤ',
  seller_entity_code: 'EVENTUS',
  contract_number_pattern: '{{dd}}{{mm}}/HD-{{source_code}}/{{customer_short_code}}/{{yyyy}}',
  service_scope: '',
  schedule_rows: [],
  quote_table_config: {},
  payment_config: {},
  content_sections: [],
  terms_text: 'ĐIỀU 3: NỘI DUNG\nNội dung hợp đồng',
}

test('buildInitialContractDraftFromSource preserves job source snapshots and totals', () => {
  const draft = buildInitialContractDraftFromSource({
    source_type: 'job',
    external_job_id: 42,
    customer_snapshot: {
      company_name: 'Công ty Test Media',
      tax_code: '0100000000',
    },
    quote_snapshot: {
      client_name: 'Công ty Test Media',
      event_name: 'Year End Party',
      total_amount: 12000000,
      subtotal: 11111111,
      vat_amount: 888889,
      has_vat: true,
      items: [{
        service_code: 'JOB_TOTAL',
        service_name: 'Dịch vụ media theo job Year End Party',
        unit: 'Gói',
        quantity: 1,
        num_sessions: 1,
        unit_price: 12000000,
        total_price: 12000000,
      }],
    },
    source_snapshot: {
      source_type: 'job',
      external_job_id: 42,
      job_title: 'Year End Party',
    },
    schedule_rows: [{
      time_range: '08:00 - 17:00',
      date_text: '24/05/2026',
      location: 'Hà Nội',
    }],
  }, template)

  assert.equal(draft.source_type, 'job')
  assert.equal(draft.external_job_id, 42)
  assert.equal(draft.customer_snapshot.company_name, 'Công ty Test Media')
  assert.equal(draft.quote_snapshot.total_amount, 12000000)
  assert.equal(draft.quote_snapshot.items[0].service_name, 'Dịch vụ media theo job Year End Party')
  assert.equal(draft.schedule_rows[0].location, 'Hà Nội')
})

test('generateContractNumber can use job source code without a quote id', () => {
  const contractNumber = generateContractNumber(
    '{{dd}}{{mm}}/HD-{{source_code}}/{{customer_short_code}}/{{yyyy}}',
    {
      source_code: 'JOB42',
      external_job_id: 42,
      client_name: 'Công ty Test Media',
    },
    new Date(2026, 4, 24),
  )

  assert.equal(contractNumber, '2405/HD-JOB42/TM/2026')
})
