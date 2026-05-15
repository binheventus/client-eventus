import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTrashed, permanentlyDeleteQuote, restoreQuote } from '../hooks/useQuotes'
import { canUseQuoteTrash, getQuoteUserContext } from '../lib/quoteAuth'

const PAGE_SIZE = 20

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('vi-VN')
}

function daysUntilPurge(deletedAt) {
  if (!deletedAt) return '-'
  const purgeAt = new Date(deletedAt)
  purgeAt.setDate(purgeAt.getDate() + 90)
  return Math.max(0, Math.ceil((purgeAt.getTime() - Date.now()) / 86400000))
}

export default function QuoteTrashPage() {
  const navigate = useNavigate()
  const userContext = useMemo(() => getQuoteUserContext(), [])
  const [quotes, setQuotes] = useState([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  async function loadTrash() {
    if (!canUseQuoteTrash(userContext.role)) {
      setError('Bạn cần quyền leader/admin để truy cập thùng rác.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await listTrashed({ role: userContext.role, page, pageSize: PAGE_SIZE })
      setQuotes(result.quotes)
      setCount(result.count)
    } catch (err) {
      setError(err?.message || 'Không tải được thùng rác.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrash()
  }, [page])

  async function handleRestore(id) {
    try {
      await restoreQuote(id, { role: userContext.role })
      await loadTrash()
    } catch (err) {
      setError(err?.message || 'Không khôi phục được báo giá.')
    }
  }

  async function handlePermanentDelete(id) {
    if (!window.confirm('Xóa vĩnh viễn báo giá này? Hành động này không thể hoàn tác.')) return
    try {
      await permanentlyDeleteQuote(id, { role: userContext.role })
      await loadTrash()
    } catch (err) {
      setError(err?.message || 'Không xóa vĩnh viễn được báo giá.')
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/quotes')} className="mb-2 text-[13px] font-semibold text-slate-500 hover:text-slate-900">← Danh sách báo giá</button>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">Thùng rác báo giá</h1>
          <p className="mt-1 text-[13px] text-slate-500">Báo giá đã xóa mềm. Auto-purge sau 90 ngày sẽ làm ở cron job sau.</p>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-[13px]">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Mã BG</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Tên sự kiện</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3">Ngày xóa</th>
                <th className="px-4 py-3">Còn lại</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : quotes.length ? quotes.map(quote => (
                <tr key={quote.id}>
                  <td className="px-4 py-3 font-semibold text-slate-900">{quote.quote_number || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{quote.client_name || quote.customer_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{quote.event_name || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(quote.total_amount)}đ</td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(quote.deleted_at)}</td>
                  <td className="px-4 py-3 text-slate-500">{daysUntilPurge(quote.deleted_at)} ngày</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleRestore(quote.id)} className="rounded-lg px-3 py-1.5 font-semibold text-emerald-700 hover:bg-emerald-50">Khôi phục</button>
                      <button onClick={() => handlePermanentDelete(quote.id)} className="rounded-lg px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">Xóa vĩnh viễn</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Thùng rác trống.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-[13px] text-slate-600">
          <span>{count} báo giá đã xóa</span>
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
