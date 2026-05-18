import {
  CONTRACT_TABLE_PLACEMENTS,
  DEFAULT_CONTRACT_PREAMBLE,
  numberToVietnameseWords,
  sanitizeFilenamePart,
} from './contractDefaults'

const encoder = new TextEncoder()

function escapeXml(value = '') {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} VNĐ`
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function getCustomer(contract = {}) {
  return contract.customer_snapshot || {}
}

function getSeller(contract = {}) {
  return contract.seller_snapshot || {}
}

function getQuote(contract = {}) {
  return contract.quote_snapshot || {}
}

function getItemName(item = {}) {
  return item.service_name || item.service_code || 'Hạng mục'
}

function getPartyRole(contract = {}, partyKey = 'party_a') {
  return contract.party_role_config?.[partyKey] || (partyKey === 'party_a' ? 'customer' : 'seller')
}

function getPartyProfile(contract = {}, partyKey = 'party_a') {
  return getPartyRole(contract, partyKey) === 'seller' ? getSeller(contract) : getCustomer(contract)
}

function getProfileName(profile = {}) {
  return profile.company_name || profile.legal_name || ''
}

function crc32(bytes) {
  let crc = -1
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

function dosDateTime(date = new Date()) {
  const year = Math.max(date.getFullYear(), 1980)
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true)
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true)
}

function makeZip(files = []) {
  const chunks = []
  const centralDirectory = []
  let offset = 0
  const { dosTime, dosDate } = dosDateTime()

  files.forEach(file => {
    const nameBytes = encoder.encode(file.name)
    const dataBytes = typeof file.content === 'string' ? encoder.encode(file.content) : file.content
    const crc = crc32(dataBytes)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)

    writeUint32(localView, 0, 0x04034b50)
    writeUint16(localView, 4, 20)
    writeUint16(localView, 6, 0x0800)
    writeUint16(localView, 8, 0)
    writeUint16(localView, 10, dosTime)
    writeUint16(localView, 12, dosDate)
    writeUint32(localView, 14, crc)
    writeUint32(localView, 18, dataBytes.length)
    writeUint32(localView, 22, dataBytes.length)
    writeUint16(localView, 26, nameBytes.length)
    writeUint16(localView, 28, 0)
    localHeader.set(nameBytes, 30)

    chunks.push(localHeader, dataBytes)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    writeUint32(centralView, 0, 0x02014b50)
    writeUint16(centralView, 4, 20)
    writeUint16(centralView, 6, 20)
    writeUint16(centralView, 8, 0x0800)
    writeUint16(centralView, 10, 0)
    writeUint16(centralView, 12, dosTime)
    writeUint16(centralView, 14, dosDate)
    writeUint32(centralView, 16, crc)
    writeUint32(centralView, 20, dataBytes.length)
    writeUint32(centralView, 24, dataBytes.length)
    writeUint16(centralView, 28, nameBytes.length)
    writeUint16(centralView, 30, 0)
    writeUint16(centralView, 32, 0)
    writeUint16(centralView, 34, 0)
    writeUint16(centralView, 36, 0)
    writeUint32(centralView, 38, 0)
    writeUint32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)
    centralDirectory.push(centralHeader)

    offset += localHeader.length + dataBytes.length
  })

  const centralSize = centralDirectory.reduce((sum, chunk) => sum + chunk.length, 0)
  const centralOffset = offset
  const endHeader = new Uint8Array(22)
  const endView = new DataView(endHeader.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, centralOffset)
  writeUint16(endView, 20, 0)

  return new Blob([...chunks, ...centralDirectory, endHeader], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function textRun(text = '', { bold = false } = {}) {
  const props = bold ? '<w:rPr><w:b/></w:rPr>' : ''
  return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraph(text = '', options = {}) {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : ''
  const alignment = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  const spacing = options.spacing === false ? '' : '<w:spacing w:after="120"/>'
  const pageBreak = options.pageBreakBefore ? '<w:pageBreakBefore/>' : ''
  return `<w:p><w:pPr>${style}${alignment}${spacing}${pageBreak}</w:pPr>${textRun(text, { bold: options.bold })}</w:p>`
}

function multilineParagraphs(text = '') {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => paragraph(line, { bold: /^Điều\s+\d+/i.test(line) }))
    .join('')
}

function tableCell(content = '', width = 2400, options = {}) {
  const shading = options.shading ? `<w:shd w:fill="${options.shading}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>${paragraph(content, { bold: options.bold, spacing: false })}</w:tc>`
}

function tableRow(cells = []) {
  return `<w:tr>${cells.join('')}</w:tr>`
}

function simpleTable(rows = []) {
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7DEE8"/><w:left w:val="single" w:sz="4" w:color="D7DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D7DEE8"/><w:right w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideH w:val="single" w:sz="4" w:color="E5EAF1"/><w:insideV w:val="single" w:sz="4" w:color="E5EAF1"/></w:tblBorders></w:tblPr>${rows.join('')}</w:tbl>`
}

function partyTable(contract = {}) {
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  const roleA = getPartyRole(contract, 'party_a')
  const roleB = getPartyRole(contract, 'party_b')
  const authLine = profile => profile.authorization_number ? `Theo giấy ủy quyền số: ${profile.authorization_number}${profile.authorization_date ? ` ký ngày ${profile.authorization_date}` : ''}` : ''
  const rowsFor = (heading, profile, role) => {
    const representative = [
      profile.representative || '',
      profile.position ? `Chức vụ: ${profile.position}` : '',
      role === 'customer' ? authLine(profile) : '',
    ].filter(Boolean).join(' - ')

    const rows = [
      tableRow([
        tableCell(heading, 1600, { bold: true, shading: 'F8FAFC' }),
        tableCell(':', 300, { bold: true, shading: 'F8FAFC' }),
        tableCell(getProfileName(profile), 7100, { bold: true, shading: 'F8FAFC' }),
      ]),
      tableRow([tableCell('Đại diện', 1600), tableCell(':', 300), tableCell(representative, 7100)]),
      tableRow([tableCell('Địa chỉ', 1600), tableCell(':', 300), tableCell(profile.address || '', 7100)]),
      tableRow([tableCell('Điện thoại', 1600), tableCell(':', 300), tableCell(profile.phone || '', 7100)]),
      tableRow([tableCell('Mã số thuế', 1600), tableCell(':', 300), tableCell(profile.tax_code || '', 7100)]),
    ]

    if (role === 'seller') {
      rows.push(tableRow([tableCell('Số tài khoản', 1600), tableCell(':', 300), tableCell([profile.bank_account, profile.bank_name].filter(Boolean).join(' '), 7100)]))
    }

    return simpleTable(rows)
  }

  return [
    rowsFor('BÊN A', partyA, roleA),
    paragraph('Và:', { bold: true }),
    rowsFor('BÊN B', partyB, roleB),
  ].join('')
}

function quoteTable(contract = {}) {
  const quote = getQuote(contract)
  const items = Array.isArray(quote.items) ? quote.items : []
  const rows = [
    tableRow([
      tableCell('STT', 600, { bold: true, shading: 'F8FAFC' }),
      tableCell('Hạng mục', 3000, { bold: true, shading: 'F8FAFC' }),
      tableCell('ĐVT', 900, { bold: true, shading: 'F8FAFC' }),
      tableCell('SL', 700, { bold: true, shading: 'F8FAFC' }),
      tableCell('Số ngày', 800, { bold: true, shading: 'F8FAFC' }),
      tableCell('Đơn giá', 1500, { bold: true, shading: 'F8FAFC' }),
      tableCell('Thành tiền', 1700, { bold: true, shading: 'F8FAFC' }),
    ]),
    ...items.map((item, index) => tableRow([
      tableCell(String(index + 1), 600),
      tableCell(getItemName(item), 3000),
      tableCell(item.unit || 'Người', 900),
      tableCell(String(item.quantity || 0), 700),
      tableCell(String(item.num_sessions || 1), 800),
      tableCell(formatCurrency(item.unit_price), 1500),
      tableCell(formatCurrency(item.total_price), 1700),
    ])),
  ]

  return simpleTable(rows)
}

function totalsTable(contract = {}) {
  const quote = getQuote(contract)
  const rows = [
    ['Subtotal', quote.subtotal],
    Number(quote.travel_fee_total || 0) > 0 ? ['Phụ phí di chuyển', quote.travel_fee_total] : null,
    Number(quote.overtime_fee_total || 0) > 0 ? ['Phụ phí Over-time', quote.overtime_fee_total] : null,
    quote.has_vat !== false ? ['VAT', quote.vat_amount] : null,
    ['Tổng cộng', quote.total_amount],
  ].filter(Boolean)

  return simpleTable(rows.map(([label, value], index) => tableRow([
    tableCell(label, 4200, { bold: index === rows.length - 1 }),
    tableCell(formatCurrency(value), 2400, { bold: index === rows.length - 1 }),
  ])))
}

function scheduleXml(rows = []) {
  return rows.map(row => [
    paragraph(`Thời gian: ${[row.time_range, row.date_text].filter(Boolean).join(' ngày ') || ''}`),
    paragraph(`Địa điểm: ${row.location || ''}`),
  ].join('')).join('')
}

function serviceArticleXml(contract = {}, includeQuoteTable = false) {
  return [
    paragraph('ĐIỀU 1: NỘI DUNG HỢP ĐỒNG', { style: 'Heading1', bold: true }),
    paragraph(`Bên A đề nghị Bên B và Bên B đồng ý ${contract.service_scope || 'cung cấp dịch vụ theo báo giá'} cho Bên A, chi tiết như sau:`),
    scheduleXml(contract.schedule_rows || []),
    includeQuoteTable ? paragraph('Chi tiết hạng mục:', { bold: true }) : paragraph('Chi tiết hạng mục: Theo Phụ lục cuối hợp đồng.', { bold: true }),
    includeQuoteTable ? quoteTable(contract) : '',
    includeQuoteTable ? totalsTable(contract) : '',
  ].join('')
}

function paymentArticleXml(contract = {}) {
  const quote = getQuote(contract)
  const payment = contract.payment_config || {}
  const depositPercent = Number(payment.deposit_percent || 50)
  const depositAmount = Number(quote.total_amount || 0) * depositPercent / 100
  const docs = Array.isArray(payment.payment_documents) ? payment.payment_documents : []

  return [
    paragraph('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { style: 'Heading1', bold: true }),
    paragraph(`Giá trị của hợp đồng là: ${formatCurrency(quote.total_amount)} ${quote.has_vat !== false ? '(Đã bao gồm VAT)' : '(Chưa bao gồm VAT)'}`),
    paragraph(`(Bằng chữ: ${numberToVietnameseWords(quote.total_amount)}./.)`),
    paragraph('Phương thức thanh toán: Việc thanh toán Hợp đồng sẽ thực hiện thành 02 lần:'),
    paragraph(`Lần 1: Bên A đặt cọc ${depositPercent}% giá trị hợp đồng tương ứng ${formatCurrency(depositAmount)} cho Bên B sau khi ký hợp đồng${payment.issue_invoice_on_deposit ? ' và Bên B xuất hóa đơn cho Bên A sau khi nhận được thanh toán lần 1' : ''}.`),
    paragraph(`Lần 2: Bên A thanh toán nốt số tiền còn lại cho Bên B trong vòng ${Number(payment.final_due_days || 7)} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.`),
    docs.length ? paragraph('Hồ sơ thanh toán bao gồm:', { bold: true }) : '',
    docs.map(item => paragraph(`- ${item}`)).join(''),
  ].join('')
}

function contentSectionsXml(sections = []) {
  return sections.map((section, index) => [
    paragraph(`ĐIỀU ${section.article_no || index + 3}: ${section.title || 'ĐIỀU KHOẢN'}`, { style: 'Heading1', bold: true }),
    multilineParagraphs(section.body || ''),
  ].join('')).join('')
}

function signatureXml(contract = {}) {
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  return [
    paragraph('ĐẠI DIỆN CÁC BÊN', { style: 'Heading1', align: 'center', bold: true }),
    simpleTable([
      tableRow([
        tableCell('ĐẠI DIỆN BÊN A', 4500, { bold: true, shading: 'F8FAFC' }),
        tableCell('ĐẠI DIỆN BÊN B', 4500, { bold: true, shading: 'F8FAFC' }),
      ]),
      tableRow([
        tableCell(partyA.representative || '', 4500),
        tableCell(partyB.representative || '', 4500),
      ]),
    ]),
  ].join('')
}

function appendixXml(contract = {}) {
  const quote = getQuote(contract)
  return [
    paragraph('PHỤ LỤC: BÁO GIÁ ĐÍNH KÈM', { style: 'Heading1', align: 'center', bold: true, pageBreakBefore: true }),
    paragraph(`Mã báo giá: ${quote.quote_number || contract.quote_number || ''}`),
    paragraph(`Sự kiện/Dự án: ${quote.event_name || ''}`),
    paragraph(`Địa điểm: ${quote.location || ''}`),
    quoteTable(contract),
    totalsTable(contract),
  ].join('')
}

function documentXml(contract = {}) {
  const tableInArticle = (contract.quote_table_config?.placement || CONTRACT_TABLE_PLACEMENTS.APPENDIX) === CONTRACT_TABLE_PLACEMENTS.ARTICLE_1
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' })}
    ${paragraph('Độc lập – Tự do – Hạnh phúc', { align: 'center' })}
    ${paragraph(contract.title || 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ', { style: 'Title', align: 'center', bold: true })}
    ${paragraph(`Số: ${contract.contract_number || ''}`, { align: 'center', bold: true })}
    ${DEFAULT_CONTRACT_PREAMBLE.map(line => paragraph(line)).join('')}
    ${paragraph(`Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày ${formatDate(contract.updated_at || contract.created_at)} giữa các bên gồm:`)}
    ${partyTable(contract)}
    ${paragraph('Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:')}
    ${serviceArticleXml(contract, tableInArticle)}
    ${paymentArticleXml(contract)}
    ${contentSectionsXml(contract.content_sections || [])}
    ${signatureXml(contract)}
    ${!tableInArticle ? appendixXml(contract) : ''}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>
  </w:body>
</w:document>`
}

const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

const documentRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>`

function coreXml(contract = {}) {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(contract.title || 'Hợp đồng')}</dc:title>
  <dc:creator>Eventus AI Lab</dc:creator>
  <cp:lastModifiedBy>Eventus AI Lab</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Eventus AI Lab</Application>
</Properties>`

export function createContractDocxBlob(contract = {}) {
  return makeZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'docProps/core.xml', content: coreXml(contract) },
    { name: 'docProps/app.xml', content: appXml },
    { name: 'word/_rels/document.xml.rels', content: documentRelsXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/document.xml', content: documentXml(contract) },
  ])
}

export function getContractDocxFilename(contract = {}) {
  return `${sanitizeFilenamePart(contract.contract_number || 'Hop-dong')}.docx`
}

export function downloadContractDocx(contract = {}) {
  const blob = createContractDocxBlob(contract)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = getContractDocxFilename(contract)
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
