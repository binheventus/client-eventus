import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import ContractEditorModal from '../components/ContractEditorModal'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import { getContractById, getContractJob } from '../hooks/useContracts'
import { getQuote } from '../hooks/useQuotes'
import {
  buildJobSourceDraft,
  EMPTY_MANUAL_CONTRACT_SOURCE,
  getContractRoute,
  getScheduleQueryParams,
} from '../lib/contractRouting'

function normalizeSourceType(source = '') {
  const normalized = String(source || '').trim().toLowerCase()
  if (normalized === 'job' || normalized === 'lichlamviec') return 'job'
  if (normalized === 'quote') return 'quote'
  return 'manual'
}

function PageState({ type = 'loading', title, message, onBack }) {
  const isError = type === 'error'

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <QuoteBreadcrumb items={[{ label: 'Hợp đồng', to: '/contracts' }, { label: title }]} />
            <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">{title}</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
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

export default function ContractEditorPage() {
  const { id: routeContractId, jobId: routeJobId, quoteId: routeQuoteId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const routeSourceType = routeQuoteId ? 'quote' : routeJobId ? 'job' : location.pathname === '/contracts/new/manual' ? 'manual' : ''
  const queryScheduleParams = useMemo(() => getScheduleQueryParams(new URLSearchParams(location.search)), [location.search])
  const scheduleParams = useMemo(() => ({
    ...queryScheduleParams,
    source: routeSourceType || queryScheduleParams.source,
    jobId: routeJobId || queryScheduleParams.jobId,
    quoteId: routeQuoteId || queryScheduleParams.quoteId,
  }), [queryScheduleParams, routeSourceType, routeJobId, routeQuoteId])
  const [editorConfig, setEditorConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function backToContracts() {
    navigate('/contracts')
  }

  function replaceUrlWithSavedContract(contract = {}) {
    if (!contract?.id) return

    const nextPath = `/contracts/${encodeURIComponent(contract.id)}`
    if (location.pathname !== nextPath) {
      navigate(nextPath, { replace: true })
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadEditorContext() {
      setLoading(true)
      setError('')
      setEditorConfig(null)

      try {
        if (routeContractId) {
          const contract = await getContractById(routeContractId)
          if (!mounted) return
          if (!contract?.id) throw new Error('Không tìm thấy hợp đồng.')

          setEditorConfig({
            sourceType: contract.source_type || 'manual',
            sourceDraft: contract,
            contractId: contract.id,
            initialContract: contract,
            quote: null,
          })
          return
        }

        const sourceType = normalizeSourceType(scheduleParams.source)

        if (sourceType === 'quote') {
          if (!scheduleParams.quoteId) throw new Error('Thiếu quote id để tạo hợp đồng.')

          const quote = await getQuote(scheduleParams.quoteId)
          if (!mounted) return
          if (!quote?.id) throw new Error('Không tìm thấy báo giá.')

          if (quote.contract_id) {
            navigate(`/contracts/${encodeURIComponent(quote.contract_id)}`, { replace: true })
            return
          }

          setEditorConfig({
            sourceType: 'quote',
            sourceDraft: null,
            contractId: '',
            initialContract: null,
            quote,
          })
          return
        }

        if (sourceType === 'job') {
          if (!scheduleParams.jobId) throw new Error('Thiếu job id để tạo hợp đồng.')

          const job = await getContractJob(scheduleParams.jobId)
          if (!mounted) return
          if (!job?.id) throw new Error('Không tìm thấy job.')

          if (job.contract_id) {
            navigate(getContractRoute(job), { replace: true })
            return
          }

          setEditorConfig({
            sourceType: 'job',
            sourceDraft: buildJobSourceDraft(job, scheduleParams),
            contractId: '',
            initialContract: null,
            quote: null,
          })
          return
        }

        if (!mounted) return
        setEditorConfig({
          sourceType: 'manual',
          sourceDraft: EMPTY_MANUAL_CONTRACT_SOURCE,
          contractId: '',
          initialContract: null,
          quote: null,
        })
      } catch (err) {
        if (mounted) setError(err?.message || 'Không mở được hợp đồng.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadEditorContext()
    return () => {
      mounted = false
    }
  }, [routeContractId, scheduleParams, navigate])

  if (loading) {
    return (
      <PageState
        title="Đang tải hợp đồng"
        message="Đang tải dữ liệu hợp đồng..."
        onBack={backToContracts}
      />
    )
  }

  if (error || !editorConfig) {
    return (
      <PageState
        type="error"
        title="Không mở được hợp đồng"
        message={error || 'Không mở được dữ liệu hợp đồng.'}
        onBack={backToContracts}
      />
    )
  }

  return (
    <ContractEditorModal
      open
      variant="page"
      quote={editorConfig.quote}
      sourceType={editorConfig.sourceType}
      sourceDraft={editorConfig.sourceDraft}
      contractId={editorConfig.contractId}
      initialContract={editorConfig.initialContract}
      onClose={backToContracts}
      onSaved={replaceUrlWithSavedContract}
      onDeleted={() => navigate('/contracts', { replace: true })}
    />
  )
}
