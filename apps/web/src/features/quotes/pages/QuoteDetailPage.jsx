import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FileSignature } from 'lucide-react'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import QuotePreview from '../components/QuotePreview'
import {
  getQuote,
  getQuoteAuditLogs,
  getQuoteViewStats,
} from '../hooks/useQuotes'
import { useLegalEntities } from '../hooks/useLegalEntities'
import { canCreateContractFromQuote } from '../lib/contractDefaults'
import { canOpenContractFromQuote, hasSavedContract } from '../lib/quoteList'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'

const QuotePDFDownloadButton = lazy(() => import('../components/QuotePDFDownloadButton'))
const ContractEditorModal = lazy(() => import('../components/ContractEditorModal'))

const DETAIL_ACTION_BUTTON_BASE = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-center text-[13px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed'
const DETAIL_SECONDARY_ACTION_BUTTON = `${DETAIL_ACTION_BUTTON_BASE} w-[156px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200`
const DETAIL_CONTRACT_ACTION_BUTTON = `${DETAIL_ACTION_BUTTON_BASE} min-w-[156px] whitespace-nowrap border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 focus-visible:ring-orange-200 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:shadow-none`
const DETAIL_PRIMARY_ACTION_BUTTON = `${DETAIL_ACTION_BUTTON_BASE} min-w-[184px] whitespace-nowrap bg-[#f8981d] text-white hover:bg-orange-500 focus-visible:ring-orange-200`

function formatDateTime(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('vi-VN')
}

function relativeTime(value) {
  if (!value) return 'chưa có lượt xem'
  const diffMs = Date.now() - new Date(value).getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'vừa xong'
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function getValidUntil(quote) {
  if (!quote) return null
  if (quote.valid_until) return new Date(quote.valid_until)
  if (!quote.created_at) return null
  const days = normalizeQuoteValidityDays(quote.validity_days)
  const date = new Date(quote.created_at)
  date.setDate(date.getDate() + days)
  return date
}

export default function QuoteDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { legalEntities } = useLegalEntities()
  const [quote, setQuote] = useState(null)
  const [viewStats, setViewStats] = useState({ count: 0, lastViewedAt: null })
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showContractModal, setShowContractModal] = useState(false)

  const validUntil = useMemo(() => getValidUntil(quote), [quote])
  const contractRequested = useMemo(() => new URLSearchParams(location.search).get('contract') === '1', [location.search])
  const expired = validUntil ? validUntil.getTime() < Date.now() : false
  const canCreateContract = canCreateContractFromQuote(quote)
  const canOpenContract = canOpenContractFromQuote(quote)
  const hasContract = hasSavedContract(quote)
  const contractActionLabel = hasContract ? 'Xem hợp đồng đã tạo' : 'Tạo hợp đồng'
  const contractActionTitle = hasContract
    ? 'Xem hoặc sửa hợp đồng đã tạo'
    : canCreateContract ? 'Tạo hoặc sửa hợp đồng' : 'Báo giá nháp chưa tạo được hợp đồng'

  async function loadDetail() {
    setLoading(true)
    setError('')
    try {
      const [quoteData, statsData, auditData] = await Promise.all([
        getQuote(id),
        getQuoteViewStats(id).catch(() => ({ count: 0, lastViewedAt: null })),
        getQuoteAuditLogs(id).catch(() => []),
      ])
      setQuote(quoteData)
      setViewStats(statsData)
      setAuditLogs(auditData)
    } catch (err) {
      setError(err?.message || 'Không tải được báo giá.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  useEffect(() => {
    if (!quote) return
    setShowContractModal(contractRequested && canOpenContractFromQuote(quote))
  }, [contractRequested, quote])

  function openContractModal() {
    if (!canOpenContract) return
    const params = new URLSearchParams(location.search)
    params.set('contract', '1')
    navigate(`/quotes/${id}?${params.toString()}`)
  }

  function closeContractModal() {
    const params = new URLSearchParams(location.search)
    params.delete('contract')
    const nextSearch = params.toString()
    navigate(`/quotes/${id}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true })
    setShowContractModal(false)
  }

  async function copyShareLink() {
    if (!quote?.share_token) return
    await navigator.clipboard?.writeText(`${window.location.origin}/q/${quote.share_token}`)
  }

  if (loading) return <div className="p-6 text-slate-500">Đang tải báo giá...</div>
  if (error) return <div className="rounded-xl bg-red-50 p-4 text-[13px] text-red-700">{error}</div>
  if (!quote) return <div className="p-6 text-slate-500">Không tìm thấy báo giá.</div>

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <QuoteBreadcrumb items={[{ label: quote.quote_number || quote.event_name || 'Chi tiết báo giá' }]} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/quotes/${id}?mode=edit`)}
            className={DETAIL_SECONDARY_ACTION_BUTTON}
          >
            Sửa báo giá
          </button>
          <button
            type="button"
            disabled={!canOpenContract}
            onClick={openContractModal}
            title={contractActionTitle}
            className={DETAIL_CONTRACT_ACTION_BUTTON}
          >
            <FileSignature className="h-4 w-4" />
            {contractActionLabel}
          </button>
          <button
            type="button"
            onClick={copyShareLink}
            className={DETAIL_PRIMARY_ACTION_BUTTON}
          >
            Copy link gửi khách
          </button>
          <Suspense fallback={<span className={DETAIL_SECONDARY_ACTION_BUTTON}>Đang tải PDF...</span>}>
            <QuotePDFDownloadButton
              quote={quote}
              items={quote.items || []}
              className={DETAIL_SECONDARY_ACTION_BUTTON}
            >
              Download PDF
            </QuotePDFDownloadButton>
          </Suspense>
        </div>
      </div>

      {expired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
          Báo giá đã hết hạn từ {formatDateTime(validUntil)}.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-slate-900">Thông tin báo giá</h2>
            <dl className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2">
              {[
                ['Mã báo giá', quote.quote_number || '-'],
                ['Tên sự kiện', quote.event_name || 'Chưa có tên sự kiện'],
                ['Khách hàng', quote.client_name || quote.customer_name || quote.client_id || '-'],
                ['Pháp nhân', quote.entity_code || '-'],
                ['Tier', quote.tier_code || '-'],
                ['Địa điểm', quote.location || '-'],
                ['Thời lượng', quote.duration_hours ? `${quote.duration_hours} giờ` : '-'],
                ['Hiệu lực đến', validUntil ? formatDateTime(validUntil) : '-'],
                ['Trạng thái', quote.status || '-'],
                ['Ngày tạo', formatDateTime(quote.created_at)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{label}</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-slate-900">Tracking khách hàng</h2>
            <p className="mt-3 text-[14px] text-slate-700">
              Khách đã xem <span className="font-bold text-slate-950">{viewStats.count}</span> lần, lần cuối: <span className="font-semibold">{relativeTime(viewStats.lastViewedAt)}</span>
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-slate-900">Audit log</h2>
            <div className="mt-4 space-y-3">
              {auditLogs.length ? auditLogs.map(log => (
                <div key={log.id} className="rounded-xl bg-slate-50 px-4 py-3 text-[13px]">
                  <div className="font-semibold text-slate-800">{log.action || log.event || 'Thay đổi'}</div>
                  <div className="mt-1 text-slate-500">{log.description || log.reason || log.message || JSON.stringify(log.changes || log.metadata || {})}</div>
                  <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(log.created_at)}</div>
                </div>
              )) : <p className="text-[13px] text-slate-400">Chưa có audit log.</p>}
            </div>
          </section>
        </div>

        <QuotePreview quote={quote} items={quote.items || []} totals={quote} entities={legalEntities} />
      </div>

      {showContractModal ? (
        <Suspense fallback={null}>
          <ContractEditorModal
            open={showContractModal}
            quote={quote}
            onClose={closeContractModal}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
