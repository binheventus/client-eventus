import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { getMatchedEquipmentRules } from '../lib/equipmentRules'

const BRAND_COLOR = '#f8981d'
const SIGNATURE_IMAGE_SRC = '/signatures/nguyen-thu-huyen.png'

const ENTITY_META = {
  EVENTUS: {
    name: 'EVENTUS',
    company: 'Cong ty Eventus',
    taxCode: 'MST: [cap nhat]',
    address: 'Dia chi: [cap nhat]',
    email: 'Email: [cap nhat]',
    hotline: 'Hotline: [cap nhat]',
  },
  MEDIAMONSTER: {
    name: 'MEDIAMONSTER',
    company: 'Cong ty Mediamonster',
    taxCode: 'MST: [cap nhat]',
    address: 'Dia chi: [cap nhat]',
    email: 'Email: [cap nhat]',
    hotline: 'Hotline: [cap nhat]',
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
      address: entity.address ? `Dia chi: ${entity.address}` : ENTITY_META[code]?.address,
      email: entity.email ? `Email: ${entity.email}` : ENTITY_META[code]?.email,
      hotline: entity.hotline ? `Hotline: ${entity.hotline}` : ENTITY_META[code]?.hotline,
    }
  }
  return ENTITY_META[code] || ENTITY_META.EVENTUS
}

function getClientName(quote) {
  return quote?.client_name || quote?.customer_name || quote?.client?.name || '-'
}

function getItemName(item) {
  return item?.service_name || item?.service?.quote_display_name || item?.service?.service_name || item?.service_name_raw || item?.service_code || 'Hang muc'
}

function groupItemsByDay(items = []) {
  const groups = new Map()
  items.forEach(item => {
    const day = item.event_day || item.day_index || item.day || null
    const key = day ? `Ngay ${day}` : 'Hang muc'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  })
  return Array.from(groups.entries())
}

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    lineHeight: 1.4,
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: BRAND_COLOR,
    paddingBottom: 14,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: BRAND_COLOR,
    letterSpacing: 1.4,
  },
  company: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: 700,
  },
  muted: {
    color: '#64748b',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'right',
    color: '#111827',
  },
  quoteNo: {
    marginTop: 5,
    textAlign: 'right',
    color: BRAND_COLOR,
    fontWeight: 700,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  infoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
  },
  label: {
    fontSize: 8,
    textTransform: 'uppercase',
    color: '#64748b',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  value: {
    fontWeight: 700,
  },
  sectionTitle: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 700,
    color: '#111827',
  },
  table: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND_COLOR,
    color: '#ffffff',
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    minHeight: 28,
  },
  cell: {
    padding: 6,
  },
  itemName: {
    width: '42%',
  },
  qty: {
    width: '10%',
    textAlign: 'right',
  },
  sessions: {
    width: '12%',
    textAlign: 'right',
  },
  price: {
    width: '18%',
    textAlign: 'right',
  },
  amount: {
    width: '18%',
    textAlign: 'right',
  },
  groupRow: {
    padding: 6,
    backgroundColor: '#f8fafc',
    color: '#334155',
    fontWeight: 700,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  totals: {
    marginLeft: 'auto',
    width: 220,
    marginTop: 4,
    marginBottom: 18,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 7,
    fontSize: 13,
    fontWeight: 700,
    color: BRAND_COLOR,
  },
  notes: {
    borderWidth: 1,
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
    borderRadius: 6,
    padding: 10,
    marginTop: 6,
  },
  noteLine: {
    marginBottom: 5,
  },
  noteSection: {
    marginBottom: 9,
  },
  noteHeading: {
    fontSize: 10,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 5,
  },
  notePlaceholder: {
    color: '#64748b',
    marginBottom: 2,
  },
  signature: {
    marginTop: 16,
    marginLeft: 'auto',
    width: 150,
    textAlign: 'center',
  },
  signatureDate: {
    marginBottom: 8,
    fontWeight: 700,
    color: '#111827',
  },
  signatureImage: {
    width: 75,
    height: 45,
    objectFit: 'contain',
    marginHorizontal: 'auto',
  },
  signatureName: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: 700,
    color: '#111827',
  },
  signatureRole: {
    color: '#64748b',
  },
  intro: {
    marginBottom: 14,
  },
  introLine: {
    marginBottom: 5,
  },
  introClient: {
    fontWeight: 700,
  },
  footer: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  stampBox: {
    width: 180,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 6,
    padding: 10,
    textAlign: 'center',
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

function Header({ quote }) {
  const entity = getEntityMeta(quote)
  const logoUrl = logoUrlByEntity[quote?.entity_code]

  return (
    <View style={styles.header} fixed>
      <View>
        {logoUrl ? (
          <Text style={styles.logoText}>{entity.name}</Text>
        ) : (
          <Text style={styles.logoText}>{entity.name}</Text>
        )}
        <Text style={styles.company}>{entity.company}</Text>
        <Text style={styles.muted}>{entity.taxCode}</Text>
        <Text style={styles.muted}>{entity.address}</Text>
        <Text style={styles.muted}>{entity.email} | {entity.hotline}</Text>
      </View>
      <View>
        <Text style={styles.title}>BAO GIA DICH VU</Text>
        <Text style={styles.quoteNo}>{quote?.quote_number || 'DRAFT'}</Text>
      </View>
    </View>
  )
}

function InfoSection({ quote }) {
  return (
    <View style={styles.intro}>
      <Text style={[styles.introLine, styles.introClient]}>Kinh gui: {getClientName(quote)}</Text>
      <Text style={styles.introLine}>Dua tren thong tin trao doi, chung toi xin gui bao gia chi tiet dich vu nhu sau:</Text>
    </View>
  )
}

function ItemsTable({ items = [] }) {
  const groups = groupItemsByDay(items)

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader} fixed>
        <Text style={[styles.cell, styles.itemName]}>Hang muc</Text>
        <Text style={[styles.cell, styles.qty]}>SL</Text>
        <Text style={[styles.cell, styles.sessions]}>Buoi</Text>
        <Text style={[styles.cell, styles.price]}>Don gia</Text>
        <Text style={[styles.cell, styles.amount]}>Thanh tien</Text>
      </View>
      {groups.map(([groupName, groupItems]) => (
        <View key={groupName} wrap={false}>
          {groups.length > 1 ? <Text style={styles.groupRow}>{groupName}</Text> : null}
          {groupItems.map((item, index) => (
            <View key={`${groupName}-${index}`} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.itemName]}>{getItemName(item)}</Text>
              <Text style={[styles.cell, styles.qty]}>{item.quantity || 1}</Text>
              <Text style={[styles.cell, styles.sessions]}>{item.num_sessions || 1}</Text>
              <Text style={[styles.cell, styles.price]}>{formatCurrency(item.unit_price)}</Text>
              <Text style={[styles.cell, styles.amount]}>{formatCurrency(item.total_price)}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function Totals({ quote }) {
  const showTravelFee = Number(quote?.travel_fee_total || 0) > 0
  const showOvertimeFee = Number(quote?.overtime_fee_total || 0) > 0
  const showVat = Boolean(quote?.has_vat)

  return (
    <View style={styles.totals}>
      <View style={styles.totalLine}>
        <Text>Subtotal</Text>
        <Text>{formatCurrency(quote?.subtotal)}</Text>
      </View>
      {showTravelFee ? (
        <View style={styles.totalLine}>
          <Text>Phu phi di chuyen</Text>
          <Text>{formatCurrency(quote?.travel_fee_total)}</Text>
        </View>
      ) : null}
      {showOvertimeFee ? (
        <View style={styles.totalLine}>
          <Text>Phu phi gio vuot</Text>
          <Text>{formatCurrency(quote?.overtime_fee_total)}</Text>
        </View>
      ) : null}
      {showVat ? (
        <View style={styles.totalLine}>
          <Text>VAT</Text>
          <Text>{formatCurrency(quote?.vat_amount)}</Text>
        </View>
      ) : null}
      <View style={styles.grandTotal}>
        <Text>Tong cong</Text>
        <Text>{formatCurrency(quote?.total_amount)}</Text>
      </View>
    </View>
  )
}

function Notes({ quote, items = [] }) {
  const equipmentRules = getMatchedEquipmentRules(items, equipmentRulesData)
  const validityDays = quote?.validity_days || 15
  const terms = [
    `* Bao gia co hieu luc trong ${validityDays} ngay. Thoi gian lam viec tieu chuan toi da 04 tieng/buoi va 08 tieng/ngay. Thoi gian Overtime se duoc tinh phi theo thoa thuan rieng.`,
    '* Bao gia tren chua bao gom chi phi mua ban quyen am nhac, hinh anh neu co.',
    '* Bao gia da bao gom toi da 03 lan chinh sua san pham hau ky dua tren format da thong nhat.',
    '* Trong vong 05 ngay lam viec ke tu ngay ban giao ban Demo, neu Khach hang khong co phan hoi hoac yeu cau chinh sua bang van ban, san pham duoc coi la da hoan thanh & tu dong duoc nghiem thu.',
  ]
  const paymentTerms = [
    '* Dot 1 (Tam ung): Quy khach vui long thanh toan 50% tong gia tri bao gia ngay sau khi xac nhan hop dong/bao gia de giu lich nhan su va chuan bi thiet bi.',
    '* Dot 2 (Tat toan): Thanh toan 50% gia tri con lai trong vong 03 ngay lam viec sau khi ban giao day du san pham cuoi cung (da nghiem thu) va truoc khi xuat hoa don VAT (neu co).',
  ]

  return (
    <View style={styles.notes}>
      {equipmentRules.length ? (
        <View style={styles.noteSection}>
          <Text style={styles.noteHeading}>THIET BI SU DUNG</Text>
          {equipmentRules.map(rule => (
            <Text key={`${rule.equipment_title}-${rule.sort_order}`} style={styles.noteLine}>
              * {rule.equipment_title}: {rule.equipment_description}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.noteSection}>
        <Text style={styles.noteHeading}>DIEU KHOAN & DIEU KIEN</Text>
        {terms.map(term => <Text key={term} style={styles.noteLine}>{term}</Text>)}
      </View>
      <View>
        <Text style={styles.noteHeading}>DIEU KHOAN THANH TOAN</Text>
        {paymentTerms.map(term => <Text key={term} style={styles.noteLine}>{term}</Text>)}
      </View>
      <View style={styles.signature}>
        <Text style={styles.signatureDate}>Ngay lap: {formatQuoteDate(quote?.created_at)}</Text>
        <Image src={SIGNATURE_IMAGE_SRC} style={styles.signatureImage} />
        <Text style={styles.signatureName}>Nguyen Thu Huyen</Text>
        <Text style={styles.signatureRole}>Account Manager</Text>
      </View>
    </View>
  )
}

function Footer() {
  return (
    <View style={styles.footer}>
      <View>
        <Text>Ngay ...... thang ...... nam ......</Text>
        <Text style={{ marginTop: 6, fontWeight: 700 }}>Dai dien khach hang</Text>
      </View>
      <View style={styles.stampBox}>
        <Text style={{ fontWeight: 700 }}>Dai dien cong ty</Text>
        <Text style={{ marginTop: 10, color: '#94a3b8' }}>Ky ten / Dong dau</Text>
      </View>
    </View>
  )
}

export default function QuotePDFDocument({ quote = {}, items = [] }) {
  const pdfItems = items.length ? items : quote.items || []

  return (
    <Document title={quote.quote_number || 'Bao gia'}>
      <Page size="A4" style={styles.page}>
        <Header quote={quote} />
        <InfoSection quote={quote} />
        <Text style={styles.sectionTitle}>Chi tiet hang muc</Text>
        <ItemsTable items={pdfItems} />
        <Totals quote={quote} />
        <Text style={styles.sectionTitle}>Ghi chu</Text>
        <Notes quote={quote} items={pdfItems} />
        <Footer />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}
