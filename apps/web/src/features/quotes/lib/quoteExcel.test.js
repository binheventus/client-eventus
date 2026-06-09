import assert from 'node:assert/strict'
import test from 'node:test'
import ExcelJS from 'exceljs'
import {
  buildQuoteExcelRows,
  buildQuoteExcelWorkbook,
  getQuoteExcelFilename,
  groupQuoteExcelItems,
} from './quoteExcel.js'

const quote = {
  quote_number: 'BG-0005',
  client_name: 'Mr.A',
  created_at: '2026-05-24T10:00:00.000Z',
  has_vat: true,
  subtotal: 17000000,
  vat_amount: 1360000,
  total_amount: 18360000,
}

const items = [
  {
    group_code: 'PHOTO',
    group_label: 'Hạng mục chụp ảnh',
    group_sort_order: 1,
    service_name: 'Chụp ảnh sự kiện',
    unit: 'Người',
    quantity: 2,
    num_sessions: 1,
    unit_price: 5000000,
    total_price: 10000000,
  },
  {
    group_code: 'PHOTO',
    group_label: 'Hạng mục chụp ảnh',
    group_sort_order: 1,
    service_name: 'Chụp ảnh sự kiện',
    unit: 'Người',
    quantity: 1,
    num_sessions: 1,
    unit_price: 4000000,
    total_price: 4000000,
  },
  {
    group_code: 'POST',
    group_label: 'Hạng mục hậu kỳ',
    group_sort_order: 2,
    service_name: 'Chỉnh ảnh tại chỗ',
    unit: 'Người',
    quantity: 1,
    num_sessions: 1,
    unit_price: 1500000,
    total_price: 1500000,
  },
]

test('getQuoteExcelFilename mirrors quote PDF filename shape with xlsx extension', () => {
  assert.equal(getQuoteExcelFilename(quote), 'Bao gia - Eventus - BG0005.xlsx')
})

test('groupQuoteExcelItems preserves grouped quote order and totals source data', () => {
  const groups = groupQuoteExcelItems(items)
  assert.deepEqual(groups.map(group => group.label), ['Hạng mục chụp ảnh', 'Hạng mục hậu kỳ'])
  assert.equal(groups[0].items.length, 2)
})

test('buildQuoteExcelRows includes line items, VAT and grand total', () => {
  const rows = buildQuoteExcelRows(quote, items)
  assert.ok(rows.some(row => String(row[0] || '').trim() === 'Kính gửi: Mr.A'))
  assert.ok(!rows.some(row => row[0] === 'Ngày lập'))
  assert.ok(!rows.some(row => row[0] === 'Lời mở đầu'))
  assert.ok(rows.some(row => row[0] === 'Chụp ảnh sự kiện' && row[5] === 10000000))
  assert.ok(rows.some(row => row[0] === 'VAT 8%  ' && row[5] === 1360000))
  assert.ok(rows.some(row => row[0] === 'Tổng chi phí (Đã bao gồm VAT)  ' && row[5] === 18360000))
})

test('buildQuoteExcelWorkbook creates a readable workbook with a quote sheet', () => {
  const workbook = buildQuoteExcelWorkbook(quote, items, ExcelJS)
  assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Bao gia'])
  const sheet = workbook.getWorksheet('Bao gia')
  assert.equal(sheet.getCell('C1').value, 'CÔNG TY TNHH EVENTUS VIỆT NAM')
  assert.equal(sheet.getCell('C6').value, '#BG-0005')
  assert.equal(sheet.getCell('A8').value, 'BÁO GIÁ DỊCH VỤ')
  assert.equal(sheet.getCell('A10').value, ' Kính gửi: Mr.A')
  assert.equal(sheet.getCell('A13').fill.fgColor.argb, 'FF757070')
  assert.equal(sheet.getCell('F15').value, 14000000)
  assert.equal(sheet.getCell('F15').numFmt, '#,##0')
  assert.equal(sheet.getCell('A20').value, 'Cộng  ')
  assert.equal(sheet.pageSetup.orientation, 'portrait')
})
