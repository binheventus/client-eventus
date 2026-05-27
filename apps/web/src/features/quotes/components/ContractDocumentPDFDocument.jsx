import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
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
} from '../lib/contractDocumentRender'

const PDF_FONT_FAMILY = 'BeVietnamProContractDocument'
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

export function getContractDocumentPdfFilename(document = {}) {
  return getContractDocumentFilename(document, 'pdf')
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
  center: {
    textAlign: 'center',
  },
  national: {
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 2,
  },
  title: {
    marginTop: 13,
    marginBottom: 4,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 9.5,
    color: '#475569',
    marginBottom: 10,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    marginBottom: 5,
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#111827',
  },
  paragraph: {
    marginBottom: 5,
    color: '#334155',
  },
  strong: {
    fontWeight: 700,
    color: '#111827',
  },
  parties: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  partyCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 8,
    backgroundColor: '#f8fafc',
  },
  partyTitle: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  partyName: {
    fontSize: 9.5,
    fontWeight: 700,
    color: '#020617',
    marginBottom: 3,
  },
  partyLine: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 2,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
    marginVertical: 8,
  },
  metaLine: {
    flex: 1,
    fontSize: 8.5,
    color: '#475569',
  },
  table: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginTop: 6,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
  },
  row: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  cell: {
    paddingHorizontal: 5,
    paddingVertical: 4,
    fontSize: 7.8,
  },
  headerCell: {
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    fontSize: 7,
  },
  desc: { width: '38%' },
  unit: { width: '11%', textAlign: 'center' },
  qty: { width: '9%', textAlign: 'right' },
  price: { width: '19%', textAlign: 'right' },
  amount: { width: '23%', textAlign: 'right', fontWeight: 600 },
  totalLabel: {
    width: '77%',
    textAlign: 'right',
    fontWeight: 700,
  },
  summaryTable: {
    width: 360,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  summaryRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryLabel: {
    width: '55%',
    padding: 5,
    fontSize: 8.5,
    fontWeight: 700,
    backgroundColor: '#f8fafc',
  },
  summaryValue: {
    width: '45%',
    padding: 5,
    fontSize: 8.5,
    fontWeight: 700,
    textAlign: 'right',
  },
  signatureWrap: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 24,
  },
  signature: {
    flex: 1,
    textAlign: 'center',
  },
  signatureHeading: {
    fontWeight: 700,
    marginBottom: 46,
  },
  signatureName: {
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

function PartyCard({ title, profile = {} }) {
  return (
    <View style={styles.partyCard}>
      <Text style={styles.partyTitle}>{title}</Text>
      <Text style={styles.partyName}>{getProfileName(profile) || '-'}</Text>
      <Text style={styles.partyLine}>Đại diện: {profile.representative || '-'}</Text>
      <Text style={styles.partyLine}>Chức vụ: {profile.position || '-'}</Text>
      <Text style={styles.partyLine}>Địa chỉ: {profile.address || '-'}</Text>
      <Text style={styles.partyLine}>Mã số thuế: {profile.tax_code || '-'}</Text>
    </View>
  )
}

function SummaryRows({ rows = [] }) {
  return (
    <View style={styles.summaryTable}>
      {rows.map(([label, value], index) => (
        <View key={label} style={[styles.summaryRow, index === 0 ? { borderTopWidth: 0 } : null]}>
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text style={styles.summaryValue}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

function AmountTable({ title, rows = [], totals = {}, vatConfig = {} }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.headerRow} fixed>
          <Text style={[styles.cell, styles.headerCell, styles.desc]}>Nội dung</Text>
          <Text style={[styles.cell, styles.headerCell, styles.unit]}>ĐVT</Text>
          <Text style={[styles.cell, styles.headerCell, styles.qty]}>SL</Text>
          <Text style={[styles.cell, styles.headerCell, styles.price]}>Đơn giá</Text>
          <Text style={[styles.cell, styles.headerCell, styles.amount]}>Thành tiền</Text>
        </View>
        {rows.length ? rows.map((row, index) => (
          <View key={row.id || index} style={styles.row} wrap={false}>
            <Text style={[styles.cell, styles.desc]}>{row.description || '-'}</Text>
            <Text style={[styles.cell, styles.unit]}>{row.unit || '-'}</Text>
            <Text style={[styles.cell, styles.qty]}>{row.quantity || 0}</Text>
            <Text style={[styles.cell, styles.price]}>{formatDocumentCurrency(row.unit_price, '')}</Text>
            <Text style={[styles.cell, styles.amount]}>{formatDocumentCurrency(row.amount, '')}</Text>
          </View>
        )) : (
          <View style={styles.row}><Text style={[styles.cell, { width: '100%', textAlign: 'center' }]}>Chưa có dòng giá trị.</Text></View>
        )}
        {[
          ['Trước VAT', totals.subtotal],
          [getVatLabel(vatConfig), totals.vat_amount],
          ['Tổng cộng', totals.total_amount],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.cell, styles.totalLabel]}>{label}</Text>
            <Text style={[styles.cell, styles.amount]}>{formatDocumentCurrency(value, '')}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function Sections({ document = {} }) {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  if (sections.length) {
    return sections.map((section, index) => (
      <View key={section.id || index} style={styles.section}>
        <Text style={styles.sectionTitle}>{section.title || `Mục ${index + 1}`}</Text>
        {String(section.body || '').split(/\n+/).filter(Boolean).map((line, lineIndex) => (
          <Text key={`${line}-${lineIndex}`} style={styles.paragraph}>{line}</Text>
        ))}
      </View>
    ))
  }
  if (!hasDocumentText(document.terms_text)) return null
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Điều khoản</Text>
      {String(document.terms_text || '').split(/\n+/).filter(Boolean).map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.paragraph}>{line}</Text>
      ))}
    </View>
  )
}

function AdvanceBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getAdvanceSummary(document)
  return (
    <View style={styles.section}>
      <Text style={styles.paragraph}>Căn cứ Hợp đồng số {contract.contract_number || '-'}, Bên B kính đề nghị Bên A thanh toán khoản tạm ứng như sau:</Text>
      {summary.request_content ? <Text style={styles.paragraph}>{summary.request_content}</Text> : null}
      <SummaryRows rows={[
        ['Giá trị hợp đồng', formatDocumentCurrency(summary.contract_value)],
        ['Tỷ lệ tạm ứng', `${summary.advance_percent}%`],
        ['Số tiền tạm ứng', formatDocumentCurrency(summary.advance_amount)],
      ]} />
      {summary.amount_words ? <Text style={styles.paragraph}>Bằng chữ: {summary.amount_words}.</Text> : null}
      <Text style={styles.paragraph}>Tài khoản nhận tiền: {summary.bank_account || '-'}</Text>
    </View>
  )
}

function AcceptanceBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getAcceptanceSummary(document)
  return (
    <View>
      <Text style={styles.paragraph}>Hai bên cùng nghiệm thu khối lượng dịch vụ theo Hợp đồng số {contract.contract_number || '-'}.</Text>
      <AmountTable title="Giá trị theo hợp đồng" rows={summary.contract_rows} totals={summary.contract_totals} vatConfig={summary.vat_config} />
      <AmountTable title="Giá trị nghiệm thu/thực tế" rows={summary.actual_rows} totals={summary.actual_totals} vatConfig={summary.vat_config} />
      {summary.amount_words ? <Text style={styles.paragraph}>Tổng giá trị nghiệm thu bằng chữ: {summary.amount_words}.</Text> : null}
      {summary.acceptance_note ? <Text style={styles.paragraph}>{summary.acceptance_note}</Text> : null}
    </View>
  )
}

function PaymentBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getPaymentSummary(document)
  return (
    <View style={styles.section}>
      <Text style={styles.paragraph}>Căn cứ Hợp đồng số {contract.contract_number || '-'} và BBNT đã liên kết, Bên B kính đề nghị Bên A thanh toán giá trị còn lại.</Text>
      {summary.request_content ? <Text style={styles.paragraph}>{summary.request_content}</Text> : null}
      <SummaryRows rows={[
        ['Tổng nghiệm thu', formatDocumentCurrency(summary.acceptance_total)],
        ['Khấu trừ tạm ứng', formatDocumentCurrency(summary.advance_deduction_total)],
        ['Số tiền thanh toán', formatDocumentCurrency(summary.payment_amount)],
      ]} />
      {summary.advance_deductions.length ? (
        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            <Text style={[styles.cell, styles.headerCell, { width: '50%' }]}>Đề nghị tạm ứng</Text>
            <Text style={[styles.cell, styles.headerCell, { width: '25%', textAlign: 'right' }]}>Số tiền gốc</Text>
            <Text style={[styles.cell, styles.headerCell, { width: '25%', textAlign: 'right' }]}>Khấu trừ</Text>
          </View>
          {summary.advance_deductions.map(row => (
            <View key={row.document_id} style={styles.row}>
              <Text style={[styles.cell, { width: '50%' }]}>{row.document_number || row.document_title || '-'}</Text>
              <Text style={[styles.cell, { width: '25%', textAlign: 'right' }]}>{formatDocumentCurrency(row.original_amount, '')}</Text>
              <Text style={[styles.cell, { width: '25%', textAlign: 'right', fontWeight: 700 }]}>{formatDocumentCurrency(row.deduction_amount, '')}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {summary.amount_words ? <Text style={styles.paragraph}>Bằng chữ: {summary.amount_words}.</Text> : null}
      <Text style={styles.paragraph}>Tài khoản nhận tiền: {summary.bank_account || '-'}</Text>
    </View>
  )
}

function DocumentBody({ document }) {
  if (document.document_type === 'acceptance_liquidation') return <AcceptanceBody document={document} />
  if (document.document_type === 'payment_request') return <PaymentBody document={document} />
  return <AdvanceBody document={document} />
}

export default function ContractDocumentPDFDocument({ document = {} }) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const issuedDate = formatDocumentDate(document.issued_date || document.created_at)

  return (
    <Document title={document.document_number || getDocumentTitle(document)}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.national}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
        <Text style={styles.national}>Độc lập - Tự do - Hạnh phúc</Text>
        <Text style={styles.title}>{getDocumentTitle(document)}</Text>
        <Text style={styles.subtitle}>Số: {document.document_number || '-'} | Ngày lập: {issuedDate || '-'}</Text>

        <View style={styles.parties}>
          <PartyCard title={document.document_type === 'acceptance_liquidation' ? 'Bên A' : 'Kính gửi'} profile={customer} />
          <PartyCard title={document.document_type === 'acceptance_liquidation' ? 'Bên B' : 'Bên đề nghị'} profile={seller} />
        </View>

        <View style={styles.metaGrid}>
          <Text style={styles.metaLine}>Loại chứng từ: {getDocumentTypeLabel(document.document_type)}</Text>
          <Text style={styles.metaLine}>Hợp đồng: {contract.contract_number || '-'}</Text>
        </View>

        <DocumentBody document={document} />
        <Sections document={document} />

        <View style={styles.signatureWrap}>
          <View style={styles.signature}>
            <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN A</Text>
            <Text style={styles.signatureName}>{customer.representative || ''}</Text>
          </View>
          <View style={styles.signature}>
            <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN B</Text>
            <Text style={styles.signatureName}>{seller.representative || ''}</Text>
          </View>
        </View>
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`} fixed />
      </Page>
    </Document>
  )
}
