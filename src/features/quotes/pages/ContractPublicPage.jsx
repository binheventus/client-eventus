import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContractPreviewDocument, PreviewDownloadActions } from '../components/ContractPreviewModal'
import { getPublicContractByToken } from '../hooks/useContracts'

export default function ContractPublicPage() {
  const { share_token: shareToken } = useParams()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadContract() {
      setLoading(true)
      setError('')

      try {
        const data = await getPublicContractByToken(shareToken)
        if (!mounted) return
        setContract(data)
        if (!data) setError('Link không hợp lệ hoặc hợp đồng chưa được lưu.')
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được hợp đồng.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadContract()
    return () => {
      mounted = false
    }
  }, [shareToken])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-[14px] text-slate-500">
        Đang tải hợp đồng...
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
          <h1 className="text-[20px] font-semibold text-slate-900">Không mở được hợp đồng</h1>
          <p className="mt-2 text-[13px] leading-6 text-slate-500">{error || 'Link không hợp lệ hoặc hợp đồng chưa được lưu.'}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <ContractPreviewDocument contract={contract} />
        <PreviewDownloadActions contract={contract} />
      </div>
    </main>
  )
}
