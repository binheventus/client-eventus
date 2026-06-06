import { useState } from 'react'
import { Download } from 'lucide-react'
import { getContractDocumentValidationWarnings } from '../lib/contractDocumentRender'

function confirmMissingWarnings(warnings = [], fileType = 'PDF') {
  if (!warnings.length) return true
  return window.confirm(`Chứng từ đang thiếu thông tin quan trọng trước khi xuất ${fileType}: ${warnings.join(', ')}. Bạn vẫn muốn tải file?`)
}

export default function ContractDocumentPDFDownloadButton({
  document = {},
  className = '',
  warnBeforeDownload = false,
  children = 'Tải PDF',
  disabled = false,
  ...props
}) {
  const [loading, setLoading] = useState(false)

  async function handleDownload() {
    if (disabled || loading) return
    const warnings = warnBeforeDownload ? getContractDocumentValidationWarnings(document) : []
    if (warnings.length && !confirmMissingWarnings(warnings, 'PDF')) return

    setLoading(true)
    try {
      const [{ pdf }, { default: ContractDocumentPDFDocument, getContractDocumentPdfFilename }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ContractDocumentPDFDocument'),
      ])
      const blob = await pdf(<ContractDocumentPDFDocument document={document} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = getContractDocumentPdfFilename(document)
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      window.alert(err?.message || 'Không tạo được PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={handleDownload} disabled={disabled || loading} className={className || 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-orange-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400'} {...props}>
      <Download className="h-4 w-4" />
      {loading ? 'Đang tạo PDF...' : children}
    </button>
  )
}

export { confirmMissingWarnings }
