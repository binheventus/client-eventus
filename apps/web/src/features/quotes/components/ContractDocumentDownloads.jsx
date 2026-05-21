import { useState } from 'react'
import { Save } from 'lucide-react'
import ContractPreviewModal from './ContractPreviewModal'

export default function ContractDocumentDownloads({
  contract,
  previewContract,
  disabled = false,
  showShareButton = false,
  previewSavedByName = '',
  className = '',
  buttonClassName = '',
  onBeforePreview,
  buttonLabel = 'Preview',
  loadingLabel = 'Đang lưu...',
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [previewModalContract, setPreviewModalContract] = useState(null)
  const buttonClass = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold shadow-sm transition'
  const disabledClass = 'cursor-not-allowed bg-slate-100 text-slate-400'
  const currentPreviewContract = previewContract || contract
  const buttonDisabled = disabled || previewing || !currentPreviewContract

  async function openPreview() {
    if (buttonDisabled) return

    setPreviewing(true)
    try {
      const nextContract = onBeforePreview ? await onBeforePreview() : currentPreviewContract
      if (!nextContract) return
      setPreviewModalContract(nextContract)
      setPreviewOpen(true)
    } finally {
      setPreviewing(false)
    }
  }

  function closePreview() {
    setPreviewOpen(false)
    setPreviewModalContract(null)
  }

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className}`}>
        <button
          type="button"
          disabled={buttonDisabled}
          onClick={openPreview}
          className={`${buttonClass} ${buttonClassName} ${buttonDisabled ? disabledClass : 'bg-[#f8981d] text-white hover:bg-orange-500'}`}
        >
          <Save className="h-4 w-4" />
          {previewing ? loadingLabel : buttonLabel}
        </button>
      </div>
      {previewOpen && previewModalContract ? (
        <ContractPreviewModal
          contract={previewModalContract}
          showShareButton={showShareButton || Boolean(contract)}
          savedByName={previewSavedByName}
          onClose={closePreview}
        />
      ) : null}
    </>
  )
}
