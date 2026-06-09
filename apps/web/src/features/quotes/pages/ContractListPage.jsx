import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, FileText, Plus, Search, Trash2 } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import {
  deleteContract,
  listContracts,
} from '../hooks/useContracts'
import { formatQuoteCurrency, formatQuoteDate } from '../lib/quoteList'
import { getContractRoute, getNewContractRoute } from '../lib/contractRouting'

const SOURCE_LABELS = {
  quote: 'Từ báo giá',
  job: 'Từ job',
  manual: 'Thủ công',
}

function getContractCustomerName(contract = {}) {
  return contract.customer_snapshot?.company_name ||
    contract.quote_snapshot?.client_name ||
    contract.source_snapshot?.customer_snapshot?.company_name ||
    '-'
}

function getContractEventName(contract = {}) {
  return contract.source_snapshot?.job_title || '-'
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
    ['Job', getContractEventName(contract)],
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

export default function ContractListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [contracts, setContracts] = useState([])
  const [count, setCount] = useState(0)
  const [search, setSearch] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [contractToDelete, setContractToDelete] = useState(null)
  const [deletingContract, setDeletingContract] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
    const params = new URLSearchParams(location.search)
    const source = params.get('source')
    const jobId = params.get('job_id') || params.get('jobId')
    if (!source) return

    if (source === 'lichlamviec' && jobId) {
      params.set('source', 'job')
      params.set('origin_source', 'lichlamviec')
      params.set('jobId', jobId)
      params.delete('job_id')
    }

    navigate(getNewContractRoute(params), { replace: true })
  }, [location.search, navigate])

  async function confirmDeleteContract() {
    if (!contractToDelete?.id) return

    setDeletingContract(true)
    setDeleteError('')
    try {
      await deleteContract({ id: contractToDelete.id })
      setContractToDelete(null)
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
            onClick={() => navigate('/contracts/templates/contract')}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            Mẫu tài liệu
          </button>
          <button
            type="button"
            onClick={() => navigate('/contracts/new')}
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
                <th className="px-4 py-3">Job</th>
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
                      onClick={() => navigate(getContractRoute(contract))}
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
