import { Document, Font, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { getMatchedEquipmentRules } from '../lib/equipmentRules'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'

const SIGNATURE_IMAGE_SRC = '/signatures/nguyen-thu-huyen.png'
const PDF_FONT_FAMILY = 'BeVietnamProQuote'
const FONT_PATH = '/fonts/be-vietnam-pro'

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: `${FONT_PATH}/BeVietnamPro-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_PATH}/BeVietnamPro-Medium.ttf`, fontWeight: 500 },
    { src: `${FONT_PATH}/BeVietnamPro-SemiBold.ttf`, fontWeight: 600 },
    { src: `${FONT_PATH}/BeVietnamPro-Bold.ttf`, fontWeight: 700 },
  ],
})

Font.registerHyphenationCallback(word => [word])

const ENTITY_META = {
  EVENTUS: {
    name: 'EVENTUS',
    company: 'CÔNG TY TNHH EVENTUS VIỆT NAM',
    taxCode: 'MST: [cập nhật]',
    address: 'Địa chỉ: [cập nhật]',
    email: 'Email: [cập nhật]',
    hotline: 'Hotline: [cập nhật]',
    logoFile: 'logo_eventus.png',
  },
  MEDIAMONSTER: {
    name: 'MEDIAMONSTER',
    company: 'CÔNG TY TNHH MEDIAMONSTER',
    taxCode: 'MST: [cập nhật]',
    address: 'Địa chỉ: [cập nhật]',
    email: 'Email: [cập nhật]',
    hotline: 'Hotline: [cập nhật]',
    logoFile: 'logo_mediamonster.png',
  },
}

let logoUrlByEntity = {}

export function setLogo(entityCode, url) {
  logoUrlByEntity = {
    ...logoUrlByEntity,
    [entityCode]: url,
  }
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} đ`
}

function formatQuoteDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'Khach'
}

export function getQuotePdfFilename(quote = {}) {
  const quoteNumber = quote.quote_number || 'Bao-gia'
  const clientName = quote.client_name || quote.customer_name || quote.client?.name || 'Khach'
  const created = quote.created_at ? new Date(quote.created_at) : new Date()
  const date = `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}`
  return `${sanitizeFilenamePart(quoteNumber)}_${sanitizeFilenamePart(clientName)}_${date}.pdf`
}

function getEntityMeta(quote) {
  const code = quote?.entity_code || 'EVENTUS'
  const entity = legalEntitiesData.find(row => (row.entity_code || row.code) === code)
  if (entity) {
    return {
      name: entity.display_name || entity.entity_code || code,
      company: entity.legal_name || entity.entity_name_full || entity.name || ENTITY_META[code]?.company,
      taxCode: entity.tax_code ? `MST: ${entity.tax_code}` : ENTITY_META[code]?.taxCode,
      address: entity.address ? `Địa chỉ: ${entity.address}` : ENTITY_META[code]?.address,
      email: entity.email ? `Email: ${entity.email}` : ENTITY_META[code]?.email,
      hotline: entity.hotline ? `Hotline: ${entity.hotline}` : ENTITY_META[code]?.hotline,
      logoFile: entity.logo_file || ENTITY_META[code]?.logoFile,
    }
  }
  return ENTITY_META[code] || ENTITY_META.EVENTUS
}

function getQuoteCode(quote) {
  const code = quote?.quote_number || quote?.id || quote?.share_token || 'DRAFT'
  return String(code).replace(/^#/, '')
}

function getClientName(quote) {
  return quote?.client_name || quote?.customer_name || quote?.client?.name || '-'
}

function getItemName(item) {
  return item?.service_name || item?.service?.quote_display_name || item?.service?.service_name || item?.service?.name || item?.service_name_raw || item?.service_code || 'Hạng mục'
}

function getItemUnit(item) {
  return item?.unit || item?.service?.unit || item?.pricing_unit || 'Người'
}

function groupItemsByDay(items = []) {
  const groups = new Map()
  items.forEach(item => {
    const day = item.event_day || item.day_index || item.day || null
    const key = day ? `Ngày ${day}` : 'Hạng mục'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  return Array.from(groups.entries())
}

function isDensePdf(items = []) {
  return items.length >= 12 && items.length <= 15
}

function isSpaciousPdf(items = []) {
  return items.length < 6
}

const styles = StyleSheet.create({
  page: {
    paddingVertical: 24,
    paddingHorizontal: 32,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9,
    color: '#0f172a',
    lineHeight: 1.35,
  },
  pageDense: {
    paddingVertical: 23,
    lineHeight: 1.32,
  },
  pageSpacious: {
    paddingVertical: 30,
    lineHeight: 1.42,
  },
  header: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
  },
  headerDense: {
    borderRadius: 8,
    padding: 11.5,
    marginBottom: 11,
    gap: 16,
  },
  headerSpacious: {
    padding: 15,
    marginBottom: 17,
    gap: 20,
  },
  brandBlock: {
    width: '34%',
    minHeight: 60,
  },
  brandBlockDense: {
    width: '35%',
    minHeight: 56,
  },
  brandBlockSpacious: {
    minHeight: 68,
  },
  logoImage: {
    width: 96,
    height: 32,
    objectFit: 'contain',
  },
  logoImageDense: {
    width: 92,
    height: 30,
  },
  logoImageSpacious: {
    width: 104,
    height: 35,
  },
  logoFallback: {
    fontSize: 9,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  documentTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 700,
    color: '#020617',
    lineHeight: 1.25,
  },
  documentTitleDense: {
    marginTop: 5,
    fontSize: 15.2,
    lineHeight: 1.2,
  },
  documentTitleSpacious: {
    marginTop: 8,
    fontSize: 17,
  },
  quoteNo: {
    marginTop: 3,
    color: '#94a3b8',
    fontSize: 8.5,
    fontWeight: 500,
    lineHeight: 1.2,
    textAlign: 'right',
  },
  quoteNoDense: {
    marginTop: 2.5,
    fontSize: 8.2,
  },
  quoteNoSpacious: {
    marginTop: 5,
  },
  companyInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  company: {
    fontSize: 8.2,
    fontWeight: 700,
    color: '#475569',
    textAlign: 'right',
    textTransform: 'uppercase',
  },
  companyDense: {
    fontSize: 8,
  },
  muted: {
    color: '#64748b',
    textAlign: 'right',
    marginTop: 1,
    fontSize: 8,
  },
  mutedDense: {
    fontSize: 7.8,
    marginTop: 0.8,
  },
  mutedSpacious: {
    marginTop: 1.4,
  },
  addressLine: {
    fontSize: 8,
    maxLines: 1,
  },
  addressLineDense: {
    fontSize: 7.8,
  },
  sectionTitle: {
    marginTop: 2,
    marginBottom: 5,
    fontSize: 10,
    fontWeight: 700,
    color: '#111827',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 7,
    marginBottom: 4,
    overflow: 'hidden',
  },
  tableDense: {
    borderRadius: 7,
    marginBottom: 3,
  },
  tableSpacious: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    minHeight: 24,
  },
  rowDense: {
    minHeight: 21.8,
  },
  rowSpacious: {
    minHeight: 30,
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  cellDense: {
    paddingHorizontal: 4.2,
    paddingVertical: 3.2,
    fontSize: 8.5,
    lineHeight: 1.18,
    maxLines: 1,
  },
  cellSpacious: {
    paddingVertical: 6,
  },
  headerCell: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  headerCellDense: {
    fontSize: 7.1,
    paddingVertical: 3.2,
    lineHeight: 1.12,
  },
  headerCellSpacious: {
    paddingVertical: 4.5,
  },
  itemName: {
    width: '37%',
  },
  itemNameDense: {
    width: '38%',
  },
  unit: {
    width: '12%',
    textAlign: 'center',
  },
  qty: {
    width: '10%',
    textAlign: 'center',
  },
  sessions: {
    width: '8%',
    textAlign: 'center',
  },
  price: {
    width: '15%',
    textAlign: 'right',
  },
  amount: {
    width: '18%',
    textAlign: 'right',
    fontWeight: 600,
    color: '#020617',
  },
  amountDense: {
    width: '17%',
  },
  groupRow: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontWeight: 700,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  groupRowDense: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    fontSize: 8,
  },
  groupRowSpacious: {
    paddingVertical: 5,
  },
  totals: {
    marginLeft: 'auto',
    width: 240,
    marginTop: 0,
    marginBottom: 8,
  },
  totalsDense: {
    width: 232,
    marginBottom: 6,
  },
  totalsSpacious: {
    marginBottom: 14,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  totalLineDense: {
    paddingVertical: 2.6,
    fontSize: 8.4,
    lineHeight: 1.2,
  },
  totalLineSpacious: {
    paddingVertical: 4.5,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
    fontSize: 10.5,
    fontWeight: 700,
    color: '#020617',
  },
  grandTotalDense: {
    paddingTop: 4,
    fontSize: 10,
  },
  grandTotalSpacious: {
    paddingTop: 7,
    fontSize: 11.2,
  },
  notes: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 7,
    padding: 4,
    marginTop: 1,
  },
  notesDense: {
    borderRadius: 7,
    padding: 3.6,
    marginTop: 1,
  },
  notesSpacious: {
    padding: 7,
    marginTop: 2,
  },
  notesTitle: {
    marginTop: 18,
    marginBottom: 7,
  },
  notesTitleDense: {
    marginTop: 14,
    marginBottom: 5.5,
    fontSize: 9.4,
  },
  notesTitleSpacious: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 10.5,
  },
  noteLine: {
    marginBottom: 1.4,
    color: '#475569',
    fontSize: 7,
    lineHeight: 1.16,
  },
  noteLineDense: {
    marginBottom: 1.2,
    fontSize: 6.8,
    lineHeight: 1.14,
  },
  noteLineSpacious: {
    marginBottom: 2.2,
    fontSize: 7.3,
    lineHeight: 1.24,
  },
  noteSection: {
    marginBottom: 2.8,
  },
  noteSectionDense: {
    marginBottom: 2.2,
  },
  noteSectionSpacious: {
    marginBottom: 4,
  },
  noteHeading: {
    fontSize: 7.4,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  noteHeadingDense: {
    fontSize: 7.1,
    marginBottom: 0.8,
  },
  noteHeadingSpacious: {
    fontSize: 7.8,
    marginBottom: 1.5,
  },
  signature: {
    marginTop: 16,
    marginLeft: 'auto',
    width: 90,
    textAlign: 'center',
  },
  signatureDense: {
    marginTop: 13,
    width: 88,
  },
  signatureSpacious: {
    marginTop: 22,
    width: 96,
  },
  signatureDate: {
    marginBottom: 1,
    fontSize: 7,
    fontWeight: 700,
    color: '#111827',
  },
  signatureDateDense: {
    fontSize: 6.8,
    marginBottom: 0.8,
  },
  signatureDateSpacious: {
    fontSize: 7.3,
    marginBottom: 1.3,
  },
  signatureImage: {
    width: 34,
    height: 20,
    objectFit: 'contain',
    marginHorizontal: 'auto',
  },
  signatureImageDense: {
    width: 32,
    height: 18,
  },
  signatureImageSpacious: {
    width: 38,
    height: 22,
  },
  signatureName: {
    marginTop: 1,
    fontSize: 7.8,
    fontWeight: 700,
    color: '#111827',
  },
  signatureNameDense: {
    marginTop: 0.8,
    fontSize: 7.5,
  },
  signatureNameSpacious: {
    marginTop: 1.4,
    fontSize: 8.2,
  },
  signatureRole: {
    color: '#64748b',
    fontSize: 7,
  },
  signatureRoleDense: {
    fontSize: 6.8,
  },
  signatureRoleSpacious: {
    fontSize: 7.2,
  },
  intro: {
    marginTop: 12,
    marginBottom: 8,
  },
  introDense: {
    marginTop: 10,
    marginBottom: 7,
  },
  introSpacious: {
    marginTop: 16,
    marginBottom: 14,
  },
  introLine: {
    marginBottom: 3,
    color: '#334155',
  },
  introLineDense: {
    marginBottom: 2.4,
    fontSize: 8.5,
    lineHeight: 1.22,
  },
  introLineSpacious: {
    marginBottom: 4,
  },
  introClient: {
    fontWeight: 600,
    color: '#0f172a',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 18,
    left: 32,
    right: 32,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
})

function Header({ quote, dense = false, spacious = false }) {
  const entity = getEntityMeta(quote)
  const logoUrl = logoUrlByEntity[quote?.entity_code] || (entity.logoFile ? `/logos/${entity.logoFile}` : null)
  const quoteCode = getQuoteCode(quote)

  return (
    <View style={[styles.header, dense ? styles.headerDense : null, spacious ? styles.headerSpacious : null]}>
      <View style={[styles.brandBlock, dense ? styles.brandBlockDense : null, spacious ? styles.brandBlockSpacious : null]}>
        {logoUrl ? (
          <Image src={logoUrl} style={[styles.logoImage, dense ? styles.logoImageDense : null, spacious ? styles.logoImageSpacious : null]} />
        ) : (
          <Text style={styles.logoFallback}>{entity.name}</Text>
        )}
        <Text style={[styles.documentTitle, dense ? styles.documentTitleDense : null, spacious ? styles.documentTitleSpacious : null]}>Báo giá dịch vụ</Text>
      </View>
      <View style={styles.companyInfo}>
        <Text style={[styles.company, dense ? styles.companyDense : null]}>{entity.company}</Text>
        <Text style={[styles.muted, dense ? styles.mutedDense : null, spacious ? styles.mutedSpacious : null]}>{entity.taxCode}</Text>
        <Text style={[styles.muted, styles.addressLine, dense ? styles.mutedDense : null, dense ? styles.addressLineDense : null, spacious ? styles.mutedSpacious : null]}>{entity.address}</Text>
        <Text style={[styles.muted, dense ? styles.mutedDense : null, spacious ? styles.mutedSpacious : null]}>{entity.email} | {entity.hotline}</Text>
        <Text style={[styles.quoteNo, dense ? styles.quoteNoDense : null, spacious ? styles.quoteNoSpacious : null]}>#{quoteCode}</Text>
      </View>
    </View>
  )
}

function InfoSection({ quote, dense = false, spacious = false }) {
  return (
    <View style={[styles.intro, dense ? styles.introDense : null, spacious ? styles.introSpacious : null]}>
      <Text style={[styles.introLine, styles.introClient, dense ? styles.introLineDense : null, spacious ? styles.introLineSpacious : null]}>Kính gửi: {getClientName(quote)}</Text>
      <Text style={[styles.introLine, dense ? styles.introLineDense : null, spacious ? styles.introLineSpacious : null]}>Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:</Text>
    </View>
  )
}

function ItemsTable({ items = [], dense = false, spacious = false }) {
  const groups = groupItemsByDay(items)

  return (
    <View style={[styles.table, dense ? styles.tableDense : null, spacious ? styles.tableSpacious : null]}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.cell, styles.itemName, dense ? styles.itemNameDense : null, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Hạng mục</Text>
        <Text style={[styles.cell, styles.unit, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Đơn vị tính</Text>
        <Text style={[styles.cell, styles.qty, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Số lượng</Text>
        <Text style={[styles.cell, styles.sessions, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Số buổi</Text>
        <Text style={[styles.cell, styles.price, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Đơn giá</Text>
        <Text style={[styles.cell, styles.amount, dense ? styles.amountDense : null, styles.headerCell, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null, dense ? styles.headerCellDense : null, spacious ? styles.headerCellSpacious : null]}>Thành tiền</Text>
      </View>
      {groups.map(([groupName, groupItems]) => (
        <View key={groupName} wrap={false}>
          {groups.length > 1 ? <Text style={[styles.groupRow, dense ? styles.groupRowDense : null, spacious ? styles.groupRowSpacious : null]}>{groupName}</Text> : null}
          {groupItems.map((item, index) => (
            <View key={`${groupName}-${index}`} style={[styles.row, dense ? styles.rowDense : null, spacious ? styles.rowSpacious : null]} wrap={false}>
              <Text style={[styles.cell, styles.itemName, dense ? styles.itemNameDense : null, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{getItemName(item)}</Text>
              <Text style={[styles.cell, styles.unit, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{getItemUnit(item)}</Text>
              <Text style={[styles.cell, styles.qty, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{item.quantity || 1}</Text>
              <Text style={[styles.cell, styles.sessions, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{item.num_sessions || 1}</Text>
              <Text style={[styles.cell, styles.price, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{formatCurrency(item.unit_price)}</Text>
              <Text style={[styles.cell, styles.amount, dense ? styles.amountDense : null, dense ? styles.cellDense : null, spacious ? styles.cellSpacious : null]}>{formatCurrency(item.total_price)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function Totals({ quote, dense = false, spacious = false }) {
  const showTravelFee = Number(quote?.travel_fee_total || 0) > 0
  const showOvertimeFee = Number(quote?.overtime_fee_total || 0) > 0
  const showVat = Boolean(quote?.has_vat)

  return (
    <View style={[styles.totals, dense ? styles.totalsDense : null, spacious ? styles.totalsSpacious : null]}>
      <View style={[styles.totalLine, dense ? styles.totalLineDense : null, spacious ? styles.totalLineSpacious : null]}>
        <Text>Subtotal</Text>
        <Text>{formatCurrency(quote?.subtotal)}</Text>
      </View>
      {showTravelFee ? (
        <View style={[styles.totalLine, dense ? styles.totalLineDense : null, spacious ? styles.totalLineSpacious : null]}>
          <Text>Phụ phí di chuyển</Text>
          <Text>{formatCurrency(quote?.travel_fee_total)}</Text>
        </View>
      ) : null}
      {showOvertimeFee ? (
        <View style={[styles.totalLine, dense ? styles.totalLineDense : null, spacious ? styles.totalLineSpacious : null]}>
          <Text>Phụ phí Over-time</Text>
          <Text>{formatCurrency(quote?.overtime_fee_total)}</Text>
        </View>
      ) : null}
      {showVat ? (
        <View style={[styles.totalLine, dense ? styles.totalLineDense : null, spacious ? styles.totalLineSpacious : null]}>
          <Text>Thuế GTGT 8%</Text>
          <Text>{formatCurrency(quote?.vat_amount)}</Text>
        </View>
      ) : null}
      <View style={[styles.grandTotal, dense ? styles.grandTotalDense : null, spacious ? styles.grandTotalSpacious : null]}>
        <Text>Tổng cộng</Text>
        <Text>{formatCurrency(quote?.total_amount)}</Text>
      </View>
    </View>
  )
}

function Notes({ quote, items = [], dense = false, spacious = false }) {
  const equipmentRules = getMatchedEquipmentRules(items, equipmentRulesData)
  const validityDays = normalizeQuoteValidityDays(quote?.validity_days)
  const terms = [
    `• Báo giá có hiệu lực trong ${validityDays} ngày. Thời gian làm việc tiêu chuẩn tối đa 04 tiếng/buổi và 08 tiếng/ngày. Thời gian Overtime sẽ được tính phí theo thỏa thuận riêng.`,
    ...(!quote?.has_vat ? ['• Báo giá trên chưa bao gồm Thuế GTGT 8%.'] : []),
    '• Báo giá trên chưa bao gồm chi phí mua bản quyền âm nhạc, hình ảnh nếu có.',
    '• Báo giá đã bao gồm tối đa 03 lần chỉnh sửa sản phẩm hậu kỳ dựa trên format đã thống nhất.',
    '• Trong vòng 05 ngày làm việc kể từ ngày bàn giao bản Demo, nếu Khách hàng không có phản hồi hoặc yêu cầu chỉnh sửa bằng văn bản, sản phẩm được coi là đã hoàn thành & tự động được nghiệm thu.',
  ]
  const paymentTerms = [
    '• Đợt 1 (Tạm ứng): Quý khách vui lòng thanh toán 50% tổng giá trị báo giá sau khi xác nhận báo giá để giữ lịch nhân sự và chuẩn bị thiết bị.',
    '• Đợt 2 (Tất toán): Thanh toán 50% giá trị còn lại trong vòng 03 ngày làm việc sau khi bàn giao đầy đủ sản phẩm cuối cùng.',
  ]

  return (
    <View style={[styles.notes, dense ? styles.notesDense : null, spacious ? styles.notesSpacious : null]}>
      {equipmentRules.length ? (
        <View style={[styles.noteSection, dense ? styles.noteSectionDense : null, spacious ? styles.noteSectionSpacious : null]}>
          <Text style={[styles.noteHeading, dense ? styles.noteHeadingDense : null, spacious ? styles.noteHeadingSpacious : null]}>THIẾT BỊ SỬ DỤNG</Text>
          {equipmentRules.map(rule => (
            <Text key={`${rule.equipment_title}-${rule.sort_order}`} style={[styles.noteLine, dense ? styles.noteLineDense : null, spacious ? styles.noteLineSpacious : null]}>
              • {rule.equipment_title}: {rule.equipment_description}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={[styles.noteSection, dense ? styles.noteSectionDense : null, spacious ? styles.noteSectionSpacious : null]}>
        <Text style={[styles.noteHeading, dense ? styles.noteHeadingDense : null, spacious ? styles.noteHeadingSpacious : null]}>ĐIỀU KHOẢN & ĐIỀU KIỆN</Text>
        {terms.map(term => <Text key={term} style={[styles.noteLine, dense ? styles.noteLineDense : null, spacious ? styles.noteLineSpacious : null]}>{term}</Text>)}
      </View>
      <View>
        <Text style={[styles.noteHeading, dense ? styles.noteHeadingDense : null, spacious ? styles.noteHeadingSpacious : null]}>ĐIỀU KHOẢN THANH TOÁN</Text>
        {paymentTerms.map(term => <Text key={term} style={[styles.noteLine, dense ? styles.noteLineDense : null, spacious ? styles.noteLineSpacious : null]}>{term}</Text>)}
      </View>
      <View style={[styles.signature, dense ? styles.signatureDense : null, spacious ? styles.signatureSpacious : null]}>
        <Text style={[styles.signatureDate, dense ? styles.signatureDateDense : null, spacious ? styles.signatureDateSpacious : null]}>Ngày lập: {formatQuoteDate(quote?.created_at)}</Text>
        <Image src={SIGNATURE_IMAGE_SRC} style={[styles.signatureImage, dense ? styles.signatureImageDense : null, spacious ? styles.signatureImageSpacious : null]} />
        <Text style={[styles.signatureName, dense ? styles.signatureNameDense : null, spacious ? styles.signatureNameSpacious : null]}>Nguyễn Thu Huyền</Text>
        <Text style={[styles.signatureRole, dense ? styles.signatureRoleDense : null, spacious ? styles.signatureRoleSpacious : null]}>Account Manager</Text>
      </View>
    </View>
  )
}

export function QuotePDFPage({ quote = {}, items = [] }) {
  const pdfItems = items.length ? items : quote.items || []
  const dense = isDensePdf(pdfItems)
  const spacious = isSpaciousPdf(pdfItems)

  return (
    <Page size="A4" style={[styles.page, dense ? styles.pageDense : null, spacious ? styles.pageSpacious : null]}>
      <Header quote={quote} dense={dense} spacious={spacious} />
      <InfoSection quote={quote} dense={dense} spacious={spacious} />
      <ItemsTable items={pdfItems} dense={dense} spacious={spacious} />
      <Totals quote={quote} dense={dense} spacious={spacious} />
      <Text style={[styles.sectionTitle, styles.notesTitle, dense ? styles.notesTitleDense : null, spacious ? styles.notesTitleSpacious : null]}>Ghi chú</Text>
      <Notes quote={quote} items={pdfItems} dense={dense} spacious={spacious} />
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`}
        fixed
      />
    </Page>
  )
}

export default function QuotePDFDocument({ quote = {}, items = [] }) {
  return (
    <Document title={quote.quote_number || 'Báo giá'}>
      <QuotePDFPage quote={quote} items={items} />
    </Document>
  )
}
