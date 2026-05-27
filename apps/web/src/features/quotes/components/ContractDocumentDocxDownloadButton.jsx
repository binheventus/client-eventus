import { FileText } from 'lucide-react'
import { getContractDocumentValidationWarnings } from '../lib/contractDocumentRender'
import { confirmMissingWarnings } from './ContractDocumentPDFDownloadButton'

export default function ContractDocumentDocxDownloadButton({
  document = {},
  className = '',
  warnBeforeDownload = false,
  children = 'Tải DOCX',
  ...props
}) {
  async function handleDownload() {
    const warnings = warnBeforeDownload ? getContractDocumentValidationWarnings(document) : []
    if (warnings.length && !confirmMissingWarnings(warnings, 'DOCX')) return

    const { downloadContractDocumentDocx } = await import('../lib/contractDocumentDocx')
    downloadContractDocumentDocx(document)
  }

  return (
    <button type="button" onClick={handleDownload} className={className || 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-orange-500'} {...props}>
      <FileText className="h-4 w-4" />
      {children}
    </button>
  )
}
