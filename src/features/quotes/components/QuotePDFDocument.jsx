import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'

const BRAND_COLOR = '#f8981d'

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

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
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

function getValidUntil(quote) {
  if (quote?.valid_until) return quote.valid_until
  if (!quote?.created_at) return null
  const date = new Date(quote.created_at)
  date.setDate(date.getDate() + (Number(quote.validity_days) || 15))
  return date
}

function getClientName(quote) {
  return quote?.client_name || quote?.customer_name || quote?.client?.name || '-'
}

function getItemName(item) {
  return item?.service_name || item?.service?.service_name || item?.service_name_raw || item?.service_code || 'Hang muc'
}

function hasFlycam(items = []) {
  return items.some(item => /flycam/i.test(`${item.service_code || ''} ${item.service_name || ''} ${item.service_name_raw || ''}`))
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
    marginBottom: 4,
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
    <View style={styles.infoGrid}>
      <View style={styles.infoBox}>
        <Text style={styles.label}>Khach hang</Text>
        <Text style={styles.value}>{getClientName(quote)}</Text>
        <Text style={[styles.label, { marginTop: 8 }]}>Du an / Su kien</Text>
        <Text style={styles.value}>{quote?.event_name || '-'}</Text>
        <Text style={[styles.label, { marginTop: 8 }]}>Dia diem</Text>
        <Text style={styles.value}>{quote?.location || '-'}</Text>
      </View>
      <View style={styles.infoBox}>
        <Text style={styles.label}>Ngay bao gia</Text>
        <Text style={styles.value}>{formatDate(quote?.created_at || new Date())}</Text>
        <Text style={[styles.label, { marginTop: 8 }]}>Ngay su kien</Text>
        <Text style={styles.value}>{formatDate(quote?.event_date)}</Text>
        <Text style={[styles.label, { marginTop: 8 }]}>Hieu luc den</Text>
        <Text style={styles.value}>{formatDate(getValidUntil(quote))}</Text>
      </View>
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
  const showVat = Number(quote?.vat_amount || 0) > 0 || quote?.has_vat

  return (
    <View style={styles.totals}>
      <View style={styles.totalLine}>
        <Text>Subtotal</Text>
        <Text>{formatCurrency(quote?.subtotal)}</Text>
      </View>
      <View style={styles.totalLine}>
        <Text>Phu phi di chuyen</Text>
        <Text>{formatCurrency(quote?.travel_fee_total)}</Text>
      </View>
      <View style={styles.totalLine}>
        <Text>Phu phi gio vuot</Text>
        <Text>{formatCurrency(quote?.overtime_fee_total)}</Text>
      </View>
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

function Notes({ quote, items }) {
  return (
    <View style={styles.notes}>
      <Text style={styles.noteLine}>- Bao gia co hieu luc den {formatDate(getValidUntil(quote))}.</Text>
      <Text style={styles.noteLine}>- Thanh toan theo thoa thuan trong hop dong hoac xac nhan dich vu.</Text>
      <Text style={styles.noteLine}>- Chi phi phat sinh ngoai pham vi bao gia se duoc xac nhan truoc khi thuc hien.</Text>
      {hasFlycam(items) ? (
        <Text style={styles.noteLine}>- Dich vu flycam phu thuoc dieu kien thoi tiet, dia hinh va quy dinh bay tai dia phuong.</Text>
      ) : null}
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
