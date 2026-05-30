import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import ContractDocumentsPanel from '../components/ContractDocumentsPanel'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import { getContractById } from '../hooks/useContracts'
import { getContractDocumentsRoute, getContractRoute } from '../lib/contractRouting'

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

export default function ContractDocumentsPage() {
  const { contractId = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const notice = location.state?.notice || ''

  useEffect(() => {
    let mounted = true

    async function loadContract() {
      setLoading(true)
      setError('')
      try {
        const data = await getContractById(contractId)
        if (!mounted) return
        if (!data?.id) throw new Error('Không tìm thấy hợp đồng.')
        setContract(data)
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
  }, [contractId])

  function backToContract() {
    navigate(contract ? getContractRoute(contract) : '/contracts')
  }

  if (loading) {
    return <PageState title="Đang tải chứng từ" message="Đang tải dữ liệu hợp đồng..." onBack={backToContract} />
  }

  if (error || !contract) {
    return <PageState type="error" title="Không mở được chứng từ" message={error || 'Không mở được dữ liệu hợp đồng.'} onBack={backToContract} />
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <QuoteBreadcrumb
              root={{ label: 'Hợp đồng', to: '/contracts' }}
              items={[
                { label: contract.contract_number || 'Chi tiết hợp đồng', to: getContractRoute(contract) },
                { label: 'Chứng từ' },
              ]}
            />
            <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">Chứng từ hợp đồng</h1>
          </div>
          <button type="button" onClick={backToContract} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Hợp đồng
          </button>
        </div>

        {notice ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{notice}</p> : null}
        <ContractDocumentsPanel contract={contract} key={getContractDocumentsRoute(contract)} />
      </div>
    </div>
  )
}
