import { PDFDownloadLink } from '@react-pdf/renderer'
import QuotePDFDocument, { getQuotePdfFilename } from './QuotePDFDocument'

export default function QuotePDFDownloadButton({
  quote,
  items,
  children = 'Download PDF',
  loadingLabel = 'Đang tạo PDF...',
  className = '',
}) {
  return (
    <PDFDownloadLink
      document={<QuotePDFDocument quote={quote} items={items || quote?.items || []} />}
      fileName={getQuotePdfFilename(quote)}
      className={className}
    >
      {({ loading }) => (loading ? loadingLabel : children)}
    </PDFDownloadLink>
  )
}
