import { useState } from 'react'
import { Eye } from 'lucide-react'
import ContractPreviewModal from './ContractPreviewModal'

export default function ContractDocumentDownloads({
  contract,
  previewContract,
  disabled = false,
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const buttonClass = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition'
  const disabledClass = 'cursor-not-allowed bg-slate-100 text-slate-400'
  const currentPreviewContract = previewContract || contract

  if (disabled || !contract) {
    return (
      <>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!currentPreviewContract}
            onClick={() => setPreviewOpen(true)}
            className={`${buttonClass} ${currentPreviewContract ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : disabledClass}`}
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
        </div>
        {previewOpen && currentPreviewContract ? <ContractPreviewModal contract={currentPreviewContract} showShareButton={false} onClose={() => setPreviewOpen(false)} /> : null}
      </>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className={`${buttonClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Eye className="h-4 w-4" />
          Preview
        </button>
      </div>
      {previewOpen && currentPreviewContract ? <ContractPreviewModal contract={currentPreviewContract} showShareButton onClose={() => setPreviewOpen(false)} /> : null}
    </>
  )
}
