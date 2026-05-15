import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import QuotePreview from '../components/QuotePreview'
import {
  duplicateQuote,
  getQuote,
  getQuoteAuditLogs,
  getQuoteViewStats,
  softDeleteQuote,
} from '../hooks/useQuotes'

const QuotePDFDownloadButton = lazy(() => import('../components/QuotePDFDownloadButton'))

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
  const days = Number(quote.validity_days) || 15
  const date = new Date(quote.created_at)
  date.setDate(date.getDate() + days)
  return date
}

export default function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState(null)
  const [viewStats, setViewStats] = useState({ count: 0, lastViewedAt: null })
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const validUntil = useMemo(() => getValidUntil(quote), [quote])
  const expired = validUntil ? validUntil.getTime() < Date.now() : false

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

  async function copyShareLink() {
    if (!quote?.share_token) return
    await navigator.clipboard?.writeText(`${window.location.origin}/q/${quote.share_token}`)
  }

  async function handleDuplicate() {
    const copied = await duplicateQuote(id)
    navigate(`/quotes/${copied.id}`)
  }

  async function handleDelete() {
    if (!window.confirm('Xóa mềm báo giá này?')) return
    await softDeleteQuote(id)
    navigate('/quotes')
  }

  if (loading) return <div className="p-6 text-slate-500">Đang tải báo giá...</div>
  if (error) return <div className="rounded-xl bg-red-50 p-4 text-[13px] text-red-700">{error}</div>
  if (!quote) return <div className="p-6 text-slate-500">Không tìm thấy báo giá.</div>

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button onClick={() => navigate('/quotes')} className="mb-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900">← Danh sách báo giá</button>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">{quote.quote_number || 'Báo giá'}</h1>
          <p className="mt-1 text-[13px] text-slate-500">{quote.event_name || 'Chưa có tên sự kiện'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate(`/quotes/${id}?mode=edit`)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Sửa</button>
          <button onClick={handleDuplicate} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">Nhân bản</button>
          <button onClick={handleDelete} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] font-semibold text-red-700 hover:bg-red-100">Xóa</button>
          <button onClick={copyShareLink} className="rounded-xl bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-slate-800">Copy link share</button>
          <Suspense fallback={<span className="rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white">Đang tải PDF...</span>}>
            <QuotePDFDownloadButton
              quote={quote}
              items={quote.items || []}
              className="rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-orange-500"
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

        <QuotePreview quote={quote} items={quote.items || []} totals={quote} />
      </div>
    </div>
  )
}
