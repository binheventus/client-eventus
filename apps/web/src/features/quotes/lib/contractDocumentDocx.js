import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceSummary,
  getAdvanceSummary,
  getContractDocumentFilename,
  getContractFromDocument,
  getCustomerProfile,
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentSummary,
  getProfileName,
  getSellerProfile,
  getVatLabel,
  hasDocumentText,
} from './contractDocumentRender'

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
  return {
    dosTime: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    dosDate: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  }
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
  const endHeader = new Uint8Array(22)
  const endView = new DataView(endHeader.buffer)
  writeUint32(endView, 0, 0x06054b50)
  writeUint16(endView, 4, 0)
  writeUint16(endView, 6, 0)
  writeUint16(endView, 8, files.length)
  writeUint16(endView, 10, files.length)
  writeUint32(endView, 12, centralSize)
  writeUint32(endView, 16, offset)
  writeUint16(endView, 20, 0)
  return new Blob([...chunks, ...centralDirectory, endHeader], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function textRun(text = '', { bold = false, italic = false } = {}) {
  return `<w:r><w:rPr>${DOCX_FONT_XML}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraphProps(options = {}) {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : ''
  const alignment = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  const spacing = options.spacing === false ? '' : '<w:spacing w:after="120"/>'
  return `<w:pPr>${style}${alignment}${spacing}</w:pPr>`
}

function paragraph(text = '', options = {}) {
  return `<w:p>${paragraphProps(options)}${textRun(text, options)}</w:p>`
}

function richParagraph(runs = [], options = {}) {
  return `<w:p>${paragraphProps(options)}${runs.map(run => textRun(run.text, run)).join('')}</w:p>`
}

function tableCell(content = '', width = 2400, options = {}) {
  const shading = options.shading ? `<w:shd w:fill="${options.shading}"/>` : ''
  const gridSpan = options.colSpan ? `<w:gridSpan w:val="${options.colSpan}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${shading}</w:tcPr>${paragraph(content, { bold: options.bold, spacing: false, align: options.align })}</w:tc>`
}

function tableRow(cells = []) {
  return `<w:tr>${cells.join('')}</w:tr>`
}

function simpleTable(rows = [], options = {}) {
  const width = options.width || 0
  const widthType = options.width ? 'dxa' : 'auto'
  const borders = options.borders === false ? TABLE_NO_BORDERS_XML : TABLE_BORDERS_XML
  const align = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  return `<w:tbl><w:tblPr><w:tblW w:w="${width}" w:type="${widthType}"/><w:tblLayout w:type="fixed"/>${align}${borders}</w:tblPr>${rows.join('')}</w:tbl>`
}

function partyTable(document = {}) {
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const rowsFor = (heading, profile) => [
    tableRow([tableCell(heading, 1800, { bold: true }), tableCell(getProfileName(profile), 7200, { bold: true })]),
    tableRow([tableCell('Đại diện', 1800), tableCell(profile.representative || '', 7200)]),
    tableRow([tableCell('Chức vụ', 1800), tableCell(profile.position || '', 7200)]),
    tableRow([tableCell('Địa chỉ', 1800), tableCell(profile.address || '', 7200)]),
    tableRow([tableCell('Mã số thuế', 1800), tableCell(profile.tax_code || '', 7200)]),
  ].join('')

  return simpleTable([
    rowsFor(document.document_type === 'acceptance_liquidation' ? 'BÊN A' : 'KÍNH GỬI', customer),
    rowsFor(document.document_type === 'acceptance_liquidation' ? 'BÊN B' : 'BÊN ĐỀ NGHỊ', seller),
  ], { width: 9000, fixed: true, borders: false })
}

function amountTable(title, rows = [], totals = {}, vatConfig = {}) {
  const tableRows = [
    tableRow([tableCell('Nội dung', 3400, { bold: true, shading: 'F8FAFC' }), tableCell('ĐVT', 1000, { bold: true, shading: 'F8FAFC', align: 'center' }), tableCell('SL', 800, { bold: true, shading: 'F8FAFC', align: 'right' }), tableCell('Đơn giá', 1800, { bold: true, shading: 'F8FAFC', align: 'right' }), tableCell('Thành tiền', 2000, { bold: true, shading: 'F8FAFC', align: 'right' })]),
    ...(rows.length ? rows.map(row => tableRow([
      tableCell(row.description || '', 3400),
      tableCell(row.unit || '', 1000, { align: 'center' }),
      tableCell(String(row.quantity || 0), 800, { align: 'right' }),
      tableCell(formatDocumentCurrency(row.unit_price, ''), 1800, { align: 'right' }),
      tableCell(formatDocumentCurrency(row.amount, ''), 2000, { align: 'right' }),
    ])) : [tableRow([tableCell('Chưa có dòng giá trị.', 9000, { colSpan: 5, align: 'center' })])]),
    ...[
      ['Trước VAT', totals.subtotal],
      [getVatLabel(vatConfig), totals.vat_amount],
      ['Tổng cộng', totals.total_amount],
    ].map(([label, value]) => tableRow([
      tableCell(label, 7000, { bold: true, align: 'right', colSpan: 4 }),
      tableCell(formatDocumentCurrency(value, ''), 2000, { bold: true, align: 'right' }),
    ])),
  ]
  return paragraph(title, { bold: true }) + simpleTable(tableRows, { width: 9000 })
}

function sectionsXml(document = {}) {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  if (sections.length) {
    return sections.map((section, index) => [
      paragraph(section.title || `Mục ${index + 1}`, { bold: true }),
      String(section.body || '').split(/\n+/).filter(Boolean).map(line => paragraph(line)).join(''),
    ].join('')).join('')
  }
  if (!hasDocumentText(document.terms_text)) return ''
  return paragraph('Điều khoản', { bold: true }) + String(document.terms_text || '').split(/\n+/).filter(Boolean).map(line => paragraph(line)).join('')
}

function advanceXml(document = {}) {
  const contract = getContractFromDocument(document)
  const summary = getAdvanceSummary(document)
  return [
    paragraph(`Căn cứ Hợp đồng số ${contract.contract_number || ''}, Bên B kính đề nghị Bên A thanh toán khoản tạm ứng như sau:`),
    summary.request_content ? paragraph(summary.request_content) : '',
    simpleTable([
      tableRow([tableCell('Giá trị hợp đồng', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(formatDocumentCurrency(summary.contract_value), 4800, { bold: true, align: 'right' })]),
      tableRow([tableCell('Tỷ lệ tạm ứng', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(`${summary.advance_percent}%`, 4800, { bold: true, align: 'right' })]),
      tableRow([tableCell('Số tiền đề nghị tạm ứng', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(formatDocumentCurrency(summary.advance_amount), 4800, { bold: true, align: 'right' })]),
    ], { width: 9000 }),
    summary.amount_words ? paragraph(`Bằng chữ: ${summary.amount_words}.`, { italic: true }) : '',
    paragraph(`Tài khoản nhận tiền: ${summary.bank_account || ''}`),
  ].join('')
}

function acceptanceXml(document = {}) {
  const contract = getContractFromDocument(document)
  const summary = getAcceptanceSummary(document)
  return [
    paragraph(`Hai bên cùng nghiệm thu khối lượng dịch vụ theo Hợp đồng số ${contract.contract_number || ''}.`),
    amountTable('Giá trị theo hợp đồng', summary.contract_rows, summary.contract_totals, summary.vat_config),
    amountTable('Giá trị nghiệm thu/thực tế', summary.actual_rows, summary.actual_totals, summary.vat_config),
    summary.amount_words ? paragraph(`Tổng giá trị nghiệm thu bằng chữ: ${summary.amount_words}.`, { italic: true }) : '',
    summary.acceptance_note ? paragraph(summary.acceptance_note) : '',
  ].join('')
}

function paymentXml(document = {}) {
  const contract = getContractFromDocument(document)
  const summary = getPaymentSummary(document)
  const deductionRows = summary.advance_deductions.length ? simpleTable([
    tableRow([tableCell('Đề nghị tạm ứng', 5000, { bold: true, shading: 'F8FAFC' }), tableCell('Số tiền gốc', 2000, { bold: true, shading: 'F8FAFC', align: 'right' }), tableCell('Khấu trừ', 2000, { bold: true, shading: 'F8FAFC', align: 'right' })]),
    ...summary.advance_deductions.map(row => tableRow([
      tableCell(row.document_number || row.document_title || '', 5000),
      tableCell(formatDocumentCurrency(row.original_amount, ''), 2000, { align: 'right' }),
      tableCell(formatDocumentCurrency(row.deduction_amount, ''), 2000, { align: 'right' }),
    ])),
  ], { width: 9000 }) : ''

  return [
    paragraph(`Căn cứ Hợp đồng số ${contract.contract_number || ''} và BBNT đã liên kết, Bên B kính đề nghị Bên A thanh toán giá trị còn lại.`),
    summary.request_content ? paragraph(summary.request_content) : '',
    simpleTable([
      tableRow([tableCell('Tổng nghiệm thu', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(formatDocumentCurrency(summary.acceptance_total), 4800, { bold: true, align: 'right' })]),
      tableRow([tableCell('Khấu trừ tạm ứng', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(formatDocumentCurrency(summary.advance_deduction_total), 4800, { bold: true, align: 'right' })]),
      tableRow([tableCell('Số tiền đề nghị thanh toán', 4200, { bold: true, shading: 'F8FAFC' }), tableCell(formatDocumentCurrency(summary.payment_amount), 4800, { bold: true, align: 'right' })]),
    ], { width: 9000 }),
    deductionRows,
    summary.amount_words ? paragraph(`Bằng chữ: ${summary.amount_words}.`, { italic: true }) : '',
    paragraph(`Tài khoản nhận tiền: ${summary.bank_account || ''}`),
  ].join('')
}

function bodyXml(document = {}) {
  if (document.document_type === 'acceptance_liquidation') return acceptanceXml(document)
  if (document.document_type === 'payment_request') return paymentXml(document)
  return advanceXml(document)
}

function documentXml(document = {}) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const issuedDate = formatDocumentDate(document.issued_date || document.created_at)

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paragraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' })}
    ${paragraph('Độc lập - Tự do - Hạnh phúc', { align: 'center' })}
    ${paragraph(getDocumentTitle(document), { style: 'Title', align: 'center', bold: true })}
    ${paragraph(`Số: ${document.document_number || ''} | Ngày lập: ${issuedDate}`, { align: 'center', bold: true })}
    ${partyTable(document)}
    ${richParagraph([{ text: 'Loại chứng từ: ', bold: true }, { text: getDocumentTypeLabel(document.document_type) }, { text: '    Hợp đồng: ', bold: true }, { text: contract.contract_number || '' }])}
    ${bodyXml(document)}
    ${sectionsXml(document)}
    ${simpleTable([
      tableRow([
        tableCell('ĐẠI DIỆN BÊN A', 4500, { bold: true, align: 'center' }),
        tableCell('ĐẠI DIỆN BÊN B', 4500, { bold: true, align: 'center' }),
      ]),
      tableRow([
        tableCell(customer.representative || '', 4500, { bold: true, align: 'center' }),
        tableCell(seller.representative || '', 4500, { bold: true, align: 'center' }),
      ]),
    ], { width: 9000, borders: false })}
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
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr>${DOCX_FONT_XML}<w:sz w:val="22"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr>${DOCX_FONT_XML}<w:b/><w:sz w:val="32"/></w:rPr></w:style>
</w:styles>`

function coreXml(document = {}) {
  const now = new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(getDocumentTitle(document))}</dc:title>
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

export function createContractDocumentDocxBlob(document = {}) {
  return makeZip([
    { name: '[Content_Types].xml', content: contentTypesXml },
    { name: '_rels/.rels', content: relsXml },
    { name: 'docProps/core.xml', content: coreXml(document) },
    { name: 'docProps/app.xml', content: appXml },
    { name: 'word/_rels/document.xml.rels', content: documentRelsXml },
    { name: 'word/styles.xml', content: stylesXml },
    { name: 'word/document.xml', content: documentXml(document) },
  ])
}

export function getContractDocumentDocxFilename(document = {}) {
  return getContractDocumentFilename(document, 'docx')
}

export function downloadContractDocumentDocx(document = {}) {
  const blob = createContractDocumentDocxBlob(document)
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url
  link.download = getContractDocumentDocxFilename(document)
  window.document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
