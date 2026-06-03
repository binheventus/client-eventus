import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
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
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentRequestContent,
  getProfileName,
  getSellerProfile,
  getVatLabel,
  hasDocumentText,
  shouldShowAcceptanceAmountTables,
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
  paymentHeader: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  paymentDate: {
    marginTop: 18,
    marginBottom: 20,
    textAlign: 'right',
    fontSize: 10.5,
  },
  paymentTitle: {
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  paymentNumber: {
    textAlign: 'center',
    fontSize: 10.5,
    marginBottom: 22,
  },
  paymentParagraph: {
    marginBottom: 9,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: '#111827',
  },
  paymentSignatureWrap: {
    marginTop: 28,
    alignItems: 'flex-end',
    paddingRight: 46,
  },
  paymentSignature: {
    width: 170,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: 700,
  },
  paymentSignatureSpace: {
    height: 58,
  },
})

function PartyCard({ title, profile = {}, bank = null }) {
  return (
    <View style={styles.partyCard}>
      <Text style={styles.partyTitle}>{title}</Text>
      <Text style={styles.partyName}>{getProfileName(profile) || '-'}</Text>
      <Text style={styles.partyLine}>Đại diện: {profile.representative || '-'}</Text>
      <Text style={styles.partyLine}>Chức vụ: {profile.position || '-'}</Text>
      <Text style={styles.partyLine}>Địa chỉ: {profile.address || '-'}</Text>
      <Text style={styles.partyLine}>Mã số thuế: {profile.tax_code || '-'}</Text>
      {bank?.account_number ? (
        <Text style={styles.partyLine}>Số tài khoản: {bank.account_number}</Text>
      ) : null}
      {bank?.bank_name ? (
        <Text style={styles.partyLine}>Ngân hàng: {bank.bank_name}</Text>
      ) : null}
    </View>
  )
}

function getBankDetailLineParts(line = '') {
  const match = String(line || '').match(/^(\s*(?:Tài khoản chuyển khoản|Ngân hàng|Chủ tài khoản)\s*:\s*)(.+)$/i)
  if (!match) return null
  return {
    label: match[1],
    value: match[2],
  }
}

function BankAwarePdfParagraph({ line = '', style }) {
  const bankLine = getBankDetailLineParts(line)
  if (!bankLine) return <Text style={style}>{line}</Text>

  return (
    <Text style={style}>
      {bankLine.label}
      <Text style={styles.strong}>{bankLine.value}</Text>
    </Text>
  )
}

function BankPaymentLine({ label, value }) {
  return (
    <Text style={styles.paymentParagraph}>
      {label}: <Text style={styles.strong}>{value || '-'}</Text>
    </Text>
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

function PdfAcceptanceAmountTable({ title, rows = [], totals = {}, vatConfig = {} }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.table}>
        <View style={styles.headerRow} fixed>
          <Text style={[styles.cell, styles.headerCell, { width: '8%', textAlign: 'center' }]}>STT</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '34%' }]}>Hạng mục</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>ĐVT</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '12%', textAlign: 'right' }]}>SL</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '18%', textAlign: 'right' }]}>Đơn giá</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '18%', textAlign: 'right' }]}>Thành tiền</Text>
        </View>
        {rows.length ? rows.map((row, index) => (
          <View key={row.id || index} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: '8%', textAlign: 'center' }]}>{index + 1}</Text>
            <Text style={[styles.cell, { width: '34%' }]}>{row.description || '-'}</Text>
            <Text style={[styles.cell, { width: '10%' }]}>{row.unit || '-'}</Text>
            <Text style={[styles.cell, { width: '12%', textAlign: 'right' }]}>{row.quantity || 0}</Text>
            <Text style={[styles.cell, { width: '18%', textAlign: 'right' }]}>{formatDocumentCurrency(row.unit_price, '')}</Text>
            <Text style={[styles.cell, { width: '18%', textAlign: 'right' }]}>{formatDocumentCurrency(row.amount, '')}</Text>
          </View>
        )) : (
          <View style={styles.row}><Text style={[styles.cell, { width: '100%', textAlign: 'center' }]}>Chưa có hạng mục.</Text></View>
        )}
        {[
          ['Tổng (chưa bao gồm thuế GTGT)', totals.subtotal],
          [getVatLabel(vatConfig), totals.vat_amount],
          ['Tổng chi phí (Đã bao gồm VAT)', totals.total_amount],
        ].map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={[styles.cell, { width: '82%', textAlign: 'right', fontWeight: 700 }]}>{label}</Text>
            <Text style={[styles.cell, { width: '18%', textAlign: 'right', fontWeight: 700 }]}>{formatDocumentCurrency(value, '')}</Text>
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
  const bank = getBankAccountDetails(document)
  const content = getAdvanceRequestContent(document)
  return (
    <View style={styles.section}>
      {content.greeting ? <Text style={styles.paymentParagraph}>{content.greeting}</Text> : null}
      {content.basis ? <Text style={styles.paymentParagraph}>{content.basis}</Text> : null}
      {content.request ? <Text style={styles.paymentParagraph}>{content.request}</Text> : null}
      {content.amount_words ? <Text style={styles.paymentParagraph}>{content.amount_words}</Text> : null}
      {content.method ? <Text style={styles.paymentParagraph}>{content.method}</Text> : null}
      {content.bank_intro ? <Text style={styles.paymentParagraph}>{content.bank_intro}</Text> : null}
      <BankPaymentLine label="Tài khoản chuyển khoản" value={bank.account_number} />
      <BankPaymentLine label="Ngân hàng" value={bank.bank_name} />
      <BankPaymentLine label="Chủ tài khoản" value={bank.account_holder} />
      {content.closing ? <Text style={styles.paymentParagraph}>{content.closing}</Text> : null}
    </View>
  )
}

function AcceptanceBody({ document }) {
  const content = getAcceptanceLiquidationContent(document)
  return (
    <View>
      {content.basis_contract ? <Text style={styles.paragraph}>{content.basis_contract}</Text> : null}
      {content.basis_completed ? <Text style={styles.paragraph}>{content.basis_completed}</Text> : null}
      {content.party_intro ? <Text style={styles.paragraph}>{content.party_intro}</Text> : null}
      {content.signing_intro ? <Text style={styles.paragraph}>{content.signing_intro}</Text> : null}
      {content.articles.map(section => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {String(section.body || '').split(/\n+/).filter(Boolean).map((line, index) => (
            <Text key={`${section.id}-${index}`} style={styles.paragraph}>{line}</Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function PaymentBody({ document }) {
  const bank = getBankAccountDetails(document)
  const content = getPaymentRequestContent(document)

  return (
    <View style={styles.section}>
      {content.greeting ? <Text style={styles.paymentParagraph}>{content.greeting}</Text> : null}
      {content.basis ? <Text style={styles.paymentParagraph}>{content.basis}</Text> : null}
      {content.request ? <Text style={styles.paymentParagraph}>{content.request}</Text> : null}
      {content.amount_words ? <Text style={styles.paymentParagraph}>{content.amount_words}</Text> : null}
      {content.method ? <Text style={styles.paymentParagraph}>{content.method}</Text> : null}
      {content.bank_intro ? <Text style={styles.paymentParagraph}>{content.bank_intro}</Text> : null}
      <BankPaymentLine label="Tài khoản chuyển khoản" value={bank.account_number} />
      <BankPaymentLine label="Ngân hàng" value={bank.bank_name} />
      <BankPaymentLine label="Chủ tài khoản" value={bank.account_holder} />
      {content.closing ? <Text style={styles.paymentParagraph}>{content.closing}</Text> : null}
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
  const bank = getBankAccountDetails(document)
  const issuedDate = formatDocumentDate(document.issued_date || document.created_at)
  const acceptanceContent = document.document_type === 'acceptance_liquidation'
    ? getAcceptanceLiquidationContent(document)
    : null
  const acceptanceSummary = document.document_type === 'acceptance_liquidation'
    ? getAcceptanceSummary(document)
    : null
  const showAcceptanceAmountTables = document.document_type === 'acceptance_liquidation'
    ? shouldShowAcceptanceAmountTables(document, acceptanceSummary)
    : false

  return (
    <Document title={document.document_number || getDocumentTitle(document)}>
      <Page size="A4" style={styles.page}>
        {document.document_type === 'advance_request' || document.document_type === 'payment_request' ? (
          <>
            <Text style={styles.paymentHeader}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
            <Text style={styles.paymentHeader}>Độc lập - Tự do - Hạnh phúc</Text>
            <Text style={styles.paymentDate}>Ngày {issuedDate || '-'}</Text>
            <Text style={styles.paymentTitle}>{getDocumentTitle(document)}</Text>
            <Text style={styles.paymentNumber}>Số: {document.document_number || '-'}</Text>
            {document.document_type === 'payment_request' ? <PaymentBody document={document} /> : <AdvanceBody document={document} />}
            <View style={styles.paymentSignatureWrap}>
              <View style={styles.paymentSignature}>
                <Text>ĐẠI DIỆN</Text>
                <View style={styles.paymentSignatureSpace} />
                <Text>{seller.representative || ''}</Text>
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`} fixed />
          </>
        ) : document.document_type === 'acceptance_liquidation' ? (
          <>
            <Text style={[styles.national, styles.strong]}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
            <Text style={[styles.national, styles.strong]}>Độc lập - Tự do - Hạnh phúc</Text>
            <Text style={styles.title}>BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG</Text>
            {acceptanceContent?.basis_contract ? <Text style={styles.paragraph}>{acceptanceContent.basis_contract}</Text> : null}
            {acceptanceContent?.basis_completed ? <Text style={styles.paragraph}>{acceptanceContent.basis_completed}</Text> : null}
            {acceptanceContent?.party_intro ? <Text style={styles.paragraph}>{acceptanceContent.party_intro}</Text> : null}

            <View style={styles.parties}>
              <PartyCard title="BÊN A" profile={customer} />
              <PartyCard title="BÊN B" profile={seller} bank={bank} />
            </View>
            {acceptanceContent?.signing_intro ? <Text style={styles.paragraph}>{acceptanceContent.signing_intro}</Text> : null}
            {acceptanceContent?.articles.map(section => (
              <View key={section.id} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {String(section.body || '').split(/\n+/).filter(Boolean).map((line, index) => (
                  <BankAwarePdfParagraph key={`${section.id}-${index}`} line={line} style={styles.paragraph} />
                ))}
                {showAcceptanceAmountTables && section.id === 'acceptance-article-2' ? (
                  <>
                    <PdfAcceptanceAmountTable title="Bảng giá trị theo hợp đồng" rows={acceptanceSummary?.contract_rows || []} totals={acceptanceSummary?.contract_totals || {}} vatConfig={acceptanceSummary?.vat_config || {}} />
                    <PdfAcceptanceAmountTable title="Bảng giá trị nghiệm thu/thực tế" rows={acceptanceSummary?.actual_rows || []} totals={acceptanceSummary?.actual_totals || {}} vatConfig={acceptanceSummary?.vat_config || {}} />
                    {acceptanceContent.cost_difference_note ? <Text style={styles.paragraph}>{acceptanceContent.cost_difference_note}</Text> : null}
                  </>
                ) : null}
              </View>
            ))}

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
          </>
        ) : (
          <>
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
          </>
        )}
      </Page>
    </Document>
  )
}
