import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, BriefcaseBusiness, FileSignature, Plus, ScrollText, Search, Trash2, X } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import {
  deleteContract,
  getContractById,
  getContractJob,
  listContractJobs,
  listContracts,
} from '../hooks/useContracts'
import { formatQuoteCurrency, formatQuoteDate } from '../lib/quoteList'

const ContractEditorModal = lazy(() => import('../components/ContractEditorModal'))

const SOURCE_LABELS = {
  quote: 'Từ báo giá',
  job: 'Từ job',
  manual: 'Thủ công',
}

const EMPTY_MANUAL_SOURCE = {
  source_type: 'manual',
  quote_snapshot: {
    client_name: '',
    event_name: '',
    event_date: '',
    location: '',
    has_vat: true,
    subtotal: 0,
    travel_fee_total: 0,
    overtime_fee_total: 0,
    vat_amount: 0,
    total_amount: 0,
    items: [
      {
        service_code: 'MANUAL_TOTAL',
        service_name: 'Dịch vụ media theo thỏa thuận',
        unit: 'Gói',
        quantity: 1,
        num_sessions: 1,
        unit_price: 0,
        total_price: 0,
        sort_order: 1,
      },
    ],
  },
  source_snapshot: {
    source_type: 'manual',
  },
  schedule_rows: [
    { time_range: '', date_text: '', location: '' },
  ],
}

const SCHEDULE_CONTRACT_QUERY_KEYS = [
  'sales_brief',
  'customer_code',
  'service_scope',
  'job_title',
  'ekip',
  'start_time',
  'end_time',
  'job_time',
  'job_date',
  'location',
  'contract_value',
]

function compactText(value = '') {
  return String(value || '').trim()
}

function parseContractValue(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function getScheduleQueryParams(params = new URLSearchParams()) {
  const get = key => compactText(params.get(key))
  return {
    source: get('source'),
    jobId: get('job_id'),
    salesBrief: get('sales_brief'),
    customerCode: get('customer_code'),
    serviceScope: get('service_scope'),
    jobTitle: get('job_title'),
    ekip: get('ekip'),
    startTime: get('start_time'),
    endTime: get('end_time'),
    jobTime: get('job_time'),
    jobDate: get('job_date'),
    location: get('location'),
    contractValue: get('contract_value'),
  }
}

function buildJobTime({ jobTime = '', startTime = '', endTime = '' } = {}) {
  if (jobTime) return jobTime
  return [startTime, endTime].filter(Boolean).join(' - ')
}

function buildJobServiceScope(job = {}, { serviceScope = '', salesBrief = '' } = {}) {
  const brief = compactText(serviceScope || salesBrief)
  if (brief) return /^cung cấp\s+/i.test(brief) ? brief : `cung cấp ${brief}`
  return job.job_title ? `cung cấp dịch vụ media cho ${job.job_title}` : 'cung cấp dịch vụ media theo job'
}

function buildJobQuoteSnapshot(job = {}, scheduleParams = {}) {
  const quoteSnapshot = job.quote_snapshot || {}
  const contractValue = parseContractValue(scheduleParams.contractValue)
  const total = contractValue || Number(quoteSnapshot.total_amount || job.price || 0)
  const serviceName = scheduleParams.serviceScope || scheduleParams.jobTitle || quoteSnapshot.items?.[0]?.service_name || job.job_title || 'Dịch vụ media theo job'
  const hasVat = quoteSnapshot.has_vat !== false
  const subtotal = hasVat ? Math.round(total / 1.08) : total
  const vatAmount = hasVat ? total - subtotal : 0

  return {
    ...quoteSnapshot,
    client_name: quoteSnapshot.client_name || job.customer_name || job.customer_snapshot?.company_name || '',
    event_name: scheduleParams.jobTitle || quoteSnapshot.event_name || job.job_title || '',
    event_date: scheduleParams.jobDate || quoteSnapshot.event_date || job.job_date || '',
    location: scheduleParams.location || quoteSnapshot.location || job.location || '',
    has_vat: hasVat,
    subtotal,
    vat_amount: vatAmount,
    total_amount: total,
    items: [{
      service_code: quoteSnapshot.items?.[0]?.service_code || 'JOB_TOTAL',
      service_name: serviceName,
      unit: quoteSnapshot.items?.[0]?.unit || 'Gói',
      quantity: 1,
      num_sessions: 1,
      billable_duration_hours: quoteSnapshot.items?.[0]?.billable_duration_hours || '',
      unit_price: total,
      total_price: total,
      sort_order: 1,
      group_label: quoteSnapshot.items?.[0]?.group_label || '',
    }],
  }
}

function buildJobSourceDraft(job = {}, scheduleParams = {}) {
  const jobTitle = scheduleParams.jobTitle || job.job_title || ''
  const jobTime = buildJobTime(scheduleParams)
  const jobDate = scheduleParams.jobDate || job.date_text || ''
  const location = scheduleParams.location || job.location || ''
  const quoteSnapshot = buildJobQuoteSnapshot(job, scheduleParams)

  return {
    ...job,
    job_title: jobTitle || job.job_title,
    ekip: scheduleParams.ekip || job.ekip,
    time_range: jobTime || job.time_range,
    date_text: jobDate,
    location,
    price: parseContractValue(scheduleParams.contractValue) || job.price,
    source_type: 'job',
    external_job_id: job.id,
    service_scope: buildJobServiceScope({ ...job, job_title: jobTitle }, scheduleParams),
    customer_snapshot: {
      ...(job.customer_snapshot || {}),
      customer_code: scheduleParams.customerCode || job.customer_snapshot?.customer_code || '',
    },
    quote_snapshot: quoteSnapshot,
    schedule_rows: [{
      time_range: jobTime || job.time_range || '',
      date_text: jobDate,
      location,
    }],
    source_snapshot: {
      ...(job.source_snapshot || {}),
      source_type: 'job',
      origin_source: scheduleParams.source || job.source_snapshot?.origin_source || '',
      external_job_id: job.id,
      job_title: jobTitle || job.source_snapshot?.job_title || '',
      date_text: jobDate,
      start_time: scheduleParams.startTime || job.source_snapshot?.start_time || '',
      end_time: scheduleParams.endTime || job.source_snapshot?.end_time || '',
      time_range: jobTime || job.source_snapshot?.time_range || '',
      job_description: scheduleParams.location || job.source_snapshot?.job_description || '',
      location,
      ekip: scheduleParams.ekip || job.source_snapshot?.ekip || '',
      price: parseContractValue(scheduleParams.contractValue) || job.source_snapshot?.price || job.price || 0,
      sales_brief: scheduleParams.salesBrief || job.source_snapshot?.sales_brief || '',
      service_scope: scheduleParams.serviceScope || job.source_snapshot?.service_scope || '',
      customer_snapshot: {
        ...(job.source_snapshot?.customer_snapshot || job.customer_snapshot || {}),
        customer_code: scheduleParams.customerCode || job.source_snapshot?.customer_snapshot?.customer_code || job.customer_snapshot?.customer_code || '',
      },
    },
  }
}

function getContractCustomerName(contract = {}) {
  return contract.customer_snapshot?.company_name ||
    contract.quote_snapshot?.client_name ||
    contract.source_snapshot?.customer_snapshot?.company_name ||
    '-'
}

function getContractEventName(contract = {}) {
  return contract.quote_snapshot?.event_name || contract.source_snapshot?.job_title || '-'
}

function getContractTotal(contract = {}) {
  return Number(contract.quote_snapshot?.total_amount || contract.source_snapshot?.price || 0)
}

function getSourceLabel(contract = {}) {
  return SOURCE_LABELS[contract.source_type] || contract.source_type || '-'
}

function DeleteContractConfirmModal({ contract, deleting, error, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!deleting) onCancel?.()
  })

  if (!contract) return null

  const detailRows = [
    ['Số hợp đồng', contract.contract_number || '-'],
    ['Nguồn', getSourceLabel(contract)],
    ['Khách hàng', getContractCustomerName(contract)],
    ['Sự kiện / job', getContractEventName(contract)],
    ['Giá trị', `${formatQuoteCurrency(getContractTotal(contract))}đ`],
    ['Cập nhật', formatQuoteDate(contract.updated_at || contract.created_at)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Xóa hợp đồng</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Vui lòng kiểm tra lại thông tin hợp đồng trước khi xác nhận xóa.
            </p>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          {detailRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</span>
              <span className="text-[13px] font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-700">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Đang xóa...' : 'Xóa hợp đồng'}
          </button>
        </div>
      </section>
    </div>
  )
}

function NewContractModal({ onClose, onCreateManual, onCreateFromJob }) {
  const navigate = useNavigate()
  const [sourceMode, setSourceMode] = useState('job')
  const [search, setSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sourceMode !== 'job') return
    let mounted = true

    async function loadJobs() {
      setLoadingJobs(true)
      setError('')
      try {
        const result = await listContractJobs({ search, pageSize: 10 })
        if (mounted) setJobs(result.jobs || [])
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được danh sách job.')
      } finally {
        if (mounted) setLoadingJobs(false)
      }
    }

    const timer = window.setTimeout(loadJobs, 250)
    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [sourceMode, search])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Tạo hợp đồng mới</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Đóng">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              ['job', 'Từ job chưa có báo giá'],
              ['manual', 'Tạo thủ công'],
              ['quote', 'Từ báo giá đã có'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSourceMode(value)}
                className={`rounded-lg px-3 py-2 text-[12px] font-semibold ${sourceMode === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {sourceMode === 'job' ? (
            <div className="space-y-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  placeholder="Tìm theo tên job, khách hàng, địa điểm..."
                  autoFocus
                />
              </label>
              {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full min-w-[760px] text-left text-[13px]">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Job</th>
                      <th className="px-4 py-3">Khách hàng</th>
                      <th className="px-4 py-3">Thời gian địa điểm</th>
                      <th className="px-4 py-3 text-right">Giá trị</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loadingJobs ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Đang tải job...</td></tr>
                    ) : jobs.length ? jobs.map(job => (
                      <tr key={job.id} className="hover:bg-orange-50/40">
                        <td className="px-4 py-3 font-semibold text-slate-900">{job.job_title || `JOB${job.id}`}</td>
                        <td className="px-4 py-3 text-slate-700">{job.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="font-semibold">{[job.time_range, job.date_text].filter(Boolean).join(' ngày ') || '-'}</div>
                          <div className="mt-1 line-clamp-2 text-slate-500">{job.location || '-'}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatQuoteCurrency(job.price)}đ</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => job.contract_id ? navigate(`/contracts/${job.contract_id}`) : onCreateFromJob(job.id)}
                            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[12px] font-semibold ${job.contract_id ? 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' : 'bg-[#f8981d] text-white hover:bg-orange-500'}`}
                          >
                            {job.contract_id ? 'Mở hợp đồng' : 'Tạo hợp đồng'}
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Không tìm thấy job phù hợp.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {sourceMode === 'manual' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[14px] font-semibold text-slate-900">Tạo hợp đồng thủ công</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">Form sẽ mở với thông tin trống để bạn nhập khách hàng, lịch triển khai, nội dung dịch vụ và giá trị hợp đồng.</p>
              <button type="button" onClick={onCreateManual} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white hover:bg-orange-500">
                <FileSignature className="h-4 w-4" />
                Tạo thủ công
              </button>
            </div>
          ) : null}

          {sourceMode === 'quote' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[14px] font-semibold text-slate-900">Tạo từ báo giá đã có</p>
              <p className="mt-2 text-[13px] leading-6 text-slate-500">Chọn một báo giá đã lưu hoàn thiện trong danh sách báo giá, sau đó bấm “Tạo hợp đồng” ở dòng báo giá hoặc trang chi tiết.</p>
              <button type="button" onClick={() => navigate('/quotes')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
                <BriefcaseBusiness className="h-4 w-4" />
                Mở danh sách báo giá
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export default function ContractListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id: routeContractId } = useParams()
  const scheduleRequestRef = useRef('')
  const [contracts, setContracts] = useState([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [newModalOpen, setNewModalOpen] = useState(false)
  const [editorState, setEditorState] = useState(null)
  const [contractToDelete, setContractToDelete] = useState(null)
  const [deletingContract, setDeletingContract] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const totalText = useMemo(() => `${formatQuoteCurrency(count)} hợp đồng`, [count])

  async function loadContracts() {
    setLoading(true)
    setError('')
    try {
      const result = await listContracts({ search, sourceType, pageSize: 50 })
      setContracts(result.contracts || [])
      setCount(Number(result.count || 0))
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách hợp đồng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadContracts, 250)
    return () => window.clearTimeout(timer)
  }, [search, sourceType])

  useEffect(() => {
    let mounted = true
    if (!routeContractId) {
      setEditorState(null)
      return
    }

    async function openContract() {
      try {
        const contract = await getContractById(routeContractId)
        if (!mounted) return
        if (contract?.id) {
          setEditorState({
            sourceType: contract.source_type || 'manual',
            sourceDraft: contract,
            contractId: contract.id,
          })
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Không mở được hợp đồng.')
      }
    }

    openContract()
    return () => {
      mounted = false
    }
  }, [routeContractId])

  useEffect(() => {
    if (routeContractId) return

    const params = new URLSearchParams(location.search)
    const scheduleParams = getScheduleQueryParams(params)
    const { source, jobId } = scheduleParams
    if (source !== 'lichlamviec' || !jobId) return

    const requestKey = `${source}:${jobId}`
    if (scheduleRequestRef.current === requestKey) return
    scheduleRequestRef.current = requestKey

    let mounted = true

    async function openScheduleContract() {
      setNewModalOpen(false)
      setError('')

      try {
        const job = await getContractJob(jobId)
        if (!mounted) return

        if (job.contract_id) {
          navigate(`/contracts/${job.contract_id}`)
          return
        }

        setEditorState({
          sourceType: 'job',
          sourceDraft: buildJobSourceDraft(job, scheduleParams),
        })

        if (SCHEDULE_CONTRACT_QUERY_KEYS.some(key => params.has(key))) {
          SCHEDULE_CONTRACT_QUERY_KEYS.forEach(key => params.delete(key))
          const nextSearch = params.toString()
          navigate({
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : '',
          }, { replace: true })
        }
      } catch (err) {
        if (mounted) setError(err?.message || 'Không mở được job từ lịch làm việc.')
      }
    }

    openScheduleContract()
    return () => {
      mounted = false
    }
  }, [location.pathname, location.search, navigate, routeContractId])

  async function createFromJob(jobId) {
    setNewModalOpen(false)
    const job = await getContractJob(jobId)
    if (job.contract_id) {
      navigate(`/contracts/${job.contract_id}`)
      return
    }
    setEditorState({
      sourceType: 'job',
      sourceDraft: buildJobSourceDraft(job),
    })
  }

  function closeEditor() {
    setEditorState(null)
    if (routeContractId) navigate('/contracts', { replace: true })
    loadContracts()
  }

  async function confirmDeleteContract() {
    if (!contractToDelete?.id) return

    setDeletingContract(true)
    setDeleteError('')
    try {
      await deleteContract({ id: contractToDelete.id })
      setContractToDelete(null)
      if (routeContractId === contractToDelete.id) {
        setEditorState(null)
        navigate('/contracts', { replace: true })
      }
      await loadContracts()
    } catch (err) {
      setDeleteError(err?.message || 'Không xóa được hợp đồng.')
    } finally {
      setDeletingContract(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-5 lg:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <QuoteBreadcrumb items={[{ label: 'Hợp đồng' }]} />
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">Hợp đồng</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/contracts/contract-templates')}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ScrollText className="h-4 w-4" />
            Mẫu hợp đồng
          </button>
          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500"
          >
            <Plus className="h-4 w-4" />
            Tạo hợp đồng mới
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
              placeholder="Tìm số hợp đồng, khách hàng, sự kiện..."
            />
          </label>
          <select
            value={sourceType}
            onChange={event => setSourceType(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-3 text-[13px] font-semibold text-slate-700 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
          >
            <option value="">Tất cả nguồn</option>
            <option value="quote">Từ báo giá</option>
            <option value="job">Từ job</option>
            <option value="manual">Thủ công</option>
          </select>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Số hợp đồng</th>
                <th className="px-4 py-3">Nguồn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Sự kiện / job</th>
                <th className="px-4 py-3 text-right">Giá trị</th>
                <th className="px-4 py-3">Cập nhật</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Đang tải hợp đồng...</td></tr>
              ) : contracts.length ? contracts.map(contract => (
                <tr key={contract.id} className="hover:bg-orange-50/40">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/contracts/${contract.id}`)}
                      className="rounded-lg px-1 py-0.5 text-left font-semibold text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                    >
                      {contract.contract_number || '-'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{getSourceLabel(contract)}</td>
                  <td className="px-4 py-3 text-slate-700">{getContractCustomerName(contract)}</td>
                  <td className="px-4 py-3 text-slate-700">{getContractEventName(contract)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatQuoteCurrency(getContractTotal(contract))}đ</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">{formatQuoteDate(contract.updated_at || contract.created_at)}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError('')
                          setContractToDelete(contract)
                        }}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Xóa hợp đồng ${contract.contract_number || contract.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Chưa có hợp đồng.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {newModalOpen ? (
        <NewContractModal
          onClose={() => setNewModalOpen(false)}
          onCreateManual={() => {
            setNewModalOpen(false)
            setEditorState({ sourceType: 'manual', sourceDraft: EMPTY_MANUAL_SOURCE })
          }}
          onCreateFromJob={createFromJob}
        />
      ) : null}

      {editorState ? (
        <Suspense fallback={null}>
          <ContractEditorModal
            open
            sourceType={editorState.sourceType}
            sourceDraft={editorState.sourceDraft}
            contractId={editorState.contractId}
            onClose={closeEditor}
          />
        </Suspense>
      ) : null}

      {contractToDelete ? (
        <DeleteContractConfirmModal
          contract={contractToDelete}
          deleting={deletingContract}
          error={deleteError}
          onCancel={() => {
            setContractToDelete(null)
            setDeleteError('')
          }}
          onConfirm={confirmDeleteContract}
        />
      ) : null}
    </div>
  )
}
