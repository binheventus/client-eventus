import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import ContractDocumentDocxDownloadButton from '../components/ContractDocumentDocxDownloadButton'
import ContractDocumentPDFDownloadButton from '../components/ContractDocumentPDFDownloadButton'
import ContractDocumentPreview from '../components/ContractDocumentPreview'
import { getPublicContractDocumentByToken } from '../hooks/useContracts'

export default function ContractDocumentPublicPage() {
  const { share_token: shareToken } = useParams()
  const [document, setDocument] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadDocument() {
      setLoading(true)
      setError('')
      try {
        const data = await getPublicContractDocumentByToken(shareToken)
        if (!mounted) return
        setDocument(data)
        if (!data) setError('Link không hợp lệ hoặc chứng từ chưa được lưu.')
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được chứng từ.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDocument()
    return () => {
      mounted = false
    }
  }, [shareToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[14px] text-slate-500">
        Đang tải chứng từ...
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-slate-900">Không mở được chứng từ</h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">{error || 'Link không hợp lệ hoặc chứng từ chưa được lưu.'}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <ContractDocumentPDFDownloadButton document={document} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-orange-500" />
          <ContractDocumentDocxDownloadButton document={document} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-bold text-white shadow-sm hover:bg-orange-500" />
        </div>
        <ContractDocumentPreview document={document} />
      </div>
    </main>
  )
}
