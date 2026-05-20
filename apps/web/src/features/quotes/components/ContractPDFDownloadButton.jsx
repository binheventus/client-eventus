import { useState } from 'react'
import { Download } from 'lucide-react'

export default function ContractPDFDownloadButton({ contract = {}, className = '' }) {
  const [loading, setLoading] = useState(false)

  async function downloadPdf() {
    if (loading || !contract?.id) return

    setLoading(true)
    try {
      const [{ pdf }, { default: ContractPDFDocument, getContractPdfFilename }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ContractPDFDocument'),
      ])
      const blob = await pdf(<ContractPDFDocument contract={contract} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getContractPdfFilename(contract)
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
      disabled={loading || !contract?.id}
      className={className}
    >
      <Download className="h-4 w-4" />
      {loading ? 'Đang tạo PDF...' : 'Tải PDF'}
    </button>
  )
}
