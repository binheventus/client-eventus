import { useState } from 'react'
import { fetchPricingContext } from '../lib/pricingContextClient'

export default function QuotePDFDownloadButton({
  quote,
  items,
  children = 'Download PDF',
  loadingLabel = 'Đang tạo PDF...',
  className = '',
}) {
  const [loading, setLoading] = useState(false)

  async function downloadPdf() {
    if (loading || !quote) return

    setLoading(true)
    try {
      const [{ pdf }, { default: QuotePDFDocument, getQuotePdfFilename }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./QuotePDFDocument'),
      ])
      const pricingContext = await fetchPricingContext()
      const blob = await pdf(
        <QuotePDFDocument
          quote={quote}
          items={items || quote?.items || []}
          legalEntities={pricingContext.legalEntities}
          equipmentRules={pricingContext.equipmentRules}
        />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getQuotePdfFilename(quote)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      disabled={loading || !quote}
      className={className}
    >
      {loading ? loadingLabel : children}
    </button>
  )
}
