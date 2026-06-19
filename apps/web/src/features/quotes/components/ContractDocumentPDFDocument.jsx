import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
  getAdvanceRequestContent,
  getAdvanceSummary,
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
} from '../lib/contractDocumentRender'
import { formatContractDocumentNumberForDisplay } from '../lib/contractDocumentEditor'

const PDF_FONT_FAMILY = 'TimesNewRomanContractDocument'
const TIMES_FONT_PATH = '/fonts/times-new-roman'

Font.register({
  family: PDF_FONT_FAMILY,
  fonts: [
    { src: `${TIMES_FONT_PATH}/Times-New-Roman.ttf`, fontWeight: 400 },
    { src: `${TIMES_FONT_PATH}/Times-New-Roman-Italic.ttf`, fontWeight: 400, fontStyle: 'italic' },
    { src: `${TIMES_FONT_PATH}/Times-New-Roman-Bold.ttf`, fontWeight: 600 },
    { src: `${TIMES_FONT_PATH}/Times-New-Roman-Bold.ttf`, fontWeight: 700 },
    { src: `${TIMES_FONT_PATH}/Times-New-Roman-Bold-Italic.ttf`, fontWeight: 700, fontStyle: 'italic' },
  ],
})

Font.registerHyphenationCallback(word => [word])

export function getContractDocumentPdfFilename(document = {}) {
  return getContractDocumentFilename(document, 'pdf')
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 51,
    paddingVertical: 28,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 9.75,
    lineHeight: 1.58,
    color: '#0f172a',
  },
  center: {
    textAlign: 'center',
  },
  national: {
    textAlign: 'center',
    fontSize: 9.75,
    lineHeight: 1.58,
  },
  title: {
    marginTop: 16,
    marginBottom: 0,
    textAlign: 'center',
    fontSize: 13.75,
    fontWeight: 700,
    lineHeight: 1.25,
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
    marginTop: 4,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingHorizontal: 4,
    paddingVertical: 2,
    fontSize: 9.75,
    lineHeight: 1.35,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  lastRowCell: {
    borderBottomWidth: 0,
  },
  headerCell: {
    fontWeight: 700,
    color: '#0f172a',
    fontSize: 9.75,
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
    gap: 24,
    marginTop: 18,
    paddingTop: 12,
  },
  signature: {
    flex: 1,
    textAlign: 'center',
  },
  signatureHeading: {
    fontWeight: 700,
    marginBottom: 72,
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
  paymentBankLine: {
    marginLeft: 20,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  paymentBankBullet: {
    width: 3.5,
    height: 3.5,
    marginTop: 6.2,
    marginRight: 7,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  paymentBankText: {
    flex: 1,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: '#111827',
  },
  paymentAmountWords: {
    fontStyle: 'italic',
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
  acceptanceBody: {
    marginTop: 14,
    marginBottom: 14,
  },
  acceptanceGroup: {
    marginBottom: 8,
  },
  acceptancePartyBlock: {
    marginBottom: 0,
  },
  acceptancePartyBlockEnd: {
    marginBottom: 8,
  },
  acceptanceParagraph: {
    fontSize: 9.75,
    lineHeight: 1.58,
    color: '#0f172a',
  },
  acceptanceInfoParagraph: {
    fontSize: 9.75,
    lineHeight: 1.58,
    color: '#334155',
  },
  acceptancePartyTitle: {
    fontSize: 9.75,
    lineHeight: 1.58,
    fontWeight: 700,
    color: '#020617',
    textTransform: 'uppercase',
  },
  acceptanceSectionTitle: {
    marginBottom: 4,
    fontSize: 10.25,
    lineHeight: 1.3,
    fontWeight: 700,
    color: '#020617',
    textTransform: 'uppercase',
  },
  acceptanceTableTitle: {
    marginBottom: 4,
    fontSize: 9.75,
    lineHeight: 1.3,
    fontWeight: 600,
    color: '#0f172a',
  },
  acceptanceAmountTableSection: {
    marginTop: 6,
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

function AcceptanceInfoLine({ label, value }) {
  return (
    <Text style={styles.acceptanceInfoParagraph}>
      <Text style={styles.strong}>{label}: </Text>
      {hasDocumentText(value) ? value : '-'}
    </Text>
  )
}

function AcceptanceRepresentativePositionLine({ profile = {} }) {
  return (
    <Text style={styles.acceptanceInfoParagraph}>
      <Text style={styles.strong}>Đại diện: </Text>
      {hasDocumentText(profile.representative) ? profile.representative : '-'}
      <Text style={styles.strong}> | Chức vụ: </Text>
      {hasDocumentText(profile.position) ? profile.position : '-'}
    </Text>
  )
}

function AcceptancePartyBlock({ title, profile = {}, bank = null, isLast = false, displayName = '' }) {
  return (
    <View style={isLast ? styles.acceptancePartyBlockEnd : styles.acceptancePartyBlock}>
      <Text style={styles.acceptancePartyTitle}>{title}: {displayName || getProfileName(profile) || '-'}</Text>
      <AcceptanceRepresentativePositionLine profile={profile} />
      <AcceptanceInfoLine label="Địa chỉ" value={profile.address} />
      <AcceptanceInfoLine label="Mã số thuế" value={profile.tax_code} />
      {bank?.account_number ? <AcceptanceInfoLine label="Số tài khoản" value={bank.account_number} /> : null}
      {bank?.bank_name ? <AcceptanceInfoLine label="Ngân hàng" value={bank.bank_name} /> : null}
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

function getAcceptanceLineSpacingStyle(line, index, lines = []) {
  if (index >= lines.length - 1) return null
  return getBankDetailLineParts(line) ? { marginBottom: 0 } : { marginBottom: 4 }
}

function BankPaymentLine({ label, value }) {
  return (
    <View style={styles.paymentBankLine}>
      <View style={styles.paymentBankBullet} />
      <Text style={styles.paymentBankText}>
        {label}: <Text style={styles.strong}>{value || '-'}</Text>
      </Text>
    </View>
  )
}

function HighlightedPdfText({ text = '', highlights = [] }) {
  const source = String(text || '')
  const highlightValues = highlights
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (!source || !highlightValues.length) return <>{source}</>

  const parts = []
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
      parts.push({ text: source.slice(cursor), highlighted: false })
      break
    }

    if (nextMatch.index > cursor) {
      parts.push({ text: source.slice(cursor, nextMatch.index), highlighted: false })
    }
    parts.push({ text: nextMatch.value, highlighted: true })
    cursor = nextMatch.index + nextMatch.value.length
  }

  return (
    <>
      {parts.map((part, index) => (
        part.highlighted
          ? <Text key={`${part.text}-${index}`} style={styles.strong}>{part.text}</Text>
          : <Text key={`${part.text}-${index}`}>{part.text}</Text>
      ))}
    </>
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
  const dataRows = rows.length ? rows.map((row, index) => ({
    key: row.id || index,
    cells: [
      { text: String(index + 1), width: '7%', align: 'center' },
      { text: row.description || '-', width: '37%' },
      { text: row.unit || '-', width: '10%' },
      { text: String(row.quantity || 0), width: '11%', align: 'right' },
      { text: formatDocumentCurrency(row.unit_price, ''), width: '17%', align: 'right' },
      { text: formatDocumentCurrency(row.amount, ''), width: '18%', align: 'right' },
    ],
  })) : [{
    key: 'empty',
    cells: [{ text: 'Chưa có hạng mục.', width: '100%', align: 'center' }],
  }]
  const totalRows = [{
    key: 'totals',
    cells: [
      { text: `Tổng\n${getVatLabel(vatConfig)}\nTổng chi phí`, width: '82%', align: 'right', bold: true },
      { text: `${formatDocumentCurrency(totals.subtotal, '')}\n${formatDocumentCurrency(totals.vat_amount, '')}\n${formatDocumentCurrency(totals.total_amount, '')}`, width: '18%', align: 'right', bold: true },
    ],
  }]
  const renderCell = (cell, index, rowIndex, rowCount, extraStyle = null) => (
    <Text
      key={`${cell.text}-${index}`}
      style={[
        styles.cell,
        extraStyle,
        cell.align ? { textAlign: cell.align } : null,
        cell.bold ? { fontWeight: 700 } : null,
        { width: cell.width },
        index === 5 || cell.width === '100%' || (cell.width === '18%' && rowIndex >= 0) ? styles.lastCell : null,
        rowIndex === rowCount - 1 ? styles.lastRowCell : null,
      ]}
    >
      {cell.text}
    </Text>
  )
  const allRows = [...dataRows, ...totalRows]

  return (
    <View style={styles.acceptanceAmountTableSection} wrap={false}>
      <Text style={styles.acceptanceTableTitle}>{title}:</Text>
      <View style={styles.table}>
        <View style={styles.headerRow} fixed>
          <Text style={[styles.cell, styles.headerCell, { width: '7%', textAlign: 'center' }]}>STT</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '37%' }]}>Hạng mục</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '10%' }]}>ĐVT</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '11%', textAlign: 'right' }]}>Số lượng</Text>
          <Text style={[styles.cell, styles.headerCell, { width: '17%', textAlign: 'right' }]}>Đơn giá (VNĐ)</Text>
          <Text style={[styles.cell, styles.headerCell, styles.lastCell, { width: '18%', textAlign: 'right' }]}>Thành tiền (VNĐ)</Text>
        </View>
        {allRows.map((row, rowIndex) => (
          <View key={row.key} style={styles.row} wrap={false}>
            {row.cells.map((cell, index) => renderCell(cell, index, rowIndex, allRows.length))}
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
  const summary = getAdvanceSummary(document)
  const advanceAmountText = formatDocumentCurrency(summary.advance_amount, '')
  const advanceAmountWithCurrencyText = advanceAmountText ? `${advanceAmountText} VNĐ` : ''
  const advanceAmountHighlights = [advanceAmountWithCurrencyText ? `${advanceAmountWithCurrencyText}.` : '', advanceAmountWithCurrencyText, advanceAmountText]
  return (
    <View style={styles.section}>
      {content.greeting ? <Text style={styles.paymentParagraph}>{content.greeting}</Text> : null}
      {content.basis ? <Text style={styles.paymentParagraph}>{content.basis}</Text> : null}
      {content.request ? (
        <Text style={styles.paymentParagraph}>
          <HighlightedPdfText text={content.request} highlights={advanceAmountHighlights} />
        </Text>
      ) : null}
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
  const summary = getPaymentSummary(document)
  const paymentAmountText = formatDocumentCurrency(summary.payment_amount, '')
  const paymentAmountWithCurrencyText = paymentAmountText ? `${paymentAmountText} VNĐ` : ''
  const paymentAmountHighlights = [paymentAmountWithCurrencyText ? `${paymentAmountWithCurrencyText}.` : '', paymentAmountWithCurrencyText, paymentAmountText]

  return (
    <View style={styles.section}>
      {content.greeting ? <Text style={styles.paymentParagraph}>{content.greeting}</Text> : null}
      {content.basis ? <Text style={styles.paymentParagraph}>{content.basis}</Text> : null}
      {content.request ? (
        <Text style={styles.paymentParagraph}>
          <HighlightedPdfText text={content.request} highlights={paymentAmountHighlights} />
        </Text>
      ) : null}
      {content.amount_words ? (
        <Text style={[styles.paymentParagraph, styles.paymentAmountWords]}>
          <HighlightedPdfText text={content.amount_words} highlights={[summary.amount_words]} />
        </Text>
      ) : null}
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
  const issuedDate = getDisplayDocumentIssuedDate(document)
  const documentNumber = formatContractDocumentNumberForDisplay(document.document_number)
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
    <Document title={documentNumber || getDocumentTitle(document)}>
      <Page size="A4" style={styles.page}>
        {document.document_type === 'advance_request' || document.document_type === 'payment_request' ? (
          <>
            <Text style={styles.paymentHeader}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
            <Text style={styles.paymentHeader}>Độc lập - Tự do - Hạnh phúc</Text>
            {issuedDate ? <Text style={styles.paymentDate}>Ngày {issuedDate}</Text> : null}
            <Text style={styles.paymentTitle}>{getDocumentTitle(document)}</Text>
            <Text style={styles.paymentNumber}>Số: {documentNumber || '-'}</Text>
            {document.document_type === 'payment_request' ? <PaymentBody document={document} /> : <AdvanceBody document={document} />}
            <View style={styles.paymentSignatureWrap}>
              <View style={styles.paymentSignature}>
                <Text>ĐẠI DIỆN</Text>
                <View style={styles.paymentSignatureSpace} />
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`} fixed />
          </>
        ) : document.document_type === 'acceptance_liquidation' ? (
          <>
            <Text style={[styles.national, styles.strong]}>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
            <Text style={[styles.national, styles.strong]}>Độc lập - Tự do - Hạnh phúc</Text>
            <Text style={styles.title}>BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG</Text>

            <View style={styles.acceptanceBody}>
              <View style={styles.acceptanceGroup}>
                {acceptanceContent?.basis_contract ? <Text style={styles.acceptanceParagraph}>{acceptanceContent.basis_contract}</Text> : null}
                {acceptanceContent?.basis_completed ? <Text style={styles.acceptanceParagraph}>{acceptanceContent.basis_completed}</Text> : null}
                {acceptanceContent?.party_intro ? <Text style={styles.acceptanceParagraph}>{acceptanceContent.party_intro}</Text> : null}
              </View>

              <AcceptancePartyBlock title="BÊN A" profile={customer} />
              <Text style={styles.acceptanceParagraph}>Và</Text>
              <AcceptancePartyBlock title="BÊN B" profile={seller} bank={bank} isLast displayName={getProfileLegalName(seller)} />

              {acceptanceContent?.signing_intro ? <Text style={[styles.acceptanceParagraph, styles.acceptanceGroup]}>{acceptanceContent.signing_intro}</Text> : null}
              {acceptanceContent?.articles.map(section => {
                const lines = String(section.body || '').split(/\n+/).filter(Boolean)

                return (
                  <View key={section.id} style={styles.acceptanceGroup}>
                    <Text style={styles.acceptanceSectionTitle}>{section.title}</Text>
                    {lines.map((line, index) => (
                      <BankAwarePdfParagraph
                        key={`${section.id}-${index}`}
                        line={line}
                        style={[styles.acceptanceParagraph, getAcceptanceLineSpacingStyle(line, index, lines)]}
                      />
                    ))}
                    {showAcceptanceAmountTables && section.id === 'acceptance-article-2' ? (
                      <>
                        <PdfAcceptanceAmountTable title="Bảng giá trị theo hợp đồng" rows={acceptanceSummary?.contract_rows || []} totals={acceptanceSummary?.contract_totals || {}} vatConfig={acceptanceSummary?.vat_config || {}} />
                        <PdfAcceptanceAmountTable title="Bảng giá trị nghiệm thu/thực tế" rows={acceptanceSummary?.actual_rows || []} totals={acceptanceSummary?.actual_totals || {}} vatConfig={acceptanceSummary?.vat_config || {}} />
                        {acceptanceContent.cost_difference_note ? <Text style={styles.acceptanceParagraph}>{acceptanceContent.cost_difference_note}</Text> : null}
                      </>
                    ) : null}
                  </View>
                )
              })}
            </View>

            <View style={styles.signatureWrap}>
              <View style={styles.signature}>
                <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN A</Text>
                <Text style={styles.signatureName} />
              </View>
              <View style={styles.signature}>
                <Text style={styles.signatureHeading}>ĐẠI DIỆN BÊN B</Text>
                <Text style={styles.signatureName} />
              </View>
            </View>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Trang ${pageNumber}/${totalPages}`} fixed />
          </>
        ) : (
          <>
        <Text style={styles.national}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Text>
        <Text style={styles.national}>Độc lập - Tự do - Hạnh phúc</Text>
        <Text style={styles.title}>{getDocumentTitle(document)}</Text>
        <Text style={styles.subtitle}>Số: {documentNumber || '-'} | Ngày lập: {issuedDate || '-'}</Text>

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
