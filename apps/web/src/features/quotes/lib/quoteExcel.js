import { getMatchedEquipmentRules } from './equipmentRules.js'
import { getQuoteTerms } from './quoteTerms.js'

const MONEY_FORMAT = '#,##0'
const FONT_NAME = 'Montserrat'
const TABLE_HEADER_FILL = 'FF757070'
const DARK_TEXT = 'FF111111'
const BLACK = 'FF000000'

function formatQuoteDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function formatQuoteLocationDate(value) {
  return `Hà Nội, ngày ${formatQuoteDate(value)}`
}

function getClientName(quote = {}) {
  return quote.client_name || quote.customer_name || quote.client?.name || '-'
}

function getQuoteCode(quote = {}) {
  const code = quote.quote_number || quote.id || quote.share_token || 'DRAFT'
  return String(code).replace(/^#/, '')
}

function getEntityMeta(quote = {}, legalEntities = []) {
  const code = quote.entity_code || 'EVENTUS'
  const entity = legalEntities.find(row => (row.entity_code || row.code) === code)
  const company = entity?.legal_name || entity?.entity_name_full || entity?.name || (code === 'MEDIAMONSTER' ? 'CÔNG TY TNHH MEDIAMONSTER' : 'CÔNG TY TNHH EVENTUS VIỆT NAM')
  const taxCode = entity?.tax_code || ''
  const address = entity?.address || ''
  const email = entity?.email || ''
  const hotline = entity?.hotline || ''
  const website = entity?.website || ''
  return {
    code,
    company,
    taxCode,
    taxCodeLine: taxCode ? `MST: ${taxCode}` : '',
    address: address ? `Địa chỉ: ${address}` : '',
    email: email ? `Email: ${email}` : '',
    hotline: hotline ? `Hotline: ${hotline}` : '',
    website,
    websiteLine: website ? website.replace(/^https?:\/\//i, '') : '',
    logoFile: entity?.logo_file || entity?.logoFile || (code === 'MEDIAMONSTER' ? 'logo_mediamonster.png' : 'logo_eventus.png'),
  }
}

function getItemName(item = {}) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getItemUnit(item = {}) {
  return item.unit || item.service?.unit || item.pricing_unit || 'Người'
}

function getItemGroupLabel(item = {}) {
  return String(item.group_label || item.event_day || item.day_index || item.day || 'Hạng mục').trim() || 'Hạng mục'
}

function getItemGroupSortOrder(item = {}) {
  const sortOrder = Number(item.group_sort_order)
  return Number.isFinite(sortOrder) ? sortOrder : 99
}

function getQuoteTableHeaderRowNumber(rows = []) {
  const index = rows.findIndex(row => row[0] === 'Hạng mục' && row[1] === 'ĐVT')
  return index >= 0 ? index + 1 : 1
}

export function groupQuoteExcelItems(items = []) {
  const groups = new Map()
  items.forEach((item, index) => {
    const label = getItemGroupLabel(item)
    const key = `${item.group_code || label}-${label}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        sortOrder: getItemGroupSortOrder(item),
        firstIndex: index,
        items: [],
      })
    }
    groups.get(key).items.push(item)
  })

  return Array.from(groups.values()).sort((a, b) => (a.sortOrder - b.sortOrder) || (a.firstIndex - b.firstIndex))
}

function getGroupTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.total_price || 0), 0)
}

export function getQuoteExcelFilename(quote = {}) {
  const quoteNumber = String(quote.quote_number || getQuoteCode(quote) || 'DRAFT').replace(/^#/, '').replace(/[^a-zA-Z0-9]/g, '') || 'DRAFT'
  const entityLabel = quote.entity_code === 'MEDIAMONSTER' ? 'Mediamonster' : 'Eventus'
  return `Bao gia - ${entityLabel} - ${quoteNumber}.xlsx`
}

export function buildQuoteExcelRows(quote = {}, items = [], options = {}) {
  const { equipmentRules = [], legalEntities = [] } = options
  const entity = getEntityMeta(quote, legalEntities)
  const groups = groupQuoteExcelItems(items)
  const showGroupHeaders = groups.length > 1
  const rows = [
    [null, null, entity.company],
    [null, null, entity.taxCodeLine],
    [null, null, entity.address],
    [null, null, entity.email],
    [null, null, [entity.websiteLine, entity.hotline].filter(Boolean).join(' | ')],
    [null, null, `#${getQuoteCode(quote)}`],
    [],
    ['BÁO GIÁ DỊCH VỤ'],
    [],
    [` Kính gửi: ${getClientName(quote)}`],
    [' Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:'],
    [],
    ['Hạng mục', 'ĐVT', 'Số lượng', 'Số buổi', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)'],
    [],
  ]

  groups.forEach(group => {
    if (showGroupHeaders) {
      rows.push([group.label, null, null, null, null, getGroupTotal(group.items)])
    }
    group.items.forEach(item => {
      rows.push([
        getItemName(item),
        getItemUnit(item),
        Number(item.quantity || 1),
        Number(item.num_sessions || 1),
        Number(item.unit_price || 0),
        Number(item.total_price || 0),
      ])
    })
  })

  if (!items.length) {
    rows.push(['Chưa có hạng mục.', null, null, null, null, 0])
  }

  rows.push(['Cộng  ', null, null, null, null, Number(quote.subtotal || 0)])
  if (Number(quote.travel_fee_total || 0) > 0) rows.push(['Phụ phí di chuyển  ', null, null, null, null, Number(quote.travel_fee_total || 0)])
  if (Number(quote.overtime_fee_total || 0) > 0) rows.push(['Phụ phí Over-time  ', null, null, null, null, Number(quote.overtime_fee_total || 0)])
  if (quote.has_vat) rows.push(['VAT 8%  ', null, null, null, null, Number(quote.vat_amount || 0)])
  rows.push([quote.has_vat ? 'Tổng chi phí (Đã bao gồm VAT)  ' : 'Tổng chi phí  ', null, null, null, null, Number(quote.total_amount || 0)])

  const matchedEquipmentRules = getMatchedEquipmentRules(items, equipmentRules)
  const terms = getQuoteTerms(quote)
  const paymentTerms = [
    'Đợt 1 (Tạm ứng): Quý khách vui lòng thanh toán 50% tổng giá trị báo giá sau khi xác nhận báo giá để giữ lịch nhân sự và chuẩn bị thiết bị.',
    'Đợt 2 (Tất toán): Thanh toán 50% giá trị còn lại trong vòng 03 ngày làm việc sau khi bàn giao đầy đủ sản phẩm cuối cùng.',
  ]
  const noteLines = ['Lưu ý:']

  if (matchedEquipmentRules.length) {
    noteLines.push('* Thiết bị sử dụng:')
    matchedEquipmentRules.forEach(rule => noteLines.push(`+ ${rule.equipment_title}: ${rule.equipment_description}`))
  }
  terms.forEach(term => noteLines.push(`* ${term}`))
  noteLines.push('* Điều khoản thanh toán:')
  paymentTerms.forEach(term => noteLines.push(`+ ${term}`))

  rows.push([])
  rows.push([noteLines.join('\n')])
  rows.push([])
  rows.push([null, null, null, null, formatQuoteLocationDate(quote.created_at)])
  rows.push([null, null, null, null, 'Người phụ trách'])
  rows.push([])
  rows.push([null, null, null, null, 'Nguyễn Thu Huyền'])
  rows.push([null, null, null, null, 'Account Manager'])

  return rows
}

function mergeAcrossSheet(sheet, rowNumber, startColumn = 'A', endColumn = 'F') {
  sheet.mergeCells(`${startColumn}${rowNumber}:${endColumn}${rowNumber}`)
}

function applyQuoteSheetFormatting(sheet, rows) {
  const border = {
    top: { style: 'thin', color: { argb: BLACK } },
    left: { style: 'thin', color: { argb: BLACK } },
    bottom: { style: 'thin', color: { argb: BLACK } },
    right: { style: 'thin', color: { argb: BLACK } },
  }

  sheet.columns = [
    { key: 'item', width: 44 },
    { key: 'unit', width: 10 },
    { key: 'quantity', width: 15.5 },
    { key: 'sessions', width: 15.5 },
    { key: 'unitPrice', width: 20.5 },
    { key: 'total', width: 20.5 },
  ]
  const headerRowNumber = getQuoteTableHeaderRowNumber(rows)
  sheet.views = [{ state: 'normal', showGridLines: true, zoomScale: 100 }]
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'portrait',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0, footer: 0 },
  }
  sheet.properties.defaultRowHeight = 15.75

  ;['C1:F1', 'C2:F2', 'C3:F3', 'C4:F4', 'C5:F5', 'C6:F6', 'A8:F8', 'A10:F10', 'A11:F11'].forEach(range => sheet.mergeCells(range))
  ;['A', 'B', 'C', 'D', 'E', 'F'].forEach(column => sheet.mergeCells(`${column}${headerRowNumber}:${column}${headerRowNumber + 1}`))

  ;[1, 2, 3, 4, 5, 6].forEach(rowNumber => {
    const cell = sheet.getCell(`C${rowNumber}`)
    cell.font = {
      name: FONT_NAME,
      size: rowNumber === 1 ? 12 : 9,
      bold: rowNumber === 1,
      italic: rowNumber === 6,
      color: { argb: DARK_TEXT },
    }
    cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true }
  })
  sheet.getRow(1).height = 16
  sheet.getRow(2).height = 14
  ;[3, 4, 5, 6].forEach(rowNumber => {
    sheet.getRow(rowNumber).height = 13
  })
  sheet.getRow(7).height = 28

  sheet.getCell('A8').font = { name: FONT_NAME, size: 18, bold: true, color: { argb: DARK_TEXT } }
  sheet.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(8).height = 27.75
  sheet.getRow(9).height = 14
  sheet.getCell('A10').font = { name: FONT_NAME, size: 11, bold: true, italic: true, color: { argb: DARK_TEXT } }
  sheet.getCell('A11').font = { name: FONT_NAME, size: 11, italic: true, color: { argb: DARK_TEXT } }
  ;[10, 11].forEach(rowNumber => {
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    sheet.getRow(rowNumber).height = 14
  })
  sheet.getRow(headerRowNumber - 1).height = 44

  const headerRow = sheet.getRow(headerRowNumber)
  headerRow.height = 30
  headerRow.eachCell(cell => {
    cell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TABLE_HEADER_FILL }, bgColor: { argb: TABLE_HEADER_FILL } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = {
      left: border.left,
      right: border.right,
      top: border.top,
    }
  })
  sheet.getRow(headerRowNumber + 1).height = 6

  const subtotalRowNumber = rows.findIndex(row => row[0] === 'Cộng  ') + 1
  const grandTotalRowNumber = rows.findIndex(row => String(row[0] || '').startsWith('Tổng chi phí')) + 1
  const tableEndRowNumber = subtotalRowNumber - 1

  for (let rowNumber = headerRowNumber + 2; rowNumber <= tableEndRowNumber; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const isGroupRow = Boolean(row.getCell(1).value) &&
      !row.getCell(2).value &&
      !row.getCell(3).value &&
      !row.getCell(4).value &&
      !row.getCell(5).value

    if (isGroupRow) mergeAcrossSheet(sheet, rowNumber, 'A', 'E')

    row.eachCell((cell, columnNumber) => {
      cell.font = { name: FONT_NAME, size: 11, color: { argb: DARK_TEXT }, bold: isGroupRow }
      cell.border = border
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber === 1 ? 'left' : 'center',
        wrapText: columnNumber === 1,
      }
      if ((columnNumber === 5 || columnNumber === 6) && typeof cell.value === 'number') {
        cell.numFmt = MONEY_FORMAT
      }
      if (isGroupRow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDED' } }
      }
    })
    row.height = isGroupRow ? 24 : 54
    if (isGroupRow) {
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    }
  }

  for (let rowNumber = subtotalRowNumber; rowNumber <= grandTotalRowNumber; rowNumber += 1) {
    sheet.mergeCells(`A${rowNumber}:E${rowNumber}`)
    const labelCell = sheet.getCell(`A${rowNumber}`)
    const valueCell = sheet.getCell(`F${rowNumber}`)
    labelCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: DARK_TEXT } }
    valueCell.font = { name: FONT_NAME, size: 11, bold: true, color: { argb: DARK_TEXT } }
    valueCell.numFmt = MONEY_FORMAT
    labelCell.alignment = { horizontal: 'right' }
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' }
    labelCell.border = border
    valueCell.border = border
    sheet.getRow(rowNumber).height = 33.75
  }

  const noteRowNumber = rows.findIndex(row => typeof row[0] === 'string' && row[0].startsWith('Lưu ý:')) + 1
  if (noteRowNumber > grandTotalRowNumber + 1) {
    sheet.getRow(noteRowNumber - 1).height = 30
  }
  if (noteRowNumber > 0) {
    mergeAcrossSheet(sheet, noteRowNumber)
    const noteCell = sheet.getCell(`A${noteRowNumber}`)
    const noteText = String(noteCell.value || '')
    noteCell.value = {
      richText: [
        { font: { name: FONT_NAME, size: 10, bold: true, italic: true, color: { argb: DARK_TEXT } }, text: ' Lưu ý:\n' },
        { font: { name: FONT_NAME, size: 10, italic: true, color: { argb: DARK_TEXT } }, text: noteText.replace(/^Lưu ý:\n?/, '') },
      ],
    }
    noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' }, bgColor: { argb: 'FFFFFFFF' } }
    sheet.getRow(noteRowNumber).height = Math.max(92, Math.min(150, noteText.split('\n').length * 16))
  }

  const signatureNameRowNumber = rows.findIndex(row => row[4] === 'Nguyễn Thu Huyền') + 1
  if (signatureNameRowNumber > 1) {
    sheet.getRow(signatureNameRowNumber - 1).height = 48
  }

  for (let rowNumber = Math.max(noteRowNumber + 1, grandTotalRowNumber + 1); rowNumber <= rows.length; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const rightCell = row.getCell(5)
    if (!rightCell.value) continue
    sheet.mergeCells(`E${rowNumber}:F${rowNumber}`)
    rightCell.alignment = { horizontal: 'center', vertical: 'middle' }
    rightCell.font = {
      name: FONT_NAME,
      size: 11,
      bold: rightCell.value === 'Người phụ trách' || rightCell.value === 'Nguyễn Thu Huyền',
      italic: String(rightCell.value || '').startsWith('Hà Nội'),
      color: { argb: DARK_TEXT },
    }
    row.height = 19.5
  }

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.font = { name: FONT_NAME, ...cell.font }
    })
  })
}

function getLogoExtension(value = '') {
  const extension = String(value || '').split('.').pop()?.toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : 'png'
}

function addQuoteLogo(workbook, sheet, options = {}) {
  if (!options.logoBase64) return
  const imageId = workbook.addImage({
    base64: options.logoBase64,
    extension: options.logoExtension || getLogoExtension(options.logoFile),
  })
  sheet.addImage(imageId, {
    tl: { col: 0, row: 0 },
    ext: { width: 190, height: 80 },
  })
}

export function buildQuoteExcelWorkbook(quote = {}, items = [], ExcelJSModule, options = {}) {
  const rows = buildQuoteExcelRows(quote, items, options)
  const ExcelJS = ExcelJSModule.default || ExcelJSModule
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Eventus Production'
  workbook.created = quote.created_at ? new Date(quote.created_at) : new Date()
  const sheet = workbook.addWorksheet('Bao gia')
  sheet.addRows(rows)
  applyQuoteSheetFormatting(sheet, rows)
  addQuoteLogo(workbook, sheet, options)
  return workbook
}
