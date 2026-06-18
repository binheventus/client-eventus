import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
  getContractDocumentFilename,
  shouldShowAcceptanceAmountTables,
} from './contractDocumentRender.js'

const baseAcceptanceDocument = {
  document_type: 'acceptance_liquidation',
  issued_date: '2026-05-30',
  contract_snapshot: {
    contract_number: '3005/HDEVT-M/2026',
    signing_date: '2026-05-30',
    customer_snapshot: {
      company_name: 'CÔNG TY TNHH DỊCH VỤ TRIỂN LÃM SES VIỆT NAM',
    },
    seller_snapshot: {
      company_name: 'Eventus',
      entity_name_full: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
      legal_name: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
    },
  },
  document_data: {
    form_data: {
      contract_rows: [{ description: 'Dịch vụ media', quantity: 1, unit_price: 1000000 }],
      actual_rows: [{ description: 'Dịch vụ media', quantity: 1, unit_price: 1000000 }],
    },
    amount_config: {
      has_vat: true,
      vat_rate: 0.08,
    },
  },
}

test('acceptance liquidation seller_name token renders the full legal entity name', () => {
  const content = getAcceptanceLiquidationContent({
    ...baseAcceptanceDocument,
    content_sections: [{
      id: 'acceptance-basis-contract',
      title: 'Căn cứ hợp đồng',
      body: 'Căn cứ vào Hợp Đồng dịch vụ số: {{contract_number}} ký ngày {{contract_signing_date}} giữa {{customer_name}} và {{seller_name}};',
    }],
  })

  assert.match(content.basis_contract, /CÔNG TY TNHH EVENTUS VIỆT NAM/)
  assert.doesNotMatch(content.basis_contract, / và Eventus;/)
})

test('acceptance liquidation renders handwritten date placeholder when issued date is hidden', () => {
  const content = getAcceptanceLiquidationContent({
    ...baseAcceptanceDocument,
    document_data: {
      ...baseAcceptanceDocument.document_data,
      form_data: {
        ...baseAcceptanceDocument.document_data.form_data,
        hide_issued_date: true,
      },
    },
  })

  assert.equal(content.party_intro, 'Hôm nay, ngày \u00a0\u00a0\u00a0\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0/\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0 chúng tôi gồm có:')
  assert.doesNotMatch(content.party_intro, /ngày - chúng/)
})

test('quote-bound acceptance uses quote wording without contract references', () => {
  const content = getAcceptanceLiquidationContent({
    document_type: 'acceptance_liquidation',
    quote_id: 'quote-1',
    contract_id: null,
    title: 'Biên bản nghiệm thu',
    contract_snapshot: {
      quote_id: 'quote-1',
      quote_number: 'BG-001',
      service_scope: 'dịch vụ chụp ảnh sự kiện',
      customer_snapshot: {
        company_name: 'CÔNG TY TNHH ĐỨC VINH',
        representative: 'Nguyễn Văn A',
        position: 'Giám đốc',
        address: 'Hà Nội',
        tax_code: '0101234567',
      },
      seller_snapshot: {
        entity_name_full: 'CÔNG TY TNHH MEDIAMONSTER',
        representative: 'Trần Văn B',
        position: 'Giám đốc',
        address: 'TP. Hồ Chí Minh',
        tax_code: '0312345678',
        bank_account: '123456789',
        bank_name: 'Vietcombank',
        account_holder: 'CÔNG TY TNHH MEDIAMONSTER',
      },
    },
    document_data: {
      form_data: {
        hide_issued_date: true,
      },
      amount_config: {
        has_vat: true,
        vat_rate: 0.08,
        contract_total: 2700000,
        acceptance_actual_total: 2700000,
        acceptance_amount: 2700000,
        remaining_amount: 2700000,
      },
    },
  })
  const rendered = JSON.stringify(content)
  const articleTwo = content.articles.find(section => section.id === 'acceptance-article-2')
  const articleThree = content.articles.find(section => section.id === 'acceptance-article-3')

  assert.match(content.basis_contract, /Căn cứ vào yêu cầu cung cấp dịch vụ chụp ảnh sự kiện/)
  assert.match(articleTwo.body, /Tổng giá trị: 2\.700\.000 VNĐ/)
  assert.match(articleTwo.body, /Bằng chữ: Hai triệu bảy trăm nghìn đồng/)
  assert.match(articleThree.body, /trong vòng 30 ngày/)
  assert.doesNotMatch(rendered, /Hợp Đồng|hợp đồng/)
})

test('acceptance amount tables are only shown for cost difference templates', () => {
  assert.equal(shouldShowAcceptanceAmountTables(baseAcceptanceDocument), false)

  assert.equal(shouldShowAcceptanceAmountTables({
    ...baseAcceptanceDocument,
    template_snapshot: {
      fields_config: {
        acceptance_cost_difference: true,
      },
    },
  }), true)
})

test('contract document filename uses job date, document code, parties and event name', () => {
  assert.equal(getContractDocumentFilename({
    document_type: 'advance_request',
    seller_entity_code: 'EVENTUS',
    contract_snapshot: {
      schedule_rows: [{ date_text: '16.09.2026' }],
      source_snapshot: { job_title: 'Year End Party' },
      customer_snapshot: { customer_code: 'ABC' },
    },
  }), '16.09-DNTU-EVT-ABC-Year-End-Party.pdf')
})

test('contract document filename formats ISO job dates and docx extension', () => {
  assert.equal(getContractDocumentFilename({
    document_type: 'acceptance_liquidation',
    seller_entity_code: 'MEDIAMONSTER',
    contract_snapshot: {
      schedule_rows: [{ date_text: '2026-10-05' }],
      quote_snapshot: { event_name: 'Ra mắt sản phẩm mới' },
      customer_snapshot: { customer_code: 'C.S.Q' },
    },
  }, 'docx'), '05.10-BBNTTL-MMT-C-S-Q-Ra-mat-san-pham-moi.docx')
})

test('contract document filename omits date when job date is missing', () => {
  assert.equal(getContractDocumentFilename({
    document_type: 'payment_request',
    seller_entity_code: 'EVT',
    contract_snapshot: {
      schedule_rows: [{ date_text: '' }],
      source_snapshot: { job_title: 'Kickoff Meeting' },
      customer_snapshot: { customer_code: 'VINFAST' },
    },
  }), 'DNTT-EVT-VINFAST-Kickoff-Meeting.pdf')
})

test('acceptance liquidation uses related advance request amount in article two', () => {
  const document = {
    ...baseAcceptanceDocument,
    document_data: {
      ...baseAcceptanceDocument.document_data,
      amount_config: {
        ...baseAcceptanceDocument.document_data.amount_config,
        linked_advance_documents: [
          {
            document_id: 'advance-1',
            document_number: '0001/DNTU-EVT/SES/2026',
            advance_amount: 300_000,
          },
        ],
      },
    },
  }
  const summary = getAcceptanceSummary(document)
  const content = getAcceptanceLiquidationContent(document)
  const articleTwo = content.articles.find(section => section.id === 'acceptance-article-2')

  assert.equal(summary.advance_paid, 300_000)
  assert.equal(summary.remaining_amount, 780_000)
  assert.match(articleTwo.body, /Bên A đã tạm ứng cho bên B: 300\.000 VNĐ/)
  assert.match(articleTwo.body, /Bên A phải thanh toán cho bên B: 780\.000 VNĐ/)
})
