import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, CopyPlus, Database, FileCheck2, FileSignature, ShoppingCart, Trash2 } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteListFilters from '../components/QuoteListFilters'
import QuoteListTable from '../components/QuoteListTable'
import QuotePagination from '../components/QuotePagination'
import { useQuoteList } from '../hooks/useQuoteList'
import { duplicateQuote, softDeleteQuote } from '../hooks/useQuotes'
import {
  canCreateContractFromQuote,
  canOpenContractFromQuote,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteClientName,
  getQuoteCreatorName,
} from '../lib/quoteList'
import { getContractRoute, getNewContractRoute, getNewQuoteDocumentRoute } from '../lib/contractRouting'

const HEADER_ACTION_BUTTON = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300'
const CREATE_DOCUMENT_MENU_ITEM = 'inline-flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-[13px] font-semibold text-slate-700 shadow-none transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-300'

function DeleteQuoteConfirmModal({ quote, userContext, deleting, error, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!deleting) onCancel?.()
  })

  if (!quote) return null

  const detailRows = [
    ['Mã báo giá', quote.quote_number || '-'],
    ['Khách hàng', getQuoteClientName(quote)],
    ['Tổng tiền', `${formatQuoteCurrency(quote.total_amount)}đ`],
    ['Người tạo', getQuoteCreatorName(quote, userContext)],
    ['Ngày tạo', formatQuoteDate(quote.created_at)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Đang xóa...' : 'Xóa báo giá'}
          </button>
        </div>
      </section>
    </div>
  )
}

function DuplicateQuoteConfirmModal({ quote, userContext, duplicating, error, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!duplicating) onCancel?.()
  })

  if (!quote) return null

  const detailRows = [
    ['Mã báo giá', quote.quote_number || '-'],
    ['Khách hàng', getQuoteClientName(quote)],
    ['Tổng tiền', `${formatQuoteCurrency(quote.total_amount)}đ`],
    ['Người tạo', getQuoteCreatorName(quote, userContext)],
    ['Ngày tạo', formatQuoteDate(quote.created_at)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
            <CopyPlus className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Nhân bản báo giá</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Bạn có muốn nhân bản báo giá này không? Bản sao sẽ được tạo kèm link gửi khách mới.
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
            disabled={duplicating}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={duplicating}
            className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
          >
            <CopyPlus className={`h-4 w-4 ${duplicating ? 'animate-pulse' : ''}`} />
            {duplicating ? 'Đang nhân bản...' : 'Nhân bản báo giá'}
          </button>
        </div>
      </section>
    </div>
  )
}

function CreateDocumentMenu({ onCreateContract, onCreateOrder, onCreateAcceptance }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function closeOnOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  function runAction(action) {
    setOpen(false)
    action?.()
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(current => !current)}
        className={HEADER_ACTION_BUTTON}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <FileSignature className="h-4 w-4" />
        Tạo chứng từ
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/70"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onCreateContract)}
            className={CREATE_DOCUMENT_MENU_ITEM}
          >
            <FileSignature className="h-4 w-4" />
            Tạo hợp đồng
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            onClick={() => runAction(onCreateOrder)}
            title="Tính năng này sẽ làm sau"
            className={CREATE_DOCUMENT_MENU_ITEM}
          >
            <ShoppingCart className="h-4 w-4" />
            Tạo đơn đặt hàng
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onCreateAcceptance)}
            className={CREATE_DOCUMENT_MENU_ITEM}
          >
            <FileCheck2 className="h-4 w-4" />
            Tạo BBNT
          </button>
        </div>
      ) : null}
    </div>
  )
}

function AcceptanceQuotePickerModal({ quotes = [], userContext, onCancel, onSelect }) {
  useEscapeToClose(onCancel)
  const [searchText, setSearchText] = useState('')

  const availableQuotes = quotes.filter(canCreateContractFromQuote)
  const normalizedSearch = searchText.trim().toLowerCase()
  const filteredQuotes = normalizedSearch
    ? availableQuotes.filter(quote => [
        quote.quote_number,
        quote.id,
        getQuoteClientName(quote),
        getQuoteCreatorName(quote, userContext),
        formatQuoteCurrency(quote.total_amount),
        String(Number(quote.total_amount) || ''),
        formatQuoteDate(quote.created_at),
        quote.created_at,
      ].some(value => String(value || '').toLowerCase().includes(normalizedSearch)))
    : availableQuotes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="border-b border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold text-slate-950">Chọn báo giá để tạo BBNT</h2>
              <p className="mt-2 text-[13px] leading-6 text-slate-600">
                BBNT sẽ được tạo trực tiếp từ báo giá, không cần tạo hợp đồng trước.
              </p>
            </div>
          </div>
          <input
            type="search"
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Nhập tên khách hàng, tổng số tiền hoặc ngày tạo báo giá để tìm"
            className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
          />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {filteredQuotes.length ? (
            <div className="space-y-2">
              {filteredQuotes.map(quote => (
                <button
                  key={quote.id}
                  type="button"
                  onClick={() => onSelect(quote)}
                  className="grid w-full gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-orange-200 hover:bg-orange-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold text-slate-900">{quote.quote_number || quote.id}</span>
                    <span className="mt-1 block truncate text-[12px] font-semibold text-slate-500">
                      {getQuoteClientName(quote)} · {getQuoteCreatorName(quote, userContext)}
                    </span>
                  </span>
                  <span className="text-[13px] font-bold tabular-nums text-orange-700">{formatQuoteCurrency(quote.total_amount)}đ</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-500">
              {availableQuotes.length ? 'Không tìm thấy báo giá phù hợp.' : 'Không có báo giá khả dụng trong danh sách hiện tại.'}
            </p>
          )}
        </div>

        <footer className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
        </footer>
      </section>
    </div>
  )
}

export default function QuoteListPage() {
  const navigate = useNavigate()
  const [quoteToDelete, setQuoteToDelete] = useState(null)
  const [quoteToDuplicate, setQuoteToDuplicate] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [duplicatingQuoteId, setDuplicatingQuoteId] = useState('')
  const [duplicateError, setDuplicateError] = useState('')
  const [showAcceptanceQuotePicker, setShowAcceptanceQuotePicker] = useState(false)
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

  function openContractPage(quote) {
    if (!canOpenContractFromQuote(quote)) return
    if (quote.contract_id) {
      navigate(getContractRoute(quote))
      return
    }
    navigate(getNewContractRoute({ source: 'quote', quoteId: quote.id }))
  }

  function openNewContractPage() {
    navigate('/contracts/new')
  }

  function openAcceptanceCreateFlow() {
    const availableQuotes = quotes.filter(canCreateContractFromQuote)
    if (availableQuotes.length === 1) {
      navigate(getNewQuoteDocumentRoute(availableQuotes[0], 'acceptance_liquidation'))
      return
    }
    setShowAcceptanceQuotePicker(true)
  }

  function openAcceptanceForQuote(quote) {
    setShowAcceptanceQuotePicker(false)
    navigate(getNewQuoteDocumentRoute(quote, 'acceptance_liquidation'))
  }

  function openDuplicateConfirm(quote) {
    if (!quote?.id || duplicatingQuoteId) return
    setQuoteToDuplicate(quote)
    setDuplicateError('')
  }

  async function confirmDuplicateQuote() {
    if (!quoteToDuplicate?.id || duplicatingQuoteId) return

    setDuplicatingQuoteId(quoteToDuplicate.id)
    setDuplicateError('')
    try {
      const duplicated = await duplicateQuote(quoteToDuplicate.id)
      setDuplicatingQuoteId('')
      setQuoteToDuplicate(null)
      navigate(`/quotes/${duplicated.id}/edit`)
    } catch (err) {
      setDuplicateError(err?.message || 'Không nhân bản được báo giá.')
      setDuplicatingQuoteId('')
    }
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
          <h1 className="text-[24px] font-semibold tracking-tight text-slate-950">Hệ thống quản lý chứng từ Eventus</h1>
          <p className="mt-2 text-[13px] font-semibold text-[#f8981d]">
            Truy xuất nhanh chóng. Quản lý bảo mật. Tập trung dữ liệu.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/pricing-admin')}
            className={HEADER_ACTION_BUTTON}
          >
            <Database className="h-4 w-4" />
            Bảng giá
          </button>
          <CreateDocumentMenu
            onCreateContract={openNewContractPage}
            onCreateOrder={() => {}}
            onCreateAcceptance={openAcceptanceCreateFlow}
          />
          <button
            type="button"
            onClick={() => navigate('/contracts')}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-[13px] font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
          >
            <FileSignature className="h-4 w-4" />
            Quản lý hợp đồng
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
      {duplicateError && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{duplicateError}</p>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <QuoteListTable
          quotes={quotes}
          loading={loading}
          userContext={userContext}
          duplicatingQuoteId={duplicatingQuoteId}
          onOpenQuote={quote => navigate(`/quotes/${quote.id}`)}
          onOpenContract={openContractPage}
          onDuplicateQuote={openDuplicateConfirm}
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

      {quoteToDuplicate ? (
        <DuplicateQuoteConfirmModal
          quote={quoteToDuplicate}
          userContext={userContext}
          duplicating={duplicatingQuoteId === quoteToDuplicate.id}
          error={duplicateError}
          onCancel={() => {
            setQuoteToDuplicate(null)
            setDuplicateError('')
          }}
          onConfirm={confirmDuplicateQuote}
        />
      ) : null}

      {showAcceptanceQuotePicker ? (
        <AcceptanceQuotePickerModal
          quotes={quotes}
          userContext={userContext}
          onCancel={() => setShowAcceptanceQuotePicker(false)}
          onSelect={openAcceptanceForQuote}
        />
      ) : null}
    </div>
  )
}
