import { CopyPlus, FileSignature, Trash2 } from 'lucide-react'
import {
  canOpenContractFromQuote,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteClientName,
  getQuoteCreatorName,
  hasSavedContract,
} from '../lib/quoteList'
import QuoteStatusBadge from './QuoteStatusBadge'

const ACTION_BUTTON_BASE = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[12px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none'

function ActionButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`${ACTION_BUTTON_BASE} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

function EmptyRow({ children }) {
  return (
    <tr>
      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">{children}</td>
    </tr>
  )
}

function QuoteActions({ quote, duplicating, onOpenContract, onDuplicateQuote, onDeleteQuote }) {
  const canOpenContract = canOpenContractFromQuote(quote)
  const savedContract = hasSavedContract(quote)
  const contractActionLabel = savedContract ? 'Xem hợp đồng' : 'Tạo hợp đồng'
  const disabledContractLabel = 'Báo giá nháp chưa tạo được hợp đồng'
  const contractActionTitle = canOpenContract ? contractActionLabel : disabledContractLabel
  const contractActionClass = savedContract
    ? 'border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 focus-visible:ring-orange-200'
    : 'bg-[#f8981d] text-white hover:bg-orange-500 focus-visible:ring-orange-200'

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center gap-2">
        <ActionButton
          disabled={!canOpenContract}
          onClick={() => onOpenContract(quote)}
          aria-label={contractActionTitle}
          title={contractActionTitle}
          className={`${contractActionClass} disabled:hover:bg-slate-100`}
        >
          <FileSignature className="h-3.5 w-3.5" />
          {contractActionLabel}
        </ActionButton>
        <button
          type="button"
          disabled={duplicating}
          onClick={() => onDuplicateQuote(quote)}
          title={duplicating ? 'Đang nhân bản báo giá...' : 'Nhân bản báo giá'}
          aria-label={`Nhân bản báo giá ${quote.quote_number || ''}`.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 shadow-sm transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
        >
          <CopyPlus className={`h-4 w-4 ${duplicating ? 'animate-pulse' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => onDeleteQuote(quote)}
          title="Xóa báo giá"
          aria-label={`Xóa báo giá ${quote.quote_number || ''}`.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50 text-orange-700 shadow-sm transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function QuoteOpenButton({ quote, children, className = '', align = 'left', label, onOpenQuote }) {
  const quoteNumber = quote.quote_number || 'báo giá'
  const accessibleLabel = label || `Xem báo giá ${quoteNumber}`

  return (
    <button
      type="button"
      onClick={() => onOpenQuote(quote)}
      title={accessibleLabel}
      aria-label={accessibleLabel}
      className={`inline-flex max-w-full items-center ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'} rounded-md text-[13px] font-semibold text-blue-700 transition hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${className}`}
    >
      {children}
    </button>
  )
}

function QuoteRow({ quote, userContext, duplicatingQuoteId, onOpenQuote, onOpenContract, onDuplicateQuote, onDeleteQuote }) {
  const formattedTotal = `${formatQuoteCurrency(quote.total_amount)}đ`

  return (
    <tr className="hover:bg-orange-50/40">
      <td className="px-4 py-3">
        <QuoteOpenButton quote={quote} onOpenQuote={onOpenQuote}>
          <span className="truncate">{quote.quote_number || '-'}</span>
        </QuoteOpenButton>
      </td>
      <td className="px-4 py-3 text-slate-500">{formatQuoteDate(quote.created_at)}</td>
      <td className="px-4 py-3 text-slate-700">{getQuoteClientName(quote)}</td>
      <td className="px-4 py-3 text-slate-700">{quote.event_name || '-'}</td>
      <td className="px-4 py-3 text-right">
        <QuoteOpenButton
          quote={quote}
          align="right"
          label={`Xem báo giá ${quote.quote_number || ''} từ tổng tiền ${formattedTotal}`.trim()}
          onOpenQuote={onOpenQuote}
          className="w-full tabular-nums"
        >
          {formattedTotal}
        </QuoteOpenButton>
      </td>
      <td className="px-4 py-3"><QuoteStatusBadge status={quote.status} /></td>
      <td className="px-4 py-3 text-slate-500">{getQuoteCreatorName(quote, userContext)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <QuoteActions
          quote={quote}
          duplicating={duplicatingQuoteId === quote.id}
          onOpenContract={onOpenContract}
          onDuplicateQuote={onDuplicateQuote}
          onDeleteQuote={onDeleteQuote}
        />
      </td>
    </tr>
  )
}

export default function QuoteListTable({ quotes, loading, userContext, duplicatingQuoteId, onOpenQuote, onOpenContract, onDuplicateQuote, onDeleteQuote }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-left text-[13px]">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Mã BG</th>
            <th className="px-4 py-3">Ngày tạo</th>
            <th className="px-4 py-3">Khách hàng</th>
            <th className="px-4 py-3">Tên sự kiện</th>
            <th className="px-4 py-3 text-right">Tổng tiền</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3">Người tạo</th>
            <th className="px-4 py-3 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <EmptyRow>Đang tải...</EmptyRow>
          ) : quotes.length ? quotes.map(quote => (
            <QuoteRow
              key={quote.id}
              quote={quote}
              userContext={userContext}
              duplicatingQuoteId={duplicatingQuoteId}
              onOpenQuote={onOpenQuote}
              onOpenContract={onOpenContract}
              onDuplicateQuote={onDuplicateQuote}
              onDeleteQuote={onDeleteQuote}
            />
          )) : (
            <EmptyRow>Chưa có báo giá.</EmptyRow>
          )}
        </tbody>
      </table>
    </div>
  )
}
