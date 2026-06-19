import { useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, FileSignature, Search } from 'lucide-react'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import { listContractJobs } from '../hooks/useContracts'
import { formatQuoteCurrency } from '../lib/quoteList'
import {
  getContractRoute,
  getLegacyNewContractRedirect,
  getNewContractRoute,
} from '../lib/contractRouting'

function getInitialSourceMode(search = '') {
  const source = String(new URLSearchParams(search).get('source') || '').trim().toLowerCase()
  if (source === 'manual') return 'manual'
  if (source === 'quote') return 'quote'
  return 'job'
}

const INITIAL_JOB_PAGE_SIZE = 30
const JOB_LOAD_MORE_SIZE = 20

export default function ContractNewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const legacyRedirect = useMemo(
    () => getLegacyNewContractRedirect(new URLSearchParams(location.search)),
    [location.search],
  )
  const [sourceMode, setSourceMode] = useState(() => getInitialSourceMode(location.search))
  const [search, setSearch] = useState('')
  const [jobs, setJobs] = useState([])
  const [jobTotal, setJobTotal] = useState(0)
  const [visibleJobLimit, setVisibleJobLimit] = useState(INITIAL_JOB_PAGE_SIZE)
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSourceMode(getInitialSourceMode(location.search))
  }, [location.search])

  useEffect(() => {
    if (legacyRedirect || sourceMode !== 'job') return
    let mounted = true

    async function loadJobs() {
      setLoadingJobs(true)
      setError('')
      try {
        const result = await listContractJobs({ search, pageSize: visibleJobLimit })
        if (mounted) {
          setJobs(result.jobs || [])
          setJobTotal(Number(result.count || 0))
        }
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
  }, [legacyRedirect, sourceMode, search, visibleJobLimit])

  if (legacyRedirect) return <Navigate replace to={legacyRedirect} />

  const hasMoreJobs = jobs.length < jobTotal

  function handleSearchChange(event) {
    setSearch(event.target.value)
    setVisibleJobLimit(INITIAL_JOB_PAGE_SIZE)
  }

  function handleLoadMoreJobs() {
    setVisibleJobLimit(currentLimit => currentLimit + JOB_LOAD_MORE_SIZE)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-5 lg:px-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <QuoteBreadcrumb items={[{ label: 'Hợp đồng', to: '/contracts' }, { label: 'Tạo hợp đồng mới' }]} />
            <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">Tạo hợp đồng mới</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </button>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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

          <div className="p-5">
            {sourceMode === 'job' ? (
              <div className="space-y-4">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={handleSearchChange}
                    className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-[13px] outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                    placeholder="Tìm theo tên job, khách hàng, địa điểm..."
                    autoFocus
                  />
                </label>
                {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
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
                        {loadingJobs && !jobs.length ? (
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
                                onClick={() => job.contract_id ? navigate(getContractRoute(job)) : navigate(getNewContractRoute({ source: 'job', jobId: job.id }))}
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
                {jobs.length ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[12px] font-medium text-slate-500">
                      Đang hiển thị {jobs.length}/{jobTotal} job phù hợp.
                    </p>
                    {hasMoreJobs ? (
                      <button
                        type="button"
                        onClick={handleLoadMoreJobs}
                        disabled={loadingJobs}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {loadingJobs ? 'Đang tải...' : 'Tải thêm'}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {sourceMode === 'manual' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[14px] font-semibold text-slate-900">Tạo hợp đồng thủ công</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">Form sẽ mở với thông tin trống để bạn nhập khách hàng, lịch triển khai, nội dung dịch vụ và giá trị hợp đồng.</p>
                <button
                  type="button"
                  onClick={() => navigate(getNewContractRoute({ source: 'manual' }))}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white hover:bg-orange-500"
                >
                  <FileSignature className="h-4 w-4" />
                  Tạo thủ công
                </button>
              </div>
            ) : null}

            {sourceMode === 'quote' ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-[14px] font-semibold text-slate-900">Tạo từ báo giá đã có</p>
                <p className="mt-2 text-[13px] leading-6 text-slate-500">Chọn một báo giá đã lưu hoàn thiện trong danh sách báo giá, sau đó bấm “Tạo hợp đồng” ở dòng báo giá hoặc trang chi tiết.</p>
                <button
                  type="button"
                  onClick={() => navigate('/quotes')}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <BriefcaseBusiness className="h-4 w-4" />
                  Mở danh sách báo giá
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
