import { useNavigate } from 'react-router-dom'
import { ScrollText } from 'lucide-react'
import QuoteListFilters from '../components/QuoteListFilters'
import QuoteListTable from '../components/QuoteListTable'
import QuotePagination from '../components/QuotePagination'
import { useQuoteList } from '../hooks/useQuoteList'
import { canOpenContractFromQuote } from '../lib/quoteList'

export default function QuoteListPage() {
  const navigate = useNavigate()
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
          onOpenQuote={quote => navigate(`/quotes/${quote.id}`)}
          onOpenContract={openContractPage}
        />
        <QuotePagination
          count={count}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </section>
    </div>
  )
}
