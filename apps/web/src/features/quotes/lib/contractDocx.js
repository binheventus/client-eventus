import {
  getContractPreamble,
  getContractPaymentNotes,
  getContractWorkProgressNotes,
  numberToVietnameseWords,
  sanitizeFilenamePart,
} from './contractDefaults'

const encoder = new TextEncoder()
const DOCX_FONT_FAMILY = 'Times New Roman'
const DOCX_FONT_XML = `<w:rFonts w:ascii="${DOCX_FONT_FAMILY}" w:hAnsi="${DOCX_FONT_FAMILY}" w:eastAsia="${DOCX_FONT_FAMILY}" w:cs="${DOCX_FONT_FAMILY}"/>`
const TABLE_BORDERS_XML = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D7DEE8"/><w:left w:val="single" w:sz="4" w:color="D7DEE8"/><w:bottom w:val="single" w:sz="4" w:color="D7DEE8"/><w:right w:val="single" w:sz="4" w:color="D7DEE8"/><w:insideH w:val="single" w:sz="4" w:color="E5EAF1"/><w:insideV w:val="single" w:sz="4" w:color="E5EAF1"/></w:tblBorders>'
const TABLE_NO_BORDERS_XML = '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'

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

function formatCurrencyAmount(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function hasText(value) {
  return String(value ?? '').trim().length > 0
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
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getItemUnit(item = {}) {
  return item.unit || item.service?.unit || item.pricing_unit || 'Người'
}

function getItemGroupLabel(item = {}) {
  const rawLabel = item.group_label || item.event_day || item.day_index || item.day || ''
  if (!rawLabel) return 'Hạng mục'
  const label = String(rawLabel).trim()
  if (!label) return 'Hạng mục'
  return /^ngày\b/i.test(label) ? label : `Ngày ${label}`
}

function groupItemsByDay(items = []) {
  const groups = new Map()
  items.forEach(item => {
    const key = getItemGroupLabel(item)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  return Array.from(groups.entries())
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

function textRun(text = '', { bold = false, italic = false } = {}) {
  const props = `<w:rPr>${DOCX_FONT_XML}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr>`
  return `<w:r>${props}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraphProps(options = {}) {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : ''
  const alignment = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  const spacing = options.spacing === false ? '' : '<w:spacing w:after="120"/>'
  const pageBreak = options.pageBreakBefore ? '<w:pageBreakBefore/>' : ''
  return `<w:pPr>${style}${alignment}${spacing}${pageBreak}</w:pPr>`
}

function paragraph(text = '', options = {}) {
  return `<w:p>${paragraphProps(options)}${textRun(text, { bold: options.bold, italic: options.italic })}</w:p>`
}

function richParagraph(runs = [], options = {}) {
  return `<w:p>${paragraphProps(options)}${runs.map(run => textRun(run.text, run)).join('')}</w:p>`
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
  const gridSpan = options.colSpan ? `<w:gridSpan w:val="${options.colSpan}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${shading}</w:tcPr>${paragraph(content, { bold: options.bold, spacing: false, align: options.align })}</w:tc>`
}

function tableRow(cells = [], options = {}) {
  const height = options.minHeight ? `<w:trPr><w:trHeight w:val="${options.minHeight}" w:hRule="atLeast"/></w:trPr>` : ''
  return `<w:tr>${height}${cells.join('')}</w:tr>`
}

function simpleTable(rows = [], options = {}) {
  const width = options.width || 0
  const widthType = options.width ? 'dxa' : 'auto'
  const layout = options.fixed ? '<w:tblLayout w:type="fixed"/>' : ''
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  const borders = options.borders === false ? TABLE_NO_BORDERS_XML : TABLE_BORDERS_XML
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="${widthType}"/>${layout}${align}${borders}</w:tblPr>${rows.join('')}</w:tbl>`
}

function partyTable(contract = {}) {
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  const roleA = getPartyRole(contract, 'party_a')
  const roleB = getPartyRole(contract, 'party_b')
  const rowsFor = (heading, profile, role) => {
    const representative = [
      profile.representative || '',
      profile.position ? `Chức vụ: ${profile.position}` : '',
    ].filter(hasText).join(' - ')

    const rows = [
      tableRow([
        tableCell(heading, 1800, { bold: true }),
        tableCell(getProfileName(profile), 7200, { bold: true }),
      ]),
      tableRow([tableCell('Đại diện', 1800), tableCell(representative, 7200)]),
      role === 'customer' && hasText(profile.authorization_number) ? tableRow([tableCell('Giấy ủy quyền số', 1800), tableCell(profile.authorization_number, 7200)]) : '',
      role === 'customer' && hasText(profile.authorization_date) ? tableRow([tableCell('Ngày giấy ủy quyền', 1800), tableCell(profile.authorization_date, 7200)]) : '',
      tableRow([tableCell('Địa chỉ', 1800), tableCell(profile.address || '', 7200)]),
      role === 'customer' && hasText(profile.email) ? tableRow([tableCell('Email', 1800), tableCell(profile.email, 7200)]) : '',
      role === 'customer' && hasText(profile.phone) ? tableRow([tableCell('Số điện thoại', 1800), tableCell(profile.phone, 7200)]) : '',
      tableRow([tableCell('Mã số thuế', 1800), tableCell(profile.tax_code || '', 7200)]),
    ]

    if (role === 'seller') {
      rows.push(tableRow([tableCell('Số tài khoản', 1800), tableCell([profile.bank_account, profile.bank_name].filter(Boolean).join(' '), 7200)]))
    }

    return simpleTable(rows, { width: 9000, fixed: true, borders: false })
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
  const groups = groupItemsByDay(items)
  const totalRows = [
    ['Subtotal', quote.subtotal],
    quote.has_vat !== false ? ['Thuế GTGT 8%', quote.vat_amount] : null,
    ['Tổng cộng', quote.total_amount],
  ].filter(Boolean)
  const rows = [
    tableRow([
      tableCell('Hạng mục', 3300, { bold: true, shading: 'F8FAFC' }),
      tableCell('Đơn vị tính', 1100, { bold: true, shading: 'F8FAFC', align: 'center' }),
      tableCell('Số lượng', 900, { bold: true, shading: 'F8FAFC', align: 'center' }),
      tableCell('Số buổi', 800, { bold: true, shading: 'F8FAFC', align: 'center' }),
      tableCell('Đơn giá', 1400, { bold: true, shading: 'F8FAFC', align: 'right' }),
      tableCell('Thành tiền', 1500, { bold: true, shading: 'F8FAFC', align: 'right' }),
    ]),
    ...groups.flatMap(([groupName, groupItems]) => [
      groups.length > 1 ? tableRow([tableCell(groupName, 9000, { bold: true, shading: 'F8FAFC', colSpan: 6 })]) : '',
      ...groupItems.map(item => tableRow([
        tableCell(getItemName(item), 3300),
        tableCell(getItemUnit(item), 1100, { align: 'center' }),
        tableCell(String(item.quantity || 1), 900, { align: 'center' }),
        tableCell(String(item.num_sessions || 1), 800, { align: 'center' }),
        tableCell(formatCurrencyAmount(item.unit_price), 1400, { align: 'right' }),
        tableCell(formatCurrencyAmount(item.total_price), 1500, { align: 'right' }),
      ])),
    ].filter(Boolean)),
    ...totalRows.map(([label, value], index) => tableRow([
      tableCell(label, 7500, { bold: index === totalRows.length - 1, align: 'right', colSpan: 5 }),
      tableCell(formatCurrencyAmount(value), 1500, { bold: index === totalRows.length - 1, align: 'right' }),
    ])),
  ]

  return simpleTable(rows, { width: 9000, fixed: true })
}

function scheduleXml(rows = []) {
  return rows.map(row => [
    paragraph(`Thời gian: ${[row.time_range, row.date_text].filter(Boolean).join(' ngày ') || ''}`),
    paragraph(`Địa điểm: ${row.location || ''}`),
  ].join('')).join('')
}

function serviceArticleXml(contract = {}) {
  const workProgressNotes = getContractWorkProgressNotes(contract)

  return [
    paragraph(`Bên A đề nghị Bên B và Bên B đồng ý ${contract.service_scope || 'cung cấp dịch vụ theo báo giá'} cho Bên A, chi tiết như sau:`),
    scheduleXml(contract.schedule_rows || []),
    paragraph('Chi tiết hạng mục', { bold: true }),
    quoteTable(contract),
    paragraph('Lưu ý về thời gian làm việc và tiến độ bàn giao:', { bold: true }),
    workProgressNotes.map(item => paragraph(`- ${item}`)).join(''),
  ].join('')
}

function paymentArticleXml(contract = {}) {
  const quote = getQuote(contract)
  const payment = contract.payment_config || {}
  const depositPercent = Number(payment.deposit_percent || 50)
  const depositAmount = Number(quote.total_amount || 0) * depositPercent / 100
  const docs = Array.isArray(payment.payment_documents) ? payment.payment_documents : []
  const paymentNotes = getContractPaymentNotes(payment)
  const contractValue = `${formatCurrency(quote.total_amount)} ${quote.has_vat !== false ? '(Đã bao gồm VAT)' : '(Chưa bao gồm VAT)'}`
  const depositValue = formatCurrency(depositAmount)

  return [
    paragraph('ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG', { style: 'Heading1', bold: true }),
    richParagraph([
      { text: 'Giá trị của hợp đồng là: ' },
      { text: contractValue, bold: true },
    ]),
    paragraph(`(Bằng chữ: ${numberToVietnameseWords(quote.total_amount)} ./.)`, { italic: true }),
    paragraph('Phương thức thanh toán: Việc thanh toán Hợp đồng sẽ thực hiện thành 02 lần:'),
    richParagraph([
      { text: `Lần 1: Bên A đặt cọc ${depositPercent}% giá trị hợp đồng tương ứng ` },
      { text: depositValue, bold: true },
      { text: ` cho Bên B sau khi ký hợp đồng${payment.issue_invoice_on_deposit ? ' và Bên B xuất hóa đơn cho Bên A sau khi nhận được thanh toán lần 1' : ''}.` },
    ]),
    paragraph(`Lần 2: Bên A thanh toán nốt số tiền còn lại cho Bên B trong vòng ${Number(payment.final_due_days || 7)} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.`),
    docs.length ? paragraph('Hồ sơ thanh toán bao gồm:', { bold: true }) : '',
    docs.map(item => paragraph(`- ${item}`)).join(''),
    paragraph('Lưu ý về thanh toán:', { bold: true }),
    paymentNotes.map(item => paragraph(`- ${item}`)).join(''),
  ].join('')
}

function contentSectionsXml(sections = []) {
  return sections.map((section, index) => [
    paragraph(`ĐIỀU ${section.article_no || index + 3}: ${section.title || 'ĐIỀU KHOẢN'}`, { style: 'Heading1', bold: true }),
    multilineParagraphs(section.body || ''),
  ].join('')).join('')
}

function signatureXml() {
  return [
    simpleTable([
      tableRow([
        tableCell('ĐẠI DIỆN BÊN A', 2800, { bold: true, align: 'center' }),
        tableCell('ĐẠI DIỆN BÊN B', 2800, { bold: true, align: 'center' }),
      ]),
    ], { width: 5600, fixed: true, align: 'center', borders: false }),
  ].join('')
}

function documentXml(contract = {}) {
  const preambleLines = getContractPreamble(contract)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' })}
    ${paragraph('Độc lập – Tự do – Hạnh phúc', { align: 'center' })}
    ${paragraph(contract.title || 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ', { style: 'Title', align: 'center', bold: true })}
    ${paragraph(`Số: ${contract.contract_number || ''}`, { align: 'center', bold: true, italic: true })}
    ${preambleLines.map(line => paragraph(line)).join('')}
    ${paragraph(`Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày ${formatDate(contract.updated_at || contract.created_at)} giữa các bên gồm:`)}
    ${partyTable(contract)}
    ${paragraph('Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:')}
    ${serviceArticleXml(contract)}
    ${paymentArticleXml(contract)}
    ${contentSectionsXml(contract.content_sections || [])}
    ${signatureXml()}
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
    <w:rPr>${DOCX_FONT_XML}<w:sz w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr>${DOCX_FONT_XML}<w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>${DOCX_FONT_XML}<w:b/><w:sz w:val="26"/></w:rPr>
  </w:style>
</w:styles>`

function coreXml(contract = {}) {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(contract.title || 'Hợp đồng')}</dc:title>
  <dc:creator>Eventus Client Portal</dc:creator>
  <cp:lastModifiedBy>Eventus Client Portal</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`
}

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Eventus Client Portal</Application>
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
