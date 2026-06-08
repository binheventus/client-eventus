import { getMatchedEquipmentRules } from './equipmentRules.js'
import { getQuoteTerms } from './quoteTerms.js'

const MONEY_FORMAT = '#,##0 "đ"'

function sanitizeFilenamePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'Khach'
}

function formatDateForFilename(value) {
  const date = value ? new Date(value) : new Date()
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
}

function formatQuoteDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
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
  return {
    company: entity?.legal_name || entity?.entity_name_full || entity?.name || (code === 'MEDIAMONSTER' ? 'CÔNG TY TNHH MEDIAMONSTER' : 'CÔNG TY TNHH EVENTUS VIỆT NAM'),
    taxCode: entity?.tax_code ? `MST: ${entity.tax_code}` : '',
    address: entity?.address ? `Địa chỉ: ${entity.address}` : '',
    contact: [entity?.email ? `Email: ${entity.email}` : null, entity?.hotline ? `Hotline: ${entity.hotline}` : null].filter(Boolean).join(' | '),
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
  const quoteNumber = quote.quote_number || 'Bao-gia'
  const date = formatDateForFilename(quote.created_at)
  return `${sanitizeFilenamePart(quoteNumber)}_${sanitizeFilenamePart(getClientName(quote))}_${date}.xlsx`
}

export function buildQuoteExcelRows(quote = {}, items = [], options = {}) {
  const { equipmentRules = [], legalEntities = [] } = options
  const entity = getEntityMeta(quote, legalEntities)
  const groups = groupQuoteExcelItems(items)
  const showGroupHeaders = groups.length > 1
  const rows = [
    ['BÁO GIÁ DỊCH VỤ'],
    [`#${getQuoteCode(quote)}`],
    [],
    [entity.company],
    [entity.taxCode],
    [entity.address],
    [entity.contact],
    [],
    [`Kính gửi: ${getClientName(quote)}`],
    ['Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:'],
    [],
    ['Hạng mục', 'ĐVT', 'Số lượng', 'Số buổi', 'Đơn giá', 'Thành tiền'],
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

  rows.push([])
  rows.push([null, null, null, null, 'Subtotal', Number(quote.subtotal || 0)])
  if (Number(quote.travel_fee_total || 0) > 0) rows.push([null, null, null, null, 'Phụ phí di chuyển', Number(quote.travel_fee_total || 0)])
  if (Number(quote.overtime_fee_total || 0) > 0) rows.push([null, null, null, null, 'Phụ phí Over-time', Number(quote.overtime_fee_total || 0)])
  if (quote.has_vat) rows.push([null, null, null, null, 'Thuế GTGT 8%', Number(quote.vat_amount || 0)])
  rows.push([null, null, null, null, 'Tổng cộng', Number(quote.total_amount || 0)])

  const matchedEquipmentRules = getMatchedEquipmentRules(items, equipmentRules)
  const terms = getQuoteTerms(quote)
  const paymentTerms = [
    'Đợt 1 (Tạm ứng): Quý khách vui lòng thanh toán 50% tổng giá trị báo giá sau khi xác nhận báo giá để giữ lịch nhân sự và chuẩn bị thiết bị.',
    'Đợt 2 (Tất toán): Thanh toán 50% giá trị còn lại trong vòng 03 ngày làm việc sau khi bàn giao đầy đủ sản phẩm cuối cùng.',
  ]

  rows.push([])
  if (matchedEquipmentRules.length) {
    rows.push(['THIẾT BỊ SỬ DỤNG'])
    matchedEquipmentRules.forEach(rule => rows.push([`• ${rule.equipment_title}: ${rule.equipment_description}`]))
    rows.push([])
  }
  rows.push(['ĐIỀU KHOẢN & ĐIỀU KIỆN'])
  terms.forEach(term => rows.push([`• ${term}`]))
  rows.push([])
  rows.push(['ĐIỀU KHOẢN THANH TOÁN'])
  paymentTerms.forEach(term => rows.push([`• ${term}`]))
  rows.push([])
  rows.push(['Người phụ trách', 'Nguyễn Thu Huyền'])
  rows.push(['Chức vụ', 'Account Manager'])

  return rows
}

function mergeAcrossSheet(sheet, rowNumber, startColumn = 'A', endColumn = 'F') {
  sheet.mergeCells(`${startColumn}${rowNumber}:${endColumn}${rowNumber}`)
}

function applyQuoteSheetFormatting(sheet, rows) {
  const border = {
    top: { style: 'thin', color: { argb: 'FFD7DEE8' } },
    left: { style: 'thin', color: { argb: 'FFD7DEE8' } },
    bottom: { style: 'thin', color: { argb: 'FFD7DEE8' } },
    right: { style: 'thin', color: { argb: 'FFD7DEE8' } },
  }
  const orange = 'FFF8981D'
  const dark = 'FF1E293B'

  sheet.columns = [
    { key: 'item', width: 42 },
    { key: 'unit', width: 13 },
    { key: 'quantity', width: 11 },
    { key: 'sessions', width: 10 },
    { key: 'unitPrice', width: 18 },
    { key: 'total', width: 20 },
  ]
  const headerRowNumber = getQuoteTableHeaderRowNumber(rows)
  sheet.views = [{ state: 'frozen', ySplit: headerRowNumber }]
  sheet.autoFilter = `A${headerRowNumber}:F${headerRowNumber}`
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
  sheet.properties.defaultRowHeight = 20

  ;[1, 2, 4, 5, 6, 7].forEach(rowNumber => mergeAcrossSheet(sheet, rowNumber))
  ;[9, 10].forEach(rowNumber => mergeAcrossSheet(sheet, rowNumber))

  sheet.getCell('A1').font = { name: 'Arial', size: 20, bold: true, color: { argb: orange } }
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 32
  sheet.getCell('A2').font = { name: 'Arial', size: 12, bold: true, color: { argb: dark } }
  sheet.getCell('A2').alignment = { horizontal: 'center' }
  sheet.getCell('A4').font = { name: 'Arial', size: 12, bold: true, color: { argb: dark } }

  ;[4, 5, 6, 7].forEach(rowNumber => {
    sheet.getCell(`A${rowNumber}`).alignment = { wrapText: true, vertical: 'middle' }
  })
  sheet.getCell('A9').font = { name: 'Arial', size: 11, bold: true, color: { argb: dark } }
  sheet.getCell('A10').font = { name: 'Arial', size: 10, color: { argb: dark } }
  ;[9, 10].forEach(rowNumber => {
    sheet.getCell(`A${rowNumber}`).alignment = { wrapText: true, vertical: 'middle' }
  })
  sheet.getRow(9).height = 22
  sheet.getRow(10).height = 28

  const headerRow = sheet.getRow(headerRowNumber)
  headerRow.height = 26
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orange } }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = border
  })

  const subtotalRowNumber = rows.findIndex(row => row[4] === 'Subtotal') + 1
  const grandTotalRowNumber = rows.findIndex(row => row[4] === 'Tổng cộng') + 1
  const tableEndRowNumber = subtotalRowNumber - 2

  for (let rowNumber = headerRowNumber + 1; rowNumber <= tableEndRowNumber; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const isGroupRow = Boolean(row.getCell(1).value) &&
      !row.getCell(2).value &&
      !row.getCell(3).value &&
      !row.getCell(4).value &&
      !row.getCell(5).value

    if (isGroupRow) mergeAcrossSheet(sheet, rowNumber, 'A', 'E')

    row.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: dark }, bold: isGroupRow }
      cell.border = border
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber >= 3 ? 'right' : 'left',
        wrapText: columnNumber === 1,
      }
      if ((columnNumber === 5 || columnNumber === 6) && typeof cell.value === 'number') {
        cell.numFmt = MONEY_FORMAT
      }
      if (isGroupRow) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      }
    })
    if (isGroupRow) {
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    }
  }

  for (let rowNumber = subtotalRowNumber; rowNumber <= grandTotalRowNumber; rowNumber += 1) {
    const labelCell = sheet.getCell(`E${rowNumber}`)
    const valueCell = sheet.getCell(`F${rowNumber}`)
    labelCell.font = { name: 'Arial', bold: true, color: { argb: dark } }
    valueCell.font = { name: 'Arial', bold: true, color: { argb: dark } }
    valueCell.numFmt = MONEY_FORMAT
    labelCell.alignment = { horizontal: 'right' }
    valueCell.alignment = { horizontal: 'right' }
    labelCell.border = border
    valueCell.border = border
  }

  const grandTotalRow = sheet.getRow(grandTotalRowNumber)
  grandTotalRow.height = 26
  ;[grandTotalRow.getCell(5), grandTotalRow.getCell(6)].forEach(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: orange } }
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } }
  })

  for (let rowNumber = grandTotalRowNumber + 2; rowNumber <= rows.length; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const firstCell = row.getCell(1)
    const secondCell = row.getCell(2)
    const isSignatureRow = firstCell.value === 'Người phụ trách' || firstCell.value === 'Chức vụ'
    const isHeading = typeof firstCell.value === 'string' &&
      firstCell.value === firstCell.value.toUpperCase() &&
      !secondCell.value

    if (!isSignatureRow && firstCell.value) mergeAcrossSheet(sheet, rowNumber)
    if (isHeading) {
      firstCell.font = { name: 'Arial', bold: true, color: { argb: orange } }
      firstCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } }
      row.height = 24
    } else if (firstCell.value) {
      firstCell.font = { name: 'Arial', size: 10, bold: isSignatureRow, color: { argb: dark } }
      firstCell.alignment = { wrapText: true, vertical: 'top' }
      row.height = isSignatureRow ? 20 : 36
    }
  }

  sheet.eachRow(row => {
    row.eachCell(cell => {
      cell.font = { name: 'Arial', ...cell.font }
    })
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
  return workbook
}
