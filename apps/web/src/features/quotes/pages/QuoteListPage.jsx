import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, FileSignature, ScrollText, Trash2 } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteListFilters from '../components/QuoteListFilters'
import QuoteListTable from '../components/QuoteListTable'
import QuotePagination from '../components/QuotePagination'
import { useQuoteList } from '../hooks/useQuoteList'
import { softDeleteQuote } from '../hooks/useQuotes'
import {
  canOpenContractFromQuote,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteClientName,
  getQuoteCreatorName,
} from '../lib/quoteList'

function DeleteQuoteConfirmModal({ quote, userContext, deleting, error, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!deleting) onCancel?.()
  })

  if (!quote) return null

  const detailRows = [
    ['Mã báo giá', quote.quote_number || '-'],
    ['Khách hàng', getQuoteClientName(quote)],
    ['Tên sự kiện', quote.event_name || '-'],
    ['Tổng tiền', `${formatQuoteCurrency(quote.total_amount)}đ`],
    ['Người tạo', getQuoteCreatorName(quote, userContext)],
    ['Ngày tạo', formatQuoteDate(quote.created_at)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Xóa báo giá</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Báo giá sẽ được chuyển vào thùng rác. Vui lòng kiểm tra lại thông tin trước khi xóa.
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
            {deleting ? 'Đang xóa...' : 'Xóa báo giá'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function QuoteListPage() {
  const navigate = useNavigate()
  const [quoteToDelete, setQuoteToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const {
    quotes,
    count,
    page,
    setPage,
    totalPages,
    loading,
    error,
    filters,
    updateFilter,
    reload,
    userContext,
  } = useQuoteList()
  const displayName = userContext.name || 'Eventus'

  function openContractPage(quote) {
    if (!canOpenContractFromQuote(quote)) return
    navigate(`/quotes/${quote.id}?contract=1`)
  }

  async function confirmDeleteQuote() {
    if (!quoteToDelete?.id) return

    setDeleting(true)
    setDeleteError('')
    try {
      await softDeleteQuote(quoteToDelete.id)
      setQuoteToDelete(null)
      await reload()
    } catch (err) {
      setDeleteError(err?.message || 'Không xóa được báo giá.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-semibold text-slate-500">Xin chào, {displayName}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">Báo giá</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/quotes/contract-templates')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <ScrollText className="h-4 w-4" />
            Mẫu hợp đồng
          </button>
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
          >
            <FileSignature className="h-4 w-4" />
            Tạo hợp đồng mới
          </button>
          <button
            type="button"
            onClick={() => navigate('/quotes/new')}
            className="rounded-xl bg-[#f8981d] px-4 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500"
          >
            + Tạo báo giá mới
          </button>
        </div>
      </div>

      <QuoteListFilters
        filters={filters}
        onFilterChange={updateFilter}
        onSearchSubmit={reload}
      />

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <QuoteListTable
          quotes={quotes}
          loading={loading}
          userContext={userContext}
          onOpenQuote={quote => navigate(`/quotes/${quote.id}`)}
          onOpenContract={openContractPage}
          onDeleteQuote={setQuoteToDelete}
        />
        <QuotePagination
          count={count}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>

      {quoteToDelete ? (
        <DeleteQuoteConfirmModal
          quote={quoteToDelete}
          userContext={userContext}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            setQuoteToDelete(null)
            setDeleteError('')
          }}
          onConfirm={confirmDeleteQuote}
        />
      ) : null}
    </div>
  )
}
