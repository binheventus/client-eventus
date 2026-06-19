import assert from 'node:assert/strict'
import test from 'node:test'
import { createContractDocxBlob } from './contractDocx.js'

async function getContractDocxPackageText(contract = {}) {
  const blob = createContractDocxBlob(contract)
  const buffer = await blob.arrayBuffer()
  return new TextDecoder().decode(buffer)
}

test('contract DOCX normalizes wide spacing after body list markers', async () => {
  const source = await getContractDocxPackageText({
    content_sections: [{
      article_no: 3,
      title: 'NGHĨA VỤ',
      body: '-\t\tCung cấp thông tin\n3.1\tNghĩa vụ của Bên A',
    }],
  })

  assert.match(source, />- Cung cấp thông tin<\/w:t>/)
  assert.match(source, />3.1 Nghĩa vụ của Bên A<\/w:t>/)
  assert.doesNotMatch(source, />-\s{2,}Cung cấp thông tin<\/w:t>/)
})

test('contract DOCX writes 11pt body font size directly on text runs', async () => {
  const source = await getContractDocxPackageText({
    title: 'Hợp đồng dịch vụ',
    content_sections: [{
      article_no: 3,
      title: 'ĐIỀU KHOẢN',
      body: 'Nội dung điều khoản',
    }],
  })

  assert.match(source, /<w:sz w:val="22"\/><\/w:rPr><w:t xml:space="preserve">Nội dung điều khoản<\/w:t>/)
  assert.match(source, /<w:sz w:val="30"\/><w:b\/><\/w:rPr><w:t xml:space="preserve">Hợp đồng dịch vụ<\/w:t>/)
  assert.match(source, /<w:sz w:val="24"\/><w:b\/><\/w:rPr><w:t xml:space="preserve">ĐIỀU 3: ĐIỀU KHOẢN<\/w:t>/)
})

test('contract DOCX renders balanced signature names and positions', async () => {
  const source = await getContractDocxPackageText({
    customer_snapshot: {
      representative: 'Bà Nguyễn Ngọc Linh',
      position: 'Giám đốc',
    },
    seller_snapshot: {
      representative: 'Ông Phạm Ngọc Bảo',
      position: 'Giám đốc',
    },
    party_role_config: {
      party_a: 'customer',
      party_b: 'seller',
    },
  })

  assert.match(source, /w:trHeight w:val="2400"/)
  assert.match(source, /w:tcW w:w="1000" w:type="dxa"/)
  assert.match(source, /w:trHeight w:val="80"/)
  assert.match(source, />NGUYỄN NGỌC LINH<\/w:t>/)
  assert.match(source, />PHẠM NGỌC BẢO<\/w:t>/)
  assert.doesNotMatch(source, />BÀ NGUYỄN NGỌC LINH<\/w:t>/)
  assert.doesNotMatch(source, />ÔNG PHẠM NGỌC BẢO<\/w:t>/)
  assert.match(source, />Giám đốc<\/w:t>/)
})
