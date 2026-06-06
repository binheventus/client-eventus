import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getAcceptanceLiquidationContent,
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
