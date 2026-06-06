import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
  getAdvanceRequestContent,
  getBankAccountDetails,
  getContractDocumentFilename,
  getContractFromDocument,
  getCustomerProfile,
  getDisplayDocumentIssuedDate,
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentRequestContent,
  getPaymentSummary,
  getProfileLegalName,
  getProfileName,
  getSellerProfile,
  getVatLabel,
  hasDocumentText,
  shouldShowAcceptanceAmountTables,
} from './contractDocumentRender'

const encoder = new TextEncoder()
const DOCX_FONT_FAMILY = 'Times New Roman'
const DOCX_FONT_XML = `<w:rFonts w:ascii="${DOCX_FONT_FAMILY}" w:hAnsi="${DOCX_FONT_FAMILY}" w:eastAsia="${DOCX_FONT_FAMILY}" w:cs="${DOCX_FONT_FAMILY}"/>`
const DOCX_ACCEPTANCE_CONTENT_WIDTH = 9860
const DOCX_ACCEPTANCE_MARGINS_XML = '<w:pgMar w:top="567" w:right="1021" w:bottom="567" w:left="1021" w:header="708" w:footer="708" w:gutter="0"/>'
const DOCX_ACCEPTANCE_FONT_SIZE = 22
const DOCX_ACCEPTANCE_LINE_HEIGHT = 330
const DOCX_PAYMENT_MARGINS_XML = '<w:pgMar w:top="567" w:right="1021" w:bottom="567" w:left="1021" w:header="708" w:footer="708" w:gutter="0"/>'
const DOCX_PAYMENT_FONT_SIZE = 21
const DOCX_PAYMENT_LINE_HEIGHT = 330
const DOCX_PAYMENT_SIGNATURE_WIDTH = 2600
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

function textRun(text = '', { bold = false, italic = false, size } = {}) {
  const sizeXml = size ? `<w:sz w:val="${size}"/>` : ''
  return `<w:r><w:rPr>${DOCX_FONT_XML}${sizeXml}${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
}

function paragraphProps(options = {}) {
  const style = options.style ? `<w:pStyle w:val="${options.style}"/>` : ''
  const alignment = options.align ? `<w:jc w:val="${options.align}"/>` : ''
  const spacing = options.spacing === false
    ? ''
    : `<w:spacing w:before="${Number(options.before ?? 0)}" w:after="${Number(options.after ?? 120)}"${options.line ? ` w:line="${Number(options.line)}" w:lineRule="${options.lineRule || 'auto'}"` : ''}/>`
  return `<w:pPr>${style}${alignment}${spacing}</w:pPr>`
}

function paragraph(text = '', options = {}) {
  return `<w:p>${paragraphProps(options)}${textRun(text, options)}</w:p>`
}

function richParagraph(runs = [], options = {}) {
  return `<w:p>${paragraphProps(options)}${runs.map(run => textRun(run.text, run)).join('')}</w:p>`
}

function richMultilineParagraph(lines = [], options = {}) {
  const lineValues = (Array.isArray(lines) ? lines : [lines]).filter(hasDocumentText)
  if (!lineValues.length) return ''
  return `<w:p>${paragraphProps(options)}${lineValues.map((line, index) => (
    `${index ? '<w:r><w:br/></w:r>' : ''}${textRun(line, options)}`
  )).join('')}</w:p>`
}

function highlightedRuns(text = '', highlights = [], runOptions = {}) {
  const source = String(text || '')
  const highlightValues = highlights
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (!source || !highlightValues.length) return [{ text: source, ...runOptions }]

  const runs = []
  let cursor = 0

  while (cursor < source.length) {
    let nextMatch = null

    highlightValues.forEach(value => {
      const index = source.indexOf(value, cursor)
      if (index === -1) return
      if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && value.length > nextMatch.value.length)) {
        nextMatch = { index, value }
      }
    })

    if (!nextMatch) {
      runs.push({ text: source.slice(cursor), ...runOptions })
      break
    }

    if (nextMatch.index > cursor) {
      runs.push({ text: source.slice(cursor, nextMatch.index), ...runOptions })
    }
    runs.push({ text: nextMatch.value, ...runOptions, bold: true })
    cursor = nextMatch.index + nextMatch.value.length
  }

  return runs
}

function bankParagraph(label, value = '') {
  return richParagraph([
    { text: `${label}: ` },
    { text: value || '', bold: true },
  ])
}

function getUppercaseDocumentTitle(document = {}) {
  return String(getDocumentTitle(document) || '').toLocaleUpperCase('vi-VN')
}

function paymentParagraph(text = '', options = {}) {
  return paragraph(text, {
    size: DOCX_PAYMENT_FONT_SIZE,
    line: DOCX_PAYMENT_LINE_HEIGHT,
    lineRule: 'exact',
    after: 160,
    ...options,
  })
}

function paymentRichParagraph(runs = [], options = {}) {
  return richParagraph(runs.map(run => ({ size: DOCX_PAYMENT_FONT_SIZE, ...run })), {
    line: DOCX_PAYMENT_LINE_HEIGHT,
    lineRule: 'exact',
    after: 160,
    ...options,
  })
}

function paymentMultilineParagraph(lines = [], options = {}) {
  return richMultilineParagraph(lines, {
    size: DOCX_PAYMENT_FONT_SIZE,
    line: DOCX_PAYMENT_LINE_HEIGHT,
    lineRule: 'exact',
    after: 160,
    ...options,
  })
}

function paymentBankParagraph(label, value = '') {
  return paymentRichParagraph([
    { text: `${label}: ` },
    { text: value || '-', bold: true },
  ], { after: 80 })
}

function paymentSignatureTable() {
  return [
    paymentParagraph('', { size: 4, line: 240, lineRule: 'exact', after: 0 }),
    simpleTable([
      tableRow([
        tableCell('ĐẠI DIỆN', DOCX_PAYMENT_SIGNATURE_WIDTH, { bold: true, align: 'center', size: DOCX_PAYMENT_FONT_SIZE }),
      ]),
      tableRow([
        tableCell('', DOCX_PAYMENT_SIGNATURE_WIDTH, { align: 'center', size: DOCX_PAYMENT_FONT_SIZE }),
      ], { height: 1400 }),
    ], { width: DOCX_PAYMENT_SIGNATURE_WIDTH, borders: false, align: 'right' }),
  ].join('')
}

function getBankDetailLineParts(line = '') {
  const match = String(line || '').match(/^(\s*(?:Tài khoản chuyển khoản|Ngân hàng|Chủ tài khoản)\s*:\s*)(.+)$/i)
  if (!match) return null
  return {
    label: match[1],
    value: match[2],
  }
}

function bankAwareParagraph(line = '') {
  const bankLine = getBankDetailLineParts(line)
  if (!bankLine) return paragraph(line)

  return richParagraph([
    { text: bankLine.label },
    { text: bankLine.value, bold: true },
  ])
}

function acceptanceParagraph(text = '', options = {}) {
  return paragraph(text, {
    size: DOCX_ACCEPTANCE_FONT_SIZE,
    line: DOCX_ACCEPTANCE_LINE_HEIGHT,
    lineRule: 'exact',
    after: 0,
    ...options,
  })
}

function acceptanceRichParagraph(runs = [], options = {}) {
  return richParagraph(runs.map(run => ({ size: DOCX_ACCEPTANCE_FONT_SIZE, ...run })), {
    line: DOCX_ACCEPTANCE_LINE_HEIGHT,
    lineRule: 'exact',
    after: 0,
    ...options,
  })
}

function acceptanceInfoParagraph(label, value = '', options = {}) {
  return acceptanceRichParagraph([
    { text: `${label}: `, bold: true },
    { text: hasDocumentText(value) ? value : '-' },
  ], options)
}

function acceptanceRepresentativePositionParagraph(profile = {}, options = {}) {
  return acceptanceRichParagraph([
    { text: 'Đại diện: ', bold: true },
    { text: hasDocumentText(profile.representative) ? profile.representative : '-' },
    { text: ' | Chức vụ: ', bold: true },
    { text: hasDocumentText(profile.position) ? profile.position : '-' },
  ], options)
}

function acceptanceBlock(lines = [], options = {}) {
  const filteredLines = lines.filter(hasDocumentText)
  return filteredLines.map((line, index) => acceptanceParagraph(line, {
    after: index === filteredLines.length - 1 ? (options.after ?? 180) : 0,
  })).join('')
}

function acceptancePartyBlockXml(title, profile = {}, bankDetails = null, options = {}) {
  const after = options.after ?? 180
  const displayName = options.displayName || getProfileName(profile) || '-'
  const paragraphs = [
    paragraphOptions => acceptanceRichParagraph([{ text: `${title}: ${displayName}`, bold: true }], paragraphOptions),
    paragraphOptions => acceptanceRepresentativePositionParagraph(profile, paragraphOptions),
    paragraphOptions => acceptanceInfoParagraph('Địa chỉ', profile.address, paragraphOptions),
    paragraphOptions => acceptanceInfoParagraph('Mã số thuế', profile.tax_code, paragraphOptions),
  ]

  if (bankDetails?.account_number) {
    paragraphs.push(paragraphOptions => acceptanceInfoParagraph('Số tài khoản', bankDetails.account_number, paragraphOptions))
  }

  if (bankDetails?.bank_name) {
    paragraphs.push(paragraphOptions => acceptanceInfoParagraph('Ngân hàng', bankDetails.bank_name, paragraphOptions))
  }

  return paragraphs.map((renderParagraph, index) => renderParagraph({
    after: index === paragraphs.length - 1 ? after : 0,
  })).join('')
}

function acceptanceBankAwareParagraph(line = '', options = {}) {
  const bankLine = getBankDetailLineParts(line)
  if (!bankLine) return acceptanceParagraph(line, options)

  return acceptanceRichParagraph([
    { text: bankLine.label },
    { text: bankLine.value, bold: true },
  ], options)
}

function getAcceptanceLineAfter(line, index, lines = []) {
  if (index >= lines.length - 1) return 0
  return getBankDetailLineParts(line) ? 0 : 80
}

function acceptanceArticleSpacer() {
  return paragraph('', {
    size: 4,
    line: 120,
    lineRule: 'exact',
    after: 0,
  })
}

function tableCell(content = '', width = 2400, options = {}) {
  const shading = options.shading ? `<w:shd w:fill="${options.shading}"/>` : ''
  const gridSpan = options.colSpan ? `<w:gridSpan w:val="${options.colSpan}"/>` : ''
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${shading}</w:tcPr>${paragraph(content, { bold: options.bold, spacing: false, align: options.align, size: options.size })}</w:tc>`
}

function tableMultilineCell(lines = [], width = 2400, options = {}) {
  const shading = options.shading ? `<w:shd w:fill="${options.shading}"/>` : ''
  const gridSpan = options.colSpan ? `<w:gridSpan w:val="${options.colSpan}"/>` : ''
  const paragraphs = (Array.isArray(lines) ? lines : [lines]).map(line => (
    paragraph(line, { bold: options.bold, spacing: false, align: options.align, size: options.size })
  )).join('')
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${gridSpan}${shading}</w:tcPr>${paragraphs}</w:tc>`
}

function tableRow(cells = [], options = {}) {
  const rowProps = options.height ? `<w:trPr><w:trHeight w:val="${options.height}" w:hRule="${options.heightRule || 'exact'}"/></w:trPr>` : ''
  return `<w:tr>${rowProps}${cells.join('')}</w:tr>`
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
  const bank = getBankAccountDetails(document)
  const rowsFor = (heading, profile, bankDetails = null) => [
    tableRow([tableCell(heading, 1800, { bold: true }), tableCell(getProfileName(profile), 7200, { bold: true })]),
    tableRow([tableCell('Đại diện', 1800), tableCell(profile.representative || '', 7200)]),
    tableRow([tableCell('Chức vụ', 1800), tableCell(profile.position || '', 7200)]),
    tableRow([tableCell('Địa chỉ', 1800), tableCell(profile.address || '', 7200)]),
    tableRow([tableCell('Mã số thuế', 1800), tableCell(profile.tax_code || '', 7200)]),
    bankDetails?.account_number ? tableRow([tableCell('Số tài khoản', 1800), tableCell(bankDetails.account_number, 7200)]) : '',
    bankDetails?.bank_name ? tableRow([tableCell('Ngân hàng', 1800), tableCell(bankDetails.bank_name, 7200)]) : '',
  ].join('')

  return simpleTable([
    rowsFor(document.document_type === 'acceptance_liquidation' ? 'BÊN A' : 'KÍNH GỬI', customer),
    rowsFor(document.document_type === 'acceptance_liquidation' ? 'BÊN B' : 'BÊN ĐỀ NGHỊ', seller, document.document_type === 'acceptance_liquidation' ? bank : null),
  ], { width: 9000, fixed: true, borders: false })
}

function acceptanceAmountTable(title, rows = [], totals = {}, vatConfig = {}) {
  const widths = {
    stt: 690,
    description: 3648,
    unit: 986,
    quantity: 1085,
    unitPrice: 1676,
    amount: 1775,
  }
  const tableFontSize = DOCX_ACCEPTANCE_FONT_SIZE
  const tableRows = [
    tableRow([
      tableCell('STT', widths.stt, { bold: true, shading: 'F8FAFC', align: 'center', size: tableFontSize }),
      tableCell('Hạng mục', widths.description, { bold: true, shading: 'F8FAFC', size: tableFontSize }),
      tableCell('ĐVT', widths.unit, { bold: true, shading: 'F8FAFC', size: tableFontSize }),
      tableCell('Số lượng', widths.quantity, { bold: true, shading: 'F8FAFC', align: 'right', size: tableFontSize }),
      tableCell('Đơn giá (VNĐ)', widths.unitPrice, { bold: true, shading: 'F8FAFC', align: 'right', size: tableFontSize }),
      tableCell('Thành tiền (VNĐ)', widths.amount, { bold: true, shading: 'F8FAFC', align: 'right', size: tableFontSize }),
    ]),
    ...(rows.length ? rows.map((row, index) => tableRow([
      tableCell(String(index + 1), widths.stt, { align: 'center', size: tableFontSize }),
      tableCell(row.description || '', widths.description, { size: tableFontSize }),
      tableCell(row.unit || '', widths.unit, { size: tableFontSize }),
      tableCell(String(row.quantity || 0), widths.quantity, { align: 'right', size: tableFontSize }),
      tableCell(formatDocumentCurrency(row.unit_price, ''), widths.unitPrice, { align: 'right', size: tableFontSize }),
      tableCell(formatDocumentCurrency(row.amount, ''), widths.amount, { align: 'right', size: tableFontSize }),
    ])) : [tableRow([tableCell('Chưa có hạng mục.', DOCX_ACCEPTANCE_CONTENT_WIDTH, { colSpan: 6, align: 'center', size: tableFontSize })])]),
    tableRow([
      tableMultilineCell(['Tổng', getVatLabel(vatConfig), 'Tổng chi phí'], DOCX_ACCEPTANCE_CONTENT_WIDTH - widths.amount, { bold: true, shading: 'F8FAFC', align: 'right', colSpan: 5, size: tableFontSize }),
      tableMultilineCell([
        formatDocumentCurrency(totals.subtotal, ''),
        formatDocumentCurrency(totals.vat_amount, ''),
        formatDocumentCurrency(totals.total_amount, ''),
      ], widths.amount, { bold: true, shading: 'F8FAFC', align: 'right', size: tableFontSize }),
    ]),
  ]
  return acceptanceParagraph(`${title}:`, { bold: true, after: 80 }) + simpleTable(tableRows, { width: DOCX_ACCEPTANCE_CONTENT_WIDTH })
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
  const bank = getBankAccountDetails(document)
  const content = getAdvanceRequestContent(document)
  return [
    content.greeting ? paragraph(content.greeting) : '',
    content.basis ? paragraph(content.basis) : '',
    content.request ? paragraph(content.request) : '',
    content.amount_words ? paragraph(content.amount_words) : '',
    content.method ? paragraph(content.method) : '',
    content.bank_intro ? paragraph(content.bank_intro) : '',
    bankParagraph('Tài khoản chuyển khoản', bank.account_number),
    bankParagraph('Ngân hàng', bank.bank_name),
    bankParagraph('Chủ tài khoản', bank.account_holder),
    ...String(content.closing || '').split(/\n+/).filter(Boolean).map(line => paragraph(line)),
  ].join('')
}

function acceptanceXml(document = {}) {
  const content = getAcceptanceLiquidationContent(document)
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const bank = getBankAccountDetails(document)
  const summary = getAcceptanceSummary(document)
  const showAmountTables = shouldShowAcceptanceAmountTables(document, summary)
  return [
    acceptanceBlock([
      content.basis_contract,
      content.basis_completed,
      content.party_intro,
    ]),
    acceptancePartyBlockXml('BÊN A', customer, null, { after: 0 }),
    acceptanceParagraph('Và', { after: 0 }),
    acceptancePartyBlockXml('BÊN B', seller, bank, { after: 120, displayName: getProfileLegalName(seller) }),
    content.signing_intro ? acceptanceParagraph(content.signing_intro, { after: 120 }) : '',
    ...content.articles.map((section, sectionIndex) => [
      acceptanceParagraph(section.title, { bold: true, after: 100 }),
      ...String(section.body || '').split(/\n+/).filter(Boolean).map((line, index, lines) => acceptanceBankAwareParagraph(line, {
        after: getAcceptanceLineAfter(line, index, lines),
      })),
      showAmountTables && section.id === 'acceptance-article-2'
        ? [
            acceptanceAmountTable('Bảng giá trị theo hợp đồng', summary.contract_rows, summary.contract_totals, summary.vat_config),
            acceptanceAmountTable('Bảng giá trị nghiệm thu/thực tế', summary.actual_rows, summary.actual_totals, summary.vat_config),
            content.cost_difference_note ? acceptanceParagraph(content.cost_difference_note, { after: 80 }) : '',
          ].join('')
        : '',
      sectionIndex < content.articles.length - 1 ? acceptanceArticleSpacer() : '',
    ].join('')),
  ].join('')
}

function paymentXml(document = {}) {
  const bank = getBankAccountDetails(document)
  const content = getPaymentRequestContent(document)
  const summary = getPaymentSummary(document)
  const paymentAmountText = formatDocumentCurrency(summary.payment_amount, '')
  const paymentAmountWithCurrencyText = paymentAmountText ? `${paymentAmountText} VNĐ` : ''
  const closingLines = String(content.closing || '').split(/\n+/).filter(Boolean)

  return [
    content.greeting ? paymentParagraph(content.greeting) : '',
    content.basis ? paymentParagraph(content.basis) : '',
    content.request ? paymentRichParagraph(highlightedRuns(content.request, [paymentAmountWithCurrencyText, paymentAmountText])) : '',
    content.amount_words ? paymentRichParagraph(highlightedRuns(content.amount_words, [summary.amount_words], { italic: true })) : '',
    content.method ? paymentParagraph(content.method) : '',
    content.bank_intro ? paymentParagraph(content.bank_intro, { after: 80 }) : '',
    paymentBankParagraph('Tài khoản chuyển khoản', bank.account_number),
    paymentBankParagraph('Ngân hàng', bank.bank_name),
    paymentBankParagraph('Chủ tài khoản', bank.account_holder),
    closingLines.length ? paymentMultilineParagraph(closingLines, { after: 0 }) : '',
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
  const issuedDate = getDisplayDocumentIssuedDate(document)

  if (document.document_type === 'advance_request' || document.document_type === 'payment_request') {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${paymentParagraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center', bold: true, after: 0 })}
    ${paymentParagraph('Độc lập - Tự do - Hạnh phúc', { align: 'center', bold: true, after: 0 })}
    ${issuedDate ? paymentParagraph(`Ngày ${issuedDate}`, { align: 'right', italic: true, before: 360, after: 320 }) : paymentParagraph('', { size: 4, line: 360, lineRule: 'exact', after: 320 })}
    ${paymentParagraph(getUppercaseDocumentTitle(document), { align: 'center', bold: true, size: 28, line: 340, after: 60 })}
    ${paymentParagraph(`Số: ${document.document_number || ''}`, { align: 'center', after: 360 })}
    ${document.document_type === 'payment_request' ? paymentXml(document) : advanceXml(document)}
    ${paymentSignatureTable()}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/>${DOCX_PAYMENT_MARGINS_XML}</w:sectPr>
  </w:body>
</w:document>`
  }

  if (document.document_type === 'acceptance_liquidation') {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${acceptanceParagraph('CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center', bold: true })}
    ${acceptanceParagraph('Độc lập - Tự do - Hạnh phúc', { align: 'center', bold: true })}
    ${paragraph('BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG', { align: 'center', bold: true, size: 28, before: 300, after: 360, line: 340 })}
    ${acceptanceXml(document)}
    ${acceptanceParagraph('', { after: 180 })}
    ${simpleTable([
      tableRow([
        tableCell('ĐẠI DIỆN BÊN A', DOCX_ACCEPTANCE_CONTENT_WIDTH / 2, { bold: true, align: 'center', size: DOCX_ACCEPTANCE_FONT_SIZE }),
        tableCell('ĐẠI DIỆN BÊN B', DOCX_ACCEPTANCE_CONTENT_WIDTH / 2, { bold: true, align: 'center', size: DOCX_ACCEPTANCE_FONT_SIZE }),
      ]),
      tableRow([
        tableCell('', DOCX_ACCEPTANCE_CONTENT_WIDTH / 2, { align: 'center', size: DOCX_ACCEPTANCE_FONT_SIZE }),
        tableCell('', DOCX_ACCEPTANCE_CONTENT_WIDTH / 2, { align: 'center', size: DOCX_ACCEPTANCE_FONT_SIZE }),
      ], { height: 1500 }),
    ], { width: DOCX_ACCEPTANCE_CONTENT_WIDTH, borders: false })}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/>${DOCX_ACCEPTANCE_MARGINS_XML}</w:sectPr>
  </w:body>
</w:document>`
  }

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
