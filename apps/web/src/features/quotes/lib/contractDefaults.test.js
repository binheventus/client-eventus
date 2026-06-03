import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applySellerEntityToContractNumber,
  applySellerEntityToContractNumberPattern,
  buildInitialContractDraft,
  buildInitialContractDraftFromSource,
  buildSingleLineQuoteSnapshot,
  generateContractNumber,
  getContractWorkDurationText,
  getContractWorkProgressNotes,
  getEntityProfile,
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

test('buildInitialContractDraft generates a contract number for new quote contracts', () => {
  const draft = buildInitialContractDraft({
    id: 'quote-1',
    client_name: 'Công ty Minh Anh',
    entity_code: 'EVENTUS',
  }, {
    ...template,
    contract_number_pattern: '{{dd}}{{mm}}/HDEVT-{{customer_short_code}}/{{yyyy}}',
  })

  assert.match(draft.contract_number, /^\d{4}\/HDEVT-MA\/\d{4}$/)
})

test('getEntityProfile uses full legal entity name for contract party fields', () => {
  const profile = getEntityProfile('EVENTUS')

  assert.equal(profile.company_name, 'CÔNG TY TNHH EVENTUS VIỆT NAM')
  assert.equal(profile.company_name, profile.entity_name_full)
})

test('buildInitialContractDraftFromSource preserves job source snapshots and totals', () => {
  const draft = buildInitialContractDraftFromSource({
    source_type: 'job',
    external_job_id: 42,
    service_scope: 'cung cấp dịch vụ media theo job Year End Party',
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
  assert.equal(draft.service_scope, 'cung cấp dịch vụ media theo job Year End Party')
  assert.equal(draft.quote_snapshot.total_amount, 12000000)
  assert.equal(draft.quote_snapshot.items[0].service_name, 'Dịch vụ media theo job Year End Party')
  assert.equal(draft.schedule_rows[0].location, 'Hà Nội')
  assert.match(draft.contract_number, /^\d{4}\/HD-JOB42\/TM\/\d{4}$/)
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

test('applySellerEntityToContractNumberPattern switches entity prefixes', () => {
  const pattern = '{{dd}}{{mm}}/HDMMT-{{customer_short_code}}/{{yyyy}}'

  assert.equal(
    applySellerEntityToContractNumberPattern(pattern, 'EVENTUS'),
    '{{dd}}{{mm}}/HDEVT-{{customer_short_code}}/{{yyyy}}',
  )
  assert.equal(
    applySellerEntityToContractNumberPattern('{{dd}}{{mm}}/HDEVT-{{customer_short_code}}/{{yyyy}}', 'MEDIAMONSTER'),
    pattern,
  )
})

test('applySellerEntityToContractNumber switches existing contract number prefixes', () => {
  assert.equal(
    applySellerEntityToContractNumber('1805/HDMMT-ABC/2026', 'EVENTUS'),
    '1805/HDEVT-ABC/2026',
  )
  assert.equal(
    applySellerEntityToContractNumber('1805/HDEVT-ABC/2026', 'MEDIAMONSTER'),
    '1805/HDMMT-ABC/2026',
  )
})

test('buildSingleLineQuoteSnapshot treats excluded VAT input as pre-tax amount', () => {
  const snapshot = buildSingleLineQuoteSnapshot({}, {
    amount: 10000000,
    vat_mode: 'excluded',
  })

  assert.equal(snapshot.has_vat, true)
  assert.equal(snapshot.vat_mode, 'excluded')
  assert.equal(snapshot.subtotal, 10000000)
  assert.equal(snapshot.vat_amount, 800000)
  assert.equal(snapshot.total_amount, 10800000)
  assert.equal(snapshot.items[0].unit_price, 10000000)
  assert.equal(snapshot.items[0].total_price, 10000000)
})

test('buildSingleLineQuoteSnapshot treats included VAT input as total amount and displays pre-tax item values', () => {
  const snapshot = buildSingleLineQuoteSnapshot({}, {
    amount: 10800000,
    vat_mode: 'included',
  })

  assert.equal(snapshot.has_vat, true)
  assert.equal(snapshot.vat_mode, 'included')
  assert.equal(snapshot.subtotal, 10000000)
  assert.equal(snapshot.vat_amount, 800000)
  assert.equal(snapshot.total_amount, 10800000)
  assert.equal(snapshot.items[0].unit_price, 10000000)
  assert.equal(snapshot.items[0].total_price, 10000000)
})

test('buildSingleLineQuoteSnapshot preserves manual amount when switching VAT mode', () => {
  const includedSnapshot = buildSingleLineQuoteSnapshot({}, {
    amount: 6000000,
    vat_mode: 'included',
  })
  const excludedSnapshot = buildSingleLineQuoteSnapshot(includedSnapshot, {
    vat_mode: 'excluded',
  })

  assert.equal(excludedSnapshot.contract_value_input, 6000000)
  assert.equal(excludedSnapshot.subtotal, 6000000)
  assert.equal(excludedSnapshot.vat_amount, 480000)
  assert.equal(excludedSnapshot.total_amount, 6480000)
  assert.equal(excludedSnapshot.items[0].unit_price, 6000000)
  assert.equal(excludedSnapshot.items[0].total_price, 6000000)
})

test('contract work duration text can be overridden for progress notes', () => {
  const contract = {
    quote_snapshot: { duration_hours: 8 },
    quote_table_config: {
      work_duration_text: '6 giờ/ngày',
      work_progress_notes: [
        'Thời gian làm việc tối đa [Số giờ/buổi hoặc Số giờ/ngày].',
      ],
    },
  }

  assert.equal(getContractWorkDurationText(contract), '6 giờ/ngày')
  assert.deepEqual(getContractWorkProgressNotes(contract), [
    'Thời gian làm việc tối đa 6 giờ/ngày.',
  ])
})

test('contract work duration text defaults to four hours per session', () => {
  assert.equal(getContractWorkDurationText({}), '04 giờ/buổi')
  assert.deepEqual(getContractWorkProgressNotes({}), [
    'Thời gian làm việc tiêu chuẩn của nhân sự Bên B là tối đa 04 giờ/buổi theo thỏa thuận. Các yêu cầu phát sinh ngoài khung giờ này sẽ được tính phí ngoài giờ là 500.000 đồng/giờ/nhân sự, với điều kiện phải được Bên A xác nhận qua văn bản hoặc email/Zalo trước khi thực hiện.',
    'Đối với sản phẩm hậu kỳ: Ảnh sự kiện (đã chỉnh sửa màu sắc và bố cục) được bàn giao trong vòng 24 giờ và Video Recap trong vòng 03 ngày kể từ khi kết thúc sự kiện (nếu có). Tiến độ bàn giao Video được tính kể từ thời điểm Bên A cung cấp đầy đủ các tài liệu cần thiết (brief, logo, font, nhạc hoặc tư liệu liên quan tùy theo hạng mục). Trường hợp Bên A chậm cung cấp tài liệu, thời hạn bàn giao sẽ được gia hạn tương ứng.',
  ])
})
