import assert from 'node:assert/strict'
import test from 'node:test'
import { createContractDocumentDocxBlob } from './contractDocumentDocx.js'

async function getDocxPackageText(document = {}) {
  const blob = createContractDocumentDocxBlob(document)
  const buffer = await blob.arrayBuffer()
  return new TextDecoder().decode(buffer)
}

const basePaymentDocument = {
  issued_date: '2026-06-19',
  document_number: '0008/DNTU-EVT/C.S.Q/2026',
  contract_snapshot: {
    contract_number: 'HD-BG-0010',
    signing_date: '2026-06-19',
    service_scope: 'cung cấp dịch vụ media',
    source_snapshot: {
      job_title: 'Hợp đồng cung cấp dịch vụ media',
    },
    customer_snapshot: {
      company_name: 'CÔNG TY CỔ PHẦN ĐẦU TƯ QUỐC TẾ C.S.Q',
    },
    seller_snapshot: {
      company_name: 'Eventus',
      entity_name_full: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
      legal_name: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
      bank_account: '02612345678',
      bank_name: 'Ngân hàng thương mại cổ phần Tiên Phong TP Bank',
      account_holder: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
    },
  },
  document_data: {
    amount_config: {
      advance_percent: 50,
      advance_amount: 1080000,
      payment_amount: 1080000,
    },
    form_data: {},
  },
}

function assertPaymentBankLinesAreIndentedBullets(source) {
  const bulletCount = source.match(/>• <\/w:t>/g)?.length || 0
  const indentedCount = source.match(/w:left="620" w:hanging="220"/g)?.length || 0

  assert.equal(bulletCount, 3)
  assert.equal(indentedCount, 3)
  assert.match(source, /Tài khoản chuyển khoản/)
  assert.match(source, /Ngân hàng/)
  assert.match(source, /Chủ tài khoản/)
}

test('advance request DOCX renders payment bank lines as indented bullets', async () => {
  const source = await getDocxPackageText({
    ...basePaymentDocument,
    document_type: 'advance_request',
  })

  assertPaymentBankLinesAreIndentedBullets(source)
})

test('payment request DOCX renders payment bank lines as indented bullets', async () => {
  const source = await getDocxPackageText({
    ...basePaymentDocument,
    document_type: 'payment_request',
  })

  assertPaymentBankLinesAreIndentedBullets(source)
})
