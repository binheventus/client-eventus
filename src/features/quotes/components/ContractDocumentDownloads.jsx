import { PDFDownloadLink } from '@react-pdf/renderer'
import { Download, FileText } from 'lucide-react'
import ContractPDFDocument, { getContractPdfFilename } from './ContractPDFDocument'
import { downloadContractDocx } from '../lib/contractDocx'

export default function ContractDocumentDownloads({
  contract,
  disabled = false,
}) {
  const buttonClass = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition'
  const disabledClass = 'cursor-not-allowed bg-slate-100 text-slate-400'

  if (disabled || !contract) {
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled className={`${buttonClass} ${disabledClass}`}>
          <Download className="h-4 w-4" />
          Tải PDF
        </button>
        <button type="button" disabled className={`${buttonClass} ${disabledClass}`}>
          <FileText className="h-4 w-4" />
          Tải DOCX
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <PDFDownloadLink
        document={<ContractPDFDocument contract={contract} />}
        fileName={getContractPdfFilename(contract)}
        className={`${buttonClass} bg-slate-900 text-white hover:bg-slate-800`}
      >
        {({ loading }) => (
          <>
            <Download className="h-4 w-4" />
            {loading ? 'Đang tạo PDF...' : 'Tải PDF'}
          </>
        )}
      </PDFDownloadLink>
      <button
        type="button"
        onClick={() => downloadContractDocx(contract)}
        className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
      >
        <FileText className="h-4 w-4" />
        Tải DOCX
      </button>
    </div>
  )
}
