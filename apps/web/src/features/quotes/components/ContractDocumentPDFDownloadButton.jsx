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
  ...props
}) {
  async function handleDownload() {
    const warnings = warnBeforeDownload ? getContractDocumentValidationWarnings(document) : []
    if (warnings.length && !confirmMissingWarnings(warnings, 'PDF')) return

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
  }

  return (
    <button type="button" onClick={handleDownload} className={className || 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-orange-500'} {...props}>
      <Download className="h-4 w-4" />
      {children}
    </button>
  )
}

export { confirmMissingWarnings }
