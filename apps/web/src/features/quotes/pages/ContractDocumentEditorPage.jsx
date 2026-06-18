import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Copy, Trash2 } from 'lucide-react'
import {
  buildDocumentPayload,
  ContractDocumentEditorForm,
  DeleteDocumentConfirmModal,
} from '../components/ContractDocumentsPanel'
import ContractEntityMismatchPopup from '../components/ContractEntityMismatchPopup'
import ContractDocumentDocxDownloadButton from '../components/ContractDocumentDocxDownloadButton'
import ContractDocumentPDFDownloadButton from '../components/ContractDocumentPDFDownloadButton'
import ContractDocumentPreview from '../components/ContractDocumentPreview'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import {
  getContractById,
  getContractDocument,
  deleteContractDocument,
  listContractDocumentTemplates,
  listContractDocuments,
  listQuoteContractDocuments,
  saveContractDocument,
} from '../hooks/useContracts'
import { getQuote } from '../hooks/useQuotes'
import { buildQuoteBackedContractSnapshot } from '../lib/contractDefaults'
import { CONTRACT_DOCUMENT_TYPES as DOCUMENT_TYPES } from '../lib/contractDocumentTemplates'
import {
  getContractDocumentsRoute,
  getContractRoute,
} from '../lib/contractRouting'

function PageState({ type = 'loading', title, message, onBack }) {
  const isError = type === 'error'

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <QuoteBreadcrumb root={{ label: 'Hợp đồng', to: '/contracts' }} items={[{ label: title }]} />
            <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{title}</h1>
          </div>
          <button type="button" onClick={onBack} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
        </div>

        <section className={`rounded-2xl border p-5 shadow-sm ${isError ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}>
          <div className="flex items-start gap-3">
            {isError ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /> : null}
            <p className="text-[13px] font-semibold">{message}</p>
          </div>
        </section>
      </div>
    </div>
  )
}

function validateDocumentDraft(draft = {}) {
  if (!draft.contract_id && !draft.quote_id) return 'Cần có hợp đồng hoặc báo giá trước khi tạo chứng từ.'
  if (!draft.contract_id && draft.quote_id && draft.document_type !== 'acceptance_liquidation') {
    return 'Chỉ BBNT được tạo trực tiếp từ báo giá.'
  }
  if (!String(draft.title || '').trim()) return 'Cần nhập tiêu đề chứng từ.'
  if (draft.document_type === 'payment_request' && !draft.form_data?.acceptance_document_id) {
    return 'Đề nghị thanh toán cần liên kết với một BBNT.'
  }
  return ''
}

function getPublicDocumentUrl(document = {}) {
  if (!document.share_token || typeof window === 'undefined') return ''
  return `${window.location.origin}/d/${encodeURIComponent(document.share_token)}`
}

async function copyTextToClipboard(text) {
  if (!text || typeof window === 'undefined') return false
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the textarea copy fallback.
    }
  }

  const textarea = window.document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  window.document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let copied = false
  try {
    copied = window.document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    window.document.body.removeChild(textarea)
  }
  return copied
}

export default function ContractDocumentEditorPage() {
  const { contractId = '', quoteId = '', documentType = '', documentId = '' } = useParams()
  const navigate = useNavigate()
  const isEditMode = Boolean(documentId)
  const invalidNewDocumentType = !isEditMode && Boolean(documentType) && !DOCUMENT_TYPES[documentType]
  const [contract, setContract] = useState(null)
  const [documents, setDocuments] = useState([])
  const [templates, setTemplates] = useState([])
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)
  const shareCopiedTimerRef = useRef(null)
  const formKey = useMemo(
    () => [contract?.id || contract?.quote_id || contractId || quoteId, document?.id || 'new', document?.document_type || documentType || '', document?.updated_at || ''].join(':'),
    [contract?.id, contract?.quote_id, contractId, quoteId, document?.id, document?.document_type, document?.updated_at, documentType],
  )

  useEffect(() => {
    if (invalidNewDocumentType) return

    let mounted = true

    async function loadEditorContext() {
      setLoading(true)
      setError('')
      setFormError('')
      setContract(null)
      setDocument(null)

      try {
        let documentData = null
        let resolvedContractId = contractId

        if (isEditMode) {
          documentData = await getContractDocument(documentId)
          if (!documentData?.id) throw new Error('Không tìm thấy chứng từ.')
          if (contractId && documentData.contract_id && String(documentData.contract_id) !== String(contractId)) {
            throw new Error('Chứng từ không thuộc hợp đồng này.')
          }
          if (quoteId && documentData.quote_id && String(documentData.quote_id) !== String(quoteId)) {
            throw new Error('Chứng từ không thuộc báo giá này.')
          }
          resolvedContractId = documentData.contract_id || contractId
        }

        if (!resolvedContractId && !quoteId && !documentData?.quote_id) throw new Error('Không tìm thấy hợp đồng hoặc báo giá của chứng từ.')

        if (!resolvedContractId) {
          const resolvedQuoteId = documentData?.quote_id || quoteId
          if ((documentData?.document_type || documentType) !== 'acceptance_liquidation') {
            throw new Error('Chỉ BBNT được tạo trực tiếp từ báo giá.')
          }

          const quoteData = await getQuote(resolvedQuoteId)
          if (!quoteData?.id) throw new Error('Không tìm thấy báo giá.')
          const quoteDocumentRows = await listQuoteContractDocuments(resolvedQuoteId, { documentType: 'acceptance_liquidation' })
          const templateRows = await listContractDocumentTemplates()

          if (!mounted) return
          setContract(buildQuoteBackedContractSnapshot(quoteData))
          setDocuments(quoteDocumentRows || [])
          setTemplates(templateRows || [])
          setDocument(documentData || null)
          return
        }

        const [contractData, documentRows, templateRows] = await Promise.all([
          getContractById(resolvedContractId),
          listContractDocuments(resolvedContractId),
          listContractDocumentTemplates(),
        ])

        if (!mounted) return
        if (!contractData?.id) throw new Error('Không tìm thấy hợp đồng.')

        setContract(contractData)
        setDocuments(documentRows || [])
        setTemplates(templateRows || [])
        setDocument(documentData || null)
      } catch (err) {
        if (mounted) setError(err?.message || 'Không mở được chứng từ.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadEditorContext()
    return () => {
      mounted = false
    }
  }, [contractId, documentId, documentType, invalidNewDocumentType, isEditMode, quoteId])

  useEffect(() => () => {
    if (shareCopiedTimerRef.current) window.clearTimeout(shareCopiedTimerRef.current)
  }, [])

  function backToDocuments() {
    if (contract?.id || contractId) {
      navigate(contract ? getContractDocumentsRoute(contract) : getContractDocumentsRoute(contractId))
      return
    }
    if (contract?.quote_id || quoteId) {
      navigate(`/quotes/${encodeURIComponent(contract?.quote_id || quoteId)}`)
      return
    }
    navigate('/contracts')
  }

  async function handleSaveDocument(draft) {
    const validationError = validateDocumentDraft(draft)
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      const saved = await saveContractDocument(buildDocumentPayload(draft, templates, documents))
      setDocument(saved || null)
      setDocuments(prev => {
        if (!saved?.id) return prev
        return prev.some(row => row.id === saved.id)
          ? prev.map(row => row.id === saved.id ? saved : row)
          : [saved, ...prev]
      })
      setPreviewDocument(saved || null)
    } catch (err) {
      setFormError(err?.message || 'Không lưu được chứng từ.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyPublicDocumentLink() {
    const url = getPublicDocumentUrl(previewDocument || document || {})
    if (!url) return
    const copied = await copyTextToClipboard(url)
    if (!copied) {
      setFormError('Không copy tự động được, bạn có thể mở link public từ danh sách chứng từ.')
      return
    }
    setShareCopied(true)
    if (shareCopiedTimerRef.current) window.clearTimeout(shareCopiedTimerRef.current)
    shareCopiedTimerRef.current = window.setTimeout(() => {
      setShareCopied(false)
      shareCopiedTimerRef.current = null
    }, 2400)
  }

  async function handleDeleteDocument() {
    if (!document?.id) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteContractDocument(document.id)
      setDeleteConfirmOpen(false)
      if (contract?.id) {
        navigate(getContractDocumentsRoute(contract), { replace: true })
      } else {
        navigate(`/quotes/${encodeURIComponent(contract?.quote_id || quoteId)}`, { replace: true })
      }
    } catch (err) {
      setDeleteError(err?.message || 'Không xóa được chứng từ.')
      setDeleting(false)
    }
  }

  if (invalidNewDocumentType) {
    return <Navigate replace to={quoteId ? `/quotes/${encodeURIComponent(quoteId)}` : getContractDocumentsRoute(contractId)} />
  }

  if (loading) {
    return <PageState title="Đang tải chứng từ" message="Đang tải dữ liệu chứng từ..." onBack={backToDocuments} />
  }

  if (error || !contract) {
    return <PageState type="error" title="Không mở được chứng từ" message={error || 'Không mở được dữ liệu chứng từ.'} onBack={backToDocuments} />
  }

  const activeDocumentType = document?.document_type || documentType || 'advance_request'
  const pageLabel = isEditMode ? 'Sửa chứng từ' : DOCUMENT_TYPES[activeDocumentType]?.actionLabel || 'Tạo chứng từ'
  const canDownloadPreview = Boolean(previewDocument)
  const publicDocumentUrl = getPublicDocumentUrl(previewDocument || document || {})
  const canDeleteDocument = Boolean(document?.id)
  const isQuoteBoundDocument = Boolean(!contract.id && (contract.quote_id || quoteId))
  const breadcrumbRoot = isQuoteBoundDocument
    ? { label: 'Báo giá', to: `/quotes/${encodeURIComponent(contract.quote_id || quoteId)}` }
    : { label: 'Hợp đồng', to: '/contracts' }
  const breadcrumbItems = isQuoteBoundDocument
    ? [
        { label: contract.quote_number || contract.quote_snapshot?.quote_number || 'Chi tiết báo giá', to: `/quotes/${encodeURIComponent(contract.quote_id || quoteId)}` },
        { label: pageLabel },
      ]
    : [
        { label: contract.contract_number || 'Chi tiết hợp đồng', to: getContractRoute(contract) },
        { label: 'Chứng từ', to: getContractDocumentsRoute(contract) },
        { label: pageLabel },
      ]

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <ContractEntityMismatchPopup
        contract={contract}
        documents={documents}
        currentDocument={previewDocument || document}
      />
      <div className="mx-auto max-w-[1700px] space-y-5">
        <QuoteBreadcrumb
          root={breadcrumbRoot}
          items={breadcrumbItems}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(560px,1.08fr)]">
          <ContractDocumentEditorForm
            key={formKey}
            contract={contract}
            documents={documents}
            templates={templates}
            document={document}
            documentType={activeDocumentType}
            saving={saving}
            error={formError}
            onCancel={backToDocuments}
            onSave={handleSaveDocument}
            onDraftChange={draft => {
              const payload = buildDocumentPayload(draft, templates, documents)
              setPreviewDocument({
                ...payload,
                id: draft.id || document?.id || '',
                document_number: draft.document_number || document?.document_number || '',
                contract_snapshot: draft.contract_source || contract || {},
                created_at: document?.created_at || new Date().toISOString(),
                updated_at: document?.updated_at || new Date().toISOString(),
              })
            }}
            footerActions={(
              <>
                <button
                  type="button"
                  onClick={handleCopyPublicDocumentLink}
                  disabled={!publicDocumentUrl}
                  aria-label="Copy link gửi khách hàng"
                  title="Copy link gửi khách hàng"
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold shadow-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
                    shareCopied
                      ? 'bg-slate-600 text-white hover:bg-slate-600'
                      : 'bg-[#f8981d] text-white hover:bg-orange-500'
                  }`}
                >
                  {shareCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {shareCopied ? 'Đã copy' : 'Copy link'}
                </button>
                <ContractDocumentPDFDownloadButton
                  document={previewDocument || {}}
                  warnBeforeDownload
                  disabled={!canDownloadPreview}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <ContractDocumentDocxDownloadButton
                  document={previewDocument || {}}
                  warnBeforeDownload
                  disabled={!canDownloadPreview}
                  className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                {canDeleteDocument ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('')
                      setDeleteConfirmOpen(true)
                    }}
                    disabled={saving || deleting}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Xóa chứng từ"
                    title="Xóa chứng từ"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </>
            )}
          />

          <aside className="min-w-0 xl:sticky xl:top-5 xl:self-start">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="max-h-[calc(100vh-96px)] min-h-[760px] overflow-auto bg-slate-100 p-4">
                {previewDocument ? (
                  <ContractDocumentPreview document={previewDocument} />
                ) : (
                  <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-[13px] font-semibold text-slate-400">
                    Đang dựng preview...
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {deleteConfirmOpen ? (
        <DeleteDocumentConfirmModal
          document={document}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return
            setDeleteConfirmOpen(false)
            setDeleteError('')
          }}
          onConfirm={handleDeleteDocument}
        />
      ) : null}
    </div>
  )
}
