import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  CONTRACT_SUBTOTAL_LABEL,
  getContractDepositPercent,
  getContractPreamble,
  getContractPaymentDueDays,
  getContractPaymentNotes,
  getContractWorkProgressNotes,
  hasContractAdvance,
  numberToVietnameseWords,
  sanitizeFilenamePart,
} from '../lib/contractDefaults'

const PDF_FONT_FAMILY = 'BeVietnamProContract'
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

function formatCurrency(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value) || 0)} VNĐ`
}

function formatDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function hasText(value) {
  return String(value ?? '').trim().length > 0
}

function getSeller(contract = {}) {
  return contract.seller_snapshot || {}
}

function getCustomer(contract = {}) {
  return contract.customer_snapshot || {}
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
  if (item.group_label) return label
  return /^ngày\b/i.test(label) ? label : `Ngày ${label}`
}

function getItemGroupSortOrder(item = {}) {
  const sortOrder = Number(item.group_sort_order)
  return Number.isFinite(sortOrder) ? sortOrder : 99
}

function groupItemsByDay(items = []) {
  const groups = new Map()
  items.forEach((item, index) => {
    const key = getItemGroupLabel(item)
    if (!groups.has(key)) {
      groups.set(key, {
        label: key,
        sortOrder: getItemGroupSortOrder(item),
        firstIndex: index,
        items: [],
      })
    }
    groups.get(key).items.push(item)
  })
  return Array.from(groups.values()).sort((a, b) => (a.sortOrder - b.sortOrder) || (a.firstIndex - b.firstIndex))
}

function getPartyRole(contract = {}, partyKey = 'party_a') {
  return contract.party_role_config?.[partyKey] || (partyKey === 'party_a' ? 'customer' : 'seller')
}

function getPartyProfile(contract = {}, partyKey = 'party_a') {
  return getPartyRole(contract, partyKey) === 'seller' ? getSeller(contract) : getCustomer(contract)
}

function getProfileName(profile = {}) {
  return profile.company_name || '-'
}

export function getContractPdfFilename(contract = {}) {
  return `${sanitizeFilenamePart(contract.contract_number || 'Hop-dong')}.pdf`
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    paddingVertical: 34,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    lineHeight: 1.45,
    color: '#0f172a',
  },
  national: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 400,
    marginBottom: 2,
  },
  nationalMotto: {
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 400,
    marginBottom: 2,
  },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: 700,
    marginTop: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 10,
    color: '#475569',
    marginBottom: 7,
  },
  sectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    color: '#111827',
    textTransform: 'uppercase',
  },
  paragraph: {
    marginBottom: 5,
    color: '#334155',
  },
  paragraphStrong: {
    marginBottom: 5,
    fontWeight: 700,
    color: '#111827',
  },
  parties: {
    gap: 7,
    marginTop: 8,
    marginBottom: 8,
  },
  partyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 9,
    backgroundColor: '#f8fafc',
  },
  partyHeading: {
    fontSize: 9,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: 10,
    fontWeight: 700,
    color: '#020617',
    marginBottom: 3,
  },
  partyLine: {
    fontSize: 8.5,
    color: '#475569',
    marginBottom: 2,
  },
  signatureWrap: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 26,
  },
  signature: {
    flex: 1,
    textAlign: 'center',
  },
  signatureHeading: {
    fontWeight: 700,
    marginBottom: 48,
  },
  signatureName: {
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: '#dbe3ee',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
    minHeight: 26,
  },
  groupRow: {
    backgroundColor: '#eef2f7',
    paddingHorizontal: 6,
    paddingVertical: 5,
    fontSize: 8.6,
    fontWeight: 700,
    color: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 5,
    fontSize: 8.2,
  },
  headerCell: {
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    fontSize: 7.2,
  },
  itemName: {
    width: '37%',
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
    width: '17%',
    textAlign: 'right',
    fontWeight: 600,
  },
  totals: {
    marginTop: 6,
    marginLeft: 'auto',
    width: 260,
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3,
    fontSize: 9,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
    fontSize: 11,
    fontWeight: 700,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 18,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
  },
})

function PartyCard({ heading, profile = {}, role = 'customer' }) {
  return (
    <View style={styles.partyCard}>
      <Text style={styles.partyHeading}>{heading}</Text>
      <Text style={styles.partyName}>{getProfileName(profile)}</Text>
      <Text style={styles.partyLine}>Đại diện: {profile.representative || '-'}</Text>
      <Text style={styles.partyLine}>Chức vụ: {profile.position || '-'}</Text>
      {role === 'customer' && hasText(profile.authorization_number) ? <Text style={styles.partyLine}>Giấy ủy quyền số: {profile.authorization_number}</Text> : null}
      {role === 'customer' && hasText(profile.authorization_date) ? <Text style={styles.partyLine}>Ngày giấy ủy quyền: {profile.authorization_date}</Text> : null}
      <Text style={styles.partyLine}>Địa chỉ: {profile.address || '-'}</Text>
      {role === 'customer' && hasText(profile.email) ? <Text style={styles.partyLine}>Email: {profile.email}</Text> : null}
      {role === 'customer' && hasText(profile.phone_number) ? <Text style={styles.partyLine}>Số điện thoại: {profile.phone_number}</Text> : null}
      <Text style={styles.partyLine}>Mã số thuế: {profile.tax_code || '-'}</Text>
      {role === 'seller' && profile.bank_account ? <Text style={styles.partyLine}>Số tài khoản: {profile.bank_account} - {profile.bank_name || '-'}</Text> : null}
    </View>
  )
}

function Paragraphs({ text = '' }) {
  const paragraphs = String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  return (
    <View>
      {paragraphs.map((paragraph, index) => (
        <Text key={`${paragraph}-${index}`} style={/^(Nghĩa vụ|Bên [AB] có|Mọi Thông Tin)/i.test(paragraph) ? styles.paragraphStrong : styles.paragraph}>
          {paragraph}
        </Text>
      ))}
    </View>
  )
}

function ScheduleRows({ rows = [] }) {
  if (!rows.length) return null
  return (
    <View>
      {rows.map((row, index) => (
        <View key={`${row.date_text}-${index}`} wrap={false}>
          <Text style={styles.paragraph}>Thời gian: {[row.time_range, row.date_text].filter(Boolean).join(' ngày ') || '-'}</Text>
          <Text style={styles.paragraph}>Địa điểm: {row.location || '-'}</Text>
        </View>
      ))}
    </View>
  )
}

function QuoteItemsTable({ items = [] }) {
  const groups = groupItemsByDay(items)

  return (
    <View style={styles.table}>
      <View style={styles.headerRow} fixed>
        <Text style={[styles.cell, styles.headerCell, styles.itemName]}>Hạng mục</Text>
        <Text style={[styles.cell, styles.headerCell, styles.unit]}>Đơn vị tính</Text>
        <Text style={[styles.cell, styles.headerCell, styles.qty]}>Số lượng</Text>
        <Text style={[styles.cell, styles.headerCell, styles.sessions]}>Số buổi</Text>
        <Text style={[styles.cell, styles.headerCell, styles.price]}>Đơn giá</Text>
        <Text style={[styles.cell, styles.headerCell, styles.amount]}>Thành tiền</Text>
      </View>
      {groups.map(group => (
        <View key={`${group.label}-${group.firstIndex}`} wrap={false}>
          {groups.length > 1 ? <Text style={styles.groupRow}>{group.label}</Text> : null}
          {group.items.map((item, index) => (
            <View key={`${group.label}-${item.service_code || item.service_name || 'item'}-${index}`} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.itemName]}>{getItemName(item)}</Text>
              <Text style={[styles.cell, styles.unit]}>{getItemUnit(item)}</Text>
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

function Totals({ quote = {} }) {
  const rows = [
    [CONTRACT_SUBTOTAL_LABEL, quote.subtotal],
    quote.has_vat !== false ? ['Thuế GTGT 8%', quote.vat_amount] : null,
  ].filter(Boolean)

  return (
    <View style={styles.totals}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.totalLine}>
          <Text>{label}</Text>
          <Text>{formatCurrency(value)}</Text>
        </View>
      ))}
      <View style={styles.grandTotal}>
        <Text>Tổng cộng</Text>
        <Text>{formatCurrency(quote.total_amount)}</Text>
      </View>
    </View>
  )
}

function ServiceArticle({ contract = {}, quote = {}, items = [] }) {
  const workProgressNotes = getContractWorkProgressNotes(contract)

  return (
    <View>
      <Text style={styles.sectionTitle}>ĐIỀU 1: NỘI DUNG HỢP ĐỒNG</Text>
      <Text style={styles.paragraph}>
        Bên A đề nghị Bên B và Bên B đồng ý {contract.service_scope || 'cung cấp dịch vụ theo báo giá'} cho Bên A, chi tiết như sau:
      </Text>
      <ScheduleRows rows={contract.schedule_rows || []} />
      <Text style={styles.paragraphStrong}>Chi tiết hạng mục</Text>
      <QuoteItemsTable items={items} />
      <Totals quote={quote} />
      <Text style={styles.paragraphStrong}>Lưu ý về thời gian làm việc và tiến độ bàn giao:</Text>
      {workProgressNotes.map(item => <Text key={item} style={styles.paragraph}>- {item}</Text>)}
    </View>
  )
}

function PaymentArticle({ contract = {}, quote = {} }) {
  const payment = contract.payment_config || {}
  const depositPercent = getContractDepositPercent(payment)
  const finalDueDays = getContractPaymentDueDays(payment)
  const hasAdvance = hasContractAdvance(payment)
  const depositAmount = Number(quote.total_amount || 0) * depositPercent / 100
  const docs = Array.isArray(payment.payment_documents) ? payment.payment_documents : []
  const paymentNotes = getContractPaymentNotes(payment)

  return (
    <View>
      <Text style={styles.sectionTitle}>ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG</Text>
      <Text style={styles.paragraph}>Giá trị của hợp đồng là: {formatCurrency(quote.total_amount)} {quote.has_vat !== false ? '(Đã bao gồm VAT)' : '(Chưa bao gồm VAT)'}</Text>
      <Text style={styles.paragraph}>(Bằng chữ: {numberToVietnameseWords(quote.total_amount)}./.)</Text>
      {hasAdvance ? (
        <>
          <Text style={styles.paragraph}>Phương thức thanh toán: Việc thanh toán Hợp đồng sẽ thực hiện thành 02 lần:</Text>
          <Text style={styles.paragraph}>Lần 1: Bên A đặt cọc {depositPercent}% giá trị hợp đồng tương ứng {formatCurrency(depositAmount)} cho Bên B sau khi ký hợp đồng{payment.issue_invoice_on_deposit ? ' và trước ngày thực hiện tối thiểu 02 ngày, đồng thời bên B xuất hóa đơn cho bên A sau khi nhận được thanh toán lần 1' : ''}.</Text>
          <Text style={styles.paragraph}>Lần 2: Bên A thanh toán nốt số tiền còn lại cho Bên B trong vòng {finalDueDays} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.</Text>
        </>
      ) : (
        <>
          <Text style={styles.paragraph}>Phương thức thanh toán:</Text>
          <Text style={styles.paragraph}>Bên A thanh toán 100% giá trị hợp đồng cho Bên B trong vòng {finalDueDays} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.</Text>
        </>
      )}
      {docs.length ? (
        <>
          <Text style={styles.paragraphStrong}>Hồ sơ thanh toán bao gồm:</Text>
          {docs.map(item => <Text key={item} style={styles.paragraph}>- {item}</Text>)}
        </>
      ) : null}
      <Text style={styles.paragraphStrong}>Lưu ý về thanh toán:</Text>
      {paymentNotes.map(item => <Text key={item} style={styles.paragraph}>- {item}</Text>)}
    </View>
  )
}

function ContentSections({ sections = [] }) {
  return (
    <View>
      {sections.map((section, index) => (
        <View key={section.id || `${section.article_no}-${index}`}>
          <Text style={styles.sectionTitle}>ĐIỀU {section.article_no || index + 3}: {section.title || 'ĐIỀU KHOẢN'}</Text>
          <Paragraphs text={section.body} />
        </View>
      ))}
    </View>
  )
}

function Signature({ contract = {} }) {
  const partyA = getPartyProfile(contract, 'party_a')
  return (
    <View style={styles.signatureWrap}>
      <View style={styles.signature}>
        <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN A</Text>
        <Text style={styles.signatureName}>{partyA.representative || ''}</Text>
      </View>
      <View style={styles.signature}>
        <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN B</Text>
        <Text style={styles.signatureName} />
      </View>
    </View>
  )
}

export default function ContractPDFDocument({ contract = {} }) {
  const quote = getQuote(contract)
  const items = Array.isArray(quote.items) ? quote.items : []
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  const preambleLines = getContractPreamble(contract)

  return (
    <Document title={contract.contract_number || 'Hợp đồng'}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.national}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
        <Text style={styles.nationalMotto}>Độc lập – Tự do – Hạnh phúc</Text>
        <Text style={styles.title}>{contract.title || 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ'}</Text>
        <Text style={styles.subtitle}>Số: {contract.contract_number || '-'}</Text>
        {preambleLines.map(line => <Text key={line} style={styles.paragraph}>{line}</Text>)}
        <Text style={styles.paragraph}>Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày {formatDate(contract.signing_date || contract.updated_at || contract.created_at)} giữa các bên gồm:</Text>

        <View style={styles.parties}>
          <PartyCard heading="BÊN A:" profile={partyA} role={getPartyRole(contract, 'party_a')} />
          <Text style={styles.paragraphStrong}>Và:</Text>
          <PartyCard heading="BÊN B:" profile={partyB} role={getPartyRole(contract, 'party_b')} />
        </View>

        <Text style={styles.paragraph}>Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:</Text>
        <ServiceArticle contract={contract} quote={quote} items={items} />
        <PaymentArticle contract={contract} quote={quote} />
        <ContentSections sections={contract.content_sections || []} />
        <Signature contract={contract} />
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
