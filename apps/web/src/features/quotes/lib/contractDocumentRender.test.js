import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
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
