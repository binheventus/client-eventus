import { CopyPlus, FileSignature, Trash2 } from 'lucide-react'
import {
  canCreateContractFromQuote,
  formatQuoteCurrency,
  formatQuoteDate,
  getQuoteClientName,
  getQuoteCreatorName,
  hasSavedContract,
} from '../lib/quoteList'
import {
  getQuoteSurveyResponseLabel,
  getQuoteSurveyResponseTone,
  hasQuoteSurveyResponse,
} from '../lib/quoteSurvey'
import { getContractDocumentEditRoute, getContractRoute } from '../lib/contractRouting'

const DOCUMENT_BADGE_BASE = 'inline-flex h-7 max-w-full items-center rounded-full border px-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2'
const DOCUMENT_BADGE_TONE = 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:ring-blue-200'

function EmptyRow({ children }) {
  return (
    <tr>
      <td colSpan={9} className="px-4 py-10 text-center text-slate-400">{children}</td>
    </tr>
  )
}

function QuoteActions({ quote, duplicating, onDuplicateQuote, onDeleteQuote }) {
  return (
    <div className="flex justify-end">
      <div className="inline-flex items-center gap-2">
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

function getQuoteDocumentEditHref(document = {}) {
  if (document.type === 'contract') return getContractRoute(document)
  return getContractDocumentEditRoute(document.contract_id, document)
}

function QuoteDocumentBadges({ quote, documents = [], onOpenContract }) {
  const linkedDocuments = documents.filter(document => document?.id || document?.url)
  const savedContract = hasSavedContract(quote)
  const canCreateContract = canCreateContractFromQuote(quote)
  const showCreateContract = !savedContract

  if (!linkedDocuments.length && !showCreateContract) return <span className="text-slate-300">-</span>

  return (
    <div className="flex max-w-[240px] flex-wrap gap-1.5">
      {showCreateContract ? (
        <button
          type="button"
          disabled={!canCreateContract}
          onClick={() => onOpenContract(quote)}
          aria-label={canCreateContract ? 'Tạo hợp đồng' : 'Báo giá này chưa tạo được hợp đồng'}
          title={canCreateContract ? 'Tạo hợp đồng từ báo giá này' : 'Báo giá này chưa tạo được hợp đồng'}
          className={`${DOCUMENT_BADGE_BASE} cursor-pointer border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 focus-visible:ring-orange-200 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:hover:bg-slate-50 disabled:hover:text-slate-400`}
        >
          <FileSignature className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">+ Tạo hợp đồng</span>
        </button>
      ) : null}
      {linkedDocuments.map(document => {
        const editHref = getQuoteDocumentEditHref(document)

        return (
          <a
            key={`${document.type}-${document.id || document.url}`}
            href={editHref}
            target="_blank"
            rel="noreferrer"
            title={document.number ? `${document.label}: ${document.number}` : document.label}
            className={`${DOCUMENT_BADGE_BASE} ${DOCUMENT_BADGE_TONE}`}
          >
            <span className="truncate">{document.label}</span>
          </a>
        )
      })}
    </div>
  )
}

function QuoteSurveyResponseBadge({ response }) {
  if (!hasQuoteSurveyResponse(response)) return <span className="text-slate-300">-</span>

  return (
    <div className="max-w-[320px] space-y-1.5">
      <span className={`inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getQuoteSurveyResponseTone(response)}`}>
        <span className="truncate">{getQuoteSurveyResponseLabel(response)}</span>
      </span>
      {response.selected_tag ? (
        <p className="text-[11px] leading-4 text-slate-500" title={response.selected_tag}>
          {response.selected_tag}
        </p>
      ) : null}
    </div>
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
      <td className="px-4 py-3">
        <QuoteDocumentBadges quote={quote} documents={quote.quote_documents || []} onOpenContract={onOpenContract} />
      </td>
      <td className="px-4 py-3">
        <QuoteSurveyResponseBadge response={quote.survey_response} />
      </td>
      <td className="px-4 py-3 text-slate-500">{getQuoteCreatorName(quote, userContext)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <QuoteActions
          quote={quote}
          duplicating={duplicatingQuoteId === quote.id}
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
      <table className="min-w-[1380px] w-full text-left text-[13px]">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-4 py-3">Mã BG</th>
            <th className="px-4 py-3">Ngày tạo</th>
            <th className="px-4 py-3">Khách hàng</th>
            <th className="px-4 py-3">Tên sự kiện</th>
            <th className="px-4 py-3 text-right">Tổng tiền</th>
            <th className="px-4 py-3">Chứng từ</th>
            <th className="w-[320px] px-4 py-3">Survey responses</th>
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
