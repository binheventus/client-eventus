import { Eye, FileSignature } from 'lucide-react'
import {
  canOpenContractFromQuote,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteClientName,
  hasSavedContract,
} from '../lib/quoteList'
import QuoteStatusBadge from './QuoteStatusBadge'

const ACTION_BUTTON_BASE = 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3.5 text-[12px] font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none'

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

function QuoteActions({ quote, onOpenQuote, onOpenContract }) {
  const canOpenContract = canOpenContractFromQuote(quote)
  const savedContract = hasSavedContract(quote)
  const contractActionLabel = savedContract ? 'Xem hợp đồng' : 'Tạo hợp đồng'
  const disabledContractLabel = 'Báo giá nháp chưa tạo được hợp đồng'
  const contractActionTitle = canOpenContract ? contractActionLabel : disabledContractLabel
  const contractActionClass = savedContract
    ? 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-200'
    : 'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-200'

  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center gap-2">
        <ActionButton
          onClick={() => onOpenQuote(quote)}
          title="Xem báo giá"
          aria-label="Xem báo giá"
          className="bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-200"
        >
          <Eye className="h-3.5 w-3.5" />
          Xem báo giá
        </ActionButton>
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
      </div>
    </div>
  )
}

function QuoteRow({ quote, onOpenQuote, onOpenContract }) {
  return (
    <tr className="hover:bg-orange-50/40">
      <td className="px-4 py-3 font-semibold text-slate-900">{quote.quote_number || '-'}</td>
      <td className="px-4 py-3 text-slate-700">{getQuoteClientName(quote)}</td>
      <td className="px-4 py-3 text-slate-700">{quote.event_name || '-'}</td>
      <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQuoteCurrency(quote.total_amount)}đ</td>
      <td className="px-4 py-3"><QuoteStatusBadge status={quote.status} /></td>
      <td className="px-4 py-3 text-slate-500">{quote.created_by_name || quote.sales_name || quote.created_by || '-'}</td>
      <td className="px-4 py-3 text-slate-500">{formatQuoteDate(quote.created_at)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <QuoteActions
          quote={quote}
          onOpenQuote={onOpenQuote}
          onOpenContract={onOpenContract}
        />
      </td>
    </tr>
  )
}

export default function QuoteListTable({ quotes, loading, onOpenQuote, onOpenContract }) {
  return (
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
              onOpenQuote={onOpenQuote}
              onOpenContract={onOpenContract}
            />
          )) : (
            <EmptyRow>Chưa có báo giá.</EmptyRow>
          )}
        </tbody>
      </table>
    </div>
  )
}
