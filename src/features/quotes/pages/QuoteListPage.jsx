import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { duplicateQuote, listQuotes, softDeleteQuote } from '../hooks/useQuotes'
import { canViewAllQuotes, getQuoteUserContext } from '../lib/quoteAuth'

const PAGE_SIZE = 20

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

function getClientName(quote) {
  return quote.client_name || quote.customer_name || quote.client?.name || '-'
}

function StatusBadge({ status }) {
  const tone = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  }[status] || 'bg-slate-100 text-slate-700'

  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{status || 'draft'}</span>
}

export default function QuoteListPage() {
  const navigate = useNavigate()
  const userContext = useMemo(() => getQuoteUserContext(), [])
  const [quotes, setQuotes] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    tier_code: '',
    entity_code: '',
    created_by: '',
    date_from: '',
    date_to: '',
  })

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  async function loadQuotes() {
    setLoading(true)
    setError('')

    try {
      const effectiveFilters = { ...filters }
      if (!canViewAllQuotes(userContext.role)) {
        if (userContext.userId) effectiveFilters.created_by = userContext.userId
      }
      const result = await listQuotes({ filters: effectiveFilters, page, pageSize: PAGE_SIZE })
      setQuotes(result.quotes)
      setCount(result.count)
    } catch (err) {
      setError(err?.message || 'Không tải được danh sách báo giá.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuotes()
  }, [page, filters.status, filters.tier_code, filters.entity_code, filters.created_by, filters.date_from, filters.date_to])

  function updateFilter(key, value) {
    setPage(1)
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  async function handleDuplicate(id) {
    try {
      const copied = await duplicateQuote(id)
      navigate(`/quotes/${copied.id}`)
    } catch (err) {
      setError(err?.message || 'Không nhân bản được báo giá.')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Xóa mềm báo giá này?')) return
    try {
      await softDeleteQuote(id)
      await loadQuotes()
    } catch (err) {
      setError(err?.message || 'Không xóa được báo giá.')
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Báo giá</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {canViewAllQuotes(userContext.role) ? 'Đang xem toàn bộ báo giá.' : 'Sales chỉ xem báo giá của chính mình khi có user id trong session.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/quotes/new')}
          className="rounded-xl bg-[#f8981d] px-4 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500"
        >
          + Tạo báo giá mới
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <input
            value={filters.search}
            onChange={event => updateFilter('search', event.target.value)}
            onKeyDown={event => event.key === 'Enter' && loadQuotes()}
            placeholder="Tìm mã BG, khách, sự kiện..."
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d] xl:col-span-2"
          />
          <select value={filters.status} onChange={event => updateFilter('status', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]">
            <option value="">Tất cả trạng thái</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={filters.tier_code} onChange={event => updateFilter('tier_code', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]">
            <option value="">Tất cả tier</option>
            <option value="TIER_1">TIER_1</option>
            <option value="TIER_2">TIER_2</option>
            <option value="TIER_3">TIER_3</option>
          </select>
          <select value={filters.entity_code} onChange={event => updateFilter('entity_code', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]">
            <option value="">Tất cả pháp nhân</option>
            <option value="EVENTUS">Eventus</option>
            <option value="MEDIAMONSTER">Mediamonster</option>
          </select>
          <input value={filters.created_by} onChange={event => updateFilter('created_by', event.target.value)} placeholder="Sales/user id" className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]" />
          <input type="date" value={filters.date_from} onChange={event => updateFilter('date_from', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]" />
          <input type="date" value={filters.date_to} onChange={event => updateFilter('date_to', event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]" />
        </div>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã BG</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tên sự kiện</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Sales tạo</th>
                <th className="px-4 py-3">Ngày tạo</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : quotes.length ? quotes.map(quote => (
                <tr key={quote.id} className="hover:bg-orange-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">{quote.quote_number || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{getClientName(quote)}</td>
                  <td className="px-4 py-3 text-slate-700">{quote.event_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(quote.total_amount)}đ</td>
                  <td className="px-4 py-3"><StatusBadge status={quote.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{quote.created_by_name || quote.sales_name || quote.created_by || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(quote.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => navigate(`/quotes/${quote.id}`)} className="rounded-lg px-2.5 py-1.5 font-semibold text-blue-700 hover:bg-blue-50">Xem</button>
                      <button onClick={() => navigate(`/quotes/${quote.id}?mode=edit`)} className="rounded-lg px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100">Sửa</button>
                      <button onClick={() => handleDuplicate(quote.id)} className="rounded-lg px-2.5 py-1.5 font-semibold text-slate-600 hover:bg-slate-100">Nhân bản</button>
                      <button onClick={() => handleDelete(quote.id)} className="rounded-lg px-2.5 py-1.5 font-semibold text-red-600 hover:bg-red-50">Xóa</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">Chưa có báo giá.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[13px] text-slate-600">
          <span>{count} báo giá</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(prev => prev - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(prev => prev + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 disabled:opacity-40">Sau</button>
          </div>
        </div>
      </section>
    </div>
  )
}
